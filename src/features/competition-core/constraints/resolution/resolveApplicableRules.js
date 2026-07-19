import { isRuleApplicable } from "../expandApplicableRules.js";
import { isConstraintScope } from "../../constants/constraintScope.js";
import { RULE_RESOLUTION_REASON } from "./resolutionCodes.js";
import { matchRuleOperation, resolveCanonicalOperation } from "../operations/ruleOperations.js";
import { normalizeRuleAuthority } from "../authority/compareRuleAuthority.js";

/**
 * @typedef {import('../../types/index.js').ConstraintDefinition} ConstraintDefinition
 * @typedef {import('../../types/index.js').ConstraintContext} ConstraintContext
 */

/**
 * @typedef {Object} SuppressedRule
 * @property {ConstraintDefinition} rule
 * @property {string} reasonCode
 * @property {string} [message]
 * @property {Record<string, unknown>} [details]
 */

/**
 * Shallow-clone a rule so resolution never mutates caller input.
 * @param {object} rule
 * @returns {object}
 */
export function cloneRule(rule) {
  return {
    ...rule,
    operations: Array.isArray(rule.operations) ? [...rule.operations] : rule.operations,
    applicability:
      rule.applicability && typeof rule.applicability === "object"
        ? { ...rule.applicability }
        : rule.applicability,
    params: rule.params && typeof rule.params === "object" ? { ...rule.params } : rule.params,
    metadata: rule.metadata && typeof rule.metadata === "object" ? { ...rule.metadata } : rule.metadata,
  };
}

/**
 * Competition id from context (canonical) or tournamentId fallback for CC-03A contexts.
 * @param {Partial<ConstraintContext> & { competitionId?: string }} context
 * @returns {string}
 */
export function resolveCompetitionId(context = {}) {
  if (context.competitionId != null && String(context.competitionId).trim() !== "") {
    return String(context.competitionId);
  }
  if (context.tournamentId != null && String(context.tournamentId).trim() !== "") {
    return String(context.tournamentId);
  }
  return "";
}

/**
 * Filter rules by enabled / scope / operation / tenant / competition / applicability.
 * Pure — does not mutate input.
 *
 * @param {ConstraintDefinition[]} rules
 * @param {Partial<ConstraintContext> & { competitionId?: string, operation?: string }} context
 * @param {Object} [options]
 * @param {string} [options.operation]
 * @param {string} [options.scope]
 * @returns {{ candidates: ConstraintDefinition[], suppressed: SuppressedRule[], errors: Array<{ code: string, message: string }> }}
 */
export function resolveApplicableRules(rules = [], context = {}, options = {}) {
  /** @type {ConstraintDefinition[]} */
  const candidates = [];
  /** @type {SuppressedRule[]} */
  const suppressed = [];
  /** @type {Array<{ code: string, message: string }>} */
  const errors = [];

  const operationRaw = options.operation ?? context.operation;
  let canonicalOperation = null;
  if (operationRaw != null && String(operationRaw).trim() !== "") {
    canonicalOperation = resolveCanonicalOperation(operationRaw);
    if (!canonicalOperation) {
      errors.push({
        code: RULE_RESOLUTION_REASON.OPERATION_UNSUPPORTED,
        message: `Unsupported rule operation: ${String(operationRaw)}`,
      });
      return { candidates, suppressed, errors };
    }
  }

  const expectedScope = options.scope ?? context.scope;
  const list = Array.isArray(rules) ? rules : [];

  for (let i = 0; i < list.length; i += 1) {
    const original = list[i];
    if (!original || typeof original !== "object") {
      errors.push({
        code: RULE_RESOLUTION_REASON.INVALID,
        message: `Invalid rule at index ${i}: not an object.`,
      });
      continue;
    }

    const rule = cloneRule(original);

    if (!rule.type) {
      suppressed.push({
        rule,
        reasonCode: RULE_RESOLUTION_REASON.INVALID,
        message: `Rule ${rule.id || i} is missing type.`,
      });
      errors.push({
        code: RULE_RESOLUTION_REASON.INVALID,
        message: `Rule ${rule.id || i} is missing type.`,
      });
      continue;
    }

    if (rule.enabled === false) {
      suppressed.push({
        rule,
        reasonCode: RULE_RESOLUTION_REASON.DISABLED,
        message: `Rule ${rule.id} is disabled.`,
      });
      continue;
    }

    if (expectedScope && rule.scope && rule.scope !== expectedScope) {
      if (isConstraintScope(rule.scope) || isConstraintScope(expectedScope)) {
        suppressed.push({
          rule,
          reasonCode: RULE_RESOLUTION_REASON.SCOPE_MISMATCH,
          message: `Rule ${rule.id} scope ${rule.scope} does not match ${expectedScope}.`,
          details: { ruleScope: rule.scope, expectedScope },
        });
        continue;
      }
    }

    if (canonicalOperation && !matchRuleOperation(rule, canonicalOperation)) {
      suppressed.push({
        rule,
        reasonCode: RULE_RESOLUTION_REASON.OPERATION_MISMATCH,
        message: `Rule ${rule.id} does not match operation ${canonicalOperation}.`,
        details: {
          operations: rule.operations,
          operation: canonicalOperation,
          authority: normalizeRuleAuthority(rule),
        },
      });
      continue;
    }

    const applicability = rule.applicability;
    if (applicability && typeof applicability === "object") {
      if (
        applicability.tenantId != null &&
        String(applicability.tenantId) !== "" &&
        context.tenantId != null &&
        String(context.tenantId) !== "" &&
        String(applicability.tenantId) !== String(context.tenantId)
      ) {
        suppressed.push({
          rule,
          reasonCode: RULE_RESOLUTION_REASON.TENANT_MISMATCH,
          message: `Rule ${rule.id} tenant mismatch.`,
          details: {
            ruleTenantId: applicability.tenantId,
            contextTenantId: context.tenantId,
          },
        });
        continue;
      }

      const ruleCompetitionId =
        applicability.competitionId != null && String(applicability.competitionId) !== ""
          ? String(applicability.competitionId)
          : applicability.tournamentId != null && String(applicability.tournamentId) !== ""
            ? String(applicability.tournamentId)
            : "";
      const contextCompetitionId = resolveCompetitionId(context);
      if (ruleCompetitionId && contextCompetitionId && ruleCompetitionId !== contextCompetitionId) {
        suppressed.push({
          rule,
          reasonCode: RULE_RESOLUTION_REASON.COMPETITION_MISMATCH,
          message: `Rule ${rule.id} competition mismatch.`,
          details: {
            ruleCompetitionId,
            contextCompetitionId,
          },
        });
        continue;
      }
    }

    if (!isRuleApplicable(rule.applicability, /** @type {any} */ (context))) {
      suppressed.push({
        rule,
        reasonCode: RULE_RESOLUTION_REASON.APPLICABILITY_MISMATCH,
        message: `Rule ${rule.id} is not applicable in the current context.`,
      });
      continue;
    }

    candidates.push(rule);
  }

  return { candidates, suppressed, errors };
}
