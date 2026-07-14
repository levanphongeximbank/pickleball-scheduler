import { CONSTRAINT_SEVERITY } from "../../competition-core/constants/constraintSeverity.js";
import { PRIVATE_PAIRING_SCOPE } from "../constants/scopes.js";
import { COMPETITION_CLASS, RESTRICTED_COMPETITION_CLASSES, RULE_VISIBILITY } from "../constants/enums.js";
import { PERSONAL_PREFERENCE_CONSTRAINT_TYPES } from "../constants/constraintTypes.js";
import { normalizePrivatePairingRules } from "../contracts/normalizePrivatePairingRule.js";
import { mapLegacyFounderConstraint } from "../mappers/legacyFounderMapping.js";
import { validatePrivatePairingRules } from "../validation/validatePrivatePairingRule.js";
import { detectPrivatePairingConflicts } from "../conflicts/detectPrivatePairingConflicts.js";

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
  const scoped = merged.filter(
    (rule) => isRuleActiveAt(rule, contextTimeMs) && doesRuleMatchScope(rule, context)
  );

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

  const conflicts = detectPrivatePairingConflicts(validation.rules, { teamSize });

  const versions = validation.rules.map((rule) => String(rule.ruleSetVersion || "1"));
  const ruleSetVersion = versions.sort().slice(-1)[0] || String(context.ruleSetVersion || "1");

  return {
    ok: validation.ok && conflicts.ok,
    rules: validation.rules,
    blockedByPolicy,
    validationErrors: validation.errors,
    fatalConflicts: conflicts.fatalConflicts,
    warnings: [...validation.warnings, ...conflicts.warnings],
    ruleSetVersion,
  };
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
