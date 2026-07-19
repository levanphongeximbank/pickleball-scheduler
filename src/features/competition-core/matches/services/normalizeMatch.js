/**
 * Phase 3F — normalize + validate CompetitionMatch (runtime-local).
 * Does not calculate winners or validate scores.
 */

import {
  createCompetitionMatch,
  createMatchSide,
} from "../contracts/competitionMatch.js";
import { isMatchStatus } from "../enums/matchStatuses.js";
import { isMatchCompletionReason } from "../enums/completionReasons.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";
import {
  buildMatchSideId,
  createMatchIdentity,
} from "../contracts/matchIdentity.js";
import { assertMatchSidesValid } from "./sideValidation.js";

/**
 * @param {import('../contracts/competitionMatch.js').CompetitionMatch} match
 * @param {{ allowSingleSide?: boolean, requireLineupReferences?: boolean }} [options]
 * @returns {import('../contracts/competitionMatch.js').CompetitionMatch}
 */
export function normalizeAndValidateMatch(match, options = {}) {
  if (!match || typeof match !== "object") {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "Match must be an object",
      {}
    );
  }

  const normalized = createCompetitionMatch(match);

  if (!normalized.competitionId) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "competitionId is required",
      {}
    );
  }
  if (!normalized.contextId) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "contextId is required",
      { competitionId: normalized.competitionId }
    );
  }
  if (!isMatchStatus(normalized.status)) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_UNSUPPORTED_STATUS,
      "Unsupported match status",
      { status: normalized.status }
    );
  }
  if (!isMatchCompletionReason(normalized.completionReason)) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "Unsupported completionReason",
      { completionReason: normalized.completionReason }
    );
  }
  if (
    typeof normalized.revision !== "number" ||
    !Number.isInteger(normalized.revision) ||
    normalized.revision < 1
  ) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "revision must be an integer >= 1",
      { revision: normalized.revision }
    );
  }

  const identity = createMatchIdentity({
    competitionId: normalized.competitionId,
    contextId: normalized.contextId,
  });

  if (normalized.identityKey && normalized.identityKey !== identity.key) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_IDENTITY_MISMATCH,
      "identityKey does not match deterministic match identity",
      {
        expected: identity.key,
        actual: normalized.identityKey,
      }
    );
  }

  const sides = (normalized.sides || []).map((side) => {
    const identityKey =
      side.identityKey && String(side.identityKey).trim()
        ? String(side.identityKey)
        : buildMatchSideId({
            matchIdentityKey: identity.key,
            sideKey: side.sideKey,
          });
    return createMatchSide(
      {
        ...side,
        id: side.id || identityKey,
        identityKey,
      },
      { matchIdentityKey: identity.key }
    );
  });

  assertMatchSidesValid(sides, {
    allowSingleSide: options.allowSingleSide === true,
  });

  if (options.requireLineupReferences === true) {
    for (const side of sides) {
      if (!side.lineupReference) {
        throw new MatchRuntimeError(
          MATCH_RUNTIME_ERROR_CODE.MATCH_LINEUP_MISMATCH,
          "lineupReference required on each side",
          { sideKey: side.sideKey }
        );
      }
    }
  }

  // Explicit: never derive winners from scores — scores are not Core fields.
  if (
    Object.prototype.hasOwnProperty.call(normalized.metadata || {}, "scoreA") ||
    Object.prototype.hasOwnProperty.call(normalized.metadata || {}, "scoreB")
  ) {
    // Allow opaque metadata passthrough; Core does not interpret scores.
  }

  return createCompetitionMatch({
    ...normalized,
    id: normalized.id || identity.key,
    identityKey: identity.key,
    sides,
  });
}
