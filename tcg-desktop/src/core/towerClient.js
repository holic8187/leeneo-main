import { getRaidActionFeedback } from './raidBattleView.js';

export function createTowerClient({ gateway, getIdentity, onChange = () => {}, now = Date.now }) {
  const key = () => { const identity = getIdentity(); return `${identity.accountId || ''}\0${identity.token || ''}`; };
  const empty = () => ({ data: null, ranking: null, pending: '', loading: false, error: '', clockOffset: 0, feedback: null, lastLoadedAt: 0, lastAttemptAt: 0 });
  let value = empty(), generation = 0, poll = null;
  const patch = (fields, notify = true) => { value = { ...value, ...fields }; if (notify) onChange(value); };
  const apply = payload => {
    if (payload.ranking) return patch({ ranking: payload.ranking });
    const previous = value.data, next = payload.tower;
    if (previous?.seasonKey === next.seasonKey && next.revision < previous.revision) return;
    const changed = !previous || previous.seasonKey !== next.seasonKey || previous.revision !== next.revision || Boolean(value.error);
    let feedback = value.feedback;
    if (previous?.battleId !== next.battleId || previous?.seasonKey !== next.seasonKey) feedback = null;
    else if (changed && previous.battle && next.battle) feedback = { ...getRaidActionFeedback(previous.battle, next.battle), revision: next.revision, at: now() };
    patch({ data: next, loading: false, error: '', feedback, clockOffset: Number(next.serverNow) - now() || 0, lastLoadedAt: now() }, changed);
  };
  const client = {
    getState: () => value,
    reset() { generation += 1; poll = null; value = empty(); onChange(value); },
    async refresh() {
      if (poll || value.pending) return poll;
      const identity = { ...getIdentity() }, ownKey = key(), epoch = generation;
      if (!identity.token || !identity.accountId) return null;
      patch({ loading: !value.data, lastAttemptAt: now() }, !value.data);
      poll = (async () => {
        try { const payload = await gateway.state(identity.token); if (epoch === generation && ownKey === key()) apply(payload); return payload; }
        catch (error) { if (epoch === generation && ownKey === key()) patch({ error: error.message, loading: false }); return null; }
        finally { if (epoch === generation && ownKey === key()) poll = null; }
      })();
      return poll;
    },
    async mutate(method, prepare = () => ({})) {
      if (value.pending) return null;
      const epoch = generation, ownKey = key(), identity = { ...getIdentity() };
      patch({ pending: method, error: '' });
      try {
        if (poll) await poll;
        if (epoch !== generation || ownKey !== key()) return null;
        const body = await prepare(identity);
        if (epoch !== generation || ownKey !== key()) return null;
        const request = { ...body, seasonKey: value.data?.seasonKey, expectedRevision: value.data?.revision, battleId: value.data?.battleId };
        const payload = await gateway[method](identity.token, request);
        if (epoch !== generation || ownKey !== key()) return null;
        apply(payload); return payload;
      } catch (error) { if (epoch === generation && ownKey === key()) patch({ error: error.message }); throw error; }
      finally { if (epoch === generation && ownKey === key()) patch({ pending: '' }); }
    },
    async loadRanking() {
      const epoch = generation, ownKey = key(), identity = { ...getIdentity() };
      if (!identity.token) return null;
      try { const payload = await gateway.ranking(identity.token); if (epoch === generation && ownKey === key()) apply(payload); return payload; }
      catch (error) { if (epoch === generation && ownKey === key()) patch({ error: error.message }); return null; }
    },
  };
  return client;
}
