import { isDrawV2Enabled } from "../../config/featureFlags.js";
import { createDrawAudit } from "../drawContracts.js";
import { deriveDefaultPoliciesFromStrategy } from "../strategy/strategySelection.js";
import {
  appendDrawDecisionTrace,
  buildDrawDecisionPath,
  createDrawDecisionTrace,
  createDrawDecisionTraceRecord,
} from "./drawDecisionTrace.js";
import { DRAW_RUNTIME_ADAPTER_VERSION } from "./drawRuntimeInventory.js";
import {
  cloneLegacyDrawPayload,
  mapLegacyDrawPayloadToDrawRequest,
  mapLegacyDrawPayloadToStrategyDrawRequest,
} from "./legacyDrawPayloadMappers.js";
import {
  adaptDrawResultForLegacyConsumer,
  isLegacyDrawOutputPreserved,
  mapDrawResultToStrategyDrawResult,
  mapLegacyDrawResultToDrawResult,
} from "./legacyDrawResultMappers.js";

/**
 * @typedef {'internal_tournament'|'official_open'|'official_ai_balance'|'team_group'|'competition_engine'} DrawRuntimeConsumer
 */

/**
 * @typedef {Object} CanonicalDrawBridgeResult
 * @property {boolean} usedCanonical
 * @property {'legacy'|'canonical-adapter'} executionPath
 * @property {import('./legacyDrawResultMappers.js').LegacyGroupDrawResult} legacyResult
 * @property {import('../drawTypes.js').DrawRequest} [drawRequest]
 * @property {import('../drawTypes.js').DrawResult} [drawResult]
 * @property {import('../strategy/strategyTypes.js').StrategyDrawRequest} [strategyDrawRequest]
 * @property {import('../strategy/strategyTypes.js').StrategyDrawResult} [strategyDrawResult]
 * @property {import('./drawDecisionTrace.js').DrawDecisionTrace} trace
 * @property {import('../drawTypes.js').DrawAudit} [audit]
 * @property {boolean} outputPreserved
 */

/**
 * Resolve env source from explicit override or Vite import.meta.env when available.
 *
 * @param {Record<string, unknown>|undefined|null} explicit
 * @returns {Record<string, unknown>|undefined|null}
 */
export function resolveDrawEnvSource(explicit) {
  if (explicit !== undefined) {
    return explicit;
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env;
  }
  return {};
}

/**
 * CC-04D canonical draw runtime adapter.
 *
 * Flag OFF → 100% legacy executor, no canonical mapping.
 * Flag ON  → build canonical request/trace → legacy executor → canonical result → legacy consumer shape.
 *
 * Does NOT alter draw algorithms or group assignment logic.
 *
 * @param {Object} input
 * @param {DrawRuntimeConsumer|string} input.consumer
 * @param {import('./legacyDrawPayloadMappers.js').LegacyDrawPayload} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {import('./drawDecisionTrace.js').DrawDecisionTrace} [input.trace]
 * @param {(payload: import('./legacyDrawPayloadMappers.js').LegacyDrawPayload) => import('./legacyDrawResultMappers.js').LegacyGroupDrawResult} input.legacyExecutor
 * @returns {CanonicalDrawBridgeResult}
 */
export function evaluateCanonicalDraw(input) {
  const trace = input.trace || createDrawDecisionTrace();
  const envSource = resolveDrawEnvSource(input.envSource);
  const payloadSnapshot = cloneLegacyDrawPayload(input.legacyPayload || {});

  if (typeof input.legacyExecutor !== "function") {
    const record = createDrawDecisionTraceRecord({
      consumer: String(input.consumer || "unknown"),
      usedCanonical: false,
      executionPath: "legacy",
      path: [{ phase: "error", label: "Legacy executor not configured" }],
      metadata: { error: "missing_legacy_executor" },
    });

    return {
      usedCanonical: false,
      executionPath: "legacy",
      legacyResult: { ok: false, errors: ["Legacy executor not configured"], groups: [] },
      trace: appendDrawDecisionTrace(trace, record),
      outputPreserved: true,
    };
  }

  if (!isDrawV2Enabled(envSource)) {
    const legacyResult = input.legacyExecutor(payloadSnapshot);
    const record = createDrawDecisionTraceRecord({
      consumer: String(input.consumer || "unknown"),
      usedCanonical: false,
      executionPath: "legacy",
      path: [{ phase: "legacy", label: "DRAW_V2 flag off — direct legacy runtime" }],
      metadata: { flag: "off" },
    });

    return {
      usedCanonical: false,
      executionPath: "legacy",
      legacyResult,
      trace: appendDrawDecisionTrace(trace, record),
      outputPreserved: true,
    };
  }

  const drawRequest = mapLegacyDrawPayloadToDrawRequest(payloadSnapshot);
  const strategyDrawRequest = mapLegacyDrawPayloadToStrategyDrawRequest(payloadSnapshot);
  const selection = strategyDrawRequest.selection;
  const strategy = selection?.strategy || null;
  const policies = deriveDefaultPoliciesFromStrategy(strategy, strategyDrawRequest);

  const legacyResult = input.legacyExecutor(payloadSnapshot);
  const drawResult = mapLegacyDrawResultToDrawResult(legacyResult);
  const adaptedLegacyResult = adaptDrawResultForLegacyConsumer(drawResult, legacyResult);
  const outputPreserved = isLegacyDrawOutputPreserved(legacyResult, adaptedLegacyResult);
  const strategyDrawResult = mapDrawResultToStrategyDrawResult(drawResult, strategyDrawRequest);

  const decisionPath = buildDrawDecisionPath({
    selection,
    seedPolicy: policies.seedPolicy,
    distributionPolicy: policies.distributionPolicy,
    constraintPolicy: policies.constraintPolicy,
    balancePolicy: policies.balancePolicy,
    drawResult,
  });

  const audit = createDrawAudit({
    requestSnapshot: drawRequest,
    distributionPath: decisionPath.map((step) => `${step.phase}:${step.label}`),
    randomSeed: drawRequest.metadata?.randomSeed ?? payloadSnapshot.randomSeed ?? null,
    engineVersion: DRAW_RUNTIME_ADAPTER_VERSION,
    explanations: drawResult.explanations,
  });

  const record = createDrawDecisionTraceRecord({
    consumer: String(input.consumer || "unknown"),
    usedCanonical: true,
    executionPath: "canonical-adapter",
    path: decisionPath,
    metadata: {
      strategyId: selection?.strategyId,
      distributionType: selection?.distributionType,
      groupCount: drawResult.groups?.length || 0,
    },
  });

  return {
    usedCanonical: true,
    executionPath: "canonical-adapter",
    legacyResult: outputPreserved ? legacyResult : adaptedLegacyResult,
    drawRequest,
    drawResult,
    strategyDrawRequest,
    strategyDrawResult,
    trace: appendDrawDecisionTrace(trace, record),
    audit,
    outputPreserved,
  };
}

/**
 * Convenience wrapper for tournament plan builders.
 *
 * @param {Object} input
 * @param {DrawRuntimeConsumer|string} input.consumer
 * @param {string} input.strategyKey
 * @param {import('./legacyDrawPayloadMappers.js').LegacyDrawPayload} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {(payload: import('./legacyDrawPayloadMappers.js').LegacyDrawPayload) => import('./legacyDrawResultMappers.js').LegacyGroupDrawResult} input.legacyExecutor
 * @returns {import('./legacyDrawResultMappers.js').LegacyGroupDrawResult}
 */
export function runLegacyDrawWithCanonicalAdapter(input) {
  const bridge = evaluateCanonicalDraw({
    consumer: input.consumer,
    legacyPayload: {
      ...input.legacyPayload,
      strategyKey: input.strategyKey,
      legacyStrategyKey: input.strategyKey,
    },
    envSource: input.envSource,
    legacyExecutor: input.legacyExecutor,
  });

  return bridge.legacyResult;
}
