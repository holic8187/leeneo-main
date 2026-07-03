'use strict';

const crypto = require('crypto');

const portals = new Map();

function cleanupPortals(now = Date.now()) {
  for (const [id, portal] of portals) {
    if (portal.expiresAt <= now) portals.delete(id);
  }
}

function createPartyReturnPortals({
  casterId,
  memberIds,
  fieldMapId,
  fieldX,
  fieldFloor,
  safeMapId,
  durationSeconds
}) {
  cleanupPortals();
  const portalGroupId = crypto.randomUUID();
  const allowedUserIds = [...new Set((memberIds || []).map(String).concat(String(casterId)))];
  const expiresAt = Date.now() + Math.max(1, Number(durationSeconds) || 1) * 1000;
  const shared = {
    portalGroupId,
    casterId: String(casterId),
    allowedUserIds,
    expiresAt
  };
  const fieldPortal = {
    id: crypto.randomUUID(),
    ...shared,
    mapId: String(fieldMapId),
    x: Math.max(2, Math.min(92, Number(fieldX) || 8)),
    floor: Number(fieldFloor) === 1 ? 1 : 0,
    targetMapId: String(safeMapId),
    targetX: 8,
    targetFloor: 0,
    label: '안전지대 귀환 포탈'
  };
  const safePortal = {
    id: crypto.randomUUID(),
    ...shared,
    mapId: String(safeMapId),
    x: 16,
    floor: 0,
    targetMapId: String(fieldMapId),
    targetX: fieldPortal.x,
    targetFloor: fieldPortal.floor,
    label: '현장 복귀 포탈'
  };
  portals.set(fieldPortal.id, fieldPortal);
  portals.set(safePortal.id, safePortal);
  return [fieldPortal, safePortal].map(serializePortal);
}

function serializePortal(portal) {
  return {
    id: portal.id,
    groupId: portal.portalGroupId,
    label: portal.label,
    mapId: portal.mapId,
    x: portal.x,
    floor: portal.floor,
    targetMapId: portal.targetMapId,
    expiresAt: portal.expiresAt
  };
}

function listVisiblePartyPortals(userId, mapId, now = Date.now()) {
  cleanupPortals(now);
  return [...portals.values()]
    .filter((portal) => (
      portal.mapId === String(mapId)
      && portal.allowedUserIds.includes(String(userId))
    ))
    .map(serializePortal);
}

function usePartyPortal(userId, portalId, currentMapId, now = Date.now()) {
  cleanupPortals(now);
  const portal = portals.get(String(portalId));
  if (!portal || portal.mapId !== String(currentMapId)) {
    throw new Error('사용할 수 있는 귀환 포탈이 없습니다.');
  }
  if (!portal.allowedUserIds.includes(String(userId))) {
    throw new Error('해당 파티만 사용할 수 있는 포탈입니다.');
  }
  return {
    mapId: portal.targetMapId,
    x: portal.targetX,
    floor: portal.targetFloor,
    label: portal.label
  };
}

function resetPartyPortals() {
  portals.clear();
}

module.exports = {
  createPartyReturnPortals,
  listVisiblePartyPortals,
  usePartyPortal,
  resetPartyPortals
};
