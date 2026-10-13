// Completion notices are presentation only: rewards are settled immediately.
// Keeping this queue separate prevents a background reward from dismissing a
// card reveal, an administrator's draft, or a raid skill explanation.
export function createPopupQueue() {
  let pending = [];
  return {
    enqueue(popup, key = '') {
      if (key && pending.some((entry) => entry.key === key)) return false;
      pending.push({ popup, key });
      return true;
    },
    take({ busy = false, allowed = true } = {}) {
      return !busy && allowed ? pending.shift()?.popup || null : null;
    },
    clear() { pending = []; },
    get size() { return pending.length; },
  };
}
