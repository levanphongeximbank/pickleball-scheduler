/**
 * Deterministic delivery retry / backoff policy — Phase 1.5.
 * Inject `now` and `jitterSource` for deterministic tests.
 */

export const DEFAULT_RETRY_POLICY = Object.freeze({
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 15 * 60 * 1_000,
  /** Bounded jitter ratio in [0, jitterRatio] applied as multiplier factor. */
  jitterRatio: 0.2,
});

/**
 * @param {number} attemptNumber — 1-based attempt that just failed
 * @param {object} [policy]
 * @param {() => number} [jitterSource] — returns [0,1)
 */
export function computeBackoffDelayMs(
  attemptNumber,
  policy = DEFAULT_RETRY_POLICY,
  jitterSource = Math.random
) {
  const attempt = Math.max(1, Number(attemptNumber) || 1);
  const base = Math.max(0, Number(policy.baseDelayMs) || DEFAULT_RETRY_POLICY.baseDelayMs);
  const maxDelay = Math.max(base, Number(policy.maxDelayMs) || DEFAULT_RETRY_POLICY.maxDelayMs);
  const jitterRaw =
    policy.jitterRatio == null
      ? DEFAULT_RETRY_POLICY.jitterRatio
      : Number(policy.jitterRatio);
  const jitterRatio = Math.min(1, Math.max(0, Number.isFinite(jitterRaw) ? jitterRaw : 0));

  const exponential = base * 2 ** (attempt - 1);
  const capped = Math.min(maxDelay, exponential);
  const jitter = typeof jitterSource === "function" ? jitterSource() : 0;
  const boundedJitter = Math.min(1, Math.max(0, Number(jitter) || 0)) * jitterRatio;
  return Math.floor(capped * (1 + boundedJitter));
}

export function computeNextAttemptAt({
  attemptNumber,
  policy = DEFAULT_RETRY_POLICY,
  now = () => new Date(),
  jitterSource = Math.random,
} = {}) {
  const delayMs = computeBackoffDelayMs(attemptNumber, policy, jitterSource);
  const base = typeof now === "function" ? now() : now;
  const ms = base instanceof Date ? base.getTime() : new Date(base).getTime();
  return new Date(ms + delayMs).toISOString();
}

export function shouldDeadLetter({
  attemptNumber,
  maxAttempts = DEFAULT_RETRY_POLICY.maxAttempts,
} = {}) {
  return Number(attemptNumber) >= Number(maxAttempts);
}

/**
 * Decide next job state after a provider attempt.
 */
export function resolveRetryOutcome({
  failureClass,
  retryable,
  attemptNumber,
  maxAttempts = DEFAULT_RETRY_POLICY.maxAttempts,
  policy = DEFAULT_RETRY_POLICY,
  now = () => new Date(),
  jitterSource = Math.random,
  explicitPermanentToFailed = true,
} = {}) {
  const attempts = Math.max(1, Number(attemptNumber) || 1);
  const max = Math.max(1, Number(maxAttempts) || DEFAULT_RETRY_POLICY.maxAttempts);

  if (!retryable || failureClass === "PERMANENT") {
    return {
      nextStatus: explicitPermanentToFailed ? "FAILED" : "DEAD_LETTERED",
      nextAttemptAt: null,
      deadLetter: !explicitPermanentToFailed,
      scheduleRetry: false,
    };
  }

  if (attempts >= max) {
    return {
      nextStatus: "DEAD_LETTERED",
      nextAttemptAt: null,
      deadLetter: true,
      scheduleRetry: false,
    };
  }

  return {
    nextStatus: "RETRY_SCHEDULED",
    nextAttemptAt: computeNextAttemptAt({
      attemptNumber: attempts,
      policy,
      now,
      jitterSource,
    }),
    deadLetter: false,
    scheduleRetry: true,
  };
}
