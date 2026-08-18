import { COURT_END } from "../constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../constants/courtSides.js";
import { MATCH_TYPE } from "../constants/matchTypes.js";
import { SCORING_FORMAT } from "../constants/scoringFormats.js";
import { initializeMatchState } from "../engines/initializeMatchState.js";
import { REFEREE_V5_ERROR, createPersistenceError } from "../persistence/errors.js";
import { mapAdapterBFailure } from "./authorizeMatchExecutionInit.js";

function playerIdsFromSide(side) {
  const ids = Array.isArray(side?.participantIds)
    ? side.participantIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (ids.length > 0) return ids;
  if (side?.entryId) return [String(side.entryId).trim()];
  if (side?.teamId) return [String(side.teamId).trim()];
  return [];
}

function assignServiceSides(playerIds) {
  return playerIds.map((playerId, index) => ({
    playerId,
    logicalServiceSide:
      index === 0
        ? LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT
        : LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT,
  }));
}

function mapScoringFormat(rules) {
  const sys = String(rules?.scoringSystem || "").toUpperCase();
  if (sys === "RALLY") return SCORING_FORMAT.RALLY;
  return SCORING_FORMAT.SIDE_OUT;
}

function resolveMatchType(matchContext, playersA, playersB) {
  const raw = String(matchContext?.matchType || "").toLowerCase();
  if (raw.includes("single")) return MATCH_TYPE.SINGLES;
  if (raw.includes("double")) return MATCH_TYPE.DOUBLES;
  if (playersA.length === 1 && playersB.length === 1) return MATCH_TYPE.SINGLES;
  if (playersA.length === 2 && playersB.length === 2) return MATCH_TYPE.DOUBLES;
  return null;
}

export function resolveAdapterBEvidence({ adapter, adapterRequest, tenantId, tournamentId, matchId, competitionMode }) {
  const request = {
    ...(adapterRequest && typeof adapterRequest === "object" ? adapterRequest : {}),
    tenantId,
    competitionId: tournamentId,
    matchId,
  };

  let competition;
  let matchContext;
  let participants;
  let scoringRules;
  let preStart;
  try {
    competition = adapter.getCompetitionContext(request);
    matchContext = adapter.getMatchContext(request);
    participants = adapter.getParticipants(request);
    scoringRules = adapter.getScoringRules(request);
    preStart = adapter.validatePreStart(request);
  } catch (err) {
    return mapAdapterBFailure(err);
  }

  if (String(competition?.tenantId || "") !== tenantId) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  if (String(matchContext?.tenantId || "") !== tenantId) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  if (String(competition?.competitionId || "") !== tournamentId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.MATCH_STATE_CONFLICT,
      "Tournament binding không khớp canonical match."
    );
  }
  if (String(matchContext?.competitionId || "") !== tournamentId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.MATCH_STATE_CONFLICT,
      "Tournament binding không khớp canonical match."
    );
  }
  if (String(matchContext?.matchId || "") !== matchId) {
    return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
  }
  if (
    competitionMode &&
    competition?.competitionMode &&
    String(competition.competitionMode) !== competitionMode
  ) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "competitionMode không khớp Adapter B."
    );
  }
  if (!preStart || preStart.ok !== true) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      (preStart?.blockers && preStart.blockers[0]?.message) ||
        "Adapter B pre-start validation failed."
    );
  }

  return {
    ok: true,
    evidence: {
      competition,
      matchContext,
      participants,
      scoringRules,
    },
  };
}

export function buildInitialStateFromAdapterB(evidence, input) {
  const sides = Array.isArray(evidence?.participants?.sides)
    ? evidence.participants.sides
    : [];
  if (sides.length !== 2) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Adapter B phải cung cấp đúng hai phía tham dự."
    );
  }

  const playersA = playerIdsFromSide(sides[0]);
  const playersB = playerIdsFromSide(sides[1]);
  if (playersA.length === 0 || playersB.length === 0) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Thiếu VĐV/entry cho Referee V5 initial state."
    );
  }

  const matchType = resolveMatchType(evidence.matchContext, playersA, playersB);
  if (!matchType) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Không suy ra được matchType singles/doubles từ Adapter B."
    );
  }
  if (matchType === MATCH_TYPE.SINGLES && (playersA.length !== 1 || playersB.length !== 1)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Singles yêu cầu đúng một VĐV mỗi phía."
    );
  }
  if (matchType === MATCH_TYPE.DOUBLES && (playersA.length !== 2 || playersB.length !== 2)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Doubles yêu cầu đúng hai VĐV mỗi phía."
    );
  }

  const teamAId = String(sides[0].teamId || sides[0].entryId || "SIDE_A").trim();
  const teamBId = String(sides[1].teamId || sides[1].entryId || "SIDE_B").trim();
  const scoring = evidence.scoringRules || {};
  const config = {
    matchId: String(input.matchId),
    matchType,
    scoringFormat: mapScoringFormat(scoring),
    pointsToWin: Number(scoring.pointsToWin) || 11,
    winBy: Number(scoring.winBy) || 2,
    bestOf: Number(scoring.bestOfGames || scoring.bestOf) || 1,
    maximumScore: scoring.maximumScore ?? null,
    teams: {
      teamA: {
        teamId: teamAId,
        courtEnd: COURT_END.NEAR_END,
        players: assignServiceSides(playersA),
      },
      teamB: {
        teamId: teamBId,
        courtEnd: COURT_END.FAR_END,
        players: assignServiceSides(playersB),
      },
    },
    firstServingTeamId: teamAId,
    firstServingPlayerId: playersA[0],
    initialServerNumber: matchType === MATCH_TYPE.DOUBLES ? 1 : undefined,
  };

  const init = initializeMatchState(config);
  if (!init.ok) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      (init.errors || []).join(" ") || "initializeMatchState failed."
    );
  }

  return {
    ok: true,
    state: init.state,
    teamAId,
    teamBId,
    config,
  };
}
