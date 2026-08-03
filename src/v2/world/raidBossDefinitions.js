'use strict';

const BALD_KIM_BOSS_ID = 'bald_kim_manager';
const BALD_KIM_MAP_ID = 'boss_bald_kim_arena';

const BALD_KIM_PHASES = Object.freeze([
  Object.freeze({ phase: 1, maxHp: 25_000_000, expReward: 1_500_000, color: 'red', intervalMs: 10_000 }),
  Object.freeze({ phase: 2, maxHp: 35_000_000, expReward: 3_000_000, color: 'yellow', intervalMs: 6_000 }),
  Object.freeze({ phase: 3, maxHp: 45_000_000, expReward: 13_000_000, color: 'green', intervalMs: 3_000 })
]);

const RAID_BOSS_DEFINITIONS = Object.freeze({
  [BALD_KIM_BOSS_ID]: Object.freeze({
    id: BALD_KIM_BOSS_ID,
    mapId: BALD_KIM_MAP_ID,
    name: '대머리 김부장',
    icon: '👨‍💼',
    level: 125,
    maxMp: 0,
    contactDamage: 9_500,
    physicalDefense: 1_000,
    magicDefense: 1_000,
    movementSpeed: 0,
    visualScale: 2.6,
    spawnDelayMs: 10_000,
    dailyEntryLimit: 1,
    phases: BALD_KIM_PHASES,
    patterns: Object.freeze({
      wigRain: Object.freeze({ id: 'wig-rain', skillName: '가발 폭격!', castMs: 2_500, zoneCount: 12, zoneWidthPx: 300, damage: 2_800, stunMs: 5_000 }),
      resourceCrash: Object.freeze({ id: 'resource-crash', skillName: '전원 비상 감축!', castMs: 1_500 }),
      summonStaff: Object.freeze({ id: 'summon-staff', skillName: '부하 직원 호출!', castMs: 3_000, minimumPerSide: 3, maximumPerSide: 5 }),
      physicalIgnore: Object.freeze({ id: 'physical-ignore', skillName: '철면피 경영!', castMs: 500, durationMs: 30_000, chance: 0.15 }),
      oilSilence: Object.freeze({ id: 'oil-silence', skillName: '미끄러운 책임 회피!', castMs: 900, damage: 1_400, silenceMs: 8_000 })
    })
  })
});

function getRaidBossDefinition(raidBossId) {
  return RAID_BOSS_DEFINITIONS[String(raidBossId || '')] || null;
}

module.exports = {
  BALD_KIM_BOSS_ID,
  BALD_KIM_MAP_ID,
  BALD_KIM_PHASES,
  RAID_BOSS_DEFINITIONS,
  getRaidBossDefinition
};
