// Run against a local Vite server configured with VITE_TCG_API_BASE=https://cards.test.
// Optional: PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE, UI_TEST_URL, UI_TEST_ARTIFACTS.
// All API traffic is intercepted; this check never uses a production account.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDefaultState } from '../src/core/gameState.js';
import { createEquipment } from '../src/core/equipment.js';
import { startExpedition } from '../src/core/expeditionEngine.js';
import { saveDeckPreset } from '../src/core/deckPresets.js';
import { ALL_CARDS, EXPEDITIONS, RAID_DEFINITION } from '../src/data/cardCatalog.js';

const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
const artifactDir = process.env.UI_TEST_ARTIFACTS || await mkdtemp(join(tmpdir(), 'hoi-loadout-ui-'));
await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const squad = ['hoi-ssr', 'winter-ur', 'mango-c', 'simsim-c'];
const account = { id: 'loadout-ui-test', username: 'loadout-test', nickname: '편성 테스트' };
const stateKey = `hoi-card-desk-state-v2:${account.id}`;

try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }], ['small-mobile', { width: 320, height: 740 }]]) {
    const mobile = name !== 'desktop';
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let remoteState = createDefaultState();
    remoteState.profile.displayName = account.nickname;
    Object.assign(remoteState.collection, Object.fromEntries(squad.map((id) => [id, 1])));
    remoteState.collection['winter-c'] = 0;
    remoteState.cardEnhancements = { 'hoi-ssr': { 5: 1 } };
    remoteState.selectedExpeditionSquad = ['hoi-ssr'];
    const weapon = createEquipment({ type: 'weapon', rarity: 'ssr', random: () => 0.5, idFactory: () => 'test-weapon' });
    const armor = createEquipment({ type: 'armor', rarity: 'r', random: () => 0.5, idFactory: () => 'test-armor' });
    remoteState.equipmentInventory = [weapon, armor];
    remoteState.relicInventory = { 'luxury-bag': 1 };
    remoteState.deckPresets = saveDeckPreset([], 4, { cardIds: ['winter-c'], name: '기존 저장 덱', updatedAt: 123 });
    const completedMission = EXPEDITIONS.find((mission) => mission.id === 'lobby-lost-found');
    assert.ok(completedMission, 'repeat-expedition fixture mission exists');
    remoteState.expedition = startExpedition({
      mission: completedMission,
      cardIds: squad,
      collection: remoteState.collection,
      cardEnhancements: remoteState.cardEnhancements,
      cardProgression: remoteState.cardProgression,
      equipment: weapon,
      relicId: 'luxury-bag',
      relicInventory: remoteState.relicInventory,
      catalog: ALL_CARDS,
      now: Date.now() - completedMission.durationMs - 1_000,
    });
    let revision = 1;
    const savedStates = [];
    await context.route('**/api/tcg/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let payload;
      if (path === '/api/tcg/auth/me') payload = { account };
      else if (path === '/api/tcg/play-session/open') payload = { leaseId: 'test-lease', generation: 1, revision, initialized: true, state: remoteState };
      else if (path === '/api/tcg/game-state') {
        remoteState = route.request().postDataJSON().state;
        savedStates.push(remoteState);
        payload = { revision: ++revision };
      } else if (path.includes('/play-session/')) payload = { revision, expiresAt: Date.now() + 45_000 };
      else if (path.includes('/raids/personal/')) payload = { state: { id: RAID_DEFINITION.id, hp: 100000, maxHp: 100000, stage: 1, remainingEntries: 5 }, ranking: { entries: [] } };
      else if (path === '/api/tcg/mail') payload = { mailbox: [] };
      else throw new Error(`Unmocked API request: ${path}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
    await context.addInitScript(({ account }) => {
      if (!localStorage.getItem('hoi-card-desk-auth-v1')) localStorage.setItem('hoi-card-desk-auth-v1', JSON.stringify({ token: 'test-token', account }));
    }, { account });
    const readState = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), stateKey);
    const click = (selector) => page.locator(selector).click();
    const clickImmediately = (selector) => page.locator(selector).evaluate((element) => element.click());
    const screenshot = async (label) => {
      await page.locator('.app-notice').waitFor({ state: 'hidden', timeout: 10000 });
      return page.screenshot({ path: join(artifactDir, `${name}-${label}.png`), fullPage: true, animations: 'disabled' });
    };
    const noHorizontalOverflow = async () => {
      const overflowing = await page.locator('.view-host').evaluate((element) => element.scrollWidth > element.clientWidth + 1);
      assert.equal(overflowing, false, `${name}: main view must not scroll horizontally`);
    };
    const visibleEmblemsLoadedAndContained = async (label) => {
      await page.waitForFunction(() => {
        const visible = [...document.querySelectorAll('.card-art-emblems > img')]
          .filter((image) => image.getBoundingClientRect().width > 0 && image.getBoundingClientRect().height > 0);
        return visible.length > 0 && visible.every((image) => image.complete && image.naturalWidth > 0);
      });
      const failures = await page.locator('.card-emblem-host').evaluateAll((hosts) => hosts.flatMap((host) => {
        const hostRect = host.getBoundingClientRect();
        if (!hostRect.width || !hostRect.height) return [];
        return [...host.querySelectorAll('.card-art-emblems > img')].flatMap((image) => {
          const rect = image.getBoundingClientRect();
          const contained = rect.left >= hostRect.left - 1
            && rect.top >= hostRect.top - 1
            && rect.right <= hostRect.right + 1
            && rect.bottom <= hostRect.bottom + 1;
          return contained ? [] : [`${image.className}: ${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`];
        });
      }));
      assert.deepEqual(failures, [], `${name}/${label}: visible card emblems stay inside their artwork`);
    };
    const waitState = (predicate, extra = {}) => page.waitForFunction(({ stateKey, source, extra }) => {
      const state = JSON.parse(localStorage.getItem(stateKey));
      return state && Function('state', 'extra', `return (${source})(state, extra)`)(state, extra);
    }, { stateKey, source: predicate.toString(), extra });
    const assertRepeatedExpedition = async (label) => {
      const repeated = await readState();
      assert.deepEqual(repeated.expedition?.squad, squad, `${name}/${label}: repeat keeps the exact card order`);
      assert.equal(repeated.expedition?.equipment?.id, 'test-weapon', `${name}/${label}: repeat keeps equipment`);
      assert.equal(repeated.expedition?.relicId, 'luxury-bag', `${name}/${label}: repeat keeps the relic`);
      assert.equal(repeated.expedition?.enhancementStages?.['hoi-ssr'], 5, `${name}/${label}: repeat keeps the dispatched enhancement`);
    };

    await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1426/');
    await page.locator('.cloud-session-gate').waitFor({ state: 'hidden' });
    const resultRepeat = page.locator('.compact-modal [data-action="repeat-expedition"]');
    await resultRepeat.waitFor();
    assert.match(await page.locator('.compact-modal').textContent(), /로비 분실물 순찰/);
    let completedState = await readState();
    assert.equal(completedState.expedition, null);
    assert.deepEqual(completedState.lastCompletedExpedition?.squad, squad);
    assert.equal(completedState.lastCompletedExpedition?.equipmentCardId, 'test-weapon');
    assert.equal(completedState.lastCompletedExpedition?.artifactCardId, 'luxury-bag');
    await resultRepeat.click();
    await waitState((state) => state.expedition?.missionId === 'lobby-lost-found');
    await assertRepeatedExpedition('result modal repeat');
    await clickImmediately('[data-action="cancel-expedition"]');
    await waitState((state) => !state.expedition);
    const adventureRepeat = page.locator('.adventure-repeat [data-action="repeat-expedition"]');
    await adventureRepeat.waitFor();
    await adventureRepeat.click();
    await waitState((state) => state.expedition?.missionId === 'lobby-lost-found');
    await assertRepeatedExpedition('adventure page repeat');
    await clickImmediately('[data-action="cancel-expedition"]');
    await waitState((state) => !state.expedition);
    await click('.primary-nav [data-view="dashboard"]');
    await page.locator('[data-action="edit-deck-preset"][data-slot="0"]').waitFor();
    await screenshot('lobby');
    await noHorizontalOverflow();
    await page.locator('.lobby-hero__card .card-enhancement-emblem[data-enhancement-stage="5"]').waitFor();
    await visibleEmblemsLoadedAndContained('lobby');
    if (mobile) {
      for (const label of await page.locator('.primary-nav .nav-button > span:not(.nav-alert):not(.nav-count)').all()) assert.equal(await label.isVisible(), true);
      await click('.top-actions .icon-button[data-action="open-settings"]');
      assert.equal(await page.locator('.settings-modal [data-action="check-update"]').isVisible(), true);
      assert.equal(await page.locator('.settings-modal [data-action="open-donation"]').isVisible(), true);
      await click('.settings-modal .modal-close');
    }
    await click('.primary-nav [data-view="collection"]');
    await page.locator('.collection-card [data-card-id="hoi-ssr"] .card-enhancement-emblem[data-enhancement-stage="5"]').waitFor();
    await page.locator('.collection-card [data-card-id="winter-ur"] .card-enhancement-emblem[data-enhancement-stage="0"]').waitFor();
    assert.equal(
      await page.locator('.collection-card [data-card-id="hoi-ssr"] .card-role-emblem').getAttribute('alt'),
      '지원 역할',
    );
    await visibleEmblemsLoadedAndContained('collection');
    await click('.primary-nav [data-view="dashboard"]');
    // Editing equipment must not erase a temporarily unowned saved card/name.
    await click('[data-action="edit-deck-preset"][data-slot="4"]');
    assert.match(await page.locator('.preset-member-remove').textContent(), /미보유/);
    await click('[data-context="preset"][data-panel="equipment"][role="tab"]');
    await click('[data-context="preset"][data-equipment-id="test-armor"]');
    await click('[data-action="save-deck-preset"]');
    assert.deepEqual((await readState()).deckPresets[4].cardIds, ['winter-c']);
    assert.equal((await readState()).deckPresets[4].name, '기존 저장 덱');
    await click('[data-action="edit-deck-preset"][data-slot="4"]');
    await click('[data-action="remove-preset-card"][data-card-id="winter-c"]');
    assert.equal(await page.locator('[data-action="save-deck-preset"]').isDisabled(), true);
    await click('.deck-preset-editor-modal .modal-actions [data-action="close-modal"]');
    assert.deepEqual((await readState()).deckPresets[4].cardIds, ['winter-c']);
    await click('[data-action="edit-deck-preset"][data-slot="0"]');
    await click('[data-context="preset"][data-panel="equipment"][role="tab"]');
    assert.equal(await page.locator('.deck-preset-editor-modal .squad-picker').count(), 0);
    await click('[data-context="preset"][data-equipment-id="test-weapon"]');
    const presetRelic = page.locator('[data-action="select-relic"][data-context="preset"][data-relic-id="luxury-bag"]');
    await presetRelic.waitFor();
    assert.equal(await presetRelic.isEnabled(), true);
    await page.waitForFunction(() => {
      const image = document.querySelector('.deck-preset-editor-modal .relic-card__art img');
      return image?.complete && image.naturalWidth > 0;
    });
    await presetRelic.click();
    assert.equal(await presetRelic.getAttribute('aria-pressed'), 'true');
    await click('[data-context="preset"][data-panel="cards"][role="tab"]');
    assert.equal(await page.locator('.deck-preset-editor-modal .equipment-picker').count(), 0);
    for (const id of squad) await click(`[data-action="toggle-squad"][data-context="preset"][data-card-id="${id}"]`);
    await page.locator('.deck-preset-editor-modal').evaluate((element) => { element.scrollTop = 0; });
    await screenshot('preset-editor');
    await visibleEmblemsLoadedAndContained('preset editor');
    assert.equal(await page.locator('.deck-preset-editor-modal').isVisible(), true);
    await click('[data-action="save-deck-preset"]');
    await waitState((state) => state.deckPresets[0]?.cardIds.length === 4);
    assert.deepEqual((await readState()).deckPresets[0].cardIds, squad);
    assert.equal((await readState()).deckPresets[0].equipmentCardId, 'test-weapon');
    assert.equal((await readState()).deckPresets[0].artifactCardId, 'luxury-bag');
    assert.equal((await readState()).deckPresets[4].name, '기존 저장 덱');
    // Cancelling an edit preserves both the saved preset and current decks.
    await click('[data-action="edit-deck-preset"][data-slot="0"]');
    await click('[data-action="toggle-squad"][data-context="preset"][data-card-id="hoi-ssr"]');
    await click('.deck-preset-editor-modal .modal-actions [data-action="close-modal"]');
    assert.deepEqual((await readState()).deckPresets[0].cardIds, squad);

    await click('.primary-nav [data-view="adventure"]');
    await screenshot('adventure');
    await noHorizontalOverflow();
    await visibleEmblemsLoadedAndContained('adventure');
    if (mobile) {
      assert.equal(await page.locator('.mission-list').isVisible(), false);
      const bounds = await page.locator('[data-action="start-expedition"]').boundingBox();
      assert.ok(bounds.y > 0 && bounds.y + bounds.height < viewport.height - 60, 'Departure button stays above bottom navigation');
    }
    assert.equal(await page.locator('.mission-row').count(), 18);
    for (const row of await page.locator('.mission-row').all()) assert.match(await row.textContent(), /장비 드랍 [\d.]+%/);
    await click('[data-action="load-deck-preset"][data-context="adventure"][data-slot="0"]');
    assert.deepEqual((await readState()).selectedExpeditionSquad, squad);
    assert.equal((await readState()).selectedExpeditionEquipmentId, 'test-weapon');
    assert.equal((await readState()).selectedExpeditionArtifactId, 'luxury-bag');
    await click('[data-context="adventure"][data-panel="equipment"][role="tab"]');
    assert.equal(await page.locator('.assignment-sheet .squad-picker').count(), 0);
    assert.equal(await page.locator('[data-context="adventure"][data-equipment-id="test-weapon"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-action="select-relic"][data-context="adventure"][data-relic-id="luxury-bag"]').getAttribute('aria-pressed'), 'true');
    await screenshot('equipment');
    await noHorizontalOverflow();
    await visibleEmblemsLoadedAndContained('equipment');
    await page.locator('.assignment-sheet .relic-card').scrollIntoViewIfNeeded();
    await screenshot('relic');
    await noHorizontalOverflow();
    await click('[data-context="adventure"][data-equipment-id=""]');
    assert.equal((await readState()).selectedExpeditionEquipmentId, '');
    await click('[data-action="load-deck-preset"][data-context="adventure"][data-slot="0"]');
    await click('[data-action="copy-deck-to-preset"][data-context="adventure"]');
    await click('[data-action="select-preset-save-slot"][data-slot="1"]');
    await click('[data-action="save-deck-preset"]');
    assert.deepEqual((await readState()).deckPresets[1].cardIds, squad);
    assert.equal((await readState()).deckPresets[1].artifactCardId, 'luxury-bag');
    await click('.primary-nav [data-view="raid"]');
    await click('[data-action="load-deck-preset"][data-context="raid"][data-slot="0"]');
    assert.deepEqual((await readState()).selectedRaidSquad, squad);
    assert.equal((await readState()).selectedRaidEquipmentId, 'test-weapon');
    assert.equal((await readState()).selectedRaidArtifactId, 'luxury-bag');
    await screenshot('raid');
    await noHorizontalOverflow();
    await visibleEmblemsLoadedAndContained('raid');

    await click('.primary-nav [data-view="adventure"]');
    if (mobile) await click('[data-action="toggle-mission-list"]');
    await click('[data-action="select-mission"][data-mission-id="lobby-lost-found"]');
    await click('[data-context="adventure"][data-panel="cards"][role="tab"]');
    for (const id of squad.slice(1)) await click(`.squad-picker [data-action="toggle-squad"][data-context="adventure"][data-card-id="${id}"]`);
    const start = page.locator('[data-action="start-expedition"]');
    assert.equal(await start.isDisabled(), true);
    assert.match(await start.textContent(), /카드 1장 추가 필요/);
    assert.match(await page.locator('.requirement-warning').textContent(), /현재 1장/);
    await start.scrollIntoViewIfNeeded();
    await screenshot('eligibility');
    await visibleEmblemsLoadedAndContained('eligibility');
    await click('.squad-picker [data-action="toggle-squad"][data-context="adventure"][data-card-id="simsim-c"]');
    assert.equal(await start.isEnabled(), true);
    if (mobile) await click('[data-action="toggle-mission-list"]');
    await start.click();
    await waitState((state) => state.expedition?.missionId === 'lobby-lost-found');
    assert.equal((await readState()).expedition.relicId, 'luxury-bag');
    if (mobile) assert.equal(await page.locator('.mission-list').isVisible(), false);
    await click('.primary-nav [data-view="raid"]');
    await click('[data-action="load-deck-preset"][data-context="raid"][data-slot="0"]');
    assert.deepEqual((await readState()).selectedRaidSquad, ['winter-ur', 'mango-c']);
    assert.deepEqual((await readState()).deckPresets[0].cardIds, squad);
    const presetWasSaved = () => savedStates.some((state) => state.deckPresets[0]?.cardIds.length === 4
      && state.deckPresets[0]?.equipmentCardId === 'test-weapon'
      && state.deckPresets[0]?.artifactCardId === 'luxury-bag');
    if (!presetWasSaved()) await page.waitForResponse((response) => response.url().endsWith('/api/tcg/game-state'), { timeout: 10000 });
    assert.ok(presetWasSaved(), 'Cloud outbox sent the shared preset');
    assert.deepEqual(errors, []);
    console.log(`${name}: shared preset/relic load, completion repeat, emblems, drop rates, eligibility, and expedition locks passed`);
    await context.close();
  }
  console.log(`Screenshots: ${artifactDir}`);
} finally {
  await browser.close();
}
