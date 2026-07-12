import { isFormationV2Enabled } from "../../config/featureFlags.js";
import { createFormationAudit } from "../formationContracts.js";
import {
  appendFormationRuntimeDecisionTrace,
  buildFormationDecisionPath,
  createFormationRuntimeDecisionTrace,
  createFormationRuntimeDecisionTraceRecord,
} from "./formationDecisionTrace.js";
import { FORMATION_RUNTIME_ADAPTER_VERSION } from "./formationRuntimeInventory.js";
import {
  cloneLegacyFormationPayload,
  mapLegacyFormationPayloadToCanonicalRequest,
  mapLegacyFormationPayloadToPolicy,
  resolveLegacyFormationRandomFn,
} from "./legacyFormationPayloadMappers.js";
import {
  adaptFormationResultForLegacyConsumer,
  isLegacyFormationOutputPreserved,
  mapLegacyFormationResultToFormationResult,
} from "./legacyFormationResultMappers.js";

/**
 * @typedef {'team_mlp_pairing'|'daily_play'|'competition_engine'|'mixed_pairing'|'manual_pairing'} FormationRuntimeConsumer
 */

/**
 * @typedef {Object} CanonicalFormationBridgeResult
 * @property {boolean} usedCanonical
 * @property {'legacy'|'canonical-adapter'} executionPath
 * @property {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} legacyResult
 * @property {import('../formationTypes.js').FormationRequest} [formationRequest]
 * @property {import('../formationTypes.js').FormationResult} [formationResult]
 * @property {import('./formationDecisionTrace.js').FormationRuntimeDecisionTrace} trace
 * @property {import('../formationTypes.js').FormationAudit} [audit]
 * @property {boolean} outputPreserved
 * @property {boolean} randomFnPreserved
 */

/**
 * @param {Record<string, unknown>|undefined|null} explicit
 * @returns {Record<string, unknown>|undefined|null}
 */
export function resolveFormationEnvSource(explicit) {
  if (explicit !== undefined) {
    return explicit;
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env;
  }
  return {};
}

/**
 * CC-05B canonical formation runtime adapter.
 *
 * Flag OFF → 100% legacy executor, no canonical mapping.
 * Flag ON  → build canonical request/trace → legacy executor → canonical result → legacy consumer shape.
 *
 * Does NOT alter pairing algorithms or team assignment logic.
 *
 * @param {Object} input
 * @param {FormationRuntimeConsumer|string} input.consumer
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {import('./formationDecisionTrace.js').FormationRuntimeDecisionTrace} [input.trace]
 * @param {(payload: import('./legacyFormationPayloadMappers.js').LegacyFormationPayload) => import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} input.legacyExecutor
 * @returns {CanonicalFormationBridgeResult}
 */
export function evaluateCanonicalFormation(input) {
  const trace = input.trace || createFormationRuntimeDecisionTrace();
  const envSource = resolveFormationEnvSource(input.envSource);
  const payloadSnapshot = cloneLegacyFormationPayload(input.legacyPayload || {});
  const incomingRandomFn = resolveLegacyFormationRandomFn(payloadSnapshot);

  if (typeof input.legacyExecutor !== "function") {
    const record = createFormationRuntimeDecisionTraceRecord({
      consumer: String(input.consumer || "unknown"),
      usedCanonical: false,
      executionPath: "legacy",
      path: [{ phase: "error", label: "Legacy executor not configured" }],
      metadata: { error: "missing_legacy_executor" },
    });

    return {
      usedCanonical: false,
      executionPath: "legacy",
      legacyResult: { teams: [], waitingPlayerIds: [], warnings: ["Legacy executor not configured"] },
      trace: appendFormationRuntimeDecisionTrace(trace, record),
      outputPreserved: true,
      randomFnPreserved: true,
    };
  }

  if (!isFormationV2Enabled(envSource)) {
    const legacyResult = input.legacyExecutor(payloadSnapshot);
    const record = createFormationRuntimeDecisionTraceRecord({
      consumer: String(input.consumer || "unknown"),
      usedCanonical: false,
      executionPath: "legacy",
      path: [{ phase: "legacy", label: "FORMATION_V2 flag off — direct legacy runtime" }],
      metadata: { flag: "off" },
    });

    return {
      usedCanonical: false,
      executionPath: "legacy",
      legacyResult,
      trace: appendFormationRuntimeDecisionTrace(trace, record),
      outputPreserved: true,
      randomFnPreserved: true,
    };
  }

  const formationRequest = mapLegacyFormationPayloadToCanonicalRequest(payloadSnapshot);
  const policy = mapLegacyFormationPayloadToPolicy(payloadSnapshot);
  formationRequest.policy = policy;

  const legacyResult = input.legacyExecutor(payloadSnapshot);
  const formationResult = mapLegacyFormationResultToFormationResult(legacyResult, formationRequest);
  const adaptedLegacyResult = adaptFormationResultForLegacyConsumer(formationResult, legacyResult);
  const outputPreserved = isLegacyFormationOutputPreserved(legacyResult, adaptedLegacyResult);
  const snapshotRandomFn = resolveLegacyFormationRandomFn(payloadSnapshot);
  const randomFnPreserved = incomingRandomFn === snapshotRandomFn;

  const decisionPath = buildFormationDecisionPath({
    formationRequest,
    formationResult,
  });

  const audit = createFormationAudit({
    engineVersion: FORMATION_RUNTIME_ADAPTER_VERSION,
    strategy: policy.strategy,
    seed: formationRequest.randomSeed ?? payloadSnapshot.randomSeed ?? null,
    constraints: {
      enabled: (formationRequest.constraints || []).filter((item) => item.enabled !== false).length,
      kinds: (formationRequest.constraints || []).map((item) => item.kind),
    },
    scores: formationResult.audit?.scores ?? null,
    courtAllocation: formationResult.audit?.courtAllocation ?? {},
    warnings: formationResult.warnings || [],
  });

  const record = createFormationRuntimeDecisionTraceRecord({
    consumer: String(input.consumer || "unknown"),
    usedCanonical: true,
    executionPath: "canonical-adapter",
    path: decisionPath,
    metadata: {
      strategyId: policy.strategy,
      teamCount: legacyResult.teams?.length || 0,
      waitingCount: legacyResult.waitingPlayerIds?.length || 0,
      randomFnPreserved,
    },
  });

  return {
    usedCanonical: true,
    executionPath: "canonical-adapter",
    legacyResult: outputPreserved ? legacyResult : adaptedLegacyResult,
    formationRequest,
    formationResult,
    trace: appendFormationRuntimeDecisionTrace(trace, record),
    audit,
    outputPreserved,
    randomFnPreserved,
  };
}

/**
 * Convenience wrapper for formation consumers.
 *
 * @param {Object} input
 * @param {FormationRuntimeConsumer|string} input.consumer
 * @param {string} [input.strategyKey]
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {(payload: import('./legacyFormationPayloadMappers.js').LegacyFormationPayload) => import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} input.legacyExecutor
 * @returns {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult}
 */
export function runLegacyFormationWithCanonicalAdapter(input) {
  const bridge = evaluateCanonicalFormation({
    consumer: input.consumer,
    legacyPayload: {
      ...input.legacyPayload,
      strategyKey: input.strategyKey || input.legacyPayload?.strategyKey,
      legacyStrategyKey: input.strategyKey || input.legacyPayload?.legacyStrategyKey,
    },
    envSource: input.envSource,
    legacyExecutor: input.legacyExecutor,
  });

  return bridge.legacyResult;
}
