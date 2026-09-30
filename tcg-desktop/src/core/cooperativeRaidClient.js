const identityKey = ({ accountId = '', token = '' } = {}) => `${accountId}\u0000${token}`;
const fingerprint = (data) => JSON.stringify(data ? { ...data, serverNow: 0 } : null);

export function cooperativeCharacterIdentity(cardId) {
  return String(cardId || '').replace(/-(?:ssr|rrr|ur|hr|sr|rr|r|u|c)$/i, '');
}

export function toggleCooperativeRepresentative(selected, cardId) {
  if (selected.includes(cardId)) return selected.filter((id) => id !== cardId);
  if (selected.length >= 3) throw new Error('대표 카드는 3장까지 선택할 수 있습니다.');
  if (selected.some((id) => cooperativeCharacterIdentity(id) === cooperativeCharacterIdentity(cardId))) {
    throw new Error('같은 인물은 등급이 달라도 함께 선택할 수 없습니다.');
  }
  return [...selected, cardId];
}

// One network request at a time. A queued mutation waits for the current read,
// and no further polls can overtake it. Responses from a previous login are ignored.
export function createCooperativeRaidClient({ gateway, getIdentity, onChange = () => {}, now = Date.now }) {
  let epoch = 0;
  let poll = null;
  const empty = () => ({ data: null, loading: false, pending: '', error: '', lastLoadedAt: 0, lastAttemptAt: 0, clockOffset: 0, feedback: null });
  let state = empty();
  const capture = () => ({ epoch, identity: { ...getIdentity() }, key: identityKey(getIdentity()) });
  const current = (request) => request.epoch === epoch && request.key === identityKey(getIdentity());
  const patch = (value, notify = true) => { state = { ...state, ...value }; if (notify) onChange(state); };
  const apply = (payload) => {
    const changed = fingerprint(state.data) !== fingerprint(payload.cooperative) || Boolean(state.error);
    const previousRoom = state.data?.room;
    const room = payload.cooperative.room;
    let feedback = state.feedback;
    if (room?.id !== previousRoom?.id) feedback = null;
    else if (room && room.revision !== previousRoom.revision) {
      const previousLog = previousRoom.battle?.log || [];
      const latestIndex = previousLog.at(-1)?.index ?? -1;
      const added = (room.battle?.log || []).filter((entry) => entry.index > latestIndex);
      feedback = {
        revision: room.revision, at: now(),
        damage: added.filter((entry) => ['damage', 'counter'].includes(entry.type) && entry.targetId === room.battle.boss.id).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
        breakDamage: added.filter((entry) => entry.type === 'break').reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
      };
    }
    patch({ data: payload.cooperative, loading: false, error: '', lastLoadedAt: now(), clockOffset: Number(payload.cooperative.serverNow) - now() || 0, feedback }, changed);
  };
  return {
    getState: () => state,
    reset() { epoch += 1; poll = null; state = empty(); onChange(state); },
    async refresh() {
      if (poll || state.pending) return poll;
      const request = capture();
      if (!request.identity.token || !request.identity.accountId) return null;
      patch({ loading: true, lastAttemptAt: now() }, !state.data);
      const operation = (async () => {
        try {
          const payload = await gateway.state(request.identity.token);
          if (current(request)) apply(payload);
          return current(request) ? payload : null;
        } catch (error) {
          if (current(request)) patch({ loading: false, error: error.message || '연결을 다시 확인하고 있습니다.' });
          return null;
        } finally {
          if (current(request)) { patch({ loading: false }, false); poll = null; }
        }
      })();
      poll = operation;
      return operation;
    },
    async mutate(method, prepare = () => ({}), commit = () => {}) {
      if (state.pending) return null;
      const request = capture();
      patch({ pending: method, error: '', lastAttemptAt: now() });
      try {
        if (poll) await poll;
        if (!current(request)) return null;
        const body = await prepare(request.identity);
        if (!current(request)) return null;
        const payload = await gateway[method](request.identity.token, body);
        if (!current(request)) return null;
        await commit(payload, request.identity);
        if (!current(request)) return null;
        apply(payload);
        return payload;
      } catch (error) {
        if (current(request)) patch({ error: error.message || '요청을 처리하지 못했습니다.' });
        throw error;
      } finally {
        if (current(request)) patch({ pending: '' });
      }
    },
  };
}
