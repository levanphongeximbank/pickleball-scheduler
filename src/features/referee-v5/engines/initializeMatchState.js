import { COURT_END } from "../constants/courtEnds.js";
import { MATCH_STATUS } from "../constants/eventTypes.js";
import { MATCH_TYPE } from "../constants/matchTypes.js";
import { SCORING_FORMAT } from "../constants/scoringFormats.js";
import { createInitialMatchStateSkeleton } from "../domain/matchState.js";
import { validateInitializeConfig, validateServeSnapshot } from "../domain/matchValidation.js";
import { recomputeServeContext } from "./receiverResolver.js";

export function initializeMatchState(config) {
  const errors = validateInitializeConfig(config);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  let state = createInitialMatchStateSkeleton(config);

  state.teams.teamA = {
    teamId: String(config.teams.teamA.teamId),
    courtEnd: config.teams.teamA.courtEnd || COURT_END.NEAR_END,
    score: 0,
    players: config.teams.teamA.players.map((player) => ({
      playerId: String(player.playerId),
      logicalServiceSide: player.logicalServiceSide,
    })),
  };

  state.teams.teamB = {
    teamId: String(config.teams.teamB.teamId),
    courtEnd: config.teams.teamB.courtEnd || COURT_END.FAR_END,
    score: 0,
    players: config.teams.teamB.players.map((player) => ({
      playerId: String(player.playerId),
      logicalServiceSide: player.logicalServiceSide,
    })),
  };

  state.servingTeamId = String(config.firstServingTeamId);
  state.servingPlayerId = String(config.firstServingPlayerId);
  state.serverNumber =
    config.matchType === MATCH_TYPE.SINGLES ? null : Number(config.initialServerNumber) || 1;

  const serveContext = recomputeServeContext(state);
  if (!serveContext.ok) {
    return { ok: false, errors: [serveContext.error] };
  }

  state = {
    ...serveContext.state,
    status: MATCH_STATUS.NOT_STARTED,
    scoringFormat: config.scoringFormat || SCORING_FORMAT.SIDE_OUT,
    ...(config.scoringSystem ? { scoringSystem: String(config.scoringSystem) } : {}),
    ...(config.scoringVariant ? { scoringVariant: String(config.scoringVariant) } : {}),
    ...(config.ruleSetId ? { ruleSetId: String(config.ruleSetId) } : {}),
    pointsToWin: Number(config.pointsToWin) || 11,
    winBy: Number(config.winBy) || 2,
    maximumScore: config.maximumScore ?? null,
    bestOf: Number(config.bestOf) || 1,
  };

  const snapshotCheck = validateServeSnapshot(state, serveContext.receiverResult);
  if (!snapshotCheck.ok) {
    return { ok: false, errors: [snapshotCheck.error] };
  }

  return { ok: true, state };
}

export function startMatchFromInitialized(state) {
  if (state.status !== MATCH_STATUS.NOT_STARTED) {
    return { ok: false, error: "ALREADY_STARTED" };
  }
  return {
    ok: true,
    state: {
      ...state,
      status: MATCH_STATUS.IN_PROGRESS,
    },
  };
}
