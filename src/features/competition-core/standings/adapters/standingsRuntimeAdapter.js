import { isStandingsV2Enabled } from "../../config/featureFlags.js";
import { calculateCanonicalStandings } from "../calculateStandings.js";
import {
  cloneLegacyStandingsPayload,
  mapLegacyGroupStandingsPayloadToRequest,
  mapLegacyTeamStandingsPayloadToRequest,
  mapStandingsResultToLegacyGroupRows,
  mapStandingsResultToLegacyTeamRows,
} from "../legacyStandingsMapping.js";
import { STANDINGS_SCOPE } from "../standingsConstants.js";
import {
  appendStandingsRuntimeDecisionTrace,
  buildCompleteStandingsTraceRecord,
  createStandingsRuntimeDecisionTrace,
  createStandingsRuntimeDecisionTraceRecord,
} from "./standingsDecisionTrace.js";
import { STANDINGS_RUNTIME_ADAPTER_VERSION } from "./standingsRuntimeInventory.js";
import {
  buildStandingsShadowComparison,
  createMemoizedStandingsExecutor,
} from "./standingsShadowParity.js";

/**
 * @typedef {Object} CanonicalStandingsBridgeResult
 * @property {boolean} usedCanonical
 * @property {'legacy'|'canonical-adapter'|'shadow'} executionPath
 * @property {unknown} legacyResult
 * @property {import('../standingsTypes.js').StandingsResult} [canonicalResult]
 * @property {import('./standingsShadowParity.js').StandingsShadowComparison} [comparison]
 * @property {ReturnType<typeof buildCompleteStandingsTraceRecord>} traceRecord
 * @property {import('./standingsDecisionTrace.js').ReturnType<createStandingsRuntimeDecisionTrace>} trace
 * @property {boolean} outputPreserved
 * @property {string[]} warnings
 */

export function resolveStandingsEnvSource(explicit) {
  if (explicit !== undefined) {
    return explicit;
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env;
  }
  return {};
}

/**
 * @param {Object} input
 * @param {string} input.consumer
 * @param {Record<string, unknown>} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {() => unknown} input.legacyExecutor
 * @param {'shadow'|'legacy-primary'|'canonical-primary'} [input.executionMode]
 * @param {boolean} [input.groupComplete]
 */
export function evaluateCanonicalStandingsRuntime(input) {
  const trace = input.trace || createStandingsRuntimeDecisionTrace();
  const envSource = resolveStandingsEnvSource(input.envSource);
  const payloadSnapshot = cloneLegacyStandingsPayload(input.legacyPayload || {});
  const executionMode = input.executionMode || "shadow";

  if (typeof input.legacyExecutor !== "function") {
    const record = createStandingsRuntimeDecisionTraceRecord({
      consumer: input.consumer,
      usedCanonical: false,
      executionPath: "legacy",
      metadata: { error: "missing_legacy_executor" },
    });
    return {
      usedCanonical: false,
      executionPath: "legacy",
      legacyResult: { ok: false, errors: ["Legacy executor not configured"] },
      traceRecord: buildCompleteStandingsTraceRecord(null, record),
      trace: appendStandingsRuntimeDecisionTrace(trace, record),
      outputPreserved: true,
      warnings: ["Legacy executor not configured"],
    };
  }

  if (!isStandingsV2Enabled(envSource)) {
    const legacyResult = input.legacyExecutor();
    const record = createStandingsRuntimeDecisionTraceRecord({
      consumer: input.consumer,
      usedCanonical: false,
      executionPath: "legacy",
      path: [{ phase: "legacy", label: "STANDINGS_V2 flag off — direct legacy runtime" }],
      metadata: { flag: "off" },
    });
    return {
      usedCanonical: false,
      executionPath: "legacy",
      legacyResult,
      traceRecord: buildCompleteStandingsTraceRecord(null, record),
      trace: appendStandingsRuntimeDecisionTrace(trace, record),
      outputPreserved: true,
      warnings: [],
    };
  }

  const memo = createMemoizedStandingsExecutor(() => input.legacyExecutor());
  const primary = memo.run();
  const warnings = [];

  let mapped;
  if (payloadSnapshot.teams || payloadSnapshot.matchups || input.consumer === "team_tournament") {
    mapped = mapLegacyTeamStandingsPayloadToRequest(payloadSnapshot);
  } else {
    mapped = mapLegacyGroupStandingsPayloadToRequest(payloadSnapshot);
  }

  const request = mapped.request || mapped;
  warnings.push(...(mapped.warnings || []));

  const canonicalResult = calculateCanonicalStandings(request, {
    groupComplete: input.groupComplete !== false,
    // Legacy runtime adapter explicitly opts into qualification side-path.
    applyQualification: true,
  });
  warnings.push(...(canonicalResult.warnings || []));

  const legacyResultPayload = primary.result;
  const legacyRows = extractLegacyStandingsRows(legacyResultPayload, payloadSnapshot);

  const canonicalRows =
    request.scope === STANDINGS_SCOPE.TEAM_TOURNAMENT
      ? mapStandingsResultToLegacyTeamRows(canonicalResult)
      : mapStandingsResultToLegacyGroupRows(canonicalResult);

  const comparison = buildStandingsShadowComparison({
    legacyRows: Array.isArray(legacyRows) ? legacyRows : [],
    canonicalRows,
    unsupportedLegacyBehavior: warnings.filter((item) => item.includes("Legacy")),
    contextMissing: !request.entries?.length,
    legacyInstabilityDetected: !primary.sideEffectSafe,
    mismatches: comparisonWarningsToMismatches(warnings, comparisonRows(legacyRows, canonicalRows)),
  });

  const runtimeRecord = createStandingsRuntimeDecisionTraceRecord({
    consumer: input.consumer,
    usedCanonical: true,
    executionPath: executionMode === "canonical-primary" ? "canonical-adapter" : "shadow",
    scoringRuleId: request.configuration.scoringRule.scoringRuleId,
    scoringRuleVersion: request.configuration.scoringRule.scoringRuleVersion,
    path: [
      { phase: "map", label: "Legacy payload mapped to StandingsRequest" },
      { phase: "calculate", label: "Canonical standings calculated" },
      { phase: "compare", label: "Shadow parity comparison built" },
    ],
    metadata: {
      adapterVersion: STANDINGS_RUNTIME_ADAPTER_VERSION,
      comparisonOk: comparison.ok,
      duplicateDecision: primary.duplicateDecision === true,
    },
  });

  const traceRecord = buildCompleteStandingsTraceRecord(canonicalResult.decisionTrace, runtimeRecord);

  const legacyPrimary =
    executionMode === "canonical-primary"
      ? {
          standing: canonicalRows,
          rows: canonicalRows,
          standings: canonicalRows,
          ok: canonicalResult.ok,
          decisionTrace: traceRecord,
        }
      : legacyResultPayload;

  return {
    usedCanonical: true,
    executionPath: executionMode === "canonical-primary" ? "canonical-adapter" : "shadow",
    legacyResult: legacyPrimary,
    canonicalResult,
    comparison,
    traceRecord,
    trace: appendStandingsRuntimeDecisionTrace(trace, runtimeRecord),
    outputPreserved: executionMode !== "canonical-primary",
    warnings,
  };
}

/**
 * @param {Object} input
 */
export function runStandingsShadowComparison(input) {
  return evaluateCanonicalStandingsRuntime({
    ...input,
    executionMode: "shadow",
  });
}

/**
 * @param {unknown[]} legacyRows
 * @param {unknown[]} canonicalRows
 */
function comparisonRows(legacyRows, canonicalRows) {
  return { legacyCount: legacyRows.length, canonicalCount: canonicalRows.length };
}

/**
 * @param {string[]} warnings
 * @param {{ legacyCount: number, canonicalCount: number }} counts
 */
function comparisonWarningsToMismatches(warnings, counts) {
  const mismatches = [];
  if (counts.legacyCount !== counts.canonicalCount) {
    mismatches.push("row_count_mismatch");
  }
  warnings.forEach((warning) => {
    if (warning.includes("mismatch")) {
      mismatches.push(warning);
    }
  });
  return mismatches;
}

export { runStandingsShadowComparison as compareStandingsShadowParity };

/**
 * @param {unknown} legacyResult
 * @param {Record<string, unknown>} payloadSnapshot
 */
function extractLegacyStandingsRows(legacyResult, payloadSnapshot) {
  if (Array.isArray(legacyResult)) {
    return legacyResult;
  }
  if (legacyResult && typeof legacyResult === "object") {
    const obj = /** @type {Record<string, unknown>} */ (legacyResult);
    if (Array.isArray(obj.standing)) {
      return obj.standing;
    }
    if (Array.isArray(obj.standings)) {
      return obj.standings;
    }
    if (Array.isArray(obj.rows)) {
      return obj.rows;
    }
    if (Array.isArray(obj.rankings)) {
      return obj.rankings;
    }
  }
  if (payloadSnapshot.teams || payloadSnapshot.matchups) {
    return [];
  }
  return [];
}
