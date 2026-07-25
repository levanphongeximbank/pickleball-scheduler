/**
 * Provenance / freshness metadata contracts (REPORTING-01).
 */

import {
  REPORT_PROVENANCE,
  isReportProvenance,
} from "../constants/provenance.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isPlainObject,
  optionalIsoInstant,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "./shared.js";

/**
 * @param {unknown} input
 */
export function createProvenanceMetadata(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.PROVENANCE_MISMATCH,
      "Provenance metadata must be a plain object",
      { field: "provenance" }
    );
  }
  const state = String(input.state || "").trim();
  if (!isReportProvenance(state)) {
    failContract(
      REPORTING_ERROR_CODE.PROVENANCE_MISMATCH,
      `Unsupported provenance state: ${state || "(empty)"}`,
      { field: "state" }
    );
  }

  const componentSources = Array.isArray(input.componentSources)
    ? Object.freeze(
        input.componentSources.map((c, index) => {
          if (!isPlainObject(c)) {
            failContract(
              REPORTING_ERROR_CODE.PROVENANCE_MISMATCH,
              "componentSources entries must be plain objects",
              { field: "componentSources", index }
            );
          }
          const childState = String(c.state || "").trim();
          if (!isReportProvenance(childState) || childState === REPORT_PROVENANCE.MIXED) {
            failContract(
              REPORTING_ERROR_CODE.PROVENANCE_MISMATCH,
              "MIXED components must use non-MIXED provenance states",
              { field: "componentSources", index, state: childState }
            );
          }
          return deepFreeze({
            sourceKind: requireNonEmptyString(c.sourceKind, "sourceKind"),
            state: childState,
            sourceId: optionalNonEmptyString(c.sourceId, "sourceId"),
            generatedAt: optionalIsoInstant(c.generatedAt, "generatedAt"),
          });
        })
      )
    : Object.freeze([]);

  if (state === REPORT_PROVENANCE.MIXED) {
    if (componentSources.length < 2) {
      failContract(
        REPORTING_ERROR_CODE.PROVENANCE_MISMATCH,
        "MIXED provenance requires at least two componentSources",
        { field: "componentSources" }
      );
    }
    const distinct = new Set(componentSources.map((c) => c.state));
    if (distinct.size < 2) {
      failContract(
        REPORTING_ERROR_CODE.PROVENANCE_MISMATCH,
        "MIXED provenance requires differing component provenance states",
        { field: "componentSources" }
      );
    }
  } else if (componentSources.length > 0) {
    failContract(
      REPORTING_ERROR_CODE.PROVENANCE_MISMATCH,
      "componentSources are only valid for MIXED provenance",
      { field: "componentSources" }
    );
  }

  const warnings = Array.isArray(input.warnings)
    ? Object.freeze(input.warnings.map(String))
    : Object.freeze([]);

  return deepFreeze({
    state,
    sourceKind: optionalNonEmptyString(input.sourceKind, "sourceKind"),
    generatedAt: optionalIsoInstant(input.generatedAt, "generatedAt"),
    observedAt: optionalIsoInstant(input.observedAt, "observedAt"),
    lastSuccessfulRefreshAt: optionalIsoInstant(
      input.lastSuccessfulRefreshAt,
      "lastSuccessfulRefreshAt"
    ),
    fallbackReason: optionalNonEmptyString(input.fallbackReason, "fallbackReason"),
    warnings,
    componentSources,
  });
}

/**
 * Reject silent live→mock success conversion.
 * @param {{ requestedProvenance?: string, liveFailed?: boolean, resultProvenance?: string }} input
 */
export function assertNoSilentLiveToMockFallback(input) {
  const liveFailed = Boolean(input?.liveFailed);
  const resultProvenance = String(input?.resultProvenance || "");
  if (
    liveFailed &&
    (resultProvenance === REPORT_PROVENANCE.MOCK ||
      resultProvenance === REPORT_PROVENANCE.PREVIEW ||
      resultProvenance === REPORT_PROVENANCE.LIVE)
  ) {
    failContract(
      REPORTING_ERROR_CODE.SILENT_FALLBACK_REJECTED,
      "Live source failure must not silently become mock/preview/live success",
      {
        resultProvenance,
        requestedProvenance: input?.requestedProvenance || null,
      }
    );
  }
  return true;
}
