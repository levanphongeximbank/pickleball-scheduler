/**
 * Reporting presentation source-state contract (REPORTING-04A).
 *
 * Typed UI-facing states. Live failure must never map to MOCK.
 * Empty must never map to ERROR. Unavailable must never map to EMPTY.
 * Unknown input fail-closes to UNAVAILABLE or ERROR (never success).
 */

import { REPORT_AVAILABILITY } from "../constants/availability.js";
import { REPORT_PROVENANCE } from "../constants/provenance.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createProvenanceMetadata,
  assertNoSilentLiveToMockFallback,
} from "../contracts/provenance.js";
import {
  deepFreeze,
  failContract,
  isPlainObject,
  optionalIsoInstant,
  optionalNonEmptyString,
} from "../contracts/shared.js";

export const REPORTING_PRESENTATION_SOURCE_STATE = Object.freeze({
  LIVE: "LIVE",
  MOCK: "MOCK",
  PREVIEW: "PREVIEW",
  STALE: "STALE",
  UNAVAILABLE: "UNAVAILABLE",
  LOADING: "LOADING",
  EMPTY: "EMPTY",
  ERROR: "ERROR",
  MIXED: "MIXED",
  PARTIAL: "PARTIAL",
});

export const REPORTING_PRESENTATION_SOURCE_STATE_VALUES = Object.freeze(
  Object.values(REPORTING_PRESENTATION_SOURCE_STATE)
);

export const REPORTING_PRESENTATION_SOURCE_STATE_LABELS = Object.freeze({
  [REPORTING_PRESENTATION_SOURCE_STATE.LIVE]: "Dữ liệu trực tiếp",
  [REPORTING_PRESENTATION_SOURCE_STATE.MOCK]: "Dữ liệu demo",
  [REPORTING_PRESENTATION_SOURCE_STATE.PREVIEW]: "Bản xem trước",
  [REPORTING_PRESENTATION_SOURCE_STATE.STALE]: "Dữ liệu cũ",
  [REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE]: "Nguồn chưa khả dụng",
  [REPORTING_PRESENTATION_SOURCE_STATE.LOADING]: "Đang tải",
  [REPORTING_PRESENTATION_SOURCE_STATE.EMPTY]: "Chưa có dữ liệu",
  [REPORTING_PRESENTATION_SOURCE_STATE.ERROR]: "Lỗi tải dữ liệu",
  [REPORTING_PRESENTATION_SOURCE_STATE.MIXED]: "Nguồn hỗn hợp",
  [REPORTING_PRESENTATION_SOURCE_STATE.PARTIAL]: "Dữ liệu một phần",
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportingPresentationSourceState(value) {
  return REPORTING_PRESENTATION_SOURCE_STATE_VALUES.includes(String(value || ""));
}

/**
 * @param {string} state
 * @returns {string}
 */
export function getReportingPresentationSourceStateLabel(state) {
  const key = String(state || "");
  return (
    REPORTING_PRESENTATION_SOURCE_STATE_LABELS[key] ||
    REPORTING_PRESENTATION_SOURCE_STATE_LABELS[
      REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE
    ]
  );
}

/**
 * @param {unknown} input
 */
export function createReportingPresentationSourceState(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      "Presentation source state must be a plain object",
      { field: "sourceState" }
    );
  }

  const state = String(input.state || "").trim();
  if (!isReportingPresentationSourceState(state)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported presentation source state: ${state || "(empty)"}`,
      { field: "state" }
    );
  }

  if (state === REPORTING_PRESENTATION_SOURCE_STATE.STALE) {
    const hasFreshness =
      Boolean(optionalIsoInstant(input.observedAt, "observedAt")) ||
      Boolean(optionalIsoInstant(input.lastSuccessfulRefreshAt, "lastSuccessfulRefreshAt")) ||
      Boolean(optionalNonEmptyString(input.reason, "reason"));
    if (!hasFreshness) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_CONTRACT,
        "STALE presentation state requires freshness timestamp or reason",
        { field: "state" }
      );
    }
  }

  if (
    state === REPORTING_PRESENTATION_SOURCE_STATE.MOCK ||
    state === REPORTING_PRESENTATION_SOURCE_STATE.PREVIEW
  ) {
    if (input.explicitDemoOrPreview !== true) {
      failContract(
        REPORTING_ERROR_CODE.SILENT_FALLBACK_REJECTED,
        "MOCK/PREVIEW presentation requires explicitDemoOrPreview=true",
        { field: "explicitDemoOrPreview", state }
      );
    }
  }

  if (input.liveFailed === true) {
    assertNoSilentLiveToMockFallback({
      liveFailed: true,
      resultProvenance:
        state === REPORTING_PRESENTATION_SOURCE_STATE.MOCK ||
        state === REPORTING_PRESENTATION_SOURCE_STATE.PREVIEW ||
        state === REPORTING_PRESENTATION_SOURCE_STATE.LIVE
          ? state
          : REPORT_PROVENANCE.UNAVAILABLE,
    });
  }

  return deepFreeze({
    state,
    label: getReportingPresentationSourceStateLabel(state),
    reason: optionalNonEmptyString(input.reason, "reason"),
    observedAt: optionalIsoInstant(input.observedAt, "observedAt"),
    lastSuccessfulRefreshAt: optionalIsoInstant(
      input.lastSuccessfulRefreshAt,
      "lastSuccessfulRefreshAt"
    ),
    explicitDemoOrPreview: input.explicitDemoOrPreview === true,
    liveFailed: input.liveFailed === true,
    fieldStates: isPlainObject(input.fieldStates)
      ? deepFreeze({ ...input.fieldStates })
      : Object.freeze({}),
  });
}

/**
 * Map domain provenance → presentation state.
 * Does not invent MOCK without explicit demo/preview request.
 *
 * @param {unknown} provenance
 * @param {{
 *   loading?: boolean,
 *   empty?: boolean,
 *   error?: boolean,
 *   liveFailed?: boolean,
 *   explicitDemoOrPreview?: boolean,
 *   partial?: boolean,
 * }} [opts]
 */
export function mapProvenanceToPresentationSourceState(provenance, opts = {}) {
  if (opts.loading === true) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.LOADING,
      observedAt: isPlainObject(provenance) ? provenance.observedAt : null,
    });
  }

  if (opts.error === true || opts.liveFailed === true) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.ERROR,
      reason:
        (isPlainObject(provenance) && provenance.fallbackReason) ||
        "live_source_failed",
      observedAt: isPlainObject(provenance) ? provenance.observedAt : null,
      liveFailed: true,
    });
  }

  if (opts.empty === true) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.EMPTY,
      reason:
        (isPlainObject(provenance) && provenance.fallbackReason) ||
        "no_live_rows",
      observedAt: isPlainObject(provenance) ? provenance.observedAt : null,
    });
  }

  if (!isPlainObject(provenance) || !provenance.state) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
      reason: "provenance_missing",
    });
  }

  const p = String(provenance.state);

  if (p === REPORT_PROVENANCE.MOCK) {
    if (opts.explicitDemoOrPreview !== true) {
      return createReportingPresentationSourceState({
        state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
        reason: "mock_without_explicit_demo_request",
        observedAt: provenance.observedAt || null,
      });
    }
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.MOCK,
      reason: provenance.fallbackReason || "explicit_demo",
      observedAt: provenance.observedAt || null,
      explicitDemoOrPreview: true,
    });
  }

  if (p === REPORT_PROVENANCE.PREVIEW) {
    if (opts.explicitDemoOrPreview !== true) {
      return createReportingPresentationSourceState({
        state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
        reason: "preview_without_explicit_request",
        observedAt: provenance.observedAt || null,
      });
    }
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.PREVIEW,
      reason: provenance.fallbackReason || "explicit_preview",
      observedAt: provenance.observedAt || null,
      explicitDemoOrPreview: true,
    });
  }

  if (p === REPORT_PROVENANCE.STALE) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.STALE,
      reason: provenance.fallbackReason || "stale_source",
      observedAt: provenance.observedAt || null,
      lastSuccessfulRefreshAt: provenance.lastSuccessfulRefreshAt || null,
    });
  }

  if (p === REPORT_PROVENANCE.UNAVAILABLE) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
      reason: provenance.fallbackReason || "source_unavailable",
      observedAt: provenance.observedAt || null,
    });
  }

  if (p === REPORT_PROVENANCE.MIXED) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.MIXED,
      reason: provenance.fallbackReason || "mixed_component_sources",
      observedAt: provenance.observedAt || null,
    });
  }

  if (p === REPORT_PROVENANCE.LIVE) {
    if (opts.partial === true) {
      return createReportingPresentationSourceState({
        state: REPORTING_PRESENTATION_SOURCE_STATE.PARTIAL,
        reason: provenance.fallbackReason || "partial_live_fields",
        observedAt: provenance.observedAt || null,
        fieldStates: opts.fieldStates || {},
      });
    }
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.LIVE,
      observedAt: provenance.observedAt || null,
      lastSuccessfulRefreshAt: provenance.lastSuccessfulRefreshAt || null,
    });
  }

  return createReportingPresentationSourceState({
    state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
    reason: `unknown_provenance:${p}`,
  });
}

/**
 * Map report availability → presentation state (fail-closed).
 *
 * @param {unknown} availability
 * @param {{ empty?: boolean, loading?: boolean, error?: boolean }} [opts]
 */
export function mapAvailabilityToPresentationSourceState(availability, opts = {}) {
  if (opts.loading === true) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.LOADING,
    });
  }
  if (opts.error === true) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.ERROR,
      reason: "availability_error",
      liveFailed: true,
    });
  }
  if (opts.empty === true) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.EMPTY,
      reason: "availability_empty",
    });
  }

  const a = String(availability || "");
  if (a === REPORT_AVAILABILITY.AVAILABLE) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.LIVE,
    });
  }
  if (a === REPORT_AVAILABILITY.STALE) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.STALE,
      reason: "availability_stale",
    });
  }
  if (a === REPORT_AVAILABILITY.PARTIAL) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.PARTIAL,
      reason: "availability_partial",
    });
  }
  if (a === REPORT_AVAILABILITY.MIXED) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.MIXED,
      reason: "availability_mixed",
    });
  }
  if (
    a === REPORT_AVAILABILITY.SOURCE_FAILED ||
    a === REPORT_AVAILABILITY.AUTHORIZATION_DENIED
  ) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.ERROR,
      reason: a.toLowerCase(),
      liveFailed: a === REPORT_AVAILABILITY.SOURCE_FAILED,
    });
  }
  if (
    a === REPORT_AVAILABILITY.UNAVAILABLE ||
    a === REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED ||
    a.startsWith("INVALID_")
  ) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
      reason: a.toLowerCase() || "availability_unavailable",
    });
  }

  return createReportingPresentationSourceState({
    state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
    reason: `unknown_availability:${a || "empty"}`,
  });
}

/**
 * Resolve dashboard payload presentation state (REPORTING-04B helper).
 *
 * @param {{
 *   loading?: boolean,
 *   errorMessage?: string|null,
 *   liveFailed?: boolean,
 *   isEmpty?: boolean,
 *   mode?: 'live'|'demo'|'preview',
 *   payload?: object|null,
 *   observedAt?: string|null,
 * }} input
 */
export function resolveDashboardPresentationSourceState(input = {}) {
  if (input.loading === true) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.LOADING,
      observedAt: input.observedAt || null,
    });
  }

  if (input.errorMessage || input.liveFailed === true) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.ERROR,
      reason: input.errorMessage || "dashboard_live_failed",
      observedAt: input.observedAt || null,
      liveFailed: true,
    });
  }

  const mode = String(input.mode || "live");
  if (mode === "demo" || mode === "preview") {
    const state =
      mode === "preview"
        ? REPORTING_PRESENTATION_SOURCE_STATE.PREVIEW
        : REPORTING_PRESENTATION_SOURCE_STATE.MOCK;
    return createReportingPresentationSourceState({
      state,
      reason: `explicit_${mode}_mode`,
      observedAt: input.observedAt || null,
      explicitDemoOrPreview: true,
    });
  }

  if (input.isEmpty === true) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.EMPTY,
      reason: "dashboard_no_live_rows",
      observedAt: input.observedAt || null,
    });
  }

  const payload = input.payload;
  if (!isPlainObject(payload)) {
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
      reason: "dashboard_payload_missing",
      observedAt: input.observedAt || null,
    });
  }

  if (payload.isMock === true) {
    // Mock without explicit mode is fail-closed (should not happen after 04B).
    return createReportingPresentationSourceState({
      state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
      reason: "unexpected_mock_without_explicit_mode",
      observedAt: input.observedAt || null,
    });
  }

  const fieldStates = isPlainObject(payload.fieldStates) ? payload.fieldStates : {};
  const hasPartial = Object.values(fieldStates).some(
    (v) =>
      v === REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE ||
      v === REPORTING_PRESENTATION_SOURCE_STATE.PARTIAL
  );

  const provenance =
    payload.provenance ||
    createProvenanceMetadata({
      state: REPORT_PROVENANCE.LIVE,
      observedAt: input.observedAt || null,
    });

  return mapProvenanceToPresentationSourceState(provenance, {
    partial: hasPartial,
    fieldStates,
  });
}
