/**
 * Execution / export lifecycle status allow-lists (REPORTING-02).
 */

export const REPORT_EXECUTION_STATUS = Object.freeze({
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  UNAVAILABLE: "UNAVAILABLE",
});

export const REPORT_EXECUTION_STATUS_VALUES = Object.freeze(
  Object.values(REPORT_EXECUTION_STATUS)
);

export const REPORT_EXPORT_JOB_STATUS = Object.freeze({
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  UNAVAILABLE: "UNAVAILABLE",
});

export const REPORT_EXPORT_JOB_STATUS_VALUES = Object.freeze(
  Object.values(REPORT_EXPORT_JOB_STATUS)
);

/** @type {Readonly<Record<string, ReadonlyArray<string>>>} */
export const REPORT_EXECUTION_STATUS_TRANSITIONS = Object.freeze({
  [REPORT_EXECUTION_STATUS.PENDING]: Object.freeze([
    REPORT_EXECUTION_STATUS.RUNNING,
    REPORT_EXECUTION_STATUS.FAILED,
    REPORT_EXECUTION_STATUS.UNAVAILABLE,
  ]),
  [REPORT_EXECUTION_STATUS.RUNNING]: Object.freeze([
    REPORT_EXECUTION_STATUS.SUCCEEDED,
    REPORT_EXECUTION_STATUS.FAILED,
    REPORT_EXECUTION_STATUS.UNAVAILABLE,
  ]),
  [REPORT_EXECUTION_STATUS.SUCCEEDED]: Object.freeze([]),
  [REPORT_EXECUTION_STATUS.FAILED]: Object.freeze([]),
  [REPORT_EXECUTION_STATUS.UNAVAILABLE]: Object.freeze([]),
});

/** @type {Readonly<Record<string, ReadonlyArray<string>>>} */
export const REPORT_EXPORT_JOB_STATUS_TRANSITIONS = Object.freeze({
  [REPORT_EXPORT_JOB_STATUS.PENDING]: Object.freeze([
    REPORT_EXPORT_JOB_STATUS.RUNNING,
    REPORT_EXPORT_JOB_STATUS.FAILED,
    REPORT_EXPORT_JOB_STATUS.UNAVAILABLE,
  ]),
  [REPORT_EXPORT_JOB_STATUS.RUNNING]: Object.freeze([
    REPORT_EXPORT_JOB_STATUS.SUCCEEDED,
    REPORT_EXPORT_JOB_STATUS.FAILED,
    REPORT_EXPORT_JOB_STATUS.UNAVAILABLE,
  ]),
  [REPORT_EXPORT_JOB_STATUS.SUCCEEDED]: Object.freeze([]),
  [REPORT_EXPORT_JOB_STATUS.FAILED]: Object.freeze([]),
  [REPORT_EXPORT_JOB_STATUS.UNAVAILABLE]: Object.freeze([]),
});

/**
 * @param {string} from
 * @param {string} to
 * @param {Readonly<Record<string, ReadonlyArray<string>>>} graph
 * @returns {boolean}
 */
export function isAllowedLifecycleTransition(from, to, graph) {
  const allowed = graph[String(from || "")];
  if (!allowed) return false;
  return allowed.includes(String(to || ""));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportExecutionStatus(value) {
  return REPORT_EXECUTION_STATUS_VALUES.includes(String(value || ""));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportExportJobStatus(value) {
  return REPORT_EXPORT_JOB_STATUS_VALUES.includes(String(value || ""));
}
