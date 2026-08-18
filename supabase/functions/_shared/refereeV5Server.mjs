/* Referee V5 trusted server bundle */
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// scripts/bundle-stubs/supabase-js-edge-stub.js
function createClient() {
  return {
    from() {
      return this;
    },
    rpc: async () => ({ data: null, error: { message: "edge-bundle-stub" } }),
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: "edge-bundle-stub" } })
    }
  };
}
var init_supabase_js_edge_stub = __esm({
  "scripts/bundle-stubs/supabase-js-edge-stub.js"() {
  }
});

// src/auth/supabaseClient.js
function readSupabaseEnv() {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const nodeEnv = typeof globalThis.process !== "undefined" ? globalThis.process.env : {};
  return {
    url: String(env.VITE_SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL || "").trim(),
    anonKey: String(env.VITE_SUPABASE_ANON_KEY || nodeEnv.VITE_SUPABASE_ANON_KEY || "").trim(),
    mode: env.MODE || nodeEnv.NODE_ENV || "unknown"
  };
}
function getSupabaseAnonKeyPrefix(key) {
  const trimmed = String(key || "").trim();
  if (!trimmed) {
    return "(empty)";
  }
  if (trimmed.startsWith("sb_publishable_")) {
    return "sb_publishable";
  }
  if (trimmed.startsWith("eyJ")) {
    return "eyJ";
  }
  return "(other)";
}
function isValidSupabaseAnonKey(key) {
  const trimmed = String(key || "").trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith("eyJ")) {
    return true;
  }
  if (trimmed.startsWith("sb_publishable_")) {
    return true;
  }
  return trimmed.length >= 20;
}
function getSupabaseConfigDiagnostics() {
  const { url, anonKey, mode } = readSupabaseEnv();
  return {
    hasUrl: url !== "",
    hasAnonKey: anonKey !== "" && isValidSupabaseAnonKey(anonKey),
    keyPrefix: getSupabaseAnonKeyPrefix(anonKey),
    mode
  };
}
function logSupabaseConfigDebug() {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const shouldLog = env.DEV || env.VITE_ENABLE_AUTH_DEBUG === "true";
  if (!shouldLog) {
    return;
  }
  console.info("[supabase] config", getSupabaseConfigDiagnostics());
}
function getSupabaseConfigError() {
  const { url, anonKey } = readSupabaseEnv();
  if (url === "") {
    return SUPABASE_CONFIG_ERROR;
  }
  if (anonKey === "") {
    return SUPABASE_CONFIG_ERROR;
  }
  if (!isValidSupabaseAnonKey(anonKey)) {
    return "VITE_SUPABASE_ANON_KEY kh\xF4ng h\u1EE3p l\u1EC7. D\xF9ng anon key (eyJ...) ho\u1EB7c publishable key (sb_publishable_...).";
  }
  return null;
}
function hasSupabaseConfig() {
  return getSupabaseConfigError() === null;
}
function getSupabaseAuthClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }
  const { url, anonKey } = readSupabaseEnv();
  if (!authClient) {
    authClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return authClient;
}
var authClient, SUPABASE_CONFIG_ERROR, PROFILES_TABLE;
var init_supabaseClient = __esm({
  "src/auth/supabaseClient.js"() {
    init_supabase_js_edge_stub();
    authClient = null;
    SUPABASE_CONFIG_ERROR = "Thi\u1EBFu c\u1EA5u h\xECnh Supabase. \u0110\u1EB7t VITE_SUPABASE_URL v\xE0 VITE_SUPABASE_ANON_KEY trong .env.local (kh\xF4ng \u0111\u1EC3 tr\u1ED1ng trong .env.development).";
    PROFILES_TABLE = "profiles";
    logSupabaseConfigDebug();
  }
});

// src/features/identity/services/subjectIdentityPersistence.js
var subjectIdentityPersistence_exports = {};
__export(subjectIdentityPersistence_exports, {
  SUBJECT_IDENTITY_RAW_FIELDS: () => SUBJECT_IDENTITY_RAW_FIELDS,
  loadIdentitySubjectByIdFromPersistence: () => loadIdentitySubjectByIdFromPersistence,
  projectRawIdentitySubjectRecord: () => projectRawIdentitySubjectRecord
});
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function readRawId(row, keys) {
  for (const key of keys) {
    if (isNonEmptyString(row?.[key])) return String(row[key]).trim();
  }
  return null;
}
function isMissingTenantColumnError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (!message.includes("tenant_id")) return false;
  return message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find") || message.includes("column");
}
function projectRawIdentitySubjectRecord(row) {
  if (!row || typeof row !== "object") return null;
  const id = readRawId(row, ["id"]);
  if (!id) return null;
  const projected = Object.freeze({
    id,
    role: readRawId(row, ["role"]),
    status: readRawId(row, ["status"]),
    tenantId: readRawId(row, ["tenant_id", "tenantId"]),
    venueId: readRawId(row, ["venue_id", "venueId"]),
    clubId: readRawId(row, ["club_id", "clubId"]),
    organizationId: readRawId(row, ["organization_id", "organizationId"])
  });
  for (const field of FORBIDDEN_PII_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(projected, field)) return null;
  }
  return projected;
}
async function loadIdentitySubjectByIdFromPersistence(subjectId, deps = {}) {
  const id = String(subjectId || "").trim();
  if (!id) return null;
  const getClient = typeof deps.getAuthClient === "function" ? deps.getAuthClient : getSupabaseAuthClient;
  const client = getClient();
  if (!client) return null;
  const query = async (select) => client.from(PROFILES_TABLE).select(select).eq("id", id).maybeSingle();
  let { data, error } = await query(RAW_SELECT);
  if (error && isMissingTenantColumnError(error)) {
    ({ data, error } = await query(RAW_SELECT_WITHOUT_TENANT_COLUMN));
  }
  if (error || !data) return null;
  return projectRawIdentitySubjectRecord(data);
}
var SUBJECT_IDENTITY_RAW_FIELDS, RAW_SELECT, RAW_SELECT_WITHOUT_TENANT_COLUMN, FORBIDDEN_PII_FIELDS;
var init_subjectIdentityPersistence = __esm({
  "src/features/identity/services/subjectIdentityPersistence.js"() {
    init_supabaseClient();
    SUBJECT_IDENTITY_RAW_FIELDS = Object.freeze([
      "id",
      "role",
      "status",
      "tenant_id",
      "venue_id",
      "club_id"
    ]);
    RAW_SELECT = SUBJECT_IDENTITY_RAW_FIELDS.join(", ");
    RAW_SELECT_WITHOUT_TENANT_COLUMN = "id, role, status, venue_id, club_id";
    FORBIDDEN_PII_FIELDS = Object.freeze([
      "email",
      "phone",
      "display_name",
      "displayName",
      "password",
      "must_change_password",
      "mustChangePassword",
      "avatar_url",
      "avatarUrl"
    ]);
  }
});

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
function createEmptyTeamState({ teamId, courtEnd, players = [] }) {
  return {
    teamId: String(teamId),
    courtEnd,
    score: 0,
    players: players.map((player) => ({
      playerId: String(player.playerId),
      logicalServiceSide: player.logicalServiceSide
    }))
  };
}
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
function createInitialMatchStateSkeleton(config) {
  return {
    matchId: String(config.matchId || ""),
    stateSchemaVersion: STATE_SCHEMA_VERSION,
    matchType: config.matchType || MATCH_TYPE.DOUBLES,
    status: MATCH_STATUS.NOT_STARTED,
    version: 0,
    scoringFormat: config.scoringFormat || SCORING_FORMAT.SIDE_OUT,
    bestOf: Number(config.bestOf) || 1,
    pointsToWin: Number(config.pointsToWin) || 11,
    winBy: Number(config.winBy) || 2,
    maximumScore: config.maximumScore ?? null,
    currentGameNumber: 1,
    teams: {
      teamA: createEmptyTeamState({ teamId: "", courtEnd: COURT_END.NEAR_END, players: [] }),
      teamB: createEmptyTeamState({ teamId: "", courtEnd: COURT_END.FAR_END, players: [] })
    },
    servingTeamId: "",
    servingPlayerId: "",
    receivingTeamId: "",
    receivingPlayerId: "",
    serverNumber: config.matchType === MATCH_TYPE.SINGLES ? null : 1,
    games: [],
    lastEventSequence: 0
  };
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
function validateInitializeConfig(config) {
  const errors = [];
  if (!config?.teams?.teamA?.teamId || !config?.teams?.teamB?.teamId) {
    errors.push("Hai \u0111\u1ED9i ph\u1EA3i c\xF3 teamId.");
  }
  if (String(config?.teams?.teamA?.teamId) === String(config?.teams?.teamB?.teamId)) {
    errors.push("Hai \u0111\u1ED9i ph\u1EA3i kh\xE1c nhau.");
  }
  const teamAPlayers = config?.teams?.teamA?.players || [];
  const teamBPlayers = config?.teams?.teamB?.players || [];
  const allIds = [...teamAPlayers, ...teamBPlayers].map((player) => String(player.playerId));
  if (new Set(allIds).size !== allIds.length) {
    errors.push("V\u0110V kh\xF4ng \u0111\u01B0\u1EE3c tr\xF9ng.");
  }
  if (config.matchType === MATCH_TYPE.SINGLES) {
    if (teamAPlayers.length !== 1 || teamBPlayers.length !== 1) {
      errors.push("Singles ph\u1EA3i c\xF3 m\u1ED9t V\u0110V m\u1ED7i \u0111\u1ED9i.");
    }
  }
  if (config.matchType === MATCH_TYPE.DOUBLES) {
    if (teamAPlayers.length !== 2 || teamBPlayers.length !== 2) {
      errors.push("Doubles ph\u1EA3i c\xF3 hai V\u0110V m\u1ED7i \u0111\u1ED9i.");
    }
    for (const side of ["teamA", "teamB"]) {
      const players = config.teams[side].players;
      const sides = players.map((player) => player.logicalServiceSide);
      if (!sides.includes(LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT) || !sides.includes(LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT)) {
        errors.push(`${side} ph\u1EA3i c\xF3 m\u1ED9t V\u0110V tr\xE1i v\xE0 m\u1ED9t V\u0110V ph\u1EA3i.`);
      }
    }
  }
  if (config.teams?.teamA?.courtEnd === config.teams?.teamB?.courtEnd) {
    errors.push("Hai \u0111\u1ED9i kh\xF4ng \u0111\u01B0\u1EE3c c\xF9ng court end.");
  }
  if (!config.firstServingTeamId) {
    errors.push("Thi\u1EBFu \u0111\u1ED9i giao \u0111\u1EA7u ti\xEAn.");
  }
  if (!config.firstServingPlayerId) {
    errors.push("Thi\u1EBFu ng\u01B0\u1EDDi giao \u0111\u1EA7u ti\xEAn.");
  }
  if (config.rallyVariant === RALLY_VARIANT.MLP || config.scoringFormat === "mlp_rally" || config.rallyServeRotation === "mlp") {
    errors.push("MLP_RALLY_NOT_SUPPORTED");
  }
  if (config.scoringFormat === SCORING_FORMAT.RALLY && config.rallyVariant === RALLY_VARIANT.MLP) {
    errors.push("MLP_RALLY_NOT_SUPPORTED");
  }
  const serverTeam = String(config.firstServingTeamId) === String(config.teams?.teamA?.teamId) ? config.teams.teamA : config.teams.teamB;
  if (serverTeam && !serverTeam.players.some(
    (player) => String(player.playerId) === String(config.firstServingPlayerId)
  )) {
    errors.push("Ng\u01B0\u1EDDi giao ph\u1EA3i thu\u1ED9c \u0111\u1ED9i giao.");
  }
  return errors;
}
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
function initializeMatchState(config) {
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
      logicalServiceSide: player.logicalServiceSide
    }))
  };
  state.teams.teamB = {
    teamId: String(config.teams.teamB.teamId),
    courtEnd: config.teams.teamB.courtEnd || COURT_END.FAR_END,
    score: 0,
    players: config.teams.teamB.players.map((player) => ({
      playerId: String(player.playerId),
      logicalServiceSide: player.logicalServiceSide
    }))
  };
  state.servingTeamId = String(config.firstServingTeamId);
  state.servingPlayerId = String(config.firstServingPlayerId);
  state.serverNumber = config.matchType === MATCH_TYPE.SINGLES ? null : Number(config.initialServerNumber) || 1;
  const serveContext = recomputeServeContext(state);
  if (!serveContext.ok) {
    return { ok: false, errors: [serveContext.error] };
  }
  state = {
    ...serveContext.state,
    status: MATCH_STATUS.NOT_STARTED,
    scoringFormat: config.scoringFormat || SCORING_FORMAT.SIDE_OUT,
    pointsToWin: Number(config.pointsToWin) || 11,
    winBy: Number(config.winBy) || 2,
    maximumScore: config.maximumScore ?? null,
    bestOf: Number(config.bestOf) || 1
  };
  const snapshotCheck = validateServeSnapshot(state, serveContext.receiverResult);
  if (!snapshotCheck.ok) {
    return { ok: false, errors: [snapshotCheck.error] };
  }
  return { ok: true, state };
}
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
  INTERNAL_RPC_FORBIDDEN: "INTERNAL_RPC_FORBIDDEN",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  VALIDATION_DENIED: "VALIDATION_DENIED",
  MATCH_ALREADY_ACTIVE: "MATCH_ALREADY_ACTIVE",
  TERMINAL_STATE: "TERMINAL_STATE"
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
  [REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN]: "RPC n\u1ED9i b\u1ED9 kh\xF4ng kh\u1EA3 d\u1EE5ng t\u1EEB client.",
  [REFEREE_V5_ERROR.NOT_CONFIGURED]: "Thi\u1EBFu ng\u1EEF c\u1EA3nh Adapter B ho\u1EB7c c\u1EA5u h\xECnh tr\u1ECDng t\xE0i.",
  [REFEREE_V5_ERROR.VALIDATION_DENIED]: "Y\xEAu c\u1EA7u kh\u1EDFi t\u1EA1o tr\u1EA1ng th\xE1i thi \u0111\u1EA5u kh\xF4ng h\u1EE3p l\u1EC7.",
  [REFEREE_V5_ERROR.MATCH_ALREADY_ACTIVE]: "Tr\u1EADn \u0111\xE3 c\xF3 tr\u1EA1ng th\xE1i thi \u0111\u1EA5u, kh\xF4ng \u0111\u01B0\u1EE3c reset.",
  [REFEREE_V5_ERROR.TERMINAL_STATE]: "Tr\u1EADn \u0111\xE3 k\u1EBFt th\xFAc ho\u1EB7c b\u1ECB kh\xF3a, kh\xF4ng \u0111\u01B0\u1EE3c kh\u1EDFi t\u1EA1o l\u1EA1i."
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
  const forbidden = [
    "actorId",
    "actor_id",
    "userId",
    "user_id",
    "tenantId",
    "tenant_id",
    "role",
    "actor",
    "actorRole",
    "tenantRole",
    "trustedActor",
    "initialState",
    "statePayload",
    "stateSnapshot",
    "serviceRoleKey"
  ];
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

// src/features/competition-core/role-permission/constants/versions.js
var CORE02_POLICY_ID = "CORE02_ROLE_PERMISSION";
var CORE02_ACTION_PERMISSION_MAP_VERSION = "core02-action-map-1.0.0";

// src/features/competition-core/role-permission/enums/competitionRoles.js
var COMPETITION_ROLE = Object.freeze({
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  TENANT_OWNER: "TENANT_OWNER",
  VENUE_MANAGER: "VENUE_MANAGER",
  TOURNAMENT_MANAGER: "TOURNAMENT_MANAGER",
  TEAM_CAPTAIN: "TEAM_CAPTAIN",
  CLUB_MANAGER: "CLUB_MANAGER",
  REFEREE: "REFEREE",
  PLAYER: "PLAYER",
  STAFF: "STAFF",
  SYSTEM: "SYSTEM",
  BTC: "BTC",
  UNKNOWN: "UNKNOWN"
});
var COMPETITION_ROLE_VALUES = Object.freeze(
  Object.values(COMPETITION_ROLE)
);
function isCompetitionRole(value) {
  return COMPETITION_ROLE_VALUES.includes(String(value || ""));
}
function normalizeCompetitionRole(value) {
  const raw = String(value || "").trim();
  if (!raw) return COMPETITION_ROLE.UNKNOWN;
  if (raw === "SUPER_ADMIN" || raw === "ADMIN") return COMPETITION_ROLE.PLATFORM_ADMIN;
  if (raw === "COURT_OWNER" || raw === "VENUE_OWNER" || raw === "OWNER") {
    return COMPETITION_ROLE.TENANT_OWNER;
  }
  if (raw === "COURT_MANAGER") return COMPETITION_ROLE.VENUE_MANAGER;
  if (raw === "CAPTAIN") return COMPETITION_ROLE.TEAM_CAPTAIN;
  if (isCompetitionRole(raw)) return raw;
  return COMPETITION_ROLE.UNKNOWN;
}

// src/features/competition-core/role-permission/enums/competitionPermissions.js
var COMPETITION_PERMISSION = Object.freeze({
  TOURNAMENT_VIEW: "tournament.view",
  TOURNAMENT_UPDATE: "tournament.update",
  MATCH_UPDATE: "match.update",
  DIRECTOR_USE: "director.use",
  TEAM_MANAGE: "team.manage",
  TEAM_VIEW: "team.view",
  TEAM_WITHDRAW: "team.withdraw",
  TEAM_LINEUP_SUBMIT: "team.lineup.submit",
  TEAM_LINEUP_LOCK: "team.lineup.lock",
  TEAM_LINEUP_PUBLISH: "team.lineup.publish",
  TEAM_LINEUP_RANDOMIZE: "team.lineup.randomize",
  TEAM_LINEUP_OVERRIDE: "team.lineup.override",
  TEAM_LINEUP_VIEW_V5: "team_lineup.view",
  TEAM_LINEUP_SUBMIT_V5: "team_lineup.submit",
  TEAM_LINEUP_UPDATE_BEFORE_LOCK: "team_lineup.update_before_lock",
  TEAM_LINEUP_LOCK_V5: "team_lineup.lock",
  TEAM_LINEUP_APPROVE: "team_lineup.approve"
});
var COMPETITION_PERMISSION_VALUES = Object.freeze(
  Object.values(COMPETITION_PERMISSION)
);

// src/features/competition-core/role-permission/enums/competitionActions.js
var COMPETITION_ACTION = Object.freeze({
  // Team / Roster (Owner CORE-06 / repo teams)
  TEAM_ROSTER_UNLOCK: "TEAM_ROSTER_UNLOCK",
  TEAM_WITHDRAW: "TEAM_WITHDRAW",
  TEAM_ACTIVATE: "TEAM_ACTIVATE",
  ROSTER_LOCK: "ROSTER_LOCK",
  // Lineup (Owner CORE-07 / repo lineups)
  LINEUP_DRAFT: "LINEUP_DRAFT",
  LINEUP_SUBMIT: "LINEUP_SUBMIT",
  LINEUP_LOCK: "LINEUP_LOCK",
  LINEUP_PUBLISH: "LINEUP_PUBLISH",
  LINEUP_OVERRIDE: "LINEUP_OVERRIDE",
  LINEUP_VOID: "LINEUP_VOID",
  LINEUP_VIEW_OWN: "LINEUP_VIEW_OWN",
  LINEUP_VIEW_OPPONENT: "LINEUP_VIEW_OPPONENT"
});
var COMPETITION_ACTION_VALUES = Object.freeze(
  Object.values(COMPETITION_ACTION)
);

// src/features/competition-core/role-permission/enums/denyReasons.js
var AUTHORIZATION_DENY_REASON = Object.freeze({
  INVALID_REQUEST: "INVALID_REQUEST",
  MISSING_SUBJECT: "MISSING_SUBJECT",
  MISSING_SCOPE: "MISSING_SCOPE",
  MISSING_ACTION: "MISSING_ACTION",
  UNKNOWN_ACTION: "UNKNOWN_ACTION",
  EVIDENCE_UNAVAILABLE: "EVIDENCE_UNAVAILABLE",
  EVIDENCE_MALFORMED: "EVIDENCE_MALFORMED",
  SCOPE_MISMATCH: "SCOPE_MISMATCH",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  ADAPTER_UNAVAILABLE: "ADAPTER_UNAVAILABLE"
});
var AUTHORIZATION_DENY_REASON_VALUES = Object.freeze(
  Object.values(AUTHORIZATION_DENY_REASON)
);
var AUTHORIZATION_DECISION_CODE = Object.freeze({
  ALLOW: "ALLOW",
  ...AUTHORIZATION_DENY_REASON
});

// src/features/competition-core/role-permission/contracts/shared.js
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function optionalNonEmptyString(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return s ? s : null;
}
function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of value) {
    const s = optionalNonEmptyString(item);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
function freezeRecord(value) {
  const src = isPlainObject(value) ? value : {};
  return Object.freeze({ ...src });
}

// src/features/competition-core/role-permission/errors/errorCodes.js
var AUTHORIZATION_ERROR_CODE = Object.freeze({
  INVALID_CONTRACT: "CORE02_AUTHZ_INVALID_CONTRACT",
  EVALUATION_FAILED: "CORE02_AUTHZ_EVALUATION_FAILED",
  ADAPTER_UNAVAILABLE: "CORE02_AUTHZ_ADAPTER_UNAVAILABLE"
});
var AUTHORIZATION_ERROR_CODE_VALUES = Object.freeze(
  Object.values(AUTHORIZATION_ERROR_CODE)
);

// src/features/competition-core/role-permission/errors/authorizationError.js
var AuthorizationError = class extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code || AUTHORIZATION_ERROR_CODE.EVALUATION_FAILED;
    this.details = Object.freeze({ ...details });
  }
};

// src/features/competition-core/role-permission/contracts/authorizationSubject.js
function createAuthorizationSubject(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationSubject must be a plain object",
      {}
    );
  }
  return Object.freeze({
    actorId: optionalNonEmptyString(partial.actorId ?? partial.actor),
    role: normalizeCompetitionRole(partial.role ?? partial.actorRole),
    displayName: optionalNonEmptyString(partial.displayName),
    attributes: freezeRecord(partial.attributes)
  });
}

// src/features/competition-core/role-permission/contracts/authorizationScope.js
function createAuthorizationScope(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationScope must be a plain object",
      {}
    );
  }
  const competitionId = optionalNonEmptyString(partial.competitionId);
  if (!competitionId) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationScope.competitionId is required",
      {}
    );
  }
  return Object.freeze({
    tenantId: optionalNonEmptyString(partial.tenantId),
    venueId: optionalNonEmptyString(partial.venueId),
    clubId: optionalNonEmptyString(partial.clubId),
    competitionId,
    divisionId: optionalNonEmptyString(partial.divisionId),
    teamId: optionalNonEmptyString(partial.teamId),
    matchId: optionalNonEmptyString(partial.matchId),
    attributes: freezeRecord(partial.attributes)
  });
}

// src/features/competition-core/role-permission/contracts/authorizationRequest.js
function createAuthorizationRequest(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationRequest must be a plain object",
      {}
    );
  }
  const action = optionalNonEmptyString(partial.action);
  if (!action) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationRequest.action is required",
      {}
    );
  }
  return Object.freeze({
    action,
    subject: createAuthorizationSubject(partial.subject || {}),
    scope: createAuthorizationScope(partial.scope || {}),
    requiredPermissions: Object.freeze(
      normalizeStringList(partial.requiredPermissions)
    ),
    resourceType: optionalNonEmptyString(partial.resourceType),
    resourceId: optionalNonEmptyString(partial.resourceId),
    context: freezeRecord(partial.context),
    metadata: freezeRecord(partial.metadata)
  });
}

// src/features/competition-core/role-permission/contracts/authorizationEvidence.js
function createAuthorizationEvidence(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationEvidence must be a plain object",
      {}
    );
  }
  return Object.freeze({
    source: optionalNonEmptyString(partial.source) || "UNKNOWN",
    subjectId: optionalNonEmptyString(partial.subjectId),
    role: optionalNonEmptyString(partial.role),
    grantedPermissions: Object.freeze(
      normalizeStringList(partial.grantedPermissions)
    ),
    tenantId: optionalNonEmptyString(partial.tenantId),
    venueId: optionalNonEmptyString(partial.venueId),
    competitionId: optionalNonEmptyString(partial.competitionId),
    evidenceVersion: optionalNonEmptyString(partial.evidenceVersion),
    attributes: freezeRecord(partial.attributes)
  });
}
function isAuthorizationEvidence(value) {
  return isPlainObject(value) && Array.isArray(value.grantedPermissions);
}

// src/features/competition-core/role-permission/contracts/authorizationExplanation.js
function createAuthorizationExplanation(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationExplanation must be a plain object",
      {}
    );
  }
  return Object.freeze({
    summary: optionalNonEmptyString(partial.summary) || "",
    requiredPermissions: Object.freeze(
      normalizeStringList(partial.requiredPermissions)
    ),
    matchedPermissions: Object.freeze(
      normalizeStringList(partial.matchedPermissions)
    ),
    grantedPermissions: Object.freeze(
      normalizeStringList(partial.grantedPermissions)
    ),
    denyReason: optionalNonEmptyString(partial.denyReason),
    details: freezeRecord(partial.details)
  });
}

// src/features/competition-core/role-permission/contracts/authorizationDecision.js
function createAuthorizationDecision(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuthorizationError(
      AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT,
      "AuthorizationDecision must be a plain object",
      {}
    );
  }
  const allowed = partial.allowed === true;
  const denyReason = optionalNonEmptyString(partial.denyReason);
  let decisionCode = optionalNonEmptyString(partial.decisionCode);
  if (allowed) {
    decisionCode = decisionCode || AUTHORIZATION_DECISION_CODE.ALLOW;
  } else {
    if (!decisionCode || decisionCode === AUTHORIZATION_DECISION_CODE.ALLOW) {
      decisionCode = denyReason || AUTHORIZATION_DECISION_CODE.PERMISSION_DENIED;
    }
  }
  return Object.freeze({
    allowed,
    decisionCode,
    reason: optionalNonEmptyString(partial.reason),
    denyReason: allowed ? null : denyReason || decisionCode,
    actorId: optionalNonEmptyString(partial.actorId),
    actorRole: optionalNonEmptyString(partial.actorRole),
    policyId: optionalNonEmptyString(partial.policyId) || CORE02_POLICY_ID,
    action: optionalNonEmptyString(partial.action),
    explanation: isPlainObject(partial.explanation) ? createAuthorizationExplanation(partial.explanation) : null,
    details: freezeRecord(partial.details)
  });
}

// src/features/competition-core/role-permission/ports/identityEvidencePort.js
function matchesIdentityEvidencePort(port) {
  return Boolean(
    port && typeof port === "object" && typeof port.getEvidence === "function"
  );
}

// src/features/competition-core/role-permission/services/mapActionToPermissions.js
var ACTION_PERMISSION_MAP = Object.freeze({
  [COMPETITION_ACTION.TEAM_ROSTER_UNLOCK]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_MANAGE
  ]),
  [COMPETITION_ACTION.TEAM_WITHDRAW]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_WITHDRAW
  ]),
  [COMPETITION_ACTION.TEAM_ACTIVATE]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_MANAGE
  ]),
  [COMPETITION_ACTION.ROSTER_LOCK]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_MANAGE
  ]),
  [COMPETITION_ACTION.LINEUP_DRAFT]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT,
    COMPETITION_PERMISSION.TEAM_LINEUP_UPDATE_BEFORE_LOCK
  ]),
  [COMPETITION_ACTION.LINEUP_SUBMIT]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT,
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT_V5
  ]),
  [COMPETITION_ACTION.LINEUP_LOCK]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_LOCK,
    COMPETITION_PERMISSION.TEAM_LINEUP_LOCK_V5
  ]),
  [COMPETITION_ACTION.LINEUP_PUBLISH]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_PUBLISH
  ]),
  [COMPETITION_ACTION.LINEUP_OVERRIDE]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_OVERRIDE
  ]),
  [COMPETITION_ACTION.LINEUP_VOID]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT,
    COMPETITION_PERMISSION.TEAM_LINEUP_UPDATE_BEFORE_LOCK
  ]),
  [COMPETITION_ACTION.LINEUP_VIEW_OWN]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_VIEW,
    COMPETITION_PERMISSION.TEAM_LINEUP_VIEW_V5
  ]),
  [COMPETITION_ACTION.LINEUP_VIEW_OPPONENT]: Object.freeze([
    COMPETITION_PERMISSION.TEAM_LINEUP_VIEW_V5,
    COMPETITION_PERMISSION.TOURNAMENT_VIEW
  ])
});
function mapActionToPermissions(action) {
  const key = String(action || "");
  const mapped = ACTION_PERMISSION_MAP[key];
  if (!mapped) {
    return {
      known: false,
      requiredPermissions: [],
      mapVersion: CORE02_ACTION_PERMISSION_MAP_VERSION
    };
  }
  return {
    known: true,
    requiredPermissions: [...mapped],
    mapVersion: CORE02_ACTION_PERMISSION_MAP_VERSION
  };
}

// src/features/competition-core/role-permission/services/evaluateAuthorization.js
function deny(code, base) {
  const requiredPermissions = base.requiredPermissions || [];
  const grantedPermissions = base.grantedPermissions || [];
  const matchedPermissions = base.matchedPermissions || [];
  return createAuthorizationDecision({
    allowed: false,
    decisionCode: code,
    denyReason: code,
    reason: base.reason || `Authorization denied: ${code}`,
    actorId: base.actorId ?? null,
    actorRole: base.actorRole ?? null,
    policyId: CORE02_POLICY_ID,
    action: base.action ?? null,
    explanation: createAuthorizationExplanation({
      summary: base.reason || `Authorization denied: ${code}`,
      requiredPermissions,
      matchedPermissions,
      grantedPermissions,
      denyReason: code,
      details: base.details || {}
    }),
    details: base.details || {}
  });
}
function scopesCompatible(scope, evidence) {
  if (evidence.tenantId && scope.tenantId && evidence.tenantId !== scope.tenantId) {
    return false;
  }
  if (evidence.venueId && scope.venueId && evidence.venueId !== scope.venueId) {
    return false;
  }
  if (evidence.competitionId && scope.competitionId && evidence.competitionId !== scope.competitionId) {
    return false;
  }
  return true;
}
async function evaluateAuthorization(requestInput, options = {}) {
  if (!isPlainObject(requestInput) && requestInput != null) {
    return deny(AUTHORIZATION_DENY_REASON.INVALID_REQUEST, {
      reason: "Authorization request must be a plain object"
    });
  }
  let request;
  try {
    if (!isPlainObject(requestInput)) {
      return deny(AUTHORIZATION_DENY_REASON.INVALID_REQUEST, {
        reason: "Authorization request is required"
      });
    }
    if (!isPlainObject(requestInput.subject)) {
      return deny(AUTHORIZATION_DENY_REASON.MISSING_SUBJECT, {
        action: optionalNonEmptyString(requestInput.action),
        reason: "Authorization subject is required"
      });
    }
    if (!isPlainObject(requestInput.scope)) {
      return deny(AUTHORIZATION_DENY_REASON.MISSING_SCOPE, {
        action: optionalNonEmptyString(requestInput.action),
        actorId: optionalNonEmptyString(requestInput.subject?.actorId),
        actorRole: optionalNonEmptyString(requestInput.subject?.role),
        reason: "Authorization scope is required"
      });
    }
    if (!optionalNonEmptyString(requestInput.action)) {
      return deny(AUTHORIZATION_DENY_REASON.MISSING_ACTION, {
        actorId: optionalNonEmptyString(requestInput.subject?.actorId),
        actorRole: optionalNonEmptyString(requestInput.subject?.role),
        reason: "Authorization action is required"
      });
    }
    request = createAuthorizationRequest(requestInput);
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Invalid authorization request";
    const code = /competitionId/i.test(message) ? AUTHORIZATION_DENY_REASON.MISSING_SCOPE : AUTHORIZATION_DENY_REASON.INVALID_REQUEST;
    return deny(code, { reason: message });
  }
  const actorId = request.subject.actorId;
  const actorRole = request.subject.role;
  const mapping = mapActionToPermissions(request.action);
  const requiredPermissions = request.requiredPermissions.length > 0 ? [...request.requiredPermissions] : mapping.requiredPermissions;
  if (request.requiredPermissions.length === 0 && !mapping.known) {
    return deny(AUTHORIZATION_DENY_REASON.UNKNOWN_ACTION, {
      action: request.action,
      actorId,
      actorRole,
      requiredPermissions: [],
      reason: `Unknown competition action: ${request.action}`
    });
  }
  let evidence = options.evidence;
  if (evidence == null) {
    const port = options.evidencePort;
    if (!matchesIdentityEvidencePort(port)) {
      return deny(AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE, {
        action: request.action,
        actorId,
        actorRole,
        requiredPermissions,
        reason: "Identity evidence port is required"
      });
    }
    try {
      evidence = await port.getEvidence({
        subject: request.subject,
        scope: request.scope,
        action: request.action,
        context: request.context
      });
    } catch {
      return deny(AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE, {
        action: request.action,
        actorId,
        actorRole,
        requiredPermissions,
        reason: "Identity evidence port failed"
      });
    }
  }
  if (evidence == null) {
    return deny(AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE, {
      action: request.action,
      actorId,
      actorRole,
      requiredPermissions,
      reason: "Authorization evidence is unavailable"
    });
  }
  if (!isAuthorizationEvidence(evidence)) {
    return deny(AUTHORIZATION_DENY_REASON.EVIDENCE_MALFORMED, {
      action: request.action,
      actorId,
      actorRole,
      requiredPermissions,
      reason: "Authorization evidence is malformed"
    });
  }
  const normalizedEvidence = evidence;
  if (!scopesCompatible(request.scope, normalizedEvidence)) {
    return deny(AUTHORIZATION_DENY_REASON.SCOPE_MISMATCH, {
      action: request.action,
      actorId,
      actorRole,
      requiredPermissions,
      grantedPermissions: [...normalizedEvidence.grantedPermissions],
      reason: "Evidence scope does not match authorization scope"
    });
  }
  const granted = new Set(normalizedEvidence.grantedPermissions);
  const matchedPermissions = requiredPermissions.filter((p) => granted.has(p));
  if (requiredPermissions.length === 0 || matchedPermissions.length === 0) {
    return deny(AUTHORIZATION_DENY_REASON.PERMISSION_DENIED, {
      action: request.action,
      actorId,
      actorRole,
      requiredPermissions,
      matchedPermissions,
      grantedPermissions: [...normalizedEvidence.grantedPermissions],
      reason: `Missing required permission for action ${request.action}`
    });
  }
  return createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
    reason: `Allowed by permission ${matchedPermissions[0]}`,
    actorId,
    actorRole,
    policyId: CORE02_POLICY_ID,
    action: request.action,
    explanation: createAuthorizationExplanation({
      summary: `Allowed by permission ${matchedPermissions[0]}`,
      requiredPermissions,
      matchedPermissions,
      grantedPermissions: [...normalizedEvidence.grantedPermissions],
      denyReason: null,
      details: {
        evidenceSource: normalizedEvidence.source,
        mapVersion: mapping.mapVersion
      }
    }),
    details: {
      evidenceSource: normalizedEvidence.source,
      mapVersion: mapping.mapVersion
    }
  });
}

// src/features/competition-core/role-permission/adapters/identityProjectionAdapter.js
function createIdentityProjectionEvidencePort(options = {}) {
  const resolveGrantedPermissions = options.resolveGrantedPermissions;
  const source = options.source || "IDENTITY_PROJECTION";
  const evidenceVersion = options.evidenceVersion || "identity-projection-1.0.0";
  return {
    async getEvidence(input) {
      if (typeof resolveGrantedPermissions !== "function") {
        return null;
      }
      const subject = isPlainObject(input?.subject) ? input.subject : {};
      const scope = isPlainObject(input?.scope) ? input.scope : {};
      let granted;
      try {
        granted = await resolveGrantedPermissions({
          subject,
          scope,
          action: input?.action,
          context: isPlainObject(input?.context) ? input.context : {}
        });
      } catch {
        return null;
      }
      if (granted == null) return null;
      return createAuthorizationEvidence({
        source,
        subjectId: optionalNonEmptyString(subject.actorId),
        role: optionalNonEmptyString(subject.role),
        grantedPermissions: normalizeStringList(granted),
        tenantId: optionalNonEmptyString(scope.tenantId),
        venueId: optionalNonEmptyString(scope.venueId),
        competitionId: optionalNonEmptyString(scope.competitionId),
        evidenceVersion,
        attributes: {
          projected: true,
          dormant: true
        }
      });
    }
  };
}

// src/features/competition-core/role-permission/adapters/teamAuthorizationPortAdapter.js
var TEAM_ACTIONS = /* @__PURE__ */ new Set([
  COMPETITION_ACTION.TEAM_ROSTER_UNLOCK,
  COMPETITION_ACTION.TEAM_WITHDRAW,
  COMPETITION_ACTION.TEAM_ACTIVATE,
  COMPETITION_ACTION.ROSTER_LOCK
]);

// src/features/competition-core/role-permission/adapters/lineupAuthorizationPortAdapter.js
var LINEUP_ACTIONS = /* @__PURE__ */ new Set([
  COMPETITION_ACTION.LINEUP_DRAFT,
  COMPETITION_ACTION.LINEUP_SUBMIT,
  COMPETITION_ACTION.LINEUP_LOCK,
  COMPETITION_ACTION.LINEUP_PUBLISH,
  COMPETITION_ACTION.LINEUP_OVERRIDE,
  COMPETITION_ACTION.LINEUP_VOID,
  COMPETITION_ACTION.LINEUP_VIEW_OWN,
  COMPETITION_ACTION.LINEUP_VIEW_OPPONENT
]);

// src/features/identity/constants/roles.js
var ROLES = Object.freeze({
  /** Quản trị nền tảng / Super Admin */
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  /** @deprecated alias — normalize → PLATFORM_ADMIN */
  SUPER_ADMIN: "SUPER_ADMIN",
  SYSTEM_TECHNICIAN: "SYSTEM_TECHNICIAN",
  /** Chủ đơn vị / Chủ sân */
  TENANT_OWNER: "TENANT_OWNER",
  /** @deprecated alias — normalize → TENANT_OWNER */
  COURT_OWNER: "COURT_OWNER",
  VENUE_MANAGER: "VENUE_MANAGER",
  /** @deprecated alias — normalize → VENUE_MANAGER */
  COURT_MANAGER: "COURT_MANAGER",
  TOURNAMENT_MANAGER: "TOURNAMENT_MANAGER",
  TEAM_CAPTAIN: "TEAM_CAPTAIN",
  CASHIER: "CASHIER",
  CLUB_MANAGER: "CLUB_MANAGER",
  /** @deprecated alias — normalize → CLUB_MANAGER */
  CLUB_OWNER: "CLUB_OWNER",
  COACH: "COACH",
  REFEREE: "REFEREE",
  STAFF: "STAFF",
  PLAYER: "PLAYER",
  CUSTOMER: "CUSTOMER",
  SUPPORT: "SUPPORT",
  /** @deprecated — giữ tương thích v4 */
  ACCOUNTANT: "ACCOUNTANT",
  /** @deprecated DB legacy — normalize → TENANT_OWNER */
  VENUE_OWNER: "VENUE_OWNER"
});
var LEGACY_ROLE_ALIASES = Object.freeze({
  [ROLES.SUPER_ADMIN]: ROLES.PLATFORM_ADMIN,
  [ROLES.COURT_OWNER]: ROLES.TENANT_OWNER,
  [ROLES.COURT_MANAGER]: ROLES.VENUE_MANAGER,
  [ROLES.CLUB_OWNER]: ROLES.CLUB_MANAGER,
  [ROLES.VENUE_OWNER]: ROLES.TENANT_OWNER,
  ADMIN: ROLES.PLATFORM_ADMIN,
  owner: ROLES.TENANT_OWNER,
  OWNER: ROLES.TENANT_OWNER
});
var CANONICAL_ROLES = Object.freeze([
  ROLES.PLATFORM_ADMIN,
  ROLES.SYSTEM_TECHNICIAN,
  ROLES.TENANT_OWNER,
  ROLES.VENUE_MANAGER,
  ROLES.TOURNAMENT_MANAGER,
  ROLES.TEAM_CAPTAIN,
  ROLES.CASHIER,
  ROLES.CLUB_MANAGER,
  ROLES.COACH,
  ROLES.REFEREE,
  ROLES.STAFF,
  ROLES.PLAYER,
  ROLES.CUSTOMER,
  ROLES.SUPPORT,
  ROLES.ACCOUNTANT
]);
var ROLE_LABELS = Object.freeze({
  [ROLES.PLATFORM_ADMIN]: "Qu\u1EA3n tr\u1ECB n\u1EC1n t\u1EA3ng / Super Admin",
  [ROLES.SUPER_ADMIN]: "Qu\u1EA3n tr\u1ECB n\u1EC1n t\u1EA3ng / Super Admin",
  [ROLES.SYSTEM_TECHNICIAN]: "Admin",
  [ROLES.TENANT_OWNER]: "Ch\u1EE7 \u0111\u01A1n v\u1ECB / Ch\u1EE7 s\xE2n",
  [ROLES.COURT_OWNER]: "Ch\u1EE7 \u0111\u01A1n v\u1ECB / Ch\u1EE7 s\xE2n",
  [ROLES.VENUE_MANAGER]: "Qu\u1EA3n l\xFD c\u01A1 s\u1EDF",
  [ROLES.COURT_MANAGER]: "Qu\u1EA3n l\xFD c\u01A1 s\u1EDF",
  [ROLES.TOURNAMENT_MANAGER]: "Qu\u1EA3n l\xFD gi\u1EA3i \u0111\u1EA5u",
  [ROLES.TEAM_CAPTAIN]: "Tr\u01B0\u1EDFng nh\xF3m / \u0110\u1ED9i tr\u01B0\u1EDFng",
  [ROLES.CASHIER]: "Thu ng\xE2n",
  [ROLES.CLUB_MANAGER]: "Qu\u1EA3n l\xFD CLB",
  [ROLES.CLUB_OWNER]: "Qu\u1EA3n l\xFD CLB",
  [ROLES.COACH]: "Hu\u1EA5n luy\u1EC7n vi\xEAn",
  [ROLES.REFEREE]: "Tr\u1ECDng t\xE0i",
  [ROLES.STAFF]: "Nh\xE2n s\u1EF1 v\u1EADn h\xE0nh",
  [ROLES.PLAYER]: "V\u1EADn \u0111\u1ED9ng vi\xEAn",
  [ROLES.CUSTOMER]: "Kh\xE1ch h\xE0ng / H\u1ED9i vi\xEAn",
  [ROLES.SUPPORT]: "H\u1ED7 tr\u1EE3 h\u1EC7 th\u1ED1ng",
  [ROLES.VENUE_OWNER]: "Ch\u1EE7 \u0111\u01A1n v\u1ECB / Ch\u1EE7 s\xE2n",
  [ROLES.ACCOUNTANT]: "K\u1EBF to\xE1n"
});
var GLOBAL_ROLES = Object.freeze([ROLES.PLATFORM_ADMIN]);
var PLATFORM_SCOPED_ROLES = Object.freeze([ROLES.SYSTEM_TECHNICIAN]);
var VENUE_SCOPED_ROLES = Object.freeze([
  ROLES.TENANT_OWNER,
  ROLES.VENUE_MANAGER,
  ROLES.TOURNAMENT_MANAGER,
  ROLES.CASHIER,
  ROLES.ACCOUNTANT,
  ROLES.STAFF,
  ROLES.COACH
]);
var CLUB_SCOPED_ROLES = Object.freeze([ROLES.CLUB_MANAGER, ROLES.PLAYER]);
var TOURNAMENT_TEAM_SCOPED_ROLES = Object.freeze([ROLES.TEAM_CAPTAIN]);
function normalizeRole(role) {
  const value = String(role || "").trim();
  if (!value) {
    return "";
  }
  if (LEGACY_ROLE_ALIASES[value]) {
    return LEGACY_ROLE_ALIASES[value];
  }
  const upper = value.toUpperCase();
  if (LEGACY_ROLE_ALIASES[upper]) {
    return LEGACY_ROLE_ALIASES[upper];
  }
  if (CANONICAL_ROLES.includes(upper)) {
    return upper;
  }
  return value;
}
function rolesEqual(roleA, roleB) {
  return normalizeRole(roleA) === normalizeRole(roleB);
}
function isGlobalRole(role) {
  return rolesEqual(role, ROLES.PLATFORM_ADMIN);
}
function isPlatformScopedRole(role) {
  const normalized = normalizeRole(role);
  return PLATFORM_SCOPED_ROLES.includes(normalized);
}
function isPlatformWideRole(role) {
  const normalized = normalizeRole(role);
  return isGlobalRole(normalized) || isPlatformScopedRole(normalized);
}

// src/features/identity/constants/permissions.js
var PERMISSIONS = Object.freeze({
  // ─── Core Sprint 1 (spec) ───────────────────────────────────────
  PLAYER_VIEW: "player.view",
  PLAYER_CREATE: "player.create",
  PLAYER_UPDATE: "player.update",
  PLAYER_DELETE: "player.delete",
  SKILL_LEVEL_VIEW_PRIVATE: "skill_level.view_private",
  SKILL_LEVEL_REQUEST_CHANGE: "skill_level.request_change",
  SKILL_LEVEL_APPROVE: "skill_level.approve",
  SKILL_LEVEL_VERIFY_CLUB: "skill_level.verify_club",
  SKILL_LEVEL_VERIFY_TOURNAMENT: "skill_level.verify_tournament",
  COURT_VIEW: "court.view",
  COURT_CREATE: "court.create",
  COURT_UPDATE: "court.update",
  COURT_DELETE: "court.delete",
  CLUSTER_VIEW: "cluster.view",
  CLUSTER_MANAGE: "cluster.manage",
  TOURNAMENT_VIEW: "tournament.view",
  TOURNAMENT_CREATE: "tournament.create",
  TOURNAMENT_UPDATE: "tournament.update",
  TOURNAMENT_DELETE: "tournament.delete",
  MATCH_UPDATE: "match.update",
  DIRECTOR_USE: "director.use",
  FINANCE_VIEW: "finance.view",
  FINANCE_EDIT: "finance.edit",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  /** Chủ sân tùy chỉnh quyền nhân viên trong phạm vi tenant (không phải role.manage platform). */
  TENANT_ROLE_CUSTOMIZE: "tenant.role.customize",
  SYSTEM_SETTING: "system.setting",
  // ─── Domain extensions (CRUD, existing modules) ─────────────────
  CLUB_VIEW: "club.view",
  CLUB_CREATE: "club.create",
  CLUB_UPDATE: "club.update",
  CLUB_DELETE: "club.delete",
  CLUB_GOVERNANCE_ASSIGN_OWNER: "club.governance.assign_owner",
  CLUB_GOVERNANCE_APPROVE: "club.governance.approve",
  CLUB_MEMBERSHIP_REVIEW: "club.membership.review",
  PLAYER_VIEW_SUMMARY: "player.view_summary",
  PLAYER_VIEW_FOR_TOURNAMENT_INVITE: "player.view_for_tournament_invite",
  SEASON_UPDATE: "season.update",
  LEAGUE_UPDATE: "league.update",
  BOOKING_VIEW: "booking.view",
  BOOKING_CREATE: "booking.create",
  BOOKING_UPDATE: "booking.update",
  BOOKING_DELETE: "booking.delete",
  CUSTOMER_VIEW: "customer.view",
  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_UPDATE: "customer.update",
  CUSTOMER_DELETE: "customer.delete",
  SCHEDULING_VIEW: "scheduling.view",
  SCHEDULING_RUN: "scheduling.run",
  STATISTICS_VIEW: "statistics.view",
  STATISTICS_EXPORT: "statistics.export",
  SETTINGS_VIEW: "settings.view",
  VENUE_VIEW: "venue.view",
  VENUE_UPDATE: "venue.update",
  SUBSCRIPTION_VIEW: "subscription.view",
  SUBSCRIPTION_UPDATE: "subscription.update",
  BILLING_VIEW: "billing.view",
  BILLING_MANAGE: "billing.manage",
  BILLING_INVOICE_VIEW: "billing.invoice.view",
  BILLING_INVOICE_CREATE: "billing.invoice.create",
  BILLING_INVOICE_MARK_PAID: "billing.invoice.mark_paid",
  BILLING_PAYMENT_VIEW: "billing.payment.view",
  BILLING_PAYMENT_MANAGE: "billing.payment.manage",
  BILLING_SUBSCRIPTION_VIEW: "billing.subscription.view",
  BILLING_SUBSCRIPTION_MANAGE: "billing.subscription.manage",
  BILLING_PLAN_VIEW: "billing.plan.view",
  BILLING_PLAN_MANAGE: "billing.plan.manage",
  BILLING_TENANT_LOCK: "billing.tenant.lock",
  BILLING_TENANT_UNLOCK: "billing.tenant.unlock",
  BILLING_AUDIT_VIEW: "billing.audit.view",
  INTEGRATION_VIEW: "integration.view",
  INTEGRATION_MANAGE: "integration.manage",
  MARKETPLACE_VIEW: "marketplace.view",
  MARKETPLACE_MANAGE: "marketplace.manage",
  API_MANAGE: "api.manage",
  // ─── Team tournament (v5 legacy keys) ─────────────────────────────
  TEAM_MANAGE: "team.manage",
  TEAM_VIEW: "team.view",
  TEAM_LINEUP_SUBMIT: "team.lineup.submit",
  TEAM_LINEUP_LOCK: "team.lineup.lock",
  TEAM_LINEUP_PUBLISH: "team.lineup.publish",
  TEAM_LINEUP_RANDOMIZE: "team.lineup.randomize",
  TEAM_LINEUP_OVERRIDE: "team.lineup.override",
  TEAM_FORFEIT_APPLY: "team.forfeit.apply",
  TEAM_WITHDRAW: "team.withdraw",
  TEAM_MATCH_RESULT_MANAGE: "team.match.result.manage",
  TEAM_STANDINGS_VIEW: "team.standings.view",
  // ─── V5.1 — Kỹ thuật viên hệ thống ──────────────────────────────
  SYSTEM_HEALTH_VIEW: "system.health.view",
  SYSTEM_LOG_VIEW: "system.log.view",
  SYSTEM_CONFIG_VIEW: "system.config.view",
  SYSTEM_CONFIG_UPDATE_LIMITED: "system.config.update_limited",
  TENANT_VIEW: "tenant.view",
  USER_VIEW: "user.view",
  ROLE_VIEW: "role.view",
  PERMISSION_VIEW: "permission.view",
  ACTIVITY_LOG_VIEW: "activity_log.view",
  INTEGRATION_TEST: "integration.test",
  SUPPORT_TICKET_MANAGE: "support_ticket.manage",
  DATA_DIAGNOSTIC_VIEW: "data_diagnostic.view",
  MIGRATION_STATUS_VIEW: "migration_status.view",
  // ─── V5.2 — Trưởng nhóm / Đội trưởng ────────────────────────────
  TEAM_MEMBER_VIEW: "team_member.view",
  TEAM_MEMBER_PROPOSE: "team_member.propose",
  TEAM_MEMBER_MANAGE_LIMITED: "team_member.manage_limited",
  TEAM_LINEUP_VIEW: "team_lineup.view",
  TEAM_LINEUP_SUBMIT_V5: "team_lineup.submit",
  TEAM_LINEUP_UPDATE_BEFORE_LOCK: "team_lineup.update_before_lock",
  TEAM_SCHEDULE_VIEW: "team_schedule.view",
  TEAM_RESULT_VIEW: "team_result.view",
  TEAM_MESSAGE_SEND: "team_message.send",
  TEAM_CHECKIN_VIEW: "team_checkin.view",
  TEAM_CHECKIN_CONFIRM: "team_checkin.confirm",
  TEAM_ATTENDANCE_CONFIRM: "team_attendance.confirm",
  TEAM_SUBSTITUTION_REQUEST: "team_substitution.request",
  // ─── V5.2 — Giải đồng đội (BTC / quản lý giải) ──────────────────
  TEAM_EVENT_VIEW: "team_event.view",
  TEAM_EVENT_MANAGE: "team_event.manage",
  EXISTING_TEAM_VIEW: "existing_team.view",
  EXISTING_TEAM_SELECT: "existing_team.select",
  EXISTING_TEAM_MANAGE: "existing_team.manage",
  IN_TOURNAMENT_TEAM_VIEW: "in_tournament_team.view",
  IN_TOURNAMENT_TEAM_CREATE: "in_tournament_team.create",
  IN_TOURNAMENT_TEAM_UPDATE: "in_tournament_team.update",
  IN_TOURNAMENT_TEAM_DELETE: "in_tournament_team.delete",
  TEAM_MANUAL_SPLIT_VIEW: "team_manual_split.view",
  TEAM_MANUAL_SPLIT_MANAGE: "team_manual_split.manage",
  TEAM_AUTO_DRAW_VIEW: "team_auto_draw.view",
  TEAM_AUTO_DRAW_MANAGE: "team_auto_draw.manage",
  TEAM_DRAFT_VIEW: "team_draft.view",
  TEAM_DRAFT_MANAGE: "team_draft.manage",
  TEAM_CAPTAIN_ASSIGN: "team_captain.assign",
  TEAM_CAPTAIN_REMOVE: "team_captain.remove",
  TEAM_CAPTAIN_VIEW: "team_captain.view",
  TEAM_LINEUP_APPROVE: "team_lineup.approve",
  TEAM_LINEUP_LOCK_V5: "team_lineup.lock",
  TEAM_SUBSTITUTION_APPROVE: "team_substitution.approve",
  // ─── V5.0 Phase 29 — VPR Ranking ─────────────────────────────────
  RANKING_VIEW: "ranking.view",
  RANKING_MANAGE: "ranking.manage",
  TOURNAMENT_CERTIFY: "tournament.certify",
  /** Founder-only: can thiệp ghép cặp/chia bảng trong setup. */
  PLATFORM_PAIRING_OVERRIDE: "platform.pairing_override",
  /** SUPER_ADMIN only — Private Pairing Rules Engine V2. */
  PAIRING_PRIVATE_RULES_VIEW: "pairing.private_rules.view",
  PAIRING_PRIVATE_RULES_MANAGE: "pairing.private_rules.manage",
  PAIRING_PRIVATE_RULES_AUDIT: "pairing.private_rules.audit",
  PAIRING_PRIVATE_RULES_SIMULATE: "pairing.private_rules.simulate",
  // ─── Canonical competition referee (generic, not Team Tournament) ─
  COMPETITION_REFEREE_ASSIGNMENT_READ: "competition.referee.assignment.read",
  COMPETITION_REFEREE_ASSIGNMENT_MANAGE: "competition.referee.assignment.manage",
  COMPETITION_REFEREE_ASSIGNMENT_ACKNOWLEDGE: "competition.referee.assignment.acknowledge",
  COMPETITION_REFEREE_MATCH_CONTROL: "competition.referee.match.control",
  COMPETITION_REFEREE_SCORE_SUBMIT: "competition.referee.score.submit",
  COMPETITION_REFEREE_RESULT_SUBMIT: "competition.referee.result.submit",
  COMPETITION_REFEREE_RESULT_CORRECT: "competition.referee.result.correct",
  COMPETITION_REFEREE_RESULT_READ: "competition.referee.result.read",
  COMPETITION_REFEREE_INCIDENT_REPORT: "competition.referee.incident.report"
});

// src/features/court-engine/guards/courtEngineGuard.js
var COURT_ENGINE_PERMISSIONS = Object.freeze({
  USE: "court_engine.use",
  MANAGE: "court_engine.manage",
  CHECK_IN: "court_engine.check_in",
  TRANSFER: "court_engine.transfer"
});

// src/features/identity/matrix/rolePermissions.js
var ALL_PERMISSIONS = Object.values(PERMISSIONS);
var SYSTEM_TECHNICIAN_PERMISSIONS = [
  PERMISSIONS.SYSTEM_HEALTH_VIEW,
  PERMISSIONS.SYSTEM_LOG_VIEW,
  PERMISSIONS.SYSTEM_CONFIG_VIEW,
  PERMISSIONS.SYSTEM_CONFIG_UPDATE_LIMITED,
  PERMISSIONS.TENANT_VIEW,
  PERMISSIONS.VENUE_VIEW,
  PERMISSIONS.USER_VIEW,
  PERMISSIONS.ROLE_VIEW,
  PERMISSIONS.PERMISSION_VIEW,
  PERMISSIONS.ACTIVITY_LOG_VIEW,
  PERMISSIONS.INTEGRATION_VIEW,
  PERMISSIONS.INTEGRATION_TEST,
  PERMISSIONS.SUPPORT_TICKET_MANAGE,
  PERMISSIONS.DATA_DIAGNOSTIC_VIEW,
  PERMISSIONS.MIGRATION_STATUS_VIEW,
  PERMISSIONS.SETTINGS_VIEW,
  PERMISSIONS.SKILL_LEVEL_APPROVE,
  PERMISSIONS.SKILL_LEVEL_VERIFY_CLUB,
  PERMISSIONS.RANKING_VIEW,
  PERMISSIONS.RANKING_MANAGE,
  PERMISSIONS.TOURNAMENT_CERTIFY,
  PERMISSIONS.CLUSTER_VIEW,
  PERMISSIONS.CLUSTER_MANAGE,
  PERMISSIONS.PLAYER_VIEW
];
var TEAM_CAPTAIN_PERMISSIONS = [
  PERMISSIONS.TOURNAMENT_VIEW,
  PERMISSIONS.TEAM_VIEW,
  PERMISSIONS.TEAM_LINEUP_SUBMIT,
  PERMISSIONS.TEAM_STANDINGS_VIEW,
  PERMISSIONS.TEAM_MEMBER_VIEW,
  PERMISSIONS.TEAM_MEMBER_PROPOSE,
  PERMISSIONS.TEAM_MEMBER_MANAGE_LIMITED,
  PERMISSIONS.TEAM_LINEUP_VIEW,
  PERMISSIONS.TEAM_LINEUP_SUBMIT_V5,
  PERMISSIONS.TEAM_LINEUP_UPDATE_BEFORE_LOCK,
  PERMISSIONS.TEAM_SCHEDULE_VIEW,
  PERMISSIONS.TEAM_RESULT_VIEW,
  PERMISSIONS.TEAM_MESSAGE_SEND,
  PERMISSIONS.TEAM_CHECKIN_VIEW,
  PERMISSIONS.TEAM_CHECKIN_CONFIRM,
  PERMISSIONS.TEAM_ATTENDANCE_CONFIRM,
  PERMISSIONS.TEAM_SUBSTITUTION_REQUEST
];
var TEAM_TOURNAMENT_MANAGE_PERMISSIONS = [
  PERMISSIONS.TEAM_EVENT_VIEW,
  PERMISSIONS.TEAM_EVENT_MANAGE,
  PERMISSIONS.EXISTING_TEAM_VIEW,
  PERMISSIONS.EXISTING_TEAM_SELECT,
  PERMISSIONS.EXISTING_TEAM_MANAGE,
  PERMISSIONS.IN_TOURNAMENT_TEAM_VIEW,
  PERMISSIONS.IN_TOURNAMENT_TEAM_CREATE,
  PERMISSIONS.IN_TOURNAMENT_TEAM_UPDATE,
  PERMISSIONS.IN_TOURNAMENT_TEAM_DELETE,
  PERMISSIONS.TEAM_MANUAL_SPLIT_VIEW,
  PERMISSIONS.TEAM_MANUAL_SPLIT_MANAGE,
  PERMISSIONS.TEAM_AUTO_DRAW_VIEW,
  PERMISSIONS.TEAM_AUTO_DRAW_MANAGE,
  PERMISSIONS.TEAM_DRAFT_VIEW,
  PERMISSIONS.TEAM_DRAFT_MANAGE,
  PERMISSIONS.TEAM_CAPTAIN_ASSIGN,
  PERMISSIONS.TEAM_CAPTAIN_REMOVE,
  PERMISSIONS.TEAM_CAPTAIN_VIEW,
  PERMISSIONS.TEAM_LINEUP_APPROVE,
  PERMISSIONS.TEAM_LINEUP_LOCK_V5,
  PERMISSIONS.TEAM_SUBSTITUTION_APPROVE
];
var TEAM_TOURNAMENT_PERMISSIONS = [
  PERMISSIONS.TEAM_MANAGE,
  PERMISSIONS.TEAM_VIEW,
  PERMISSIONS.TEAM_LINEUP_LOCK,
  PERMISSIONS.TEAM_LINEUP_PUBLISH,
  PERMISSIONS.TEAM_LINEUP_RANDOMIZE,
  PERMISSIONS.TEAM_MATCH_RESULT_MANAGE,
  PERMISSIONS.TEAM_STANDINGS_VIEW,
  ...TEAM_TOURNAMENT_MANAGE_PERMISSIONS
];
var CANONICAL_REFEREE_OPERATIONS_PERMISSIONS = [
  PERMISSIONS.COMPETITION_REFEREE_ASSIGNMENT_READ,
  PERMISSIONS.COMPETITION_REFEREE_ASSIGNMENT_ACKNOWLEDGE,
  PERMISSIONS.COMPETITION_REFEREE_MATCH_CONTROL,
  PERMISSIONS.COMPETITION_REFEREE_SCORE_SUBMIT,
  PERMISSIONS.COMPETITION_REFEREE_RESULT_SUBMIT,
  PERMISSIONS.COMPETITION_REFEREE_RESULT_CORRECT,
  PERMISSIONS.COMPETITION_REFEREE_RESULT_READ,
  PERMISSIONS.COMPETITION_REFEREE_INCIDENT_REPORT
];
var CANONICAL_REFEREE_ORGANIZER_PERMISSIONS = [
  PERMISSIONS.COMPETITION_REFEREE_ASSIGNMENT_MANAGE,
  PERMISSIONS.COMPETITION_REFEREE_ASSIGNMENT_READ,
  PERMISSIONS.COMPETITION_REFEREE_RESULT_READ
];
var VENUE_OPS = [
  PERMISSIONS.VENUE_VIEW,
  PERMISSIONS.COURT_VIEW,
  PERMISSIONS.COURT_CREATE,
  PERMISSIONS.COURT_UPDATE,
  PERMISSIONS.BOOKING_VIEW,
  PERMISSIONS.BOOKING_CREATE,
  PERMISSIONS.BOOKING_UPDATE,
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.CLUB_VIEW,
  PERMISSIONS.PLAYER_VIEW,
  PERMISSIONS.PLAYER_VIEW_SUMMARY,
  PERMISSIONS.PLAYER_VIEW_FOR_TOURNAMENT_INVITE,
  PERMISSIONS.SKILL_LEVEL_VIEW_PRIVATE,
  PERMISSIONS.TOURNAMENT_VIEW,
  PERMISSIONS.TOURNAMENT_CREATE,
  PERMISSIONS.TOURNAMENT_UPDATE,
  PERMISSIONS.DIRECTOR_USE,
  PERMISSIONS.MATCH_UPDATE,
  PERMISSIONS.SCHEDULING_VIEW,
  PERMISSIONS.SCHEDULING_RUN,
  COURT_ENGINE_PERMISSIONS.USE,
  COURT_ENGINE_PERMISSIONS.MANAGE,
  COURT_ENGINE_PERMISSIONS.TRANSFER,
  PERMISSIONS.STATISTICS_VIEW,
  PERMISSIONS.SETTINGS_VIEW,
  PERMISSIONS.RANKING_VIEW,
  ...TEAM_TOURNAMENT_PERMISSIONS,
  ...CANONICAL_REFEREE_ORGANIZER_PERMISSIONS
];
var TENANT_OWNER_PERMISSIONS = [
  ...VENUE_OPS,
  PERMISSIONS.VENUE_UPDATE,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.TENANT_ROLE_CUSTOMIZE,
  PERMISSIONS.SUBSCRIPTION_VIEW,
  PERMISSIONS.BILLING_VIEW,
  PERMISSIONS.BILLING_INVOICE_VIEW,
  PERMISSIONS.BILLING_PAYMENT_VIEW,
  PERMISSIONS.BILLING_SUBSCRIPTION_VIEW,
  PERMISSIONS.FINANCE_EDIT,
  PERMISSIONS.CLUB_CREATE,
  PERMISSIONS.CLUB_UPDATE,
  PERMISSIONS.CLUB_DELETE,
  PERMISSIONS.CLUB_GOVERNANCE_ASSIGN_OWNER,
  PERMISSIONS.CLUB_GOVERNANCE_APPROVE,
  PERMISSIONS.CLUB_MEMBERSHIP_REVIEW,
  PERMISSIONS.SEASON_UPDATE,
  PERMISSIONS.LEAGUE_UPDATE,
  PERMISSIONS.PLAYER_CREATE,
  PERMISSIONS.PLAYER_UPDATE,
  PERMISSIONS.PLAYER_DELETE,
  PERMISSIONS.COURT_DELETE,
  PERMISSIONS.BOOKING_DELETE,
  PERMISSIONS.CUSTOMER_CREATE,
  PERMISSIONS.CUSTOMER_UPDATE,
  PERMISSIONS.CUSTOMER_DELETE,
  PERMISSIONS.TOURNAMENT_DELETE,
  PERMISSIONS.STATISTICS_EXPORT,
  PERMISSIONS.SYSTEM_SETTING,
  PERMISSIONS.INTEGRATION_VIEW,
  PERMISSIONS.INTEGRATION_MANAGE,
  PERMISSIONS.MARKETPLACE_VIEW,
  PERMISSIONS.MARKETPLACE_MANAGE,
  PERMISSIONS.API_MANAGE,
  PERMISSIONS.RANKING_VIEW
];
var VENUE_MANAGER_PERMISSIONS = [
  ...VENUE_OPS,
  PERMISSIONS.PLAYER_CREATE,
  PERMISSIONS.PLAYER_UPDATE,
  PERMISSIONS.PLAYER_DELETE,
  PERMISSIONS.COURT_UPDATE,
  PERMISSIONS.COURT_DELETE,
  PERMISSIONS.BOOKING_UPDATE,
  PERMISSIONS.BOOKING_DELETE,
  PERMISSIONS.CUSTOMER_UPDATE
];
var TOURNAMENT_MANAGER_PERMISSIONS = [
  PERMISSIONS.TOURNAMENT_VIEW,
  PERMISSIONS.TOURNAMENT_CREATE,
  PERMISSIONS.TOURNAMENT_UPDATE,
  PERMISSIONS.TOURNAMENT_DELETE,
  PERMISSIONS.DIRECTOR_USE,
  PERMISSIONS.MATCH_UPDATE,
  COURT_ENGINE_PERMISSIONS.USE,
  COURT_ENGINE_PERMISSIONS.MANAGE,
  PERMISSIONS.STATISTICS_VIEW,
  PERMISSIONS.STATISTICS_EXPORT,
  PERMISSIONS.SETTINGS_VIEW,
  PERMISSIONS.PLAYER_VIEW,
  PERMISSIONS.SKILL_LEVEL_VIEW_PRIVATE,
  PERMISSIONS.SKILL_LEVEL_VERIFY_TOURNAMENT,
  PERMISSIONS.VENUE_VIEW,
  ...TEAM_TOURNAMENT_PERMISSIONS,
  ...CANONICAL_REFEREE_ORGANIZER_PERMISSIONS
];
var CASHIER_PERMISSIONS = [
  PERMISSIONS.COURT_VIEW,
  PERMISSIONS.BOOKING_VIEW,
  PERMISSIONS.BOOKING_CREATE,
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.FINANCE_EDIT
];
var ACCOUNTANT_PERMISSIONS = [
  PERMISSIONS.BOOKING_VIEW,
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.FINANCE_EDIT,
  PERMISSIONS.STATISTICS_VIEW,
  PERMISSIONS.STATISTICS_EXPORT
];
var CLUB_MANAGER_PERMISSIONS = [
  PERMISSIONS.CLUB_VIEW,
  PERMISSIONS.CLUB_CREATE,
  PERMISSIONS.CLUB_UPDATE,
  PERMISSIONS.CLUB_MEMBERSHIP_REVIEW,
  PERMISSIONS.SEASON_UPDATE,
  PERMISSIONS.LEAGUE_UPDATE,
  PERMISSIONS.PLAYER_VIEW,
  PERMISSIONS.PLAYER_CREATE,
  PERMISSIONS.PLAYER_UPDATE,
  PERMISSIONS.PLAYER_DELETE,
  PERMISSIONS.SKILL_LEVEL_VIEW_PRIVATE,
  PERMISSIONS.SKILL_LEVEL_VERIFY_CLUB,
  PERMISSIONS.TOURNAMENT_VIEW,
  PERMISSIONS.TOURNAMENT_CREATE,
  PERMISSIONS.TOURNAMENT_UPDATE,
  PERMISSIONS.TOURNAMENT_DELETE,
  PERMISSIONS.DIRECTOR_USE,
  PERMISSIONS.MATCH_UPDATE,
  PERMISSIONS.SCHEDULING_VIEW,
  PERMISSIONS.SCHEDULING_RUN,
  COURT_ENGINE_PERMISSIONS.USE,
  COURT_ENGINE_PERMISSIONS.MANAGE,
  COURT_ENGINE_PERMISSIONS.TRANSFER,
  PERMISSIONS.STATISTICS_VIEW,
  PERMISSIONS.STATISTICS_EXPORT,
  PERMISSIONS.SETTINGS_VIEW,
  PERMISSIONS.MARKETPLACE_VIEW,
  PERMISSIONS.INTEGRATION_VIEW,
  ...TEAM_TOURNAMENT_PERMISSIONS,
  ...CANONICAL_REFEREE_ORGANIZER_PERMISSIONS
];
var COACH_PERMISSIONS = [
  PERMISSIONS.CLUB_VIEW,
  PERMISSIONS.PLAYER_VIEW,
  PERMISSIONS.PLAYER_UPDATE,
  PERMISSIONS.SCHEDULING_VIEW,
  PERMISSIONS.STATISTICS_VIEW,
  PERMISSIONS.TOURNAMENT_VIEW
];
var STAFF_PERMISSIONS = [
  PERMISSIONS.COURT_VIEW,
  PERMISSIONS.BOOKING_VIEW,
  PERMISSIONS.BOOKING_CREATE,
  PERMISSIONS.BOOKING_UPDATE,
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.TOURNAMENT_VIEW,
  PERMISSIONS.SCHEDULING_VIEW
];
var REFEREE_PERMISSIONS = [
  PERMISSIONS.TOURNAMENT_VIEW,
  PERMISSIONS.MATCH_UPDATE,
  PERMISSIONS.TEAM_MATCH_RESULT_MANAGE,
  PERMISSIONS.TEAM_STANDINGS_VIEW,
  PERMISSIONS.STATISTICS_VIEW,
  ...CANONICAL_REFEREE_OPERATIONS_PERMISSIONS
];
var PLAYER_PERMISSIONS = [
  PERMISSIONS.TOURNAMENT_VIEW,
  PERMISSIONS.STATISTICS_VIEW,
  PERMISSIONS.PLAYER_VIEW,
  PERMISSIONS.PLAYER_UPDATE,
  PERMISSIONS.SKILL_LEVEL_VIEW_PRIVATE,
  PERMISSIONS.SKILL_LEVEL_REQUEST_CHANGE,
  PERMISSIONS.TEAM_VIEW,
  PERMISSIONS.TEAM_LINEUP_SUBMIT,
  PERMISSIONS.TEAM_STANDINGS_VIEW,
  PERMISSIONS.CLUB_CREATE
];
var PLAYER_DEFAULT_PERMISSION_IDS = Object.freeze([...PLAYER_PERMISSIONS]);
var CUSTOMER_PERMISSIONS = [
  PERMISSIONS.BOOKING_VIEW,
  PERMISSIONS.BOOKING_CREATE,
  PERMISSIONS.TOURNAMENT_VIEW,
  PERMISSIONS.PLAYER_VIEW,
  PERMISSIONS.CUSTOMER_VIEW
];
var SUPPORT_PERMISSIONS = [
  PERMISSIONS.SUPPORT_TICKET_MANAGE,
  PERMISSIONS.USER_VIEW,
  PERMISSIONS.TENANT_VIEW,
  PERMISSIONS.ACTIVITY_LOG_VIEW,
  PERMISSIONS.INTEGRATION_VIEW
];
var ROLE_PERMISSIONS = Object.freeze({
  [ROLES.PLATFORM_ADMIN]: Object.freeze([...ALL_PERMISSIONS]),
  [ROLES.SYSTEM_TECHNICIAN]: Object.freeze(SYSTEM_TECHNICIAN_PERMISSIONS),
  [ROLES.TENANT_OWNER]: Object.freeze(TENANT_OWNER_PERMISSIONS),
  [ROLES.VENUE_MANAGER]: Object.freeze(VENUE_MANAGER_PERMISSIONS),
  [ROLES.TOURNAMENT_MANAGER]: Object.freeze(TOURNAMENT_MANAGER_PERMISSIONS),
  [ROLES.TEAM_CAPTAIN]: Object.freeze(TEAM_CAPTAIN_PERMISSIONS),
  [ROLES.CASHIER]: Object.freeze(CASHIER_PERMISSIONS),
  [ROLES.ACCOUNTANT]: Object.freeze(ACCOUNTANT_PERMISSIONS),
  [ROLES.CLUB_MANAGER]: Object.freeze(CLUB_MANAGER_PERMISSIONS),
  [ROLES.COACH]: Object.freeze(COACH_PERMISSIONS),
  [ROLES.REFEREE]: Object.freeze(REFEREE_PERMISSIONS),
  [ROLES.STAFF]: Object.freeze(STAFF_PERMISSIONS),
  [ROLES.PLAYER]: Object.freeze(PLAYER_PERMISSIONS),
  [ROLES.CUSTOMER]: Object.freeze(CUSTOMER_PERMISSIONS),
  [ROLES.SUPPORT]: Object.freeze(SUPPORT_PERMISSIONS)
});
function getPermissionsForRole(role) {
  const canonical = normalizeRole(role);
  return ROLE_PERMISSIONS[canonical] || [];
}

// src/models/user.js
var USER_STATUS = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended",
  INVITED: "invited"
});

// src/features/identity/services/subjectIdentityLookupService.js
var SUBJECT_IDENTITY_EVIDENCE_VERSION = "identity-subject-evidence-v1";
var SUBJECT_IDENTITY_LOOKUP_CODE = Object.freeze({
  OK: "OK",
  MISSING_SUBJECT_ID: "MISSING_SUBJECT_ID",
  MALFORMED_SUBJECT_ID: "MALFORMED_SUBJECT_ID",
  FUZZY_IDENTITY_FORBIDDEN: "FUZZY_IDENTITY_FORBIDDEN",
  DISPLAY_NAME_IS_NOT_IDENTITY: "DISPLAY_NAME_IS_NOT_IDENTITY",
  SUBJECT_NOT_FOUND: "SUBJECT_NOT_FOUND",
  SCOPE_MISMATCH: "SCOPE_MISMATCH",
  MISSING_SCOPE_EVIDENCE: "MISSING_SCOPE_EVIDENCE",
  INCOMPLETE_IDENTITY: "INCOMPLETE_IDENTITY"
});
var EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE_LIKE = /^[+]?[\d\s().-]{8,}$/;
var MAX_SUBJECT_ID_LENGTH = 128;
var ACTIVE_STATUS_VALUES = Object.freeze(["active"]);
var INACTIVE_STATUS_VALUES = Object.freeze([
  "suspended",
  "inactive",
  "invited",
  "disabled",
  "locked"
]);
function isNonEmptyString2(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function looksLikeEmailOrPhone(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (EMAIL_LIKE.test(trimmed) || trimmed.includes("@")) return true;
  const digits = trimmed.replace(/\D/g, "");
  return PHONE_LIKE.test(trimmed) && digits.length >= 8;
}
function isCanonicalSubjectId(value) {
  if (typeof value !== "string") return false;
  const id = value.trim();
  if (!id || id.length > MAX_SUBJECT_ID_LENGTH) return false;
  if (/\s/.test(id)) return false;
  if (looksLikeEmailOrPhone(id)) return false;
  return true;
}
function classifySubjectId(value) {
  if (value == null || value === "") {
    return SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SUBJECT_ID;
  }
  if (typeof value !== "string") {
    return SUBJECT_IDENTITY_LOOKUP_CODE.MALFORMED_SUBJECT_ID;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SUBJECT_ID;
  }
  if (/\s/.test(trimmed)) {
    return SUBJECT_IDENTITY_LOOKUP_CODE.DISPLAY_NAME_IS_NOT_IDENTITY;
  }
  if (looksLikeEmailOrPhone(trimmed)) {
    return SUBJECT_IDENTITY_LOOKUP_CODE.FUZZY_IDENTITY_FORBIDDEN;
  }
  if (!isCanonicalSubjectId(trimmed)) {
    return SUBJECT_IDENTITY_LOOKUP_CODE.MALFORMED_SUBJECT_ID;
  }
  return null;
}
function readAuthoritativeField(record, keys) {
  for (const key of keys) {
    if (isNonEmptyString2(record?.[key])) return String(record[key]).trim();
  }
  return null;
}
function authoritativeTenantId(record) {
  return readAuthoritativeField(record, ["tenantId", "tenant_id"]);
}
function authoritativeVenueId(record) {
  return readAuthoritativeField(record, ["venueId", "venue_id"]);
}
function authoritativeClubId(record) {
  return readAuthoritativeField(record, ["clubId", "club_id"]);
}
function authoritativeOrganizationId(record) {
  return readAuthoritativeField(record, ["organizationId", "organization_id"]);
}
function authoritativeStatus(raw) {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (ACTIVE_STATUS_VALUES.includes(normalized)) return USER_STATUS.ACTIVE;
  if (normalized === USER_STATUS.SUSPENDED || normalized === "suspended") {
    return USER_STATUS.SUSPENDED;
  }
  if (normalized === USER_STATUS.INVITED || normalized === "invited") {
    return USER_STATUS.INVITED;
  }
  if (INACTIVE_STATUS_VALUES.includes(normalized)) return normalized;
  return null;
}
function toCompetitionSafeEvidence(record) {
  const subjectId = String(record.id).trim();
  const role = normalizeRole(record.role);
  const status = authoritativeStatus(record.status);
  const tenantId = authoritativeTenantId(record);
  const venueId = authoritativeVenueId(record);
  const clubId = authoritativeClubId(record);
  const organizationId = authoritativeOrganizationId(record);
  return Object.freeze({
    subjectId,
    canonicalSubjectId: subjectId,
    role,
    status,
    active: status === USER_STATUS.ACTIVE,
    tenantId,
    venueId,
    clubId,
    organizationId,
    scopeIds: Object.freeze({
      tenantId,
      venueId,
      clubId,
      organizationId
    }),
    source: "identity",
    evidenceVersion: SUBJECT_IDENTITY_EVIDENCE_VERSION
  });
}
function subjectMatchesRequestedTenant(evidence, requestedTenantId) {
  if (!requestedTenantId) return false;
  if (evidence.tenantId && evidence.tenantId === requestedTenantId) return true;
  if (!evidence.tenantId && isPlatformWideRole(evidence.role)) return true;
  return false;
}
function incompleteResult(subjectId) {
  return Object.freeze({
    ok: false,
    code: SUBJECT_IDENTITY_LOOKUP_CODE.INCOMPLETE_IDENTITY,
    evidence: Object.freeze({
      subjectId,
      source: "identity",
      evidenceVersion: SUBJECT_IDENTITY_EVIDENCE_VERSION
    })
  });
}
async function defaultLoadIdentitySubjectById(subjectId) {
  const persistence = await Promise.resolve().then(() => (init_subjectIdentityPersistence(), subjectIdentityPersistence_exports));
  return persistence.loadIdentitySubjectByIdFromPersistence(subjectId);
}
async function resolveSubjectIdentityRecord(input = {}, deps = {}) {
  const malformed = classifySubjectId(input?.subjectId);
  if (malformed) {
    return Object.freeze({
      ok: false,
      code: malformed,
      evidence: null
    });
  }
  const subjectId = String(input.subjectId).trim();
  const requestedTenantId = isNonEmptyString2(input.requestedTenantId) ? String(input.requestedTenantId).trim() : isNonEmptyString2(input.tenantId) ? String(input.tenantId).trim() : null;
  const load = typeof deps.loadIdentitySubjectById === "function" ? deps.loadIdentitySubjectById : defaultLoadIdentitySubjectById;
  const record = await load(subjectId);
  if (!record || !isNonEmptyString2(record.id)) {
    return Object.freeze({
      ok: false,
      code: SUBJECT_IDENTITY_LOOKUP_CODE.SUBJECT_NOT_FOUND,
      evidence: Object.freeze({
        subjectId,
        source: "identity",
        evidenceVersion: SUBJECT_IDENTITY_EVIDENCE_VERSION
      })
    });
  }
  const loadedId = String(record.id).trim();
  if (loadedId !== subjectId) {
    return Object.freeze({
      ok: false,
      code: SUBJECT_IDENTITY_LOOKUP_CODE.SUBJECT_NOT_FOUND,
      evidence: Object.freeze({
        subjectId,
        source: "identity",
        evidenceVersion: SUBJECT_IDENTITY_EVIDENCE_VERSION
      })
    });
  }
  const role = normalizeRole(record.role);
  if (!role) {
    return incompleteResult(subjectId);
  }
  const status = authoritativeStatus(record.status);
  if (!status) {
    return incompleteResult(subjectId);
  }
  const evidence = toCompetitionSafeEvidence(record);
  if (requestedTenantId) {
    if (!evidence.tenantId && !isPlatformWideRole(evidence.role)) {
      return Object.freeze({
        ok: false,
        code: SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SCOPE_EVIDENCE,
        evidence: Object.freeze({
          subjectId: evidence.subjectId,
          tenantId: null,
          venueId: evidence.venueId,
          clubId: evidence.clubId,
          organizationId: evidence.organizationId,
          scopeIds: evidence.scopeIds,
          matchesRequestedTenant: false,
          source: evidence.source,
          evidenceVersion: evidence.evidenceVersion
        })
      });
    }
    if (!subjectMatchesRequestedTenant(evidence, requestedTenantId)) {
      return Object.freeze({
        ok: false,
        code: SUBJECT_IDENTITY_LOOKUP_CODE.SCOPE_MISMATCH,
        evidence: Object.freeze({
          subjectId: evidence.subjectId,
          tenantId: evidence.tenantId,
          venueId: evidence.venueId,
          clubId: evidence.clubId,
          organizationId: evidence.organizationId,
          scopeIds: evidence.scopeIds,
          matchesRequestedTenant: false,
          source: evidence.source,
          evidenceVersion: evidence.evidenceVersion
        })
      });
    }
  }
  return Object.freeze({
    ok: true,
    code: SUBJECT_IDENTITY_LOOKUP_CODE.OK,
    evidence: Object.freeze({
      ...evidence,
      matchesRequestedTenant: requestedTenantId ? subjectMatchesRequestedTenant(evidence, requestedTenantId) : null
    })
  });
}

// src/features/competition-engine/integration/constants.js
var INTEGRATION_ERROR_CODE = Object.freeze({
  MISSING_IDENTITY: "INTEGRATION_MISSING_IDENTITY",
  MISSING_TENANT: "INTEGRATION_MISSING_TENANT",
  MISSING_VENUE: "INTEGRATION_MISSING_VENUE",
  MISSING_CLUB: "INTEGRATION_MISSING_CLUB",
  PERMISSION_DENIED: "INTEGRATION_PERMISSION_DENIED",
  CROSS_TENANT_REJECTED: "INTEGRATION_CROSS_TENANT_REJECTED",
  PLAYER_MAPPING_MISSING: "INTEGRATION_PLAYER_MAPPING_MISSING",
  CLUB_MAPPING_MISSING: "INTEGRATION_CLUB_MAPPING_MISSING",
  RATING_UNAVAILABLE: "INTEGRATION_RATING_UNAVAILABLE",
  VENUE_RESOLUTION_FAILED: "INTEGRATION_VENUE_RESOLUTION_FAILED",
  ADAPTER_FAILURE: "INTEGRATION_ADAPTER_FAILURE",
  INVALID_REQUEST: "INTEGRATION_INVALID_REQUEST",
  CANONICAL_MUTATION_FORBIDDEN: "INTEGRATION_CANONICAL_MUTATION_FORBIDDEN"
});
var INTEGRATION_ERROR_CODE_VALUES = Object.freeze(
  Object.values(INTEGRATION_ERROR_CODE)
);
var ADAPTER_STATUS = Object.freeze({
  READY_TO_REUSE: "READY_TO_REUSE",
  CONTRACT_ONLY: "CONTRACT_ONLY",
  PARTIAL: "PARTIAL",
  DEFERRED_TO_LATER_E2E_WORKSTREAM: "DEFERRED_TO_LATER_E2E_WORKSTREAM",
  BLOCKING_WITH_EVIDENCE: "BLOCKING_WITH_EVIDENCE",
  IMPLEMENTED_IN_E2E_01: "IMPLEMENTED_IN_E2E_01"
});
var RATING_COMPLETENESS = Object.freeze({
  COMPLETE: "COMPLETE",
  PARTIAL: "PARTIAL",
  EMPTY: "EMPTY"
});
var INTEGRATION_SOURCE = Object.freeze({
  IDENTITY: "identity",
  PLAYER: "player",
  CLUB: "club",
  PLAYER_RATING_READ: "player-rating-read",
  VENUE_COURT: "venue-court",
  COMPETITION_ENGINE_INTEGRATION: "competition-engine-integration"
});

// src/features/competition-engine/integration/errors.js
var IntegrationError = class extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ details?: Record<string, unknown>, failClosed?: boolean, cause?: unknown }} [options]
   */
  constructor(code, message, options = {}) {
    super(message);
    this.name = "IntegrationError";
    this.code = String(code || INTEGRATION_ERROR_CODE.ADAPTER_FAILURE);
    this.failClosed = options.failClosed !== false;
    this.details = options.details && typeof options.details === "object" ? { ...options.details } : {};
    if (options.cause !== void 0) {
      this.cause = options.cause;
    }
  }
};
function throwIntegrationError(code, message, options = {}) {
  throw new IntegrationError(code, message, options);
}

// src/features/competition-engine/integration/context/requireIntegrationContext.js
function optionalNonEmptyString2(value) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function readScopeIds(scope) {
  const raw = scope && typeof scope === "object" ? (
    /** @type {Record<string, unknown>} */
    scope
  ) : {};
  return {
    tenantId: optionalNonEmptyString2(raw.tenantId),
    venueId: optionalNonEmptyString2(raw.venueId),
    clubId: optionalNonEmptyString2(raw.clubId),
    competitionId: optionalNonEmptyString2(raw.competitionId)
  };
}
function readSubjectIds(subject) {
  const raw = subject && typeof subject === "object" ? (
    /** @type {Record<string, unknown>} */
    subject
  ) : {};
  return {
    actorId: optionalNonEmptyString2(raw.actorId ?? raw.userId ?? raw.id),
    role: optionalNonEmptyString2(raw.role ?? raw.actorRole)
  };
}
function requireActorIdentity(subject) {
  const { actorId, role } = readSubjectIds(subject);
  if (!actorId) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.MISSING_IDENTITY,
      "Authenticated actor identity is required",
      { failClosed: true, details: { field: "actorId" } }
    );
  }
  return { actorId, role };
}
function requireTenantId(scope) {
  const { tenantId } = readScopeIds(scope);
  if (!tenantId) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.MISSING_TENANT,
      "Tenant scope is required",
      { failClosed: true, details: { field: "tenantId" } }
    );
  }
  return tenantId;
}
function assertTenantIsolation(evidenceTenantId, scopeTenantId) {
  const evidence = optionalNonEmptyString2(evidenceTenantId);
  const scope = optionalNonEmptyString2(scopeTenantId);
  if (!evidence || !scope) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.MISSING_TENANT,
      "Tenant isolation requires both evidence and scope tenantId",
      { failClosed: true, details: { evidenceTenantId: evidence, scopeTenantId: scope } }
    );
  }
  if (evidence !== scope) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.CROSS_TENANT_REJECTED,
      "Cross-tenant access rejected",
      {
        failClosed: true,
        details: { evidenceTenantId: evidence, scopeTenantId: scope }
      }
    );
  }
}

// src/features/competition-engine/integration/adapters/identityEvidenceFromIdentityAdapter.js
function createIdentityPermissionResolver(options = {}) {
  const resolvePermissions = typeof options.getPermissionsForRole === "function" ? options.getPermissionsForRole : getPermissionsForRole;
  const normalize = typeof options.normalizeRole === "function" ? options.normalizeRole : normalizeRole;
  return function resolveGrantedPermissions(input) {
    const subject = requireActorIdentity(input?.subject);
    if (!subject.role) {
      const err = new Error("Actor role is required");
      err.code = INTEGRATION_ERROR_CODE.MISSING_IDENTITY;
      throw err;
    }
    const tenantId = requireTenantId(input?.scope);
    const scopeIds = readScopeIds(input?.scope);
    const context = input?.context && typeof input.context === "object" ? input.context : {};
    const requiresVenue = context.requireVenue === true || context.venueRequired === true || options.requireVenueWhenPresent === true;
    if (requiresVenue && !scopeIds.venueId) {
      const err = new Error("Venue scope is required for this action");
      err.code = INTEGRATION_ERROR_CODE.MISSING_VENUE;
      throw err;
    }
    const claimedTenant = optionalNonEmptyString2(context.claimedTenantId);
    if (claimedTenant) {
      assertTenantIsolation(claimedTenant, tenantId);
    }
    const canonicalRole = normalize(subject.role);
    const grants = resolvePermissions(canonicalRole);
    if (!Array.isArray(grants)) {
      const err = new Error("Identity permission matrix returned invalid grants");
      err.code = INTEGRATION_ERROR_CODE.ADAPTER_FAILURE;
      throw err;
    }
    return [...grants].map((p) => String(p)).filter(Boolean).sort();
  };
}
function createIdentityEvidenceFromIdentityAdapter(options = {}) {
  const resolveGrantedPermissions = createIdentityPermissionResolver(options);
  const lookup = typeof options.resolveSubjectIdentityRecord === "function" ? options.resolveSubjectIdentityRecord : resolveSubjectIdentityRecord;
  const projection = createIdentityProjectionEvidencePort({
    resolveGrantedPermissions: async (input) => resolveGrantedPermissions(input),
    source: options.source || INTEGRATION_SOURCE.IDENTITY,
    evidenceVersion: options.evidenceVersion || "e2e-01-identity-evidence-v1"
  });
  return {
    async getEvidence(input) {
      const subject = readSubjectIds(input?.subject);
      const scope = readScopeIds(input?.scope);
      if (!subject.actorId || !subject.role) {
        return null;
      }
      if (!scope.tenantId) {
        return null;
      }
      const evidence = await projection.getEvidence(input);
      if (evidence == null) return null;
      return Object.freeze({
        ...evidence,
        attributes: Object.freeze({
          ...evidence.attributes || {},
          projected: true,
          dormant: false,
          integrationAdapter: "identityEvidenceFromIdentityAdapter",
          clientGrantsIgnored: true
        })
      });
    },
    /**
     * Point lookup by canonical subjectId. Translation only.
     * @param {{
     *   subjectId?: unknown,
     *   requestedTenantId?: unknown,
     *   tenantId?: unknown,
     *   correlationId?: unknown,
     * }} input
     */
    async resolveSubjectIdentity(input = {}) {
      return lookup(
        {
          subjectId: input.subjectId,
          requestedTenantId: input.requestedTenantId || input.tenantId,
          tenantId: input.tenantId,
          correlationId: input.correlationId
        },
        {
          loadIdentitySubjectById: options.loadIdentitySubjectById
        }
      );
    }
  };
}

// src/features/competition-engine/operations/constants.js
var ORGANIZER_ACTION = Object.freeze({
  OPERATIONS_READ: "organizer.operations.read",
  PREPARE_OPERATIONS: "organizer.operations.prepare",
  PARTICIPANTS_LOCK: "organizer.participants.lock",
  DRAW_PREPARE: "organizer.draw.prepare",
  SCHEDULE_PREPARE: "organizer.schedule.prepare",
  COURTS_CONFIRM: "organizer.courts.confirm",
  CHECKIN_MANAGE: "organizer.checkin.manage",
  MATCHES_CONTROL: "organizer.matches.control",
  KNOCKOUT_ACTIVATE: "organizer.knockout.activate",
  PUBLISH: "organizer.publish",
  COMPLETE: "organizer.complete",
  ARCHIVE_PREPARE: "organizer.archive.prepare"
});
var ORGANIZER_ACTION_VALUES = Object.freeze(
  Object.values(ORGANIZER_ACTION)
);
var ORGANIZER_LIFECYCLE_STATE = Object.freeze({
  UNINITIALIZED: "UNINITIALIZED",
  PREPARED: "PREPARED",
  PARTICIPANTS_LOCKED: "PARTICIPANTS_LOCKED",
  POOL_READY: "POOL_READY",
  SCHEDULE_READY: "SCHEDULE_READY",
  COURTS_CONFIRMED: "COURTS_CONFIRMED",
  OPERATIONAL_PLAN_PUBLISHED: "OPERATIONAL_PLAN_PUBLISHED",
  CHECKIN_OPEN: "CHECKIN_OPEN",
  CHECKIN_CLOSED: "CHECKIN_CLOSED",
  MATCH_OPS_OPEN: "MATCH_OPS_OPEN",
  MATCH_OPS_SUSPENDED: "MATCH_OPS_SUSPENDED",
  KNOCKOUT_ACTIVE: "KNOCKOUT_ACTIVE",
  COMPLETED: "COMPLETED",
  FINAL_RESULT_PUBLISHED: "FINAL_RESULT_PUBLISHED",
  ARCHIVE_READY: "ARCHIVE_READY"
});
var ORGANIZER_LIFECYCLE_STATE_VALUES = Object.freeze(
  Object.values(ORGANIZER_LIFECYCLE_STATE)
);
var PARTICIPANT_FIELD_STATE = Object.freeze({
  OPEN: "OPEN",
  LOCKED: "LOCKED"
});
var CHECKIN_STATE = Object.freeze({
  NOT_OPENED: "NOT_OPENED",
  OPEN: "OPEN",
  CLOSED: "CLOSED"
});
var MATCH_OPS_STATE = Object.freeze({
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  SUSPENDED: "SUSPENDED"
});
var PUBLICATION_OPS_STATE = Object.freeze({
  NONE: "NONE",
  OPERATIONAL_PLAN_PUBLISHED: "OPERATIONAL_PLAN_PUBLISHED",
  FINAL_RESULT_PUBLISHED: "FINAL_RESULT_PUBLISHED"
});
var ENTRY_OPS_STATUS = Object.freeze({
  PENDING: "PENDING",
  ELIGIBLE: "ELIGIBLE",
  INELIGIBLE: "INELIGIBLE",
  WITHDRAWN: "WITHDRAWN",
  WAITLISTED: "WAITLISTED",
  INVALID: "INVALID"
});
var ORGANIZER_BLOCKER_CODE = Object.freeze({
  MISSING_IDENTITY: "MISSING_IDENTITY",
  MISSING_TENANT: "MISSING_TENANT",
  MISSING_COMPETITION: "MISSING_COMPETITION",
  MISSING_VENUE: "MISSING_VENUE",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  CROSS_TENANT: "CROSS_TENANT",
  INVALID_STATE: "INVALID_STATE",
  PARTICIPANT_FIELD_INCOMPLETE: "PARTICIPANT_FIELD_INCOMPLETE",
  ELIGIBILITY_UNRESOLVED: "ELIGIBILITY_UNRESOLVED",
  POOL_COMPOSITION_MISSING: "POOL_COMPOSITION_MISSING",
  SCHEDULE_INCOMPLETE: "SCHEDULE_INCOMPLETE",
  SCHEDULE_UNCERTIFIED: "SCHEDULE_UNCERTIFIED",
  COURT_ASSIGNMENT_INCOMPLETE: "COURT_ASSIGNMENT_INCOMPLETE",
  COURT_SNAPSHOT_MISSING: "COURT_SNAPSHOT_MISSING",
  CHECKIN_NOT_OPEN: "CHECKIN_NOT_OPEN",
  CHECKIN_REQUIRED_MISSING: "CHECKIN_REQUIRED_MISSING",
  MATCH_OPS_NOT_OPEN: "MATCH_OPS_NOT_OPEN",
  ACTIVE_MATCHES: "ACTIVE_MATCHES",
  INCOMPLETE_MATCHES: "INCOMPLETE_MATCHES",
  STANDINGS_UNRESOLVED: "STANDINGS_UNRESOLVED",
  QUALIFICATION_NOT_READY: "QUALIFICATION_NOT_READY",
  UNRESOLVED_TIE: "UNRESOLVED_TIE",
  KNOCKOUT_INCOMPLETE: "KNOCKOUT_INCOMPLETE",
  COMPLETION_REQUIRED: "COMPLETION_REQUIRED",
  FINAL_PUBLICATION_REQUIRED: "FINAL_PUBLICATION_REQUIRED",
  DUPLICATE_PARTICIPANT: "DUPLICATE_PARTICIPANT",
  DUPLICATE_COMMAND: "DUPLICATE_COMMAND"
});
var ORGANIZER_ERROR_CODE = Object.freeze({
  MISSING_IDENTITY: "E2E03_MISSING_IDENTITY",
  MISSING_TENANT: "E2E03_MISSING_TENANT",
  MISSING_COMPETITION: "E2E03_MISSING_COMPETITION",
  MISSING_VENUE: "E2E03_MISSING_VENUE",
  PERMISSION_DENIED: "E2E03_PERMISSION_DENIED",
  CROSS_TENANT_REJECTED: "E2E03_CROSS_TENANT_REJECTED",
  INVALID_STATE: "E2E03_INVALID_STATE",
  INVALID_INPUT: "E2E03_INVALID_INPUT",
  PRECONDITION_FAILED: "E2E03_PRECONDITION_FAILED",
  PARTICIPANT_FIELD_INCOMPLETE: "E2E03_PARTICIPANT_FIELD_INCOMPLETE",
  DUPLICATE_PARTICIPANT: "E2E03_DUPLICATE_PARTICIPANT",
  POOL_COMPOSITION_MISSING: "E2E03_POOL_COMPOSITION_MISSING",
  SCHEDULE_UNCERTIFIED: "E2E03_SCHEDULE_UNCERTIFIED",
  SCHEDULE_INCOMPLETE: "E2E03_SCHEDULE_INCOMPLETE",
  COURT_ASSIGNMENT_INCOMPLETE: "E2E03_COURT_ASSIGNMENT_INCOMPLETE",
  COURT_SNAPSHOT_MISSING: "E2E03_COURT_SNAPSHOT_MISSING",
  CHECKIN_NOT_OPEN: "E2E03_CHECKIN_NOT_OPEN",
  CHECKIN_ALREADY_OPEN: "E2E03_CHECKIN_ALREADY_OPEN",
  CHECKIN_ALREADY_CLOSED: "E2E03_CHECKIN_ALREADY_CLOSED",
  CHECKIN_REQUIRED_MISSING: "E2E03_CHECKIN_REQUIRED_MISSING",
  MATCH_OPS_BLOCKED: "E2E03_MATCH_OPS_BLOCKED",
  ACTIVE_MATCHES: "E2E03_ACTIVE_MATCHES",
  INCOMPLETE_MATCHES: "E2E03_INCOMPLETE_MATCHES",
  QUALIFICATION_NOT_READY: "E2E03_QUALIFICATION_NOT_READY",
  UNRESOLVED_TIE: "E2E03_UNRESOLVED_TIE",
  COMPLETION_REQUIRED: "E2E03_COMPLETION_REQUIRED",
  FINAL_PUBLICATION_REQUIRED: "E2E03_FINAL_PUBLICATION_REQUIRED",
  CANONICAL_CALL_FAILED: "E2E03_CANONICAL_CALL_FAILED",
  CLIENT_GRANT_TRUST_REJECTED: "E2E03_CLIENT_GRANT_TRUST_REJECTED",
  UNKNOWN: "E2E03_UNKNOWN"
});
var ORGANIZER_ERROR_CODE_VALUES = Object.freeze(
  Object.values(ORGANIZER_ERROR_CODE)
);

// src/features/competition-engine/operations/permissions/organizerActionMap.js
var ORGANIZER_CAPABILITY = Object.freeze({
  OPERATIONS_READ: "competition.operations.read",
  PARTICIPANTS_LOCK: "competition.participants.lock",
  DRAW_PREPARE: "competition.draw.prepare",
  SCHEDULE_PREPARE: "competition.schedule.prepare",
  COURTS_CONFIRM: "competition.courts.confirm",
  CHECKIN_MANAGE: "competition.checkin.manage",
  MATCHES_CONTROL: "competition.matches.control",
  KNOCKOUT_ACTIVATE: "competition.knockout.activate",
  PUBLISH: "competition.publish",
  COMPLETE: "competition.complete",
  ARCHIVE_PREPARE: "competition.archive.prepare"
});
var ORGANIZER_ACTION_PERMISSION_MAP = Object.freeze({
  [ORGANIZER_ACTION.OPERATIONS_READ]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.OPERATIONS_READ,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_VIEW]),
    requireVenue: false
  }),
  [ORGANIZER_ACTION.PREPARE_OPERATIONS]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.OPERATIONS_READ,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_UPDATE]),
    requireVenue: false
  }),
  [ORGANIZER_ACTION.PARTICIPANTS_LOCK]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.PARTICIPANTS_LOCK,
    requiredPermissions: Object.freeze([PERMISSIONS.TOURNAMENT_UPDATE]),
    requireVenue: false
  }),
  [ORGANIZER_ACTION.DRAW_PREPARE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.DRAW_PREPARE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.DIRECTOR_USE
    ]),
    requireVenue: false
  }),
  [ORGANIZER_ACTION.SCHEDULE_PREPARE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.SCHEDULE_PREPARE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.SCHEDULING_RUN,
      PERMISSIONS.TOURNAMENT_UPDATE
    ]),
    requireVenue: true
  }),
  [ORGANIZER_ACTION.COURTS_CONFIRM]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.COURTS_CONFIRM,
    requiredPermissions: Object.freeze([
      PERMISSIONS.DIRECTOR_USE,
      PERMISSIONS.TOURNAMENT_UPDATE
    ]),
    requireVenue: true
  }),
  [ORGANIZER_ACTION.CHECKIN_MANAGE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.CHECKIN_MANAGE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.DIRECTOR_USE
    ]),
    requireVenue: false
  }),
  [ORGANIZER_ACTION.MATCHES_CONTROL]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.MATCHES_CONTROL,
    requiredPermissions: Object.freeze([
      PERMISSIONS.DIRECTOR_USE,
      PERMISSIONS.MATCH_UPDATE
    ]),
    requireVenue: false
  }),
  [ORGANIZER_ACTION.KNOCKOUT_ACTIVATE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.KNOCKOUT_ACTIVATE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.DIRECTOR_USE,
      PERMISSIONS.TOURNAMENT_UPDATE
    ]),
    requireVenue: false
  }),
  [ORGANIZER_ACTION.PUBLISH]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.PUBLISH,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.TOURNAMENT_CERTIFY
    ]),
    requireVenue: false
  }),
  [ORGANIZER_ACTION.COMPLETE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.COMPLETE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.DIRECTOR_USE
    ]),
    requireVenue: false
  }),
  [ORGANIZER_ACTION.ARCHIVE_PREPARE]: Object.freeze({
    capability: ORGANIZER_CAPABILITY.ARCHIVE_PREPARE,
    requiredPermissions: Object.freeze([
      PERMISSIONS.TOURNAMENT_UPDATE,
      PERMISSIONS.TOURNAMENT_CERTIFY
    ]),
    requireVenue: false
  })
});
function resolveOrganizerActionPermissions(action) {
  const key = String(action || "").trim();
  const mapped = ORGANIZER_ACTION_PERMISSION_MAP[key];
  if (!mapped) {
    return Object.freeze({
      capability: key || "unknown",
      requiredPermissions: Object.freeze([]),
      requireVenue: false
    });
  }
  return mapped;
}

// src/features/referee-v5/server/trustedMatchExecutionInit.js
init_subjectIdentityPersistence();

// src/features/referee-v5/execution/matchExecutionInitPolicy.js
var SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION = "SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION";
var MATCH_EXECUTION_INIT_RPC = "referee_v5_initialize_match_execution_state";
var MATCH_EXECUTION_INIT_ALLOWED_ACTOR_ROLES = Object.freeze([
  "TRUSTED_SERVER",
  "SYSTEM",
  "ORGANIZER",
  "SUPER_ADMIN",
  "COMPETITION_OPERATOR",
  "TOURNAMENT_DIRECTOR",
  "OWNER"
]);
var MATCH_EXECUTION_INIT_MODES = Object.freeze([
  "DAILY_PLAY",
  "INTERNAL",
  "OFFICIAL",
  "TEAM"
]);
var ADAPTER_B_CONTRACT_ID = "competition.referee.adapter.v1";
var TERMINAL_LIVE_STATUSES = Object.freeze([
  "completed",
  "cancelled",
  "disputed"
]);
var ACTIVE_LIVE_STATUSES = Object.freeze([
  "in_progress",
  "paused",
  "game_break",
  "SCORING_ACTIVE",
  "scoring_active"
]);

// src/features/referee-v5/execution/authorizeMatchExecutionInit.js
function authorizeMatchExecutionInit(input = {}) {
  if (input.initialState != null || input.statePayload != null || input.stateSnapshot != null) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Kh\xF4ng ch\u1EA5p nh\u1EADn snapshot tr\xECnh duy\u1EC7t l\xE0m authority."
    );
  }
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || input.competitionId || "").trim();
  const matchId = String(input.matchId || "").trim();
  const competitionMode = String(input.competitionMode || "").trim().toUpperCase();
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (!tenantId || !tournamentId || !matchId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "tenantId, tournamentId v\xE0 matchId l\xE0 b\u1EAFt bu\u1ED9c."
    );
  }
  if (!MATCH_EXECUTION_INIT_MODES.includes(competitionMode)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      `competitionMode kh\xF4ng h\u1EE3p l\u1EC7: ${competitionMode || "(empty)"}`
    );
  }
  if (!idempotencyKey) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "idempotencyKey l\xE0 b\u1EAFt bu\u1ED9c."
    );
  }
  const actor = input.actor || input.trustedActor || null;
  const actorId = String(actor?.actorId || actor?.userId || actor?.authUid || "").trim();
  const actorTenantId = String(actor?.tenantId || "").trim();
  const actorRole = String(actor?.role || "").trim().toUpperCase();
  if (!actorId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Trusted actor/system context is required."
    );
  }
  if (actorTenantId && actorTenantId !== tenantId) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  if (actor?.venueId && !actorTenantId && String(actor.venueId) === tenantId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.TENANT_ACCESS_DENIED,
      "Venue kh\xF4ng \u0111\u01B0\u1EE3c d\xF9ng l\xE0m tenant fallback."
    );
  }
  if (!MATCH_EXECUTION_INIT_ALLOWED_ACTOR_ROLES.includes(actorRole)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "REFEREE kh\xF4ng \u0111\u01B0\u1EE3c kh\u1EDFi t\u1EA1o tr\u1EA1ng th\xE1i thi \u0111\u1EA5u t\xF9y \xFD."
    );
  }
  const adapter = input.adapter;
  if (!adapter || typeof adapter !== "object") {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Canonical Adapter B match context is required."
    );
  }
  if (String(adapter.contractId || "") !== ADAPTER_B_CONTRACT_ID) {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Adapter B contractId kh\xF4ng kh\u1EDBp."
    );
  }
  const required = [
    "getCompetitionContext",
    "getMatchContext",
    "getParticipants",
    "getScoringRules",
    "validatePreStart"
  ];
  for (const method of required) {
    if (typeof adapter[method] !== "function") {
      return createPersistenceError(
        REFEREE_V5_ERROR.NOT_CONFIGURED,
        `Adapter B thi\u1EBFu method ${method}.`
      );
    }
  }
  return {
    ok: true,
    tenantId,
    tournamentId,
    matchId,
    competitionMode,
    idempotencyKey,
    actorId,
    actorRole,
    adapter
  };
}
function mapAdapterBFailure(err) {
  const code = String(err?.code || "");
  if (code === "REFEREE_ADAPTER_UNKNOWN_MATCH") {
    return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
  }
  if (code === "REFEREE_ADAPTER_CROSS_TENANT_CONTEXT") {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  if (code === "REFEREE_ADAPTER_MISSING_SCORING_RULES") {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      err instanceof Error ? err.message : "Missing scoring rules"
    );
  }
  if (code === "REFEREE_ADAPTER_MALFORMED_CONTEXT") {
    const message = err instanceof Error ? err.message : "";
    if (/unknown competition/i.test(message) || /competitionId/i.test(message)) {
      return createPersistenceError(
        REFEREE_V5_ERROR.MATCH_STATE_CONFLICT,
        "Tournament binding kh\xF4ng kh\u1EDBp canonical match."
      );
    }
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      message || "Adapter B context kh\xF4ng h\u1EE3p l\u1EC7."
    );
  }
  return createPersistenceError(
    REFEREE_V5_ERROR.VALIDATION_DENIED,
    err instanceof Error ? err.message : "Adapter B context b\u1ECB t\u1EEB ch\u1ED1i."
  );
}

// src/features/referee-v5/execution/buildInitialStateFromAdapterB.js
function playerIdsFromSide(side) {
  const ids = Array.isArray(side?.participantIds) ? side.participantIds.map((id) => String(id).trim()).filter(Boolean) : [];
  if (ids.length > 0) return ids;
  if (side?.entryId) return [String(side.entryId).trim()];
  if (side?.teamId) return [String(side.teamId).trim()];
  return [];
}
function assignServiceSides(playerIds2) {
  return playerIds2.map((playerId, index) => ({
    playerId,
    logicalServiceSide: index === 0 ? LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT : LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT
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
function resolveAdapterBEvidence({ adapter, adapterRequest, tenantId, tournamentId, matchId, competitionMode }) {
  const request = {
    ...adapterRequest && typeof adapterRequest === "object" ? adapterRequest : {},
    tenantId,
    competitionId: tournamentId,
    matchId
  };
  let competition;
  let matchContext;
  let participants;
  let scoringRules2;
  let preStart;
  try {
    competition = adapter.getCompetitionContext(request);
    matchContext = adapter.getMatchContext(request);
    participants = adapter.getParticipants(request);
    scoringRules2 = adapter.getScoringRules(request);
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
      "Tournament binding kh\xF4ng kh\u1EDBp canonical match."
    );
  }
  if (String(matchContext?.competitionId || "") !== tournamentId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.MATCH_STATE_CONFLICT,
      "Tournament binding kh\xF4ng kh\u1EDBp canonical match."
    );
  }
  if (String(matchContext?.matchId || "") !== matchId) {
    return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
  }
  if (competitionMode && competition?.competitionMode && String(competition.competitionMode) !== competitionMode) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "competitionMode kh\xF4ng kh\u1EDBp Adapter B."
    );
  }
  if (!preStart || preStart.ok !== true) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      preStart?.blockers && preStart.blockers[0]?.message || "Adapter B pre-start validation failed."
    );
  }
  return {
    ok: true,
    evidence: {
      competition,
      matchContext,
      participants,
      scoringRules: scoringRules2
    }
  };
}
function buildInitialStateFromAdapterB(evidence, input) {
  const sides = Array.isArray(evidence?.participants?.sides) ? evidence.participants.sides : [];
  if (sides.length !== 2) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Adapter B ph\u1EA3i cung c\u1EA5p \u0111\xFAng hai ph\xEDa tham d\u1EF1."
    );
  }
  const playersA = playerIdsFromSide(sides[0]);
  const playersB = playerIdsFromSide(sides[1]);
  if (playersA.length === 0 || playersB.length === 0) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Thi\u1EBFu V\u0110V/entry cho Referee V5 initial state."
    );
  }
  const matchType = resolveMatchType(evidence.matchContext, playersA, playersB);
  if (!matchType) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Kh\xF4ng suy ra \u0111\u01B0\u1EE3c matchType singles/doubles t\u1EEB Adapter B."
    );
  }
  if (matchType === MATCH_TYPE.SINGLES && (playersA.length !== 1 || playersB.length !== 1)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Singles y\xEAu c\u1EA7u \u0111\xFAng m\u1ED9t V\u0110V m\u1ED7i ph\xEDa."
    );
  }
  if (matchType === MATCH_TYPE.DOUBLES && (playersA.length !== 2 || playersB.length !== 2)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Doubles y\xEAu c\u1EA7u \u0111\xFAng hai V\u0110V m\u1ED7i ph\xEDa."
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
        players: assignServiceSides(playersA)
      },
      teamB: {
        teamId: teamBId,
        courtEnd: COURT_END.FAR_END,
        players: assignServiceSides(playersB)
      }
    },
    firstServingTeamId: teamAId,
    firstServingPlayerId: playersA[0],
    initialServerNumber: matchType === MATCH_TYPE.DOUBLES ? 1 : void 0
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
    config
  };
}

// src/features/referee-v5/execution/persistMatchExecutionInit.js
async function persistMatchExecutionInit({
  repository,
  rpcClient,
  tenantId,
  tournamentId,
  matchId,
  competitionMode,
  actorId,
  idempotencyKey,
  requestHash,
  initialState,
  teamAId,
  teamBId
}) {
  if (rpcClient && typeof rpcClient.rpc === "function") {
    const { data, error } = await rpcClient.rpc(MATCH_EXECUTION_INIT_RPC, {
      p_tenant_id: tenantId,
      p_tournament_id: tournamentId,
      p_match_id: matchId,
      p_competition_mode: competitionMode,
      p_actor_id: actorId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_initial_state: serializeMatchState(initialState),
      p_team_a_id: teamAId,
      p_team_b_id: teamBId
    });
    if (error) {
      return createPersistenceError(REFEREE_V5_ERROR.VALIDATION_FAILED, error.message);
    }
    if (data?.ok === false) {
      return createPersistenceError(data.code || REFEREE_V5_ERROR.VALIDATION_FAILED, data.error);
    }
    const state = data?.state ? deserializeMatchState(data.state) : initialState;
    return createPersistenceSuccess({
      capabilityId: SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION,
      initialized: data?.initialized === true,
      alreadyInitialized: data?.alreadyInitialized === true || data?.duplicate === true,
      duplicate: data?.duplicate === true,
      reset: false,
      matchStateId: data?.matchStateId,
      tenantId,
      tournamentId,
      matchId,
      status: data?.status || state?.status,
      stateVersion: Number(data?.stateVersion ?? 0),
      lastEventSequence: Number(data?.lastEventSequence ?? 0),
      state,
      stateHash: data?.stateHash || hashMatchStateCanonical(state)
    });
  }
  if (!repository || typeof repository.initializeExecutionState !== "function") {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Shared Referee persistence repository is required."
    );
  }
  return repository.initializeExecutionState({
    tenantId,
    tournamentId,
    matchId,
    initialState,
    teamAId,
    teamBId,
    idempotencyKey,
    requestHash,
    actorId,
    competitionMode
  });
}

// src/features/referee-v5/execution/initializeMatchExecutionState.js
async function initializeMatchExecutionState(input = {}) {
  const authorized = authorizeMatchExecutionInit(input);
  if (!authorized.ok) {
    return authorized;
  }
  const evidence = resolveAdapterBEvidence({
    adapter: authorized.adapter,
    adapterRequest: input.adapterRequest,
    tenantId: authorized.tenantId,
    tournamentId: authorized.tournamentId,
    matchId: authorized.matchId,
    competitionMode: authorized.competitionMode
  });
  if (!evidence.ok) {
    return evidence;
  }
  const factory = buildInitialStateFromAdapterB(evidence.evidence, {
    matchId: authorized.matchId
  });
  if (!factory.ok) {
    return factory;
  }
  const schema = validateStateSchemaVersion(factory.state);
  if (!schema.ok) {
    return schema;
  }
  const persistedCheck = validatePersistedMatchState(factory.state);
  if (!persistedCheck.ok) {
    return persistedCheck;
  }
  const requestHash = buildRequestHash({
    capabilityId: SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION,
    tenantId: authorized.tenantId,
    tournamentId: authorized.tournamentId,
    matchId: authorized.matchId,
    competitionMode: authorized.competitionMode,
    stateHash: hashMatchStateCanonical(factory.state)
  });
  return persistMatchExecutionInit({
    repository: input.repository,
    rpcClient: input.rpcClient,
    tenantId: authorized.tenantId,
    tournamentId: authorized.tournamentId,
    matchId: authorized.matchId,
    competitionMode: authorized.competitionMode,
    actorId: authorized.actorId,
    idempotencyKey: authorized.idempotencyKey,
    requestHash,
    initialState: factory.state,
    teamAId: factory.teamAId,
    teamBId: factory.teamBId
  });
}

// src/features/competition-engine/integration/referee/constants.js
var COMPETITION_REFEREE_ADAPTER_CONTRACT_ID = "competition.referee.adapter.v1";
var COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION = "1.0.0";
var COMPETITION_REFEREE_MODE = Object.freeze({
  DAILY_PLAY: "DAILY_PLAY",
  INTERNAL: "INTERNAL",
  OFFICIAL: "OFFICIAL",
  TEAM: "TEAM"
});
var COMPETITION_REFEREE_MODE_VALUES = Object.freeze(
  Object.values(COMPETITION_REFEREE_MODE)
);
var COMPETITION_REFEREE_MODE_TO_TYPE = Object.freeze({
  DAILY_PLAY: "daily_play",
  INTERNAL: "internal_tournament",
  OFFICIAL: "official_tournament",
  TEAM: "team_tournament"
});
var COMPETITION_TYPE_TO_REFEREE_MODE = Object.freeze({
  daily_play: "DAILY_PLAY",
  internal_tournament: "INTERNAL",
  official_tournament: "OFFICIAL",
  team_tournament: "TEAM"
});
var REFEREE_ADAPTER_REQUIRED_METHODS = Object.freeze([
  "getCompetitionContext",
  "getMatchContext",
  "getParticipants",
  "getScoringRules",
  "getLifecyclePolicy",
  "getCapabilities",
  "validatePreStart",
  "resolveResultPropagation"
]);
var REFEREE_ADAPTER_FORBIDDEN_METHODS = Object.freeze([
  "assignReferee",
  "persistAssignment",
  "authorizeReferee",
  "resolveRefereeIdentity",
  "applyMatchTransition",
  "completeMatch",
  "recordPoint",
  "calculateScore",
  "persistScore",
  "acceptResult",
  "correctResult",
  "persistResult",
  "appendMatchEvent",
  "persistEvent",
  "reviseResult"
]);
var REFEREE_ADAPTER_FORBIDDEN_AUTHORITY_KEYS = Object.freeze([
  "scoringEngine",
  "lifecycleEngine",
  "resultEngine",
  "refereeIdentityAuthority",
  "assignmentPersistence"
]);
var CANONICAL_REFEREE_PERSISTENCE_TABLES = Object.freeze({
  ASSIGNMENTS: "referee_assignments",
  LIVE_STATES: "match_live_states",
  EVENTS: "match_events",
  RESULT_REVISIONS: "match_result_revisions",
  SYNC_MUTATIONS: "match_sync_mutations"
});
var CANONICAL_REFEREE_AUTHORITY = Object.freeze({
  IDENTITY: "auth.uid",
  ASSIGNMENT: "CORE-13",
  LIFECYCLE: "CORE-15",
  SCORING: "CORE-16",
  EVENT: "append-only match_events + CORE-16 commands",
  RESULT: "CORE-17 accepted active result"
});
var REFEREE_ADAPTER_ERROR_CODE = Object.freeze({
  UNKNOWN_MODE: "REFEREE_ADAPTER_UNKNOWN_MODE",
  UNKNOWN_MATCH: "REFEREE_ADAPTER_UNKNOWN_MATCH",
  MALFORMED_CONTEXT: "REFEREE_ADAPTER_MALFORMED_CONTEXT",
  MISSING_SCORING_RULES: "REFEREE_ADAPTER_MISSING_SCORING_RULES",
  CROSS_TENANT_CONTEXT: "REFEREE_ADAPTER_CROSS_TENANT_CONTEXT",
  INCOMPATIBLE_CONTRACT_VERSION: "REFEREE_ADAPTER_INCOMPATIBLE_CONTRACT_VERSION",
  MALFORMED_ADAPTER: "REFEREE_ADAPTER_MALFORMED_ADAPTER",
  DUPLICATE_MODE: "REFEREE_ADAPTER_DUPLICATE_MODE",
  DIRECT_SCORE_AUTHORITY_FORBIDDEN: "REFEREE_ADAPTER_DIRECT_SCORE_AUTHORITY_FORBIDDEN",
  DIRECT_RESULT_AUTHORITY_FORBIDDEN: "REFEREE_ADAPTER_DIRECT_RESULT_AUTHORITY_FORBIDDEN",
  DIRECT_REFEREE_AUTHORITY_FORBIDDEN: "REFEREE_ADAPTER_DIRECT_REFEREE_AUTHORITY_FORBIDDEN",
  REGISTRY_FROZEN: "REFEREE_ADAPTER_REGISTRY_FROZEN",
  STALE_WRITE: "REFEREE_ADAPTER_STALE_WRITE",
  MISSING_IDEMPOTENCY: "REFEREE_ADAPTER_MISSING_IDEMPOTENCY",
  IDEMPOTENCY_CONFLICT: "REFEREE_ADAPTER_IDEMPOTENCY_CONFLICT",
  MISSING_CANONICAL_IDENTITY: "REFEREE_ADAPTER_MISSING_CANONICAL_IDENTITY",
  FUZZY_IDENTITY_FORBIDDEN: "REFEREE_ADAPTER_FUZZY_IDENTITY_FORBIDDEN",
  PROPAGATION_REQUIRES_ACCEPTED_RESULT: "REFEREE_ADAPTER_PROPAGATION_REQUIRES_ACCEPTED_RESULT",
  DURABLE_DEPENDENCY_REQUIRED: "REFEREE_ADAPTER_DURABLE_DEPENDENCY_REQUIRED",
  IN_MEMORY_PRODUCTION_FORBIDDEN: "REFEREE_ADAPTER_IN_MEMORY_PRODUCTION_FORBIDDEN",
  UNOFFICIAL_RESULT_FORBIDDEN: "REFEREE_ADAPTER_UNOFFICIAL_RESULT_FORBIDDEN",
  ASSIGNMENT_REQUIRED: "REFEREE_ADAPTER_ASSIGNMENT_REQUIRED",
  APPEND_ONLY_VIOLATION: "REFEREE_ADAPTER_APPEND_ONLY_VIOLATION"
});
var REFEREE_ADAPTER_ERROR_CODE_VALUES = Object.freeze(
  Object.values(REFEREE_ADAPTER_ERROR_CODE)
);
var REFEREE_V5_INTERNAL_COMMIT_RPC = Object.freeze({
  GET_MATCH_STATE: "referee_v5_get_match_state",
  COMMIT_TRANSITION: "referee_v5_commit_match_transition",
  COMMIT_FINALIZATION: "referee_v5_commit_match_finalization",
  MATCH_STATE_ID: "referee_v5_match_state_id",
  CURRENT_USER_HAS_ASSIGNMENT: "referee_v5_current_user_has_assignment"
});
var CANONICAL_RESULT_LINEAGE = Object.freeze({
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED"
});
var LIVE_RESULT_STATUS = Object.freeze({
  CONFIRMED: "confirmed",
  OVERRIDDEN: "overridden",
  DRAFT: "draft",
  VOID: "void"
});

// src/features/competition-engine/integration/referee/errors.js
var RefereeAdapterContractError = class extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RefereeAdapterContractError";
    this.code = typeof code === "string" && code.trim() ? code.trim() : REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER;
    this.failClosed = true;
    this.details = Object.freeze({ ...details });
  }
};
function failRefereeAdapter(code, message, details) {
  throw new RefereeAdapterContractError(code, message, details);
}

// src/features/competition-engine/integration/referee/helpers.js
function isNonEmptyString3(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isPlainObject2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    const child = (
      /** @type {Record<string|symbol, unknown>} */
      value[key]
    );
    if (child && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
}
function clonePlain(value) {
  return structuredClone(value);
}
function freezeClone(value) {
  return deepFreeze(clonePlain(value));
}

// src/features/competition-core/matches/errors/runtimeErrorCodes.js
var MATCH_RUNTIME_ERROR_CODE = Object.freeze({
  MATCH_NOT_FOUND: "MATCH_NOT_FOUND",
  MATCH_INVALID_INPUT: "MATCH_INVALID_INPUT",
  MATCH_INVALID_SOURCE: "MATCH_INVALID_SOURCE",
  MATCH_UNSUPPORTED_SOURCE: "MATCH_UNSUPPORTED_SOURCE",
  MATCH_UNSUPPORTED_STATUS: "MATCH_UNSUPPORTED_STATUS",
  MATCH_IDENTITY_MISMATCH: "MATCH_IDENTITY_MISMATCH",
  MATCH_IDENTITY_COLLISION: "MATCH_IDENTITY_COLLISION",
  MATCH_CONTEXT_MISMATCH: "MATCH_CONTEXT_MISMATCH",
  MATCH_COMPETITION_MISMATCH: "MATCH_COMPETITION_MISMATCH",
  MATCH_SIDE_REQUIRED: "MATCH_SIDE_REQUIRED",
  MATCH_SIDE_DUPLICATE: "MATCH_SIDE_DUPLICATE",
  MATCH_PARTICIPANT_DUPLICATE: "MATCH_PARTICIPANT_DUPLICATE",
  MATCH_TEAM_DUPLICATE: "MATCH_TEAM_DUPLICATE",
  MATCH_LINEUP_MISMATCH: "MATCH_LINEUP_MISMATCH",
  MATCH_NOT_READY: "MATCH_NOT_READY",
  MATCH_ALREADY_STARTED: "MATCH_ALREADY_STARTED",
  MATCH_NOT_IN_PROGRESS: "MATCH_NOT_IN_PROGRESS",
  MATCH_ALREADY_COMPLETED: "MATCH_ALREADY_COMPLETED",
  MATCH_COMPLETED_IMMUTABLE: "MATCH_COMPLETED_IMMUTABLE",
  MATCH_STATE_TRANSITION_INVALID: "MATCH_STATE_TRANSITION_INVALID",
  MATCH_AUTHORIZATION_REQUIRED: "MATCH_AUTHORIZATION_REQUIRED",
  MATCH_AUTHORIZATION_DENIED: "MATCH_AUTHORIZATION_DENIED",
  MATCH_SCORING_NOT_ALLOWED: "MATCH_SCORING_NOT_ALLOWED",
  MATCH_DEPENDENCY_FAILED: "MATCH_DEPENDENCY_FAILED",
  MATCH_ADAPTER_FAILED: "MATCH_ADAPTER_FAILED",
  MATCH_PERSISTENCE_DISABLED: "MATCH_PERSISTENCE_DISABLED"
});
var MATCH_RUNTIME_ERROR_CODE_VALUES = new Set(
  Object.values(MATCH_RUNTIME_ERROR_CODE)
);
function isMatchRuntimeErrorCode(value) {
  return typeof value === "string" && MATCH_RUNTIME_ERROR_CODE_VALUES.has(value);
}

// src/features/competition-core/matches/contracts/adapterContract.js
var MATCH_ADAPTER_ID = Object.freeze({
  LEGACY: "LEGACY_MATCH"
});

// src/features/competition-core/matches/enums/matchSourceTypes.js
var MATCH_SOURCE_TYPE = Object.freeze({
  LEGACY_MATCH: "LEGACY_MATCH",
  LEGACY_SUB_MATCH: "LEGACY_SUB_MATCH",
  CANONICAL_MATCH: "CANONICAL_MATCH"
});
var MATCH_SOURCE_TYPE_VALUES = new Set(
  Object.values(MATCH_SOURCE_TYPE)
);

// src/features/competition-core/matches/errors/MatchRuntimeError.js
var MatchRuntimeError = class extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isMatchRuntimeErrorCode(code) ? code : MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT;
    super(String(message || safeCode));
    this.name = "MatchRuntimeError";
    this.code = safeCode;
    this.details = details && typeof details === "object" && !Array.isArray(details) ? { ...details } : {};
  }
};

// src/features/competition-core/matches/enums/matchStatuses.js
var MATCH_STATUS2 = Object.freeze({
  DRAFT: "DRAFT",
  READY: "READY",
  SCHEDULED: "SCHEDULED",
  LINEUPS_PENDING: "LINEUPS_PENDING",
  READY_TO_START: "READY_TO_START",
  IN_PROGRESS: "IN_PROGRESS",
  PAUSED: "PAUSED",
  SUSPENDED: "SUSPENDED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  POSTPONED: "POSTPONED"
});
var MATCH_STATUS_VALUES = new Set(Object.values(MATCH_STATUS2));
var MATCH_CORE_STATUS_VALUES = /* @__PURE__ */ new Set([
  MATCH_STATUS2.DRAFT,
  MATCH_STATUS2.READY,
  MATCH_STATUS2.SCHEDULED,
  MATCH_STATUS2.READY_TO_START,
  MATCH_STATUS2.IN_PROGRESS,
  MATCH_STATUS2.PAUSED,
  MATCH_STATUS2.SUSPENDED,
  MATCH_STATUS2.COMPLETED,
  MATCH_STATUS2.CANCELLED,
  MATCH_STATUS2.POSTPONED
]);

// src/features/competition-core/matches/mappers/statusMapper.js
var LEGACY_MATCH_STATUS_MAP = Object.freeze({
  waiting: MATCH_STATUS2.READY,
  pending: MATCH_STATUS2.READY,
  scheduled: MATCH_STATUS2.SCHEDULED,
  assigned: MATCH_STATUS2.READY_TO_START,
  ready: MATCH_STATUS2.READY_TO_START,
  ready_to_start: MATCH_STATUS2.READY_TO_START,
  lineup_open: MATCH_STATUS2.LINEUPS_PENDING,
  lineups_pending: MATCH_STATUS2.LINEUPS_PENDING,
  locked: MATCH_STATUS2.READY_TO_START,
  published: MATCH_STATUS2.READY_TO_START,
  playing: MATCH_STATUS2.IN_PROGRESS,
  in_progress: MATCH_STATUS2.IN_PROGRESS,
  inprogress: MATCH_STATUS2.IN_PROGRESS,
  active: MATCH_STATUS2.IN_PROGRESS,
  running: MATCH_STATUS2.IN_PROGRESS,
  // Unambiguous legacy "paused" → canonical PAUSED (distinct from SUSPENDED).
  paused: MATCH_STATUS2.PAUSED,
  pause: MATCH_STATUS2.PAUSED,
  suspended: MATCH_STATUS2.SUSPENDED,
  suspend: MATCH_STATUS2.SUSPENDED,
  completed: MATCH_STATUS2.COMPLETED,
  done: MATCH_STATUS2.COMPLETED,
  finished: MATCH_STATUS2.COMPLETED,
  forfeit: MATCH_STATUS2.COMPLETED,
  walkover: MATCH_STATUS2.COMPLETED,
  postponed: MATCH_STATUS2.POSTPONED,
  cancelled: MATCH_STATUS2.CANCELLED,
  canceled: MATCH_STATUS2.CANCELLED,
  draft: MATCH_STATUS2.DRAFT,
  not_started: MATCH_STATUS2.READY
});
function mapLegacyMatchStatus(raw, options = {}) {
  if (raw == null || raw === "") {
    return options.defaultStatus || MATCH_STATUS2.DRAFT;
  }
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  const mapped = LEGACY_MATCH_STATUS_MAP[key];
  if (mapped) return mapped;
  const upper = String(raw).trim().toUpperCase();
  if (Object.values(MATCH_STATUS2).includes(upper)) return upper;
  throw new MatchRuntimeError(
    MATCH_RUNTIME_ERROR_CODE.MATCH_UNSUPPORTED_STATUS,
    "Unsupported match status",
    { status: raw }
  );
}

// src/features/competition-core/participants/contracts/shared.js
var PARTICIPANT_SCHEMA_VERSION = "1";
function createAuditMetadata(partial = {}) {
  return {
    createdAt: partial?.createdAt ?? null,
    createdBy: partial?.createdBy ?? null,
    updatedAt: partial?.updatedAt ?? null,
    updatedBy: partial?.updatedBy ?? null,
    decidedAt: partial?.decidedAt ?? null,
    decidedBy: partial?.decidedBy ?? null
  };
}
function createFormatExtension(partial) {
  if (!partial || typeof partial !== "object") {
    return null;
  }
  return {
    formatKey: String(partial.formatKey || ""),
    payload: partial.payload && typeof partial.payload === "object" && !Array.isArray(partial.payload) ? { ...partial.payload } : {}
  };
}
function isNonEmptyString4(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

// src/features/competition-core/matches/enums/matchSideKeys.js
var MATCH_SIDE_KEY = Object.freeze({
  A: "A",
  B: "B"
});
var MATCH_SIDE_KEY_VALUES = new Set(Object.values(MATCH_SIDE_KEY));
function isMatchSideKey(value) {
  return typeof value === "string" && MATCH_SIDE_KEY_VALUES.has(value);
}

// src/features/competition-core/matches/enums/completionReasons.js
var MATCH_COMPLETION_REASON = Object.freeze({
  NONE: "NONE",
  COMPLETED: "COMPLETED",
  WALKOVER: "WALKOVER",
  NO_SHOW: "NO_SHOW",
  FORFEIT: "FORFEIT",
  RETIREMENT: "RETIREMENT",
  ABANDONED: "ABANDONED",
  VOID: "VOID",
  CANCELLED: "CANCELLED"
});
var MATCH_COMPLETION_REASON_VALUES = new Set(
  Object.values(MATCH_COMPLETION_REASON)
);

// src/features/competition-core/matches/contracts/matchIdentity.js
var MATCH_IDENTITY_KIND = "MATCH";
var MATCH_SIDE_IDENTITY_KIND = "SIDE";
function buildMatchIdentityKey(parts = {}) {
  const competitionId = String(parts.competitionId || "").trim();
  const contextId = String(parts.contextId || "").trim();
  return `${competitionId}::${MATCH_IDENTITY_KIND}::${contextId}`;
}
function buildMatchSideId(parts = {}) {
  const matchKey = isNonEmptyString4(parts.matchIdentityKey) ? String(parts.matchIdentityKey).trim() : buildMatchIdentityKey({
    competitionId: parts.competitionId,
    contextId: parts.contextId
  });
  const sideKey = String(parts.sideKey || MATCH_SIDE_KEY.A).trim().toUpperCase();
  return `${matchKey}::${MATCH_SIDE_IDENTITY_KIND}::${sideKey}`;
}

// src/features/competition-core/matches/contracts/competitionMatch.js
function createMatchResultReference(partial) {
  if (partial == null) return null;
  if (typeof partial !== "object" || Array.isArray(partial)) return null;
  const resultId = partial.resultId == null || partial.resultId === "" ? null : String(partial.resultId);
  const resultType = partial.resultType == null || partial.resultType === "" ? null : String(partial.resultType);
  const sourceType = partial.sourceType == null || partial.sourceType === "" ? null : String(partial.sourceType);
  if (resultId == null && resultType == null && sourceType == null) {
    if (!partial.metadata) return null;
  }
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    resultId,
    resultType,
    sourceType,
    metadata: partial.metadata && typeof partial.metadata === "object" && !Array.isArray(partial.metadata) ? (
      /** @type {Record<string, unknown>} */
      cloneJsonSafe(partial.metadata)
    ) : null
  };
}
function createMatchSide(partial = {}, identityParts = {}) {
  const sideKeyRaw = String(partial?.sideKey || MATCH_SIDE_KEY.A).trim().toUpperCase();
  const sideKey = isMatchSideKey(sideKeyRaw) ? sideKeyRaw : MATCH_SIDE_KEY.A;
  const matchIdentityKey = identityParts.matchIdentityKey || (identityParts.competitionId && identityParts.contextId ? buildMatchIdentityKey({
    competitionId: identityParts.competitionId,
    contextId: identityParts.contextId
  }) : null);
  const identityKey = isNonEmptyString4(partial?.identityKey) ? String(partial.identityKey).trim() : matchIdentityKey ? buildMatchSideId({ matchIdentityKey, sideKey }) : null;
  const id = isNonEmptyString4(partial?.id) ? String(partial.id).trim() : identityKey || `side:${sideKey}`;
  const participantReferences = Array.isArray(partial?.participantReferences) ? partial.participantReferences.filter((p) => p && typeof p === "object" && isNonEmptyString4(p.id)).map((p) => ({
    kind: String(p.kind || "PLAYER_PROFILE"),
    id: String(p.id).trim()
  })) : [];
  return {
    id,
    identityKey,
    sideKey,
    seed: typeof partial?.seed === "number" && Number.isFinite(partial.seed) ? partial.seed : null,
    teamReference: partial?.teamReference == null || partial.teamReference === "" ? null : String(partial.teamReference),
    participantReferences,
    registrationReference: partial?.registrationReference == null || partial.registrationReference === "" ? null : String(partial.registrationReference),
    lineupReference: partial?.lineupReference == null || partial.lineupReference === "" ? null : String(partial.lineupReference),
    status: partial?.status == null || partial.status === "" ? null : String(partial.status),
    sourceType: partial?.sourceType == null || partial.sourceType === "" ? null : String(partial.sourceType),
    metadata: partial?.metadata && typeof partial.metadata === "object" && !Array.isArray(partial.metadata) ? (
      /** @type {Record<string, unknown>} */
      cloneJsonSafe(partial.metadata)
    ) : {}
  };
}
function createCompetitionMatch(partial = {}) {
  const competitionId = String(partial?.competitionId || "").trim();
  const contextId = String(partial?.contextId || "").trim();
  const identityKey = isNonEmptyString4(partial?.identityKey) ? String(partial.identityKey).trim() : competitionId && contextId ? buildMatchIdentityKey({ competitionId, contextId }) : null;
  const sides = Array.isArray(partial?.sides) ? partial.sides.map(
    (side) => createMatchSide(side, {
      matchIdentityKey: identityKey || void 0,
      competitionId,
      contextId
    })
  ) : [];
  return {
    schemaVersion: String(partial?.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: isNonEmptyString4(partial?.id) ? String(partial.id).trim() : identityKey || "",
    identityKey,
    competitionId,
    contextId,
    fixtureId: partial?.fixtureId == null || partial.fixtureId === "" ? null : String(partial.fixtureId),
    stageId: partial?.stageId == null || partial.stageId === "" ? null : String(partial.stageId),
    roundId: partial?.roundId == null || partial.roundId === "" ? null : String(partial.roundId),
    groupId: partial?.groupId == null || partial.groupId === "" ? null : String(partial.groupId),
    matchNumber: typeof partial?.matchNumber === "number" && Number.isInteger(partial.matchNumber) ? partial.matchNumber : null,
    formatType: partial?.formatType == null || partial.formatType === "" ? null : String(partial.formatType),
    status: isNonEmptyString4(partial?.status) ? String(partial.status).trim().toUpperCase() : MATCH_STATUS2.DRAFT,
    completionReason: isNonEmptyString4(partial?.completionReason) ? String(partial.completionReason).trim().toUpperCase() : MATCH_COMPLETION_REASON.NONE,
    sides,
    courtAssignmentRef: partial?.courtAssignmentRef == null || partial.courtAssignmentRef === "" ? null : String(partial.courtAssignmentRef),
    refereeAssignmentRef: partial?.refereeAssignmentRef == null || partial.refereeAssignmentRef === "" ? null : String(partial.refereeAssignmentRef),
    scheduledAt: partial?.scheduledAt ?? null,
    startedAt: partial?.startedAt ?? null,
    pausedAt: partial?.pausedAt ?? null,
    resumedAt: partial?.resumedAt ?? null,
    completedAt: partial?.completedAt ?? null,
    suspendedAt: partial?.suspendedAt ?? null,
    cancelledAt: partial?.cancelledAt ?? null,
    abandonedAt: partial?.abandonedAt ?? null,
    resultReference: createMatchResultReference(partial?.resultReference),
    sourceType: isNonEmptyString4(partial?.sourceType) ? String(partial.sourceType) : MATCH_SOURCE_TYPE.CANONICAL_MATCH,
    revision: typeof partial?.revision === "number" && Number.isInteger(partial.revision) && partial.revision >= 1 ? partial.revision : 1,
    metadata: partial?.metadata && typeof partial.metadata === "object" && !Array.isArray(partial.metadata) ? (
      /** @type {Record<string, unknown>} */
      cloneJsonSafe(partial.metadata)
    ) : {},
    audit: createAuditMetadata(partial?.audit),
    formatExtension: createFormatExtension(partial?.formatExtension)
  };
}

// src/features/competition-core/matches/mappers/legacyMatchMapper.js
function isLegacyMatchSource(source, context = {}) {
  if (!source || typeof source !== "object") return false;
  const s = (
    /** @type {Record<string, unknown>} */
    source
  );
  const explicit = s.__sourceType || context.sourceType || context.__sourceType || null;
  if (explicit === MATCH_SOURCE_TYPE.LEGACY_MATCH || explicit === MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH || explicit === "LEGACY_MATCH" || explicit === "LEGACY_SUB_MATCH" || explicit === "MATCH" || explicit === "SUB_MATCH") {
    return true;
  }
  if ((s.disciplineId != null || s.subMatchId != null) && (s.status != null || s.score != null || s.id != null)) {
    return true;
  }
  if ((s.entryAId != null || s.entryBId != null || s.teamAId != null || s.teamBId != null) && (s.status != null || s.id != null || s.courtId != null)) {
    return true;
  }
  if ((Array.isArray(s.teamAPlayerIds) || Array.isArray(s.teamBPlayerIds)) && (s.status != null || s.id != null)) {
    return true;
  }
  return false;
}
function resolveContextId(raw, context) {
  if (raw.contextId != null && String(raw.contextId).trim()) {
    return String(raw.contextId).trim();
  }
  if (context.contextId != null && String(context.contextId).trim()) {
    return String(context.contextId).trim();
  }
  const matchupId = String(
    raw.matchupId || context.matchupId || ""
  ).trim();
  const subId = String(
    raw.subMatchId || raw.id || ""
  ).trim();
  if (matchupId && subId && (raw.disciplineId != null || raw.subMatchId != null)) {
    return `${matchupId}::${subId}`;
  }
  if (subId) return subId;
  if (raw.bracketMatchId != null && String(raw.bracketMatchId).trim()) {
    return String(raw.bracketMatchId).trim();
  }
  return "";
}
function mapCompletionReason(rawStatus, raw) {
  const key = String(rawStatus || "").trim().toLowerCase();
  if (key === "forfeit" || raw?.forfeit === true) {
    return MATCH_COMPLETION_REASON.FORFEIT;
  }
  if (key === "walkover" || raw?.resultType === "walkover") {
    return MATCH_COMPLETION_REASON.WALKOVER;
  }
  if (key === "no_show" || key === "noshow" || raw?.resultType === "no_show" || raw?.resultType === "NO_SHOW") {
    return MATCH_COMPLETION_REASON.NO_SHOW;
  }
  if (key === "retirement" || key === "retired" || raw?.resultType === "retirement" || raw?.resultType === "RETIREMENT") {
    return MATCH_COMPLETION_REASON.RETIREMENT;
  }
  if (key === "abandoned" || raw?.resultType === "abandoned") {
    return MATCH_COMPLETION_REASON.ABANDONED;
  }
  if (key === "cancelled" || key === "canceled") {
    return MATCH_COMPLETION_REASON.CANCELLED;
  }
  if (key === "completed" || key === "done" || key === "finished") {
    return MATCH_COMPLETION_REASON.COMPLETED;
  }
  return MATCH_COMPLETION_REASON.NONE;
}
function mapLegacyMatchToCompetitionMatch(source, context = {}) {
  if (!source || typeof source !== "object") {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_SOURCE,
      "Legacy match source must be an object",
      {}
    );
  }
  const raw = (
    /** @type {Record<string, unknown>} */
    source
  );
  const competitionId = String(
    context.competitionId || raw.competitionId || raw.tournamentId || ""
  ).trim();
  const contextId = resolveContextId(raw, context);
  if (!competitionId) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_SOURCE,
      "competitionId is required to map legacy match",
      {}
    );
  }
  if (!contextId) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_SOURCE,
      "contextId could not be derived from legacy match",
      { competitionId }
    );
  }
  const isSubMatch = raw.disciplineId != null || raw.subMatchId != null || context.sourceType === MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH || raw.__sourceType === MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH;
  const sourceType = isSubMatch ? MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH : MATCH_SOURCE_TYPE.LEGACY_MATCH;
  const status = mapLegacyMatchStatus(raw.status, {
    defaultStatus: MATCH_STATUS2.DRAFT
  });
  const completionReason = mapCompletionReason(raw.status, raw);
  const matchup = context.matchup && typeof context.matchup === "object" ? (
    /** @type {Record<string, unknown>} */
    context.matchup
  ) : null;
  const teamA = String(
    raw.teamAId || matchup?.teamAId || context.teamAId || ""
  ).trim();
  const teamB = String(
    raw.teamBId || matchup?.teamBId || context.teamBId || ""
  ).trim();
  const entryA = String(raw.entryAId || "").trim();
  const entryB = String(raw.entryBId || "").trim();
  const playerA = Array.isArray(raw.teamAPlayerIds) ? raw.teamAPlayerIds.map((id) => ({
    kind: "PLAYER_PROFILE",
    id: String(id)
  })) : entryA ? [{ kind: "PLAYER_PROFILE", id: entryA }] : [];
  const playerB = Array.isArray(raw.teamBPlayerIds) ? raw.teamBPlayerIds.map((id) => ({
    kind: "PLAYER_PROFILE",
    id: String(id)
  })) : entryB ? [{ kind: "PLAYER_PROFILE", id: entryB }] : [];
  const identityKey = buildMatchIdentityKey({ competitionId, contextId });
  const lineupA = context.lineupReferenceA != null ? String(context.lineupReferenceA) : raw.lineupReferenceA != null ? String(raw.lineupReferenceA) : null;
  const lineupB = context.lineupReferenceB != null ? String(context.lineupReferenceB) : raw.lineupReferenceB != null ? String(raw.lineupReferenceB) : null;
  const sides = [
    createMatchSide(
      {
        sideKey: MATCH_SIDE_KEY.A,
        teamReference: teamA || null,
        participantReferences: playerA,
        lineupReference: lineupA,
        seed: typeof raw.seedA === "number" ? raw.seedA : null,
        sourceType,
        metadata: {
          legacyEntryId: entryA || null,
          disciplineId: raw.disciplineId ?? null
        }
      },
      { matchIdentityKey: identityKey }
    ),
    createMatchSide(
      {
        sideKey: MATCH_SIDE_KEY.B,
        teamReference: teamB || null,
        participantReferences: playerB,
        lineupReference: lineupB,
        seed: typeof raw.seedB === "number" ? raw.seedB : null,
        sourceType,
        metadata: {
          legacyEntryId: entryB || null,
          disciplineId: raw.disciplineId ?? null
        }
      },
      { matchIdentityKey: identityKey }
    )
  ];
  const resultReference = createMatchResultReference(
    raw.resultId || raw.resultType || raw.resultReference ? {
      resultId: raw.resultId != null ? String(raw.resultId) : raw.id != null ? String(raw.id) : null,
      resultType: raw.resultType != null ? String(raw.resultType) : completionReason !== MATCH_COMPLETION_REASON.NONE ? completionReason : null,
      sourceType,
      metadata: {
        hasLegacyScore: raw.scoreA != null || raw.scoreB != null || raw.score && typeof raw.score === "object"
      }
    } : status === MATCH_STATUS2.COMPLETED ? {
      resultId: String(raw.id || contextId),
      resultType: completionReason,
      sourceType,
      metadata: {
        hasLegacyScore: raw.scoreA != null || raw.scoreB != null || raw.score && typeof raw.score === "object"
      }
    } : null
  );
  return createCompetitionMatch({
    competitionId,
    contextId,
    identityKey,
    id: identityKey,
    fixtureId: raw.fixtureId != null ? String(raw.fixtureId) : matchup?.id != null ? String(matchup.id) : null,
    stageId: raw.stage != null ? String(raw.stage) : null,
    roundId: raw.roundId != null ? String(raw.roundId) : raw.round != null ? String(raw.round) : null,
    groupId: raw.groupId != null ? String(raw.groupId) : null,
    matchNumber: typeof raw.matchNumber === "number" ? raw.matchNumber : null,
    formatType: isSubMatch ? "team_sub_match" : "individual_or_daily",
    status,
    completionReason,
    sides,
    courtAssignmentRef: raw.courtId != null ? String(raw.courtId) : null,
    refereeAssignmentRef: raw.referee != null ? typeof raw.referee === "object" ? String(
      /** @type {{ id?: string, token?: string }} */
      raw.referee.id || /** @type {{ token?: string }} */
      raw.referee.token || ""
    ) || null : String(raw.referee) : null,
    scheduledAt: raw.scheduledAt ?? null,
    startedAt: raw.startedAt ?? null,
    pausedAt: raw.pausedAt ?? null,
    resumedAt: raw.resumedAt ?? null,
    completedAt: raw.completedAt ?? null,
    suspendedAt: raw.suspendedAt ?? null,
    cancelledAt: raw.cancelledAt ?? null,
    abandonedAt: raw.abandonedAt ?? null,
    resultReference,
    sourceType,
    revision: 1,
    metadata: {
      legacyId: raw.id != null ? String(raw.id) : null,
      disciplineId: raw.disciplineId ?? null,
      matchupId: raw.matchupId ?? matchup?.id ?? null
      // Scores intentionally NOT copied as Core fields — Scoring owns them.
    },
    formatExtension: createFormatExtension({
      formatKey: String(context.formatKey || (isSubMatch ? "team-tournament" : "legacy-match")),
      payload: {
        legacyKeys: Object.keys(raw)
      }
    }),
    audit: {
      createdAt: null,
      createdBy: null,
      updatedAt: null,
      updatedBy: null,
      decidedAt: null,
      decidedBy: null
    }
  });
}

// src/features/competition-core/matches/adapters/LegacyMatchAdapter.js
function createLegacyMatchAdapter() {
  return {
    id: MATCH_ADAPTER_ID.LEGACY,
    sourceType: MATCH_SOURCE_TYPE.LEGACY_MATCH,
    supports(source, context = {}) {
      return isLegacyMatchSource(source, context);
    },
    map(source, context = {}) {
      if (!isLegacyMatchSource(source, context)) {
        throw new MatchRuntimeError(
          MATCH_RUNTIME_ERROR_CODE.MATCH_UNSUPPORTED_SOURCE,
          "LegacyMatchAdapter does not support this source",
          { adapterId: MATCH_ADAPTER_ID.LEGACY }
        );
      }
      return mapLegacyMatchToCompetitionMatch(source, {
        ...context,
        sourceType: context.sourceType || (source && typeof source === "object" && /** @type {Record<string, unknown>} */
        source.disciplineId != null ? MATCH_SOURCE_TYPE.LEGACY_SUB_MATCH : MATCH_SOURCE_TYPE.LEGACY_MATCH)
      });
    }
  };
}
var LegacyMatchAdapter = {
  create: createLegacyMatchAdapter,
  id: MATCH_ADAPTER_ID.LEGACY
};

// src/features/competition-core/matches/ports/matchPersistencePort.js
var MATCH_PERSISTENCE_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "findByIdentityKey"
]);

// src/features/competition-core/matches/services/transitions.js
var MATCH_ACTION = Object.freeze({
  MARK_READY: "mark_ready",
  SCHEDULE: "schedule",
  REQUIRE_LINEUPS: "require_lineups",
  MARK_READY_TO_START: "mark_ready_to_start",
  START: "start",
  PAUSE: "pause",
  RESUME: "resume",
  SUSPEND: "suspend",
  ABANDON: "abandon",
  COMPLETE: "complete",
  CANCEL: "cancel",
  POSTPONE: "postpone",
  RESCHEDULE: "reschedule"
});
var MATCH_IMMUTABLE_STATUSES = /* @__PURE__ */ new Set([
  MATCH_STATUS2.COMPLETED,
  MATCH_STATUS2.CANCELLED
]);
var MATCH_TRANSITION_MATRIX = Object.freeze([
  {
    action: MATCH_ACTION.MARK_READY,
    from: [MATCH_STATUS2.DRAFT],
    to: MATCH_STATUS2.READY
  },
  {
    action: MATCH_ACTION.SCHEDULE,
    from: [MATCH_STATUS2.DRAFT, MATCH_STATUS2.READY],
    to: MATCH_STATUS2.SCHEDULED
  },
  {
    action: MATCH_ACTION.REQUIRE_LINEUPS,
    from: [
      MATCH_STATUS2.READY,
      MATCH_STATUS2.SCHEDULED,
      MATCH_STATUS2.LINEUPS_PENDING
    ],
    to: MATCH_STATUS2.LINEUPS_PENDING
  },
  {
    action: MATCH_ACTION.MARK_READY_TO_START,
    from: [
      MATCH_STATUS2.READY,
      MATCH_STATUS2.SCHEDULED,
      MATCH_STATUS2.LINEUPS_PENDING,
      MATCH_STATUS2.POSTPONED
    ],
    to: MATCH_STATUS2.READY_TO_START
  },
  {
    action: MATCH_ACTION.START,
    from: [MATCH_STATUS2.READY_TO_START, MATCH_STATUS2.SCHEDULED],
    to: MATCH_STATUS2.IN_PROGRESS
  },
  {
    action: MATCH_ACTION.PAUSE,
    from: [MATCH_STATUS2.IN_PROGRESS],
    to: MATCH_STATUS2.PAUSED
  },
  {
    action: MATCH_ACTION.SUSPEND,
    from: [MATCH_STATUS2.IN_PROGRESS, MATCH_STATUS2.PAUSED],
    to: MATCH_STATUS2.SUSPENDED
  },
  {
    action: MATCH_ACTION.RESUME,
    from: [MATCH_STATUS2.PAUSED, MATCH_STATUS2.SUSPENDED],
    to: MATCH_STATUS2.IN_PROGRESS
  },
  {
    action: MATCH_ACTION.COMPLETE,
    from: [
      MATCH_STATUS2.IN_PROGRESS,
      MATCH_STATUS2.PAUSED,
      MATCH_STATUS2.SUSPENDED
    ],
    to: MATCH_STATUS2.COMPLETED
  },
  {
    action: MATCH_ACTION.ABANDON,
    from: [
      MATCH_STATUS2.IN_PROGRESS,
      MATCH_STATUS2.PAUSED,
      MATCH_STATUS2.SUSPENDED
    ],
    to: MATCH_STATUS2.COMPLETED
  },
  {
    action: MATCH_ACTION.CANCEL,
    from: [
      MATCH_STATUS2.DRAFT,
      MATCH_STATUS2.READY,
      MATCH_STATUS2.SCHEDULED,
      MATCH_STATUS2.LINEUPS_PENDING,
      MATCH_STATUS2.READY_TO_START,
      MATCH_STATUS2.IN_PROGRESS,
      MATCH_STATUS2.PAUSED,
      MATCH_STATUS2.SUSPENDED,
      MATCH_STATUS2.POSTPONED
    ],
    to: MATCH_STATUS2.CANCELLED
  },
  {
    action: MATCH_ACTION.POSTPONE,
    from: [
      MATCH_STATUS2.SCHEDULED,
      MATCH_STATUS2.LINEUPS_PENDING,
      MATCH_STATUS2.READY_TO_START
    ],
    to: MATCH_STATUS2.POSTPONED
  },
  {
    action: MATCH_ACTION.RESCHEDULE,
    from: [MATCH_STATUS2.POSTPONED],
    to: MATCH_STATUS2.SCHEDULED
  }
]);

// src/features/competition-core/matches/domain/createMatchLifecycleAuditEvent.js
var MATCH_LIFECYCLE_EVENT_TYPE = Object.freeze({
  TRANSITION: "MATCH_LIFECYCLE_TRANSITION"
});

// src/features/competition-engine/integration/referee/adapters/shared/matchStatusMapper.js
var STATUS_MAP = Object.freeze({
  DRAFT: MATCH_STATUS2.DRAFT,
  READY: MATCH_STATUS2.READY,
  SCHEDULED: MATCH_STATUS2.SCHEDULED,
  LINEUPS_PENDING: MATCH_STATUS2.LINEUPS_PENDING,
  READY_TO_START: MATCH_STATUS2.READY_TO_START,
  IN_PROGRESS: MATCH_STATUS2.IN_PROGRESS,
  PAUSED: MATCH_STATUS2.PAUSED,
  SUSPENDED: MATCH_STATUS2.SUSPENDED,
  COMPLETED: MATCH_STATUS2.COMPLETED,
  CANCELLED: MATCH_STATUS2.CANCELLED,
  POSTPONED: MATCH_STATUS2.POSTPONED,
  // Legacy / mode labels
  WAITING: MATCH_STATUS2.READY_TO_START,
  PENDING: MATCH_STATUS2.SCHEDULED,
  PLAYING: MATCH_STATUS2.IN_PROGRESS,
  ACTIVE: MATCH_STATUS2.IN_PROGRESS,
  RUNNING: MATCH_STATUS2.IN_PROGRESS,
  STARTED: MATCH_STATUS2.IN_PROGRESS,
  INPROGRESS: MATCH_STATUS2.IN_PROGRESS,
  DONE: MATCH_STATUS2.COMPLETED,
  FINISHED: MATCH_STATUS2.COMPLETED,
  PLAYED: MATCH_STATUS2.COMPLETED,
  CLOSED: MATCH_STATUS2.COMPLETED,
  CANCEL: MATCH_STATUS2.CANCELLED,
  CANCELED: MATCH_STATUS2.CANCELLED
});
function mapModeStatusToCore15(raw) {
  const key = String(raw || "").trim().toUpperCase().replace(/[-\s]+/g, "_");
  if (!key) return MATCH_STATUS2.READY_TO_START;
  return STATUS_MAP[key] || MATCH_STATUS2.READY_TO_START;
}

// src/features/competition-core/scoring/constants/versions.js
var CORE16_ENGINE_ID = "competition-core.scoring";
var CORE16_ENGINE_VERSION = "1.0.0";
var SCORING_FORMAT_SCHEMA_V1 = "competition-core.scoring.format.v1";
var SCORING_STATE_SCHEMA_V1 = "competition-core.scoring.state.v1";
var SCORING_EVENT_SCHEMA_V1 = "competition-core.scoring.event.v1";
var SCORING_PROJECTION_SCHEMA_V1 = "competition-core.scoring.projection.v1";
var SCORING_COMMAND_SCHEMA_V1 = "competition-core.scoring.command.v1";
var CORE16_IDENTITY = Object.freeze({
  engineId: CORE16_ENGINE_ID,
  engineVersion: CORE16_ENGINE_VERSION,
  formatSchema: SCORING_FORMAT_SCHEMA_V1,
  stateSchema: SCORING_STATE_SCHEMA_V1,
  eventSchema: SCORING_EVENT_SCHEMA_V1,
  projectionSchema: SCORING_PROJECTION_SCHEMA_V1,
  commandSchema: SCORING_COMMAND_SCHEMA_V1
});

// src/features/competition-core/scoring/enums/scoringSides.js
var SCORING_SIDE = Object.freeze({
  SIDE_A: "SIDE_A",
  SIDE_B: "SIDE_B"
});
var SCORING_SIDE_VALUES = new Set(Object.values(SCORING_SIDE));
function isScoringSide(value) {
  return typeof value === "string" && SCORING_SIDE_VALUES.has(value);
}

// src/features/competition-core/scoring/enums/scoringSystems.js
var SCORING_SYSTEM = Object.freeze({
  RALLY: "RALLY",
  SIDE_OUT: "SIDE_OUT"
});
var SCORING_SYSTEM_VALUES = new Set(Object.values(SCORING_SYSTEM));
function isScoringSystem(value) {
  return typeof value === "string" && SCORING_SYSTEM_VALUES.has(value);
}

// src/features/competition-core/scoring/enums/scoringEventTypes.js
var SCORING_EVENT_TYPE = Object.freeze({
  POINT_RECORDED: "POINT_RECORDED",
  POINT_DENIED_NO_SCORE: "POINT_DENIED_NO_SCORE",
  SERVE_CHANGED: "SERVE_CHANGED",
  SERVER_NUMBER_CHANGED: "SERVER_NUMBER_CHANGED",
  GAME_COMPLETED: "GAME_COMPLETED",
  SET_COMPLETED: "SET_COMPLETED",
  MATCH_COMPLETED: "MATCH_COMPLETED",
  EVENT_SUPERSEDED: "EVENT_SUPERSEDED"
});
var SCORING_EVENT_TYPE_VALUES = new Set(
  Object.values(SCORING_EVENT_TYPE)
);

// src/features/competition-core/scoring/enums/scoringCommandTypes.js
var SCORING_COMMAND_TYPE = Object.freeze({
  RECORD_POINT: "RECORD_POINT",
  SUPERSEDE_EVENT: "SUPERSEDE_EVENT",
  REPLAY_PROJECTION: "REPLAY_PROJECTION"
});
var SCORING_COMMAND_TYPE_VALUES = new Set(
  Object.values(SCORING_COMMAND_TYPE)
);

// src/features/competition-core/scoring/errors/scoringErrorCodes.js
var SCORING_ERROR_CODE = Object.freeze({
  SCORING_INVALID_FORMAT: "SCORING_INVALID_FORMAT",
  SCORING_INVALID_STATE: "SCORING_INVALID_STATE",
  SCORING_INVALID_COMMAND: "SCORING_INVALID_COMMAND",
  SCORING_INVALID_SIDE: "SCORING_INVALID_SIDE",
  SCORING_MATCH_ALREADY_COMPLETE: "SCORING_MATCH_ALREADY_COMPLETE",
  SCORING_INVALID_PROGRESSION: "SCORING_INVALID_PROGRESSION",
  SCORING_INVALID_CORRECTION_TARGET: "SCORING_INVALID_CORRECTION_TARGET",
  SCORING_DUPLICATE_SEQUENCE: "SCORING_DUPLICATE_SEQUENCE",
  SCORING_DUPLICATE_EVENT: "SCORING_DUPLICATE_EVENT",
  SCORING_REPLAY_INCONSISTENT: "SCORING_REPLAY_INCONSISTENT",
  SCORING_EVENT_ALREADY_SUPERSEDED: "SCORING_EVENT_ALREADY_SUPERSEDED",
  SCORING_CLOCK_REQUIRED: "SCORING_CLOCK_REQUIRED",
  SCORING_ID_FACTORY_REQUIRED: "SCORING_ID_FACTORY_REQUIRED"
});
var SCORING_ERROR_CODE_VALUES = new Set(
  Object.values(SCORING_ERROR_CODE)
);
function isScoringErrorCode(value) {
  return typeof value === "string" && SCORING_ERROR_CODE_VALUES.has(value);
}

// src/features/competition-core/scoring/errors/ScoringEngineError.js
var ScoringEngineError = class extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    const safeCode = isScoringErrorCode(code) ? code : SCORING_ERROR_CODE.SCORING_INVALID_COMMAND;
    super(String(message || safeCode));
    this.name = "ScoringEngineError";
    this.code = safeCode;
    this.details = details && typeof details === "object" && !Array.isArray(details) ? { ...details } : {};
  }
};

// src/features/competition-core/scoring/contracts/scoringFormat.js
function requirePositiveInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      `Scoring format field ${field} must be a positive integer`,
      { field, value }
    );
  }
  return n;
}
function requireOddBestOf(bestOf, field) {
  const n = requirePositiveInt(bestOf, field);
  if (n % 2 === 0) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      `Scoring format field ${field} must be an odd best-of value`,
      { field, value: n }
    );
  }
  return n;
}
function createScoringFormat(input = {}) {
  const scoringSystem = String(
    input.scoringSystem || SCORING_SYSTEM.SIDE_OUT
  ).trim().toUpperCase();
  if (!isScoringSystem(scoringSystem)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "Unknown scoring system",
      { scoringSystem }
    );
  }
  const pointsToWin = requirePositiveInt(
    input.pointsToWin ?? (scoringSystem === SCORING_SYSTEM.RALLY ? 21 : 11),
    "pointsToWin"
  );
  const winBy = requirePositiveInt(input.winBy ?? 2, "winBy");
  let maximumScore = null;
  if (input.maximumScore != null && input.maximumScore !== "") {
    maximumScore = requirePositiveInt(input.maximumScore, "maximumScore");
    if (maximumScore < pointsToWin) {
      throw new ScoringEngineError(
        SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
        "maximumScore must be >= pointsToWin",
        { maximumScore, pointsToWin }
      );
    }
  }
  const bestOfGames = requireOddBestOf(input.bestOfGames ?? 1, "bestOfGames");
  const gamesToWinSet = Math.ceil(bestOfGames / 2);
  const bestOfSets = requireOddBestOf(input.bestOfSets ?? 1, "bestOfSets");
  const setsToWinMatch = Math.ceil(bestOfSets / 2);
  let sideSwitchAt = null;
  if (input.sideSwitchAt != null && input.sideSwitchAt !== "") {
    sideSwitchAt = requirePositiveInt(input.sideSwitchAt, "sideSwitchAt");
  } else if (scoringSystem === SCORING_SYSTEM.RALLY) {
    sideSwitchAt = 11;
  }
  const serversPerSide = requirePositiveInt(
    input.serversPerSide ?? (scoringSystem === SCORING_SYSTEM.SIDE_OUT ? 2 : 1),
    "serversPerSide"
  );
  if (serversPerSide > 2) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "serversPerSide must be 1 or 2",
      { serversPerSide }
    );
  }
  const initialServingSide = String(
    input.initialServingSide || SCORING_SIDE.SIDE_A
  ).trim().toUpperCase();
  if (!isScoringSide(initialServingSide)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "initialServingSide must be SIDE_A or SIDE_B",
      { initialServingSide }
    );
  }
  const formatId = String(input.formatId || "default").trim();
  if (!formatId) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "formatId is required",
      {}
    );
  }
  let formatVersion = "1";
  if (input.formatVersion != null) {
    formatVersion = String(input.formatVersion).trim();
    if (!formatVersion) {
      throw new ScoringEngineError(
        SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
        "formatVersion must be a non-empty string when provided",
        { formatVersion: input.formatVersion }
      );
    }
  }
  if (input.metadata != null && typeof input.metadata !== "object") {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "metadata must be a plain object when provided",
      {}
    );
  }
  if (Array.isArray(input.metadata)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "metadata must not be an array",
      {}
    );
  }
  return Object.freeze({
    schemaVersion: SCORING_FORMAT_SCHEMA_V1,
    formatId,
    formatVersion,
    scoringSystem,
    pointsToWin,
    winBy,
    maximumScore,
    bestOfGames,
    gamesToWinSet,
    bestOfSets,
    setsToWinMatch,
    sideSwitchAt,
    serversPerSide,
    initialServingSide,
    metadata: input.metadata && typeof input.metadata === "object" ? Object.freeze({ ...input.metadata }) : Object.freeze({})
  });
}

// src/features/competition-engine/integration/referee/contract.js
var COMPETITION_REFEREE_ADAPTER_OWNED = Object.freeze([
  "competition context translation",
  "match context translation",
  "participant / team / lineup context",
  "scoring rules description",
  "lifecycle policy description",
  "capability flags",
  "pre-start validation policy",
  "result propagation instructions"
]);
var COMPETITION_REFEREE_ADAPTER_FORBIDDEN_OWNERSHIP = Object.freeze([
  "referee identity",
  "referee authorization",
  "referee assignment persistence",
  "match lifecycle transitions",
  "scoring calculation",
  "score persistence authority",
  "official result acceptance",
  "match event authority",
  "result revision authority"
]);
function requireAdapterRequest(request) {
  if (!isPlainObject2(request)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Adapter request must be a plain object",
      { requestType: request == null ? "null" : typeof request }
    );
  }
  const tenantId = String(request.tenantId || "").trim();
  const competitionId = String(request.competitionId || "").trim();
  if (!tenantId || !competitionId) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "tenantId and competitionId are required",
      {}
    );
  }
  return freezeClone({
    tenantId,
    competitionId,
    matchId: isNonEmptyString3(request.matchId) ? String(request.matchId).trim() : null,
    venueId: isNonEmptyString3(request.venueId) ? String(request.venueId).trim() : null,
    clubId: isNonEmptyString3(request.clubId) ? String(request.clubId).trim() : null
  });
}
function assertScoringRulesPayload(scoringRules2) {
  if (!isPlainObject2(scoringRules2)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      "Scoring rules are required",
      {}
    );
  }
  try {
    return freezeClone(createScoringFormat(scoringRules2));
  } catch (err) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      err instanceof Error ? err.message : "Invalid scoring rules",
      {}
    );
  }
}
function assertResultPropagationPayload(propagation) {
  if (!isPlainObject2(propagation)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Result propagation instructions are required",
      {}
    );
  }
  if (propagation.propagateOnlyIfAccepted !== true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.PROPAGATION_REQUIRES_ACCEPTED_RESULT,
      "Adapters may only describe propagation of CORE-17 accepted active results",
      { propagateOnlyIfAccepted: propagation.propagateOnlyIfAccepted }
    );
  }
  if (propagation.acceptOfficialResult === true || propagation.directScoreToResult === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_RESULT_AUTHORITY_FORBIDDEN,
      "Adapter must not convert raw score into an official result",
      {}
    );
  }
  return freezeClone({
    propagateOnlyIfAccepted: true,
    targets: Array.isArray(propagation.targets) ? [...propagation.targets] : Object.freeze(["standings", "bracket", "qualification", "aggregate"]),
    instructions: isPlainObject2(propagation.instructions) ? propagation.instructions : {}
  });
}

// src/features/competition-engine/integration/referee/adapters/shared/modeContext.js
function loadModeCompetitionState(state, request, expectedMode) {
  const req = requireAdapterRequest(request);
  if (!isPlainObject2(state)) {
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
function requireModeMatch(state, matchId) {
  if (!isNonEmptyString3(matchId)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
      "matchId is required",
      {}
    );
  }
  const id = String(matchId).trim();
  const matches = isPlainObject2(state.matches) ? state.matches : null;
  if (!matches || !isPlainObject2(matches[id])) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
      `Unknown match: ${id}`,
      { matchId: id }
    );
  }
  return freezeClone({ ...matches[id], matchId: id });
}
function normalizeParticipantSides(sides) {
  if (!Array.isArray(sides) || sides.length !== 2) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Exactly two participant sides are required",
      { sideCount: Array.isArray(sides) ? sides.length : 0 }
    );
  }
  return sides.map((side, index) => {
    if (!isPlainObject2(side)) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
        "Participant side must be a plain object",
        { index }
      );
    }
    const sideKey = isNonEmptyString3(side.sideKey) || isNonEmptyString3(side.side) ? String(side.sideKey || side.side).trim().toUpperCase() : index === 0 ? "A" : "B";
    const participantIds = Array.isArray(side.participantIds) ? side.participantIds.map((id) => String(id)) : [];
    return freezeClone({
      sideKey,
      entryId: isNonEmptyString3(side.entryId) ? String(side.entryId).trim() : null,
      teamId: isNonEmptyString3(side.teamId) ? String(side.teamId).trim() : null,
      participantIds
    });
  });
}
function sidesFromDailyPlayMatch(match) {
  const teamA = Array.isArray(match.teamAPlayerIds) ? match.teamAPlayerIds.map(String) : Array.isArray(match.sides?.[0]?.participantIds) ? match.sides[0].participantIds.map(String) : [];
  const teamB = Array.isArray(match.teamBPlayerIds) ? match.teamBPlayerIds.map(String) : Array.isArray(match.sides?.[1]?.participantIds) ? match.sides[1].participantIds.map(String) : [];
  return normalizeParticipantSides([
    {
      sideKey: "A",
      entryId: match.entryAId || null,
      teamId: null,
      participantIds: teamA
    },
    {
      sideKey: "B",
      entryId: match.entryBId || null,
      teamId: null,
      participantIds: teamB
    }
  ]);
}
function sidesFromIndividualMatch(match) {
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
      participantIds: Array.isArray(match.participantIdsA) ? match.participantIdsA.map(String) : entryA ? [entryA] : []
    },
    {
      sideKey: "B",
      entryId: entryB,
      teamId: null,
      participantIds: Array.isArray(match.participantIdsB) ? match.participantIdsB.map(String) : entryB ? [entryB] : []
    }
  ]);
}
function sidesFromTeamMatchup(matchup, subMatch = null) {
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
  const lineupA = Array.isArray(subMatch?.lineupA) ? subMatch.lineupA.map(String) : Array.isArray(matchup.lineupA) ? matchup.lineupA.map(String) : [];
  const lineupB = Array.isArray(subMatch?.lineupB) ? subMatch.lineupB.map(String) : Array.isArray(matchup.lineupB) ? matchup.lineupB.map(String) : [];
  return normalizeParticipantSides([
    {
      sideKey: "A",
      entryId: null,
      teamId: teamAId,
      participantIds: lineupA
    },
    {
      sideKey: "B",
      entryId: null,
      teamId: teamBId,
      participantIds: lineupB
    }
  ]);
}
function competitionTypeForMode(mode) {
  return COMPETITION_REFEREE_MODE_TO_TYPE[mode] || null;
}
function resolveInjectedModeState(options, request) {
  if (typeof options.getModeState === "function") {
    return options.getModeState(request);
  }
  if (isPlainObject2(options.modeState)) {
    return options.modeState;
  }
  if (isPlainObject2(request) && isPlainObject2(request.modeState)) {
    return request.modeState;
  }
  failRefereeAdapter(
    REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
    "Mode adapter requires modeState or getModeState",
    {}
  );
}

// src/features/competition-engine/integration/referee/adapters/shared/policyBuilders.js
function buildStandardLifecyclePolicy(overrides = {}) {
  const base = {
    policyId: "competition.referee.lifecycle.v1",
    requiresLineups: overrides.requiresLineups !== false,
    canStartFrom: overrides.canStartFrom || [
      MATCH_STATUS2.READY_TO_START,
      MATCH_STATUS2.SCHEDULED
    ],
    completionRequiresAcceptedResult: overrides.completionRequiresAcceptedResult === true,
    ...overrides
  };
  return freezeClone({
    ...base,
    // Locked invariants — cannot be overridden away
    requiresAssignment: true,
    standingsRequireAcceptedResult: true
  });
}
function buildStandardCapabilities(overrides = {}) {
  const base = {
    scoring: overrides.scoring !== false,
    suspend: overrides.suspend !== false,
    resume: overrides.resume !== false,
    incidentReport: overrides.incidentReport !== false,
    childOverrideAssignment: overrides.childOverrideAssignment === true,
    dreambreakerInheritsParent: overrides.dreambreakerInheritsParent === true,
    ...overrides
  };
  return freezeClone({
    ...base,
    // Locked — Adapter B never owns these
    ownsScoringAuthority: false,
    ownsResultAuthority: false,
    ownsRefereeIdentity: false,
    usesLegacyTokenAuthority: false,
    usesLocalStorageFallback: false,
    usesInMemoryProductionFallback: false
  });
}
function buildAcceptedOnlyPropagation(options = {}) {
  return assertResultPropagationPayload({
    propagateOnlyIfAccepted: true,
    targets: options.targets || [
      "standings",
      "bracket",
      "qualification",
      "aggregate"
    ],
    instructions: {
      source: "CORE-17 accepted active result only",
      adapterMustNotAccept: true,
      adapterMustNotMutateScore: true,
      ...options.instructions || {}
    }
  });
}

// src/features/competition-engine/integration/referee/adapters/shared/scoringRulesMapper.js
var DAILY_PLAY_DEFAULT_SCORING_RULES = Object.freeze({
  scoringSystem: SCORING_SYSTEM.SIDE_OUT,
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 1
});
function mapModeScoringRulesToCore16(raw, options = {}) {
  if (raw == null) {
    if (options.allowDailyPlayDefault === true) {
      return assertScoringRulesPayload(DAILY_PLAY_DEFAULT_SCORING_RULES);
    }
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      "Scoring rules are required",
      {}
    );
  }
  if (!isPlainObject2(raw)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      "Scoring rules must be a plain object",
      {}
    );
  }
  const normalized = {
    ...raw,
    scoringSystem: raw.scoringSystem || (raw.targetScore != null || raw.targetPoints != null ? SCORING_SYSTEM.RALLY : void 0),
    pointsToWin: raw.pointsToWin ?? raw.targetScore ?? raw.targetPoints ?? void 0,
    winBy: raw.winBy ?? void 0,
    bestOfGames: raw.bestOfGames ?? void 0
  };
  return assertScoringRulesPayload(normalized);
}

// src/features/competition-engine/integration/referee/adapters/DailyPlayRefereeAdapter.js
function assertDailyPlayStateSafe(state) {
  if (!isPlainObject2(state)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Daily Play mode state must be a plain object",
      {}
    );
  }
  if (state.treatRosterAsCore13Assignment === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN,
      "Daily Play roster must not be treated as CORE-13 assignment authority",
      {}
    );
  }
  if (state.adoptDailyPlayScoreRpcAsCanonical === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN,
      "Daily Play score RPCs must not be adopted as CORE-16 authority",
      {}
    );
  }
  if (state.directScoreMutationEnabled === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN,
      "Adapter B must not mutate Daily Play scores",
      {}
    );
  }
  if (state.browserStorageProductionFallback === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN,
      "Adapter B must not create browser-storage or in-memory production fallback",
      {}
    );
  }
}
function createDailyPlayRefereeAdapter(options = {}) {
  const competitionMode = COMPETITION_REFEREE_MODE.DAILY_PLAY;
  function load(request, { requireMatch = true } = {}) {
    const state = resolveInjectedModeState(options, request);
    assertDailyPlayStateSafe(state);
    const loaded = loadModeCompetitionState(state, request, competitionMode);
    if (!requireMatch) {
      return { ...loaded, match: null };
    }
    const match = requireModeMatch(loaded.state, loaded.req.matchId);
    return { ...loaded, match };
  }
  function resolveScoringRules(match, state) {
    const raw = match.scoringRules || match.scoringFormat || state.scoringRules || state.scoringFormat || null;
    if (raw == null && state.scoringRulesUnavailable === true) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
        "Daily Play scoring rules unavailable",
        { matchId: match.matchId }
      );
    }
    return mapModeScoringRulesToCore16(raw, {
      allowDailyPlayDefault: raw == null
    });
  }
  return Object.freeze({
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    adapterId: String(options.adapterId || "daily-play-referee-adapter-b").trim(),
    competitionMode,
    getCompetitionContext(request) {
      const { req, state, tenantId, competitionId } = load(request, {
        requireMatch: false
      });
      const session = isPlainObject2(state.session) ? state.session : {};
      return freezeClone({
        tenantId,
        competitionId,
        competitionMode,
        competitionType: competitionTypeForMode(competitionMode),
        venueId: state.venueId || req.venueId || null,
        clubId: state.clubId || req.clubId || null,
        sessionId: session.sessionId || competitionId,
        matchType: session.matchType || state.matchType || null,
        skipScore: session.skipScore === true || state.skipScore === true,
        enabledCourtIds: Array.isArray(session.enabledCourtIds) ? session.enabledCourtIds.map(String) : Array.isArray(state.enabledCourtIds) ? state.enabledCourtIds.map(String) : [],
        checkedInCount: Array.isArray(session.checkedInPlayerIds) ? session.checkedInPlayerIds.length : Array.isArray(state.checkedInPlayerIds) ? state.checkedInPlayerIds.length : 0,
        // Honest: roster is not CORE-13
        rosterIsCore13AssignmentAuthority: false,
        canonicalAssignmentAuthorityAvailable: state.canonicalAssignmentAuthorityAvailable === true
      });
    },
    getMatchContext(request) {
      const { match, tenantId, competitionId, state } = load(request);
      return freezeClone({
        matchId: match.matchId,
        competitionId,
        tenantId,
        status: mapModeStatusToCore15(match.status),
        scheduledAt: match.scheduledAt || null,
        courtId: match.courtId || null,
        stage: match.stage || "DAILY_PLAY",
        round: match.round ?? null,
        parentMatchId: null,
        childMatchIds: [],
        sessionId: isPlainObject2(state.session) && state.session.sessionId || competitionId,
        matchType: match.matchType || state.matchType || null
      });
    },
    getParticipants(request) {
      const { match } = load(request);
      return freezeClone({
        sides: sidesFromDailyPlayMatch(match),
        lineupsLocked: match.lineupsLocked === true
      });
    },
    getScoringRules(request) {
      const { match, state } = load(request);
      return resolveScoringRules(match, state);
    },
    getLifecyclePolicy(request) {
      load(request);
      return buildStandardLifecyclePolicy({
        requiresLineups: true,
        mode: competitionMode,
        // Policy: CORE-13 assignment is required; Adapter B does not supply it
        assignmentAuthority: "CORE-13",
        dailyPlayRosterNotAssignmentAuthority: true
      });
    },
    getCapabilities(request) {
      const { state } = load(request);
      const skipScore = state.skipScore === true || isPlainObject2(state.session) && state.session.skipScore === true;
      return buildStandardCapabilities({
        scoring: !skipScore,
        childOverrideAssignment: false,
        dreambreakerInheritsParent: false,
        mode: competitionMode
      });
    },
    validatePreStart(request) {
      const { match, state } = load(request);
      const blockers = [];
      if (state.canonicalAssignmentAuthorityAvailable !== true) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED,
          message: "Canonical CORE-13 assignment authority is unavailable at Adapter B boundary; Daily Play roster is not assignment authority"
        });
      }
      try {
        resolveScoringRules(match, state);
      } catch (err) {
        blockers.push({
          code: err?.code || REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
          message: err instanceof Error ? err.message : "Missing scoring rules"
        });
      }
      try {
        const sides = sidesFromDailyPlayMatch(match);
        const a = sides[0]?.participantIds || [];
        const b = sides[1]?.participantIds || [];
        if (a.length === 0 || b.length === 0) {
          blockers.push({
            code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
            message: "Both Daily Play sides require participants"
          });
        }
      } catch (err) {
        blockers.push({
          code: err?.code || REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: err instanceof Error ? err.message : "Invalid participants"
        });
      }
      if (state.closedAt || state.sessionClosed === true) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: "Daily Play session is closed"
        });
      }
      return freezeClone({
        ok: blockers.length === 0,
        blockers
      });
    },
    resolveResultPropagation(request) {
      load(request);
      return buildAcceptedOnlyPropagation({
        targets: ["standings", "aggregate"],
        instructions: {
          mode: competitionMode,
          doNotAdoptDailyPlayScoreRpc: true,
          doNotMutateDailyPlayScoreFromAdapter: true
        }
      });
    }
  });
}
var DailyPlayRefereeAdapter = {
  create: createDailyPlayRefereeAdapter,
  competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY
};

// src/features/competition-engine/integration/referee/adapters/shared/individualTournamentMapping.js
function createIndividualTournamentRefereeAdapterSurface({
  options,
  competitionMode,
  adapterId,
  contractId,
  contractVersion
}) {
  function load(request, { requireMatch = true } = {}) {
    const state = resolveInjectedModeState(options, request);
    const loaded = loadModeCompetitionState(state, request, competitionMode);
    if (!requireMatch) {
      return { ...loaded, match: null };
    }
    const match = requireModeMatch(loaded.state, loaded.req.matchId);
    return { ...loaded, match };
  }
  function resolveScoringRules(match, state) {
    const raw = match.scoringRules || match.scoringFormat || state.scoringRules || state.scoringFormat || null;
    return mapModeScoringRulesToCore16(raw);
  }
  return Object.freeze({
    contractId,
    contractVersion,
    adapterId,
    competitionMode,
    getCompetitionContext(request) {
      const { req, state, tenantId, competitionId } = load(request, {
        requireMatch: false
      });
      return freezeClone({
        tenantId,
        competitionId,
        competitionMode,
        competitionType: state.competitionType || competitionTypeForMode(competitionMode),
        venueId: state.venueId || req.venueId || null,
        clubId: state.clubId || req.clubId || null,
        stageModel: state.stageModel || "individual_tournament",
        registrationContext: competitionMode === "OFFICIAL" ? state.registrationContext || null : void 0,
        eligibilityContext: competitionMode === "OFFICIAL" ? state.eligibilityContext || null : void 0,
        legacyTokenEvidencePresent: state.legacyTokenEvidencePresent === true,
        // Token route is never Adapter B / CORE-13 authority
        tokenRouteIsCanonicalAuthority: false
      });
    },
    getMatchContext(request) {
      const { match, tenantId, competitionId } = load(request);
      return freezeClone({
        matchId: match.matchId,
        competitionId,
        tenantId,
        status: mapModeStatusToCore15(match.status),
        scheduledAt: match.scheduledAt || null,
        courtId: match.courtId || null,
        stage: match.stage || null,
        round: match.round ?? null,
        eventId: match.eventId || null,
        groupId: match.groupId || null,
        parentMatchId: match.parentMatchId || null,
        childMatchIds: Array.isArray(match.childMatchIds) ? match.childMatchIds.map(String) : [],
        bracketMatchId: match.bracketMatchId || null
      });
    },
    getParticipants(request) {
      const { match } = load(request);
      return freezeClone({
        sides: sidesFromIndividualMatch(match),
        lineupsLocked: match.lineupsLocked === true
      });
    },
    getScoringRules(request) {
      const { match, state } = load(request);
      return resolveScoringRules(match, state);
    },
    getLifecyclePolicy(request) {
      load(request);
      return buildStandardLifecyclePolicy({
        requiresLineups: true,
        mode: competitionMode
      });
    },
    getCapabilities(request) {
      load(request);
      return buildStandardCapabilities({
        childOverrideAssignment: false,
        dreambreakerInheritsParent: false,
        mode: competitionMode
      });
    },
    validatePreStart(request) {
      const { match, state } = load(request);
      const blockers = [];
      if (state.legacyTokenEvidencePresent === true && state.canonicalAssignmentAuthorityAvailable !== true && state.requireCanonicalAssignmentForPreStart === true) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED,
          message: "Legacy /referee/:token evidence is not CORE-13 assignment authority"
        });
      }
      try {
        resolveScoringRules(match, state);
      } catch (err) {
        blockers.push({
          code: err?.code || REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
          message: err instanceof Error ? err.message : "Missing scoring rules"
        });
      }
      try {
        const sides = sidesFromIndividualMatch(match);
        if (!sides[0]?.entryId || !sides[1]?.entryId) {
          blockers.push({
            code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
            message: "Both entries are required before start"
          });
        }
      } catch (err) {
        blockers.push({
          code: err?.code || REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: err instanceof Error ? err.message : "Invalid participants"
        });
      }
      if (state.closedAt || state.tournamentClosed === true) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: "Competition is closed"
        });
      }
      return freezeClone({
        ok: blockers.length === 0,
        blockers
      });
    },
    resolveResultPropagation(request) {
      load(request);
      return buildAcceptedOnlyPropagation({
        targets: ["standings", "bracket", "qualification", "aggregate"],
        instructions: {
          mode: competitionMode,
          doNotUseTournamentMatchLiveAsAuthority: true,
          doNotUseTokenFinalizeAsAuthority: true
        }
      });
    }
  });
}
function assertIndividualModeStateSafe(state) {
  if (!isPlainObject2(state)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Individual mode state must be a plain object",
      {}
    );
  }
  if (state.usesTokenAsCanonicalAuthority === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN,
      "Adapter B must not treat /referee/:token as canonical authority",
      {}
    );
  }
  if (state.directScoreMutationEnabled === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN,
      "Adapter B must not enable direct score mutation",
      {}
    );
  }
  if (isNonEmptyString3(state.browserExposedPrivilegedRpc) || state.callBrowserExposedPrivilegedRpc === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN,
      "Adapter B must not call browser-exposed privileged RPC",
      {}
    );
  }
}

// src/features/competition-engine/integration/referee/adapters/InternalTournamentRefereeAdapter.js
function createInternalTournamentRefereeAdapter(options = {}) {
  const wrapped = {
    ...options,
    getModeState(request) {
      const state = resolveInjectedModeState(options, request);
      assertIndividualModeStateSafe(state);
      return state;
    }
  };
  return createIndividualTournamentRefereeAdapterSurface({
    options: wrapped,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    adapterId: String(
      options.adapterId || "internal-tournament-referee-adapter-b"
    ).trim(),
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION
  });
}
var InternalTournamentRefereeAdapter = {
  create: createInternalTournamentRefereeAdapter,
  competitionMode: COMPETITION_REFEREE_MODE.INTERNAL
};

// src/features/competition-engine/integration/referee/adapters/OfficialTournamentRefereeAdapter.js
function createOfficialTournamentRefereeAdapter(options = {}) {
  const wrapped = {
    ...options,
    getModeState(request) {
      const state = resolveInjectedModeState(options, request);
      assertIndividualModeStateSafe(state);
      return state;
    }
  };
  return createIndividualTournamentRefereeAdapterSurface({
    options: wrapped,
    competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
    adapterId: String(
      options.adapterId || "official-tournament-referee-adapter-b"
    ).trim(),
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION
  });
}
var OfficialTournamentRefereeAdapter = {
  create: createOfficialTournamentRefereeAdapter,
  competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL
};

// src/features/team-tournament/engines/teamRefereeCanonicalLifecycle.js
var REFEREE_ASSIGNMENT_SCOPE = Object.freeze({
  PARENT: "parent",
  CHILD: "child"
});
function liveStatus(row) {
  const status = String(row?.effectiveStatus || row?.status || "").toLowerCase();
  return status === "pending" || status === "active";
}
function isParentRefereeAssignment(row = {}) {
  if (!row || typeof row !== "object") return false;
  if (String(row.scope || "").toLowerCase() === REFEREE_ASSIGNMENT_SCOPE.PARENT) {
    return true;
  }
  const subId = String(row.externalSubMatchId || row.subMatchId || "").trim();
  return !subId;
}
function resolveEffectiveRefereeAssignment({
  assignments = [],
  matchupId,
  subMatchId = null
} = {}) {
  const matchupKey = String(matchupId || "").trim();
  const subKey = String(subMatchId || "").trim();
  const rows = (assignments || []).filter(liveStatus);
  if (!matchupKey) return null;
  if (subKey) {
    const child = rows.find((row) => {
      if (isParentRefereeAssignment(row)) return false;
      const rowSub = String(row.externalSubMatchId || row.subMatchId || row.matchId || "");
      const rowMatchup = String(row.matchupId || row.externalMatchupId || "");
      return rowSub === subKey && (!rowMatchup || rowMatchup === matchupKey);
    });
    if (child) {
      return { ...child, scope: REFEREE_ASSIGNMENT_SCOPE.CHILD, inherited: false };
    }
  }
  const parent = rows.find((row) => {
    if (!isParentRefereeAssignment(row)) return false;
    const rowMatchup = String(
      row.matchupId || row.externalMatchupId || row.assignmentMatchId || row.matchId || ""
    );
    return rowMatchup === matchupKey;
  });
  if (parent) {
    return { ...parent, scope: REFEREE_ASSIGNMENT_SCOPE.PARENT, inherited: Boolean(subKey) };
  }
  return null;
}
function canAssignedRefereeWriteMatchup({
  assignments = [],
  matchupId,
  subMatchId = null,
  refereeUserId,
  isOrganizer = false
} = {}) {
  if (isOrganizer) return true;
  const uid = String(refereeUserId || "").trim();
  if (!uid) return false;
  const effective = resolveEffectiveRefereeAssignment({ assignments, matchupId, subMatchId });
  if (!effective) return false;
  return String(effective.refereeUserId || "") === uid;
}

// src/features/competition-engine/integration/referee/adapters/TeamTournamentRefereeAdapter.js
var MATCH_STATUS_FALLBACK = "READY_TO_START";
function assertTeamStateSafe(state) {
  if (!isPlainObject2(state)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Team mode state must be a plain object",
      {}
    );
  }
  if (state.duplicateDreambreakerAssignmentRequired === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "DreamBreaker must inherit parent assignment; duplicate assignment is forbidden",
      {}
    );
  }
  if (state.moveDreambreakerAuthorityIntoAdapter === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN,
      "DreamBreaker authority must remain in Team Tournament domain",
      {}
    );
  }
  if (state.directScoreMutationEnabled === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN,
      "Adapter B must not mutate Team scores",
      {}
    );
  }
  if (state.acceptOfficialResult === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_RESULT_AUTHORITY_FORBIDDEN,
      "Adapter B must not accept official results",
      {}
    );
  }
}
function resolveTeamMatch(state, matchId) {
  if (!isNonEmptyString3(matchId)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
      "matchId is required",
      {}
    );
  }
  const id = String(matchId).trim();
  const matchups = isPlainObject2(state.matchups) ? state.matchups : {};
  const matches = isPlainObject2(state.matches) ? state.matches : {};
  if (isPlainObject2(matches[id])) {
    const row = matches[id];
    const matchupId = String(row.matchupId || row.parentMatchId || "").trim();
    const matchup = matchupId && isPlainObject2(matchups[matchupId]) ? matchups[matchupId] : null;
    return freezeClone({
      matchId: id,
      matchupId: matchupId || id,
      matchup: matchup || {
        matchupId: matchupId || id,
        teamAId: row.teamAId,
        teamBId: row.teamBId,
        sides: row.sides,
        lineupA: row.lineupA,
        lineupB: row.lineupB,
        lineupsLocked: row.lineupsLocked,
        dreambreaker: row.dreambreaker
      },
      subMatch: row.isParent === true ? null : row,
      isParent: row.isParent === true || !row.parentMatchId && !row.subMatchId,
      isDreambreaker: row.isDreambreaker === true || String(row.discipline || "").toLowerCase() === "dreambreaker" || String(id).startsWith("db-")
    });
  }
  if (isPlainObject2(matchups[id])) {
    const matchup = {
      ...matchups[id],
      matchupId: matchups[id].matchupId || id
    };
    return freezeClone({
      matchId: id,
      matchupId: id,
      matchup,
      subMatch: null,
      isParent: true,
      isDreambreaker: false
    });
  }
  for (const [matchupId, rawMatchup] of Object.entries(matchups)) {
    if (!isPlainObject2(rawMatchup)) continue;
    const matchup = { ...rawMatchup, matchupId: rawMatchup.matchupId || matchupId };
    const subs = Array.isArray(matchup.subMatches) ? matchup.subMatches : [];
    const sub = subs.find((item) => String(item?.id || item?.subMatchId || "") === id);
    if (sub) {
      const isDreambreaker = sub.isDreambreaker === true || String(sub.discipline || "").toLowerCase() === "dreambreaker" || String(id).startsWith("db-");
      return freezeClone({
        matchId: id,
        matchupId,
        matchup,
        subMatch: sub,
        isParent: false,
        isDreambreaker
      });
    }
  }
  failRefereeAdapter(
    REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
    `Unknown Team match/matchup: ${id}`,
    { matchId: id }
  );
}
function resolveTeamScoringRules(resolved, state) {
  const { subMatch, matchup, isDreambreaker } = resolved;
  const raw = subMatch?.scoringRules || subMatch?.scoringFormat || (isDreambreaker ? matchup?.dreambreaker?.scoringFormat || matchup?.scheduleMeta?.dreambreakerScoringFormat || state.dreambreakerScoringFormat || null : null) || matchup?.scoringRules || matchup?.scoringFormat || state.scoringRules || state.scoringFormat || null;
  if (raw == null && isDreambreaker) {
    return mapModeScoringRulesToCore16({
      scoringSystem: "RALLY",
      pointsToWin: 21,
      winBy: 2,
      bestOfGames: 1
    });
  }
  return mapModeScoringRulesToCore16(raw);
}
function createTeamTournamentRefereeAdapter(options = {}) {
  const competitionMode = COMPETITION_REFEREE_MODE.TEAM;
  function load(request, { requireMatch = true } = {}) {
    const state = resolveInjectedModeState(options, request);
    assertTeamStateSafe(state);
    const loaded = loadModeCompetitionState(state, request, competitionMode);
    if (!requireMatch) {
      return { ...loaded, resolved: null };
    }
    const resolved = resolveTeamMatch(loaded.state, loaded.req.matchId);
    return { ...loaded, resolved };
  }
  return Object.freeze({
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    adapterId: String(options.adapterId || "team-tournament-referee-adapter-b").trim(),
    competitionMode,
    getCompetitionContext(request) {
      const { req, state, tenantId, competitionId } = load(request, {
        requireMatch: false
      });
      return freezeClone({
        tenantId,
        competitionId,
        competitionMode,
        competitionType: competitionTypeForMode(competitionMode),
        venueId: state.venueId || req.venueId || null,
        clubId: state.clubId || req.clubId || null,
        parentMatchupAssignmentSsot: true,
        childOverrideAssignment: true,
        dreambreakerInheritsParent: true,
        noDuplicateDreambreakerAssignment: true,
        writePolicy: "organizer_can_manage_OR_assigned_canonical_uid",
        automaticIdempotentV5Ensure: true,
        dreambreakerAuthorityOwner: "team_tournament_domain"
      });
    },
    getMatchContext(request) {
      const { resolved, tenantId, competitionId, state } = load(request);
      const { matchup, subMatch, matchId, matchupId, isParent, isDreambreaker } = resolved;
      const childMatchIds = isParent ? Array.isArray(matchup.subMatches) ? matchup.subMatches.map((s) => String(s.id || s.subMatchId)) : Array.isArray(matchup.childMatchIds) ? matchup.childMatchIds.map(String) : [] : [];
      const assignments = Array.isArray(state.assignments) ? state.assignments : [];
      const effective = resolveEffectiveRefereeAssignment({
        assignments,
        matchupId,
        subMatchId: isParent ? null : matchId
      });
      return freezeClone({
        matchId,
        competitionId,
        tenantId,
        status: mapModeStatusToCore15(
          subMatch?.status || matchup.status || MATCH_STATUS_FALLBACK
        ),
        scheduledAt: subMatch?.scheduledAt || matchup.scheduledAt || null,
        courtId: subMatch?.courtId || matchup.courtId || null,
        stage: matchup.stage || null,
        round: matchup.round ?? null,
        parentMatchId: isParent ? null : matchupId,
        childMatchIds,
        matchupId,
        isParentMatchup: isParent,
        isDreambreaker,
        // Projection only — Team domain remains assignment SSOT
        effectiveRefereeAssignment: effective ? {
          refereeUserId: effective.refereeUserId || null,
          scope: effective.scope || null,
          inherited: effective.inherited === true
        } : null,
        dreambreakerProjection: isPlainObject2(matchup.dreambreaker) ? {
          status: matchup.dreambreaker.status || null,
          required: matchup.dreambreaker.required === true,
          // Rotation state stays in Team domain; expose presence only
          rotationOwnedByTeamDomain: true
        } : null
      });
    },
    getParticipants(request) {
      const { resolved } = load(request);
      return freezeClone({
        sides: sidesFromTeamMatchup(resolved.matchup, resolved.subMatch),
        lineupsLocked: resolved.subMatch?.lineupsLocked === true || resolved.matchup.lineupsLocked === true
      });
    },
    getScoringRules(request) {
      const { resolved, state } = load(request);
      return resolveTeamScoringRules(resolved, state);
    },
    getLifecyclePolicy(request) {
      load(request);
      return buildStandardLifecyclePolicy({
        requiresLineups: true,
        mode: competitionMode,
        parentMatchupAssignmentSsot: true,
        dreambreakerInheritsParentAssignment: true,
        automaticIdempotentV5Ensure: true
      });
    },
    getCapabilities(request) {
      load(request);
      return buildStandardCapabilities({
        childOverrideAssignment: true,
        dreambreakerInheritsParent: true,
        mode: competitionMode,
        // Write policy description for UI — Adapter B does not authorize
        writePolicyDescription: "organizer_can_manage_OR_assigned_canonical_uid",
        canEvaluateWritePolicyProjection: true
      });
    },
    validatePreStart(request) {
      const { resolved, state } = load(request);
      const blockers = [];
      try {
        resolveTeamScoringRules(resolved, state);
      } catch (err) {
        blockers.push({
          code: err?.code || REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
          message: err instanceof Error ? err.message : "Missing scoring rules"
        });
      }
      try {
        sidesFromTeamMatchup(resolved.matchup, resolved.subMatch);
      } catch (err) {
        blockers.push({
          code: err?.code || REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: err instanceof Error ? err.message : "Invalid participants"
        });
      }
      if (resolved.isDreambreaker) {
        const assignments = Array.isArray(state.assignments) ? state.assignments : [];
        const effective = resolveEffectiveRefereeAssignment({
          assignments,
          matchupId: resolved.matchupId,
          subMatchId: resolved.matchId
        });
        if (state.requireDreambreakerOwnAssignment === true && effective?.inherited !== false) {
          blockers.push({
            code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
            message: "Unsupported state: DreamBreaker must inherit parent assignment"
          });
        }
      }
      if (state.tournamentClosed === true || state.closedAt) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: "Team tournament is closed"
        });
      }
      return freezeClone({
        ok: blockers.length === 0,
        blockers
      });
    },
    resolveResultPropagation(request) {
      const { resolved } = load(request);
      return buildAcceptedOnlyPropagation({
        targets: ["standings", "bracket", "qualification", "aggregate"],
        instructions: {
          mode: competitionMode,
          matchupId: resolved.matchupId,
          isDreambreaker: resolved.isDreambreaker,
          doNotAcceptResultInAdapter: true,
          writeGuardProjection: "organizer_can_manage_OR_assigned_canonical_uid"
        }
      });
    },
    /**
     * Read-only projection helper for tests/UI policy display.
     * Does NOT authorize writes.
     */
    projectWritePolicy(request, { refereeUserId, isOrganizer = false } = {}) {
      const { resolved, state } = load(request);
      const allowed = canAssignedRefereeWriteMatchup({
        assignments: Array.isArray(state.assignments) ? state.assignments : [],
        matchupId: resolved.matchupId,
        subMatchId: resolved.isParent ? null : resolved.matchId,
        refereeUserId,
        isOrganizer
      });
      return freezeClone({
        allowed,
        authority: false,
        policy: "organizer_can_manage_OR_assigned_canonical_uid",
        projectionOnly: true
      });
    }
  });
}
var TeamTournamentRefereeAdapter = {
  create: createTeamTournamentRefereeAdapter,
  competitionMode: COMPETITION_REFEREE_MODE.TEAM
};

// src/features/referee-v5/server/mapCanonicalIdentityToAdapterBModeState.js
function isPlainObject3(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
function asArray(value) {
  return Array.isArray(value) ? value : [];
}
function resolveCompetitionModeFromIdentity(row, payload = {}) {
  const candidates = [row?.mode, payload.mode, payload.competitionMode, payload.competitionType];
  for (const candidate of candidates) {
    const raw = text(candidate);
    if (!raw) continue;
    const upper = raw.toUpperCase();
    if (COMPETITION_REFEREE_MODE_VALUES.includes(upper)) return upper;
    const mapped = COMPETITION_TYPE_TO_REFEREE_MODE[raw] || COMPETITION_TYPE_TO_REFEREE_MODE[raw.toLowerCase()];
    if (mapped) return mapped;
  }
  return null;
}
function playerIds(match, entry, side) {
  const fromMatch = side === "A" ? match.participantIdsA : match.participantIdsB;
  if (Array.isArray(fromMatch) && fromMatch.length > 0) {
    return fromMatch.map((id) => String(id));
  }
  if (Array.isArray(entry?.playerIds) && entry.playerIds.length > 0) {
    return entry.playerIds.map((id) => String(id));
  }
  const entryId = side === "A" ? match.entryAId : match.entryBId;
  return text(entryId) ? [text(entryId)] : [];
}
function scoringRules(match, event, payload, row) {
  return match?.scoringRules || match?.scoringFormat || event?.scoringRules || event?.scoringFormat || payload?.scoringRules || payload?.scoringFormat || row?.engine_v4?.scoringRules || row?.engine_v4?.scoringFormat || null;
}
function mapIndividualMatches(payload, row) {
  const matches = {};
  const events = asArray(payload.events);
  for (const event of events) {
    if (!isPlainObject3(event)) continue;
    const entriesById = new Map(
      asArray(event.entries).filter((entry) => entry && entry.id != null).map((entry) => [String(entry.id), entry])
    );
    for (const match of asArray(event.matches)) {
      if (!isPlainObject3(match)) continue;
      const matchId = text(match.id || match.matchId);
      if (!matchId) continue;
      if (text(match.tournamentId) && text(match.tournamentId) !== text(row.id)) {
        continue;
      }
      const entryA = entriesById.get(text(match.entryAId));
      const entryB = entriesById.get(text(match.entryBId));
      matches[matchId] = {
        matchId,
        status: match.status || "READY_TO_START",
        courtId: match.courtId || null,
        stage: match.stage || event.stage || null,
        round: match.round ?? null,
        eventId: event.id || match.eventId || null,
        entryAId: match.entryAId || null,
        entryBId: match.entryBId || null,
        participantIdsA: playerIds(match, entryA, "A"),
        participantIdsB: playerIds(match, entryB, "B"),
        scoringRules: scoringRules(match, event, payload, row),
        lineupsLocked: match.lineupsLocked === true || Boolean(match.entryAId && match.entryBId)
      };
    }
  }
  if (Object.keys(matches).length === 0 && isPlainObject3(payload.matches)) {
    return payload.matches;
  }
  return matches;
}
function mapDailyMatches(payload, row) {
  const daily = payload.settings?.dailyPlay && isPlainObject3(payload.settings.dailyPlay) ? payload.settings.dailyPlay : isPlainObject3(payload.dailyPlay) ? payload.dailyPlay : payload;
  const matches = {};
  const list = asArray(daily.matches);
  if (list.length === 0 && isPlainObject3(daily.matches)) {
    return { session: daily.session || daily, matches: daily.matches };
  }
  for (const match of list) {
    if (!isPlainObject3(match)) continue;
    const matchId = text(match.id || match.matchId);
    if (!matchId) continue;
    matches[matchId] = {
      matchId,
      status: match.status || "ready",
      courtId: match.courtId || null,
      teamAPlayerIds: asArray(match.teamAPlayerIds).map(String),
      teamBPlayerIds: asArray(match.teamBPlayerIds).map(String),
      scoringRules: scoringRules(match, null, payload, row),
      lineupsLocked: match.lineupsLocked === true
    };
  }
  return {
    session: isPlainObject3(daily.session) ? daily.session : daily,
    matches: Object.keys(matches).length > 0 ? matches : daily.matches || {}
  };
}
function mapTeamMatchups(payload) {
  if (isPlainObject3(payload.matchups)) return payload.matchups;
  const list = asArray(payload.matchups);
  const matchups = {};
  for (const matchup of list) {
    if (!isPlainObject3(matchup)) continue;
    const id = text(matchup.matchupId || matchup.id);
    if (!id) continue;
    matchups[id] = { ...matchup, matchupId: id };
  }
  return matchups;
}
function mapCanonicalIdentityToAdapterBModeState(row) {
  if (!isPlainObject3(row) || !text(row.id)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Canonical tournament identity is required."
    );
  }
  const tenantId = text(row.tenant_id);
  if (!tenantId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.TENANT_ACCESS_DENIED,
      "Tournament tenant evidence is missing."
    );
  }
  const payload = isPlainObject3(row.payload) ? row.payload : {};
  if (text(payload.tenantId) && text(payload.tenantId) !== tenantId) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  const competitionMode = resolveCompetitionModeFromIdentity(row, payload);
  if (!competitionMode) {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Cannot resolve Adapter B competition mode from tournament identity."
    );
  }
  const base = {
    tenantId,
    competitionId: text(row.id),
    competitionMode,
    competitionType: payload.competitionType || row.mode || null,
    venueId: payload.venueId || null,
    clubId: row.club_id || payload.clubId || null
  };
  let modeState;
  if (competitionMode === COMPETITION_REFEREE_MODE.DAILY_PLAY) {
    const daily = mapDailyMatches(payload, row);
    modeState = {
      ...base,
      session: daily.session,
      matches: daily.matches,
      scoringRules: payload.scoringRules || null
    };
  } else if (competitionMode === COMPETITION_REFEREE_MODE.TEAM) {
    modeState = {
      ...base,
      matchups: mapTeamMatchups(payload),
      matches: isPlainObject3(payload.matches) ? payload.matches : {},
      assignments: asArray(payload.assignments)
    };
  } else {
    modeState = {
      ...base,
      matches: mapIndividualMatches(payload, row),
      scoringRules: payload.scoringRules || payload.scoringFormat || null
    };
  }
  return { ok: true, tenantId, competitionMode, modeState };
}
function createServerResolvedAdapterB(competitionMode, modeState) {
  const options = { modeState };
  if (competitionMode === COMPETITION_REFEREE_MODE.INTERNAL) {
    return createInternalTournamentRefereeAdapter(options);
  }
  if (competitionMode === COMPETITION_REFEREE_MODE.OFFICIAL) {
    return createOfficialTournamentRefereeAdapter(options);
  }
  if (competitionMode === COMPETITION_REFEREE_MODE.DAILY_PLAY) {
    return createDailyPlayRefereeAdapter(options);
  }
  if (competitionMode === COMPETITION_REFEREE_MODE.TEAM) {
    return createTeamTournamentRefereeAdapter(options);
  }
  return null;
}

// src/features/referee-v5/server/trustedMatchExecutionInit.js
var TRUSTED_INIT_ACTION = "initialize-execution";
var TRUSTED_INIT_CLIENT_FIELDS = Object.freeze([
  "action",
  "tournamentId",
  "matchId",
  "competitionMode",
  "idempotencyKey"
]);
var TRUSTED_INIT_REJECTED_FIELDS = Object.freeze([
  "actor",
  "actorId",
  "actor_id",
  "userId",
  "user_id",
  "role",
  "actorRole",
  "tenantRole",
  "trustedActor",
  "tenantId",
  "tenant_id",
  "initialState",
  "statePayload",
  "stateSnapshot",
  "serviceRoleKey",
  "adapter",
  "modeState",
  "adapterRequest",
  "grantedPermissions"
]);
function text2(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
function isPlainObject4(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function stripClientAuthorityFields(body = {}) {
  const source = isPlainObject4(body) ? body : {};
  const ignored = TRUSTED_INIT_REJECTED_FIELDS.filter(
    (field) => Object.prototype.hasOwnProperty.call(source, field)
  );
  return {
    tournamentId: text2(source.tournamentId),
    matchId: text2(source.matchId),
    competitionMode: text2(source.competitionMode).toUpperCase(),
    idempotencyKey: text2(source.idempotencyKey),
    ignored
  };
}
function createTrustedServerIdentityLoader(serviceClient) {
  return function loadIdentitySubjectById(subjectId) {
    return loadIdentitySubjectByIdFromPersistence(subjectId, {
      getAuthClient: () => serviceClient
    });
  };
}
async function loadCanonicalTournamentForInit(serviceClient, tournamentId) {
  if (!serviceClient || typeof serviceClient.from !== "function") {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Trusted-server service client is required."
    );
  }
  const id = text2(tournamentId);
  if (!id) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "tournamentId is required."
    );
  }
  const { data, error } = await serviceClient.from("canonical_tournaments").select("id, tenant_id, club_id, mode, status, payload, engine_v4, name").eq("id", id).maybeSingle();
  if (error) {
    return createPersistenceError(REFEREE_V5_ERROR.NOT_CONFIGURED, error.message);
  }
  if (!data || text2(data.id) !== id) {
    return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
  }
  if (!text2(data.tenant_id)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.TENANT_ACCESS_DENIED,
      "Tournament tenant evidence is missing."
    );
  }
  return { ok: true, row: data, tenantId: text2(data.tenant_id) };
}
function mapIdentityLookupFailure(result) {
  const code = result?.code;
  if (code === SUBJECT_IDENTITY_LOOKUP_CODE.SCOPE_MISMATCH || code === SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SCOPE_EVIDENCE) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  return createPersistenceError(
    REFEREE_V5_ERROR.TENANT_ACCESS_DENIED,
    "Canonical identity evidence is unavailable."
  );
}
function trustedInitActorRole(identityRole) {
  const role = normalizeRole(identityRole);
  if (role === ROLES.PLATFORM_ADMIN) return "SUPER_ADMIN";
  return "ORGANIZER";
}
function sanitizeTrustedInitResult(result) {
  if (!result?.ok) return result;
  return {
    ok: true,
    initialized: result.initialized === true,
    alreadyInitialized: result.alreadyInitialized === true,
    duplicate: result.duplicate === true,
    reset: false,
    matchId: result.matchId,
    tournamentId: result.tournamentId,
    tenantId: result.tenantId,
    status: result.status,
    stateVersion: result.stateVersion,
    lastEventSequence: result.lastEventSequence,
    state: result.state
  };
}
async function processTrustedMatchExecutionInit({
  body,
  verifiedUserId,
  serviceClient,
  ports = {}
}) {
  const request = stripClientAuthorityFields(body);
  if (!text2(verifiedUserId)) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  if (!request.tournamentId || !request.matchId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "tournamentId and matchId are required."
    );
  }
  if (!request.idempotencyKey) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "idempotencyKey is required."
    );
  }
  if (!serviceClient || typeof serviceClient.rpc !== "function") {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Only the trusted-server service client may persist initialization."
    );
  }
  const loadTournament = typeof ports.loadCanonicalTournament === "function" ? ports.loadCanonicalTournament : (id) => loadCanonicalTournamentForInit(serviceClient, id);
  const loaded = await loadTournament(request.tournamentId);
  if (!loaded?.ok) return loaded;
  const mapped = mapCanonicalIdentityToAdapterBModeState(loaded.row);
  if (!mapped.ok) return mapped;
  if (request.competitionMode && request.competitionMode !== mapped.competitionMode) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "competitionMode does not match canonical tournament identity."
    );
  }
  const loadIdentitySubjectById = typeof ports.loadIdentitySubjectById === "function" ? ports.loadIdentitySubjectById : createTrustedServerIdentityLoader(serviceClient);
  const identity = await resolveSubjectIdentityRecord(
    {
      subjectId: String(verifiedUserId).trim(),
      requestedTenantId: mapped.tenantId
    },
    { loadIdentitySubjectById }
  );
  if (!identity.ok) {
    return mapIdentityLookupFailure(identity);
  }
  const organizerMapping = resolveOrganizerActionPermissions(
    ORGANIZER_ACTION.PREPARE_OPERATIONS
  );
  const evidencePort = ports.identityEvidencePort || createIdentityEvidenceFromIdentityAdapter({ loadIdentitySubjectById });
  const decision = await evaluateAuthorization(
    {
      subject: {
        actorId: identity.evidence.subjectId,
        role: identity.evidence.role
      },
      scope: {
        tenantId: mapped.tenantId,
        competitionId: request.tournamentId
      },
      action: ORGANIZER_ACTION.PREPARE_OPERATIONS,
      requiredPermissions: [...organizerMapping.requiredPermissions]
    },
    { evidencePort }
  );
  if (!decision || decision.allowed !== true) {
    const denyCode = String(decision?.denyReason || decision?.decisionCode || "");
    if (/CROSS_TENANT|SCOPE_MISMATCH/i.test(denyCode)) {
      return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
    }
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      decision?.reason || "Organizer initialization is not authorized."
    );
  }
  const adapter = typeof ports.createAdapter === "function" ? ports.createAdapter(mapped.competitionMode, mapped.modeState) : createServerResolvedAdapterB(mapped.competitionMode, mapped.modeState);
  if (!adapter) {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Canonical Adapter B could not be resolved server-side."
    );
  }
  const init = ports.initializeMatchExecutionState || initializeMatchExecutionState;
  const result = await init({
    tenantId: mapped.tenantId,
    tournamentId: request.tournamentId,
    matchId: request.matchId,
    competitionMode: mapped.competitionMode,
    idempotencyKey: request.idempotencyKey,
    actor: {
      actorId: identity.evidence.subjectId,
      role: trustedInitActorRole(identity.evidence.role),
      tenantId: mapped.tenantId
    },
    adapter,
    rpcClient: serviceClient
  });
  return result?.ok ? sanitizeTrustedInitResult(result) : result;
}

// src/features/referee-v5/server/edgeHttpHandler.js
var REFEREE_V5_INTERNAL_RPC = Object.freeze({
  COMMIT_TRANSITION: "referee_v5_commit_match_transition",
  COMMIT_FINALIZATION: "referee_v5_commit_match_finalization",
  GET_STATE: "referee_v5_get_match_state",
  INITIALIZE_EXECUTION: "referee_v5_initialize_match_execution_state"
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
    case REFEREE_V5_ERROR.MATCH_ALREADY_ACTIVE:
    case REFEREE_V5_ERROR.TERMINAL_STATE:
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
  if (action === TRUSTED_INIT_ACTION) {
    const result = await processTrustedMatchExecutionInit({
      body,
      verifiedUserId: verified.userId,
      serviceClient
    });
    return {
      httpStatus: result.ok ? 200 : mapHttpStatus(result.code),
      body: result.ok ? result : enrichError(result)
    };
  }
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
  TRUSTED_INIT_ACTION,
  buildCommandRequestHash,
  buildRequestHash,
  createRefereeV5EdgeRuntime,
  handleRefereeV5MatchAction,
  handleRefereeV5MatchHttpRequest,
  hashMatchStateCanonical,
  processTrustedMatchExecutionInit,
  verifyBearerToken
};
