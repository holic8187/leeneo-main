'use strict';

const SUMMON_ROLE_LABELS = Object.freeze({
  attacker: '적을 자동으로 공격하는 공격형 소환수',
  decoy: '적의 공격을 대신 받는 도발형 소환수',
  'follow-up': '본체의 공격을 따라 공격하는 추격형 소환수',
  support: '소환 중 전용 패시브를 발동하는 지원형 소환수'
});

function getSummonRole(definition = {}, values = {}) {
  if (definition.summonRole) return String(definition.summonRole);
  if (Number(values.attackPower) > 0) return 'attacker';
  if (Number(values.summonHp) > 0) return 'decoy';
  if (Number(values.basicFollowUpPercent) > 0 || Number(values.skillFollowUpPercent) > 0) {
    return 'follow-up';
  }
  return 'support';
}

function buildSummonState(definition = {}, values = {}, now = Date.now()) {
  const createdAt = Math.max(0, Number(now) || Date.now());
  const durationSeconds = Math.max(1, Number(values.durationSeconds) || 1);
  const summonHp = Math.max(0, Math.floor(Number(values.summonHp) || 0));
  const attackIntervalSeconds = Math.max(0, Number(values.attackIntervalSeconds) || 0);
  const role = getSummonRole(definition, values);
  return {
    skillId: String(definition.id || ''),
    name: String(definition.name || '소환수'),
    icon: String(definition.summonIcon || '🐾'),
    role,
    masteryIncrease: Math.max(0, Number(values.masteryIncrease) || 0),
    summonHp,
    maxSummonHp: summonHp,
    attackPower: Math.max(0, Number(values.attackPower) || 0),
    attackIntervalMs: Math.round(attackIntervalSeconds * 1000),
    maxTargets: Math.max(1, Math.floor(Number(values.targetCount ?? definition.maxTargets) || 1)),
    range: Math.max(
      1,
      Number(values.range ?? definition.range) || (role === 'attacker' ? 650 : 100)
    ),
    element: String(definition.element || 'neutral'),
    stunChance: Math.max(0, Number(values.stunChance) || 0),
    stunSeconds: Math.max(0, Number(values.stunSeconds) || 0),
    freezeSeconds: Math.max(0, Number(values.freezeSeconds) || 0),
    basicFollowUpPercent: Math.max(0, Number(values.basicFollowUpPercent) || 0),
    skillFollowUpPercent: Math.max(0, Number(values.skillFollowUpPercent) || 0),
    createdAt: new Date(createdAt),
    lastAttackAt: null,
    expiresAt: new Date(createdAt + durationSeconds * 1000)
  };
}

function isSummonActive(summon, now = Date.now()) {
  if (!summon?.skillId) return false;
  const expiresAt = new Date(summon.expiresAt || 0).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function isAttackingSummon(summon, now = Date.now()) {
  return isSummonActive(summon, now)
    && summon.role === 'attacker'
    && Number(summon.attackPower) > 0
    && Number(summon.attackIntervalMs) > 0;
}

function isSummonAttackDue(summon, now = Date.now()) {
  if (!isAttackingSummon(summon, now)) return false;
  const baseline = new Date(summon.lastAttackAt || summon.createdAt || 0).getTime();
  if (!Number.isFinite(baseline)) return false;
  return now - baseline >= Math.max(1, Number(summon.attackIntervalMs) || 1);
}

function isDecoySummon(summon, now = Date.now()) {
  return isSummonActive(summon, now)
    && summon.role === 'decoy'
    && Number(summon.summonHp) > 0;
}

function isCompanionSummon(summon, now = Date.now()) {
  return isSummonActive(summon, now) && summon.skillId === 'small_companion';
}

function describeSummon(summon = {}) {
  const role = SUMMON_ROLE_LABELS[summon.role] || '현재 소환된 동료';
  const details = [];
  if (Number(summon.attackPower) > 0) details.push(`공격력 ${Number(summon.attackPower)}`);
  if (Number(summon.maxTargets) > 1) details.push(`최대 ${Number(summon.maxTargets)}명 공격`);
  if (Number(summon.maxSummonHp) > 0) {
    details.push(`HP ${Math.max(0, Number(summon.summonHp) || 0)}/${Number(summon.maxSummonHp)}`);
  }
  if (Number(summon.masteryIncrease) > 0) {
    details.push(`무기 숙련도 +${Number(summon.masteryIncrease)}%`);
  }
  return details.length ? `${role}입니다. ${details.join(' · ')}` : `${role}입니다.`;
}

module.exports = {
  buildSummonState,
  describeSummon,
  getSummonRole,
  isSummonActive,
  isAttackingSummon,
  isSummonAttackDue,
  isDecoySummon,
  isCompanionSummon
};
