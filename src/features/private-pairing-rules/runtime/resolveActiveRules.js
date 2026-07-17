import { CONSTRAINT_SEVERITY } from "../../competition-core/constants/constraintSeverity.js";
import { PRIVATE_PAIRING_SCOPE } from "../constants/scopes.js";
import { COMPETITION_CLASS, RESTRICTED_COMPETITION_CLASSES, RULE_VISIBILITY } from "../constants/enums.js";
import { PERSONAL_PREFERENCE_CONSTRAINT_TYPES } from "../constants/constraintTypes.js";
import { PRIVATE_PAIRING_CONFLICT_CODE } from "../constants/codes.js";
import { normalizePrivatePairingRules } from "../contracts/normalizePrivatePairingRule.js";
import { mapLegacyFounderConstraint } from "../mappers/legacyFounderMapping.js";
import { validatePrivatePairingRules } from "../validation/validatePrivatePairingRule.js";
import { detectPrivatePairingConflicts } from "../conflicts/detectPrivatePairingConflicts.js";
import {
  compareRuleAuthority,
  resolveRuleSourcePriority,
  PRIVATE_PAIRING_SOURCE_ORDER,
  PRIVATE_PAIRING_OPERATION,
  ruleMatchesOperation,
} from "./privatePairingSource.js";
import { buildRuleResolutionMetadata } from "./ruleResolutionMetadata.js";

/**
 * Hard-vs-hard opposing conflicts that a higher SOURCE may override.
 * Structural conflicts (capacity/chain/duplicate id) are never source-resolvable.
 */
const OVERRIDABLE_HARD_CONFLICT_CODES = new Set([
  PRIVATE_PAIRING_CONFLICT_CODE.MUST_AND_MUST_NOT_PARTNER,
  PRIVATE_PAIRING_CONFLICT_CODE.MUST_AND_MUST_NOT_OPPONENT,
  PRIVATE_PAIRING_CONFLICT_CODE.PARTNER_AND_OPPONENT_CONFLICT,
  PRIVATE_PAIRING_CONFLICT_CODE.MUST_AND_MUST_NOT_GROUP,
]);

/** @typedef {{ ruleId: string, overriddenByRuleId: string, reason: string }} OverriddenRuleEntry */

/**
 * Resolve cross-source authority: a higher SOURCE rule overrides a lower one on
 * conflict. Same-priority hard conflicts stay fatal (no arbitrary pick).
 *
 * @param {object[]} rules validated + allowed rules
 * @param {Array<{ code: string, ruleIds: string[] }>} fatalConflicts
 * @param {Array<{ code: string, ruleIds: string[] }>} softWarnings
 */
function resolveAuthorityOverrides(rules, fatalConflicts, softWarnings) {
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  /** @type {Map<string, OverriddenRuleEntry>} */
  const overridesByLoser = new Map();
  /** @type {Map<string, number>} */
  const winnerPriorityByLoser = new Map();
  const remainingFatal = [];

  const recordOverride = (loser, winner, reason) => {
    const winnerPriority = resolveRuleSourcePriority(winner);
    const existingPriority = winnerPriorityByLoser.get(loser.id);
    if (existingPriority == null || winnerPriority > existingPriority) {
      overridesByLoser.set(loser.id, {
        ruleId: loser.id,
        overriddenByRuleId: winner.id,
        reason,
      });
      winnerPriorityByLoser.set(loser.id, winnerPriority);
    }
  };

  fatalConflicts.forEach((conflict) => {
    if (
      OVERRIDABLE_HARD_CONFLICT_CODES.has(conflict.code) &&
      conflict.ruleIds.length === 2
    ) {
      const ruleA = rulesById.get(conflict.ruleIds[0]);
      const ruleB = rulesById.get(conflict.ruleIds[1]);
      if (ruleA && ruleB) {
        const priorityA = resolveRuleSourcePriority(ruleA);
        const priorityB = resolveRuleSourcePriority(ruleB);
        if (priorityA !== priorityB) {
          const winner = priorityA > priorityB ? ruleA : ruleB;
          const loser = priorityA > priorityB ? ruleB : ruleA;
          recordOverride(loser, winner, `${conflict.code}:SOURCE_PRIORITY`);
          return;
        }
      }
    }
    remainingFatal.push(conflict);
  });

  softWarnings.forEach((warning) => {
    if (!Array.isArray(warning.ruleIds) || warning.ruleIds.length !== 2) {
      return;
    }
    const ruleA = rulesById.get(warning.ruleIds[0]);
    const ruleB = rulesById.get(warning.ruleIds[1]);
    if (!ruleA || !ruleB) {
      return;
    }
    if (warning.code === PRIVATE_PAIRING_CONFLICT_CODE.HARD_RULE_OVERRIDES_SOFT_RULE) {
      const hard = ruleA.severity === CONSTRAINT_SEVERITY.HARD ? ruleA : ruleB;
      const soft = ruleA.severity === CONSTRAINT_SEVERITY.HARD ? ruleB : ruleA;
      if (hard.severity === CONSTRAINT_SEVERITY.HARD && soft.severity === CONSTRAINT_SEVERITY.SOFT) {
        recordOverride(soft, hard, warning.code);
      }
    } else if (warning.code === PRIVATE_PAIRING_CONFLICT_CODE.SOFT_SOFT_OPPOSITE_PREFERENCE) {
      const winner = compareRuleAuthority(ruleA, ruleB) >= 0 ? ruleA : ruleB;
      const loser = winner === ruleA ? ruleB : ruleA;
      recordOverride(loser, winner, `${warning.code}:SOURCE_PRIORITY`);
    }
  });

  const overriddenRules = [...overridesByLoser.values()].sort((a, b) =>
    a.ruleId.localeCompare(b.ruleId)
  );
  const overriddenIds = new Set(overriddenRules.map((entry) => entry.ruleId));

  return { overriddenRules, overriddenIds, remainingFatal };
}

const SCOPE_SPECIFICITY = Object.freeze({
  [PRIVATE_PAIRING_SCOPE.GLOBAL]: 0,
  [PRIVATE_PAIRING_SCOPE.TENANT]: 1,
  [PRIVATE_PAIRING_SCOPE.CLUB]: 2,
  [PRIVATE_PAIRING_SCOPE.VENUE]: 3,
  [PRIVATE_PAIRING_SCOPE.TOURNAMENT]: 4,
  [PRIVATE_PAIRING_SCOPE.TOURNAMENT_EVENT]: 5,
  [PRIVATE_PAIRING_SCOPE.DAILY_PLAY_SESSION]: 6,
  [PRIVATE_PAIRING_SCOPE.ROUND]: 7,
  [PRIVATE_PAIRING_SCOPE.MATCH_DAY]: 8,
});

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
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} rule
 * @param {number} contextTimeMs
 */
export function isRuleActiveAt(rule, contextTimeMs) {
  if (rule.active === false) {
    return false;
  }
  const startMs = toEpoch(rule.startAt);
  const endMs = toEpoch(rule.endAt);
  if (startMs != null && contextTimeMs < startMs) {
    return false;
  }
  if (endMs != null && contextTimeMs >= endMs) {
    return false;
  }
  return true;
}

/**
 * Rule applies when scope matches context (GLOBAL always; otherwise type+id).
 * Narrower scopes do not erase broader ones.
 *
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} rule
 * @param {Record<string, unknown>} context
 */
export function doesRuleMatchScope(rule, context = {}) {
  if (rule.scopeType === PRIVATE_PAIRING_SCOPE.GLOBAL) {
    return true;
  }

  const scopeIdMap = {
    [PRIVATE_PAIRING_SCOPE.TENANT]: context.tenantId,
    [PRIVATE_PAIRING_SCOPE.CLUB]: context.clubId,
    [PRIVATE_PAIRING_SCOPE.VENUE]: context.venueId,
    [PRIVATE_PAIRING_SCOPE.TOURNAMENT]: context.tournamentId,
    [PRIVATE_PAIRING_SCOPE.TOURNAMENT_EVENT]: context.eventId || context.tournamentEventId,
    [PRIVATE_PAIRING_SCOPE.DAILY_PLAY_SESSION]: context.sessionId || context.dailyPlaySessionId,
    [PRIVATE_PAIRING_SCOPE.ROUND]: context.roundId,
    [PRIVATE_PAIRING_SCOPE.MATCH_DAY]: context.matchDayId,
  };

  const expected = scopeIdMap[rule.scopeType];
  if (expected == null || expected === "") {
    return false;
  }
  return String(rule.scopeId) === String(expected);
}

/**
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} rule
 * @param {Record<string, unknown>} context
 */
function passesOfficialPolicy(rule, context = {}) {
  const competitionClass = String(context.competitionClass || "").toUpperCase();
  if (!RESTRICTED_COMPETITION_CLASSES.has(competitionClass)) {
    return true;
  }
  if (!PERSONAL_PREFERENCE_CONSTRAINT_TYPES.includes(rule.constraintType)) {
    return true;
  }
  const disclosed =
    rule.visibility === RULE_VISIBILITY.DISCLOSED ||
    rule.visibility === RULE_VISIBILITY.PUBLIC;
  return disclosed && context.allowedByPublishedRules === true;
}

/**
 * Deduplicate equivalent rules: same type + primary + sorted targets + severity + relationMode.
 * Prefer higher ruleSetVersion, then higher scope specificity.
 *
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule[]} rules
 */
export function dedupeEquivalentRules(rules = []) {
  /** @type {Map<string, import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule>} */
  const best = new Map();

  rules.forEach((rule) => {
    const key = [
      rule.constraintType,
      rule.severity,
      rule.relationMode,
      rule.primaryPlayerId,
      [...rule.targetPlayerIds].map(String).sort().join(","),
    ].join("|");

    const existing = best.get(key);
    if (!existing) {
      best.set(key, rule);
      return;
    }

    const versionA = Number(existing.ruleSetVersion) || 0;
    const versionB = Number(rule.ruleSetVersion) || 0;
    if (versionB > versionA) {
      best.set(key, rule);
      return;
    }
    if (versionB < versionA) {
      return;
    }

    const specA = SCOPE_SPECIFICITY[existing.scopeType] ?? 0;
    const specB = SCOPE_SPECIFICITY[rule.scopeType] ?? 0;
    if (specB >= specA) {
      best.set(key, rule);
    }
  });

  return [...best.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/**
 * @param {Object} input
 * @param {Array<Record<string, unknown>>} [input.rules]
 * @param {Array<Record<string, unknown>>} [input.legacyConstraints]
 * @param {Record<string, unknown>} [input.context]
 * @returns {{
 *   ok: boolean,
 *   rules: import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule[],
 *   blockedByPolicy: import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule[],
 *   validationErrors: Array<{code:string}>,
 *   fatalConflicts: Array<{code:string}>,
 *   warnings: Array<{code:string}>,
 *   ruleSetVersion: string,
 * }}
 */
export function resolveActivePrivatePairingRules(input = {}) {
  const context = input.context || {};
  const contextTimeMs = toEpoch(context.contextTime || context.now) ?? Date.now();
  const teamSize = Number(context.teamSize ?? 2);

  const fromCanonical = normalizePrivatePairingRules(input.rules || []);
  const legacyScopeType =
    context.defaultScopeType ||
    (context.clubId
      ? PRIVATE_PAIRING_SCOPE.CLUB
      : context.tournamentId
        ? PRIVATE_PAIRING_SCOPE.TOURNAMENT
        : PRIVATE_PAIRING_SCOPE.GLOBAL);
  const legacyScopeId =
    context.defaultScopeId || context.clubId || context.tournamentId || null;

  const fromLegacy = (input.legacyConstraints || [])
    .map((item) =>
      mapLegacyFounderConstraint(item, {
        ruleSetId: context.ruleSetId || "legacy-founder",
        ruleSetVersion: context.legacyRuleSetVersion || "0",
        scopeType: legacyScopeType,
        scopeId: legacyScopeId,
      })
    )
    .filter(Boolean)
    .map((rule, index) => ({
      ...rule,
      id: rule.id || `legacy-${index + 1}`,
    }));

  const merged = dedupeEquivalentRules([...fromCanonical, ...fromLegacy]);
  const operation = context.operation || null;

  /** @type {Array<{ ruleId: string, reason: string }>} */
  const operationIgnored = [];
  const scoped = merged.filter((rule) => {
    if (!isRuleActiveAt(rule, contextTimeMs) || !doesRuleMatchScope(rule, context)) {
      return false;
    }
    if (operation && operation !== PRIVATE_PAIRING_OPERATION.ALL && !ruleMatchesOperation(rule, operation)) {
      operationIgnored.push({ ruleId: rule.id, reason: "WRONG_OPERATION" });
      return false;
    }
    return true;
  });

  const blockedByPolicy = [];
  const allowed = [];
  scoped.forEach((rule) => {
    if (!passesOfficialPolicy(rule, context)) {
      blockedByPolicy.push(rule);
      return;
    }
    allowed.push(rule);
  });

  const validation = validatePrivatePairingRules(allowed, {
    teamSize,
    competitionClass: context.competitionClass || COMPETITION_CLASS.DAILY_PLAY,
    allowedByPublishedRules: context.allowedByPublishedRules === true,
    now: contextTimeMs,
    playersById: context.playersById,
  });

  const conflicts = detectPrivatePairingConflicts(validation.rules, {
    teamSize,
    context,
  });

  const { overriddenRules, overriddenIds, remainingFatal } = resolveAuthorityOverrides(
    validation.rules,
    conflicts.fatalConflicts,
    conflicts.warnings
  );

  const effectiveRules = validation.rules.filter((rule) => !overriddenIds.has(rule.id));
  const { hard: hardRules, soft: softRules } = splitHardAndSoftRules(effectiveRules);

  const ignoredRules = buildIgnoredRules({
    merged,
    allowed,
    validationRules: validation.rules,
    overriddenRules,
    operationIgnored,
    context,
    contextTimeMs,
  });

  const versions = validation.rules.map((rule) => String(rule.ruleSetVersion || "1"));
  const ruleSetVersion = versions.sort().slice(-1)[0] || String(context.ruleSetVersion || "1");
  const operationLabel = operation || "";

  const resolutionBase = {
    ok: validation.ok && remainingFatal.length === 0,
    rules: effectiveRules,
    effectiveRules,
    hardRules,
    softRules,
    overriddenRules,
    ignoredRules,
    blockedByPolicy,
    validationErrors: validation.errors,
    fatalConflicts: remainingFatal,
    warnings: [...validation.warnings, ...conflicts.warnings],
    ruleSetVersion,
    priorityOrder: PRIVATE_PAIRING_SOURCE_ORDER,
    operation: operationLabel,
  };

  return {
    ...resolutionBase,
    ruleResolution: buildRuleResolutionMetadata(resolutionBase, operationLabel),
  };
}

/**
 * Assemble the ignoredRules audit list with canonical reason codes.
 *
 * @param {{
 *   merged: object[],
 *   allowed: object[],
 *   validationRules: object[],
 *   overriddenRules: OverriddenRuleEntry[],
 *   operationIgnored?: Array<{ ruleId: string, reason: string }>,
 *   context: Record<string, unknown>,
 *   contextTimeMs: number,
 * }} args
 * @returns {Array<{ ruleId: string, reason: string }>}
 */
function buildIgnoredRules({
  merged,
  allowed,
  validationRules,
  overriddenRules,
  operationIgnored = [],
  context,
  contextTimeMs,
}) {
  const validIds = new Set(validationRules.map((rule) => rule.id));
  /** @type {Map<string, string>} */
  const byRuleId = new Map();
  const claim = (ruleId, reason) => {
    if (!byRuleId.has(ruleId)) {
      byRuleId.set(ruleId, reason);
    }
  };

  merged.forEach((rule) => {
    if (!isRuleActiveAt(rule, contextTimeMs)) {
      claim(rule.id, "INACTIVE");
    } else if (!doesRuleMatchScope(rule, context)) {
      claim(rule.id, "OUT_OF_SCOPE");
    }
  });

  allowed.forEach((rule) => {
    if (!validIds.has(rule.id)) {
      claim(rule.id, "INVALID_PAYLOAD");
    }
  });

  operationIgnored.forEach((entry) => {
    byRuleId.set(entry.ruleId, entry.reason);
  });

  overriddenRules.forEach((entry) => {
    // Override supersedes any earlier soft reason for the same rule.
    byRuleId.set(entry.ruleId, "OVERRIDDEN");
  });

  return [...byRuleId.entries()]
    .map(([ruleId, reason]) => ({ ruleId, reason }))
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

/**
 * Soft vs hard split for runtime.
 */
export function splitHardAndSoftRules(rules = []) {
  const hard = [];
  const soft = [];
  rules.forEach((rule) => {
    if (rule.severity === CONSTRAINT_SEVERITY.HARD) {
      hard.push(rule);
    } else {
      soft.push(rule);
    }
  });
  return { hard, soft };
}
