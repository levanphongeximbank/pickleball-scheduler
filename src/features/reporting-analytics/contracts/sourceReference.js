/**
 * Typed data source / projection reference (REPORTING-01).
 * Does not execute analytical queries.
 */

import {
  REPORT_SOURCE_KIND,
  isReportSourceKind,
} from "../constants/sourceKinds.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isPlainObject,
  optionalNonEmptyString,
  requireOpaqueId,
} from "./shared.js";

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   kind: string,
 *   sourceId: string,
 *   projectionId: string|null,
 *   label: string|null,
 *   configured: boolean,
 * }>}
 */
export function createReportSourceReference(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_SOURCE_REFERENCE,
      "Source reference must be a plain object",
      { field: "source" }
    );
  }
  const kind = String(input.kind || "").trim();
  if (!isReportSourceKind(kind)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_SOURCE_REFERENCE,
      `Unsupported source kind: ${kind || "(empty)"}`,
      { field: "kind", value: kind }
    );
  }

  const configured =
    input.configured === undefined ? kind !== REPORT_SOURCE_KIND.UNAVAILABLE : Boolean(input.configured);

  if (kind === REPORT_SOURCE_KIND.UNAVAILABLE) {
    return deepFreeze({
      kind,
      sourceId: requireOpaqueId(input.sourceId || "unavailable", "sourceId"),
      projectionId: optionalNonEmptyString(input.projectionId, "projectionId"),
      label: optionalNonEmptyString(input.label, "label"),
      configured: false,
    });
  }

  if (!configured) {
    return deepFreeze({
      kind,
      sourceId: requireOpaqueId(input.sourceId, "sourceId"),
      projectionId: optionalNonEmptyString(input.projectionId, "projectionId"),
      label: optionalNonEmptyString(input.label, "label"),
      configured: false,
    });
  }

  if (kind === REPORT_SOURCE_KIND.INTELLIGENCE_PROJECTION) {
    const projectionId = optionalNonEmptyString(input.projectionId, "projectionId");
    if (!projectionId) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_SOURCE_REFERENCE,
        "INTELLIGENCE_PROJECTION requires projectionId",
        { field: "projectionId" }
      );
    }
    return deepFreeze({
      kind,
      sourceId: requireOpaqueId(input.sourceId, "sourceId"),
      projectionId,
      label: optionalNonEmptyString(input.label, "label"),
      configured: true,
    });
  }

  return deepFreeze({
    kind,
    sourceId: requireOpaqueId(input.sourceId, "sourceId"),
    projectionId: optionalNonEmptyString(input.projectionId, "projectionId"),
    label: optionalNonEmptyString(input.label, "label"),
    configured: true,
  });
}

/**
 * Reporting-side port reference for an I&A public projection (no deep import).
 * @param {unknown} input
 */
export function createIntelligenceProjectionReference(input) {
  return createReportSourceReference({
    ...(isPlainObject(input) ? input : {}),
    kind: REPORT_SOURCE_KIND.INTELLIGENCE_PROJECTION,
  });
}

/**
 * Reporting-side reference to Statistics-owned business truth (consume only).
 * @param {unknown} input
 */
export function createStatisticsSourceReference(input) {
  return createReportSourceReference({
    ...(isPlainObject(input) ? input : {}),
    kind: REPORT_SOURCE_KIND.STATISTICS,
  });
}

/**
 * Reference to legacy dashboard-analytics adapter surface.
 * @param {unknown} input
 */
export function createDashboardAdapterSourceReference(input) {
  return createReportSourceReference({
    ...(isPlainObject(input) ? input : {}),
    kind: REPORT_SOURCE_KIND.DASHBOARD_ADAPTER,
  });
}
