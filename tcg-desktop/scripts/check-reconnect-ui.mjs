// Local mock only: no production accounts, credentials, or API mutations.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDefaultState } from '../src/core/gameState.js';
import { createPendingPackOpening } from '../src/core/packOpeningSession.js';
import { cardById, RAID_DEFINITION } from '../src/data/cardCatalog.js';
import { navigationSnapshotKey } from '../src/core/navigationSnapshot.js';
import { cloudSaveOutboxKey } from '../src/core/cloudPlaySession.js';

const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
const output = process.env.UI_TEST_ARTIFACTS || join(process.cwd(), 'release', 'qa-reconnect');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
try {
  for (const [name, viewport] of [['small-mobile', { width: 360, height: 640 }], ['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let account = { id: `reconnect-${name}`, username: 'tester', nickname: '연결 시험' };
    const firstAccount = { ...account };
    let state = createDefaultState(); state.profile.displayName = account.nickname;
    state.collection['winter-ur'] = 1;
    const cards = ['winter-c', 'hoi-ssr', 'winter-ur', 'hoi-ssr', 'winter-r'].map(cardById);
    state.pendingPackOpening = createPendingPackOpening({ cards, packCount: 1, id: 'saved-pack' });
    let authMode = 'down'; let openMode = 'ok'; let authCalls = 0; let openCalls = 0; let saves = 0; let revision = 1; let authDelay = 0;
    const raid = () => ({ id: RAID_DEFINITION.id, stage: 1, maxStage: 10, hp: 100000, maxHp: 100000, activeSession: null, entriesToday: 0, remainingEntries: 5, earnedRewards: { coins: 0, packs: 0, bonuses: [] } });
    const snapshot = () => ({ leaseId: 'mock-lease', generation: 1, revision, initialized: true, state, expiresAt: Date.now() + 60000 });
    await context.route('**/api/tcg/**', async route => {
      const path = new URL(route.request().url()).pathname; let status = 200; let payload;
      if (path.endsWith('/auth/me')) {
        authCalls++; if (authDelay) await new Promise(resolve => setTimeout(resolve, authDelay));
        status = authMode === 'down' ? 503 : authMode === 'expired' ? 401 : 200;
        payload = status === 200 ? { account } : { code: status === 503 ? 'DATABASE_UNAVAILABLE' : 'AUTH_EXPIRED', message: '시험 연결 대기' };
      } else if (path.endsWith('/play-session/open')) {
        openCalls++; status = openMode === 'moved' ? 409 : 200;
        payload = status === 200 ? snapshot() : { code: 'PLAYING_ELSEWHERE', activePlatform: 'android', generation: 2 };
      } else if (path.endsWith('/play-session/takeover')) { openMode = 'ok'; payload = snapshot(); }
      else if (path.endsWith('/game-state')) { saves++; state = route.request().postDataJSON().state; payload = { revision: ++revision }; }
      else if (path.includes('/play-session/')) payload = { revision, expiresAt: Date.now() + 60000 };
      else if (path.includes('/personal/')) payload = { state: raid(), ranking: { entries: [] } };
      else if (path.endsWith('/mail')) payload = { mailbox: [] };
      else if (path.endsWith('/cooperative/state')) payload = { cooperative: { phase: 'idle', serverNow: Date.now(), entriesRemaining: 2 } };
      else throw new Error(`Unmocked API ${path}`);
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) }).catch(() => {});
    });
    await context.addInitScript(({ account, state, navigationKey }) => {
      if (localStorage.getItem('reconnect-test-seeded')) return;
      localStorage.setItem('reconnect-test-seeded', 'yes');
      localStorage.setItem('hoi-card-desk-auth-v1', JSON.stringify({ token: 'mock-token', account }));
      localStorage.setItem(`hoi-card-desk-state-v2:${account.id}`, JSON.stringify(state));
      localStorage.setItem(navigationKey, JSON.stringify({ view: 'collection', rarityFilter: 'ur', modal: { type: 'card', cardId: 'winter-ur' } }));
    }, { account, state, navigationKey: navigationSnapshotKey(account.id) });
    const capture = label => page.screenshot({ path: join(output, `${name}-${label}.png`), fullPage: true, animations: 'disabled' });
    const connected = () => page.waitForFunction(() => document.querySelector('.app-shell:not([inert])') && !document.querySelector('#reconnect-overlay'));
    const local = () => page.evaluate(id => JSON.parse(localStorage.getItem(`hoi-card-desk-state-v2:${id}`)), account.id);
    try {
      await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1428/');
      await page.locator('#reconnect-overlay').waitFor();
      assert.equal(await page.locator('.view-host').getAttribute('data-view'), 'collection');
      assert.equal(await page.locator('.app-shell').getAttribute('inert'), '');
      assert.ok(await page.locator('.modal-sheet').count()); assert.equal(openCalls, 0);
      assert.equal((await local()).collection['winter-ur'], 1);
      await capture('cached-card-loading');
      const before = saves;
      await page.evaluate(() => document.querySelector('[data-action="open-pack"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      assert.equal(saves, before);
      authMode = 'ok'; await connected();
      assert.equal(await page.locator('.view-host').getAttribute('data-view'), 'collection');
      await page.locator('.modal-close').click();
      await page.locator('[data-action="filter-rarity"][data-rarity="all"]').click();
      await page.locator('.view-host').evaluate(node => { node.scrollTop = 240; node.dispatchEvent(new Event('scroll')); });
      await page.waitForTimeout(300);
      const expectedScroll = await page.locator('.view-host').evaluate(node => node.scrollTop);
      assert.ok(expectedScroll > 0, 'fixture must really scroll');
      authMode = 'down'; await page.reload(); await page.locator('#reconnect-overlay').waitFor();
      await page.waitForFunction(top => Math.abs(document.querySelector('.view-host').scrollTop - top) < 2, expectedScroll);
      authMode = 'ok'; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await connected();
      assert.ok(Math.abs(await page.locator('.view-host').evaluate(node => node.scrollTop) - expectedScroll) < 2);
      await page.locator('.primary-nav [data-view="dashboard"]').click();
      await page.locator('[data-action="resume-pack-opening"]').click();
      await page.locator('.pack-focus-progress [data-card-index="3"]').click();
      const pendingBefore = (await local()).pendingPackOpening;
      authMode = 'down'; await page.reload(); await page.locator('#reconnect-overlay').waitFor();
      assert.equal(await page.locator('.pack-focus-stage .result-card').getAttribute('data-pack-card-index'), '3');
      await page.evaluate(() => document.querySelector('[data-action="reveal-pack-card"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      assert.deepEqual((await local()).pendingPackOpening, pendingBefore);
      await capture('cached-pack-loading');
      if (name === 'desktop') {
        await page.locator('#reconnect-overlay [data-action="cloud-retry"]').waitFor({ timeout: 20000 });
        const bounds = await page.locator('#reconnect-overlay [data-action="cloud-retry"]').boundingBox();
        assert.ok(bounds.y + bounds.height <= viewport.height);
        await capture('retry-fallback');
      }
      authMode = 'ok'; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await connected();
      assert.equal(await page.locator('.pack-focus-stage .result-card').getAttribute('data-pack-card-index'), '3');
      const callsBefore = authCalls; authDelay = 900;
      await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pageshow')); for (let i = 0; i < 4; i++) window.dispatchEvent(new Event('online')); });
      await page.locator('#reconnect-overlay').waitFor(); await connected(); authDelay = 0;
      assert.equal(authCalls, callsBefore + 1, 'foreground/online share one request');
      assert.deepEqual((await local()).pendingPackOpening, pendingBefore);
      await page.locator('[data-action="reveal-all-pack-cards"]').click();
      const ownedAfter = (await local()).collection;
      assert.equal((await local()).pendingPackOpening, null);
      await page.reload(); await connected(); assert.deepEqual((await local()).collection, ownedAfter);
      openMode = 'moved'; await page.reload(); await page.locator('[data-action="cloud-takeover"]').waitFor();
      const blockedCalls = authCalls;
      await page.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pageshow')); });
      await page.waitForTimeout(250); assert.equal(authCalls, blockedCalls, 'no automatic takeover');
      await page.locator('[data-action="cloud-takeover"]').click(); await connected();
      const pendingLocal = structuredClone(state); pendingLocal.wallet.coins += 11;
      await page.evaluate(({ accountId, outboxKey, pendingLocal }) => {
        localStorage.setItem(`hoi-card-desk-state-v2:${accountId}`, JSON.stringify(pendingLocal));
        localStorage.setItem(outboxKey, JSON.stringify({ version: 1, entryId: 'unsent-acquisition', baseRevision: 0, state: pendingLocal }));
      }, { accountId: account.id, outboxKey: cloudSaveOutboxKey(account.id), pendingLocal });
      await page.reload(); await page.locator('[data-action="cloud-conflict-local"]').waitFor();
      assert.equal(await page.locator('#reconnect-overlay').count(), 0);
      assert.ok(await page.evaluate(key => localStorage.getItem(key), cloudSaveOutboxKey(account.id)));
      await page.locator('[data-action="cloud-conflict-local"]').click(); await connected();
      assert.equal((await local()).wallet.coins, pendingLocal.wallet.coins);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), cloudSaveOutboxKey(account.id)), null);
      authMode = 'expired'; await page.reload(); await page.locator('[data-form="login"]').waitFor();
      assert.equal(await page.locator('#reconnect-overlay').count(), 0);
      assert.deepEqual((await local()).collection, ownedAfter);
      account = { id: `other-${name}`, username: 'other', nickname: '다른 계정' }; state = createDefaultState(); authMode = 'ok';
      await page.evaluate(account => localStorage.setItem('hoi-card-desk-auth-v1', JSON.stringify({ token: 'other-token', account })), account);
      await page.reload(); await connected();
      assert.equal(await page.locator('.view-host').getAttribute('data-view'), 'dashboard');
      assert.equal(await page.locator('.pack-focus-modal').count(), 0);
      assert.ok(await page.evaluate(id => localStorage.getItem(id), navigationSnapshotKey(firstAccount.id)));
      assert.deepEqual(errors, []); await capture('other-account');
      console.log(`${name}: cached card/pack, inert input, 503 retry, foreground single-flight, no duplicate acquisition, takeover gate, token expiry and account isolation passed`);
    } catch (error) { await capture('FAILURE'); throw error; }
    finally { await context.close(); }
  }
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
