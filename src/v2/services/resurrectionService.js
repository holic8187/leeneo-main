'use strict';

function selectResurrectionTarget({
  casterId,
  activePlayers = [],
  rangePx = 350,
  worldWidth = 1200
} = {}) {
  const casterKey = String(casterId || '');
  const caster = activePlayers.find((player) => String(player.userId) === casterKey);
  if (!caster) return null;

  const rangePercent = Math.max(1, Number(rangePx) || 350)
    / Math.max(1, Number(worldWidth) || 1200)
    * 100;
  return activePlayers
    .filter((player) => (
      String(player.userId) !== casterKey
      && Number(player.currentHp) <= 0
      && Number(player.floor) === Number(caster.floor)
      && Math.abs(Number(player.x) - Number(caster.x)) <= rangePercent + 4.5
    ))
    .sort((left, right) => (
      Math.abs(Number(left.x) - Number(caster.x))
      - Math.abs(Number(right.x) - Number(caster.x))
    ))[0] || null;
}

function reviveCharacter(character, {
  maxHp,
  maxMp,
  hpPercent = 50
} = {}) {
  const resolvedMaxHp = Math.max(1, Number(maxHp) || Number(character?.resources?.maxHp) || 1);
  const resolvedMaxMp = Math.max(0, Number(maxMp) || Number(character?.resources?.maxMp) || 0);
  const restoredHp = Math.max(
    1,
    Math.min(resolvedMaxHp, Math.floor(resolvedMaxHp * Math.max(0, Number(hpPercent) || 0) / 100))
  );
  const restoredMp = Math.max(
    0,
    Math.min(resolvedMaxMp, Number(character?.resources?.currentMp) || 0)
  );

  character.resources.currentHp = restoredHp;
  character.resources.currentMp = restoredMp;
  if (character.worldState) character.worldState.raidDeadAt = null;
  return { restoredHp, restoredMp };
}

module.exports = {
  selectResurrectionTarget,
  reviveCharacter
};
