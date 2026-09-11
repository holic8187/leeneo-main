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
    isMe: Boolean(entry?.isMe),
  })) : [];
  return {
    dayKey: String(value?.dayKey || ''),
    resetsAt: Number(value?.resetsAt) || 0,
    entries,
    myRank: value?.myRank == null ? null : Math.max(1, Number(value.myRank) || 1),
  };
}

function normalizeState(value) {
  if (!value || typeof value !== 'object') return null;
  const maxHp = Math.max(1, Number(value.maxHp) || 0);
  const clears = Math.max(0, Number(value.clears) || 0);
  const id = String(value.id || value.bossId || '');
  const dayKey = String(value.dayKey || '');
  return {
    id,
    hp: Math.min(maxHp, Math.max(0, Number(value.hp) || 0)),
    maxHp,
    contribution: Math.max(0, Number(value.contribution ?? value.totalContribution) || 0),
    totalContribution: Math.max(0, Number(value.totalContribution ?? value.contribution) || 0),
    lastDispatchAt: Math.max(0, Number(value.lastDispatchAt) || 0),
    dispatches: Math.max(0, Number(value.dispatches) || 0),
    clears,
    maxClears: Math.max(1, Number(value.maxClears) || 2),
    cooldownMs: Math.max(0, Number(value.cooldownMs) || 60000),
    dayKey,
    rewardKey: String(value.rewardKey || (dayKey && id ? `${dayKey}:${id}` : '')),
    earnedRewards: {
      coins: Math.max(0, Number(value.earnedRewards?.coins) || clears * 5000),
      packs: Math.max(0, Number(value.earnedRewards?.packs) || clears),
    },
    resetsAt: Number(value.resetsAt) || 0,
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
    async dispatch(token, { bossId, squadScore, leaseId, deviceId, generation }) {
      return normalizePayload(await request('/api/tcg/raids/personal/dispatch', {
        method: 'POST',
        token,
        body: { bossId, squadScore, leaseId, deviceId, generation },
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
