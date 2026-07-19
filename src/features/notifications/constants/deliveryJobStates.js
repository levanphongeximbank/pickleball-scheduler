/**
 * Canonical notification delivery job state machine (Phase 1.5).
 *
 * Terminal: SENT, DEAD_LETTERED, CANCELLED
 * Browser clients must not set: PROCESSING, SENT, FAILED, DEAD_LETTERED
 */

export const DELIVERY_JOB_STATES = Object.freeze({
  CREATED: "CREATED",
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  SENT: "SENT",
  RETRY_SCHEDULED: "RETRY_SCHEDULED",
  FAILED: "FAILED",
  DEAD_LETTERED: "DEAD_LETTERED",
  CANCELLED: "CANCELLED",
});

export const DELIVERY_JOB_STATE_VALUES = Object.freeze(
  Object.values(DELIVERY_JOB_STATES)
);

export const TERMINAL_DELIVERY_JOB_STATES = Object.freeze([
  DELIVERY_JOB_STATES.SENT,
  DELIVERY_JOB_STATES.DEAD_LETTERED,
  DELIVERY_JOB_STATES.CANCELLED,
]);

/** States browser / authenticated clients must never set. */
export const WORKER_ONLY_DELIVERY_JOB_STATES = Object.freeze([
  DELIVERY_JOB_STATES.PROCESSING,
  DELIVERY_JOB_STATES.SENT,
  DELIVERY_JOB_STATES.FAILED,
  DELIVERY_JOB_STATES.DEAD_LETTERED,
]);

const VALID_TRANSITIONS = Object.freeze({
  [DELIVERY_JOB_STATES.CREATED]: Object.freeze([
    DELIVERY_JOB_STATES.QUEUED,
    DELIVERY_JOB_STATES.CANCELLED,
  ]),
  [DELIVERY_JOB_STATES.QUEUED]: Object.freeze([
    DELIVERY_JOB_STATES.PROCESSING,
    DELIVERY_JOB_STATES.CANCELLED,
  ]),
  [DELIVERY_JOB_STATES.PROCESSING]: Object.freeze([
    DELIVERY_JOB_STATES.SENT,
    DELIVERY_JOB_STATES.RETRY_SCHEDULED,
    DELIVERY_JOB_STATES.FAILED,
    DELIVERY_JOB_STATES.DEAD_LETTERED,
    DELIVERY_JOB_STATES.CANCELLED,
  ]),
  [DELIVERY_JOB_STATES.RETRY_SCHEDULED]: Object.freeze([
    DELIVERY_JOB_STATES.PROCESSING,
    DELIVERY_JOB_STATES.CANCELLED,
  ]),
  [DELIVERY_JOB_STATES.FAILED]: Object.freeze([
    DELIVERY_JOB_STATES.RETRY_SCHEDULED,
    DELIVERY_JOB_STATES.CANCELLED,
  ]),
  [DELIVERY_JOB_STATES.SENT]: Object.freeze([]),
  [DELIVERY_JOB_STATES.DEAD_LETTERED]: Object.freeze([]),
  [DELIVERY_JOB_STATES.CANCELLED]: Object.freeze([]),
});

export function isValidDeliveryJobState(state) {
  return DELIVERY_JOB_STATE_VALUES.includes(state);
}

export function isTerminalDeliveryJobState(state) {
  return TERMINAL_DELIVERY_JOB_STATES.includes(state);
}

export function isWorkerOnlyDeliveryJobState(state) {
  return WORKER_ONLY_DELIVERY_JOB_STATES.includes(state);
}

/**
 * @returns {{ ok: true } | { ok: false, error: string, code: string }}
 */
export function assertDeliveryJobTransition(fromState, toState, { explicitRetry = false } = {}) {
  if (!isValidDeliveryJobState(fromState)) {
    return { ok: false, code: "invalid_from_state", error: `Invalid from state: ${fromState}` };
  }
  if (!isValidDeliveryJobState(toState)) {
    return { ok: false, code: "invalid_to_state", error: `Invalid to state: ${toState}` };
  }
  if (fromState === toState) {
    return { ok: false, code: "noop_transition", error: "From and to states are identical." };
  }

  const allowed = VALID_TRANSITIONS[fromState] || [];
  if (!allowed.includes(toState)) {
    return {
      ok: false,
      code: "invalid_transition",
      error: `Invalid transition ${fromState} -> ${toState}`,
    };
  }

  if (
    fromState === DELIVERY_JOB_STATES.FAILED &&
    toState === DELIVERY_JOB_STATES.RETRY_SCHEDULED &&
    !explicitRetry
  ) {
    return {
      ok: false,
      code: "failed_retry_requires_explicit",
      error: "FAILED -> RETRY_SCHEDULED requires explicitRetry=true",
    };
  }

  return { ok: true };
}

export function getAllowedDeliveryJobTransitions(fromState) {
  return [...(VALID_TRANSITIONS[fromState] || [])];
}
