'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requestTrade,
  respondTrade,
  setTradeOffer,
  confirmTrade,
  closeTrade,
  getTradeState
} = require('../../src/v2/services/tradeService');
const {
  createPartyReturnPortals,
  listVisiblePartyPortals,
  usePartyPortal,
  resetPartyPortals
} = require('../../src/v2/services/partyPortalService');

test.afterEach(() => {
  closeTrade('left');
  closeTrade('right');
  resetPartyPortals();
});

test('trade requires both users to confirm after the latest offer', () => {
  const request = requestTrade(
    { userId: 'left', nickname: '왼쪽', mapId: 'field' },
    { userId: 'right', nickname: '오른쪽' }
  );
  respondTrade('right', request.id, true);
  setTradeOffer('left', { money: 100, items: [{ stackId: 'stack', quantity: 1 }] });
  assert.equal(confirmTrade('left').ready, false);
  assert.equal(confirmTrade('right').ready, true);
  assert.equal(getTradeState('left').session.partner.userId, 'right');
});

test('party return support creates private two-way portals until expiry', () => {
  const created = createPartyReturnPortals({
    casterId: 'left',
    memberIds: ['left', 'right'],
    fieldMapId: 'field',
    fieldX: 45,
    fieldFloor: 1,
    safeMapId: 'main_lobby',
    durationSeconds: 60
  });
  assert.equal(created.length, 2);
  assert.equal(listVisiblePartyPortals('outsider', 'field').length, 0);
  const fieldPortal = listVisiblePartyPortals('right', 'field')[0];
  assert.equal(usePartyPortal('right', fieldPortal.id, 'field').mapId, 'main_lobby');
  const returnPortal = listVisiblePartyPortals('left', 'main_lobby')[0];
  assert.equal(usePartyPortal('left', returnPortal.id, 'main_lobby').mapId, 'field');
});
