'use strict';

const { EQUIPMENT_SCROLLS } = require('./scrollCatalog');

const LATE_SUMMER_EVENT_ID = 'late-summer-yard-2026';
const LATE_SUMMER_EVENT_START_AT = new Date('2026-08-13T14:00:00+09:00');
const LATE_SUMMER_EVENT_END_AT = new Date('2026-09-14T00:00:00+09:00');
const LATE_SUMMER_EVENT_EXPIRES_AT = '2026-09-14T00:00:00+09:00';
const WAKPPUBALL_ITEM_ID = 'late_summer_wakppuball';
const LATE_SUMMER_CHEESE_ITEM_ID = 'late_summer_cheese';
const LATE_SUMMER_SHAVED_ICE_ITEM_ID = 'late_summer_shaved_ice';

const LATE_SUMMER_EVENT_SCROLLS = Object.freeze(
  EQUIPMENT_SCROLLS
    .filter((scroll) => [10, 60].includes(Number(scroll.successRate)))
    .map((scroll) => Object.freeze({
      ...scroll,
      id: `late_summer_${scroll.id}`,
      name: `늦여름 이벤트 전용 ${scroll.name}`,
      icon: '📜',
      buyPrice: 0,
      sellPrice: 100,
      shopTags: [],
      tradeable: true,
      eventItem: true,
      eventId: LATE_SUMMER_EVENT_ID,
      eventSourceScrollId: scroll.id,
      fixedExpiresAt: LATE_SUMMER_EVENT_EXPIRES_AT,
      description: `${scroll.description} 늦여름 야르한 이벤트 종료 시 사라집니다.`
    }))
);

const LATE_SUMMER_EVENT_ITEMS = Object.freeze([
  Object.freeze({
    id: WAKPPUBALL_ITEM_ID,
    name: '왁뿌볼',
    category: 'misc',
    itemType: 'event-box',
    icon: '🏐',
    maxStack: 100,
    sellPrice: 0,
    tradeable: true,
    eventItem: true,
    eventId: LATE_SUMMER_EVENT_ID,
    fixedExpiresAt: LATE_SUMMER_EVENT_EXPIRES_AT,
    description: '늦여름 야르한 이벤트 창에서 부술 수 있는 수상한 공입니다.'
  }),
  Object.freeze({
    id: LATE_SUMMER_CHEESE_ITEM_ID,
    name: '치즈',
    category: 'consumable',
    itemType: 'potion',
    icon: '🧀',
    resource: 'hp',
    restoreAmount: 4_000,
    maxStack: 100,
    sellPrice: 1,
    tradeable: false,
    eventItem: true,
    eventId: LATE_SUMMER_EVENT_ID,
    fixedExpiresAt: LATE_SUMMER_EVENT_EXPIRES_AT,
    description: '사용 즉시 체력을 4,000 회복합니다. 교환할 수 없으며 이벤트 종료 시 사라집니다.'
  }),
  Object.freeze({
    id: LATE_SUMMER_SHAVED_ICE_ITEM_ID,
    name: '빙수',
    category: 'consumable',
    itemType: 'potion',
    icon: '🍧',
    resource: 'mp',
    restoreAmount: 2_000,
    maxStack: 100,
    sellPrice: 1,
    tradeable: false,
    eventItem: true,
    eventId: LATE_SUMMER_EVENT_ID,
    fixedExpiresAt: LATE_SUMMER_EVENT_EXPIRES_AT,
    description: '사용 즉시 정신력을 2,000 회복합니다. 교환할 수 없으며 이벤트 종료 시 사라집니다.'
  }),
  ...LATE_SUMMER_EVENT_SCROLLS
]);

module.exports = {
  LATE_SUMMER_EVENT_ID,
  LATE_SUMMER_EVENT_START_AT,
  LATE_SUMMER_EVENT_END_AT,
  LATE_SUMMER_EVENT_EXPIRES_AT,
  WAKPPUBALL_ITEM_ID,
  LATE_SUMMER_CHEESE_ITEM_ID,
  LATE_SUMMER_SHAVED_ICE_ITEM_ID,
  LATE_SUMMER_EVENT_SCROLLS,
  LATE_SUMMER_EVENT_ITEMS
};
