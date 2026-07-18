/**
 * Phase 2B.3 — shadow mapping runner (tests / QA only).
 *
 * Does NOT:
 * - call Production competition executors
 * - write databases / persistence
 * - mutate format runtime output
 * - display to Production users
 */

import { cloneSourceSnapshot, assertSourceUnchanged } from "./mappingResult.js";
import { summarizeParityFindings } from "./parity.js";

/**
 * @typedef {Object} ShadowRunnerHooks
 * @property {() => void} [onPersistAttempt]
 * @property {() => void} [onExecutorAttempt]
 */

/**
 * @typedef {Object} ShadowMapStep
 * @property {string} name
 * @property {(source: unknown, context: Record<string, unknown>) => import('./mappingResult.js').MappingResult} map
 * @property {(legacy: unknown, mappingResult: import('./mappingResult.js').MappingResult, context: Record<string, unknown>) => import('./parity.js').ParityFinding[]} [compare]
 */

/**
 * @param {Object} input
 * @param {unknown} input.source
 * @param {ShadowMapStep[]} input.steps
 * @param {Record<string, unknown>} [input.context]
 * @param {ShadowRunnerHooks} [input.hooks]
 * @returns {Object}
 */
export function runShadowMapping(input = {}) {
  const hooks = input.hooks || {};
  const persistenceWrites = { attempted: false, count: 0 };
  const executorCalls = { attempted: false, count: 0 };

  const guardedHooks = {
    /** Shadow runner forbids persistence — any call is recorded as a violation. */
    attemptPersist() {
      persistenceWrites.attempted = true;
      persistenceWrites.count += 1;
      if (typeof hooks.onPersistAttempt === "function") hooks.onPersistAttempt();
      throw new Error("SHADOW_RUNNER_FORBIDS_PERSISTENCE");
    },
    /** Shadow runner forbids Production executors. */
    attemptExecutor() {
      executorCalls.attempted = true;
      executorCalls.count += 1;
      if (typeof hooks.onExecutorAttempt === "function") hooks.onExecutorAttempt();
      throw new Error("SHADOW_RUNNER_FORBIDS_EXECUTOR");
    },
  };

  const sourceSnapshot = cloneSourceSnapshot(input.source);
  const context = {
    ...(input.context && typeof input.context === "object" ? input.context : {}),
    shadow: true,
    hooks: guardedHooks,
  };

  /** @type {Array<Record<string, unknown>>} */
  const stepResults = [];
  /** @type {import('./parity.js').ParityFinding[]} */
  const allFindings = [];

  const steps = Array.isArray(input.steps) ? input.steps : [];
  for (const step of steps) {
    if (!step || typeof step.map !== "function") {
      throw new TypeError("runShadowMapping step.map must be a function");
    }
    const mappingResult = step.map(input.source, context);
    const findings =
      typeof step.compare === "function"
        ? step.compare(input.source, mappingResult, context) || []
        : [];
    allFindings.push(...findings);
    stepResults.push({
      name: String(step.name || "unnamed"),
      success: Boolean(mappingResult?.success),
      diagnostics: mappingResult?.diagnostics || [],
      value: mappingResult?.value ?? null,
      source: mappingResult?.source || null,
      targetSchemaVersion: mappingResult?.targetSchemaVersion ?? null,
      findings,
    });
  }

  const sourceUnchanged = assertSourceUnchanged(sourceSnapshot, input.source);
  const summary = summarizeParityFindings(allFindings);

  return {
    shadow: true,
    wiredToRuntime: false,
    persistenceWrites,
    executorCalls,
    sourceUnchanged,
    steps: stepResults,
    findings: allFindings,
    parity: summary,
    ok:
      summary.ok &&
      sourceUnchanged &&
      !persistenceWrites.attempted &&
      !executorCalls.attempted &&
      stepResults.every((s) => s.success),
  };
}

/**
 * Convenience: single mapper shadow run.
 * @param {Object} input
 */
export function runSingleShadowMap(input = {}) {
  return runShadowMapping({
    source: input.source,
    context: input.context,
    hooks: input.hooks,
    steps: [
      {
        name: input.name || "map",
        map: input.map,
        compare: input.compare,
      },
    ],
  });
}
