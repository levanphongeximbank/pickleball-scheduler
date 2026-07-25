/**
 * Classify legacy dashboard-analytics payloads for provenance honesty (REPORTING-01).
 *
 * Does not change dashboard UI. Does not treat mock as durable persistence.
 * Live failure must not be rewritten as mock success here — callers must pass
 * liveFailed explicitly when a live path failed.
 */

import { REPORT_PROVENANCE } from "../constants/provenance.js";
import { REPORT_SOURCE_KIND } from "../constants/sourceKinds.js";
import {
  assertNoSilentLiveToMockFallback,
  createProvenanceMetadata,
} from "../contracts/provenance.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";

/**
 * Classify a dashboard payload shape (`isMock` flag from dashboardService / mockDashboardData).
 *
 * @param {unknown} payload
 * @param {{ liveFailed?: boolean, observedAt?: string|null }} [opts]
 */
export function classifyDashboardPayloadProvenance(payload, opts = {}) {
  const liveFailed = Boolean(opts.liveFailed);
  const isMock = Boolean(isPlainObject(payload) && payload.isMock === true);

  if (liveFailed) {
    assertNoSilentLiveToMockFallback({
      liveFailed: true,
      resultProvenance: isMock ? REPORT_PROVENANCE.MOCK : REPORT_PROVENANCE.UNAVAILABLE,
    });
  }

  if (!isPlainObject(payload)) {
    return createProvenanceMetadata({
      state: REPORT_PROVENANCE.UNAVAILABLE,
      sourceKind: REPORT_SOURCE_KIND.DASHBOARD_ADAPTER,
      observedAt: opts.observedAt || null,
      fallbackReason: "dashboard_payload_missing",
      warnings: ["Dashboard payload is not a plain object"],
    });
  }

  if (isMock) {
    return createProvenanceMetadata({
      state: REPORT_PROVENANCE.MOCK,
      sourceKind: REPORT_SOURCE_KIND.DASHBOARD_ADAPTER,
      observedAt: opts.observedAt || null,
      fallbackReason: "mockDashboardData_development_preview_fallback",
      warnings: [
        "mockDashboardData is a development/preview fallback, not durable persistence",
      ],
    });
  }

  return createProvenanceMetadata({
    state: REPORT_PROVENANCE.LIVE,
    sourceKind: REPORT_SOURCE_KIND.DASHBOARD_ADAPTER,
    observedAt: opts.observedAt || null,
  });
}

/**
 * Stable classification marker for mockDashboardData module.
 */
export const MOCK_DASHBOARD_DATA_CLASSIFICATION = Object.freeze({
  modulePath: "src/data/mockDashboardData.js",
  provenance: REPORT_PROVENANCE.MOCK,
  role: "development_preview_fallback",
  isDurablePersistence: false,
  silentLiveFallbackAllowed: false,
});

/**
 * @param {unknown} components - array of provenance metadata / states
 */
export function composeMixedProvenance(components, opts = {}) {
  const list = Array.isArray(components) ? components : [];
  return createProvenanceMetadata({
    state: REPORT_PROVENANCE.MIXED,
    observedAt: opts.observedAt || null,
    warnings: opts.warnings || [],
    componentSources: list.map((c) => {
      if (typeof c === "string") {
        return {
          sourceKind: REPORT_SOURCE_KIND.OPERATIONAL,
          state: c,
        };
      }
      return {
        sourceKind: c.sourceKind || REPORT_SOURCE_KIND.OPERATIONAL,
        state: c.state,
        sourceId: c.sourceId,
        generatedAt: c.generatedAt,
      };
    }),
  });
}

export function createUnavailableIntelligenceProjectionResult(reason) {
  return deepFreeze({
    available: false,
    provenance: createProvenanceMetadata({
      state: REPORT_PROVENANCE.UNAVAILABLE,
      sourceKind: REPORT_SOURCE_KIND.INTELLIGENCE_PROJECTION,
      fallbackReason: reason || "intelligence_projection_not_wired",
      warnings: [
        "Reporting consumes I&A public contracts only; projection runtime is not owned here",
      ],
    }),
  });
}
