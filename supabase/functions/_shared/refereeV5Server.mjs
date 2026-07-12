/* Referee V5 trusted server bundle */

// src/features/referee-v5/constants/eventTypes.js
var MATCH_EVENT_TYPE = Object.freeze({
  START_MATCH: "START_MATCH",
  TEAM_A_WON_RALLY: "TEAM_A_WON_RALLY",
  TEAM_B_WON_RALLY: "TEAM_B_WON_RALLY",
  SWITCH_ENDS: "SWITCH_ENDS",
  UNDO_LAST_EVENT: "UNDO_LAST_EVENT",
  START_TIMEOUT: "START_TIMEOUT",
  END_TIMEOUT: "END_TIMEOUT",
  PAUSE_MATCH: "PAUSE_MATCH",
  RESUME_MATCH: "RESUME_MATCH",
  DECLARE_FORFEIT: "DECLARE_FORFEIT",
  EVENT_REVERTED: "EVENT_REVERTED"
});
var DOMAIN_EVENT_TYPE = Object.freeze({
  POINT_AWARDED: "POINT_AWARDED",
  PLAYERS_SWITCHED: "PLAYERS_SWITCHED",
  SECOND_SERVER_ACTIVATED: "SECOND_SERVER_ACTIVATED",
  SIDE_OUT: "SIDE_OUT",
  SERVE_CHANGED: "SERVE_CHANGED",
  ENDS_SWITCHED: "ENDS_SWITCHED",
  GAME_COMPLETED: "GAME_COMPLETED",
  MATCH_COMPLETED: "MATCH_COMPLETED"
});
var MATCH_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  PAUSED: "paused",
  LOCKED: "locked",
  COMPLETED: "completed"
});

// src/features/referee-v5/domain/matchEvents.js
var ENGINE_ERROR = Object.freeze({
  VERSION_CONFLICT: "VERSION_CONFLICT",
  SEQUENCE_GAP: "SEQUENCE_GAP",
  INVALID_EVENT: "INVALID_EVENT",
  MATCH_LOCKED: "MATCH_LOCKED",
  MATCH_NOT_STARTED: "MATCH_NOT_STARTED",
  INVALID_RALLY_WINNER: "INVALID_RALLY_WINNER",
  UNDO_NOT_ALLOWED: "UNDO_NOT_ALLOWED",
  VALIDATION_FAILED: "VALIDATION_FAILED"
});
function createEngineError(code, message) {
  return { ok: false, code, error: message || code };
}
function createEngineSuccess(payload) {
  return { ok: true, ...payload };
}
function normalizeIncomingEvent(event) {
  return {
    eventId: String(event?.eventId || ""),
    eventType: String(event?.eventType || ""),
    sequence: Number(event?.sequence),
    expectedVersion: Number(event?.expectedVersion),
    actorId: String(event?.actorId || ""),
    payload: event?.payload && typeof event.payload === "object" ? { ...event.payload } : {}
  };
}

// src/features/referee-v5/constants/scoringFormats.js
var SCORING_FORMAT = Object.freeze({
  SIDE_OUT: "side_out",
  RALLY: "rally"
});
var RALLY_VARIANT = Object.freeze({
  BASIC: "basic",
  MLP: "mlp"
});
var DEFAULT_SIDE_OUT_CONFIG = Object.freeze({
  pointsToWin: 11,
  winBy: 2,
  maximumScore: null,
  sideOutInitialServerSide: "RIGHT_SERVICE_COURT"
});
var DEFAULT_RALLY_CONFIG = Object.freeze({
  pointsToWin: 21,
  winBy: 2,
  maximumScore: null,
  sideSwitchAt: 11,
  /** OWNER DECISION REQUIRED: full rally serve rotation order */
  rallyServeRotation: "winning_team_serves"
});

// src/features/referee-v5/constants/matchTypes.js
var MATCH_TYPE = Object.freeze({
  SINGLES: "singles",
  DOUBLES: "doubles"
});

// src/features/referee-v5/constants/stateSchema.js
var STATE_SCHEMA_VERSION = 1;

// src/features/referee-v5/constants/courtEnds.js
var COURT_END = Object.freeze({
  NEAR_END: "NEAR_END",
  FAR_END: "FAR_END"
});
var OPPOSITE_COURT_END = Object.freeze({
  [COURT_END.NEAR_END]: COURT_END.FAR_END,
  [COURT_END.FAR_END]: COURT_END.NEAR_END
});

// src/features/referee-v5/domain/matchState.js
function cloneMatchState(state) {
  return JSON.parse(JSON.stringify(state));
}
function getTeamSideKey(state, teamId) {
  if (String(state.teams.teamA.teamId) === String(teamId)) {
    return "teamA";
  }
  if (String(state.teams.teamB.teamId) === String(teamId)) {
    return "teamB";
  }
  return "";
}
function getTeamById(state, teamId) {
  const key = getTeamSideKey(state, teamId);
  return key ? state.teams[key] : null;
}
function getOpposingTeamId(state, teamId) {
  const key = getTeamSideKey(state, teamId);
  if (key === "teamA") {
    return state.teams.teamB.teamId;
  }
  if (key === "teamB") {
    return state.teams.teamA.teamId;
  }
  return "";
}
function findPlayerInState(state, playerId) {
  for (const side of ["teamA", "teamB"]) {
    const team = state.teams[side];
    const player = team.players.find((item) => String(item.playerId) === String(playerId));
    if (player) {
      return {
        ...player,
        teamId: team.teamId,
        courtEnd: team.courtEnd
      };
    }
  }
  return null;
}
function incrementVersion(state) {
  return {
    ...state,
    version: Number(state.version || 0) + 1,
    lastEventSequence: Number(state.lastEventSequence || 0) + 1
  };
}
function listAllPlayerIds(state) {
  return [
    ...state.teams.teamA.players.map((player) => player.playerId),
    ...state.teams.teamB.players.map((player) => player.playerId)
  ];
}
function getPartner(team, playerId) {
  return team.players.find((player) => String(player.playerId) !== String(playerId)) || null;
}

// src/features/referee-v5/constants/courtSides.js
var LOGICAL_SERVICE_SIDE = Object.freeze({
  LEFT_SERVICE_COURT: "LEFT_SERVICE_COURT",
  RIGHT_SERVICE_COURT: "RIGHT_SERVICE_COURT"
});
var OPPOSITE_SERVICE_SIDE = Object.freeze({
  [LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT]: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT,
  [LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT]: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT
});
function flipLogicalServiceSide(side) {
  return OPPOSITE_SERVICE_SIDE[side] || side;
}

// src/features/referee-v5/domain/matchValidation.js
function validateServeSnapshot(state, receiverResult) {
  if (!receiverResult?.ok) {
    return receiverResult;
  }
  const server = findPlayerInState(state, state.servingPlayerId);
  const receiver = findPlayerInState(state, state.receivingPlayerId);
  if (!server || !receiver) {
    return { ok: false, error: "SERVER_OR_RECEIVER_MISSING" };
  }
  if (String(server.teamId) === String(receiver.teamId)) {
    return { ok: false, error: "RECEIVER_SAME_TEAM" };
  }
  if (state.matchType !== MATCH_TYPE.SINGLES && server.logicalServiceSide !== receiver.logicalServiceSide) {
    return { ok: false, error: "RECEIVER_NOT_DIAGONAL" };
  }
  if (String(server.courtEnd) === String(receiver.courtEnd)) {
    return { ok: false, error: "RECEIVER_SAME_END" };
  }
  const knownIds = new Set(listAllPlayerIds(state));
  if (!knownIds.has(state.servingPlayerId) || !knownIds.has(state.receivingPlayerId)) {
    return { ok: false, error: "PLAYER_NOT_IN_MATCH" };
  }
  return { ok: true };
}
function validateEventPreconditions(state, event) {
  if (state.status === "locked" && event.eventType !== "UNDO_LAST_EVENT") {
    return { ok: false, error: "MATCH_LOCKED" };
  }
  if (Number(event.expectedVersion) !== Number(state.version)) {
    return { ok: false, error: "VERSION_CONFLICT" };
  }
  if (Number(event.sequence) !== Number(state.lastEventSequence) + 1) {
    return { ok: false, error: "SEQUENCE_GAP" };
  }
  return { ok: true };
}

// src/features/referee-v5/engines/receiverResolver.js
function resolveReceivingPlayer(state) {
  const server = findPlayerInState(state, state.servingPlayerId);
  if (!server) {
    return { ok: false, error: "SERVER_NOT_FOUND" };
  }
  const opposingTeamId = getOpposingTeamId(state, server.teamId);
  const opposingTeam = getTeamById(state, opposingTeamId);
  if (!opposingTeam) {
    return { ok: false, error: "OPPONENT_NOT_FOUND" };
  }
  let receiver;
  if (state.matchType === MATCH_TYPE.SINGLES) {
    receiver = opposingTeam.players[0];
  } else {
    const legalSide = server.logicalServiceSide;
    receiver = opposingTeam.players.find(
      (player) => player.logicalServiceSide === legalSide
    );
  }
  if (!receiver) {
    return { ok: false, error: "RECEIVER_NOT_FOUND" };
  }
  if (String(receiver.playerId) === String(server.playerId)) {
    return { ok: false, error: "RECEIVER_SAME_AS_SERVER" };
  }
  return {
    ok: true,
    receivingPlayerId: receiver.playerId,
    receivingTeamId: opposingTeamId,
    receivingLogicalServiceSide: receiver.logicalServiceSide,
    servingLogicalServiceSide: server.logicalServiceSide,
    servingCourtEnd: server.courtEnd,
    receivingCourtEnd: opposingTeam.courtEnd
  };
}
function applyReceiverToState(state, receiverResult) {
  if (!receiverResult?.ok) {
    return state;
  }
  return {
    ...state,
    receivingPlayerId: receiverResult.receivingPlayerId,
    receivingTeamId: receiverResult.receivingTeamId
  };
}
function recomputeServeContext(state) {
  const receiverResult = resolveReceivingPlayer(state);
  if (!receiverResult.ok) {
    return { ok: false, error: receiverResult.error, state };
  }
  const nextState = applyReceiverToState(state, receiverResult);
  return { ok: true, state: nextState, receiverResult };
}

// src/features/referee-v5/engines/initializeMatchState.js
function startMatchFromInitialized(state) {
  if (state.status !== MATCH_STATUS.NOT_STARTED) {
    return { ok: false, error: "ALREADY_STARTED" };
  }
  return {
    ok: true,
    state: {
      ...state,
      status: MATCH_STATUS.IN_PROGRESS
    }
  };
}

// src/features/referee-v5/constants/viewModes.js
var VIEW_MODE = Object.freeze({
  REFEREE_PHYSICAL_VIEW: "REFEREE_PHYSICAL_VIEW",
  TEAM_FIXED_VIEW: "TEAM_FIXED_VIEW"
});
var SCREEN_POSITION = Object.freeze({
  SCREEN_TOP_LEFT: "SCREEN_TOP_LEFT",
  SCREEN_TOP_RIGHT: "SCREEN_TOP_RIGHT",
  SCREEN_BOTTOM_LEFT: "SCREEN_BOTTOM_LEFT",
  SCREEN_BOTTOM_RIGHT: "SCREEN_BOTTOM_RIGHT"
});

// src/features/referee-v5/engines/courtPositionEngine.js
function swapTeamCourtEnds(state) {
  const next = cloneMatchState(state);
  const teamAEnd = next.teams.teamA.courtEnd;
  next.teams.teamA.courtEnd = next.teams.teamB.courtEnd;
  next.teams.teamB.courtEnd = teamAEnd;
  return next;
}
function switchPartnersOnTeam(state, teamId) {
  const next = cloneMatchState(state);
  const key = String(next.teams.teamA.teamId) === String(teamId) ? "teamA" : "teamB";
  const team = next.teams[key];
  team.players = team.players.map((player) => ({
    ...player,
    logicalServiceSide: flipLogicalServiceSide(player.logicalServiceSide)
  }));
  return next;
}
function setPlayerLogicalSide(state, teamId, playerId, logicalServiceSide) {
  const next = cloneMatchState(state);
  const key = String(next.teams.teamA.teamId) === String(teamId) ? "teamA" : "teamB";
  next.teams[key].players = next.teams[key].players.map(
    (player) => String(player.playerId) === String(playerId) ? { ...player, logicalServiceSide } : player
  );
  return next;
}

// src/features/referee-v5/engines/sideOutScoringEngine.js
function checkGameComplete(state, config = {}) {
  const pointsToWin = Number(config.pointsToWin ?? state.pointsToWin) || 11;
  const winBy = Number(config.winBy ?? state.winBy) || 2;
  const maximumScore = config.maximumScore ?? state.maximumScore;
  const scoreA = state.teams.teamA.score;
  const scoreB = state.teams.teamB.score;
  const leader = Math.max(scoreA, scoreB);
  const trailer = Math.min(scoreA, scoreB);
  if (leader < pointsToWin) {
    return false;
  }
  if (maximumScore != null && leader >= maximumScore) {
    return true;
  }
  return leader - trailer >= winBy;
}
function pickInitialServerForTeam(state, teamId, preferredSide = LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT) {
  const team = getTeamById(state, teamId);
  if (!team) {
    return null;
  }
  const onPreferred = team.players.find(
    (player) => player.logicalServiceSide === preferredSide
  );
  return onPreferred?.playerId || team.players[0]?.playerId || null;
}
function activateServer2(state, servingTeamId) {
  const team = getTeamById(state, servingTeamId);
  const partner = getPartner(team, state.servingPlayerId);
  if (!partner) {
    return { ok: false, error: "PARTNER_NOT_FOUND" };
  }
  let next = cloneMatchState(state);
  next.servingPlayerId = partner.playerId;
  next.serverNumber = 2;
  const context = recomputeServeContext(next);
  if (!context.ok) {
    return context;
  }
  return {
    ok: true,
    state: context.state,
    generatedEvents: [DOMAIN_EVENT_TYPE.SECOND_SERVER_ACTIVATED, DOMAIN_EVENT_TYPE.SERVE_CHANGED]
  };
}
function performSideOut(state, newServingTeamId, config) {
  const preferredSide = config.sideOutInitialServerSide || LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT;
  const newServerId = pickInitialServerForTeam(state, newServingTeamId, preferredSide);
  if (!newServerId) {
    return { ok: false, error: "SIDE_OUT_SERVER_NOT_FOUND" };
  }
  let next = cloneMatchState(state);
  next.servingTeamId = String(newServingTeamId);
  next.servingPlayerId = String(newServerId);
  next.serverNumber = 1;
  const context = recomputeServeContext(next);
  if (!context.ok) {
    return context;
  }
  return {
    ok: true,
    state: context.state,
    generatedEvents: [DOMAIN_EVENT_TYPE.SIDE_OUT, DOMAIN_EVENT_TYPE.SERVE_CHANGED]
  };
}
function applySideOutScoringEvent(state, winningTeamId, config = {}) {
  const generatedEvents = [];
  let next = cloneMatchState(state);
  if (String(winningTeamId) === String(next.servingTeamId)) {
    const key = getTeamSideKey(next, winningTeamId);
    next.teams[key].score += 1;
    generatedEvents.push(DOMAIN_EVENT_TYPE.POINT_AWARDED);
    next = switchPartnersOnTeam(next, winningTeamId);
    generatedEvents.push(DOMAIN_EVENT_TYPE.PLAYERS_SWITCHED);
    const context = recomputeServeContext(next);
    if (!context.ok) {
      return context;
    }
    next = context.state;
    generatedEvents.push(DOMAIN_EVENT_TYPE.SERVE_CHANGED);
    if (checkGameComplete(next, config)) {
      generatedEvents.push(DOMAIN_EVENT_TYPE.GAME_COMPLETED);
    }
    return { ok: true, state: next, generatedEvents };
  }
  if (Number(next.serverNumber) === 1) {
    return activateServer2(next, next.servingTeamId);
  }
  const newServingTeamId = winningTeamId;
  const sideOutResult = performSideOut(next, newServingTeamId, config);
  if (!sideOutResult.ok) {
    return sideOutResult;
  }
  return {
    ok: true,
    state: sideOutResult.state,
    generatedEvents: [...generatedEvents, ...sideOutResult.generatedEvents]
  };
}
function applySideOutRallyByTeamKey(state, teamKey, config) {
  const teamId = state.teams[teamKey].teamId;
  return applySideOutScoringEvent(state, teamId, config);
}

// src/features/referee-v5/engines/rallyScoringEngine.js
function applyRallyScoringEvent(state, winningTeamId, config = {}) {
  const generatedEvents = [DOMAIN_EVENT_TYPE.POINT_AWARDED];
  let next = cloneMatchState(state);
  const key = getTeamSideKey(next, winningTeamId);
  if (!key) {
    return { ok: false, error: "INVALID_WINNING_TEAM" };
  }
  next.teams[key].score += 1;
  const wasServing = String(next.servingTeamId) === String(winningTeamId);
  if (!wasServing) {
    const rightPlayer = next.teams[key].players.find(
      (player) => player.logicalServiceSide === LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT
    );
    next.servingTeamId = String(winningTeamId);
    next.servingPlayerId = String(rightPlayer?.playerId || next.teams[key].players[0].playerId);
    next.serverNumber = 1;
    generatedEvents.push(DOMAIN_EVENT_TYPE.SERVE_CHANGED);
  } else {
    next = switchPartnersOnTeam(next, winningTeamId);
    generatedEvents.push(DOMAIN_EVENT_TYPE.PLAYERS_SWITCHED);
  }
  const sideSwitchAt = Number(config.sideSwitchAt ?? 11);
  const totalPoints = next.teams.teamA.score + next.teams.teamB.score;
  if (sideSwitchAt > 0 && totalPoints === sideSwitchAt) {
    generatedEvents.push(DOMAIN_EVENT_TYPE.ENDS_SWITCHED);
  }
  const context = recomputeServeContext(next);
  if (!context.ok) {
    return context;
  }
  next = context.state;
  if (checkGameComplete(next, config)) {
    generatedEvents.push(DOMAIN_EVENT_TYPE.GAME_COMPLETED);
  }
  return { ok: true, state: next, generatedEvents };
}
function applyRallyScoringByTeamKey(state, teamKey, config) {
  const teamId = state.teams[teamKey].teamId;
  return applyRallyScoringEvent(state, teamId, config);
}

// src/features/referee-v5/engines/singlesScoringEngine.js
function serviceSideForScore(score) {
  return Number(score) % 2 === 0 ? LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT : LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT;
}
function alignServerToScoreSide(state) {
  const team = getTeamById(state, state.servingTeamId);
  if (!team) {
    return state;
  }
  const requiredSide = serviceSideForScore(team.score);
  const server = findPlayerInState(state, state.servingPlayerId);
  if (!server || server.logicalServiceSide === requiredSide) {
    return state;
  }
  return setPlayerLogicalSide(state, state.servingTeamId, state.servingPlayerId, requiredSide);
}
function applySinglesSideOutEvent(state, winningTeamId, config = {}) {
  const generatedEvents = [];
  let next = cloneMatchState(state);
  if (String(winningTeamId) === String(next.servingTeamId)) {
    const key = getTeamSideKey(next, winningTeamId);
    next.teams[key].score += 1;
    generatedEvents.push(DOMAIN_EVENT_TYPE.POINT_AWARDED);
    next = alignServerToScoreSide(next);
    const context2 = recomputeServeContext(next);
    if (!context2.ok) {
      return context2;
    }
    next = context2.state;
    generatedEvents.push(DOMAIN_EVENT_TYPE.SERVE_CHANGED);
    if (checkGameComplete(next, config)) {
      generatedEvents.push(DOMAIN_EVENT_TYPE.GAME_COMPLETED);
    }
    return { ok: true, state: next, generatedEvents };
  }
  const newServingTeamId = winningTeamId;
  const team = getTeamById(next, newServingTeamId);
  next.servingTeamId = String(newServingTeamId);
  next.servingPlayerId = String(team.players[0].playerId);
  next.serverNumber = null;
  next = alignServerToScoreSide(next);
  const context = recomputeServeContext(next);
  if (!context.ok) {
    return context;
  }
  return {
    ok: true,
    state: context.state,
    generatedEvents: [
      ...generatedEvents,
      DOMAIN_EVENT_TYPE.SIDE_OUT,
      DOMAIN_EVENT_TYPE.SERVE_CHANGED
    ]
  };
}
function applySinglesRallyEvent(state, winningTeamId, config = {}) {
  const generatedEvents = [DOMAIN_EVENT_TYPE.POINT_AWARDED];
  let next = cloneMatchState(state);
  const key = getTeamSideKey(next, winningTeamId);
  next.teams[key].score += 1;
  next.servingTeamId = String(winningTeamId);
  const team = getTeamById(next, winningTeamId);
  next.servingPlayerId = String(team.players[0].playerId);
  next.serverNumber = null;
  next = alignServerToScoreSide(next);
  const context = recomputeServeContext(next);
  if (!context.ok) {
    return context;
  }
  if (checkGameComplete(next, config)) {
    generatedEvents.push(DOMAIN_EVENT_TYPE.GAME_COMPLETED);
  }
  return { ok: true, state: context.state, generatedEvents };
}
function applySinglesScoringEvent(state, winningTeamId, config = {}) {
  if (state.scoringFormat === "rally") {
    return applySinglesRallyEvent(state, winningTeamId, config);
  }
  return applySinglesSideOutEvent(state, winningTeamId, config);
}

// src/features/referee-v5/engines/switchEndsEngine.js
function applySwitchEnds(state) {
  const beforeServer = state.servingPlayerId;
  const beforeReceiver = state.receivingPlayerId;
  const beforeServerNumber = state.serverNumber;
  const beforeScoreA = state.teams.teamA.score;
  const beforeScoreB = state.teams.teamB.score;
  const beforeSides = {
    teamA: state.teams.teamA.players.map((player) => ({ ...player })),
    teamB: state.teams.teamB.players.map((player) => ({ ...player }))
  };
  let next = swapTeamCourtEnds(cloneMatchState(state));
  if (String(next.servingPlayerId) !== String(beforeServer) || String(next.receivingPlayerId) !== String(beforeReceiver)) {
    return { ok: false, error: "ENDS_SWITCHED_CHANGED_SERVE_IDENTITIES" };
  }
  if (next.serverNumber !== beforeServerNumber) {
    return { ok: false, error: "ENDS_SWITCHED_CHANGED_SERVER_NUMBER" };
  }
  if (next.teams.teamA.score !== beforeScoreA || next.teams.teamB.score !== beforeScoreB) {
    return { ok: false, error: "ENDS_SWITCHED_CHANGED_SCORE" };
  }
  for (const side of ["teamA", "teamB"]) {
    for (let index = 0; index < next.teams[side].players.length; index += 1) {
      if (next.teams[side].players[index].logicalServiceSide !== beforeSides[side][index].logicalServiceSide) {
        return { ok: false, error: "ENDS_SWITCHED_CHANGED_LOGICAL_SIDES" };
      }
    }
  }
  return {
    ok: true,
    state: next,
    generatedEvents: [DOMAIN_EVENT_TYPE.ENDS_SWITCHED]
  };
}

// src/features/referee-v5/engines/stateReplayEngine.js
function rebuildMatchState(initialState, events = [], config = {}) {
  let state = cloneMatchState(initialState);
  const applied = [];
  for (const event of events) {
    if (event.eventType === MATCH_EVENT_TYPE.EVENT_REVERTED) {
      continue;
    }
    const replayEvent = {
      ...event,
      expectedVersion: state.version,
      sequence: state.lastEventSequence + 1
    };
    const result = applyMatchEvent(state, replayEvent, config, { skipLockedCheck: false });
    if (!result.ok) {
      return { ok: false, error: result.error, appliedCount: applied.length };
    }
    state = result.nextState;
    applied.push(event.eventType);
  }
  return { ok: true, state, appliedCount: applied.length };
}

// src/features/referee-v5/engines/undoEngine.js
function undoLastEvent(state, eventHistory = [], config = {}) {
  if (state.status === MATCH_STATUS.LOCKED) {
    return { ok: false, error: "MATCH_LOCKED" };
  }
  const applicable = eventHistory.filter(
    (event) => event.eventType !== MATCH_EVENT_TYPE.EVENT_REVERTED
  );
  if (applicable.length === 0) {
    return { ok: false, error: "UNDO_NOT_ALLOWED" };
  }
  const initialState = cloneMatchState(config.initialState || config.baseState);
  if (!initialState) {
    return { ok: false, error: "MISSING_INITIAL_STATE" };
  }
  const withoutLast = applicable.slice(0, -1);
  const revertedEvent = applicable[applicable.length - 1];
  const rebuild = rebuildMatchState(initialState, withoutLast, config);
  if (!rebuild.ok) {
    return rebuild;
  }
  const revertRecord = {
    eventId: `revert-${revertedEvent.eventId || revertedEvent.sequence}`,
    eventType: MATCH_EVENT_TYPE.EVENT_REVERTED,
    sequence: state.lastEventSequence + 1,
    expectedVersion: state.version,
    actorId: revertedEvent.actorId || "",
    payload: {
      revertedEventId: revertedEvent.eventId,
      revertedEventType: revertedEvent.eventType,
      revertedSequence: revertedEvent.sequence
    }
  };
  const nextHistory = [...eventHistory, revertRecord];
  return {
    ok: true,
    nextState: {
      ...rebuild.state,
      version: state.version + 1,
      lastEventSequence: state.lastEventSequence + 1
    },
    revertEvent: revertRecord,
    eventHistory: nextHistory
  };
}

// src/features/referee-v5/engines/matchStateEngine.js
function assertValidServeSnapshot(state) {
  const receiverResult = resolveReceivingPlayer(state);
  return validateServeSnapshot(state, receiverResult);
}
function applyRallyWin(state, teamKey, config) {
  const teamId = state.teams[teamKey].teamId;
  if (state.matchType === MATCH_TYPE.SINGLES) {
    return applySinglesScoringEvent(state, teamId, config);
  }
  if (state.scoringFormat === SCORING_FORMAT.RALLY) {
    return applyRallyScoringByTeamKey(state, teamKey, config);
  }
  return applySideOutRallyByTeamKey(state, teamKey, config);
}
function applyMatchEvent(state, rawEvent, config = {}, options = {}) {
  const event = normalizeIncomingEvent(rawEvent);
  const working = cloneMatchState(state);
  if (!options.skipLockedCheck && working.status === MATCH_STATUS.LOCKED) {
    return createEngineError("MATCH_LOCKED", "Tr\u1EADn \u0111\xE3 kh\xF3a.");
  }
  const pre = validateEventPreconditions(working, event);
  if (!pre.ok) {
    return createEngineError(pre.error, pre.error);
  }
  switch (event.eventType) {
    case MATCH_EVENT_TYPE.START_MATCH: {
      if (working.status !== MATCH_STATUS.NOT_STARTED) {
        return createEngineError("INVALID_EVENT", "START_MATCH invalid.");
      }
      const started = startMatchFromInitialized(working);
      if (!started.ok) {
        return createEngineError("INVALID_EVENT", started.error);
      }
      return createEngineSuccess({
        nextState: incrementVersion(started.state),
        generatedEvents: [MATCH_EVENT_TYPE.START_MATCH],
        domainWarnings: []
      });
    }
    case MATCH_EVENT_TYPE.TEAM_A_WON_RALLY:
    case MATCH_EVENT_TYPE.TEAM_B_WON_RALLY: {
      if (working.status !== MATCH_STATUS.IN_PROGRESS) {
        return createEngineError("MATCH_NOT_STARTED", "Tr\u1EADn ch\u01B0a b\u1EAFt \u0111\u1EA7u.");
      }
      const teamKey = event.eventType === MATCH_EVENT_TYPE.TEAM_A_WON_RALLY ? "teamA" : "teamB";
      const ruleConfig = buildRuleConfig(working, config);
      const rallyResult = applyRallyWin(working, teamKey, ruleConfig);
      if (!rallyResult.ok) {
        return createEngineError("VALIDATION_FAILED", rallyResult.error);
      }
      const snapshotCheck = assertValidServeSnapshot(rallyResult.state);
      if (!snapshotCheck.ok) {
        return createEngineError("VALIDATION_FAILED", snapshotCheck.error);
      }
      return createEngineSuccess({
        nextState: incrementVersion(rallyResult.state),
        generatedEvents: ["RALLY_WON", ...rallyResult.generatedEvents],
        domainWarnings: []
      });
    }
    case MATCH_EVENT_TYPE.SWITCH_ENDS: {
      if (working.status !== MATCH_STATUS.IN_PROGRESS) {
        return createEngineError("MATCH_NOT_STARTED", "Ch\u01B0a th\u1EC3 \u0111\u1ED5i s\xE2n.");
      }
      const switchResult = applySwitchEnds(working);
      if (!switchResult.ok) {
        return createEngineError("VALIDATION_FAILED", switchResult.error);
      }
      return createEngineSuccess({
        nextState: incrementVersion(switchResult.state),
        generatedEvents: switchResult.generatedEvents,
        domainWarnings: []
      });
    }
    case MATCH_EVENT_TYPE.START_TIMEOUT:
    case MATCH_EVENT_TYPE.END_TIMEOUT:
      return createEngineSuccess({
        nextState: incrementVersion(working),
        generatedEvents: [event.eventType],
        domainWarnings: []
      });
    case MATCH_EVENT_TYPE.PAUSE_MATCH: {
      if (working.status !== MATCH_STATUS.IN_PROGRESS) {
        return createEngineError("INVALID_EVENT", "PAUSE_MATCH invalid.");
      }
      return createEngineSuccess({
        nextState: { ...incrementVersion(working), status: MATCH_STATUS.PAUSED },
        generatedEvents: [MATCH_EVENT_TYPE.PAUSE_MATCH],
        domainWarnings: []
      });
    }
    case MATCH_EVENT_TYPE.RESUME_MATCH: {
      if (working.status !== MATCH_STATUS.PAUSED) {
        return createEngineError("INVALID_EVENT", "RESUME_MATCH invalid.");
      }
      return createEngineSuccess({
        nextState: { ...incrementVersion(working), status: MATCH_STATUS.IN_PROGRESS },
        generatedEvents: [MATCH_EVENT_TYPE.RESUME_MATCH],
        domainWarnings: []
      });
    }
    case MATCH_EVENT_TYPE.UNDO_LAST_EVENT: {
      if (!options.eventHistory || !options.initialState) {
        return createEngineError("MISSING_HISTORY", "UNDO requires eventHistory and initialState.");
      }
      const undoResult = undoLastEvent(working, options.eventHistory, {
        initialState: options.initialState,
        baseState: options.initialState,
        ...config
      });
      if (!undoResult.ok) {
        return createEngineError(undoResult.error, undoResult.error);
      }
      const context = recomputeServeContext(undoResult.nextState);
      if (!context.ok) {
        return createEngineError(context.error, context.error);
      }
      return createEngineSuccess({
        nextState: {
          ...context.state,
          version: undoResult.nextState.version,
          lastEventSequence: undoResult.nextState.lastEventSequence
        },
        generatedEvents: [MATCH_EVENT_TYPE.EVENT_REVERTED],
        domainWarnings: [],
        eventHistory: undoResult.eventHistory
      });
    }
    case MATCH_EVENT_TYPE.DECLARE_FORFEIT:
      return createEngineSuccess({
        nextState: {
          ...incrementVersion(working),
          status: MATCH_STATUS.COMPLETED
        },
        generatedEvents: [MATCH_EVENT_TYPE.DECLARE_FORFEIT, DOMAIN_EVENT_TYPE.MATCH_COMPLETED],
        domainWarnings: []
      });
    default:
      return createEngineError("INVALID_EVENT", `Unsupported event: ${event.eventType}`);
  }
}
function buildRuleConfig(state, overrides = {}) {
  return {
    pointsToWin: overrides.pointsToWin ?? state.pointsToWin,
    winBy: overrides.winBy ?? state.winBy,
    maximumScore: overrides.maximumScore ?? state.maximumScore,
    sideOutInitialServerSide: overrides.sideOutInitialServerSide,
    sideSwitchAt: overrides.sideSwitchAt
  };
}

// src/features/referee-v5/engines/matchCommandDispatcher.js
function dispatchMatchCommand({
  state,
  command,
  history = [],
  config = {},
  initialState
}) {
  const event = normalizeIncomingEvent(command);
  const baseInitial = initialState ? cloneMatchState(initialState) : null;
  if (event.eventType === MATCH_EVENT_TYPE.UNDO_LAST_EVENT) {
    return dispatchUndoCommand(state, event, history, config, baseInitial);
  }
  const result = applyMatchEvent(state, event, config);
  if (!result.ok) {
    return {
      ok: false,
      code: result.code || result.error,
      error: result.error
    };
  }
  return {
    ok: true,
    nextState: result.nextState,
    generatedEvents: result.generatedEvents,
    domainWarnings: result.domainWarnings || [],
    eventHistory: [...history, event]
  };
}
function dispatchUndoCommand(state, event, history, config, initialState) {
  const pre = validateEventPreconditions(state, event);
  if (!pre.ok) {
    return createEngineError(pre.error, pre.error);
  }
  if (state.status === MATCH_STATUS.LOCKED) {
    return createEngineError("MATCH_LOCKED", "Tr\u1EADn \u0111\xE3 kh\xF3a.");
  }
  if (!initialState) {
    return createEngineError("MISSING_INITIAL_STATE", "Thi\u1EBFu initialState cho undo.");
  }
  const undoResult = undoLastEvent(state, history, {
    initialState,
    baseState: initialState,
    ...config
  });
  if (!undoResult.ok) {
    return createEngineError(undoResult.error, undoResult.error);
  }
  const context = recomputeServeContext(undoResult.nextState);
  if (!context.ok) {
    return createEngineError(context.error, context.error);
  }
  const nextState = {
    ...context.state,
    version: undoResult.nextState.version,
    lastEventSequence: undoResult.nextState.lastEventSequence
  };
  return {
    ok: true,
    nextState,
    generatedEvents: [MATCH_EVENT_TYPE.EVENT_REVERTED],
    domainWarnings: [],
    eventHistory: undoResult.eventHistory,
    revertEvent: undoResult.revertEvent
  };
}

// src/features/referee-v5/persistence/auditLog.js
var AUDIT_ACTIONS = Object.freeze({
  "START_MATCH": "referee.match.started",
  "TEAM_A_WON_RALLY": "referee.rally.recorded",
  "TEAM_B_WON_RALLY": "referee.rally.recorded",
  "SWITCH_ENDS": "referee.ends.switched",
  "UNDO_LAST_EVENT": "referee.event.reverted",
  "PAUSE_MATCH": "referee.match.paused",
  "RESUME_MATCH": "referee.match.resumed",
  "DECLARE_FORFEIT": "referee.forfeit.declared",
  "FINALIZE_MATCH": "referee.result.confirmed",
  "OVERRIDE_RESULT": "referee.result.overridden"
});
function buildAuditEntry({
  tenantId,
  tournamentId,
  matchId,
  actorId,
  actorRole,
  commandType,
  beforeVersion,
  afterVersion,
  reason = null
}) {
  return {
    action: AUDIT_ACTIONS[commandType] || `referee.command.${String(commandType).toLowerCase()}`,
    tenant_id: tenantId,
    tournament_id: tournamentId,
    match_id: matchId,
    actor_id: actorId,
    actor_role: actorRole,
    command_type: commandType,
    before_version: beforeVersion,
    after_version: afterVersion,
    reason,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// src/features/referee-v5/persistence/matchStateSerializer.js
function serializeMatchState(state) {
  return JSON.parse(JSON.stringify(state));
}
function deserializeMatchState(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return cloneMatchState(payload);
}
function buildMatchStateId({ tenantId, tournamentId, matchId }) {
  return `${tenantId}::${tournamentId}::${matchId}`;
}

// src/features/referee-v5/persistence/canonicalStateHash.js
function canonicalStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
}
function hashCanonicalValue(value) {
  return digest(canonicalStringify(value));
}
function hashMatchStateCanonical(state) {
  return hashCanonicalValue(serializeMatchState(state));
}
function buildRequestHash(parts) {
  return hashCanonicalValue(parts);
}
function digest(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}

// src/features/referee-v5/persistence/errors.js
var REFEREE_V5_ERROR = Object.freeze({
  MATCH_NOT_FOUND: "MATCH_NOT_FOUND",
  REFEREE_NOT_ASSIGNED: "REFEREE_NOT_ASSIGNED",
  ASSIGNMENT_EXPIRED: "ASSIGNMENT_EXPIRED",
  ASSIGNMENT_REVOKED: "ASSIGNMENT_REVOKED",
  MATCH_NOT_STARTED: "MATCH_NOT_STARTED",
  MATCH_LOCKED: "MATCH_LOCKED",
  MATCH_STATE_CONFLICT: "MATCH_STATE_CONFLICT",
  EVENT_SEQUENCE_CONFLICT: "EVENT_SEQUENCE_CONFLICT",
  DUPLICATE_COMMAND: "DUPLICATE_COMMAND",
  INVALID_MATCH_COMMAND: "INVALID_MATCH_COMMAND",
  INVALID_MATCH_STATE: "INVALID_MATCH_STATE",
  UNSUPPORTED_SCORING_FORMAT: "UNSUPPORTED_SCORING_FORMAT",
  UNDO_NOT_ALLOWED: "UNDO_NOT_ALLOWED",
  RESULT_NOT_READY: "RESULT_NOT_READY",
  TENANT_ACCESS_DENIED: "TENANT_ACCESS_DENIED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  FINALIZE_FAILED: "FINALIZE_FAILED",
  IDEMPOTENCY_KEY_REUSE_MISMATCH: "IDEMPOTENCY_KEY_REUSE_MISMATCH",
  APPEND_ONLY_VIOLATION: "APPEND_ONLY_VIOLATION",
  INTERNAL_RPC_FORBIDDEN: "INTERNAL_RPC_FORBIDDEN"
});
var REFEREE_V5_ERROR_VI = Object.freeze({
  [REFEREE_V5_ERROR.MATCH_NOT_FOUND]: "Kh\xF4ng t\xECm th\u1EA5y tr\u1EADn \u0111\u1EA5u.",
  [REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED]: "B\u1EA1n ch\u01B0a \u0111\u01B0\u1EE3c ph\xE2n c\xF4ng tr\u1EADn n\xE0y.",
  [REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED]: "Ph\xE2n c\xF4ng tr\u1ECDng t\xE0i \u0111\xE3 h\u1EBFt h\u1EA1n.",
  [REFEREE_V5_ERROR.ASSIGNMENT_REVOKED]: "Ph\xE2n c\xF4ng tr\u1ECDng t\xE0i \u0111\xE3 b\u1ECB thu h\u1ED3i.",
  [REFEREE_V5_ERROR.MATCH_NOT_STARTED]: "Tr\u1EADn ch\u01B0a b\u1EAFt \u0111\u1EA7u.",
  [REFEREE_V5_ERROR.MATCH_LOCKED]: "Tr\u1EADn \u0111\xE3 kh\xF3a, kh\xF4ng th\u1EC3 thay \u0111\u1ED5i.",
  [REFEREE_V5_ERROR.MATCH_STATE_CONFLICT]: "Tr\u1EA1ng th\xE1i tr\u1EADn \u0111\xE3 thay \u0111\u1ED5i tr\xEAn thi\u1EBFt b\u1ECB kh\xE1c. Vui l\xF2ng t\u1EA3i l\u1EA1i.",
  [REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT]: "Chu\u1ED7i s\u1EF1 ki\u1EC7n kh\xF4ng li\xEAn t\u1EE5c.",
  [REFEREE_V5_ERROR.DUPLICATE_COMMAND]: "L\u1EC7nh \u0111\xE3 \u0111\u01B0\u1EE3c x\u1EED l\xFD tr\u01B0\u1EDBc \u0111\xF3.",
  [REFEREE_V5_ERROR.INVALID_MATCH_COMMAND]: "L\u1EC7nh kh\xF4ng h\u1EE3p l\u1EC7.",
  [REFEREE_V5_ERROR.INVALID_MATCH_STATE]: "Tr\u1EA1ng th\xE1i tr\u1EADn kh\xF4ng h\u1EE3p l\u1EC7.",
  [REFEREE_V5_ERROR.UNSUPPORTED_SCORING_FORMAT]: "Th\u1EC3 th\u1EE9c t\xEDnh \u0111i\u1EC3m ch\u01B0a \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.",
  [REFEREE_V5_ERROR.UNDO_NOT_ALLOWED]: "Kh\xF4ng th\u1EC3 ho\xE0n t\xE1c.",
  [REFEREE_V5_ERROR.RESULT_NOT_READY]: "Tr\u1EADn ch\u01B0a s\u1EB5n s\xE0ng \u0111\u1EC3 ch\u1ED1t k\u1EBFt qu\u1EA3.",
  [REFEREE_V5_ERROR.TENANT_ACCESS_DENIED]: "Kh\xF4ng c\xF3 quy\u1EC1n truy c\u1EADp tenant n\xE0y.",
  [REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH]: "Idempotency key \u0111\xE3 d\xF9ng cho request kh\xE1c.",
  [REFEREE_V5_ERROR.APPEND_ONLY_VIOLATION]: "Kh\xF4ng \u0111\u01B0\u1EE3c s\u1EEDa ho\u1EB7c x\xF3a s\u1EF1 ki\u1EC7n tr\u1EADn \u0111\u1EA5u.",
  [REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN]: "RPC n\u1ED9i b\u1ED9 kh\xF4ng kh\u1EA3 d\u1EE5ng t\u1EEB client."
});
function createPersistenceError(code, message, extra = {}) {
  return {
    ok: false,
    code,
    error: message || REFEREE_V5_ERROR_VI[code] || code,
    ...extra
  };
}
function createPersistenceSuccess(payload) {
  return { ok: true, ...payload };
}

// src/features/referee-v5/persistence/InMemoryMatchRepository.js
function buildCommandEventRecord({
  matchStateId,
  tenantId,
  tournamentId,
  matchId,
  command,
  beforeVersion,
  afterVersion,
  beforeHash,
  afterHash,
  generatedEvents,
  actorRole
}) {
  return {
    id: `evt-${command.eventId || command.sequence}`,
    match_state_id: matchStateId,
    tenant_id: tenantId,
    tournament_id: tournamentId,
    match_id: matchId,
    game_number: 1,
    event_sequence: command.sequence,
    event_type: command.eventType,
    command_type: command.eventType,
    command_payload: command.payload || {},
    state_version_before: beforeVersion,
    state_version_after: afterVersion,
    state_before_hash: beforeHash,
    state_after_hash: afterHash,
    generated_events: generatedEvents || [],
    actor_id: command.actorId,
    actor_role: actorRole,
    client_mutation_id: command.clientMutationId || null,
    idempotency_key: command.idempotencyKey || null,
    reverts_event_id: command.eventType === MATCH_EVENT_TYPE.EVENT_REVERTED ? command.payload?.revertedEventId : null,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// src/features/referee-v5/persistence/refereeV5Authorization.js
function authorizeRefereeAccess(context) {
  const { actor, assignment, tenantId } = context;
  if (!actor?.userId) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED, "Thi\u1EBFu actor.");
  }
  if (String(actor.tenantId) !== String(tenantId)) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  if (actor.role === "SUPER_ADMIN") {
    return { ok: true, role: "SUPER_ADMIN" };
  }
  if (!assignment) {
    return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
  }
  if (assignment.status === "revoked") {
    return createPersistenceError(REFEREE_V5_ERROR.ASSIGNMENT_REVOKED);
  }
  if (assignment.expiresAt && new Date(assignment.expiresAt).getTime() < Date.now()) {
    return createPersistenceError(REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED);
  }
  if (String(assignment.userId) !== String(actor.userId)) {
    return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
  }
  return { ok: true, role: assignment.assignmentRole || "REFEREE" };
}
function canWriteMatch(context) {
  const auth = authorizeRefereeAccess(context);
  if (!auth.ok) {
    return auth;
  }
  if (auth.role === "SCOREKEEPER") {
    return { ok: true, role: auth.role, readOnly: false };
  }
  return auth;
}

// src/features/referee-v5/persistence/validatePersistedState.js
function validatePersistedMatchState(state) {
  if (!state?.teams?.teamA || !state?.teams?.teamB) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Thi\u1EBFu th\xF4ng tin \u0111\u1ED9i.");
  }
  const endA = state.teams.teamA.courtEnd;
  const endB = state.teams.teamB.courtEnd;
  if (endA === endB) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Hai \u0111\u1ED9i c\xF9ng court end.");
  }
  for (const side of ["teamA", "teamB"]) {
    const team = state.teams[side];
    if (state.matchType === MATCH_TYPE.DOUBLES && team.players.length === 2) {
      const sides = team.players.map((p) => p.logicalServiceSide);
      if (sides[0] === sides[1]) {
        return createPersistenceError(
          REFEREE_V5_ERROR.INVALID_MATCH_STATE,
          `${side} c\xF3 hai V\u0110V c\xF9ng logical service side.`
        );
      }
    }
  }
  if (state.matchType === MATCH_TYPE.SINGLES && state.serverNumber != null) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Singles kh\xF4ng c\xF3 server number.");
  }
  if (state.servingPlayerId && state.receivingPlayerId) {
    const receiverResult = resolveReceivingPlayer(state);
    const snapshotCheck = validateServeSnapshot(state, receiverResult);
    if (!snapshotCheck.ok) {
      return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, snapshotCheck.error);
    }
  }
  if (state.status === MATCH_STATUS.LOCKED && !state.lockedAt) {
    return { ok: true, warning: "locked_without_timestamp" };
  }
  const validEnds = [COURT_END.NEAR_END, COURT_END.FAR_END];
  if (!validEnds.includes(endA) || !validEnds.includes(endB)) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Court end kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  const validSides = [LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT, LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT];
  for (const side of ["teamA", "teamB"]) {
    for (const player of state.teams[side].players) {
      if (!validSides.includes(player.logicalServiceSide)) {
        return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Logical service side kh\xF4ng h\u1EE3p l\u1EC7.");
      }
    }
  }
  return { ok: true };
}
function assertVersionIncrement(beforeVersion, afterVersion) {
  if (Number(afterVersion) !== Number(beforeVersion) + 1) {
    return createPersistenceError(
      REFEREE_V5_ERROR.INVALID_MATCH_STATE,
      "State version ph\u1EA3i t\u0103ng \u0111\xFAng 1."
    );
  }
  return { ok: true };
}

// src/features/referee-v5/persistence/validateStateSchema.js
function validateStateSchemaVersion(state) {
  const version = state?.stateSchemaVersion ?? state?.state_schema_version;
  if (version == null) {
    return createPersistenceError(
      REFEREE_V5_ERROR.INVALID_MATCH_STATE,
      "Thi\u1EBFu stateSchemaVersion."
    );
  }
  if (Number(version) !== STATE_SCHEMA_VERSION) {
    return createPersistenceError(
      REFEREE_V5_ERROR.INVALID_MATCH_STATE,
      `stateSchemaVersion kh\xF4ng h\u1ED7 tr\u1EE3: ${version}`
    );
  }
  return { ok: true };
}
function validateCommitTransition({
  liveRow,
  matchId,
  beforeVersion,
  beforeSequence,
  nextState
}) {
  const schemaCheck = validateStateSchemaVersion(nextState);
  if (!schemaCheck.ok) {
    return schemaCheck;
  }
  if (String(nextState.matchId) !== String(matchId)) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "matchId trong state kh\xF4ng kh\u1EDBp.");
  }
  if (liveRow?.teamAId && String(nextState.teams?.teamA?.teamId) !== String(liveRow.teamAId)) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "teamA kh\xF4ng kh\u1EDBp match row.");
  }
  if (liveRow?.teamBId && String(nextState.teams?.teamB?.teamId) !== String(liveRow.teamBId)) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "teamB kh\xF4ng kh\u1EDBp match row.");
  }
  const versionCheck = assertVersionIncrement(beforeVersion, nextState.version);
  if (!versionCheck.ok) {
    return versionCheck;
  }
  if (Number(nextState.lastEventSequence) !== Number(beforeSequence) + 1) {
    return createPersistenceError(
      REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT,
      "Event sequence ph\u1EA3i t\u0103ng \u0111\xFAng 1."
    );
  }
  if (nextState.rallyVariant === RALLY_VARIANT.MLP || nextState.scoringFormat === "mlp_rally") {
    return createPersistenceError(REFEREE_V5_ERROR.UNSUPPORTED_SCORING_FORMAT);
  }
  if (nextState.matchType === MATCH_TYPE.DOUBLES && nextState.serverNumber != null && ![1, 2].includes(Number(nextState.serverNumber))) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Doubles side-out server number kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  if (nextState.status === MATCH_STATUS.LOCKED) {
    return createPersistenceError(REFEREE_V5_ERROR.MATCH_LOCKED);
  }
  return validatePersistedMatchState(nextState);
}

// src/features/referee-v5/persistence/RefereeV5AtomicCommitService.js
var RefereeV5AtomicCommitService = class {
  constructor(repository) {
    this.repository = repository;
    this.commitCallCount = 0;
    this.finalizeCommitCallCount = 0;
  }
  async commitMatchTransition(input) {
    this.commitCallCount += 1;
    const {
      tenantId,
      tournamentId,
      matchId,
      actor,
      assignment,
      expectedStateVersion,
      expectedEventSequence,
      clientMutationId,
      idempotencyKey,
      requestHash,
      commandType,
      commandPayload = {},
      nextState,
      generatedEvents = [],
      stateBeforeHash,
      stateAfterHash
    } = input;
    const auth = canWriteMatch({ actor, assignment, tenantId });
    if (!auth.ok) {
      return auth;
    }
    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    return this.repository.atomicTransaction(matchStateId, async () => {
      const dbAssignment = this.repository.getAssignment({
        tenantId,
        tournamentId,
        matchId,
        userId: actor.userId
      });
      if (!dbAssignment || dbAssignment.status !== "active") {
        return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
      }
      if (dbAssignment.expiresAt && new Date(dbAssignment.expiresAt).getTime() < Date.now()) {
        return createPersistenceError(REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED);
      }
      const cached = this.repository.findIdempotency(matchStateId, idempotencyKey);
      if (cached) {
        if (cached.requestHash && requestHash && cached.requestHash !== requestHash) {
          return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
        }
        if (cached.responsePayload) {
          return createPersistenceSuccess({ duplicate: true, ...cached.responsePayload });
        }
      }
      const live = this.repository.getLiveState(matchStateId);
      if (!live) {
        return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
      }
      if (live.status === MATCH_STATUS.LOCKED) {
        return createPersistenceError(REFEREE_V5_ERROR.MATCH_LOCKED);
      }
      if (Number(expectedStateVersion) !== Number(live.stateVersion)) {
        return createPersistenceError(REFEREE_V5_ERROR.MATCH_STATE_CONFLICT, void 0, {
          currentVersion: live.stateVersion,
          currentSequence: live.lastEventSequence
        });
      }
      if (Number(expectedEventSequence) !== Number(live.lastEventSequence)) {
        return createPersistenceError(REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT, void 0, {
          currentVersion: live.stateVersion,
          currentSequence: live.lastEventSequence
        });
      }
      const transitionCheck = validateCommitTransition({
        liveRow: live,
        matchId,
        beforeVersion: live.stateVersion,
        beforeSequence: live.lastEventSequence,
        nextState
      });
      if (!transitionCheck.ok) {
        return transitionCheck;
      }
      const command = {
        eventId: clientMutationId || `cmd-${Date.now()}`,
        eventType: commandType,
        sequence: Number(expectedEventSequence) + 1,
        expectedVersion: Number(expectedStateVersion),
        actorId: actor.userId,
        clientMutationId,
        idempotencyKey,
        payload: commandPayload
      };
      const eventRecord = buildCommandEventRecord({
        matchStateId,
        tenantId,
        tournamentId,
        matchId,
        command,
        beforeVersion: live.stateVersion,
        afterVersion: nextState.version,
        beforeHash: stateBeforeHash,
        afterHash: stateAfterHash,
        generatedEvents,
        actorRole: auth.role
      });
      const responsePayload = {
        state: nextState,
        stateVersion: nextState.version,
        lastEventSequence: nextState.lastEventSequence,
        generatedEvents,
        stateHash: stateAfterHash || hashMatchStateCanonical(nextState)
      };
      const commit = this.repository.appendEventAndSnapshot({
        matchStateId,
        eventRecord,
        nextState,
        idempotencyRecord: {
          matchId: matchStateId,
          idempotencyKey,
          clientMutationId,
          commandType,
          requestHash,
          status: "applied",
          resultingEventSequence: command.sequence,
          resultingStateVersion: nextState.version,
          responsePayload
        }
      });
      if (!commit.ok) {
        return commit;
      }
      this.repository.appendAudit(
        buildAuditEntry({
          tenantId,
          tournamentId,
          matchId,
          actorId: actor.userId,
          actorRole: auth.role,
          commandType,
          beforeVersion: live.stateVersion,
          afterVersion: nextState.version
        })
      );
      return createPersistenceSuccess(responsePayload);
    });
  }
  async commitMatchFinalization(input) {
    this.finalizeCommitCallCount += 1;
    const {
      tenantId,
      tournamentId,
      matchId,
      actor,
      assignment,
      expectedStateVersion,
      idempotencyKey,
      requestHash,
      revision,
      overrideReason = null,
      isOverride = false,
      outboxEvents = []
    } = input;
    if (isOverride && !overrideReason) {
      return createPersistenceError(REFEREE_V5_ERROR.OVERRIDE_REASON_REQUIRED);
    }
    const auth = canWriteMatch({ actor, assignment, tenantId });
    if (!auth.ok) {
      return auth;
    }
    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    const finalizeKey = `finalize::${idempotencyKey}`;
    return this.repository.atomicTransaction(matchStateId, async () => {
      const cached = this.repository.findIdempotency(matchStateId, finalizeKey);
      if (cached) {
        if (cached.requestHash && requestHash && cached.requestHash !== requestHash) {
          return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
        }
        if (cached.responsePayload) {
          return createPersistenceSuccess({ duplicate: true, ...cached.responsePayload });
        }
      }
      const live = this.repository.getLiveState(matchStateId);
      if (!live) {
        return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
      }
      if (Number(expectedStateVersion) !== Number(live.stateVersion)) {
        return createPersistenceError(REFEREE_V5_ERROR.MATCH_STATE_CONFLICT, void 0, {
          currentVersion: live.stateVersion
        });
      }
      const state = deserializeMatchState(live.statePayload);
      if (state.status !== MATCH_STATUS.COMPLETED && !input.forceComplete) {
        return createPersistenceError(REFEREE_V5_ERROR.RESULT_NOT_READY);
      }
      const saved = this.repository.saveResultRevision(revision);
      if (!saved.ok && !saved.duplicate) {
        return createPersistenceError(REFEREE_V5_ERROR.FINALIZE_FAILED);
      }
      this.repository.lockLiveState(matchStateId, actor.userId);
      for (const outbox of outboxEvents) {
        this.repository.appendOutbox({
          ...outbox,
          tenantId,
          tournamentId,
          matchId,
          idempotencyKey: outbox.idempotencyKey || `${finalizeKey}::${outbox.eventType}`
        });
      }
      const responsePayload = {
        revision: saved.revision || revision,
        locked: true,
        outboxCount: outboxEvents.length
      };
      this.repository.saveIdempotency({
        matchId: matchStateId,
        idempotencyKey: finalizeKey,
        clientMutationId: idempotencyKey,
        commandType: isOverride ? "OVERRIDE_RESULT" : "FINALIZE_MATCH",
        requestHash,
        status: "applied",
        responsePayload
      });
      this.repository.appendAudit(
        buildAuditEntry({
          tenantId,
          tournamentId,
          matchId,
          actorId: actor.userId,
          actorRole: auth.role,
          commandType: isOverride ? "OVERRIDE_RESULT" : "FINALIZE_MATCH",
          beforeVersion: live.stateVersion,
          afterVersion: live.stateVersion,
          reason: overrideReason
        })
      );
      return createPersistenceSuccess(responsePayload);
    });
  }
};
function buildCommandRequestHash({
  commandType,
  payload,
  clientMutationId
}) {
  return buildRequestHash({
    commandType,
    payload: payload || {},
    clientMutationId
  });
}

// src/features/referee-v5/persistence/repoAsync.js
async function repoVal(value) {
  return value instanceof Promise ? value : value;
}

// src/features/referee-v5/persistence/refereeV5TrustBoundary.js
function verifyAccessToken(accessToken) {
  if (!accessToken || typeof accessToken !== "string" || accessToken.length < 8) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED, "Access token kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  if (accessToken === "expired-token") {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED, "Access token \u0111\xE3 h\u1EBFt h\u1EA1n.");
  }
  return { ok: true };
}
function deriveUserIdFromVerifiedToken(accessToken) {
  const check = verifyAccessToken(accessToken);
  if (!check.ok) {
    return check;
  }
  const userId = accessToken.startsWith("jwt:") ? accessToken.slice(4) : "verified-user";
  return { ok: true, userId };
}
function rejectClientIdentityFields(requestBody = {}) {
  const forbidden = ["actorId", "actor_id", "userId", "user_id", "tenantId", "tenant_id", "role"];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(requestBody, key)) {
      return {
        ignored: true,
        fields: forbidden.filter((field) => Object.prototype.hasOwnProperty.call(requestBody, field))
      };
    }
  }
  return { ignored: false, fields: [] };
}
async function resolveTrustedActor({ verifiedUserId, repository, tenantId, tournamentId, matchId }) {
  if (!verifiedUserId) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  const assignment = await repoVal(
    repository.getAssignment({
      tenantId,
      tournamentId,
      matchId,
      userId: verifiedUserId
    })
  );
  if (!assignment) {
    return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
  }
  if (assignment.status === "revoked") {
    return createPersistenceError(REFEREE_V5_ERROR.ASSIGNMENT_REVOKED);
  }
  if (assignment.expiresAt && new Date(assignment.expiresAt).getTime() < Date.now()) {
    return createPersistenceError(REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED);
  }
  return {
    ok: true,
    actor: {
      userId: verifiedUserId,
      tenantId: assignment.tenantId,
      role: assignment.assignmentRole || "REFEREE"
    },
    assignment
  };
}

// src/features/referee-v5/persistence/validateCommandPayload.js
var FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  "team_a_score",
  "team_b_score",
  "teamAScore",
  "teamBScore",
  "serving_team_id",
  "servingTeamId",
  "serving_player_id",
  "servingPlayerId",
  "receiving_player_id",
  "receivingPlayerId",
  "server_number",
  "serverNumber",
  "player_positions",
  "playerPositions",
  "serve_direction",
  "serveDirection",
  "winner_id",
  "winnerId",
  "official_result",
  "officialResult",
  "official_score",
  "officialScore"
]);
function validateMatchCommandPayload(commandType, payload = {}) {
  if (!commandType || typeof commandType !== "string") {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_COMMAND, "Thi\u1EBFu commandType.");
  }
  const allowed = new Set(Object.values(MATCH_EVENT_TYPE));
  if (!allowed.has(commandType)) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_COMMAND, `Command kh\xF4ng h\u1ED7 tr\u1EE3: ${commandType}`);
  }
  if (payload && typeof payload === "object") {
    for (const key of FORBIDDEN_PAYLOAD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        return createPersistenceError(
          REFEREE_V5_ERROR.INVALID_MATCH_COMMAND,
          `Client kh\xF4ng \u0111\u01B0\u1EE3c g\u1EEDi tr\u01B0\u1EDDng ch\xEDnh th\u1EE9c: ${key}`
        );
      }
    }
  }
  if (payload?.rallyVariant === RALLY_VARIANT.MLP || payload?.scoringFormat === "mlp_rally") {
    return createPersistenceError(
      REFEREE_V5_ERROR.UNSUPPORTED_SCORING_FORMAT,
      "MLP rally scoring ch\u01B0a \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3."
    );
  }
  return { ok: true };
}

// src/features/referee-v5/persistence/RefereeV5EdgeCommandHandler.js
var OUTBOX_EVENT_TYPES = Object.freeze([
  "BRACKET_ADVANCE_REQUESTED",
  "STANDINGS_RECALC_REQUESTED",
  "NOTIFICATION_REQUESTED",
  "RATING_EVIDENCE_REQUESTED"
]);
var RefereeV5EdgeCommandHandler = class {
  constructor(repository, atomicCommit = new RefereeV5AtomicCommitService(repository)) {
    this.repository = repository;
    this.atomicCommit = atomicCommit;
  }
  async processMatchCommand({
    accessToken,
    tournamentId,
    matchId,
    commandType,
    payload = {},
    expectedVersion,
    expectedSequence,
    clientMutationId,
    idempotencyKey,
    requestBody = {}
  }) {
    rejectClientIdentityFields(requestBody);
    const tokenResult = deriveUserIdFromVerifiedToken(accessToken);
    if (!tokenResult.ok) {
      return tokenResult;
    }
    const assignmentLookup = await repoVal(
      this.repository.findAssignmentByUserAndMatch({
        userId: tokenResult.userId,
        tournamentId,
        matchId
      })
    );
    if (!assignmentLookup) {
      return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
    }
    const tenantId = assignmentLookup.tenantId;
    const trusted = await resolveTrustedActor({
      verifiedUserId: tokenResult.userId,
      repository: this.repository,
      tenantId,
      tournamentId,
      matchId
    });
    if (!trusted.ok) {
      return trusted;
    }
    const payloadCheck = validateMatchCommandPayload(commandType, payload);
    if (!payloadCheck.ok) {
      return payloadCheck;
    }
    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    const requestHashPreview = buildCommandRequestHash({
      commandType,
      payload,
      clientMutationId
    });
    const cachedCommand = await repoVal(this.repository.findIdempotency(matchStateId, idempotencyKey));
    if (cachedCommand?.responsePayload) {
      if (cachedCommand.requestHash && cachedCommand.requestHash !== requestHashPreview) {
        return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
      }
      return createPersistenceSuccess({ duplicate: true, ...cachedCommand.responsePayload });
    }
    const currentLive = await repoVal(this.repository.getLiveState(matchStateId));
    if (!currentLive) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }
    if (currentLive.status === MATCH_STATUS.LOCKED) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_LOCKED);
    }
    const currentState = deserializeMatchState(currentLive.statePayload);
    const rawEvents = await repoVal(this.repository.getEvents(matchStateId));
    const eventHistory = rawEvents.filter((e) => e.event_type !== MATCH_EVENT_TYPE.EVENT_REVERTED).map((e) => ({
      eventId: e.id,
      eventType: e.command_type,
      sequence: e.event_sequence,
      expectedVersion: e.state_version_before,
      actorId: e.actor_id,
      payload: e.command_payload
    }));
    const command = {
      eventId: clientMutationId || `cmd-${Date.now()}`,
      eventType: commandType,
      sequence: Number(expectedSequence ?? currentLive.lastEventSequence) + 1,
      expectedVersion: Number(expectedVersion ?? currentLive.stateVersion),
      actorId: trusted.actor.userId,
      clientMutationId,
      idempotencyKey,
      payload
    };
    const initialState = await repoVal(this.repository.getInitialState(matchStateId));
    const engineResult = dispatchMatchCommand({
      state: currentState,
      command,
      history: eventHistory,
      initialState
    });
    if (!engineResult.ok) {
      const code = engineResult.code === "VERSION_CONFLICT" ? REFEREE_V5_ERROR.MATCH_STATE_CONFLICT : engineResult.code === "SEQUENCE_GAP" ? REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT : REFEREE_V5_ERROR.INVALID_MATCH_COMMAND;
      return createPersistenceError(code, engineResult.error, {
        currentVersion: currentLive.stateVersion,
        currentSequence: currentLive.lastEventSequence
      });
    }
    const nextState = {
      ...engineResult.nextState,
      stateSchemaVersion: STATE_SCHEMA_VERSION
    };
    const requestHash = buildCommandRequestHash({
      commandType,
      payload,
      clientMutationId
    });
    const recheckCached = await repoVal(this.repository.findIdempotency(matchStateId, idempotencyKey));
    if (recheckCached?.responsePayload) {
      if (recheckCached.requestHash && recheckCached.requestHash !== requestHash) {
        return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
      }
      return createPersistenceSuccess({ duplicate: true, ...recheckCached.responsePayload });
    }
    return this.atomicCommit.commitMatchTransition({
      tenantId,
      tournamentId,
      matchId,
      actor: trusted.actor,
      assignment: trusted.assignment,
      expectedStateVersion: expectedVersion ?? currentLive.stateVersion,
      expectedEventSequence: expectedSequence ?? currentLive.lastEventSequence,
      clientMutationId,
      idempotencyKey,
      requestHash,
      commandType,
      commandPayload: payload,
      nextState,
      generatedEvents: engineResult.generatedEvents,
      stateBefore: currentState,
      stateBeforeHash: hashMatchStateCanonical(currentState),
      stateAfterHash: hashMatchStateCanonical(nextState)
    });
  }
  async processFinalize({
    accessToken,
    tournamentId,
    matchId,
    expectedVersion,
    idempotencyKey,
    overrideReason = null,
    isOverride = false,
    forceComplete = false,
    requestBody = {}
  }) {
    rejectClientIdentityFields(requestBody);
    const tokenResult = deriveUserIdFromVerifiedToken(accessToken);
    if (!tokenResult.ok) {
      return tokenResult;
    }
    const assignmentLookup = await repoVal(
      this.repository.findAssignmentByUserAndMatch({
        userId: tokenResult.userId,
        tournamentId,
        matchId
      })
    );
    if (!assignmentLookup) {
      return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
    }
    const tenantId = assignmentLookup.tenantId;
    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    const finalizeKey = `finalize::${idempotencyKey}`;
    const requestHashPreview = buildCommandRequestHash({
      commandType: isOverride ? "OVERRIDE_RESULT" : "FINALIZE_MATCH",
      payload: { overrideReason, isOverride },
      clientMutationId: idempotencyKey
    });
    const cachedFinalize = await repoVal(this.repository.findIdempotency(matchStateId, finalizeKey));
    if (cachedFinalize?.responsePayload) {
      if (cachedFinalize.requestHash && cachedFinalize.requestHash !== requestHashPreview) {
        return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
      }
      return createPersistenceSuccess({ duplicate: true, ...cachedFinalize.responsePayload });
    }
    const trusted = await resolveTrustedActor({
      verifiedUserId: tokenResult.userId,
      repository: this.repository,
      tenantId,
      tournamentId,
      matchId
    });
    if (!trusted.ok) {
      return trusted;
    }
    const live = await repoVal(this.repository.getLiveState(matchStateId));
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }
    const state = deserializeMatchState(live.statePayload);
    const replayCheck = await this.verifySnapshotMatchesReplay(matchStateId);
    if (!replayCheck.ok) {
      return createPersistenceError(REFEREE_V5_ERROR.FINALIZE_FAILED, "Replay verification failed.");
    }
    const scoreA = state.teams.teamA.score;
    const scoreB = state.teams.teamB.score;
    const winnerTeamId = scoreA === scoreB ? null : scoreA > scoreB ? state.teams.teamA.teamId : state.teams.teamB.teamId;
    const revision = {
      tenantId,
      tournamentId,
      matchId,
      revision: 1,
      status: isOverride ? "OVERRIDDEN" : "CONFIRMED",
      teamAId: state.teams.teamA.teamId,
      teamBId: state.teams.teamB.teamId,
      officialScore: { teamA: scoreA, teamB: scoreB },
      winnerId: winnerTeamId,
      idempotencyKey,
      overrideReason,
      createdBy: trusted.actor.userId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const requestHash = buildCommandRequestHash({
      commandType: isOverride ? "OVERRIDE_RESULT" : "FINALIZE_MATCH",
      payload: { overrideReason, isOverride },
      clientMutationId: idempotencyKey
    });
    const outboxEvents = [
      { eventType: OUTBOX_EVENT_TYPES[0], payload: { matchId, revision: 1 } },
      { eventType: OUTBOX_EVENT_TYPES[1], payload: { matchId } },
      { eventType: OUTBOX_EVENT_TYPES[2], payload: { matchId, type: "result_confirmed" } }
    ];
    return this.atomicCommit.commitMatchFinalization({
      tenantId,
      tournamentId,
      matchId,
      actor: trusted.actor,
      assignment: trusted.assignment,
      expectedStateVersion: expectedVersion ?? live.stateVersion,
      idempotencyKey,
      requestHash,
      revision,
      overrideReason,
      isOverride,
      forceComplete,
      outboxEvents
    });
  }
  async verifySnapshotMatchesReplay(matchStateId) {
    const live = await repoVal(this.repository.getLiveState(matchStateId));
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }
    const initial = await repoVal(this.repository.getInitialState(matchStateId));
    if (!initial) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND, "Missing initial state for replay.");
    }
    const rawEvents = await repoVal(this.repository.getEvents(matchStateId));
    let state = initial;
    let history = [];
    for (const e of rawEvents) {
      const command = {
        eventId: e.id || String(e.event_sequence),
        eventType: e.command_type || e.event_type,
        sequence: e.event_sequence,
        expectedVersion: e.state_version_before,
        actorId: e.actor_id || "",
        payload: e.command_payload?._initialState ? {} : e.command_payload || {}
      };
      const result = dispatchMatchCommand({
        state,
        command,
        history,
        initialState: initial
      });
      if (!result.ok) {
        return { ok: false, error: result.error || result.code };
      }
      state = result.nextState;
      history = result.eventHistory || history;
    }
    const snapshot = deserializeMatchState(live.statePayload);
    const snapshotHash = hashMatchStateCanonical(snapshot);
    const rebuiltHash = hashMatchStateCanonical(state);
    return { ok: snapshotHash === rebuiltHash, snapshot, rebuilt: state, snapshotHash, rebuiltHash };
  }
};

// src/features/referee-v5/persistence/RefereeV5SupabaseRepository.js
var RefereeV5SupabaseRepository = class {
  constructor(serviceClient) {
    this.client = serviceClient;
  }
  async findAssignmentByUserAndMatch({ userId, tournamentId, matchId }) {
    const { data, error } = await this.client.from("referee_assignments").select("*").eq("tournament_id", tournamentId).eq("match_id", matchId).eq("referee_user_id", userId).order("status", { ascending: true }).limit(1).maybeSingle();
    if (error || !data) {
      return null;
    }
    return this.mapAssignment(data);
  }
  async getAssignment({ tenantId, tournamentId, matchId, userId }) {
    const { data, error } = await this.client.from("referee_assignments").select("*").eq("tenant_id", tenantId).eq("tournament_id", tournamentId).eq("match_id", matchId).eq("referee_user_id", userId).maybeSingle();
    if (error || !data) {
      return null;
    }
    return this.mapAssignment(data);
  }
  mapAssignment(row) {
    return {
      tenantId: row.tenant_id,
      tournamentId: row.tournament_id,
      matchId: row.match_id,
      userId: row.referee_user_id,
      assignmentRole: row.role,
      status: row.status,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at
    };
  }
  async getLiveState(matchStateId) {
    const { data, error } = await this.client.from("match_live_states").select("*").eq("id", matchStateId).maybeSingle();
    if (error || !data) {
      return null;
    }
    return {
      tenantId: data.tenant_id,
      tournamentId: data.tournament_id,
      matchId: data.match_id,
      stateVersion: data.state_version ?? data.version ?? 0,
      lastEventSequence: data.last_event_sequence ?? 0,
      status: data.status,
      statePayload: data.state_payload,
      teamAId: data.team_a_id,
      teamBId: data.team_b_id
    };
  }
  async getInitialState(matchStateId) {
    const { data: firstEvent } = await this.client.from("match_events").select("command_payload, state_version_before").eq("match_state_id", matchStateId).eq("state_version_before", 0).order("event_sequence", { ascending: true }).limit(1).maybeSingle();
    if (firstEvent?.command_payload?._initialState) {
      return deserializeMatchState(firstEvent.command_payload._initialState);
    }
    const live = await this.getLiveState(matchStateId);
    if (!live?.statePayload) {
      return null;
    }
    const state = deserializeMatchState(live.statePayload);
    if ((state?.version ?? 0) === 0) {
      return state;
    }
    return null;
  }
  async getEvents(matchStateId) {
    const { data, error } = await this.client.from("match_events").select("*").eq("match_state_id", matchStateId).order("event_sequence", { ascending: true });
    if (error || !data) {
      return [];
    }
    return data.map((row) => ({
      id: row.id,
      event_type: row.event_type,
      command_type: row.command_type || row.event_type,
      event_sequence: row.event_sequence,
      state_version_before: row.state_version_before,
      state_version_after: row.state_version_after,
      command_payload: row.command_payload || row.payload || {},
      actor_id: row.actor_id,
      idempotency_key: row.idempotency_key
    }));
  }
  async findIdempotency(matchStateId, idempotencyKey) {
    if (!idempotencyKey) {
      return null;
    }
    const { data, error } = await this.client.from("match_sync_mutations").select("*").eq("match_state_id", matchStateId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (error || !data) {
      return null;
    }
    return {
      requestHash: data.request_hash,
      responsePayload: data.response_payload,
      status: data.status
    };
  }
  async saveIdempotency() {
    return { ok: true };
  }
  async appendAudit() {
    return { ok: true };
  }
  async atomicTransaction(_matchStateId, fn) {
    return fn();
  }
  async appendEventAndSnapshot() {
    return { ok: false, code: "USE_RPC_COMMIT" };
  }
};

// src/features/referee-v5/persistence/RefereeV5RpcAtomicCommitService.js
var RefereeV5RpcAtomicCommitService = class {
  constructor(repository, rpcClient, rpcFns) {
    this.repository = repository;
    this.rpcClient = rpcClient;
    this.rpcFns = rpcFns;
    this.stagingFault = null;
  }
  setStagingFault(fault) {
    this.stagingFault = fault;
  }
  async commitMatchTransition(input) {
    const {
      tenantId,
      tournamentId,
      matchId,
      actor,
      assignment,
      expectedStateVersion,
      expectedEventSequence,
      clientMutationId,
      idempotencyKey,
      requestHash,
      commandType,
      commandPayload = {},
      nextState,
      generatedEvents = [],
      stateBeforeHash,
      stateAfterHash
    } = input;
    const auth = canWriteMatch({ actor, assignment, tenantId });
    if (!auth.ok) {
      return auth;
    }
    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    const live = await repoVal(this.repository.getLiveState(matchStateId));
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }
    const payload = {
      p_tenant_id: tenantId,
      p_tournament_id: tournamentId,
      p_match_id: matchId,
      p_actor_id: actor.userId,
      p_command_type: commandType,
      p_command_payload: commandPayload,
      p_expected_state_version: expectedStateVersion,
      p_expected_event_sequence: expectedEventSequence,
      p_client_mutation_id: clientMutationId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_next_state: serializeMatchState(nextState),
      p_generated_events: generatedEvents,
      p_state_before_hash: stateBeforeHash,
      p_state_after_hash: stateAfterHash || hashMatchStateCanonical(nextState),
      p_state_before: input.stateBefore ? serializeMatchState(input.stateBefore) : null
    };
    if (this.stagingFault) {
      payload.p_staging_fault = this.stagingFault;
    }
    const { data, error } = await this.rpcClient.rpc(this.rpcFns.COMMIT_TRANSITION, payload);
    if (error) {
      return createPersistenceError(REFEREE_V5_ERROR.VALIDATION_FAILED, error.message);
    }
    if (data?.ok === false) {
      const retryCached = await repoVal(
        this.repository.findIdempotency(matchStateId, idempotencyKey)
      );
      if (retryCached?.responsePayload) {
        if (retryCached.requestHash && retryCached.requestHash !== requestHash) {
          return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
        }
        return createPersistenceSuccess({ duplicate: true, ...retryCached.responsePayload });
      }
      return createPersistenceError(
        data.code || REFEREE_V5_ERROR.VALIDATION_FAILED,
        data.error,
        {
          currentVersion: data.currentVersion,
          currentSequence: data.currentSequence
        }
      );
    }
    if (data?.duplicate) {
      const cachedState = data.state ? deserializeMatchState(data.state) : nextState;
      return createPersistenceSuccess({
        duplicate: true,
        state: cachedState,
        stateVersion: data.stateVersion ?? cachedState?.version,
        lastEventSequence: data.lastEventSequence ?? cachedState?.lastEventSequence,
        stateHash: data.stateHash ?? hashMatchStateCanonical(cachedState),
        generatedEvents: data.generatedEvents ?? generatedEvents
      });
    }
    const committedState = data.state ? deserializeMatchState(data.state) : nextState;
    return createPersistenceSuccess({
      state: committedState,
      stateVersion: data.stateVersion ?? committedState.version,
      lastEventSequence: data.lastEventSequence ?? committedState.lastEventSequence,
      stateHash: data.stateHash ?? hashMatchStateCanonical(committedState),
      generatedEvents: data.generatedEvents ?? generatedEvents
    });
  }
  async commitMatchFinalization(input) {
    const {
      tenantId,
      tournamentId,
      matchId,
      actor,
      assignment,
      expectedStateVersion,
      idempotencyKey,
      requestHash,
      revision,
      overrideReason = null,
      outboxEvents = [],
      forceComplete = false
    } = input;
    const auth = canWriteMatch({ actor, assignment, tenantId });
    if (!auth.ok) {
      return auth;
    }
    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    const live = await repoVal(this.repository.getLiveState(matchStateId));
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }
    const statePayload = live.statePayload;
    const needsComplete = live.status !== MATCH_STATUS.COMPLETED && live.status !== MATCH_STATUS.LOCKED && !forceComplete;
    if (needsComplete && statePayload?.status !== MATCH_STATUS.COMPLETED) {
      return createPersistenceError(REFEREE_V5_ERROR.RESULT_NOT_READY);
    }
    const payload = {
      p_tenant_id: tenantId,
      p_tournament_id: tournamentId,
      p_match_id: matchId,
      p_actor_id: actor.userId,
      p_expected_state_version: expectedStateVersion,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_revision: {
        revision: revision.revision,
        status: revision.status,
        teamAId: revision.teamAId || live.teamAId,
        teamBId: revision.teamBId || live.teamBId,
        winnerId: revision.winnerId,
        officialScore: revision.officialScore
      },
      p_outbox_events: outboxEvents.map((item) => ({
        eventType: item.eventType,
        payload: item.payload || {},
        idempotencyKey: item.idempotencyKey
      })),
      p_override_reason: overrideReason
    };
    if (this.stagingFault) {
      payload.p_staging_fault = this.stagingFault;
    }
    const { data, error } = await this.rpcClient.rpc(this.rpcFns.COMMIT_FINALIZATION, payload);
    if (error) {
      return createPersistenceError(REFEREE_V5_ERROR.FINALIZE_FAILED, error.message);
    }
    if (data?.ok === false) {
      return createPersistenceError(data.code || REFEREE_V5_ERROR.FINALIZE_FAILED, data.error);
    }
    if (data?.duplicate) {
      return createPersistenceSuccess({ duplicate: true, locked: true, ...data });
    }
    return createPersistenceSuccess({ locked: true, ...data });
  }
};

// src/features/referee-v5/selectors/serveContextSelector.js
var SERVE_DIRECTION = Object.freeze({
  NEAR_RIGHT_TO_FAR_LEFT: "NEAR_RIGHT_TO_FAR_LEFT",
  NEAR_LEFT_TO_FAR_RIGHT: "NEAR_LEFT_TO_FAR_RIGHT",
  FAR_RIGHT_TO_NEAR_LEFT: "FAR_RIGHT_TO_NEAR_LEFT",
  FAR_LEFT_TO_NEAR_RIGHT: "FAR_LEFT_TO_NEAR_RIGHT"
});
var DIRECTION_LOOKUP = Object.freeze({
  [`${COURT_END.NEAR_END}:${LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT}`]: SERVE_DIRECTION.NEAR_RIGHT_TO_FAR_LEFT,
  [`${COURT_END.NEAR_END}:${LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT}`]: SERVE_DIRECTION.NEAR_LEFT_TO_FAR_RIGHT,
  [`${COURT_END.FAR_END}:${LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT}`]: SERVE_DIRECTION.FAR_RIGHT_TO_NEAR_LEFT,
  [`${COURT_END.FAR_END}:${LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT}`]: SERVE_DIRECTION.FAR_LEFT_TO_NEAR_RIGHT
});
function resolveServeDirection(matchState) {
  const server = findPlayerInState(matchState, matchState.servingPlayerId);
  const receiver = findPlayerInState(matchState, matchState.receivingPlayerId);
  if (!server || !receiver) {
    return null;
  }
  const key = `${server.courtEnd}:${server.logicalServiceSide}`;
  return DIRECTION_LOOKUP[key] || null;
}

// src/features/referee-v5/server/edgeHttpHandler.js
var REFEREE_V5_INTERNAL_RPC = Object.freeze({
  COMMIT_TRANSITION: "referee_v5_commit_match_transition",
  COMMIT_FINALIZATION: "referee_v5_commit_match_finalization",
  GET_STATE: "referee_v5_get_match_state"
});
async function verifyBearerToken(supabaseUserClient) {
  const { data, error } = await supabaseUserClient.auth.getUser();
  if (error || !data?.user?.id) {
    return { ok: false, code: "TENANT_ACCESS_DENIED", error: "Invalid or expired token." };
  }
  return { ok: true, userId: data.user.id };
}
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function mapHttpStatus(code) {
  switch (code) {
    case REFEREE_V5_ERROR.TENANT_ACCESS_DENIED:
      return 401;
    case REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED:
    case REFEREE_V5_ERROR.ASSIGNMENT_REVOKED:
    case REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED:
      return 403;
    case REFEREE_V5_ERROR.MATCH_STATE_CONFLICT:
    case REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT:
    case REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH:
    case REFEREE_V5_ERROR.MATCH_LOCKED:
      return 409;
    case REFEREE_V5_ERROR.MATCH_NOT_FOUND:
      return 404;
    default:
      return 400;
  }
}
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}
function enrichError(result) {
  return {
    ...result,
    messageVi: REFEREE_V5_ERROR_VI[result.code] || result.error || result.code
  };
}
function createRefereeV5EdgeRuntime({ serviceClient }) {
  const repository = new RefereeV5SupabaseRepository(serviceClient);
  const atomicCommit = new RefereeV5RpcAtomicCommitService(
    repository,
    serviceClient,
    REFEREE_V5_INTERNAL_RPC
  );
  const handler = new RefereeV5EdgeCommandHandler(repository, atomicCommit);
  return { repository, handler };
}
async function handleRefereeV5MatchAction({
  action,
  body,
  userClient,
  serviceClient
}) {
  const verified = await verifyBearerToken(userClient);
  if (!verified.ok) {
    return { httpStatus: 401, body: enrichError(verified) };
  }
  const token = `jwt:${verified.userId}`;
  const { handler, repository } = createRefereeV5EdgeRuntime({ serviceClient });
  if (action === "get-state") {
    const { tournamentId, matchId } = body;
    const assignment = await repository.findAssignmentByUserAndMatch({
      userId: verified.userId,
      tournamentId,
      matchId
    });
    if (!assignment) {
      return {
        httpStatus: 403,
        body: enrichError({ ok: false, code: REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED })
      };
    }
    if (assignment.status === "revoked") {
      return {
        httpStatus: 403,
        body: enrichError({ ok: false, code: REFEREE_V5_ERROR.ASSIGNMENT_REVOKED })
      };
    }
    if (assignment.expiresAt && new Date(assignment.expiresAt).getTime() < Date.now()) {
      return {
        httpStatus: 403,
        body: enrichError({ ok: false, code: REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED })
      };
    }
    const live = await repository.getLiveState(
      `${assignment.tenantId}::${tournamentId}::${matchId}`
    );
    if (!live) {
      return {
        httpStatus: 404,
        body: enrichError({ ok: false, code: REFEREE_V5_ERROR.MATCH_NOT_FOUND })
      };
    }
    const state = deserializeMatchState(live.statePayload);
    const events = await repository.getEvents(`${assignment.tenantId}::${tournamentId}::${matchId}`);
    return {
      httpStatus: 200,
      body: {
        ok: true,
        state,
        stateVersion: live.stateVersion,
        lastEventSequence: live.lastEventSequence,
        recentEvents: events.slice(-10),
        serveDirection: resolveServeDirection(state),
        tenantId: assignment.tenantId
      }
    };
  }
  if (action === "apply-command") {
    const result = await handler.processMatchCommand({
      accessToken: token,
      tournamentId: body.tournamentId,
      matchId: body.matchId,
      commandType: body.commandType,
      payload: body.payload || {},
      expectedVersion: body.expectedVersion,
      expectedSequence: body.expectedSequence,
      clientMutationId: body.clientMutationId,
      idempotencyKey: body.idempotencyKey,
      requestBody: body
    });
    return {
      httpStatus: result.ok ? 200 : mapHttpStatus(result.code),
      body: result.ok ? result : enrichError(result)
    };
  }
  if (action === "finalize") {
    const result = await handler.processFinalize({
      accessToken: token,
      tournamentId: body.tournamentId,
      matchId: body.matchId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
      overrideReason: body.overrideReason || null,
      isOverride: Boolean(body.isOverride),
      forceComplete: Boolean(body.forceComplete),
      requestBody: body
    });
    return {
      httpStatus: result.ok ? 200 : mapHttpStatus(result.code),
      body: result.ok ? result : enrichError(result)
    };
  }
  return {
    httpStatus: 400,
    body: enrichError({ ok: false, code: REFEREE_V5_ERROR.VALIDATION_FAILED, error: "Unknown action" })
  };
}
async function handleRefereeV5MatchHttpRequest(req, { createSupabaseClients }) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  }
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(enrichError({ ok: false, code: REFEREE_V5_ERROR.TENANT_ACCESS_DENIED }), 401);
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(enrichError({ ok: false, code: REFEREE_V5_ERROR.VALIDATION_FAILED }), 400);
  }
  const action = String(body.action || "").trim();
  if (!action) {
    return jsonResponse(enrichError({ ok: false, code: REFEREE_V5_ERROR.VALIDATION_FAILED }), 400);
  }
  const { user, service } = createSupabaseClients(authHeader);
  const result = await handleRefereeV5MatchAction({
    action,
    body,
    userClient: user,
    serviceClient: service
  });
  return jsonResponse(result.body, result.httpStatus);
}
export {
  REFEREE_V5_ERROR,
  REFEREE_V5_ERROR_VI,
  REFEREE_V5_INTERNAL_RPC,
  RefereeV5EdgeCommandHandler,
  RefereeV5RpcAtomicCommitService,
  RefereeV5SupabaseRepository,
  buildCommandRequestHash,
  buildRequestHash,
  createRefereeV5EdgeRuntime,
  handleRefereeV5MatchAction,
  handleRefereeV5MatchHttpRequest,
  hashMatchStateCanonical,
  verifyBearerToken
};
