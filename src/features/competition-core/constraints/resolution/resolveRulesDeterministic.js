import { isConstraintsV2Enabled } from "../../config/featureFlags.js";
import { detectConstraintConflicts } from "../detectConflicts.js";
import { RULE_ENGINE_VERSION, RULE_ERROR_CODE } from "../ruleConstants.js";
import {
  compareRuleAuthority,
  normalizeRuleAuthority,
} from "../authority/compareRuleAuthority.js";
import { resolveCanonicalOperation } from "../operations/ruleOperations.js";
import { buildRuleResolutionTrace } from "./buildRuleResolutionTrace.js";
import { RULE_RESOLUTION_REASON } from "./resolutionCodes.js";
import {
  cloneRule,
  resolveApplicableRules,
  resolveCompetitionId,
} from "./resolveApplicableRules.js";

/**
 * @typedef {import('../../types/index.js').ConstraintDefinition} ConstraintDefinition
 * @typedef {import('../../types/index.js').ConstraintContext} ConstraintContext
 * @typedef {import('../../types/index.js').ConstraintConflict} ConstraintConflict
 * @typedef {import('./resolveApplicableRules.js').SuppressedRule} SuppressedRule
 * @typedef {import('./buildRuleResolutionTrace.js').RuleResolutionTrace} RuleResolutionTrace
 */

/**
 * @typedef {Object} RuleResolutionResult
 * @property {boolean} ok
 * @property {boolean} enabled
 * @property {boolean} feasible
 * @property {ConstraintDefinition[]} selectedRules
 * @property {SuppressedRule[]} suppressedRules
 * @property {ConstraintConflict[]} conflicts
 * @property {RuleResolutionTrace} trace
 * @property {Array<{ code: string, message: string }>} [errors]
 * @property {string} engineVersion
 */

function emptyResult(partial = {}) {
  return {
    ok: partial.ok !== false,
    enabled: partial.enabled === true,
    feasible: partial.feasible !== false,
    selectedRules: Array.isArray(partial.selectedRules) ? partial.selectedRules : [],
    suppressedRules: Array.isArray(partial.suppressedRules) ? partial.suppressedRules : [],
    conflicts: Array.isArray(partial.conflicts) ? partial.conflicts : [],
    trace: partial.trace || buildRuleResolutionTrace({ enabled: false, steps: [] }),
    errors: Array.isArray(partial.errors) ? partial.errors : [],
    engineVersion: String(partial.engineVersion || RULE_ENGINE_VERSION),
  };
}

/**
 * Pick a deterministic winner from a conflict group.
 * @param {ConstraintDefinition[]} group
 * @returns {{ winner: ConstraintDefinition|null, suppressed: SuppressedRule[], unresolvable: boolean }}
 */
function resolveAuthorityGroup(group) {
  if (!group.length) {
    return { winner: null, suppressed: [], unresolvable: false };
  }
  if (group.length === 1) {
    return { winner: group[0], suppressed: [], unresolvable: false };
  }

  const ranked = [...group].sort((a, b) => compareRuleAuthority(b, a));
  const winner = ranked[0];
  /** @type {SuppressedRule[]} */
  const suppressed = [];

  for (let i = 1; i < ranked.length; i += 1) {
    const challenger = ranked[i];
    const cmp = compareRuleAuthority(winner, challenger);
    // cmp === 0 only when normalized authority + id are identical (ordering not total).
    // Distinct valid ids always resolve via id ASC — never ambiguous on priority/version/time alone.
    if (cmp === 0) {
      return { winner: null, suppressed: [], unresolvable: true };
    }
    suppressed.push({
      rule: challenger,
      reasonCode: RULE_RESOLUTION_REASON.SUPPRESSED_BY_HIGHER_AUTHORITY,
      message: `Rule ${challenger.id} suppressed by higher-authority rule ${winner.id}.`,
      details: {
        winnerId: winner.id,
        winnerAuthority: normalizeRuleAuthority(winner),
        challengerAuthority: normalizeRuleAuthority(challenger),
      },
    });
  }

  return { winner, suppressed, unresolvable: false };
}

/**
 * Deterministic Competition Rule resolution — CORE-01.
 * Pure: does not mutate input. Same input + evaluatedAt → same output.
 *
 * @param {ConstraintDefinition[]|{ constraints?: ConstraintDefinition[] }} rulesOrRuleSet
 * @param {Partial<ConstraintContext> & { competitionId?: string, operation?: string }} [context]
 * @param {Object} [options]
 * @param {string} [options.operation]
 * @param {string} [options.scope]
 * @param {boolean} [options.requireTenantIsolation]
 * @param {boolean} [options.requireCompetitionIsolation]
 * @param {Record<string, unknown>} [options.envSource]
 * @returns {RuleResolutionResult}
 */
export function resolveRulesDeterministic(rulesOrRuleSet, context = {}, options = {}) {
  const enabled = isConstraintsV2Enabled(options.envSource);
  const evaluatedAt =
    context.evaluatedAt != null ? String(context.evaluatedAt) : "1970-01-01T00:00:00.000Z";
  const frozenContext = {
    ...context,
    evaluatedAt,
  };

  const inputRules = Array.isArray(rulesOrRuleSet)
    ? rulesOrRuleSet
    : Array.isArray(rulesOrRuleSet?.constraints)
      ? rulesOrRuleSet.constraints
      : [];

  if (!enabled) {
    const selectedRules = inputRules.map((rule) => cloneRule(rule || {}));
    const trace = buildRuleResolutionTrace({
      enabled: false,
      engineVersion: RULE_ENGINE_VERSION,
      evaluatedAt,
      operation: options.operation ?? context.operation,
      scope: options.scope ?? context.scope,
      steps: selectedRules.map((rule) => ({
        ruleId: String(rule.id || ""),
        decision: "selected",
        reasonCode: RULE_RESOLUTION_REASON.FLAG_OFF_PASSTHROUGH,
        message: "Rules V2 flag OFF — passthrough without authority resolution.",
      })),
      meta: { mode: "passthrough" },
    });
    return emptyResult({
      ok: true,
      enabled: false,
      feasible: true,
      selectedRules,
      suppressedRules: [],
      conflicts: [],
      trace,
      errors: [],
    });
  }

  /** @type {Array<{ code: string, message: string }>} */
  const errors = [];

  if (options.requireTenantIsolation && !(frozenContext.tenantId != null && String(frozenContext.tenantId))) {
    errors.push({
      code: RULE_RESOLUTION_REASON.TENANT_CONTEXT_REQUIRED,
      message: "tenantId is required when tenant isolation is enabled.",
    });
    const trace = buildRuleResolutionTrace({
      enabled: true,
      engineVersion: RULE_ENGINE_VERSION,
      evaluatedAt,
      steps: [
        {
          ruleId: "*",
          decision: "conflict",
          reasonCode: RULE_RESOLUTION_REASON.TENANT_CONTEXT_REQUIRED,
          message: "Missing required tenantId — fail closed.",
        },
      ],
    });
    return emptyResult({
      ok: false,
      enabled: true,
      feasible: false,
      selectedRules: [],
      suppressedRules: [],
      conflicts: [
        {
          code: RULE_ERROR_CODE.RULE_TENANT_CONTEXT_REQUIRED || RULE_RESOLUTION_REASON.TENANT_CONTEXT_REQUIRED,
          message: "Missing required tenantId.",
        },
      ],
      trace,
      errors,
    });
  }

  if (
    options.requireCompetitionIsolation &&
    !resolveCompetitionId(frozenContext)
  ) {
    errors.push({
      code: RULE_RESOLUTION_REASON.COMPETITION_CONTEXT_REQUIRED,
      message: "competitionId is required when competition isolation is enabled.",
    });
    const trace = buildRuleResolutionTrace({
      enabled: true,
      engineVersion: RULE_ENGINE_VERSION,
      evaluatedAt,
      steps: [
        {
          ruleId: "*",
          decision: "conflict",
          reasonCode: RULE_RESOLUTION_REASON.COMPETITION_CONTEXT_REQUIRED,
          message: "Missing required competitionId — fail closed.",
        },
      ],
    });
    return emptyResult({
      ok: false,
      enabled: true,
      feasible: false,
      selectedRules: [],
      suppressedRules: [],
      conflicts: [
        {
          code:
            RULE_ERROR_CODE.RULE_COMPETITION_CONTEXT_REQUIRED ||
            RULE_RESOLUTION_REASON.COMPETITION_CONTEXT_REQUIRED,
          message: "Missing required competitionId.",
        },
      ],
      trace,
      errors,
    });
  }

  const operationRaw = options.operation ?? frozenContext.operation;
  if (operationRaw != null && String(operationRaw).trim() !== "") {
    const canonical = resolveCanonicalOperation(operationRaw);
    if (!canonical) {
      const trace = buildRuleResolutionTrace({
        enabled: true,
        engineVersion: RULE_ENGINE_VERSION,
        evaluatedAt,
        operation: String(operationRaw),
        steps: [
          {
            ruleId: "*",
            decision: "conflict",
            reasonCode: RULE_RESOLUTION_REASON.OPERATION_UNSUPPORTED,
            message: `Unsupported operation: ${String(operationRaw)}`,
          },
        ],
      });
      return emptyResult({
        ok: false,
        enabled: true,
        feasible: false,
        selectedRules: [],
        suppressedRules: [],
        conflicts: [
          {
            code: RULE_ERROR_CODE.RULE_OPERATION_UNSUPPORTED || RULE_RESOLUTION_REASON.OPERATION_UNSUPPORTED,
            message: `Unsupported rule operation: ${String(operationRaw)}`,
          },
        ],
        trace,
        errors: [
          {
            code: RULE_RESOLUTION_REASON.OPERATION_UNSUPPORTED,
            message: `Unsupported rule operation: ${String(operationRaw)}`,
          },
        ],
      });
    }
  }

  const filtered = resolveApplicableRules(inputRules, frozenContext, {
    operation: options.operation ?? frozenContext.operation,
    scope: options.scope ?? frozenContext.scope,
  });

  if (filtered.errors.length) {
    const hasInvalid = filtered.errors.some(
      (err) =>
        err.code === RULE_RESOLUTION_REASON.INVALID ||
        err.code === RULE_RESOLUTION_REASON.OPERATION_UNSUPPORTED
    );
    if (hasInvalid) {
      const trace = buildRuleResolutionTrace({
        enabled: true,
        engineVersion: RULE_ENGINE_VERSION,
        evaluatedAt,
        operation: options.operation ?? frozenContext.operation,
        scope: options.scope ?? frozenContext.scope,
        steps: [
          ...filtered.suppressed.map((item) => ({
            ruleId: String(item.rule.id || ""),
            decision: "suppressed",
            reasonCode: item.reasonCode,
            message: item.message,
            sourcePriority: normalizeRuleAuthority(item.rule).sourcePriority,
            details: item.details,
          })),
          ...filtered.errors.map((err) => ({
            ruleId: "*",
            decision: "conflict",
            reasonCode: err.code,
            message: err.message,
          })),
        ],
      });
      return emptyResult({
        ok: false,
        enabled: true,
        feasible: false,
        selectedRules: [],
        suppressedRules: filtered.suppressed,
        conflicts: filtered.errors.map((err) => ({
          code: err.code,
          message: err.message,
        })),
        trace,
        errors: filtered.errors,
      });
    }
  }

  /** @type {SuppressedRule[]} */
  const suppressedRules = [...filtered.suppressed];
  let working = [...filtered.candidates];

  // Deterministic order before conflict resolution (authority DESC, id ASC via comparator).
  working.sort((a, b) => compareRuleAuthority(b, a));

  const structuralConflicts = detectConstraintConflicts(working, frozenContext);
  /** @type {ConstraintConflict[]} */
  const unresolvedConflicts = [];

  if (structuralConflicts.length) {
    /** @type {Set<string>} */
    const removedIds = new Set();

    for (let c = 0; c < structuralConflicts.length; c += 1) {
      const conflict = structuralConflicts[c];
      const involved = (conflict.constraints || []).filter((rule) => rule && !removedIds.has(rule.id));
      if (involved.length < 2) {
        // Non-pair conflicts (e.g. invalid params) — fail closed.
        unresolvedConflicts.push(conflict);
        continue;
      }

      const resolution = resolveAuthorityGroup(involved);
      if (resolution.unresolvable || !resolution.winner) {
        unresolvedConflicts.push({
          ...conflict,
          code: RULE_ERROR_CODE.RULE_RESOLUTION_AMBIGUOUS,
          message:
            conflict.message ||
            "Ambiguous rule resolution — identical normalized identity; total ordering cannot be guaranteed.",
        });
        continue;
      }

      for (let s = 0; s < resolution.suppressed.length; s += 1) {
        const item = resolution.suppressed[s];
        removedIds.add(item.rule.id);
        suppressedRules.push(item);
      }
    }

    if (unresolvedConflicts.length) {
      const trace = buildRuleResolutionTrace({
        enabled: true,
        engineVersion: RULE_ENGINE_VERSION,
        evaluatedAt,
        operation: options.operation ?? frozenContext.operation,
        scope: options.scope ?? frozenContext.scope,
        steps: [
          ...suppressedRules.map((item) => ({
            ruleId: String(item.rule.id || ""),
            decision: "suppressed",
            reasonCode: item.reasonCode,
            message: item.message,
            sourcePriority: normalizeRuleAuthority(item.rule).sourcePriority,
            details: item.details,
          })),
          ...unresolvedConflicts.map((conflict) => ({
            ruleId: (conflict.constraints || []).map((r) => r.id).join(","),
            decision: "conflict",
            reasonCode: conflict.code || RULE_RESOLUTION_REASON.RULE_RESOLUTION_AMBIGUOUS,
            message: conflict.message,
          })),
        ],
      });
      return emptyResult({
        ok: false,
        enabled: true,
        feasible: false,
        selectedRules: [],
        suppressedRules,
        conflicts: unresolvedConflicts,
        trace,
        errors: unresolvedConflicts.map((conflict) => ({
          code: conflict.code,
          message: conflict.message,
        })),
      });
    }

    working = working.filter((rule) => !removedIds.has(rule.id));
  }

  const selectedRules = working;
  const trace = buildRuleResolutionTrace({
    enabled: true,
    engineVersion: RULE_ENGINE_VERSION,
    evaluatedAt,
    operation: options.operation ?? frozenContext.operation,
    scope: options.scope ?? frozenContext.scope,
    steps: [
      ...selectedRules.map((rule) => ({
        ruleId: String(rule.id || ""),
        decision: "selected",
        reasonCode: RULE_RESOLUTION_REASON.SELECTED,
        sourcePriority: normalizeRuleAuthority(rule).sourcePriority,
        message: `Rule ${rule.id} selected.`,
        details: { authority: normalizeRuleAuthority(rule) },
      })),
      ...suppressedRules.map((item) => ({
        ruleId: String(item.rule.id || ""),
        decision: "suppressed",
        reasonCode: item.reasonCode,
        message: item.message,
        sourcePriority: normalizeRuleAuthority(item.rule).sourcePriority,
        details: item.details,
      })),
    ],
  });

  return emptyResult({
    ok: true,
    enabled: true,
    feasible: true,
    selectedRules,
    suppressedRules,
    conflicts: [],
    trace,
    errors: [],
  });
}
