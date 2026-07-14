import { CONSTRAINT_SEVERITY } from "../../competition-core/constants/constraintSeverity.js";
import {
  TYPES_REQUIRING_PRIMARY_AND_TARGETS,
  REPEAT_CONSTRAINT_TYPES,
  isPrivatePairingConstraintType,
  PERSONAL_PREFERENCE_CONSTRAINT_TYPES,
} from "../constants/constraintTypes.js";
import { PRIVATE_PAIRING_VALIDATION_CODE } from "../constants/codes.js";
import {
  RELATION_MODE,
  RESTRICTED_COMPETITION_CLASSES,
  RULE_VISIBILITY,
  REASON_CATEGORY,
  isRelationMode,
  isRulePriority,
  isRuleVisibility,
  isReasonCategory,
} from "../constants/enums.js";
import {
  PRIVATE_PAIRING_SCOPE,
  SCOPES_REQUIRING_ID,
  isPrivatePairingScope,
} from "../constants/scopes.js";
import { normalizePrivatePairingRule } from "../contracts/normalizePrivatePairingRule.js";

/**
 * @typedef {Object} ValidationIssue
 * @property {string} code
 * @property {'error'|'warning'} severity
 * @property {string} [field]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} ValidationContext
 * @property {number} [teamSize]
 * @property {string} [competitionClass]
 * @property {boolean} [allowedByPublishedRules]
 * @property {string|Date|number} [now]
 * @property {Record<string, { clubId?: string, tenantId?: string, venueId?: string }>} [playersById]
 * @property {string[]} [supportedConstraintTypes]
 */

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function toEpoch(value) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule|Record<string, unknown>} ruleInput
 * @param {ValidationContext} [context]
 * @returns {{ ok: boolean, errors: ValidationIssue[], warnings: ValidationIssue[], rule: import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule|null }}
 */
export function validatePrivatePairingRule(ruleInput, context = {}) {
  /** @type {ValidationIssue[]} */
  const errors = [];
  /** @type {ValidationIssue[]} */
  const warnings = [];

  const rawType = String(ruleInput?.constraintType || ruleInput?.type || "").trim();
  if (!rawType) {
    errors.push({ code: PRIVATE_PAIRING_VALIDATION_CODE.MISSING_CONSTRAINT_TYPE, severity: "error", field: "constraintType" });
    return { ok: false, errors, warnings, rule: null };
  }

  if (!isPrivatePairingConstraintType(rawType)) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.UNSUPPORTED_CONSTRAINT_TYPE,
      severity: "error",
      field: "constraintType",
      details: { constraintType: rawType },
    });
    return { ok: false, errors, warnings, rule: null };
  }

  const rule = normalizePrivatePairingRule(ruleInput);
  if (!rule) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.UNSUPPORTED_CONSTRAINT_TYPE,
      severity: "error",
      field: "constraintType",
    });
    return { ok: false, errors, warnings, rule: null };
  }

  const requiresPlayers = TYPES_REQUIRING_PRIMARY_AND_TARGETS.includes(rule.constraintType);
  const isRepeat = REPEAT_CONSTRAINT_TYPES.includes(rule.constraintType);

  if (requiresPlayers || isRepeat) {
    if (!rule.primaryPlayerId) {
      errors.push({
        code: PRIVATE_PAIRING_VALIDATION_CODE.MISSING_PRIMARY_PLAYER,
        severity: "error",
        field: "primaryPlayerId",
      });
    }
  }

  if (requiresPlayers) {
    if (!rule.targetPlayerIds.length) {
      errors.push({
        code: PRIVATE_PAIRING_VALIDATION_CODE.EMPTY_TARGET_LIST,
        severity: "error",
        field: "targetPlayerIds",
      });
    }

    if (rule.primaryPlayerId && rule.targetPlayerIds.includes(rule.primaryPlayerId)) {
      errors.push({
        code: PRIVATE_PAIRING_VALIDATION_CODE.SELF_TARGET_NOT_ALLOWED,
        severity: "error",
        field: "targetPlayerIds",
      });
    }

    const rawTargets = Array.isArray(ruleInput.targetPlayerIds)
      ? ruleInput.targetPlayerIds.map((id) => String(id).trim()).filter(Boolean)
      : [];
    if (rawTargets.length !== new Set(rawTargets).size) {
      errors.push({
        code: PRIVATE_PAIRING_VALIDATION_CODE.DUPLICATE_TARGET,
        severity: "error",
        field: "targetPlayerIds",
      });
    }
  }

  if (rule.severity !== CONSTRAINT_SEVERITY.HARD && rule.severity !== CONSTRAINT_SEVERITY.SOFT) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.INVALID_SEVERITY,
      severity: "error",
      field: "severity",
    });
  }

  if (rule.severity === CONSTRAINT_SEVERITY.SOFT) {
    const weight = Number(rule.weight);
    if (!Number.isFinite(weight) || weight < 1 || weight > 100) {
      errors.push({
        code: PRIVATE_PAIRING_VALIDATION_CODE.INVALID_WEIGHT,
        severity: "error",
        field: "weight",
        details: { weight: rule.weight },
      });
    }
  }

  if (
    rule.severity === CONSTRAINT_SEVERITY.HARD &&
    (rule.metadata?.simulateHardWithWeight === true ||
      rule.metadata?.useWeightAsHardPenalty === true)
  ) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.HARD_WEIGHT_SIMULATION_NOT_ALLOWED,
      severity: "error",
      field: "weight",
    });
  }

  if (!isRulePriority(rule.priority)) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.INVALID_PRIORITY,
      severity: "error",
      field: "priority",
    });
  }

  if (!isRelationMode(rule.relationMode)) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.INVALID_RELATION_MODE,
      severity: "error",
      field: "relationMode",
    });
  }

  if (isRepeat && rule.relationMode === RELATION_MODE.ALL_OF && rule.targetPlayerIds.length > 1) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.RELATION_MODE_NOT_COMPATIBLE,
      severity: "error",
      field: "relationMode",
      details: { constraintType: rule.constraintType, relationMode: rule.relationMode },
    });
  }

  if (!isPrivatePairingScope(rule.scopeType)) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.INVALID_SCOPE_TYPE,
      severity: "error",
      field: "scopeType",
    });
  } else if (SCOPES_REQUIRING_ID.includes(rule.scopeType) && !rule.scopeId) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.SCOPE_ID_REQUIRED,
      severity: "error",
      field: "scopeId",
      details: { scopeType: rule.scopeType },
    });
  }

  const startMs = toEpoch(rule.startAt);
  const endMs = toEpoch(rule.endAt);
  if (rule.startAt && startMs == null) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.INVALID_TIME_RANGE,
      severity: "error",
      field: "startAt",
    });
  }
  if (rule.endAt && endMs == null) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.INVALID_TIME_RANGE,
      severity: "error",
      field: "endAt",
    });
  }
  if (startMs != null && endMs != null && startMs >= endMs) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.INVALID_TIME_RANGE,
      severity: "error",
      field: "endAt",
      details: { startAt: rule.startAt, endAt: rule.endAt },
    });
  }

  const nowMs = toEpoch(context.now) ?? Date.now();
  if (rule.active && endMs != null && endMs < nowMs) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.RULE_EXPIRED,
      severity: "error",
      field: "endAt",
    });
  }

  const teamSize = Number(context.teamSize ?? 2);
  if (
    rule.relationMode === RELATION_MODE.ALL_OF &&
    requiresPlayers &&
    rule.targetPlayerIds.length > Math.max(teamSize - 1, 0)
  ) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.ALL_OF_EXCEEDS_TEAM_CAPACITY,
      severity: "error",
      field: "relationMode",
      details: {
        targetCount: rule.targetPlayerIds.length,
        teamSize,
        capacity: Math.max(teamSize - 1, 0),
      },
    });
  }

  if (!isRuleVisibility(rule.visibility)) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.INVALID_VISIBILITY,
      severity: "error",
      field: "visibility",
    });
  }

  if (!isReasonCategory(rule.reasonCategory)) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.INVALID_REASON_CATEGORY,
      severity: "error",
      field: "reasonCategory",
    });
  } else if (rule.reasonCategory === REASON_CATEGORY.OTHER && !rule.reasonText) {
    errors.push({
      code: PRIVATE_PAIRING_VALIDATION_CODE.REASON_TEXT_REQUIRED,
      severity: "error",
      field: "reasonText",
    });
  }

  if (Array.isArray(context.supportedConstraintTypes) && context.supportedConstraintTypes.length) {
    if (!context.supportedConstraintTypes.includes(rule.constraintType)) {
      errors.push({
        code: PRIVATE_PAIRING_VALIDATION_CODE.CONSTRAINT_TYPE_NOT_SUPPORTED_IN_CONTEXT,
        severity: "error",
        field: "constraintType",
        details: { constraintType: rule.constraintType },
      });
    }
  }

  if (context.playersById) {
    const players = context.playersById;
    const checkPlayer = (playerId, field) => {
      if (!playerId) {
        return;
      }
      const snapshot = players[playerId] || players[String(playerId)];
      if (!snapshot) {
        errors.push({
          code: PRIVATE_PAIRING_VALIDATION_CODE.PLAYER_NOT_FOUND,
          severity: "error",
          field,
          details: { playerId },
        });
        return;
      }
      if (rule.scopeType === PRIVATE_PAIRING_SCOPE.CLUB && rule.scopeId) {
        if (snapshot.clubId && String(snapshot.clubId) !== String(rule.scopeId)) {
          errors.push({
            code: PRIVATE_PAIRING_VALIDATION_CODE.PLAYER_NOT_IN_SCOPE,
            severity: "error",
            field,
            details: { playerId, scopeType: rule.scopeType, scopeId: rule.scopeId },
          });
        }
      }
    };

    checkPlayer(rule.primaryPlayerId, "primaryPlayerId");
    rule.targetPlayerIds.forEach((id) => checkPlayer(id, "targetPlayerIds"));
  }

  const competitionClass = String(context.competitionClass || "").toUpperCase();
  if (
    RESTRICTED_COMPETITION_CLASSES.has(competitionClass) &&
    PERSONAL_PREFERENCE_CONSTRAINT_TYPES.includes(rule.constraintType)
  ) {
    const disclosed =
      rule.visibility === RULE_VISIBILITY.DISCLOSED ||
      rule.visibility === RULE_VISIBILITY.PUBLIC;
    const allowed = context.allowedByPublishedRules === true && disclosed;
    if (!allowed) {
      errors.push({
        code: PRIVATE_PAIRING_VALIDATION_CODE.PRIVATE_RULE_NOT_ALLOWED_IN_CERTIFIED_EVENT,
        severity: "error",
        field: "visibility",
        details: {
          competitionClass,
          constraintType: rule.constraintType,
          visibility: rule.visibility,
        },
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    rule,
  };
}

/**
 * @param {Array<Record<string, unknown>>} rules
 * @param {ValidationContext} [context]
 */
export function validatePrivatePairingRules(rules = [], context = {}) {
  const results = (rules || []).map((rule) => validatePrivatePairingRule(rule, context));
  const errors = results.flatMap((item) => item.errors);
  const warnings = results.flatMap((item) => item.warnings);
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    rules: results.map((item) => item.rule).filter(Boolean),
  };
}
