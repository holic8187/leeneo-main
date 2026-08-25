'use strict';

(function registerCombatTargeting(root) {
  const FLOOR_TRAVEL_COST_PX = 240;
  const MONSTER_DENSITY_BONUS_PX = 110;
  const MAX_DENSITY_BONUS_PX = 440;

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function platformKey(monster = {}) {
    return String(monster.platformId || `floor:${Math.max(0, Math.floor(finite(monster.floor)))}`);
  }

  function estimateRouteDistance(monster, context = {}) {
    const worldWidth = Math.max(760, finite(context.worldWidth, 760));
    let floor = Math.max(0, Math.floor(finite(context.currentFloor)));
    let x = finite(context.currentX);
    const targetFloor = Math.max(0, Math.floor(finite(monster.floor)));
    const targetX = finite(monster.x);
    let distance = 0;

    while (floor !== targetFloor) {
      const nextFloor = floor + Math.sign(targetFloor - floor);
      const connector = (context.connectors || [])
        .filter((entry) => (
          (
            Math.floor(finite(entry.fromFloor)) === floor
            && Math.floor(finite(entry.toFloor)) === nextFloor
          ) || (
            Math.floor(finite(entry.fromFloor)) === nextFloor
            && Math.floor(finite(entry.toFloor)) === floor
          )
        ))
        .sort((left, right) => (
          Math.abs(finite(left.x) - x) - Math.abs(finite(right.x) - x)
        ))[0];
      if (!connector) {
        distance += Math.abs(targetFloor - floor) * FLOOR_TRAVEL_COST_PX;
        floor = targetFloor;
        break;
      }
      const connectorX = finite(connector.x, x);
      distance += Math.abs(connectorX - x) / 100 * worldWidth;
      distance += String(connector.type) === 'jump'
        ? FLOOR_TRAVEL_COST_PX * 0.7
        : FLOOR_TRAVEL_COST_PX;
      x = connectorX;
      floor = nextFloor;
    }

    return distance + Math.abs(targetX - x) / 100 * worldWidth;
  }

  function nearestMonster(monsters, context = {}) {
    return [...monsters].sort((left, right) => (
      estimateRouteDistance(left, context) - estimateRouteDistance(right, context)
    ))[0] || null;
  }

  function chooseBestPlatform(monsters, context = {}) {
    const groups = new Map();
    for (const monster of monsters) {
      const key = platformKey(monster);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(monster);
    }
    return [...groups.values()].sort((left, right) => {
      const leftRoute = Math.min(...left.map((monster) => estimateRouteDistance(monster, context)));
      const rightRoute = Math.min(...right.map((monster) => estimateRouteDistance(monster, context)));
      const leftBonus = Math.min(MAX_DENSITY_BONUS_PX, (left.length - 1) * MONSTER_DENSITY_BONUS_PX);
      const rightBonus = Math.min(MAX_DENSITY_BONUS_PX, (right.length - 1) * MONSTER_DENSITY_BONUS_PX);
      return (leftRoute - leftBonus) - (rightRoute - rightBonus)
        || right.length - left.length;
    })[0] || [];
  }

  function selectCombatTarget(monsters = [], context = {}) {
    const liveMonsters = monsters.filter((monster) => finite(monster.hp) > 0);
    if (!liveMonsters.length) return null;

    const rallyPlatformId = String(context.rallyPlatformId || '');
    if (rallyPlatformId) {
      const rallyTargets = liveMonsters.filter(
        (monster) => platformKey(monster) === rallyPlatformId
      );
      return nearestMonster(rallyTargets, context);
    }

    const currentFloor = Math.max(0, Math.floor(finite(context.currentFloor)));
    const currentPlatformId = String(context.currentPlatformId || '');
    const currentPlatformTargets = currentPlatformId
      ? liveMonsters.filter((monster) => platformKey(monster) === currentPlatformId)
      : [];
    if (currentPlatformTargets.length) {
      return nearestMonster(currentPlatformTargets, context);
    }

    const currentFloorTargets = liveMonsters.filter(
      (monster) => Math.max(0, Math.floor(finite(monster.floor))) === currentFloor
    );
    const searchPool = currentFloorTargets.length ? currentFloorTargets : liveMonsters;
    const platformTargets = chooseBestPlatform(searchPool, context);
    return nearestMonster(platformTargets, context);
  }

  function shouldJumpForCombatApproach({
    currentPlatformId = '',
    targetPlatformId = '',
    gapPx = 0,
    rangePx = 0
  } = {}) {
    return Boolean(
      currentPlatformId
      && targetPlatformId
      && currentPlatformId !== targetPlatformId
      && finite(gapPx) > Math.max(0, finite(rangePx))
    );
  }

  function resolveTravelDirection({
    currentX = 0,
    activeMoveTargetX = null,
    combatTargetX = null,
    fallbackDirection = 1
  } = {}) {
    const current = finite(currentX);
    for (const target of [activeMoveTargetX, combatTargetX]) {
      if (target === null || target === undefined || target === '') continue;
      const offset = finite(target, current) - current;
      if (Math.abs(offset) > 0.05) return Math.sign(offset);
    }
    return finite(fallbackDirection, 1) < 0 ? -1 : 1;
  }

  function resolveTravelDestination({
    currentX = 0,
    direction = 1,
    distancePx = 0,
    worldWidth = 760,
    minimumX = 0,
    maximumX = 94
  } = {}) {
    const minimum = finite(minimumX);
    const maximum = Math.max(minimum, finite(maximumX, 94));
    const width = Math.max(760, finite(worldWidth, 760));
    const travelPercent = Math.max(0, finite(distancePx)) / width * 100;
    const destination = finite(currentX) + (finite(direction, 1) < 0 ? -1 : 1) * travelPercent;
    return Math.max(minimum, Math.min(maximum, destination));
  }

  const api = Object.freeze({
    estimateRouteDistance,
    selectCombatTarget,
    shouldJumpForCombatApproach,
    resolveTravelDirection,
    resolveTravelDestination
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.V2CombatTargeting = api;
}(typeof window !== 'undefined' ? window : globalThis));
