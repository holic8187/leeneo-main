'use strict';

const crypto = require('crypto');

const REQUEST_TTL_MS = 30_000;
const sessions = new Map();
const sessionIdByUser = new Map();
const requestsByTarget = new Map();

function cleanup(now = Date.now()) {
  for (const [targetId, request] of requestsByTarget) {
    if (request.expiresAt <= now) requestsByTarget.delete(targetId);
  }
}

function requestTrade(inviter, target) {
  cleanup();
  const inviterId = String(inviter.userId);
  const targetId = String(target.userId);
  if (!inviterId || !targetId || inviterId === targetId) throw new Error('교환 대상을 확인해주세요.');
  if (sessionIdByUser.has(inviterId) || sessionIdByUser.has(targetId)) {
    throw new Error('이미 진행 중인 교환이 있습니다.');
  }
  const request = {
    id: crypto.randomUUID(),
    inviterId,
    inviterNickname: String(inviter.nickname || '사원'),
    targetId,
    targetNickname: String(target.nickname || '사원'),
    mapId: String(inviter.mapId || ''),
    expiresAt: Date.now() + REQUEST_TTL_MS
  };
  requestsByTarget.set(targetId, request);
  return { ...request };
}

function getTradeRequest(userId) {
  cleanup();
  const request = requestsByTarget.get(String(userId));
  return request ? { ...request } : null;
}

function respondTrade(userId, requestId, accepted) {
  const targetId = String(userId);
  const request = getTradeRequest(targetId);
  if (!request || request.id !== String(requestId)) throw new Error('유효한 교환 요청이 없습니다.');
  requestsByTarget.delete(targetId);
  if (!accepted) return null;
  const session = {
    id: crypto.randomUUID(),
    mapId: request.mapId,
    users: [
      { userId: request.inviterId, nickname: request.inviterNickname },
      { userId: request.targetId, nickname: request.targetNickname }
    ],
    offers: {
      [request.inviterId]: { money: 0, items: [], confirmed: false },
      [request.targetId]: { money: 0, items: [], confirmed: false }
    },
    createdAt: Date.now()
  };
  sessions.set(session.id, session);
  session.users.forEach((user) => sessionIdByUser.set(user.userId, session.id));
  return session;
}

function getSession(userId) {
  const id = sessionIdByUser.get(String(userId));
  return id ? sessions.get(id) || null : null;
}

function serializeSession(session, viewerId) {
  if (!session) return null;
  const me = session.users.find((user) => user.userId === String(viewerId));
  const partner = session.users.find((user) => user.userId !== String(viewerId));
  return {
    id: session.id,
    mapId: session.mapId,
    me,
    partner,
    myOffer: { ...session.offers[me.userId], items: [...session.offers[me.userId].items] },
    partnerOffer: {
      ...session.offers[partner.userId],
      items: [...session.offers[partner.userId].items]
    }
  };
}

function setTradeOffer(userId, { money = 0, items = [] } = {}) {
  const session = getSession(userId);
  if (!session) throw new Error('진행 중인 교환이 없습니다.');
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => ({
      stackId: String(item.stackId || ''),
      itemId: String(item.itemId || ''),
      name: String(item.name || ''),
      icon: String(item.icon || ''),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
    }))
    .filter((item) => item.stackId)
    .slice(0, 16);
  session.offers[String(userId)] = {
    money: Math.max(0, Math.floor(Number(money) || 0)),
    items: normalizedItems,
    confirmed: false
  };
  for (const offer of Object.values(session.offers)) offer.confirmed = false;
  return session;
}

function confirmTrade(userId) {
  const session = getSession(userId);
  if (!session) throw new Error('진행 중인 교환이 없습니다.');
  session.offers[String(userId)].confirmed = true;
  return {
    session,
    ready: Object.values(session.offers).every((offer) => offer.confirmed)
  };
}

function resetTradeConfirmations(session) {
  if (!session) return;
  for (const offer of Object.values(session.offers)) offer.confirmed = false;
}

function closeTrade(userId) {
  const session = getSession(userId);
  if (!session) return null;
  sessions.delete(session.id);
  session.users.forEach((user) => sessionIdByUser.delete(user.userId));
  return session;
}

function getTradeState(userId) {
  return {
    request: getTradeRequest(userId),
    session: serializeSession(getSession(userId), userId)
  };
}

module.exports = {
  REQUEST_TTL_MS,
  requestTrade,
  getTradeRequest,
  respondTrade,
  getSession,
  serializeSession,
  setTradeOffer,
  confirmTrade,
  resetTradeConfirmations,
  closeTrade,
  getTradeState
};
