export class PromiseDeadlineError extends Error {
  constructor(message = '요청 시간이 초과되었습니다.') {
    super(message);
    this.name = 'PromiseDeadlineError';
    this.code = 'TIMEOUT';
  }
}

export function withDeadline(
  task,
  {
    timeoutMs = 10000,
    onTimeout = () => {},
    timeoutError = () => new PromiseDeadlineError(),
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
  } = {},
) {
  const duration = Math.max(1, Number(timeoutMs) || 1);
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timer != null) clearTimeoutImpl(timer);
      callback(value);
    };

    timer = setTimeoutImpl(() => {
      if (settled) return;
      try {
        onTimeout();
      } catch {
        // The timeout result must not depend on cancellation support.
      }
      let error;
      try {
        error = timeoutError();
      } catch (cause) {
        error = cause;
      }
      finish(reject, error instanceof Error ? error : new PromiseDeadlineError());
    }, duration);

    Promise.resolve()
      .then(() => (typeof task === 'function' ? task() : task))
      .then(
        (value) => finish(resolve, value),
        (error) => finish(reject, error),
      );
  });
}
