// Mock-only end-to-end acceptance: no production account or server writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDefaultState } from '../src/core/gameState.js';
import { createPendingPackOpening } from '../src/core/packOpeningSession.js';
import { cardById, RAID_DEFINITION } from '../src/data/cardCatalog.js';

const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
const output = process.env.UI_TEST_ARTIFACTS || join(process.cwd(), 'release', 'qa-raid-qol');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
try {
  for (const [name, viewport] of [['small-mobile', { width: 360, height: 640 }], ['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
    const context = await browser.newContext({ viewport, isMobile: name !== 'desktop', hasTouch: name !== 'desktop', reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    const account = { id: `qol-${name}`, username: 'qol_tester', nickname: '품질 확인' };
    let revision = 1, starts = 0; const finishes = [];
    let state = createDefaultState();
    const squad = ['hoi-ur', 'winter-ur', 'guma-hr', 'morae-ssr'];
    for (const id of squad) state.collection[id] = 1;
    state.selectedRaidSquad = squad;
    state.settings.raidSecretMode = true;
    state.activeIncident = { id: 'retired', expiresAt: Date.now() + 100000 };
    const packCards = Array.from({ length: 50 }, (_, index) => cardById(['winter-c', 'hoi-ssr', 'hoi-ur', 'coca-c', 'winter-r'][index % 5]));
    const baseline = structuredClone(state.collection);
    state.pendingPackOpening = createPendingPackOpening({ cards: packCards, packCount: 10, id: `saved-${name}`, highestRarity: 'ssr' });
    const raid = () => ({ id: RAID_DEFINITION.id, hp: 1000000, maxHp: 1000000, stage: 1, maxStage: 10, remainingEntries: 5, maxDailyEntries: 5, entriesToday: 0, weekKey: 'test-week', dayKey: 'test-day', rewardKey: 'test-week:boss', earnedRewards: { coins: 0, packs: 0, bonuses: [] } });
    const snapshot = () => ({ leaseId: 'test-lease', generation: 1, revision, initialized: true, state, expiresAt: Date.now() + 60000 });
    await context.route('**/api/tcg/**', async route => {
      const path = new URL(route.request().url()).pathname; let payload;
      if (path === '/api/tcg/auth/me') payload = { account };
      else if (path === '/api/tcg/play-session/open') payload = snapshot();
      else if (path === '/api/tcg/game-state') { state = route.request().postDataJSON().state; payload = { revision: ++revision }; }
      else if (path.includes('/play-session/')) payload = { revision, expiresAt: Date.now() + 60000 };
      else if (path.endsWith('/personal/start')) {
        starts += 1; const body = route.request().postDataJSON();
        assert.equal(body.squad.length, 4); assert.ok(body.leaseId);
        payload = { state: raid(), battle: { sessionId: `battle-${starts}`, squad: body.squad, stage: 1, bossId: RAID_DEFINITION.id, bossName: '시험 보스', bossMaxHp: 1000000, bossHp: 1000000, stageConfig: { skills: [], basicAttackDamage: 1 }, seed: 123, startedAt: Date.now() } };
      } else if (path.endsWith('/personal/finish')) { finishes.push(route.request().postDataJSON()); payload = { state: raid(), result: { cleared: false, reward: { extraEntries: 0 } } }; }
      else if (path.includes('/personal/')) payload = { state: raid(), ranking: { entries: [] } };
      else if (path === '/api/tcg/mail') payload = { mailbox: [] };
      else if (path.endsWith('/cooperative/state')) payload = { cooperative: { phase: 'idle', serverNow: Date.now(), entriesRemaining: 2 } };
      else throw new Error(`Unmocked API ${path}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
    await context.addInitScript(({ account }) => localStorage.setItem('hoi-card-desk-auth-v1', JSON.stringify({ token: 'qol-token', account })), { account });
    const click = selector => page.locator(selector).click();
    const saved = () => page.evaluate(id => JSON.parse(localStorage.getItem(`hoi-card-desk-state-v2:${id}`)), account.id);
    const capture = label => page.screenshot({ path: join(output, `${name}-${label}.png`), animations: 'disabled', fullPage: true });
    const fixedPackControls = async () => {
      const metrics = await page.locator('.pack-focus-modal').evaluate(node => ({ scroll: node.scrollHeight, height: node.clientHeight, bottom: node.getBoundingClientRect().bottom, viewport: innerHeight, width: node.scrollWidth, clientWidth: node.clientWidth }));
      assert.ok(metrics.scroll <= metrics.height + 1, `${name} pack vertical scroll: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.width <= metrics.clientWidth + 1, `${name} pack horizontal overflow`);
      for (const node of await page.locator('.pack-focus-footer button, .pack-focus-heading button, .pack-focus-status button').all()) {
        const box = await node.boundingBox(); assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height + 1, `${name} controls stay in viewport: ${JSON.stringify(box)}`);
      }
      assert.equal(await page.locator('.pack-focus-stage .result-card').count(), 1);
    };
    try {
      await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1428/');
      await page.locator('.cloud-session-gate').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-action="open-incident"], .lobby-incident').count(), 0);
      await click('[data-action="resume-pack-opening"]');
      await fixedPackControls(); await capture('pack-hidden');
      await click('.pack-focus-primary [data-action="reveal-pack-card"]');
      await fixedPackControls(); await capture('pack-revealed');
      const pending = (await saved()).pendingPackOpening;
      assert.deepEqual(pending.revealedIndices, [1]);
      await click('.pack-focus-primary [data-action="close-modal"]');
      await click('[data-action="resume-pack-opening"]');
      assert.equal(await page.locator('.pack-focus-stage .result-card').getAttribute('data-pack-card-index'), '2');
      await click('[data-action="reveal-all-pack-cards"]');
      await fixedPackControls(); await capture('pack-all');
      const acquired = await saved(); assert.equal(acquired.pendingPackOpening, null);
      for (const id of new Set(packCards.map(card => card.id))) assert.equal(acquired.collection[id], (baseline[id] || 0) + packCards.filter(card => card.id === id).length);
      await click('.pack-focus-primary [data-action="close-modal"]');
      await click('.primary-nav [data-view="raid"]'); await click('[data-action="enter-raid-battle"]');
      await page.locator('.raid-battle-screen').waitFor();
      assert.equal(await page.locator('.raid-battle-screen img[src*="/cards/"]').count(), 0, 'saved secret mode applied before first battle paint');
      assert.equal(await page.locator('[data-action="toggle-raid-auto"]').getAttribute('aria-pressed'), 'false');
      await click('[data-action="toggle-raid-secret"]');
      assert.equal(await page.locator('.raid-unit-card > img').count(), 4);
      await click('[data-action="toggle-raid-secret"]');
      await capture('personal-secret');
      await click('[data-action="begin-raid-battle"]');
      await page.locator('[data-raid-galaxy-choice]').waitFor();
      await page.selectOption('[data-raid-galaxy-choice]', 'heal');
      await click('[data-action="toggle-raid-auto"]');
      await page.locator('.raid-battle-message').filter({ hasText: '[자동]' }).waitFor();
      assert.equal(await page.locator('.raid-skill-cut-in img').count(), 0);
      await click('[data-action="toggle-raid-auto"]');
      await page.waitForTimeout(3400);
      assert.equal(await page.locator('[data-action="toggle-raid-auto"]').getAttribute('aria-pressed'), 'false');
      await capture('personal-auto-off');
      await click('[data-action="leave-raid-battle"]');
      await page.locator('[data-action="enter-raid-battle"]').waitFor();
      assert.equal(finishes.length, 1); assert.ok(finishes[0].battleLog.some(log => log.type === 'skill'));
      await click('[data-action="enter-raid-battle"]');
      assert.equal(await page.locator('[data-action="toggle-raid-auto"]').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('.raid-unit-card > img').count(), 0);
      await click('[data-action="leave-raid-battle"]');
      await page.reload(); await page.locator('.cloud-session-gate').waitFor({ state: 'hidden' });
      assert.equal((await saved()).settings.raidSecretMode, true);
      for (const id of new Set(packCards.map(card => card.id))) assert.equal((await saved()).collection[id], acquired.collection[id]);
      assert.equal((await saved()).activeIncident, undefined);
      assert.deepEqual(errors, []);
      console.log(`${name}: no-scroll 50-card reveal/resume/durability, incident retirement, personal auto ON/OFF, secret reload/no-image leakage passed`);
    } catch (error) { await capture('FAILURE'); throw error; }
    finally { await context.close(); }
  }
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
