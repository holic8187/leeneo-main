import { characterIdForCard } from './cooperativeRaidRules.js';

export function togglePvpCard(selected, cardId) {
  if (selected.includes(cardId)) return selected.filter(id => id !== cardId);
  if (selected.length >= 4) throw new Error('대전 덱에는 카드 4장까지 편성할 수 있습니다.');
  if (selected.some(id => characterIdForCard(id) === characterIdForCard(cardId))) throw new Error('같은 인물은 등급이 달라도 함께 편성할 수 없습니다.');
  return [...selected, cardId];
}
const keyOf = identity => `${identity?.accountId || ''}\u0000${identity?.token || ''}`;
const fingerprint = value => JSON.stringify(value ? { ...value, serverNow: 0 } : null);
function feedback(before, after, now) {
  if (!before || !after) return null;
  const last = before.log?.at(-1)?.index ?? -1;
  const recentLogs = (after.log || []).filter(entry => entry.index > last);
  const hitIds = after.teams.flatMap((team, t) => team.cards.filter((card, c) =>
    card.hp < before.teams[t].cards[c].hp || card.shield < before.teams[t].cards[c].shield).map(card => card.id));
  return { at: now, hitIds, recentLogs, revision: after.actionCount };
}
export function createPvpClient({ gateway, getIdentity, onChange = () => {}, now = Date.now } = {}) {
  let epoch = 0, poll = null;
  const empty = () => ({ data: null, rankings: [], pending: '', loading: false, error: '', lastLoadedAt: 0, lastAttemptAt: 0, clockOffset: 0, feedback: null });
  let state = empty();
  const capture = () => ({ epoch, identity: { ...getIdentity() }, key: keyOf(getIdentity()) });
  const owns = request => request.epoch === epoch && request.key === keyOf(getIdentity());
  const patch = (next, notify = true) => { state = { ...state, ...next }; if (notify) onChange(state); };
  const apply = payload => {
    const changed = fingerprint(payload.pvp) !== fingerprint(state.data) || Boolean(state.error) || Boolean(payload.rankings);
    const oldRoom = state.data?.room, room = payload.pvp.room;
    const nextFeedback = room?.id === oldRoom?.id && room?.revision !== oldRoom?.revision ? feedback(oldRoom?.battle, room?.battle, now()) : room?.id === oldRoom?.id ? state.feedback : null;
    patch({ data: payload.pvp, rankings: payload.rankings || state.rankings, feedback: nextFeedback, error: '', loading: false,
      lastLoadedAt: now(), clockOffset: Number(payload.pvp.serverNow) - now() || 0 }, changed);
  };
  async function refresh(operation = 'state', { forReconnect = false } = {}) {
    if (poll || (state.pending && !forReconnect)) return poll;
    // A claim commit may be waiting for the cloud connection to become active.
    // Reconnect can verify the room concurrently, but must not replace that
    // pending mutation with a poll response or replay its reward request.
    const verificationOnly = Boolean(state.pending);
    const request = capture();
    if (!request.identity.accountId || !request.identity.token) return null;
    patch({ loading: !state.data, lastAttemptAt: now() }, !state.data);
    const current = (async () => {
      try {
        const payload = await gateway[operation](request.identity.token);
        if (owns(request) && !verificationOnly) apply(payload);
        return owns(request) ? payload : null;
      } catch (error) { if (owns(request)) patch({ loading: false, error: error.message }); return null; }
      finally { if (owns(request)) { patch({ loading: false }, false); poll = null; } }
    })();
    poll = current; return current;
  }
  return {
    getState: () => state,
    reset() { epoch += 1; poll = null; state = empty(); onChange(state); },
    refresh: options => refresh('state', options),
    async rankings() { if (poll) await poll; return refresh('rankings'); },
    async mutate(operation, prepare = () => ({}), commit = () => {}) {
      if (state.pending) return null;
      const request = capture();
      patch({ pending: operation, error: '', lastAttemptAt: now() });
      try {
        if (poll) await poll;
        if (!owns(request)) return null;
        let body = await prepare(request.identity);
        if (!owns(request)) return null;
        if (operation === 'action') body = { roomId: state.data?.room?.id, expectedRevision: state.data?.room?.revision,
          actionId: globalThis.crypto?.randomUUID?.() || `pvp-${now()}-${Math.random().toString(36).slice(2)}`, ...body };
        const payload = await gateway[operation](request.identity.token, body);
        if (!owns(request)) return null;
        await commit(payload, request.identity);
        if (!owns(request)) return null;
        apply(payload); return payload;
      } catch (error) { if (owns(request)) patch({ error: error.message }); throw error; }
      finally { if (owns(request)) patch({ pending: '' }); }
    },
  };
}
