export async function waitForOptionalUpdateRestore(
  restorePromise,
  { timeoutMs = 4_000, schedule = setTimeout, cancel = clearTimeout } = {},
) {
  if (!restorePromise || typeof restorePromise.then !== 'function') return 'unavailable';
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve(restorePromise).then(() => 'restored', () => 'failed'),
      new Promise((resolve) => {
        timer = schedule(() => resolve('timeout'), Math.max(0, Number(timeoutMs) || 0));
      }),
    ]);
  } finally {
    if (timer != null) cancel(timer);
  }
}

export function shouldFlushCloudBeforeUpdate({ cloudPhase = '', hasCloudSession = false } = {}) {
  return cloudPhase === 'active' && hasCloudSession === true;
}
