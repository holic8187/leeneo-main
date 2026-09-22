import { normalizeRaidRewardBonuses } from '../core/raidRewards.js';

const DEFAULT_TIMEOUT_MS = 10000;

export class RaidGatewayError extends Error {
  constructor(message, {
    status = 0,
    code = '',
    retryAfterSeconds = 0,
    activePlatform = '',
    generation = 0,
  } = {}) {
    super(message);
    this.name = 'RaidGatewayError';
    this.status = Number(status) || 0;
    this.code = String(code || '');
    this.retryAfterSeconds = Math.max(0, Number(retryAfterSeconds) || 0);
    this.activePlatform = String(activePlatform || '');
    this.generation = Math.max(0, Number(generation) || 0);
  }
}

function normalizeRanking(value) {
  const entries = Array.isArray(value?.entries) ? value.entries.map((entry, index) => ({
    rank: Math.max(1, Number(entry?.rank) || index + 1),
    nickname: String(entry?.nickname || '익명 사원'),
    contribution: Math.max(0, Number(entry?.contribution) || 0),
    dispatches: Math.max(0, Number(entry?.dispatches) || 0),
    clears: Math.max(0, Number(entry?.clears) || 0),
    stage: Math.max(1, Number(entry?.stage) || 1),
    entries: Math.max(0, Number(entry?.entries ?? entry?.dispatches) || 0),
    isMe: Boolean(entry?.isMe),
  })) : [];
  return {
    dayKey: String(value?.dayKey || ''),
    weekKey: String(value?.weekKey || value?.dayKey || ''),
    period: String(value?.period || 'weekly'),
    resetRule: String(value?.resetRule || ''),
    resetsAt: Number(value?.resetsAt) || 0,
    serverNow: Number(value?.serverNow) || 0,
    entries,
    myRank: value?.myRank == null ? null : Math.max(1, Number(value.myRank) || 1),
  };
}

function normalizeState(value) {
  if (!value || typeof value !== 'object') return null;
  const maxHp = Math.max(1, Number(value.maxHp) || 0);
  const clears = Math.max(0, Number(value.clears) || 0);
  const maxDailyEntries = Math.max(1, Number(value.maxDailyEntries ?? value.maxClears) || 5);
  const entriesToday = Math.max(0, Number(value.entriesToday ?? value.dispatches) || 0);
  const id = String(value.id || value.bossId || '');
  const dayKey = String(value.dayKey || '');
  const earnedCoins = value.earnedRewards?.coins == null
    ? 0
    : Math.max(0, Number(value.earnedRewards.coins) || 0);
  const earnedPacks = value.earnedRewards?.packs == null
    ? 0
    : Math.max(0, Number(value.earnedRewards.packs) || 0);
  return {
    ...value,
    id,
    bossId: String(value.bossId || id),
    bossName: String(value.bossName || value.boss?.name || '마감기한 드래곤'),
    stage: Math.max(1, Number(value.stage) || 1),
    maxStage: Math.max(1, Number(value.maxStage) || 10),
    hp: Math.min(maxHp, Math.max(0, Number(value.hp) || 0)),
    currentHp: Math.min(maxHp, Math.max(0, Number(value.currentHp ?? value.hp) || 0)),
    maxHp,
    contribution: Math.max(0, Number(value.contribution ?? value.totalContribution) || 0),
    totalContribution: Math.max(0, Number(value.totalContribution ?? value.contribution) || 0),
    lastDispatchAt: Math.max(0, Number(value.lastDispatchAt) || 0),
    dispatches: Math.max(0, Number(value.dispatches) || 0),
    clears,
    maxClears: maxDailyEntries,
    entriesToday,
    remainingEntries: Math.max(0, Number(value.remainingEntries ?? (maxDailyEntries - entriesToday)) || 0),
    maxDailyEntries,
    canEnter: value.canEnter == null ? entriesToday < maxDailyEntries : Boolean(value.canEnter),
    weeklyCompleted: Boolean(value.weeklyCompleted),
    cooldownMs: Math.max(0, Number(value.cooldownMs) || 0),
    dayKey,
    weekKey: String(value.weekKey || ''),
    rewardKey: String(value.rewardKey || (dayKey && id ? `${dayKey}:${id}` : '')),
    earnedRewards: {
      coins: earnedCoins,
      packs: earnedPacks,
      bonuses: normalizeRaidRewardBonuses(value.earnedRewards?.bonuses),
    },
    resetsAt: Number(value.resetsAt) || 0,
    dailyResetsAt: Number(value.dailyResetsAt) || 0,
  };
}

function errorMessage(payload, fallback) {
  return String(payload?.message || payload?.msg || payload?.error || fallback);
}

export function createRaidGateway({
  apiBase = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const base = String(apiBase || '').trim().replace(/\/+$/, '');

  async function request(path, { method = 'GET', token = '', body } = {}) {
    if (!base) throw new RaidGatewayError('레이드 서버 주소가 설정되지 않았습니다.', { code: 'UNCONFIGURED' });
    if (!token) throw new RaidGatewayError('레이드를 이용하려면 로그인이 필요합니다.', { code: 'AUTH_REQUIRED' });
    if (typeof fetchImpl !== 'function') throw new RaidGatewayError('레이드 서버에 연결할 수 없습니다.', { code: 'FETCH_UNAVAILABLE' });

    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new RaidGatewayError(errorMessage(payload, '레이드 요청을 처리하지 못했습니다.'), {
          status: response.status,
          code: payload?.code,
          retryAfterSeconds: payload?.retryAfterSeconds,
          activePlatform: payload?.activePlatform,
          generation: payload?.generation,
        });
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new RaidGatewayError('레이드 서버 응답이 늦어 연결을 중단했습니다.', { code: 'TIMEOUT' });
      }
      if (error instanceof RaidGatewayError) throw error;
      throw new RaidGatewayError('레이드 서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.', { code: 'NETWORK_ERROR' });
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  const normalizePayload = (payload) => {
    const state = normalizeState(payload?.state);
    if (!state) throw new RaidGatewayError('레이드 상태 응답이 올바르지 않습니다.', { code: 'INVALID_RESPONSE' });
    return { ...payload, state, ranking: normalizeRanking(payload?.ranking) };
  };

  return {
    isConfigured: () => Boolean(base),
    async state(token) {
      return normalizePayload(await request('/api/tcg/raids/personal/state', { token }));
    },
    async ranking(token) {
      const payload = await request('/api/tcg/raids/personal/ranking', { token });
      return normalizeRanking(payload?.ranking || payload);
    },
    async dispatch(token, { bossId, squad, leaseId, deviceId, generation }) {
      return normalizePayload(await request('/api/tcg/raids/personal/dispatch', {
        method: 'POST',
        token,
        body: { bossId, squad, leaseId, deviceId, generation },
      }));
    },
    async start(token, { bossId, squad, squadScore, leaseId, deviceId, generation }) {
      return normalizePayload(await request('/api/tcg/raids/personal/start', {
        method: 'POST',
        token,
        body: { bossId, squad, squadScore, leaseId, deviceId, generation },
      }));
    },
    async finish(token, {
      sessionId,
      bossHpRemaining,
      damageDealt,
      turns,
      battleLog,
      leaseId,
      deviceId,
      generation,
    }) {
      return normalizePayload(await request('/api/tcg/raids/personal/finish', {
        method: 'POST',
        token,
        body: {
          sessionId,
          bossHpRemaining,
          damageDealt,
          turns,
          battleLog,
          leaseId,
          deviceId,
          generation,
        },
      }));
    },
  };
}

const configuredBase = String(import.meta.env?.VITE_TCG_API_BASE || '').trim();
const raidGateway = createRaidGateway({ apiBase: configuredBase });

export const isRaidGatewayConfigured = raidGateway.isConfigured;
export const loadPersonalRaid = raidGateway.state;
export const loadPersonalRaidRanking = raidGateway.ranking;
export const dispatchPersonalRaid = raidGateway.dispatch;
export const startPersonalRaid = raidGateway.start;
export const finishPersonalRaid = raidGateway.finish;
