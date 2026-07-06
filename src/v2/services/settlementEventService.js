'use strict';

const {
  addInventoryItem,
  consumeInventoryItem,
  getItemQuantity,
  markInventoryModified
} = require('./inventoryService');

const EVENT_ID = 'settlement-support-2026';
const EVENT_START_AT = new Date('2026-07-06T00:00:00+09:00');
const EVENT_END_AT = new Date('2026-08-01T00:00:00+09:00');
const EVENT_COIN_ID = 'settlement_event_coin';
const DAILY_COIN_LIMIT = 200;
const COIN_DROP_CHANCE = 0.05;

const EVENT_SHOP_ITEMS = Object.freeze([
  Object.freeze({
    key: 'exp-coupon',
    itemId: 'event_experience_coupon_2x_15m',
    name: '경험치 2배 쿠폰 4개',
    quantity: 4,
    coinPrice: 100,
    dailyLimit: 1,
    description: '구매 후 7일 안에 사용해야 합니다.'
  }),
  Object.freeze({
    key: 'blessed-necklace',
    itemId: 'blessed_settlement_necklace',
    name: '축복받은 목걸이',
    quantity: 1,
    coinPrice: 300,
    dailyLimit: 0,
    description: '전 직업 공용 이벤트 목걸이입니다.'
  }),
  Object.freeze({
    key: 'necklace-scroll',
    itemId: 'event_blessed_necklace_scroll_60',
    name: '이벤트 목걸이 전용 주문서 60%',
    quantity: 1,
    coinPrice: 100,
    dailyLimit: 0,
    description: '축복받은 목걸이에만 사용할 수 있습니다.'
  }),
  Object.freeze({
    key: 'stat-reset',
    itemId: 'event_stat_reset_coupon',
    name: '스탯 초기화 쿠폰',
    quantity: 1,
    coinPrice: 100,
    dailyLimit: 0,
    description: '2026년 7월 31일 이후 사라집니다.'
  })
]);

function koreaDateKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function isEventActive(now = new Date()) {
  const time = new Date(now).getTime();
  return time >= EVENT_START_AT.getTime() && time < EVENT_END_AT.getTime();
}

function ensureEventState(character, now = new Date()) {
  if (!character.events || typeof character.events !== 'object') character.events = {};
  if (!character.events.settlementSupport || typeof character.events.settlementSupport !== 'object') {
    character.events.settlementSupport = {};
  }
  const state = character.events.settlementSupport;
  const dateKey = koreaDateKey(now);
  if (String(state.dailyCoinDate || '') !== dateKey) {
    state.dailyCoinDate = dateKey;
    state.dailyCoinCount = 0;
  }
  state.dailyCoinCount = Math.max(0, Math.min(DAILY_COIN_LIMIT, Number(state.dailyCoinCount) || 0));
  if (!state.purchases || typeof state.purchases !== 'object') state.purchases = {};
  if (typeof character.markModified === 'function') character.markModified('events');
  return state;
}

function getDailyPurchaseCount(state, key, now = new Date()) {
  const record = state.purchases?.[key];
  return record?.date === koreaDateKey(now) ? Math.max(0, Number(record.count) || 0) : 0;
}

function getSettlementEventView(character, now = new Date()) {
  const state = ensureEventState(character, now);
  return {
    id: EVENT_ID,
    active: isEventActive(now),
    startsAt: EVENT_START_AT.toISOString(),
    endsAt: EVENT_END_AT.toISOString(),
    coins: getItemQuantity(character, EVENT_COIN_ID),
    dailyCoins: state.dailyCoinCount,
    dailyCoinLimit: DAILY_COIN_LIMIT,
    shopItems: EVENT_SHOP_ITEMS.map((item) => ({
      ...item,
      purchasedToday: getDailyPurchaseCount(state, item.key, now),
      remainingToday: item.dailyLimit
        ? Math.max(0, item.dailyLimit - getDailyPurchaseCount(state, item.key, now))
        : null
    }))
  };
}

function rollSettlementEventCoin(character, monsterLevel, random = Math.random, now = new Date()) {
  if (!isEventActive(now)) return null;
  const playerLevel = Math.max(1, Number(character.progression?.level) || 1);
  if (Math.abs(Number(monsterLevel) - playerLevel) > 10) return null;
  const state = ensureEventState(character, now);
  if (state.dailyCoinCount >= DAILY_COIN_LIMIT || random() >= COIN_DROP_CHANCE) return null;
  addInventoryItem(character, EVENT_COIN_ID, 1);
  state.dailyCoinCount += 1;
  if (typeof character.markModified === 'function') character.markModified('events');
  return {
    kind: 'item',
    itemId: EVENT_COIN_ID,
    quantity: 1,
    icon: '🪙',
    name: '정착 지원 이벤트 코인',
    category: 'misc',
    stored: true,
    eventDrop: true
  };
}

function purchaseSettlementEventItem(character, key, now = new Date()) {
  if (!isEventActive(now)) throw new Error('정착 지원 이벤트가 종료되었습니다.');
  const item = EVENT_SHOP_ITEMS.find((entry) => entry.key === String(key || ''));
  if (!item) throw new Error('존재하지 않는 이벤트 상품입니다.');
  const state = ensureEventState(character, now);
  const purchasedToday = getDailyPurchaseCount(state, item.key, now);
  if (item.dailyLimit && purchasedToday >= item.dailyLimit) {
    throw new Error('오늘 구매 가능한 수량을 모두 구매했습니다.');
  }
  if (getItemQuantity(character, EVENT_COIN_ID) < item.coinPrice) {
    throw new Error('이벤트 코인이 부족합니다.');
  }
  addInventoryItem(character, item.itemId, item.quantity);
  consumeInventoryItem(character, EVENT_COIN_ID, item.coinPrice);
  if (item.dailyLimit) {
    state.purchases[item.key] = {
      date: koreaDateKey(now),
      count: purchasedToday + 1
    };
  }
  markInventoryModified(character);
  if (typeof character.markModified === 'function') character.markModified('events');
  return { ...item };
}

module.exports = {
  EVENT_ID,
  EVENT_START_AT,
  EVENT_END_AT,
  EVENT_COIN_ID,
  DAILY_COIN_LIMIT,
  COIN_DROP_CHANCE,
  EVENT_SHOP_ITEMS,
  isEventActive,
  ensureEventState,
  getSettlementEventView,
  rollSettlementEventCoin,
  purchaseSettlementEventItem
};
