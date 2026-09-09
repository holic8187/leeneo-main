export function createRaidState(definition, now = Date.now()) {
  return {
    id: definition.id,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    startedAt: now,
    endsAt: now + definition.durationMs,
    contribution: 0,
    lastDispatchAt: 0,
    dispatches: 0,
  };
}

export function dispatchRaid({ raid, squadScore, definition, now = Date.now(), random = Math.random }) {
  if (!raid || raid.id !== definition.id || now >= raid.endsAt || raid.hp <= 0) {
    raid = createRaidState(definition, now);
  }
  const remainingCooldown = raid.lastDispatchAt > 0
    ? Math.max(0, definition.dispatchCooldownMs - (now - raid.lastDispatchAt))
    : 0;
  if (remainingCooldown > 0) {
    throw new Error(`재정비까지 ${Math.ceil(remainingCooldown / 1000)}초 남았습니다.`);
  }
  if (squadScore <= 0) throw new Error('레이드에 보낼 카드를 편성해 주세요.');

  const variance = 0.82 + (Math.min(0.999999, Math.max(0, random())) * 0.36);
  const damage = Math.max(1, Math.floor(squadScore * 145 * variance));
  const appliedDamage = Math.min(raid.hp, damage);

  return {
    raid: {
      ...raid,
      hp: raid.hp - appliedDamage,
      contribution: raid.contribution + appliedDamage,
      lastDispatchAt: now,
      dispatches: raid.dispatches + 1,
    },
    damage: appliedDamage,
  };
}
