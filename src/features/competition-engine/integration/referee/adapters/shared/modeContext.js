/**
 * Shared fail-closed mode-state guards for Referee Adapter B translators.
 */

import {
  COMPETITION_REFEREE_MODE_TO_TYPE,
  REFEREE_ADAPTER_ERROR_CODE,
} from "../../constants.js";
import { requireAdapterRequest } from "../../contract.js";
import { failRefereeAdapter } from "../../errors.js";
import { freezeClone, isNonEmptyString, isPlainObject } from "../../helpers.js";

/**
 * @param {unknown} state
 * @param {unknown} request
 * @param {string} expectedMode
 */
export function loadModeCompetitionState(state, request, expectedMode) {
  const req = requireAdapterRequest(request);
  if (!isPlainObject(state)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Mode competition state is required",
      { competitionMode: expectedMode }
    );
  }
  const tenantId = String(state.tenantId || "").trim();
  const competitionId = String(state.competitionId || "").trim();
  if (!tenantId || !competitionId) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Mode state must include tenantId and competitionId",
      { competitionMode: expectedMode }
    );
  }
  if (req.tenantId !== tenantId) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
      "Adapter request tenant does not match competition tenant",
      { tenantId: req.tenantId, expectedTenantId: tenantId }
    );
  }
  if (req.competitionId !== competitionId) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Unknown competition for mode adapter",
      { competitionId: req.competitionId, expectedCompetitionId: competitionId }
    );
  }
  const stateMode = String(state.competitionMode || expectedMode).trim().toUpperCase();
  if (stateMode && stateMode !== expectedMode) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      `Mode state competitionMode mismatch: expected ${expectedMode}`,
      { competitionMode: stateMode, expectedMode }
    );
  }
  return { req, state: freezeClone(state), tenantId, competitionId };
}

/**
 * @param {object} state
 * @param {string|null} matchId
 * @returns {object}
 */
export function requireModeMatch(state, matchId) {
  if (!isNonEmptyString(matchId)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
      "matchId is required",
      {}
    );
  }
  const id = String(matchId).trim();
  const matches = isPlainObject(state.matches) ? state.matches : null;
  if (!matches || !isPlainObject(matches[id])) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
      `Unknown match: ${id}`,
      { matchId: id }
    );
  }
  return freezeClone({ ...matches[id], matchId: id });
}

/**
 * @param {unknown} sides
 * @returns {object[]}
 */
export function normalizeParticipantSides(sides) {
  if (!Array.isArray(sides) || sides.length !== 2) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Exactly two participant sides are required",
      { sideCount: Array.isArray(sides) ? sides.length : 0 }
    );
  }
  return sides.map((side, index) => {
    if (!isPlainObject(side)) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
        "Participant side must be a plain object",
        { index }
      );
    }
    const sideKey =
      isNonEmptyString(side.sideKey) || isNonEmptyString(side.side)
        ? String(side.sideKey || side.side).trim().toUpperCase()
        : index === 0
          ? "A"
          : "B";
    const participantIds = Array.isArray(side.participantIds)
      ? side.participantIds.map((id) => String(id))
      : [];
    return freezeClone({
      sideKey,
      entryId: isNonEmptyString(side.entryId) ? String(side.entryId).trim() : null,
      teamId: isNonEmptyString(side.teamId) ? String(side.teamId).trim() : null,
      participantIds,
    });
  });
}

/**
 * Build sides from Daily Play team player id arrays.
 * @param {object} match
 */
export function sidesFromDailyPlayMatch(match) {
  const teamA = Array.isArray(match.teamAPlayerIds)
    ? match.teamAPlayerIds.map(String)
    : Array.isArray(match.sides?.[0]?.participantIds)
      ? match.sides[0].participantIds.map(String)
      : [];
  const teamB = Array.isArray(match.teamBPlayerIds)
    ? match.teamBPlayerIds.map(String)
    : Array.isArray(match.sides?.[1]?.participantIds)
      ? match.sides[1].participantIds.map(String)
      : [];
  return normalizeParticipantSides([
    {
      sideKey: "A",
      entryId: match.entryAId || null,
      teamId: null,
      participantIds: teamA,
    },
    {
      sideKey: "B",
      entryId: match.entryBId || null,
      teamId: null,
      participantIds: teamB,
    },
  ]);
}

/**
 * Build sides from Internal/Official entry match.
 * @param {object} match
 */
export function sidesFromIndividualMatch(match) {
  if (Array.isArray(match.sides) && match.sides.length === 2) {
    return normalizeParticipantSides(match.sides);
  }
  const entryA = String(match.entryAId || "").trim();
  const entryB = String(match.entryBId || "").trim();
  if (!entryA || !entryB) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Individual match requires entryAId and entryBId (or sides)",
      { matchId: match.matchId || null }
    );
  }
  return normalizeParticipantSides([
    {
      sideKey: "A",
      entryId: entryA,
      teamId: null,
      participantIds: Array.isArray(match.participantIdsA)
        ? match.participantIdsA.map(String)
        : entryA
          ? [entryA]
          : [],
    },
    {
      sideKey: "B",
      entryId: entryB,
      teamId: null,
      participantIds: Array.isArray(match.participantIdsB)
        ? match.participantIdsB.map(String)
        : entryB
          ? [entryB]
          : [],
    },
  ]);
}

/**
 * Build sides from Team matchup / sub-match.
 * @param {object} matchup
 * @param {object|null} subMatch
 */
export function sidesFromTeamMatchup(matchup, subMatch = null) {
  if (Array.isArray(subMatch?.sides) && subMatch.sides.length === 2) {
    return normalizeParticipantSides(subMatch.sides);
  }
  if (Array.isArray(matchup.sides) && matchup.sides.length === 2) {
    return normalizeParticipantSides(matchup.sides);
  }
  const teamAId = String(matchup.teamAId || "").trim();
  const teamBId = String(matchup.teamBId || "").trim();
  if (!teamAId || !teamBId) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Team matchup requires teamAId and teamBId (or sides)",
      { matchupId: matchup.matchupId || matchup.id || null }
    );
  }
  const lineupA = Array.isArray(subMatch?.lineupA)
    ? subMatch.lineupA.map(String)
    : Array.isArray(matchup.lineupA)
      ? matchup.lineupA.map(String)
      : [];
  const lineupB = Array.isArray(subMatch?.lineupB)
    ? subMatch.lineupB.map(String)
    : Array.isArray(matchup.lineupB)
      ? matchup.lineupB.map(String)
      : [];
  return normalizeParticipantSides([
    {
      sideKey: "A",
      entryId: null,
      teamId: teamAId,
      participantIds: lineupA,
    },
    {
      sideKey: "B",
      entryId: null,
      teamId: teamBId,
      participantIds: lineupB,
    },
  ]);
}

/**
 * @param {string} mode
 */
export function competitionTypeForMode(mode) {
  return COMPETITION_REFEREE_MODE_TO_TYPE[mode] || null;
}

/**
 * Resolve mode state from factory options.
 * @param {object} options
 * @param {unknown} request
 */
export function resolveInjectedModeState(options, request) {
  if (typeof options.getModeState === "function") {
    return options.getModeState(request);
  }
  if (isPlainObject(options.modeState)) {
    return options.modeState;
  }
  // Phase 2B: command/request may carry modeState for canonical composition
  if (isPlainObject(request) && isPlainObject(request.modeState)) {
    return request.modeState;
  }
  failRefereeAdapter(
    REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
    "Mode adapter requires modeState or getModeState",
    {}
  );
}
