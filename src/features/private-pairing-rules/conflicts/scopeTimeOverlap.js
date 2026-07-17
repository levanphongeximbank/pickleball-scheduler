import { PRIVATE_PAIRING_SCOPE } from "../constants/scopes.js";

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {boolean}
 */
export function timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
  const toMs = (value) => {
    if (value == null || value === "") {
      return null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    const ms = Date.parse(String(value));
    return Number.isFinite(ms) ? ms : null;
  };

  const a0 = toMs(aStart) ?? Number.NEGATIVE_INFINITY;
  const a1 = toMs(aEnd) ?? Number.POSITIVE_INFINITY;
  const b0 = toMs(bStart) ?? Number.NEGATIVE_INFINITY;
  const b1 = toMs(bEnd) ?? Number.POSITIVE_INFINITY;

  return a0 < b1 && b0 < a1;
}

const S = PRIVATE_PAIRING_SCOPE;

const SUPER_ADMIN_SCOPES = new Set([S.GLOBAL, S.TENANT]);
const TOURNAMENT_SCOPES = new Set([S.TOURNAMENT, S.TOURNAMENT_EVENT]);
const CLUB_SCOPES = new Set([S.CLUB, S.VENUE]);
const SESSION_SCOPES = new Set([S.DAILY_PLAY_SESSION, S.ROUND, S.MATCH_DAY]);

/**
 * @param {string} scopeType
 * @returns {'SUPER_ADMIN'|'TOURNAMENT'|'CLUB'|'SESSION'|'OTHER'}
 */
function scopeFamily(scopeType) {
  if (SUPER_ADMIN_SCOPES.has(scopeType)) return "SUPER_ADMIN";
  if (TOURNAMENT_SCOPES.has(scopeType)) return "TOURNAMENT";
  if (CLUB_SCOPES.has(scopeType)) return "CLUB";
  if (SESSION_SCOPES.has(scopeType)) return "SESSION";
  return "OTHER";
}

/**
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} rule
 * @param {Record<string, unknown>} [context]
 */
function ruleScopeIdMatchesContext(rule, context = {}) {
  const map = {
    [S.TENANT]: context.tenantId,
    [S.CLUB]: context.clubId,
    [S.VENUE]: context.venueId || context.clubId,
    [S.TOURNAMENT]: context.tournamentId,
    [S.TOURNAMENT_EVENT]: context.eventId || context.tournamentEventId,
    [S.DAILY_PLAY_SESSION]: context.sessionId || context.dailyPlaySessionId,
    [S.ROUND]: context.roundId,
    [S.MATCH_DAY]: context.matchDayId,
  };
  if (rule.scopeType === S.GLOBAL) {
    return true;
  }
  const expected = map[rule.scopeType];
  if (expected == null || expected === "") {
    return false;
  }
  return String(rule.scopeId || "") === String(expected);
}

/**
 * Whether `ancestor` scope contains `descendant` within the active ResolveContext.
 * Both rules must already be applicable to the context (scopeId matches).
 *
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} ancestor
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} descendant
 * @param {Record<string, unknown>} context
 */
function scopeAncestorContains(ancestor, descendant, context = {}) {
  const ancestorFamily = scopeFamily(ancestor.scopeType);
  const descendantFamily = scopeFamily(descendant.scopeType);
  if (ancestorFamily === descendantFamily) {
    return false;
  }

  if (!ruleScopeIdMatchesContext(ancestor, context) || !ruleScopeIdMatchesContext(descendant, context)) {
    return false;
  }

  if (ancestorFamily === "SUPER_ADMIN") {
    return descendantFamily !== "OTHER";
  }

  if (ancestorFamily === "TOURNAMENT" && descendantFamily === "CLUB") {
    return Boolean(context.tournamentId && context.clubId);
  }

  if (ancestorFamily === "TOURNAMENT" && descendantFamily === "SESSION") {
    return Boolean(
      context.tournamentId &&
        (context.sessionId || context.roundId || context.matchDayId || context.dailyPlaySessionId)
    );
  }

  if (ancestorFamily === "CLUB" && descendantFamily === "SESSION") {
    return Boolean(
      context.clubId &&
        (context.sessionId || context.roundId || context.matchDayId || context.dailyPlaySessionId)
    );
  }

  return false;
}

/**
 * Legacy flat overlap (no context): same type+id, or either GLOBAL.
 *
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} a
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} b
 * @returns {boolean}
 */
export function scopesOverlap(a, b) {
  if (a.scopeType === S.GLOBAL || b.scopeType === S.GLOBAL) {
    return true;
  }
  if (a.scopeType !== b.scopeType) {
    return false;
  }
  return String(a.scopeId || "") === String(b.scopeId || "");
}

/**
 * Hierarchical scope overlap within a ResolveContext.
 * GLOBAL/SUPER_ADMIN overlaps all lower scopes in context.
 * TOURNAMENT overlaps CLUB/SESSION in the same tournament context.
 * CLUB overlaps SESSION in the same club context.
 *
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} a
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} b
 * @param {Record<string, unknown>} [context]
 */
export function scopesOverlapInContext(a, b, context = {}) {
  if (a.scopeType === S.GLOBAL || b.scopeType === S.GLOBAL) {
    return true;
  }
  if (a.scopeType === S.TENANT || b.scopeType === S.TENANT) {
    if (a.scopeType === S.TENANT && b.scopeType === S.TENANT) {
      return String(a.scopeId || "") === String(b.scopeId || "");
    }
    const tenantRule = a.scopeType === S.TENANT ? a : b;
    const other = a.scopeType === S.TENANT ? b : a;
    return (
      ruleScopeIdMatchesContext(tenantRule, context) &&
      ruleScopeIdMatchesContext(other, context)
    );
  }

  if (a.scopeType === b.scopeType) {
    return String(a.scopeId || "") === String(b.scopeId || "");
  }

  return (
    scopeAncestorContains(a, b, context) ||
    scopeAncestorContains(b, a, context)
  );
}

/**
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} a
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} b
 * @param {Record<string, unknown>} [context]
 */
export function rulesOverlapInContext(a, b, context) {
  const overlap = context && Object.keys(context).length > 0
    ? scopesOverlapInContext(a, b, context)
    : scopesOverlap(a, b);
  return overlap && timeRangesOverlap(a.startAt, a.endAt, b.startAt, b.endAt);
}
