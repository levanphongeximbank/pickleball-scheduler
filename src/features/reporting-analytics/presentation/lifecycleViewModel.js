/**
 * Execution / export lifecycle presentation view-models (REPORTING-04D).
 */

import {
  REPORT_EXECUTION_STATUS,
  REPORT_EXPORT_JOB_STATUS,
  isAllowedLifecycleTransition,
  REPORT_EXECUTION_STATUS_TRANSITIONS,
  REPORT_EXPORT_JOB_STATUS_TRANSITIONS,
} from "../lifecycle/statuses.js";
import { deepFreeze, isPlainObject, optionalNonEmptyString } from "../contracts/shared.js";
import { REPORTING_PRESENTATION_SOURCE_STATE } from "./sourceState.js";

const EXECUTION_LABELS = Object.freeze({
  [REPORT_EXECUTION_STATUS.PENDING]: "Đang chờ chạy báo cáo",
  [REPORT_EXECUTION_STATUS.RUNNING]: "Đang chạy báo cáo",
  [REPORT_EXECUTION_STATUS.SUCCEEDED]: "Chạy báo cáo thành công",
  [REPORT_EXECUTION_STATUS.FAILED]: "Chạy báo cáo thất bại",
  [REPORT_EXECUTION_STATUS.UNAVAILABLE]: "Chạy báo cáo chưa khả dụng",
});

const EXPORT_LABELS = Object.freeze({
  [REPORT_EXPORT_JOB_STATUS.PENDING]: "Đang chờ xuất",
  [REPORT_EXPORT_JOB_STATUS.RUNNING]: "Đang xuất",
  [REPORT_EXPORT_JOB_STATUS.SUCCEEDED]: "Xuất thành công",
  [REPORT_EXPORT_JOB_STATUS.FAILED]: "Xuất thất bại",
  [REPORT_EXPORT_JOB_STATUS.UNAVAILABLE]: "Xuất chưa khả dụng",
});

/**
 * @param {unknown} reference
 * @returns {boolean}
 */
export function isValidExportOutputReference(reference) {
  if (typeof reference === "string") {
    const value = reference.trim();
    if (!value) return false;
    if (value.startsWith("fake:") || value.startsWith("mock:")) return false;
    return true;
  }
  if (!isPlainObject(reference)) return false;
  const uri = optionalNonEmptyString(reference.uri || reference.url || reference.artifactUri, "uri");
  const id = optionalNonEmptyString(reference.artifactId || reference.exportRecordId, "id");
  if (uri && (uri.startsWith("fake:") || uri.startsWith("mock:"))) return false;
  return Boolean(uri || id);
}

/**
 * @param {unknown} input
 */
export function createExecutionLifecycleViewModel(input = {}) {
  const status = String(input.status || REPORT_EXECUTION_STATUS.UNAVAILABLE);
  const known = Object.values(REPORT_EXECUTION_STATUS).includes(status)
    ? status
    : REPORT_EXECUTION_STATUS.UNAVAILABLE;

  const previousStatus = input.previousStatus
    ? String(input.previousStatus)
    : null;
  let transitionError = null;
  if (previousStatus && previousStatus !== known) {
    if (
      !isAllowedLifecycleTransition(
        previousStatus,
        known,
        REPORT_EXECUTION_STATUS_TRANSITIONS
      )
    ) {
      transitionError = `invalid_transition:${previousStatus}->${known}`;
    }
  }

  const isTerminal =
    known === REPORT_EXECUTION_STATUS.SUCCEEDED ||
    known === REPORT_EXECUTION_STATUS.FAILED ||
    known === REPORT_EXECUTION_STATUS.UNAVAILABLE;

  const showSuccess = known === REPORT_EXECUTION_STATUS.SUCCEEDED && !transitionError;

  return deepFreeze({
    status: transitionError ? REPORT_EXECUTION_STATUS.FAILED : known,
    label: transitionError
      ? "Chuyển trạng thái chạy báo cáo không hợp lệ"
      : EXECUTION_LABELS[known] || EXECUTION_LABELS[REPORT_EXECUTION_STATUS.UNAVAILABLE],
    isTerminal,
    showSuccess,
    canRetry:
      known === REPORT_EXECUTION_STATUS.FAILED ||
      known === REPORT_EXECUTION_STATUS.UNAVAILABLE,
    transitionError,
    executionId: optionalNonEmptyString(input.executionId, "executionId"),
    errorMessage: optionalNonEmptyString(input.errorMessage, "errorMessage"),
    sourceState:
      known === REPORT_EXECUTION_STATUS.UNAVAILABLE
        ? REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE
        : known === REPORT_EXECUTION_STATUS.FAILED
          ? REPORTING_PRESENTATION_SOURCE_STATE.ERROR
          : known === REPORT_EXECUTION_STATUS.SUCCEEDED
            ? REPORTING_PRESENTATION_SOURCE_STATE.LIVE
            : REPORTING_PRESENTATION_SOURCE_STATE.LOADING,
    // Clear prior result identity when a new run starts.
    resultToken: optionalNonEmptyString(input.resultToken, "resultToken"),
  });
}

/**
 * @param {unknown} input
 */
export function createExportLifecycleViewModel(input = {}) {
  const status = String(input.status || REPORT_EXPORT_JOB_STATUS.UNAVAILABLE);
  const known = Object.values(REPORT_EXPORT_JOB_STATUS).includes(status)
    ? status
    : REPORT_EXPORT_JOB_STATUS.UNAVAILABLE;

  const previousStatus = input.previousStatus
    ? String(input.previousStatus)
    : null;
  let transitionError = null;
  if (previousStatus && previousStatus !== known) {
    if (
      !isAllowedLifecycleTransition(
        previousStatus,
        known,
        REPORT_EXPORT_JOB_STATUS_TRANSITIONS
      )
    ) {
      transitionError = `invalid_transition:${previousStatus}->${known}`;
    }
  }

  const outputReference = input.outputReference ?? input.artifact ?? null;
  const hasValidOutput = isValidExportOutputReference(outputReference);
  const showSuccess =
    known === REPORT_EXPORT_JOB_STATUS.SUCCEEDED &&
    hasValidOutput &&
    !transitionError;

  return deepFreeze({
    status: transitionError ? REPORT_EXPORT_JOB_STATUS.FAILED : known,
    label: transitionError
      ? "Chuyển trạng thái xuất không hợp lệ"
      : !hasValidOutput && known === REPORT_EXPORT_JOB_STATUS.SUCCEEDED
        ? "Xuất thiếu tham chiếu kết quả hợp lệ"
        : EXPORT_LABELS[known] || EXPORT_LABELS[REPORT_EXPORT_JOB_STATUS.UNAVAILABLE],
    isTerminal:
      known === REPORT_EXPORT_JOB_STATUS.SUCCEEDED ||
      known === REPORT_EXPORT_JOB_STATUS.FAILED ||
      known === REPORT_EXPORT_JOB_STATUS.UNAVAILABLE,
    showSuccess,
    canRetry:
      known === REPORT_EXPORT_JOB_STATUS.FAILED ||
      known === REPORT_EXPORT_JOB_STATUS.UNAVAILABLE,
    transitionError,
    exportJobId: optionalNonEmptyString(input.exportJobId, "exportJobId"),
    errorMessage: optionalNonEmptyString(input.errorMessage, "errorMessage"),
    outputReference: showSuccess ? outputReference : null,
    outputHref:
      showSuccess && isPlainObject(outputReference)
        ? optionalNonEmptyString(
            outputReference.uri || outputReference.url || outputReference.artifactUri,
            "outputHref"
          )
        : showSuccess && typeof outputReference === "string"
          ? outputReference
          : null,
    sourceState:
      known === REPORT_EXPORT_JOB_STATUS.UNAVAILABLE
        ? REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE
        : known === REPORT_EXPORT_JOB_STATUS.FAILED ||
            (known === REPORT_EXPORT_JOB_STATUS.SUCCEEDED && !hasValidOutput)
          ? REPORTING_PRESENTATION_SOURCE_STATE.ERROR
          : known === REPORT_EXPORT_JOB_STATUS.SUCCEEDED
            ? REPORTING_PRESENTATION_SOURCE_STATE.LIVE
            : REPORTING_PRESENTATION_SOURCE_STATE.LOADING,
  });
}
