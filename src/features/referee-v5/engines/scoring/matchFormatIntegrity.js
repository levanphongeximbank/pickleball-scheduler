import { ScoringFormatError } from "./scoringFormatError.js";

/** Official match format fields locked after initialize / START_MATCH (ADR-R-004). */
export const IMMUTABLE_MATCH_FORMAT_FIELDS = Object.freeze([
  "scoringSystem",
  "scoringVariant",
  "scoringFormat",
  "ruleSetId",
  "pointsToWin",
  "winBy",
  "freezeRule",
  "serverNumberRule",
  "matchType",
  "bestOf",
  "maximumScore",
]);

/**
 * Snapshot of official format for immutability checks during live play and replay.
 */
export function extractMatchFormatSnapshot(state) {
  const snapshot = {};
  for (const field of IMMUTABLE_MATCH_FORMAT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(state, field)) {
      snapshot[field] = state[field];
    }
  }
  return snapshot;
}

function valuesEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a == null && b == null) {
    return true;
  }
  return String(a) === String(b);
}

/**
 * Reject event payloads that attempt to change the official match format.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function assertEventDoesNotMutateFormat(formatSnapshot, event) {
  const payload = event?.payload;
  if (!payload || typeof payload !== "object") {
    return { ok: true };
  }

  for (const field of IMMUTABLE_MATCH_FORMAT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(formatSnapshot, field)) {
      return {
        ok: false,
        error: "SCORING_FORMAT_IMMUTABLE",
      };
    }
    if (!valuesEqual(payload[field], formatSnapshot[field])) {
      return {
        ok: false,
        error: "SCORING_FORMAT_IMMUTABLE",
      };
    }
  }

  return { ok: true };
}

/**
 * Ensure state still carries the same official format after an engine transition.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function assertStateFormatUnchanged(formatSnapshot, nextState) {
  for (const field of Object.keys(formatSnapshot)) {
    if (!valuesEqual(nextState[field], formatSnapshot[field])) {
      return {
        ok: false,
        error: "SCORING_FORMAT_IMMUTABLE",
      };
    }
  }
  return { ok: true };
}

/**
 * Resolve strategy from official initial state — never from event payload.
 * @throws {ScoringFormatError}
 */
export function assertStrategyResolvable(state, resolveFn) {
  try {
    return resolveFn(state);
  } catch (error) {
    if (error instanceof ScoringFormatError) {
      throw error;
    }
    throw error;
  }
}
