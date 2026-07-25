/**
 * Translate database failures into ReportingError contracts (REPORTING-02).
 */

import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { isReportingError, ReportingError } from "../errors/ReportingError.js";

/**
 * @param {unknown} err
 * @param {{ notFoundCode?: string }} [options]
 * @returns {never}
 */
export function translateReportingPersistenceError(err, options = {}) {
  if (isReportingError(err)) throw err;
  const code = String(err?.code || err?.error?.code || "");
  const message = String(err?.message || err?.error?.message || err || "Persistence error");
  const detail = String(err?.detail || err?.error?.detail || "");
  const combined = `${message} ${detail}`;

  if (/VERSION_CONFLICT/i.test(combined)) {
    throw new ReportingError(REPORTING_ERROR_CODE.VERSION_CONFLICT, "Reporting version conflict.");
  }
  if (code === "23505" || /duplicate|unique|conflict/i.test(combined)) {
    const idempotency = /idempotency/i.test(combined);
    throw new ReportingError(
      idempotency
        ? REPORTING_ERROR_CODE.IDEMPOTENCY_CONFLICT
        : REPORTING_ERROR_CODE.DUPLICATE_IDENTITY,
      idempotency ? "Reporting idempotency conflict." : "Reporting persistence conflict."
    );
  }
  if (code === "PGRST116" || /not found/i.test(combined)) {
    throw new ReportingError(
      options.notFoundCode || REPORTING_ERROR_CODE.EXECUTION_NOT_FOUND,
      "Reporting persistence row not found."
    );
  }
  if (code === "42501" || /permission denied|forbidden|scope denied/i.test(combined)) {
    throw new ReportingError(
      /scope/i.test(combined)
        ? REPORTING_ERROR_CODE.FORBIDDEN_SCOPE
        : REPORTING_ERROR_CODE.AUTHORIZATION_DENIED,
      "Reporting persistence authorization denied."
    );
  }
  if (code === "23514" || /check constraint|invalid scope|scope mismatch/i.test(combined)) {
    throw new ReportingError(
      /scope/i.test(combined)
        ? REPORTING_ERROR_CODE.INVALID_SCOPE
        : REPORTING_ERROR_CODE.INVALID_CONTRACT,
      "Reporting persistence contract violation."
    );
  }
  if (/connection|network|unavailable|timeout|econn/i.test(combined)) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.REPOSITORY_UNAVAILABLE,
      "Reporting persistence is unavailable."
    );
  }
  throw new ReportingError(REPORTING_ERROR_CODE.INVALID_CONTRACT, message);
}

/**
 * @template T
 * @param {() => Promise<T>|T} fn
 * @param {{ notFoundCode?: string }} [options]
 * @returns {Promise<T>}
 */
export async function withReportingPersistenceErrors(fn, options = {}) {
  try {
    return await fn();
  } catch (err) {
    translateReportingPersistenceError(err, options);
  }
}
