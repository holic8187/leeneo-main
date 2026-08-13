'use strict';

const { getItemDefinition } = require('../items/itemCatalog');
const { rollEquipmentInstanceData } = require('../items/equipmentCatalog');
const {
  addInventoryItem,
  assertInventorySpace,
  consumeInventoryItem,
  getItemQuantity
} = require('./inventoryService');
const {
  ensureDailyActionPoints,
  spendActionPoints,
  serializeActionPoints
} = require('./actionPointService');

const SIDE_JOB_SUCCESS_RATE = 0.8;
const SIDE_JOB_ACTION_POINT_COST = 4;
const SIDE_JOB_MONEY_COST = 40_000_000;

const COMMON_MATERIALS = Object.freeze([
  Object.freeze({ itemId: 'queen_doll_fragment', quantity: 30 }),
  Object.freeze({ itemId: 'gammam_broken_potato_leg', quantity: 10 }),
  Object.freeze({ itemId: 'kim_manager_hair', quantity: 10 })
]);

const SIDE_JOB_RECIPES = Object.freeze([
  ['crafted_celine_claw', 'monster_loot_research_chimera', 'monster_loot_server_wisp'],
  ['crafted_mond_parental_sword', 'monster_loot_peach_gate_sentry', 'monster_loot_warehouse_boar'],
  ['crafted_sherlock_mond_sword', 'monster_loot_research_chimera', 'monster_loot_prototype_golem'],
  ['crafted_strawberry_latte_bow', 'monster_loot_peach_gate_sentry', 'monster_loot_quality_spider'],
  ['crafted_coca_cola_dagger', 'monster_loot_research_chimera', 'monster_loot_facility_drone'],
  ['crafted_gyeo_growth_spear', 'monster_loot_peach_gate_sentry', 'monster_loot_conveyor_crab'],
  ['crafted_meongf_parking_staff', 'monster_loot_research_chimera', 'monster_loot_server_wisp'],
  ['crafted_sand_lottery_wand', 'monster_loot_peach_gate_sentry', 'monster_loot_prototype_golem'],
  ['crafted_coca_rotation_hammer', 'monster_loot_research_chimera', 'monster_loot_warehouse_boar'],
  ['crafted_simsimi_dating_axe', 'monster_loot_peach_gate_sentry', 'monster_loot_facility_drone']
].map(([weaponId, highLevelMaterialId, lowLevelMaterialId]) => Object.freeze({
  weaponId,
  materials: Object.freeze([
    ...COMMON_MATERIALS,
    Object.freeze({ itemId: highLevelMaterialId, quantity: 400 }),
    Object.freeze({ itemId: lowLevelMaterialId, quantity: 800 })
  ])
})));

function getRecipe(weaponId) {
  return SIDE_JOB_RECIPES.find((recipe) => recipe.weaponId === String(weaponId || '')) || null;
}

function serializeRecipe(character, recipe) {
  const weapon = getItemDefinition(recipe.weaponId);
  const materials = recipe.materials.map((requirement) => {
    const item = getItemDefinition(requirement.itemId);
    const owned = getItemQuantity(character, requirement.itemId);
    return {
      itemId: requirement.itemId,
      name: item?.name || requirement.itemId,
      icon: item?.icon || '📦',
      quantity: requirement.quantity,
      owned,
      enough: owned >= requirement.quantity
    };
  });
  const actionPoints = serializeActionPoints(character);
  return {
    weapon: weapon ? { ...weapon, stats: { ...(weapon.stats || {}) } } : null,
    moneyCost: SIDE_JOB_MONEY_COST,
    successRatePercent: SIDE_JOB_SUCCESS_RATE * 100,
    actionPointCost: SIDE_JOB_ACTION_POINT_COST,
    materials,
    canCraft: Boolean(
      weapon
      && materials.every((material) => material.enough)
      && Number(character.economy?.money || 0) >= SIDE_JOB_MONEY_COST
      && Number(actionPoints.current || 0) >= SIDE_JOB_ACTION_POINT_COST
    )
  };
}

function buildSideJobCraftingView(character, now = Date.now()) {
  ensureDailyActionPoints(character, now);
  return {
    successRatePercent: SIDE_JOB_SUCCESS_RATE * 100,
    actionPointCost: SIDE_JOB_ACTION_POINT_COST,
    moneyCost: SIDE_JOB_MONEY_COST,
    actionPoints: serializeActionPoints(character),
    money: Math.max(0, Number(character.economy?.money) || 0),
    recipes: SIDE_JOB_RECIPES.map((recipe) => serializeRecipe(character, recipe))
  };
}

function craftSideJobWeapon(character, weaponId, random = Math.random, now = Date.now()) {
  const recipe = getRecipe(weaponId);
  if (!recipe) throw new Error('제작할 수 없는 무기입니다.');
  const weapon = getItemDefinition(recipe.weaponId);
  if (!weapon?.craftOnly) throw new Error('제작 무기 정보를 찾을 수 없습니다.');
  ensureDailyActionPoints(character, now);
  if (Number(character.actionPoints?.current || 0) < SIDE_JOB_ACTION_POINT_COST) {
    throw new Error(`행동력이 ${SIDE_JOB_ACTION_POINT_COST} 필요합니다.`);
  }
  if (Number(character.economy?.money || 0) < SIDE_JOB_MONEY_COST) {
    throw new Error('제작 비용 4,000만원이 부족합니다.');
  }
  for (const material of recipe.materials) {
    if (getItemQuantity(character, material.itemId) < material.quantity) {
      const item = getItemDefinition(material.itemId);
      throw new Error(`${item?.name || material.itemId}이(가) 부족합니다.`);
    }
  }

  const success = Number(random()) < SIDE_JOB_SUCCESS_RATE;
  if (success) assertInventorySpace(character, weapon, 1);
  spendActionPoints(character, SIDE_JOB_ACTION_POINT_COST, now);
  character.economy.money = Math.max(0, Number(character.economy.money) - SIDE_JOB_MONEY_COST);
  character.markModified?.('economy');
  for (const material of recipe.materials) {
    consumeInventoryItem(character, material.itemId, material.quantity);
  }

  let instanceData = null;
  if (success) {
    instanceData = rollEquipmentInstanceData(weapon, random);
    addInventoryItem(character, weapon.id, 1, instanceData);
  }
  return {
    crafted: success,
    weapon: { ...weapon, stats: { ...(instanceData?.stats || weapon.stats || {}) } },
    message: success
      ? `${weapon.name} 제작에 성공했습니다.`
      : `${weapon.name} 제작에 실패했습니다. 사용한 재료와 행동력은 소모되었습니다.`
  };
}

module.exports = {
  SIDE_JOB_SUCCESS_RATE,
  SIDE_JOB_ACTION_POINT_COST,
  SIDE_JOB_MONEY_COST,
  SIDE_JOB_RECIPES,
  buildSideJobCraftingView,
  craftSideJobWeapon
};
