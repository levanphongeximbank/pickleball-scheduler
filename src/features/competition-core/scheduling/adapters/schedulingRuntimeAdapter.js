import { isSchedulingV2Enabled } from "../../config/featureFlags.js";
import { calculateCanonicalSchedule } from "../calculateCanonicalSchedule.js";
import {
  cloneLegacySchedulingPayload,
  extractLegacySchedulingRows,
  mapLegacySchedulingPayloadToRequest,
} from "../legacySchedulingMapping.js";
import {
  appendSchedulingRuntimeDecisionTrace,
  buildCompleteSchedulingTraceRecord,
  createSchedulingRuntimeDecisionTrace,
  createSchedulingRuntimeDecisionTraceRecord,
} from "./schedulingDecisionTrace.js";
import { SCHEDULING_RUNTIME_ADAPTER_VERSION } from "./schedulingRuntimeInventory.js";
import {
  buildSchedulingShadowComparison,
  createMemoizedSchedulingExecutor,
} from "./schedulingShadowParity.js";

export function resolveSchedulingEnvSource(explicit) {
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
 */
export function evaluateCanonicalSchedulingRuntime(input) {
  const trace = input.trace || createSchedulingRuntimeDecisionTrace();
  const envSource = resolveSchedulingEnvSource(input.envSource);
  const payloadSnapshot = cloneLegacySchedulingPayload(input.legacyPayload || {});
  const executionMode = input.executionMode || "shadow";

  if (typeof input.legacyExecutor !== "function") {
    const record = createSchedulingRuntimeDecisionTraceRecord({
      consumer: input.consumer,
      usedCanonical: false,
      executionPath: "legacy",
      metadata: { error: "missing_legacy_executor" },
    });
    return {
      usedCanonical: false,
      executionPath: "legacy",
      legacyResult: { ok: false, errors: ["Legacy executor not configured"] },
      traceRecord: buildCompleteSchedulingTraceRecord(null, record),
      trace: appendSchedulingRuntimeDecisionTrace(trace, record),
      outputPreserved: true,
      warnings: ["Legacy executor not configured"],
    };
  }

  if (!isSchedulingV2Enabled(envSource)) {
    const legacyResult = input.legacyExecutor();
    const record = createSchedulingRuntimeDecisionTraceRecord({
      consumer: input.consumer,
      usedCanonical: false,
      executionPath: "legacy",
      path: [{ phase: "legacy", label: "SCHEDULING_V2 flag off — direct legacy runtime" }],
      metadata: { flag: "off" },
    });
    return {
      usedCanonical: false,
      executionPath: "legacy",
      legacyResult,
      traceRecord: buildCompleteSchedulingTraceRecord(null, record),
      trace: appendSchedulingRuntimeDecisionTrace(trace, record),
      outputPreserved: true,
      warnings: [],
    };
  }

  const memo = createMemoizedSchedulingExecutor(() => input.legacyExecutor());
  const primary = memo.run();
  const warnings = [];

  const mapped = mapLegacySchedulingPayloadToRequest(payloadSnapshot);
  warnings.push(...(mapped.warnings || []));

  const canonicalResult = calculateCanonicalSchedule(mapped.request, primary.result);
  warnings.push(...(canonicalResult.warnings || []));

  const legacyRows = extractLegacySchedulingRows(primary.result);
  const canonicalRows = (canonicalResult.matches || []).map((match) => {
    const assignment = (canonicalResult.assignments || []).find(
      (item) => String(item.matchId) === String(match.matchId)
    );
    return {
      id: match.matchId,
      matchId: match.matchId,
      round: match.roundNumber,
      roundNumber: match.roundNumber,
      entryAId: match.entryAId,
      entryBId: match.entryBId,
      courtId: assignment?.courtId,
      courtLabel: assignment?.courtId,
      scheduledStart: assignment?.startTime,
      scheduledAt: assignment?.startTime,
      slot: assignment?.slotId,
      refereeId: assignment?.refereeId,
      status: assignment?.status || match.status,
      manualScheduleLock: assignment?.manualOverride === true,
    };
  });

  const comparison = buildSchedulingShadowComparison({
    legacyRows,
    canonicalRows,
    unsupportedLegacyBehavior: warnings.filter((item) => item.includes("UNMAPPED_LEGACY_FIELD")),
    contextMissing: !mapped.request.matches?.length && !payloadSnapshot.matchups?.length,
    mismatches: comparisonMismatchHints(warnings, legacyRows, canonicalRows),
  });

  const runtimeRecord = createSchedulingRuntimeDecisionTraceRecord({
    consumer: input.consumer,
    usedCanonical: true,
    executionPath: executionMode === "canonical-primary" ? "canonical-adapter" : "shadow",
    path: [
      { phase: "map", label: "Legacy payload mapped to SchedulingRequest" },
      { phase: "validate", label: "Canonical scheduling validation built" },
      { phase: "compare", label: "Shadow parity comparison built" },
    ],
    metadata: {
      adapterVersion: SCHEDULING_RUNTIME_ADAPTER_VERSION,
      comparisonOk: comparison.ok,
      duplicateDecision: primary.duplicateDecision === true,
    },
  });

  const traceRecord = buildCompleteSchedulingTraceRecord(canonicalResult.decisionTrace, runtimeRecord);

  const legacyPrimary =
    executionMode === "canonical-primary"
      ? {
          ...primary.result,
          matches: canonicalResult.matches,
          assignments: canonicalRows,
          ok: canonicalResult.ok,
          decisionTrace: traceRecord,
        }
      : primary.result;

  return {
    usedCanonical: true,
    executionPath: executionMode === "canonical-primary" ? "canonical-adapter" : "shadow",
    legacyResult: legacyPrimary,
    canonicalResult,
    comparison,
    traceRecord,
    trace: appendSchedulingRuntimeDecisionTrace(trace, runtimeRecord),
    outputPreserved: executionMode !== "canonical-primary",
    warnings,
  };
}

export function runSchedulingShadowComparison(input) {
  return evaluateCanonicalSchedulingRuntime({
    ...input,
    executionMode: "shadow",
  });
}

/**
 * @param {string[]} warnings
 * @param {unknown[]} legacyRows
 * @param {unknown[]} canonicalRows
 */
function comparisonMismatchHints(warnings, legacyRows, canonicalRows) {
  const mismatches = [];
  if (legacyRows.length !== canonicalRows.length) {
    mismatches.push("row_count_mismatch");
  }
  warnings.forEach((warning) => {
    if (warning.includes("mismatch")) {
      mismatches.push(warning);
    }
  });
  return mismatches;
}
