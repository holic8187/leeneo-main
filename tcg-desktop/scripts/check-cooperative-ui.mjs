// Isolated browser acceptance check. Run local Vite with
// VITE_TCG_API_BASE=https://cards.test; no request touches production accounts.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDefaultState } from '../src/core/gameState.js';
import { cardById, RAID_DEFINITION } from '../src/data/cardCatalog.js';
import { createCooperativeBoss } from '../src/core/cooperativeRaidRules.js';
import { createRaidBattle, startRaidBattle, performPlayerAction, performBossAction } from '../src/core/turnRaidEngine.js';

const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
const output = process.env.UI_TEST_ARTIFACTS || join(process.cwd(), 'release', 'qa-cooperative');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });

try {
  for (const [name, viewport] of [['small-mobile', { width: 360, height: 800 }], ['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
    const context = await browser.newContext({ viewport, isMobile: name !== 'desktop', hasTouch: name !== 'desktop' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let account = { id: `coop-ui-${name}`, username: 'coop_ui', nickname: '협동 테스트' };
    let revision = 1;
    let remoteState = createDefaultState();
    remoteState.collection = { 'guma-hr': 1, 'morae-c': 1, 'coca-c': 1, 'winter-c': 1, 'winter-ur': 1, 'hoi-ssr': 1 };
    remoteState.cardProgression = {};
    remoteState.profile.displayName = account.nickname;
    let phase = 'idle';
    let cards = [];
    let room = null;
    let match = null;
    let entered = false;
    const actions = [];
    const claimBodies = [];
    let claimApplied = false;
    let releaseRead = null;
    let pauseNextRead = false;
    const resetsAt = Date.now() + 3600000;
    const idle = () => ({ phase: 'idle', entriesRemaining: entered ? 1 : 2, entriesUsed: entered ? 1 : 0, resetsAt, serverNow: Date.now() });
    const cooperative = () => ({ ...idle(), phase, ...(phase === 'queued' ? { queue: { cards, queuedAt: 1, queuedCount: 3, reason: '4명이 모이면 입장을 확인합니다.' } } : {}), ...(phase === 'ready' ? { match } : {}), ...(['battle', 'finished'].includes(phase) ? { room, reward: room.reward } : {}) });
    const snapshot = () => ({ leaseId: 'test-lease', generation: 1, revision, initialized: true, state: remoteState, expiresAt: Date.now() + 60000 });
    const makeRoom = () => {
      const selected = ['guma-hr', 'winter-c', 'morae-c', 'coca-c'];
      const participants = selected.map((cardId, index) => ({ accountId: index === 0 ? account.id : `other-${index}`, nickname: index === 0 ? account.nickname : ['겨울', '길잡이', '코카'][index - 1], stage: 6, cardId, instanceId: `member-${index}`, card: { ...cardById(cardId), cardId, instanceId: `member-${index}`, attack: 15000, maxHp: 100, enhancement: 0 } }));
      return { id: `room-${name}`, revision: 1, stageSum: 24, participants, activeAccountId: account.id, turnExpiresAt: Date.now() + 20000, battle: startRaidBattle(createRaidBattle({ cards: participants.map((p) => p.card), boss: createCooperativeBoss(24), seed: 121, now: Date.now() }), Date.now()) };
    };
    await context.route('**/api/tcg/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let payload;
      if (path === '/api/tcg/auth/me') payload = { account };
      else if (path === '/api/tcg/auth/login') payload = { account, token: 'second-token' };
      else if (path === '/api/tcg/play-session/open') payload = snapshot();
      else if (path === '/api/tcg/game-state') { remoteState = route.request().postDataJSON().state; payload = { revision: ++revision }; }
      else if (path.includes('/play-session/')) payload = { revision, expiresAt: Date.now() + 60000 };
      else if (path.includes('/raids/personal/')) payload = { state: { id: RAID_DEFINITION.id, hp: 100000, maxHp: 100000, stage: 6, remainingEntries: 5 }, ranking: { entries: [] } };
      else if (path === '/api/tcg/mail') payload = { mailbox: [] };
      else if (path.endsWith('/cooperative/state')) {
        payload = { cooperative: cooperative() };
        if (pauseNextRead) { pauseNextRead = false; await new Promise((resolve) => { releaseRead = resolve; }); }
      } else if (path.endsWith('/cooperative/queue')) {
        cards = route.request().postDataJSON().cards;
        assert.equal(cards.length, 3);
        assert.ok(route.request().postDataJSON().leaseId);
        phase = 'queued'; payload = { cooperative: cooperative() };
      } else if (path.endsWith('/cooperative/accept')) {
        assert.equal(route.request().postDataJSON().matchId, match.id);
        entered = true; room = makeRoom(); phase = 'battle'; payload = { cooperative: cooperative() };
      } else if (path.endsWith('/cooperative/action')) {
        const action = route.request().postDataJSON(); actions.push(action);
        assert.equal(action.expectedRevision, room.revision);
        room.battle = performPlayerAction(room.battle, { type: action.action, targetId: action.targetId, choice: action.choice }, Date.now());
        if (room.battle.currentActor === 'boss') room.battle = performBossAction(room.battle, null, Date.now());
        room.revision += 1;
        room.activeAccountId = room.participants[room.battle.currentActorIndex]?.accountId || '';
        room.turnExpiresAt = Date.now() + 20000;
        payload = { cooperative: cooperative() };
      } else if (path.endsWith('/cooperative/claim')) {
        const body = route.request().postDataJSON(); claimBodies.push(body);
        if (name === 'mobile' && claimBodies.length === 1) {
          remoteState.wallet.coins += 37; revision += 1;
          await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'SAVE_CONFLICT', msg: '최신 저장 기록을 불러온 후 보상을 다시 받아주세요.', ...snapshot() }) });
          return;
        }
        if (!claimApplied) {
          assert.equal(body.baseRevision, revision);
          remoteState.wallet.coins += 12000;
          remoteState.packs.standard += 6;
          remoteState.collection['winter-sr'] = (remoteState.collection['winter-sr'] || 0) + 1;
          revision += 1; claimApplied = true;
        }
        phase = 'idle';
        // Exercise a saved reward whose initial response was lost in transit.
        if (name === 'desktop' && claimBodies.length === 1) { await route.abort('failed'); return; }
        payload = { cooperative: cooperative(), snapshot: snapshot(), alreadyClaimed: claimBodies.length > 1 };
      } else if (path.endsWith('/cooperative/leave')) { phase = 'idle'; payload = { cooperative: cooperative() }; }
      else throw new Error(`Unmocked API request ${path}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
    await context.addInitScript(({ account }) => localStorage.setItem('hoi-card-desk-auth-v1', JSON.stringify({ token: 'first-token', account })), { account });
    const click = (selector) => page.locator(selector).click();
    const shot = async (label, preserveScroll = false) => {
      if (!preserveScroll && await page.locator('.view-host').count()) {
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.locator('.view-host').evaluate((node) => { node.scrollTop = 0; });
        await page.waitForTimeout(150);
      }
      return page.screenshot({ path: join(output, `${name}-${label}.png`), fullPage: true, animations: 'disabled' });
    };
    const noOverflow = async () => {
      assert.equal(await page.locator('.view-host').evaluate((node) => node.scrollWidth > node.clientWidth + 1), false, `${name}: no main horizontal overflow`);
      assert.equal(await page.locator('body').evaluate((node) => node.scrollWidth > innerWidth + 1), false, `${name}: no viewport horizontal overflow`);
    };
    try {
      await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1427/');
      await page.locator('.cloud-session-gate').waitFor({ state: 'hidden' });
      await click('.primary-nav [data-view="raid"]');
      await click('[data-action="switch-raid-mode"][data-raid-mode="cooperative"]');
      await page.locator('.coop-card-grid').waitFor();
      for (const id of ['guma-hr', 'winter-c', 'morae-c']) await click(`.coop-card-grid [data-card-id="${id}"]`);
      assert.equal(await page.locator('.coop-selected-slots .coop-card-art').count(), 3);
      await noOverflow(); await shot('selection');
      await click('[data-action="coop-queue"]');
      await page.locator('.coop-queue-status').waitFor();
      await click('.primary-nav [data-view="dashboard"]');
      await page.locator('.coop-return-banner').waitFor();
      room = makeRoom();
      match = { id: 'match-1', stageSum: 24, expiresAt: Date.now() + 30000, participants: room.participants, acceptedAccountIds: ['other-1', 'other-2', 'other-3'] };
      phase = 'ready';
      await page.locator('.coop-ready-dialog').waitFor();
      assert.equal(await page.locator('[data-action="coop-accept"]').evaluate((node) => document.activeElement === node), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('.coop-ready-dialog [data-action="coop-leave"]').evaluate((node) => document.activeElement === node), true);
      await page.keyboard.press('Tab');
      await shot('ready');
      await page.keyboard.press('Enter');
      await page.locator('.coop-ready-dialog').waitFor({ state: 'hidden' });
      await click('.coop-return-banner');
      await page.locator('[data-action="coop-basic"]').waitFor();
      assert.equal(await page.locator('.coop-combat-card').count(), 4);
      await noOverflow(); await shot('battle');
      await page.locator('.coop-action-panel').scrollIntoViewIfNeeded(); await shot('battle-actions', true);
      await click('[data-action="coop-basic"]');
      await page.locator('[data-action="coop-basic"]').waitFor({ state: 'hidden' });
      assert.equal(actions[0].action, 'basic');
      assert.equal(actions[0].targetId, undefined);
      room.battle.currentActor = 'card'; room.battle.currentActorIndex = 0; room.battle.cards[0].cooldown = 0;
      room.activeAccountId = account.id; room.turnExpiresAt = Date.now() + 20000; room.revision += 1;
      await page.locator('[data-coop-choice]').waitFor();
      await page.selectOption('[data-coop-target]', 'member-1');
      await page.selectOption('[data-coop-choice]', 'reversal');
      await click('[data-action="coop-skill"]');
      await page.locator('[data-action="coop-skill"]').waitFor({ state: 'hidden' });
      assert.equal(actions[1].action, 'skill'); assert.equal(actions[1].targetId, 'member-1'); assert.equal(actions[1].choice, 'reversal');
      phase = 'finished'; room.battle.status = 'finished'; room.battle.result = 'victory'; room.battle.boss.hp = 0; room.revision += 1;
      room.reward = { coins: 12000, standardPacks: 6, cards: [{ cardId: 'winter-sr', quantity: 1 }], equipment: [], relics: [] };
      await page.locator('[data-action="coop-claim"]').waitFor(); await noOverflow();
      await page.locator('.coop-result').scrollIntoViewIfNeeded(); await shot('finished', true);
      await click('[data-action="coop-claim"]');
      if (name === 'mobile') {
        await page.locator('.app-notice').filter({ hasText: '최신 저장 기록을 반영했습니다' }).waitFor();
        await click('[data-action="coop-claim"]');
      }
      await page.locator('[data-action="coop-claim"]').waitFor({ state: 'hidden' });
      const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem(`hoi-card-desk-state-v2:${id}`)), account.id);
      assert.equal(saved.collection['winter-sr'], 1);
      assert.equal(claimBodies.length, name === 'small-mobile' ? 1 : 2);
      if (name === 'desktop') assert.deepEqual(claimBodies[0], claimBodies[1]);
      if (name === 'mobile') assert.equal(claimBodies[1].baseRevision, claimBodies[0].baseRevision + 1);
      // Let an old ready response outlive logout/login in this same JS session.
      phase = 'ready'; match.expiresAt = Date.now() + 30000; pauseNextRead = true;
      await page.waitForFunction(() => true);
      await new Promise((resolve) => { const timer = setInterval(() => { if (releaseRead) { clearInterval(timer); resolve(); } }, 20); });
      await click('.top-actions .icon-button[data-action="open-settings"]');
      await click('[data-action="logout"]');
      await page.locator('#login-username').waitFor();
      account = { id: `${account.id}-second`, username: 'second_user', nickname: '두 번째 계정' };
      remoteState = createDefaultState(); revision = 1; phase = 'idle'; entered = false;
      await page.fill('#login-username', 'second_user'); await page.fill('#login-password', 'test-pass');
      await click('.auth-submit');
      await page.locator('.app-shell').waitFor();
      releaseRead(); releaseRead = null;
      await page.locator('.cloud-session-gate').waitFor({ state: 'hidden' });
      await page.waitForTimeout(150);
      assert.equal(await page.locator('.coop-ready-dialog').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`${name}: selection, global ready focus, basic/targeted skill, other-player wait, reward recovery, and account switch passed`);
    } catch (error) { await shot('FAILURE'); throw error; }
    finally { releaseRead?.(); await context.close(); }
  }
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
