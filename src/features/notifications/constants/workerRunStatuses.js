/**
 * Worker-run audit statuses — Phase 1.6.
 */

export const WORKER_RUN_STATUSES = Object.freeze({
  STARTED: "STARTED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  PARTIAL_FAILURE: "PARTIAL_FAILURE",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
});

export const WORKER_RUN_STATUS_VALUES = Object.freeze(Object.values(WORKER_RUN_STATUSES));

export const ACTIVE_WORKER_RUN_STATUSES = Object.freeze([
  WORKER_RUN_STATUSES.STARTED,
  WORKER_RUN_STATUSES.RUNNING,
]);

export const TERMINAL_WORKER_RUN_STATUSES = Object.freeze([
  WORKER_RUN_STATUSES.COMPLETED,
  WORKER_RUN_STATUSES.PARTIAL_FAILURE,
  WORKER_RUN_STATUSES.FAILED,
  WORKER_RUN_STATUSES.ABANDONED,
]);

export function isValidWorkerRunStatus(value) {
  return WORKER_RUN_STATUS_VALUES.includes(String(value || "").toUpperCase());
}

export function isActiveWorkerRunStatus(value) {
  return ACTIVE_WORKER_RUN_STATUSES.includes(String(value || "").toUpperCase());
}

export function resolveWorkerRunTerminalStatus({ errorCount = 0, claimed = 0, ok = true } = {}) {
  if (!ok || (errorCount > 0 && claimed === 0)) {
    return WORKER_RUN_STATUSES.FAILED;
  }
  if (errorCount > 0) {
    return WORKER_RUN_STATUSES.PARTIAL_FAILURE;
  }
  return WORKER_RUN_STATUSES.COMPLETED;
}
