/* Competition CORE-13 assignment trusted server bundle */

// src/features/competition-engine/operations/referee/assignment/constants.js
var CORE13_ASSIGNMENT_COMMAND_VERSION = "core13-canonical-assignment-command-v1";
var COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION = "competition-referee-assignment";
var ASSIGNMENT_COMMAND = Object.freeze({
  ASSIGN: "assignReferee",
  REPLACE: "replaceReferee",
  UNASSIGN: "unassignReferee"
});
var ASSIGNMENT_COMMAND_VALUES = Object.freeze(
  Object.values(ASSIGNMENT_COMMAND)
);
var ASSIGNMENT_OPERATION = Object.freeze({
  ASSIGN: "ASSIGN",
  REPLACE: "REPLACE",
  UNASSIGN: "UNASSIGN"
});
var ASSIGNMENT_LIFECYCLE_STATE = Object.freeze({
  PRE_MATCH: "PRE_MATCH",
  IN_PROGRESS: "IN_PROGRESS",
  SCORING_ACTIVE: "SCORING_ACTIVE",
  LOCKED: "LOCKED",
  COMPLETED: "COMPLETED"
});
var ASSIGNMENT_LIFECYCLE_STATE_VALUES = Object.freeze(
  Object.values(ASSIGNMENT_LIFECYCLE_STATE)
);
var ASSIGNMENT_COMMAND_ERROR_CODE = Object.freeze({
  INVALID_INPUT: "CORE13_ASSIGNMENT_INVALID_INPUT",
  CANONICAL_REFEREE_ID_REQUIRED: "CORE13_CANONICAL_REFEREE_ID_REQUIRED",
  DISPLAY_NAME_IDENTITY_DENIED: "CORE13_DISPLAY_NAME_IDENTITY_DENIED",
  EMAIL_AS_AUTHORITY_DENIED: "CORE13_EMAIL_AS_AUTHORITY_DENIED",
  PHONE_AS_AUTHORITY_DENIED: "CORE13_PHONE_AS_AUTHORITY_DENIED",
  CROSS_TENANT_DENIED: "CORE13_CROSS_TENANT_DENIED",
  CROSS_TOURNAMENT_DENIED: "CORE13_CROSS_TOURNAMENT_DENIED",
  UNAUTHORIZED_ACTOR: "CORE13_UNAUTHORIZED_ACTOR",
  CLIENT_GRANT_TRUST_REJECTED: "CORE13_CLIENT_GRANT_TRUST_REJECTED",
  STALE_WRITE: "CORE13_STALE_WRITE",
  IDEMPOTENCY_CONFLICT: "CORE13_IDEMPOTENCY_CONFLICT",
  IDEMPOTENCY_KEY_REQUIRED: "CORE13_IDEMPOTENCY_KEY_REQUIRED",
  EXPECTED_VERSION_REQUIRED: "CORE13_EXPECTED_VERSION_REQUIRED",
  LIFECYCLE_DENIED: "CORE13_LIFECYCLE_DENIED",
  EMERGENCY_REPLACEMENT_REQUIRED: "CORE13_EMERGENCY_REPLACEMENT_REQUIRED",
  EMERGENCY_UNAUTHORIZED: "CORE13_EMERGENCY_UNAUTHORIZED",
  UNASSIGN_WITHOUT_REPLACEMENT_DENIED: "CORE13_UNASSIGN_WITHOUT_REPLACEMENT_DENIED",
  CORE13_VALIDATION_REJECTED: "CORE13_VALIDATION_REJECTED",
  PERSISTENCE_REQUIRED: "CORE13_PERSISTENCE_REQUIRED",
  IN_MEMORY_PRODUCTION_FORBIDDEN: "CORE13_IN_MEMORY_PRODUCTION_FORBIDDEN",
  SEED_BYPASS_DENIED: "CORE13_SEED_BYPASS_DENIED",
  DAILY_PLAY_NOT_APPLICABLE: "CORE13_DAILY_PLAY_NOT_APPLICABLE",
  FOREIGN_REFEREE_DENIED: "CORE13_FOREIGN_REFEREE_DENIED",
  STALE_TENANT_CONTEXT: "CORE13_STALE_TENANT_CONTEXT",
  STALE_CLUB_CONTEXT: "CORE13_STALE_CLUB_CONTEXT",
  NOT_CONFIGURED: "CORE13_NOT_CONFIGURED",
  SERVICE_ROLE_REQUIRED: "CORE13_SERVICE_ROLE_REQUIRED",
  ORIGINATING_ACTOR_REQUIRED: "CORE13_ORIGINATING_ACTOR_REQUIRED",
  CANONICAL_REFEREE_EVIDENCE_REQUIRED: "CORE13_CANONICAL_REFEREE_EVIDENCE_REQUIRED",
  TRUSTED_SERVER_REQUIRED: "CORE13_TRUSTED_SERVER_REQUIRED"
});
var ASSIGNMENT_COMMAND_ERROR_CODE_VALUES = Object.freeze(
  Object.values(ASSIGNMENT_COMMAND_ERROR_CODE)
);
var DURABLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION = "DURABLE";
var TEST_DOUBLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION = "TEST_DOUBLE_ONLY";
var ASSIGNMENT_COMPETITION_MODE = Object.freeze({
  INTERNAL: "INTERNAL",
  OFFICIAL_OPEN: "OFFICIAL_OPEN",
  TEAM: "TEAM",
  DAILY_PLAY: "DAILY_PLAY"
});

// src/features/competition-engine/operations/referee/assignment/errors.js
var CompetitionRefereeAssignmentCommandError = class extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CompetitionRefereeAssignmentCommandError";
    this.code = code;
    this.details = details && typeof details === "object" ? details : {};
  }
};
function isCompetitionRefereeAssignmentCommandError(err) {
  return err instanceof CompetitionRefereeAssignmentCommandError || err && typeof err === "object" && err.name === "CompetitionRefereeAssignmentCommandError" && typeof err.code === "string";
}
function failAssignmentCommand(code, message, details = {}) {
  throw new CompetitionRefereeAssignmentCommandError(
    code || ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
    message || "Assignment command failed",
    details
  );
}

// src/features/competition-engine/operations/referee/assignment/persistence/createRpcCanonicalAssignmentPersistence.js
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var COMPETITION_ASSIGNMENT_MUTATION_RPC = Object.freeze({
  ASSIGN: "competition_assign_referee",
  REPLACE: "competition_replace_referee",
  UNASSIGN: "competition_unassign_referee"
});
function toSqlRole(role) {
  const value = String(role || "PRIMARY").trim() || "PRIMARY";
  if (value === "PRIMARY") return "PRIMARY";
  return value;
}
function fromSqlRole(role) {
  const value = String(role || "").trim();
  if (!value || value === "REFEREE") return "PRIMARY";
  return value;
}
function requireUuid(value, label) {
  const id = String(value || "").trim();
  if (!UUID_RE.test(id)) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
      `${label} must be a canonical UUID`,
      { value: id }
    );
  }
  return id;
}
function mapRpcError(error) {
  const combined = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  const codeMap = [
    ["STALE_WRITE", ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE],
    ["EXPECTED_VERSION_REQUIRED", ASSIGNMENT_COMMAND_ERROR_CODE.EXPECTED_VERSION_REQUIRED],
    ["IDEMPOTENCY_CONFLICT", ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT],
    ["LIFECYCLE_DENIED", ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED],
    ["UNASSIGN_WITHOUT_REPLACEMENT_DENIED", ASSIGNMENT_COMMAND_ERROR_CODE.UNASSIGN_WITHOUT_REPLACEMENT_DENIED],
    ["EMERGENCY_REPLACEMENT_REQUIRED", ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_REPLACEMENT_REQUIRED],
    ["CROSS_TENANT_DENIED", ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED],
    ["CROSS_TOURNAMENT_DENIED", ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED],
    ["SERVICE_ROLE_REQUIRED", ASSIGNMENT_COMMAND_ERROR_CODE.SERVICE_ROLE_REQUIRED],
    ["ORIGINATING_ACTOR_REQUIRED", ASSIGNMENT_COMMAND_ERROR_CODE.ORIGINATING_ACTOR_REQUIRED],
    ["TOURNAMENT_FORBIDDEN", ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR]
  ];
  for (const [needle, code] of codeMap) {
    if (combined.includes(needle)) {
      failAssignmentCommand(code, combined.trim() || needle, { rpc: error });
    }
  }
  failAssignmentCommand(
    ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
    combined.trim() || "Assignment persistence RPC failed",
    { rpc: error }
  );
}
function mapRow(row) {
  if (!row) return null;
  return Object.freeze({
    assignmentId: String(row.id || row.assignmentId),
    tenantId: row.tenant_id || row.tenantId,
    tournamentId: row.tournament_id || row.tournamentId,
    matchId: row.match_id || row.matchId,
    refereeId: String(row.referee_user_id || row.refereeUserId || row.refereeId || ""),
    role: fromSqlRole(row.role),
    roleCode: fromSqlRole(row.role),
    status: row.status === "active" ? "active" : String(row.status || "revoked"),
    version: Number(row.version || 0),
    assignedAt: row.assigned_at || row.assignedAt || null,
    assignedBy: row.assigned_by || row.assignedBy || null
  });
}
function mapRpcResult(data, command) {
  const payload = data && typeof data === "object" ? data : {};
  const assignment = Object.freeze({
    assignmentId: payload.assignmentId || payload.assignment_id || null,
    tenantId: command.tenantId,
    tournamentId: command.tournamentId,
    matchId: payload.matchId || command.matchId,
    refereeId: payload.refereeUserId || payload.newRefereeUserId || command.refereeId || command.newRefereeId || null,
    role: fromSqlRole(payload.role || command.role),
    roleCode: fromSqlRole(payload.role || command.role),
    status: payload.status || (command.operation === "UNASSIGN" ? "revoked" : "active"),
    version: payload.version != null ? Number(payload.version) : null
  });
  return Object.freeze({
    ok: payload.ok !== false,
    replayed: payload.replayed === true,
    assignment,
    previousAssignment: payload.previousAssignmentId ? Object.freeze({ assignmentId: payload.previousAssignmentId }) : null,
    audit: payload.auditId ? Object.freeze({ auditId: payload.auditId }) : null
  });
}
function createRpcCanonicalAssignmentPersistence(options = {}) {
  const serviceClient = options.serviceClient;
  if (!serviceClient || typeof serviceClient.rpc !== "function") {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.PERSISTENCE_REQUIRED,
      "RPC assignment persistence requires a service-role Supabase client",
      {}
    );
  }
  async function rpc(name, args) {
    const { data, error } = await serviceClient.rpc(name, args);
    if (error) mapRpcError(error);
    return data;
  }
  return Object.freeze({
    kind: "rpc-canonical-assignment-persistence",
    classification: DURABLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
    durable: true,
    translationOnly: true,
    decisionAuthority: false,
    productUiDecisionPath: false,
    async getActiveAssignment({ tenantId, tournamentId, matchId, role = "PRIMARY" }) {
      const sqlRole = toSqlRole(role);
      const { data, error } = await serviceClient.from("referee_assignments").select("*").eq("tenant_id", tenantId).eq("tournament_id", tournamentId).eq("match_id", matchId).eq("status", "active").limit(20);
      if (error) mapRpcError(error);
      const rows = Array.isArray(data) ? data : [];
      const match = rows.find((row) => fromSqlRole(row.role) === fromSqlRole(sqlRole)) || rows.find((row) => String(row.role) === sqlRole) || null;
      return match ? mapRow(match) : null;
    },
    async listActiveAssignments({ tenantId, tournamentId } = {}) {
      let query = serviceClient.from("referee_assignments").select("*").eq("status", "active");
      if (tenantId) query = query.eq("tenant_id", tenantId);
      if (tournamentId) query = query.eq("tournament_id", tournamentId);
      const { data, error } = await query;
      if (error) mapRpcError(error);
      return Object.freeze((Array.isArray(data) ? data : []).map(mapRow));
    },
    async getMatchAssignmentVersion({ tenantId, tournamentId, matchId, role = "PRIMARY" }) {
      const sqlRole = toSqlRole(role);
      const { data, error } = await serviceClient.from("referee_assignments").select("version, status, role").eq("tenant_id", tenantId).eq("tournament_id", tournamentId).eq("match_id", matchId);
      if (error) mapRpcError(error);
      const rows = Array.isArray(data) ? data : [];
      const scoped = rows.filter(
        (row) => fromSqlRole(row.role) === fromSqlRole(sqlRole) || String(row.role) === sqlRole
      );
      const active = scoped.find((row) => row.status === "active");
      if (active) return Number(active.version || 0);
      return scoped.reduce((max, row) => Math.max(max, Number(row.version || 0)), 0);
    },
    async assign(command) {
      const refereeUserId = requireUuid(command.refereeId, "refereeId");
      const actorId = requireUuid(command.actorId, "actorId");
      const data = await rpc(COMPETITION_ASSIGNMENT_MUTATION_RPC.ASSIGN, {
        p_tenant_id: command.tenantId,
        p_tournament_id: command.tournamentId,
        p_match_id: command.matchId,
        p_referee_user_id: refereeUserId,
        p_role: toSqlRole(command.role || command.roleCode),
        p_expected_version: Number(command.expectedVersion),
        p_idempotency_key: String(command.idempotencyKey || ""),
        p_actor_id: actorId,
        p_reason: command.reason || null,
        p_lifecycle_state: null,
        p_command_metadata: {
          trustedServerBoundary: "competition-referee-assignment",
          originatingActorId: actorId
        }
      });
      return mapRpcResult(data, command);
    },
    async replace(command) {
      const newRefereeUserId = requireUuid(
        command.newRefereeId || command.refereeId,
        "newRefereeId"
      );
      const actorId = requireUuid(command.actorId, "actorId");
      const data = await rpc(COMPETITION_ASSIGNMENT_MUTATION_RPC.REPLACE, {
        p_tenant_id: command.tenantId,
        p_tournament_id: command.tournamentId,
        p_match_id: command.matchId,
        p_new_referee_user_id: newRefereeUserId,
        p_role: toSqlRole(command.role || command.roleCode),
        p_expected_version: Number(command.expectedVersion),
        p_idempotency_key: String(command.idempotencyKey || ""),
        p_actor_id: actorId,
        p_reason: command.reason || null,
        p_lifecycle_state: null,
        p_emergency_replacement: command.emergencyReplacement === true,
        p_command_metadata: {
          trustedServerBoundary: "competition-referee-assignment",
          originatingActorId: actorId
        }
      });
      return mapRpcResult(data, command);
    },
    async unassign(command) {
      const actorId = requireUuid(command.actorId, "actorId");
      const data = await rpc(COMPETITION_ASSIGNMENT_MUTATION_RPC.UNASSIGN, {
        p_tenant_id: command.tenantId,
        p_tournament_id: command.tournamentId,
        p_match_id: command.matchId,
        p_role: toSqlRole(command.role || command.roleCode),
        p_expected_version: Number(command.expectedVersion),
        p_idempotency_key: String(command.idempotencyKey || ""),
        p_actor_id: actorId,
        p_reason: command.reason || null,
        p_lifecycle_state: null,
        p_command_metadata: {
          trustedServerBoundary: "competition-referee-assignment",
          originatingActorId: actorId
        }
      });
      return mapRpcResult(data, command);
    }
  });
}

// src/features/competition-core/referee-assignment/constants/versions.js
var CORE13_ENGINE_ID = "competition-core-referee-assignment";
var CORE13_ENGINE_VERSION = "0.1.0-phase1b";
var CORE13_SCHEMA_VERSION = "CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1";
var CORE13_DETERMINISM_POLICY_ID = "CORE13_DETERMINISM_V1";
var CORE13_COMPARATOR_VERSION = "CORE13_COMPARATOR_V1";
var CORE13_IDENTITY = Object.freeze({
  engineId: CORE13_ENGINE_ID,
  version: CORE13_ENGINE_VERSION,
  schemaVersion: CORE13_SCHEMA_VERSION,
  determinismPolicyId: CORE13_DETERMINISM_POLICY_ID,
  comparatorVersion: CORE13_COMPARATOR_VERSION
});

// src/features/competition-core/referee-assignment/enums/roleCodes.js
var REFEREE_ROLE_CODE = Object.freeze({
  PRIMARY: "PRIMARY",
  ASSISTANT: "ASSISTANT",
  OBSERVER: "OBSERVER",
  ANY: "ANY"
});
var REFEREE_ROLE_CODE_VALUES = new Set(
  Object.values(REFEREE_ROLE_CODE)
);
function normalizeRefereeRoleCode(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// src/features/competition-core/referee-assignment/enums/assignmentStatus.js
var REFEREE_ASSIGNMENT_STATUS = Object.freeze({
  PLANNED: "PLANNED",
  CONFIRMED: "CONFIRMED",
  REPLACED: "REPLACED",
  RELEASED: "RELEASED"
});
var REFEREE_ASSIGNMENT_STATUS_VALUES = new Set(
  Object.values(REFEREE_ASSIGNMENT_STATUS)
);

// src/features/competition-core/referee-assignment/enums/assignmentSource.js
var REFEREE_ASSIGNMENT_SOURCE = Object.freeze({
  AUTO: "AUTO",
  MANUAL: "MANUAL",
  REPLACEMENT: "REPLACEMENT"
});
var REFEREE_ASSIGNMENT_SOURCE_VALUES = new Set(
  Object.values(REFEREE_ASSIGNMENT_SOURCE)
);

// src/features/competition-core/referee-assignment/enums/conflictType.js
var REFEREE_CONFLICT_TYPE = Object.freeze({
  OVERLAP: "OVERLAP",
  CONFLICT_OF_INTEREST: "CONFLICT_OF_INTEREST",
  EXCLUSION: "EXCLUSION",
  CAPACITY: "CAPACITY",
  ROLE_UNSUPPORTED: "ROLE_UNSUPPORTED",
  UNAVAILABLE: "UNAVAILABLE",
  INACTIVE: "INACTIVE",
  NOT_QUALIFIED: "NOT_QUALIFIED"
});
var REFEREE_CONFLICT_TYPE_VALUES = new Set(
  Object.values(REFEREE_CONFLICT_TYPE)
);

// src/features/competition-core/referee-assignment/enums/constraintKind.js
var REFEREE_CONSTRAINT_KIND = Object.freeze({
  HARD: "HARD",
  SOFT: "SOFT"
});
var REFEREE_CONSTRAINT_KIND_VALUES = new Set(
  Object.values(REFEREE_CONSTRAINT_KIND)
);

// src/features/competition-core/referee-assignment/enums/diagnosticSeverity.js
var REFEREE_DIAGNOSTIC_SEVERITY = Object.freeze({
  FATAL: "FATAL",
  MATCH_RECOVERABLE: "MATCH_RECOVERABLE",
  WARNING: "WARNING"
});
var REFEREE_DIAGNOSTIC_SEVERITY_VALUES = new Set(
  Object.values(REFEREE_DIAGNOSTIC_SEVERITY)
);

// src/features/competition-core/referee-assignment/enums/availabilitySource.js
var REFEREE_AVAILABILITY_SOURCE = Object.freeze({
  DIRECTORY: "DIRECTORY",
  TOURNAMENT: "TOURNAMENT",
  MANUAL: "MANUAL",
  DERIVED: "DERIVED"
});
var REFEREE_AVAILABILITY_SOURCE_VALUES = new Set(
  Object.values(REFEREE_AVAILABILITY_SOURCE)
);

// src/features/competition-core/referee-assignment/enums/auditAction.js
var REFEREE_AUDIT_ACTION = Object.freeze({
  ASSIGNED: "ASSIGNED",
  MANUAL_ASSIGNED: "MANUAL_ASSIGNED",
  REPLACED: "REPLACED",
  RELEASED: "RELEASED",
  REJECTED: "REJECTED",
  PLAN_GENERATED: "PLAN_GENERATED"
});
var REFEREE_AUDIT_ACTION_VALUES = new Set(
  Object.values(REFEREE_AUDIT_ACTION)
);

// src/features/competition-core/referee-assignment/enums/snapshotStatus.js
var REFEREE_SNAPSHOT_STATUS = Object.freeze({
  MISSING: "MISSING",
  INVALID: "INVALID",
  EMPTY: "EMPTY",
  POPULATED: "POPULATED"
});
var REFEREE_SNAPSHOT_STATUS_VALUES = new Set(
  Object.values(REFEREE_SNAPSHOT_STATUS)
);
var REFEREE_RESOURCE_TYPE = Object.freeze({
  REFEREE: "REFEREE"
});

// src/features/competition-core/referee-assignment/enums/softNotes.js
var REFEREE_SOFT_NOTE_CODE = Object.freeze({
  PREFERRED_TAG_MISSING: "PREFERRED_TAG_MISSING",
  PREFERRED_ROLE_MISMATCH: "PREFERRED_ROLE_MISMATCH",
  AFFILIATED_TEAM: "AFFILIATED_TEAM",
  AFFILIATED_CLUB: "AFFILIATED_CLUB",
  AFFILIATED_ORGANIZATION: "AFFILIATED_ORGANIZATION",
  WORKLOAD_ABOVE_PEER: "WORKLOAD_ABOVE_PEER",
  EXPERIENCE_BELOW_PREFERRED: "EXPERIENCE_BELOW_PREFERRED",
  DIVISION_UNFAMILIAR: "DIVISION_UNFAMILIAR",
  CONTINUITY_BREAK: "CONTINUITY_BREAK"
});
var REFEREE_SOFT_NOTE_CODE_VALUES = new Set(
  Object.values(REFEREE_SOFT_NOTE_CODE)
);
function isRefereeSoftNoteCode(value) {
  return typeof value === "string" && REFEREE_SOFT_NOTE_CODE_VALUES.has(value);
}
var REFEREE_SOFT_OBJECTIVE_KEY = Object.freeze({
  WORKLOAD_BALANCE: "WORKLOAD_BALANCE",
  CONSECUTIVE_MATCH_MINIMIZATION: "CONSECUTIVE_MATCH_MINIMIZATION",
  COURT_TRANSITION_MINIMIZATION: "COURT_TRANSITION_MINIMIZATION",
  ROLE_PREFERENCE: "ROLE_PREFERENCE",
  EXPERIENCE_PREFERENCE: "EXPERIENCE_PREFERENCE",
  DIVISION_FAMILIARITY: "DIVISION_FAMILIARITY",
  AFFILIATION_NEUTRALITY: "AFFILIATION_NEUTRALITY",
  ASSIGNMENT_CONTINUITY: "ASSIGNMENT_CONTINUITY"
});
var REFEREE_SOFT_OBJECTIVE_KEY_VALUES = new Set(
  Object.values(REFEREE_SOFT_OBJECTIVE_KEY)
);
function isRefereeSoftObjectiveKey(value) {
  return typeof value === "string" && REFEREE_SOFT_OBJECTIVE_KEY_VALUES.has(value);
}

// src/features/competition-core/referee-assignment/errors/diagnosticCodes.js
var REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE = Object.freeze({
  INVALID_ASSIGNMENT_REQUEST: "INVALID_ASSIGNMENT_REQUEST",
  TENANT_SCOPE_REQUIRED: "TENANT_SCOPE_REQUIRED",
  TOURNAMENT_SCOPE_REQUIRED: "TOURNAMENT_SCOPE_REQUIRED",
  MATCH_SCOPE_REQUIRED: "MATCH_SCOPE_REQUIRED",
  SCHEDULE_WINDOW_REQUIRED: "SCHEDULE_WINDOW_REQUIRED",
  NO_REFEREE_CANDIDATES: "NO_REFEREE_CANDIDATES",
  NO_ELIGIBLE_REFEREE: "NO_ELIGIBLE_REFEREE",
  REFEREE_NOT_FOUND: "REFEREE_NOT_FOUND",
  REFEREE_INACTIVE: "REFEREE_INACTIVE",
  REFEREE_NOT_QUALIFIED: "REFEREE_NOT_QUALIFIED",
  REFEREE_UNAVAILABLE: "REFEREE_UNAVAILABLE",
  REFEREE_ALREADY_ASSIGNED: "REFEREE_ALREADY_ASSIGNED",
  REFEREE_CONFLICT_OF_INTEREST: "REFEREE_CONFLICT_OF_INTEREST",
  REFEREE_ROLE_UNSUPPORTED: "REFEREE_ROLE_UNSUPPORTED",
  MANUAL_ASSIGNMENT_REJECTED: "MANUAL_ASSIGNMENT_REJECTED",
  REQUIRED_REFEREE_ROLE_UNFILLED: "REQUIRED_REFEREE_ROLE_UNFILLED",
  ASSIGNMENT_CAPACITY_EXHAUSTED: "ASSIGNMENT_CAPACITY_EXHAUSTED",
  NON_DETERMINISTIC_INPUT: "NON_DETERMINISTIC_INPUT",
  INVALID_REPLACEMENT_REQUEST: "INVALID_REPLACEMENT_REQUEST",
  REPLACEMENT_REFEREE_REJECTED: "REPLACEMENT_REFEREE_REJECTED",
  /** Port / snapshot missing (fatal). */
  SNAPSHOT_MISSING: "SNAPSHOT_MISSING",
  /** Port / snapshot invalid (fatal). */
  SNAPSHOT_INVALID: "SNAPSHOT_INVALID"
});
var REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE_VALUES = new Set(
  Object.values(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE)
);
function isRefereeAssignmentDiagnosticCode(value) {
  return typeof value === "string" && REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE_VALUES.has(value);
}

// src/features/competition-core/referee-assignment/errors/failureSemantics.js
var C = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE;
var S = REFEREE_DIAGNOSTIC_SEVERITY;
var REFEREE_DIAGNOSTIC_DEFAULT_SEVERITY = Object.freeze({
  [C.INVALID_ASSIGNMENT_REQUEST]: S.FATAL,
  [C.TENANT_SCOPE_REQUIRED]: S.FATAL,
  [C.TOURNAMENT_SCOPE_REQUIRED]: S.FATAL,
  [C.MATCH_SCOPE_REQUIRED]: S.FATAL,
  [C.SCHEDULE_WINDOW_REQUIRED]: S.MATCH_RECOVERABLE,
  [C.NO_REFEREE_CANDIDATES]: S.MATCH_RECOVERABLE,
  [C.NO_ELIGIBLE_REFEREE]: S.MATCH_RECOVERABLE,
  [C.REFEREE_NOT_FOUND]: S.MATCH_RECOVERABLE,
  [C.REFEREE_INACTIVE]: S.MATCH_RECOVERABLE,
  [C.REFEREE_NOT_QUALIFIED]: S.MATCH_RECOVERABLE,
  [C.REFEREE_UNAVAILABLE]: S.MATCH_RECOVERABLE,
  [C.REFEREE_ALREADY_ASSIGNED]: S.MATCH_RECOVERABLE,
  [C.REFEREE_CONFLICT_OF_INTEREST]: S.MATCH_RECOVERABLE,
  [C.REFEREE_ROLE_UNSUPPORTED]: S.MATCH_RECOVERABLE,
  [C.MANUAL_ASSIGNMENT_REJECTED]: S.FATAL,
  [C.REQUIRED_REFEREE_ROLE_UNFILLED]: S.MATCH_RECOVERABLE,
  [C.ASSIGNMENT_CAPACITY_EXHAUSTED]: S.MATCH_RECOVERABLE,
  [C.NON_DETERMINISTIC_INPUT]: S.FATAL,
  [C.INVALID_REPLACEMENT_REQUEST]: S.FATAL,
  [C.REPLACEMENT_REFEREE_REJECTED]: S.FATAL,
  [C.SNAPSHOT_MISSING]: S.FATAL,
  [C.SNAPSHOT_INVALID]: S.FATAL
});
function resolveDefaultDiagnosticSeverity(code) {
  return REFEREE_DIAGNOSTIC_DEFAULT_SEVERITY[code] || REFEREE_DIAGNOSTIC_SEVERITY.FATAL;
}

// src/features/competition-core/referee-assignment/errors/RefereeAssignmentContractError.js
var RefereeAssignmentContractError = class extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = "RefereeAssignmentContractError";
    this.code = String(code);
    this.details = details && typeof details === "object" && !Array.isArray(details) ? { ...details } : {};
  }
};

// src/features/competition-core/referee-assignment/deterministic/compare.js
function compareStableString(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  const len = Math.min(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const ca = left.charCodeAt(i);
    const cb = right.charCodeAt(i);
    if (ca !== cb) return ca - cb;
  }
  return left.length - right.length;
}

// src/features/competition-core/referee-assignment/deterministic/normalize.js
function normalizeStableId(value, field, code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RefereeAssignmentContractError(
      code,
      `${field} must be a non-empty stable string ID`,
      { field, value: value ?? null }
    );
  }
  return value.trim();
}
function normalizeOptionalStableId(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      `${field} must be a string ID or null`,
      { field, value }
    );
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
function normalizeStableIdArray(values, options = {}) {
  const field = options.field || "ids";
  if (values == null) return [];
  if (!Array.isArray(values)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      `${field} must be an array`,
      { field }
    );
  }
  const out = [];
  for (let i = 0; i < values.length; i += 1) {
    const item = values[i];
    if (item == null || item === "") continue;
    if (typeof item !== "string") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        `${field}[${i}] must be a string`,
        { field, index: i }
      );
    }
    const trimmed = item.trim();
    if (trimmed) out.push(trimmed);
  }
  let result = out;
  if (options.unique) {
    const seen = /* @__PURE__ */ new Set();
    result = [];
    for (const id of out) {
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
  }
  if (options.sort) {
    result = [...result].sort(compareStableString);
  }
  return result;
}
function normalizePreferenceTags(values, field = "preferenceTags") {
  return normalizeStableIdArray(values, { field, sort: true, unique: true });
}

// src/features/competition-core/referee-assignment/deterministic/canonicalize.js
function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  if (value instanceof Map) return false;
  if (value instanceof Set) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function rejectNonCanonical(value, path) {
  const type = value === null ? "null" : Array.isArray(value) ? "array" : value instanceof Date ? "Date" : value instanceof Map ? "Map" : value instanceof Set ? "Set" : typeof value;
  throw new RefereeAssignmentContractError(
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
    `Non-canonical value at ${path || "(root)"}: ${type}`,
    { path, type }
  );
}
function deepFreezeCanonical(value, path = "", seen = /* @__PURE__ */ new WeakSet()) {
  if (value === null) {
    return null;
  }
  const t = typeof value;
  if (t === "string" || t === "boolean") {
    return value;
  }
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        `Non-finite number at ${path || "(root)"}`,
        { path, value: String(value) }
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    rejectNonCanonical(value, path);
  }
  if (t !== "object") {
    rejectNonCanonical(value, path);
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    rejectNonCanonical(value, path);
  }
  if (seen.has(
    /** @type {object} */
    value
  )) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `Cyclic reference at ${path || "(root)"}`,
      { path }
    );
  }
  seen.add(
    /** @type {object} */
    value
  );
  if (Array.isArray(value)) {
    const out2 = value.map(
      (item, i) => deepFreezeCanonical(item, path ? `${path}[${i}]` : `[${i}]`, seen)
    );
    return Object.freeze(out2);
  }
  if (!isPlainObject(value)) {
    rejectNonCanonical(value, path);
  }
  const out = {};
  const keys = Object.keys(
    /** @type {Record<string, unknown>} */
    value
  ).sort(
    compareStableString
  );
  for (const key of keys) {
    out[key] = deepFreezeCanonical(
      /** @type {Record<string, unknown>} */
      value[key],
      path ? `${path}.${key}` : key,
      seen
    );
  }
  return Object.freeze(out);
}

// src/features/competition-core/referee-assignment/contracts/shared.js
function requireStableId(value, field, code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST) {
  return normalizeStableId(value, field, code);
}
function requireBoolean(value, field, code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST) {
  if (typeof value !== "boolean") {
    throw new RefereeAssignmentContractError(
      code,
      `${field} must be a boolean`,
      { field, value: value ?? null }
    );
  }
  return value;
}
function requireNonNegativeInt(value, field, code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RefereeAssignmentContractError(
      code,
      `${field} must be a non-negative integer`,
      { field, value: value ?? null }
    );
  }
  return value;
}
function rejectUnknownFields(obj, allowed, path, code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST) {
  if (!isPlainObject(obj)) {
    throw new RefereeAssignmentContractError(
      code,
      `${path} must be a plain object`,
      { path }
    );
  }
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(obj).filter((k) => !allowedSet.has(k));
  if (unknown.length > 0) {
    unknown.sort();
    throw new RefereeAssignmentContractError(
      code,
      `${path} has unknown fields: ${unknown.join(", ")}`,
      { path, unknown }
    );
  }
}
function ownedFreeze(value) {
  return (
    /** @type {T} */
    deepFreezeCanonical(value)
  );
}
function normalizeOptionalInstant(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${field} must be a string instant or null`,
      { field }
    );
  }
  if (value instanceof Date) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${field} must not be a Date object`,
      { field }
    );
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
function requireEnum(value, field, allowed, code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST) {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new RefereeAssignmentContractError(
      code,
      `${field} must be a known enum value`,
      { field, value: value ?? null }
    );
  }
  return value;
}
function normalizeMetadata(value, path = "metadata") {
  if (value == null) return ownedFreeze({});
  if (!isPlainObject(value)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${path} must be a plain object`,
      { path }
    );
  }
  return ownedFreeze(value);
}

// src/features/competition-core/referee-assignment/contracts/refereeCandidate.js
var ALLOWED = Object.freeze([
  "schemaVersion",
  "refereeId",
  "active",
  "userId",
  "playerId",
  "organizationIds",
  "clubIds",
  "qualificationRefs",
  "preferenceTags",
  "displayLabel",
  "metadata"
]);
var REFEREE_CANDIDATE_FORBIDDEN_PROFILE_FIELDS = Object.freeze([
  "name",
  "phone",
  "email",
  "password",
  "profile"
]);
function createRefereeCandidate(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */
    partial,
    ALLOWED,
    "RefereeCandidate"
  );
  const refereeId = requireStableId(
    partial.refereeId,
    "RefereeCandidate.refereeId",
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST
  );
  let displayLabel = null;
  if (partial.displayLabel != null && partial.displayLabel !== "") {
    if (typeof partial.displayLabel !== "string") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        "RefereeCandidate.displayLabel must be a string or null",
        { field: "displayLabel" }
      );
    }
    displayLabel = partial.displayLabel.trim() || null;
  }
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    refereeId,
    active: requireBoolean(
      partial.active === void 0 ? true : partial.active,
      "RefereeCandidate.active"
    ),
    userId: normalizeOptionalStableId(partial.userId, "RefereeCandidate.userId"),
    playerId: normalizeOptionalStableId(
      partial.playerId,
      "RefereeCandidate.playerId"
    ),
    organizationIds: Object.freeze(
      normalizeStableIdArray(partial.organizationIds, {
        field: "RefereeCandidate.organizationIds",
        sort: true,
        unique: true
      })
    ),
    clubIds: Object.freeze(
      normalizeStableIdArray(partial.clubIds, {
        field: "RefereeCandidate.clubIds",
        sort: true,
        unique: true
      })
    ),
    qualificationRefs: Object.freeze(
      normalizeStableIdArray(partial.qualificationRefs, {
        field: "RefereeCandidate.qualificationRefs",
        sort: true,
        unique: true
      })
    ),
    preferenceTags: Object.freeze(
      normalizePreferenceTags(
        partial.preferenceTags,
        "RefereeCandidate.preferenceTags"
      )
    ),
    displayLabel,
    metadata: normalizeMetadata(partial.metadata, "RefereeCandidate.metadata")
  });
}

// src/features/competition-core/referee-assignment/contracts/refereeQualification.js
var ALLOWED2 = Object.freeze([
  "schemaVersion",
  "qualificationId",
  "refereeId",
  "roleCode",
  "certificationCode",
  "validFrom",
  "validTo",
  "level",
  "tenantId",
  "tournamentId",
  "metadata"
]);

// src/features/competition-core/referee-assignment/contracts/refereeAvailabilityWindow.js
var ALLOWED3 = Object.freeze([
  "schemaVersion",
  "windowId",
  "refereeId",
  "startAt",
  "endAt",
  "timezone",
  "source",
  "metadata"
]);

// src/features/competition-core/referee-assignment/contracts/refereeRoleRequirement.js
var ALLOWED4 = Object.freeze([
  "schemaVersion",
  "roleCode",
  "mandatory",
  "minCount",
  "maxCount",
  "preferredRoleCode",
  "priority"
]);
function createRefereeRoleRequirement(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */
    partial,
    ALLOWED4,
    "RefereeRoleRequirement"
  );
  const roleCode = normalizeRefereeRoleCode(partial.roleCode);
  if (!roleCode) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "RefereeRoleRequirement.roleCode is required",
      { field: "roleCode" }
    );
  }
  const minCount = requireNonNegativeInt(
    partial.minCount === void 0 ? 1 : partial.minCount,
    "RefereeRoleRequirement.minCount"
  );
  const maxCount = requireNonNegativeInt(
    partial.maxCount === void 0 ? minCount : partial.maxCount,
    "RefereeRoleRequirement.maxCount"
  );
  if (maxCount < minCount) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "RefereeRoleRequirement.maxCount must be >= minCount",
      { minCount, maxCount }
    );
  }
  const preferredRoleCode = partial.preferredRoleCode == null || partial.preferredRoleCode === "" ? null : normalizeRefereeRoleCode(partial.preferredRoleCode);
  if (partial.preferredRoleCode != null && partial.preferredRoleCode !== "" && !preferredRoleCode) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "RefereeRoleRequirement.preferredRoleCode is invalid",
      { field: "preferredRoleCode" }
    );
  }
  let priority = null;
  if (partial.priority != null && partial.priority !== "") {
    if (typeof partial.priority !== "number" || !Number.isInteger(partial.priority) || !Number.isFinite(partial.priority)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        "RefereeRoleRequirement.priority must be a finite integer when present",
        { field: "priority" }
      );
    }
    priority = partial.priority;
  }
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    roleCode,
    mandatory: requireBoolean(
      partial.mandatory === void 0 ? true : partial.mandatory,
      "RefereeRoleRequirement.mandatory"
    ),
    minCount,
    maxCount,
    preferredRoleCode: preferredRoleCode ? preferredRoleCode : normalizeOptionalStableId(null, "preferredRoleCode"),
    priority
  });
}

// src/features/competition-core/referee-assignment/contracts/refereeAssignmentPolicy.js
var ALLOWED5 = Object.freeze([
  "schemaVersion",
  "policyId",
  "policyVersion",
  "defaultRoleRequirements",
  "allowSelfRefereed",
  "maxSimultaneousAssignments",
  "softObjectiveKeys",
  "allowSoftOverride",
  "requireScheduleWindowForMandatoryRoles",
  "allowSameRefereeMultipleRolesOnMatch",
  "enableSeededExploration",
  "requireSeed",
  "preferredConcreteRoles",
  "consecutiveGapMinutesThreshold",
  "comparatorVersion",
  "metadata"
]);
function createRefereeAssignmentPolicy(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */
    partial,
    ALLOWED5,
    "RefereeAssignmentPolicy"
  );
  const rawReqs = Array.isArray(partial.defaultRoleRequirements) ? partial.defaultRoleRequirements : [
    {
      roleCode: "PRIMARY",
      mandatory: true,
      minCount: 1,
      maxCount: 1
    }
  ];
  const defaultRoleRequirements = Object.freeze(
    rawReqs.map((item, index) => {
      try {
        return createRefereeRoleRequirement(item);
      } catch (err) {
        throw new RefereeAssignmentContractError(
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
          `RefereeAssignmentPolicy.defaultRoleRequirements[${index}] invalid`,
          {
            index,
            causeCode: err && typeof err === "object" && "code" in err ? (
              /** @type {{ code: string }} */
              err.code
            ) : null
          }
        );
      }
    })
  );
  const defaultObjectives = [
    REFEREE_SOFT_OBJECTIVE_KEY.WORKLOAD_BALANCE,
    REFEREE_SOFT_OBJECTIVE_KEY.CONSECUTIVE_MATCH_MINIMIZATION,
    REFEREE_SOFT_OBJECTIVE_KEY.COURT_TRANSITION_MINIMIZATION,
    REFEREE_SOFT_OBJECTIVE_KEY.ROLE_PREFERENCE
  ];
  const softObjectiveKeys = Object.freeze(
    (Array.isArray(partial.softObjectiveKeys) && partial.softObjectiveKeys.length > 0 ? partial.softObjectiveKeys : defaultObjectives).map((key, i) => {
      if (typeof key !== "string" || key.trim() === "") {
        throw new RefereeAssignmentContractError(
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
          `softObjectiveKeys[${i}] must be a non-empty string`,
          { index: i }
        );
      }
      const trimmed = key.trim();
      if (!isRefereeSoftObjectiveKey(trimmed)) {
        throw new RefereeAssignmentContractError(
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
          `Unsupported soft objective key: ${trimmed}`,
          { key: trimmed }
        );
      }
      return trimmed;
    })
  );
  const preferredConcreteRoles = Object.freeze(
    (Array.isArray(partial.preferredConcreteRoles) ? partial.preferredConcreteRoles : []).map((r) => normalizeRefereeRoleCode(r)).filter(Boolean)
  );
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    policyId: requireStableId(
      partial.policyId,
      "RefereeAssignmentPolicy.policyId"
    ),
    policyVersion: requireStableId(
      partial.policyVersion,
      "RefereeAssignmentPolicy.policyVersion"
    ),
    defaultRoleRequirements,
    allowSelfRefereed: requireBoolean(
      partial.allowSelfRefereed === void 0 ? false : partial.allowSelfRefereed,
      "RefereeAssignmentPolicy.allowSelfRefereed"
    ),
    maxSimultaneousAssignments: requireNonNegativeInt(
      partial.maxSimultaneousAssignments === void 0 ? 1 : partial.maxSimultaneousAssignments,
      "RefereeAssignmentPolicy.maxSimultaneousAssignments"
    ),
    softObjectiveKeys,
    allowSoftOverride: requireBoolean(
      partial.allowSoftOverride === void 0 ? false : partial.allowSoftOverride,
      "RefereeAssignmentPolicy.allowSoftOverride"
    ),
    requireScheduleWindowForMandatoryRoles: requireBoolean(
      partial.requireScheduleWindowForMandatoryRoles === void 0 ? true : partial.requireScheduleWindowForMandatoryRoles,
      "RefereeAssignmentPolicy.requireScheduleWindowForMandatoryRoles"
    ),
    allowSameRefereeMultipleRolesOnMatch: requireBoolean(
      partial.allowSameRefereeMultipleRolesOnMatch === void 0 ? false : partial.allowSameRefereeMultipleRolesOnMatch,
      "allowSameRefereeMultipleRolesOnMatch"
    ),
    enableSeededExploration: requireBoolean(
      partial.enableSeededExploration === void 0 ? false : partial.enableSeededExploration,
      "enableSeededExploration"
    ),
    requireSeed: requireBoolean(
      partial.requireSeed === void 0 ? false : partial.requireSeed,
      "requireSeed"
    ),
    preferredConcreteRoles,
    consecutiveGapMinutesThreshold: requireNonNegativeInt(
      partial.consecutiveGapMinutesThreshold === void 0 ? 30 : partial.consecutiveGapMinutesThreshold,
      "consecutiveGapMinutesThreshold"
    ),
    comparatorVersion: String(
      partial.comparatorVersion ?? CORE13_COMPARATOR_VERSION
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeAssignmentPolicy.metadata"
    )
  });
}

// src/features/competition-core/referee-assignment/contracts/refereeAssignmentContext.js
var ALLOWED6 = Object.freeze([
  "schemaVersion",
  "tenantId",
  "tournamentId",
  "divisionId",
  "scheduleWindow",
  "snapshotRefs",
  "matchIds",
  "metadata"
]);
var SNAPSHOT_REF_ALLOWED = Object.freeze([
  "snapshotId",
  "snapshotVersion",
  "fingerprint",
  "kind"
]);
var SCHEDULE_WINDOW_ALLOWED = Object.freeze([
  "startAt",
  "endAt",
  "timezone"
]);

// src/features/competition-core/referee-assignment/contracts/refereeAssignmentRequest.js
var ALLOWED7 = Object.freeze([
  "schemaVersion",
  "requestId",
  "tenantId",
  "tournamentId",
  "matchIds",
  "policy",
  "context",
  "seed",
  "allowSoftOverride",
  "metadata"
]);

// src/features/competition-core/referee-assignment/contracts/refereeConflict.js
var ALLOWED8 = Object.freeze([
  "schemaVersion",
  "conflictId",
  "conflictType",
  "refereeId",
  "matchId",
  "relatedMatchIds",
  "relatedIds",
  "severity",
  "reasonCodes",
  "startAt",
  "endAt",
  "metadata"
]);
function createRefereeConflict(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */
    partial,
    ALLOWED8,
    "RefereeConflict"
  );
  const reasonCodes = Object.freeze(
    normalizeStableIdArray(partial.reasonCodes, {
      field: "RefereeConflict.reasonCodes",
      sort: true,
      unique: true
    }).map((code) => {
      if (!isRefereeAssignmentDiagnosticCode(code) && typeof code === "string") {
        return code;
      }
      return code;
    })
  );
  for (const code of reasonCodes) {
    if (typeof code !== "string" || code.trim() === "") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        "reasonCodes must be non-empty strings",
        {}
      );
    }
  }
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    conflictId: requireStableId(partial.conflictId, "RefereeConflict.conflictId"),
    conflictType: requireEnum(
      partial.conflictType,
      "RefereeConflict.conflictType",
      REFEREE_CONFLICT_TYPE_VALUES
    ),
    refereeId: requireStableId(partial.refereeId, "RefereeConflict.refereeId"),
    matchId: requireStableId(
      partial.matchId,
      "RefereeConflict.matchId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED
    ),
    relatedMatchIds: Object.freeze(
      normalizeStableIdArray(partial.relatedMatchIds, {
        field: "relatedMatchIds",
        sort: true,
        unique: true
      })
    ),
    relatedIds: Object.freeze(
      normalizeStableIdArray(partial.relatedIds, {
        field: "relatedIds",
        sort: true,
        unique: true
      })
    ),
    severity: requireEnum(
      partial.severity ?? REFEREE_DIAGNOSTIC_SEVERITY.MATCH_RECOVERABLE,
      "RefereeConflict.severity",
      REFEREE_DIAGNOSTIC_SEVERITY_VALUES
    ),
    reasonCodes,
    startAt: normalizeOptionalInstant(partial.startAt, "RefereeConflict.startAt"),
    endAt: normalizeOptionalInstant(partial.endAt, "RefereeConflict.endAt"),
    metadata: normalizeMetadata(partial.metadata, "RefereeConflict.metadata")
  });
}

// src/features/competition-core/referee-assignment/contracts/refereeWorkload.js
var ALLOWED9 = Object.freeze([
  "schemaVersion",
  "refereeId",
  "assignmentCount",
  "confirmedAssignmentCount",
  "plannedAssignmentCount",
  "consecutiveMatchCount",
  "courtTransitionCount",
  "minutesAssigned",
  "fairnessDelta",
  "fairnessScale",
  "roleCounts",
  "historicalAssignmentCount",
  "metadata"
]);

// src/features/competition-core/referee-assignment/contracts/refereeAssignment.js
var ALLOWED10 = Object.freeze([
  "schemaVersion",
  "assignmentId",
  "matchId",
  "refereeId",
  "roleCode",
  "status",
  "source",
  "constraintsSatisfied",
  "metadata"
]);
function createRefereeAssignment(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */
    partial,
    ALLOWED10,
    "RefereeAssignment"
  );
  const roleCode = normalizeRefereeRoleCode(partial.roleCode);
  if (!roleCode || roleCode === REFEREE_ROLE_CODE.ANY) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "RefereeAssignment.roleCode must be a concrete role (ANY is not assignable)",
      { field: "roleCode", roleCode: roleCode || null }
    );
  }
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    assignmentId: requireStableId(
      partial.assignmentId,
      "RefereeAssignment.assignmentId"
    ),
    matchId: requireStableId(
      partial.matchId,
      "RefereeAssignment.matchId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED
    ),
    refereeId: requireStableId(
      partial.refereeId,
      "RefereeAssignment.refereeId"
    ),
    roleCode,
    status: requireEnum(
      partial.status ?? REFEREE_ASSIGNMENT_STATUS.PLANNED,
      "RefereeAssignment.status",
      REFEREE_ASSIGNMENT_STATUS_VALUES
    ),
    source: requireEnum(
      partial.source ?? REFEREE_ASSIGNMENT_SOURCE.AUTO,
      "RefereeAssignment.source",
      REFEREE_ASSIGNMENT_SOURCE_VALUES
    ),
    constraintsSatisfied: Object.freeze(
      normalizeStableIdArray(partial.constraintsSatisfied, {
        field: "constraintsSatisfied",
        sort: true,
        unique: true
      })
    ),
    metadata: normalizeMetadata(partial.metadata, "RefereeAssignment.metadata")
  });
}

// src/features/competition-core/referee-assignment/contracts/unassignedRefereeRequirement.js
var ALLOWED11 = Object.freeze([
  "schemaVersion",
  "matchId",
  "roleCode",
  "mandatory",
  "requiredCount",
  "assignedCount",
  "unfilledCount",
  "candidateCountEvaluated",
  "candidateCountEligible",
  "reasonCodes",
  "reasonCounts",
  "blockingConflicts",
  "evidenceRefs",
  "severity",
  "metadata"
]);

// src/features/competition-core/referee-assignment/contracts/refereeAssignmentFailure.js
var ALLOWED12 = Object.freeze([
  "schemaVersion",
  "code",
  "message",
  "severity",
  "details",
  "matchId",
  "refereeId",
  "causedBy",
  "reasonCodes"
]);
function createRefereeAssignmentFailure(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */
    partial,
    ALLOWED12,
    "RefereeAssignmentFailure"
  );
  const code = typeof partial.code === "string" && isRefereeAssignmentDiagnosticCode(partial.code) ? partial.code : null;
  if (!code) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "RefereeAssignmentFailure.code must be a known diagnostic code",
      { code: partial.code ?? null }
    );
  }
  const message = typeof partial.message === "string" && partial.message.trim() ? partial.message.trim() : code;
  const causedBy = partial.causedBy == null || partial.causedBy === "" ? null : typeof partial.causedBy === "string" && isRefereeAssignmentDiagnosticCode(partial.causedBy) ? partial.causedBy : typeof partial.causedBy === "string" && partial.causedBy.trim() ? partial.causedBy.trim() : (() => {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "causedBy must be a diagnostic code string or null",
      {}
    );
  })();
  const reasonCodes = Object.freeze(
    normalizeStableIdArray(partial.reasonCodes, {
      field: "reasonCodes",
      sort: true,
      unique: true
    })
  );
  if ((code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED || code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED) && !causedBy && reasonCodes.length === 0) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      `${code} requires causedBy or reasonCodes`,
      {}
    );
  }
  const severity = requireEnum(
    partial.severity ?? resolveDefaultDiagnosticSeverity(code),
    "RefereeAssignmentFailure.severity",
    REFEREE_DIAGNOSTIC_SEVERITY_VALUES
  );
  if (code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED && severity !== REFEREE_DIAGNOSTIC_SEVERITY.FATAL) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "MANUAL_ASSIGNMENT_REJECTED severity must be FATAL",
      { severity }
    );
  }
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    code,
    message,
    severity,
    details: normalizeMetadata(partial.details, "RefereeAssignmentFailure.details"),
    matchId: normalizeOptionalStableId(
      partial.matchId,
      "RefereeAssignmentFailure.matchId"
    ),
    refereeId: normalizeOptionalStableId(
      partial.refereeId,
      "RefereeAssignmentFailure.refereeId"
    ),
    causedBy,
    reasonCodes
  });
}
function createManualAssignmentRejection(underlyingCode, options = {}) {
  const causedBy = typeof underlyingCode === "string" && underlyingCode.trim() ? underlyingCode.trim() : null;
  if (!causedBy) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "underlying reason code required for manual rejection",
      {}
    );
  }
  return createRefereeAssignmentFailure({
    code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED,
    message: typeof options.message === "string" && options.message.trim() ? options.message.trim() : `Manual assignment rejected: ${causedBy}`,
    severity: REFEREE_DIAGNOSTIC_SEVERITY.FATAL,
    causedBy,
    reasonCodes: options.reasonCodes ?? [causedBy],
    matchId: options.matchId ?? null,
    refereeId: options.refereeId ?? null,
    details: options.details ?? {}
  });
}

// src/features/competition-core/referee-assignment/contracts/refereeAssignmentPlan.js
var ALLOWED13 = Object.freeze([
  "schemaVersion",
  "planId",
  "requestId",
  "assignments",
  "unassigned",
  "workloads",
  "diagnostics",
  "planFingerprint",
  "replayMetadata",
  "metadata"
]);

// src/features/competition-core/referee-assignment/contracts/manualRefereeAssignmentRequest.js
var ALLOWED14 = Object.freeze([
  "schemaVersion",
  "requestId",
  "tenantId",
  "tournamentId",
  "matchId",
  "refereeId",
  "roleCode",
  "actorRef",
  "allowSoftOverride",
  "metadata"
]);
function createManualRefereeAssignmentRequest(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */
    partial,
    ALLOWED14,
    "ManualRefereeAssignmentRequest"
  );
  const roleCode = normalizeRefereeRoleCode(partial.roleCode);
  if (!roleCode || roleCode === REFEREE_ROLE_CODE.ANY) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "ManualRefereeAssignmentRequest.roleCode must be a concrete role (ANY is not assignable)",
      { field: "roleCode", roleCode: roleCode || null }
    );
  }
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    requestId: requireStableId(
      partial.requestId,
      "ManualRefereeAssignmentRequest.requestId"
    ),
    tenantId: requireStableId(
      partial.tenantId,
      "ManualRefereeAssignmentRequest.tenantId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TENANT_SCOPE_REQUIRED
    ),
    tournamentId: requireStableId(
      partial.tournamentId,
      "ManualRefereeAssignmentRequest.tournamentId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TOURNAMENT_SCOPE_REQUIRED
    ),
    matchId: requireStableId(
      partial.matchId,
      "ManualRefereeAssignmentRequest.matchId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED
    ),
    refereeId: requireStableId(
      partial.refereeId,
      "ManualRefereeAssignmentRequest.refereeId"
    ),
    roleCode,
    actorRef: normalizeOptionalStableId(
      partial.actorRef,
      "ManualRefereeAssignmentRequest.actorRef"
    ),
    allowSoftOverride: requireBoolean(
      partial.allowSoftOverride === void 0 ? false : partial.allowSoftOverride,
      "ManualRefereeAssignmentRequest.allowSoftOverride"
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "ManualRefereeAssignmentRequest.metadata"
    )
  });
}

// src/features/competition-core/referee-assignment/contracts/refereeReplacementRequest.js
var ALLOWED15 = Object.freeze([
  "schemaVersion",
  "requestId",
  "tenantId",
  "tournamentId",
  "matchId",
  "roleCode",
  "assignmentId",
  "outgoingRefereeId",
  "incomingRefereeId",
  "reasonCode",
  "actorRef",
  "allowSoftOverride",
  "metadata"
]);
function createRefereeReplacementRequest(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */
    partial,
    ALLOWED15,
    "RefereeReplacementRequest"
  );
  const assignmentId = normalizeOptionalStableId(
    partial.assignmentId,
    "assignmentId"
  );
  const matchId = normalizeOptionalStableId(partial.matchId, "matchId");
  const roleCodeRaw = partial.roleCode;
  const roleCode = roleCodeRaw == null || roleCodeRaw === "" ? null : normalizeRefereeRoleCode(roleCodeRaw);
  if (!assignmentId && !(matchId && roleCode)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      "Replacement requires assignmentId or (matchId + roleCode)",
      { assignmentId, matchId, roleCode }
    );
  }
  if (roleCodeRaw != null && roleCodeRaw !== "" && !roleCode) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "RefereeReplacementRequest.roleCode is invalid",
      { field: "roleCode" }
    );
  }
  let reasonCode = null;
  if (partial.reasonCode != null && partial.reasonCode !== "") {
    if (typeof partial.reasonCode !== "string") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
        "reasonCode must be a string or null",
        {}
      );
    }
    reasonCode = partial.reasonCode.trim() || null;
  }
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    requestId: requireStableId(
      partial.requestId,
      "RefereeReplacementRequest.requestId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST
    ),
    tenantId: requireStableId(
      partial.tenantId,
      "RefereeReplacementRequest.tenantId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TENANT_SCOPE_REQUIRED
    ),
    tournamentId: requireStableId(
      partial.tournamentId,
      "RefereeReplacementRequest.tournamentId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TOURNAMENT_SCOPE_REQUIRED
    ),
    matchId,
    roleCode,
    assignmentId,
    outgoingRefereeId: normalizeOptionalStableId(
      partial.outgoingRefereeId,
      "outgoingRefereeId"
    ),
    incomingRefereeId: requireStableId(
      partial.incomingRefereeId,
      "RefereeReplacementRequest.incomingRefereeId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST
    ),
    reasonCode,
    actorRef: normalizeOptionalStableId(partial.actorRef, "actorRef"),
    allowSoftOverride: requireBoolean(
      partial.allowSoftOverride === void 0 ? false : partial.allowSoftOverride,
      "allowSoftOverride"
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeReplacementRequest.metadata"
    )
  });
}

// src/features/competition-core/referee-assignment/contracts/refereeReplacementResult.js
var ALLOWED16 = Object.freeze([
  "schemaVersion",
  "requestId",
  "ok",
  "outgoingAssignment",
  "incomingAssignment",
  "failure",
  "metadata"
]);

// src/features/competition-core/referee-assignment/contracts/refereeAssignmentAuditRecord.js
var ALLOWED17 = Object.freeze([
  "schemaVersion",
  "auditId",
  "action",
  "requestId",
  "planFingerprint",
  "beforeRef",
  "afterRef",
  "actorRef",
  "reasonCode",
  "recordedAt",
  "payload",
  "metadata"
]);
function createRefereeAssignmentAuditRecord(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */
    partial,
    ALLOWED17,
    "RefereeAssignmentAuditRecord"
  );
  let payload = null;
  if (partial.payload != null) {
    if (!isPlainObject(partial.payload)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        "payload must be a plain object or null",
        {}
      );
    }
    payload = ownedFreeze(partial.payload);
  }
  let reasonCode = null;
  if (partial.reasonCode != null && partial.reasonCode !== "") {
    if (typeof partial.reasonCode !== "string") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        "reasonCode must be a string or null",
        {}
      );
    }
    reasonCode = partial.reasonCode.trim() || null;
  }
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    auditId: requireStableId(
      partial.auditId,
      "RefereeAssignmentAuditRecord.auditId"
    ),
    action: requireEnum(
      partial.action,
      "RefereeAssignmentAuditRecord.action",
      REFEREE_AUDIT_ACTION_VALUES
    ),
    requestId: normalizeOptionalStableId(partial.requestId, "requestId"),
    planFingerprint: normalizeOptionalStableId(
      partial.planFingerprint,
      "planFingerprint"
    ),
    beforeRef: normalizeOptionalStableId(partial.beforeRef, "beforeRef"),
    afterRef: normalizeOptionalStableId(partial.afterRef, "afterRef"),
    actorRef: normalizeOptionalStableId(partial.actorRef, "actorRef"),
    reasonCode,
    recordedAt: normalizeOptionalInstant(
      partial.recordedAt,
      "RefereeAssignmentAuditRecord.recordedAt"
    ),
    payload,
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeAssignmentAuditRecord.metadata"
    )
  });
}

// src/features/competition-core/referee-assignment/contracts/refereeResourceConflictProjection.js
var ALLOWED18 = Object.freeze([
  "schemaVersion",
  "conflictId",
  "resourceType",
  "refereeId",
  "matchId",
  "conflictingMatchId",
  "conflictType",
  "startAt",
  "endAt",
  "severity",
  "reasonCodes",
  "metadata"
]);
function createRefereeResourceConflictProjection(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */
    partial,
    ALLOWED18,
    "RefereeResourceConflictProjection"
  );
  const resourceType = partial.resourceType ?? REFEREE_RESOURCE_TYPE.REFEREE;
  if (resourceType !== REFEREE_RESOURCE_TYPE.REFEREE) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "resourceType must be REFEREE for CORE-13 projections",
      { resourceType }
    );
  }
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    conflictId: requireStableId(
      partial.conflictId,
      "RefereeResourceConflictProjection.conflictId"
    ),
    resourceType: REFEREE_RESOURCE_TYPE.REFEREE,
    refereeId: requireStableId(
      partial.refereeId,
      "RefereeResourceConflictProjection.refereeId"
    ),
    matchId: requireStableId(
      partial.matchId,
      "RefereeResourceConflictProjection.matchId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED
    ),
    conflictingMatchId: normalizeOptionalStableId(
      partial.conflictingMatchId,
      "conflictingMatchId"
    ),
    conflictType: requireEnum(
      partial.conflictType,
      "RefereeResourceConflictProjection.conflictType",
      REFEREE_CONFLICT_TYPE_VALUES
    ),
    startAt: normalizeOptionalInstant(
      partial.startAt,
      "RefereeResourceConflictProjection.startAt"
    ),
    endAt: normalizeOptionalInstant(
      partial.endAt,
      "RefereeResourceConflictProjection.endAt"
    ),
    severity: requireEnum(
      partial.severity ?? REFEREE_DIAGNOSTIC_SEVERITY.MATCH_RECOVERABLE,
      "severity",
      REFEREE_DIAGNOSTIC_SEVERITY_VALUES
    ),
    reasonCodes: Object.freeze(
      normalizeStableIdArray(partial.reasonCodes, {
        field: "reasonCodes",
        sort: true,
        unique: true
      })
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeResourceConflictProjection.metadata"
    )
  });
}

// src/features/competition-core/referee-assignment/contracts/refereeEligibilityResult.js
function createHardFailure(partial = {}) {
  const code = String(partial.code || "");
  return ownedFreeze({
    code,
    severity: partial.severity || resolveDefaultDiagnosticSeverity(code) || REFEREE_DIAGNOSTIC_SEVERITY.MATCH_RECOVERABLE,
    constraintKind: REFEREE_CONSTRAINT_KIND.HARD,
    message: typeof partial.message === "string" && partial.message.trim() ? partial.message.trim() : code,
    details: ownedFreeze(
      partial.details && typeof partial.details === "object" ? partial.details : {}
    )
  });
}
function createSoftNote(partial = {}) {
  const code = String(partial.code || "");
  if (!isRefereeSoftNoteCode(code)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      `Unknown soft note code: ${code || "(empty)"}`,
      { code }
    );
  }
  return ownedFreeze({
    code,
    severity: REFEREE_DIAGNOSTIC_SEVERITY.WARNING,
    constraintKind: REFEREE_CONSTRAINT_KIND.SOFT,
    message: typeof partial.message === "string" && partial.message.trim() ? partial.message.trim() : code,
    details: ownedFreeze(
      partial.details && typeof partial.details === "object" ? partial.details : {}
    )
  });
}
function sortHardFailures(failures) {
  return [...failures || []].sort((a, b) => {
    const c = compareStableString(a.code, b.code);
    if (c !== 0) return c;
    return compareStableString(a.message, b.message);
  });
}
function collectReasonCodes(failures) {
  const set = /* @__PURE__ */ new Set();
  for (const f of failures || []) {
    if (f && typeof f.code === "string" && f.code) set.add(f.code);
  }
  return [...set].sort(compareStableString);
}
function createRefereeEligibilityResult(partial = {}) {
  const hardFailures = Object.freeze(
    sortHardFailures(partial.hardFailures || []).map(
      (f) => createHardFailure(f)
    )
  );
  const softNotes = Object.freeze(
    [...partial.softNotes || []].map((n) => createSoftNote(n)).sort((a, b) => {
      const c = compareStableString(a.code, b.code);
      if (c !== 0) return c;
      return compareStableString(a.message, b.message);
    })
  );
  const evaluatedConstraintKinds = Object.freeze(
    [...partial.evaluatedConstraintKinds || []].map(String).sort(compareStableString)
  );
  const evidenceRefs = Object.freeze(
    [...partial.evidenceRefs || []].map(String).filter(Boolean).sort(compareStableString)
  );
  const eligible = typeof partial.eligible === "boolean" ? partial.eligible : hardFailures.length === 0;
  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    refereeId: String(partial.refereeId || ""),
    matchId: String(partial.matchId || ""),
    roleCode: String(partial.roleCode || ""),
    eligible,
    hardFailures,
    softNotes,
    evaluatedConstraintKinds,
    evidenceRefs
  });
}

// src/features/competition-core/referee-assignment/deterministic/fingerprint.js
var CORE13_DIGEST_VERSION = "CORE13_DIGEST_SHA256_V1";
var CORE13_DIGEST_DOMAIN = Object.freeze({
  ASSIGNMENT: "CORE13:ASSIGNMENT:V1",
  PLAN: "CORE13:PLAN:V1",
  PLAN_FINGERPRINT: "CORE13:PLAN_FINGERPRINT:V1",
  REPLACEMENT: "CORE13:REPLACEMENT:V1",
  REPLACEMENT_RESULT: "CORE13:REPLACEMENT_RESULT:V1",
  AUDIT: "CORE13:AUDIT:V1",
  SNAPSHOT_DIRECTORY: "CORE13:SNAPSHOT:DIRECTORY:V1",
  SNAPSHOT_QUALIFICATION: "CORE13:SNAPSHOT:QUALIFICATION:V1",
  SNAPSHOT_AVAILABILITY: "CORE13:SNAPSHOT:AVAILABILITY:V1",
  SNAPSHOT_EXISTING_ASSIGNMENT: "CORE13:SNAPSHOT:EXISTING_ASSIGNMENT:V1",
  SNAPSHOT_SCHEDULE: "CORE13:SNAPSHOT:SCHEDULE:V1",
  SNAPSHOT_CONFLICT_POLICY: "CORE13:SNAPSHOT:CONFLICT_POLICY:V1",
  SNAPSHOT_WORKLOAD_HISTORY: "CORE13:SNAPSHOT:WORKLOAD_HISTORY:V1",
  SEED_EXPLORATION: "CORE13:SEED_EXPLORATION:V1",
  GENERIC: "CORE13:GENERIC:V1"
});
var CORE13_ID_PREFIX = Object.freeze({
  ASSIGNMENT: "core13_assignment_v1_",
  PLAN: "core13_plan_v1_",
  REPLACEMENT: "core13_replacement_v1_",
  AUDIT: "core13_audit_v1_"
});
var CORE13_ID_DIGEST_HEX_LEN = 32;
var textEncoder = new TextEncoder();
var SHA256_K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function sha256RightRotate(value, amount) {
  return value >>> amount | value << 32 - amount;
}
function sha256DigestBytes(message) {
  const msgLen = message.length;
  const bitLenHi = Math.floor(msgLen / 536870912);
  const bitLenLo = msgLen << 3 >>> 0;
  const padLen = msgLen % 64 < 56 ? 56 - msgLen % 64 : 120 - msgLen % 64;
  const totalLen = msgLen + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(message);
  padded[msgLen] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 8, bitLenHi, false);
  view.setUint32(totalLen - 4, bitLenLo, false);
  let h0 = 1779033703;
  let h1 = 3144134277;
  let h2 = 1013904242;
  let h3 = 2773480762;
  let h4 = 1359893119;
  let h5 = 2600822924;
  let h6 = 528734635;
  let h7 = 1541459225;
  const w = new Uint32Array(64);
  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = sha256RightRotate(w[i - 15], 7) ^ sha256RightRotate(w[i - 15], 18) ^ w[i - 15] >>> 3;
      const s1 = sha256RightRotate(w[i - 2], 17) ^ sha256RightRotate(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i += 1) {
      const s1 = sha256RightRotate(e, 6) ^ sha256RightRotate(e, 11) ^ sha256RightRotate(e, 25);
      const ch = e & f ^ ~e & g;
      const temp1 = h + s1 + ch + SHA256_K[i] + w[i] >>> 0;
      const s0 = sha256RightRotate(a, 2) ^ sha256RightRotate(a, 13) ^ sha256RightRotate(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const temp2 = s0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + temp1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2 >>> 0;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
    h5 = h5 + f >>> 0;
    h6 = h6 + g >>> 0;
    h7 = h7 + h >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}
function sha256HexUtf8(text) {
  const bytes = sha256DigestBytes(textEncoder.encode(String(text ?? "")));
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
function canonicalizeJsonValue(value, seen = /* @__PURE__ */ new WeakSet()) {
  if (value === null) return null;
  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        "Non-finite number in canonical serialization",
        { value: String(value) }
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `Unsupported type in canonical serialization: ${t}`,
      { type: t }
    );
  }
  if (t !== "object") {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "Unsupported value in canonical serialization",
      { type: t }
    );
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "Date/Map/Set forbidden in canonical serialization",
      {}
    );
  }
  if (seen.has(
    /** @type {object} */
    value
  )) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "Cyclic reference in canonical serialization",
      {}
    );
  }
  seen.add(
    /** @type {object} */
    value
  );
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item, seen));
  }
  if (!isPlainObject(value)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "Non-plain object in canonical serialization",
      {}
    );
  }
  const out = {};
  const keys = Object.keys(
    /** @type {Record<string, unknown>} */
    value
  ).sort(
    compareStableString
  );
  for (const key of keys) {
    const v = (
      /** @type {Record<string, unknown>} */
      value[key]
    );
    if (v === void 0) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        `Undefined value at key ${key}`,
        { key }
      );
    }
    out[key] = canonicalizeJsonValue(v, seen);
  }
  return out;
}
function serializeCanonical(value) {
  return JSON.stringify(canonicalizeJsonValue(value));
}
function digestCanonical(domain, payload) {
  if (typeof domain !== "string" || !domain.trim()) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "Digest domain required",
      {}
    );
  }
  const material = serializeCanonical({
    digestAlgorithmVersion: CORE13_DIGEST_VERSION,
    schemaVersion: CORE13_SCHEMA_VERSION,
    domain: domain.trim(),
    payload: canonicalizeJsonValue(payload)
  });
  const hex = sha256HexUtf8(material);
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "Fingerprint primitive unavailable",
      {}
    );
  }
  return hex;
}
function fingerprintValue(value, domain = CORE13_DIGEST_DOMAIN.GENERIC) {
  return digestCanonical(domain, value);
}
function buildNamespacedId(prefix, domain, payload) {
  const digest = digestCanonical(domain, payload);
  return `${prefix}${digest.slice(0, CORE13_ID_DIGEST_HEX_LEN)}`;
}
function buildReplacementId(facts) {
  return buildNamespacedId(
    CORE13_ID_PREFIX.REPLACEMENT,
    CORE13_DIGEST_DOMAIN.REPLACEMENT,
    {
      schemaVersion: facts.schemaVersion || CORE13_SCHEMA_VERSION,
      requestId: facts.requestId,
      tenantId: facts.tenantId,
      tournamentId: facts.tournamentId,
      matchId: facts.matchId,
      roleCode: facts.roleCode,
      slotIndex: facts.slotIndex ?? 0,
      refereeId: facts.refereeId,
      priorAssignmentId: facts.priorAssignmentId ?? null,
      source: facts.source
    }
  );
}

// src/features/competition-core/referee-assignment/ports/portResult.js
function createPortResolveResult(partial = {}) {
  const status = partial.status || REFEREE_SNAPSHOT_STATUS.MISSING;
  const ok = status === REFEREE_SNAPSHOT_STATUS.EMPTY || status === REFEREE_SNAPSHOT_STATUS.POPULATED;
  return Object.freeze({
    ok,
    status,
    code: partial.code ?? null,
    severity: partial.severity ?? (ok ? null : REFEREE_DIAGNOSTIC_SEVERITY.FATAL),
    message: partial.message ?? null,
    items: Object.freeze(Array.isArray(partial.items) ? [...partial.items] : []),
    details: Object.freeze(
      partial.details && typeof partial.details === "object" ? { ...partial.details } : {}
    )
  });
}
function createMissingSnapshotResult(message, details = {}) {
  return createPortResolveResult({
    status: REFEREE_SNAPSHOT_STATUS.MISSING,
    code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING,
    severity: REFEREE_DIAGNOSTIC_SEVERITY.FATAL,
    message: message || "Required snapshot missing",
    items: [],
    details
  });
}
function createEmptySnapshotResult(message = "Valid empty snapshot") {
  return createPortResolveResult({
    status: REFEREE_SNAPSHOT_STATUS.EMPTY,
    code: null,
    severity: null,
    message,
    items: []
  });
}
function createPopulatedSnapshotResult(items, message = "Snapshot populated") {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return createEmptySnapshotResult(message);
  }
  return createPortResolveResult({
    status: REFEREE_SNAPSHOT_STATUS.POPULATED,
    code: null,
    severity: null,
    message,
    items: list
  });
}

// src/features/competition-core/referee-assignment/ports/refereeDirectoryPort.js
var REFEREE_DIRECTORY_PORT_METHODS = Object.freeze([
  "resolveRefereeDirectory"
]);

// src/features/competition-core/referee-assignment/ports/refereeQualificationPort.js
var REFEREE_QUALIFICATION_PORT_METHODS = Object.freeze([
  "resolveRefereeQualifications"
]);

// src/features/competition-core/referee-assignment/ports/refereeAvailabilityPort.js
var REFEREE_AVAILABILITY_PORT_METHODS = Object.freeze([
  "resolveRefereeAvailability"
]);

// src/features/competition-core/referee-assignment/ports/existingAssignmentPort.js
var EXISTING_ASSIGNMENT_PORT_METHODS = Object.freeze([
  "resolveExistingAssignments"
]);

// src/features/competition-core/referee-assignment/ports/refereeConflictPolicyPort.js
var REFEREE_CONFLICT_POLICY_PORT_METHODS = Object.freeze([
  "resolveConflictPolicy"
]);

// src/features/competition-core/referee-assignment/ports/matchScheduleInputPort.js
var MATCH_SCHEDULE_INPUT_PORT_METHODS = Object.freeze([
  "resolveMatchSchedule"
]);
function createMatchScheduleRow(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "Match schedule row must be a plain object",
      {}
    );
  }
  return ownedFreeze({
    matchId: normalizeStableId(partial.matchId, "matchId"),
    startAt: normalizeOptionalInstant(partial.startAt, "startAt"),
    endAt: normalizeOptionalInstant(partial.endAt, "endAt"),
    courtId: partial.courtId == null || partial.courtId === "" ? null : normalizeStableId(partial.courtId, "courtId"),
    divisionId: partial.divisionId == null || partial.divisionId === "" ? null : normalizeStableId(partial.divisionId, "divisionId"),
    participantRefs: Object.freeze(
      Array.isArray(partial.participantRefs) ? partial.participantRefs.map((id) => String(id).trim()).filter(Boolean) : []
    ),
    teamRefs: Object.freeze(
      Array.isArray(partial.teamRefs) ? partial.teamRefs.map((id) => String(id).trim()).filter(Boolean) : []
    ),
    clubIds: Object.freeze(
      Array.isArray(partial.clubIds) ? partial.clubIds.map((id) => String(id).trim()).filter(Boolean) : []
    )
  });
}

// src/features/competition-core/referee-assignment/ports/refereeAuditSinkPort.js
var REFEREE_AUDIT_SINK_PORT_METHODS = Object.freeze(["appendAuditRecord"]);

// src/features/competition-core/referee-assignment/ports/refereeWorkloadHistoryPort.js
var REFEREE_WORKLOAD_HISTORY_PORT_METHODS = Object.freeze([
  "resolveWorkloadHistory"
]);

// src/features/competition-core/referee-assignment/services/timeModel.js
function parseInstantMs(value, field) {
  if (value instanceof Date) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${field} must be an instant string, not a Date object`,
      { field }
    );
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED,
      `${field} must be a non-empty instant string`,
      { field, value: value ?? null }
    );
  }
  const trimmed = value.trim();
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${field} is not a valid instant`,
      { field, value: trimmed }
    );
  }
  return ms;
}
function requireHalfOpenWindow(startAt, endAt, label = "window") {
  if (startAt == null || startAt === "" || endAt == null || endAt === "") {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED,
      `${label} requires startAt and endAt`,
      { startAt: startAt ?? null, endAt: endAt ?? null }
    );
  }
  const startMs = parseInstantMs(startAt, `${label}.startAt`);
  const endMs = parseInstantMs(endAt, `${label}.endAt`);
  if (!(endMs > startMs)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      `${label}.endAt must be strictly greater than startAt`,
      { startAt, endAt }
    );
  }
  return {
    startAt: String(startAt).trim(),
    endAt: String(endAt).trim(),
    startMs,
    endMs
  };
}
function tryHalfOpenWindow(startAt, endAt, label = "window") {
  if (startAt == null || startAt === "" || endAt == null || endAt === "") {
    return null;
  }
  return requireHalfOpenWindow(startAt, endAt, label);
}
function intervalsOverlapHalfOpen(aStartMs, aEndMs, bStartMs, bEndMs) {
  return aStartMs < bEndMs && bStartMs < aEndMs;
}
function windowFullyCovers(cStartMs, cEndMs, rStartMs, rEndMs) {
  return cStartMs <= rStartMs && cEndMs >= rEndMs;
}

// src/features/competition-core/referee-assignment/services/conflictPolicyNormalize.js
function normalizeConflictPolicy(policy) {
  const raw = isPlainObject(policy) ? policy : {};
  const matchExclusions = [];
  const rawExclusions = Array.isArray(raw.matchExclusions) ? raw.matchExclusions : [];
  for (const item of rawExclusions) {
    if (typeof item === "string" && item.includes(":")) {
      const [refereeId, matchId] = item.split(":");
      if (refereeId && matchId) {
        matchExclusions.push({
          refereeId: refereeId.trim(),
          matchId: matchId.trim()
        });
      }
    } else if (isPlainObject(item) && item.refereeId && item.matchId) {
      matchExclusions.push({
        refereeId: String(item.refereeId).trim(),
        matchId: String(item.matchId).trim()
      });
    }
  }
  matchExclusions.sort((a, b) => {
    const c = compareStableString(a.refereeId, b.refereeId);
    if (c !== 0) return c;
    return compareStableString(a.matchId, b.matchId);
  });
  const sortIds = (arr) => [...Array.isArray(arr) ? arr : []].map((id) => String(id).trim()).filter(Boolean).sort(compareStableString);
  return ownedFreeze({
    policyId: String(raw.policyId || "default-conflict-policy"),
    /** Participant/player COI — hard by default */
    prohibitSamePlayerId: raw.prohibitSamePlayerId !== false,
    prohibitSelfReferee: raw.prohibitSelfReferee !== false,
    /** General affiliation intersection — hard only when true (default false) */
    disallowAffiliatedTeamReferee: raw.disallowAffiliatedTeamReferee === true,
    disallowAffiliatedClubReferee: raw.disallowAffiliatedClubReferee === true,
    disallowAffiliatedOrganizationReferee: raw.disallowAffiliatedOrganizationReferee === true,
    /** When affiliation is not hard, emit soft notes if true (default true) */
    softAffiliationAwareness: raw.softAffiliationAwareness !== false,
    excludedRefereeIds: Object.freeze(sortIds(raw.excludedRefereeIds)),
    prohibitedTeamIds: Object.freeze(sortIds(raw.prohibitedTeamIds)),
    prohibitedClubIds: Object.freeze(sortIds(raw.prohibitedClubIds)),
    prohibitedOrganizationIds: Object.freeze(
      sortIds(raw.prohibitedOrganizationIds)
    ),
    matchExclusions: Object.freeze(matchExclusions)
  });
}
function isActiveAssignmentStatus(status) {
  return status === "PLANNED" || status === "CONFIRMED";
}

// src/features/competition-core/referee-assignment/services/detectRefereeConflicts.js
function buildConflictId(parts) {
  return parts.map((p) => String(p ?? "")).join("::");
}
function detectRefereeConflicts(input = {}) {
  const refereeId = String(input.refereeId || "").trim();
  const match = input.match && typeof input.match === "object" ? input.match : {};
  const matchId = String(match.matchId || input.matchId || "").trim();
  const roleCode = input.roleCode == null || input.roleCode === "" ? "" : String(input.roleCode).trim();
  const candidate = input.candidate && typeof input.candidate === "object" ? input.candidate : null;
  const policy = normalizeConflictPolicy(input.conflictPolicy);
  const assignmentPolicy = input.policy && typeof input.policy === "object" ? input.policy : {};
  const allowSelfRefereed = assignmentPolicy.allowSelfRefereed === true;
  const existingAssignments = Array.isArray(input.existingAssignments) ? input.existingAssignments : [];
  const scheduleByMatchId = buildScheduleIndex(input.scheduleRows);
  const candidateTeamIds = normalizeIdList(
    input.candidateTeamIds ?? candidate?.teamIds
  );
  const conflicts = [];
  const softNotes = [];
  if (!refereeId || !matchId) {
    return ownedFreeze({
      schemaVersion: CORE13_SCHEMA_VERSION,
      conflicts: Object.freeze([]),
      projections: Object.freeze([]),
      softNotes: Object.freeze([])
    });
  }
  if (policy.excludedRefereeIds.includes(refereeId)) {
    conflicts.push(
      makeConflict({
        conflictType: REFEREE_CONFLICT_TYPE.EXCLUSION,
        refereeId,
        matchId,
        roleCode,
        reasonCodes: [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST],
        details: { kind: "excluded_referee" }
      })
    );
  }
  for (const ex of policy.matchExclusions) {
    if (ex.refereeId === refereeId && ex.matchId === matchId) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.EXCLUSION,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
          ],
          details: { kind: "referee_match_exclusion" }
        })
      );
    }
  }
  const participantRefs = normalizeIdList(match.participantRefs);
  const playerId = candidate?.playerId ? String(candidate.playerId).trim() : "";
  if (policy.prohibitSamePlayerId && playerId && participantRefs.includes(playerId)) {
    conflicts.push(
      makeConflict({
        conflictType: REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST,
        refereeId,
        matchId,
        roleCode,
        reasonCodes: [
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
        ],
        details: { kind: "referee_is_participant", playerId }
      })
    );
  }
  if (!allowSelfRefereed && policy.prohibitSelfReferee && playerId && participantRefs.includes(playerId)) {
    if (!policy.prohibitSamePlayerId) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
          ],
          details: { kind: "self_referee_forbidden", playerId }
        })
      );
    }
  }
  const matchTeamRefs = normalizeIdList(match.teamRefs);
  for (const teamId of candidateTeamIds) {
    if (policy.prohibitedTeamIds.includes(teamId)) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
          ],
          details: { kind: "prohibited_team", teamId },
          relatedIds: [teamId]
        })
      );
    }
  }
  for (const teamId of candidateTeamIds) {
    if (!matchTeamRefs.includes(teamId)) continue;
    if (policy.disallowAffiliatedTeamReferee) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
          ],
          details: { kind: "affiliated_team", teamId },
          relatedIds: [teamId]
        })
      );
    } else if (policy.softAffiliationAwareness) {
      softNotes.push({
        code: "AFFILIATED_TEAM",
        details: { teamId }
      });
    }
  }
  const candidateClubIds = normalizeIdList(candidate?.clubIds);
  const matchClubIds = normalizeIdList(match.clubIds);
  for (const clubId of candidateClubIds) {
    if (policy.prohibitedClubIds.includes(clubId)) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
          ],
          details: { kind: "prohibited_club", clubId },
          relatedIds: [clubId]
        })
      );
    } else if (matchClubIds.includes(clubId)) {
      if (policy.disallowAffiliatedClubReferee) {
        conflicts.push(
          makeConflict({
            conflictType: REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST,
            refereeId,
            matchId,
            roleCode,
            reasonCodes: [
              REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
            ],
            details: { kind: "affiliated_club", clubId },
            relatedIds: [clubId]
          })
        );
      } else if (policy.softAffiliationAwareness) {
        softNotes.push({
          code: "AFFILIATED_CLUB",
          details: { clubId }
        });
      }
    }
  }
  const candidateOrgIds = normalizeIdList(candidate?.organizationIds);
  const matchOrgIds = normalizeIdList(match.organizationIds);
  for (const orgId of candidateOrgIds) {
    if (policy.prohibitedOrganizationIds.includes(orgId)) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
          ],
          details: { kind: "prohibited_organization", orgId },
          relatedIds: [orgId]
        })
      );
    } else if (matchOrgIds.includes(orgId)) {
      if (policy.disallowAffiliatedOrganizationReferee) {
        conflicts.push(
          makeConflict({
            conflictType: REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST,
            refereeId,
            matchId,
            roleCode,
            reasonCodes: [
              REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST
            ],
            details: { kind: "affiliated_organization", orgId },
            relatedIds: [orgId]
          })
        );
      } else if (policy.softAffiliationAwareness) {
        softNotes.push({
          code: "AFFILIATED_ORGANIZATION",
          details: { orgId }
        });
      }
    }
  }
  const roleMaxCount = typeof input.roleMaxCount === "number" && Number.isInteger(input.roleMaxCount) && input.roleMaxCount >= 0 ? input.roleMaxCount : 1;
  if (roleCode) {
    const sameRoleActives = existingAssignments.filter(
      (asg) => asg && typeof asg === "object" && String(asg.matchId) === matchId && isActiveAssignmentStatus(asg.status) && String(asg.roleCode) === roleCode
    );
    if (sameRoleActives.some((asg) => String(asg.refereeId) === refereeId)) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.CAPACITY,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED
          ],
          details: { kind: "duplicate_role_same_referee" }
        })
      );
    }
    const others = sameRoleActives.filter(
      (asg) => String(asg.refereeId) !== refereeId
    );
    if (others.length >= roleMaxCount) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.CAPACITY,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.ASSIGNMENT_CAPACITY_EXHAUSTED
          ],
          details: {
            kind: "duplicate_role_other_referee",
            otherRefereeId: String(others[0].refereeId),
            roleMaxCount,
            sameRoleActiveCount: others.length
          },
          relatedIds: others.map((a) => String(a.refereeId)).sort(compareStableString)
        })
      );
    }
  }
  const targetWindow = tryHalfOpenWindow(match.startAt, match.endAt, "match");
  if (targetWindow) {
    for (const asg of existingAssignments) {
      if (!asg || typeof asg !== "object") continue;
      if (String(asg.refereeId) !== refereeId) continue;
      if (!isActiveAssignmentStatus(asg.status || REFEREE_ASSIGNMENT_STATUS.PLANNED))
        continue;
      const otherMatchId = String(asg.matchId || "");
      if (!otherMatchId || otherMatchId === matchId) continue;
      const other = scheduleByMatchId.get(otherMatchId) || (asg.startAt && asg.endAt ? { startAt: asg.startAt, endAt: asg.endAt, matchId: otherMatchId } : null);
      if (!other) continue;
      const otherWindow = tryHalfOpenWindow(
        other.startAt,
        other.endAt,
        "otherMatch"
      );
      if (!otherWindow) continue;
      if (intervalsOverlapHalfOpen(
        targetWindow.startMs,
        targetWindow.endMs,
        otherWindow.startMs,
        otherWindow.endMs
      )) {
        conflicts.push(
          makeConflict({
            conflictType: REFEREE_CONFLICT_TYPE.OVERLAP,
            refereeId,
            matchId,
            conflictingMatchId: otherMatchId,
            roleCode,
            startAt: targetWindow.startAt,
            endAt: targetWindow.endAt,
            reasonCodes: [
              REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED
            ],
            details: { kind: "schedule_overlap", otherMatchId },
            relatedMatchIds: [otherMatchId]
          })
        );
      }
    }
  }
  const sorted = dedupeAndSortConflicts(conflicts);
  const projections = sorted.filter(
    (c) => c.conflictType === REFEREE_CONFLICT_TYPE.OVERLAP || c.conflictType === REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST || c.conflictType === REFEREE_CONFLICT_TYPE.EXCLUSION
  ).map(
    (c) => createRefereeResourceConflictProjection({
      conflictId: `proj::${c.conflictId}`,
      refereeId: c.refereeId,
      matchId: c.matchId,
      conflictingMatchId: c.relatedMatchIds?.[0] || null,
      conflictType: c.conflictType,
      startAt: c.startAt,
      endAt: c.endAt,
      severity: c.severity,
      reasonCodes: [...c.reasonCodes]
    })
  );
  return ownedFreeze({
    schemaVersion: CORE13_SCHEMA_VERSION,
    conflicts: Object.freeze(sorted),
    projections: Object.freeze(projections),
    softNotes: Object.freeze(
      softNotes.map(
        (n) => ownedFreeze({
          code: String(n.code),
          details: ownedFreeze(n.details || {})
        })
      )
    )
  });
}
function makeConflict({
  conflictType,
  refereeId,
  matchId,
  roleCode = "",
  conflictingMatchId = "",
  reasonCodes,
  details = {},
  relatedIds = [],
  relatedMatchIds = [],
  startAt = null,
  endAt = null
}) {
  const conflictId = buildConflictId([
    conflictType,
    matchId,
    refereeId,
    conflictingMatchId || relatedMatchIds[0] || "",
    roleCode || "",
    details.kind || ""
  ]);
  return createRefereeConflict({
    conflictId,
    conflictType,
    refereeId,
    matchId,
    relatedMatchIds: relatedMatchIds.length ? relatedMatchIds : conflictingMatchId ? [conflictingMatchId] : [],
    relatedIds,
    severity: REFEREE_DIAGNOSTIC_SEVERITY.MATCH_RECOVERABLE,
    reasonCodes,
    startAt,
    endAt,
    metadata: details
  });
}
function dedupeAndSortConflicts(conflicts) {
  const byId = /* @__PURE__ */ new Map();
  for (const c of conflicts) {
    if (!byId.has(c.conflictId)) byId.set(c.conflictId, c);
  }
  return [...byId.values()].sort((a, b) => {
    let c = compareStableString(a.matchId, b.matchId);
    if (c !== 0) return c;
    c = compareStableString(a.refereeId, b.refereeId);
    if (c !== 0) return c;
    c = compareStableString(a.conflictType, b.conflictType);
    if (c !== 0) return c;
    const aOther = a.relatedMatchIds?.[0] || "";
    const bOther = b.relatedMatchIds?.[0] || "";
    c = compareStableString(aOther, bOther);
    if (c !== 0) return c;
    const aRole = a.metadata?.kind || "";
    const bRole = b.metadata?.kind || "";
    c = compareStableString(aRole, bRole);
    if (c !== 0) return c;
    return compareStableString(a.conflictId, b.conflictId);
  });
}
function normalizeIdList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].sort(
    compareStableString
  );
}
function buildScheduleIndex(rows) {
  const map = /* @__PURE__ */ new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const id = String(row.matchId || "").trim();
    if (id) map.set(id, row);
  }
  return map;
}

// src/features/competition-core/referee-assignment/services/evaluateRefereeEligibility.js
function evaluateRefereeEligibility(input = {}) {
  const hardFailures = [];
  const softNotes = [];
  const evaluated = [];
  const evidenceRefs = [];
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const match = input.match && typeof input.match === "object" ? input.match : {};
  const matchId = String(match.matchId || input.matchId || "").trim();
  const roleCode = String(input.roleCode || "").trim();
  const policy = input.policy && typeof input.policy === "object" ? input.policy : {};
  const maxSimultaneous = typeof policy.maxSimultaneousAssignments === "number" ? policy.maxSimultaneousAssignments : 1;
  evaluated.push("SCOPE");
  if (!tenantId) {
    hardFailures.push(
      createHardFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TENANT_SCOPE_REQUIRED,
        message: "tenantId is required"
      })
    );
  }
  if (!tournamentId) {
    hardFailures.push(
      createHardFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TOURNAMENT_SCOPE_REQUIRED,
        message: "tournamentId is required"
      })
    );
  }
  if (!matchId) {
    hardFailures.push(
      createHardFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED,
        message: "matchId is required"
      })
    );
  }
  evaluated.push("ROLE");
  if (!roleCode || roleCode === REFEREE_ROLE_CODE.ANY) {
    hardFailures.push(
      createHardFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
        message: "Concrete roleCode required; ANY is not assignable",
        details: { roleCode: roleCode || null }
      })
    );
  }
  evaluated.push("CANDIDATE");
  let candidate = null;
  if (input.candidate == null) {
    hardFailures.push(
      createHardFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND,
        message: "Candidate missing"
      })
    );
  } else {
    try {
      candidate = isPlainObject(input.candidate) ? input.candidate.refereeId && input.candidate.schemaVersion ? input.candidate : createRefereeCandidate(input.candidate) : null;
    } catch {
      candidate = null;
      hardFailures.push(
        createHardFailure({
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND,
          message: "Candidate invalid"
        })
      );
    }
  }
  const refereeId = candidate ? String(candidate.refereeId) : String(input.refereeId || "").trim();
  if (candidate) {
    evidenceRefs.push(`candidate:${candidate.refereeId}`);
    evaluated.push("ACTIVE");
    if (candidate.active === false) {
      hardFailures.push(
        createHardFailure({
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_INACTIVE,
          message: "Referee is inactive",
          details: { refereeId }
        })
      );
    }
  }
  evaluated.push("SCHEDULE_WINDOW");
  const matchWindow = tryHalfOpenWindow(match.startAt, match.endAt, "match");
  const requireWindow = policy.requireScheduleWindowForMandatoryRoles !== false;
  if (!matchWindow) {
    if (requireWindow) {
      hardFailures.push(
        createHardFailure({
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED,
          message: "Match startAt/endAt required",
          details: { matchId }
        })
      );
    }
  }
  evaluated.push("QUALIFICATION");
  const requireQualification = input.requireQualification !== false;
  const qualifications = Array.isArray(input.qualifications) ? input.qualifications : [];
  if (requireQualification && roleCode && roleCode !== REFEREE_ROLE_CODE.ANY) {
    const matching = qualifications.filter(
      (q) => q && String(q.refereeId) === refereeId && (String(q.roleCode) === roleCode || String(q.roleCode) === REFEREE_ROLE_CODE.ANY)
    );
    if (matching.length === 0) {
      hardFailures.push(
        createHardFailure({
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_QUALIFIED,
          message: "No qualification for required role",
          details: { refereeId, roleCode }
        })
      );
    } else {
      let anyValid = false;
      for (const q of matching) {
        evidenceRefs.push(`qualification:${q.qualificationId || q.roleCode}`);
        if (matchWindow) {
          const fromOk = !q.validFrom || parseInstantMs(q.validFrom, "validFrom") <= matchWindow.startMs;
          const toOk = !q.validTo || parseInstantMs(q.validTo, "validTo") > matchWindow.startMs;
          if (fromOk && toOk) {
            const coversEnd = !q.validTo || parseInstantMs(q.validTo, "validTo") >= matchWindow.endMs;
            if (coversEnd) anyValid = true;
          }
        } else {
          anyValid = true;
        }
        if (input.requireCertification === true && !q.certificationCode) {
          hardFailures.push(
            createHardFailure({
              code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_QUALIFIED,
              message: "Certification evidence required",
              details: { qualificationId: q.qualificationId || null }
            })
          );
        }
      }
      if (matchWindow && matching.length > 0 && !anyValid) {
        hardFailures.push(
          createHardFailure({
            code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_QUALIFIED,
            message: "Qualification expired or not valid for match time",
            details: { refereeId, roleCode }
          })
        );
      }
    }
  }
  evaluated.push("AVAILABILITY");
  const requireAvailability = input.requireAvailability !== false;
  const windows = Array.isArray(input.availabilityWindows) ? input.availabilityWindows : [];
  if (requireAvailability && matchWindow && refereeId) {
    const covering = windows.filter((w) => {
      if (!w || String(w.refereeId) !== refereeId) return false;
      const aw = tryHalfOpenWindow(w.startAt, w.endAt, "availability");
      if (!aw) return false;
      evidenceRefs.push(`availability:${w.windowId || `${w.startAt}/${w.endAt}`}`);
      return windowFullyCovers(
        aw.startMs,
        aw.endMs,
        matchWindow.startMs,
        matchWindow.endMs
      );
    });
    if (covering.length === 0) {
      hardFailures.push(
        createHardFailure({
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_UNAVAILABLE,
          message: "No availability window covers the full match",
          details: { refereeId, matchId }
        })
      );
    }
  }
  evaluated.push("OVERLAP");
  evaluated.push("CAPACITY");
  const existingAssignments = Array.isArray(input.existingAssignments) ? input.existingAssignments : [];
  if (refereeId && matchWindow) {
    let simultaneous = 0;
    for (const asg of existingAssignments) {
      if (!asg || String(asg.refereeId) !== refereeId) continue;
      if (!isActiveAssignmentStatus(asg.status)) continue;
      simultaneous += 1;
    }
    let overlappingCount = 0;
    for (const asg of existingAssignments) {
      if (!asg || String(asg.refereeId) !== refereeId) continue;
      if (!isActiveAssignmentStatus(asg.status)) continue;
      if (String(asg.matchId) === matchId) continue;
      const rows = Array.isArray(input.scheduleRows) ? input.scheduleRows : [];
      const other = rows.find((r) => String(r.matchId) === String(asg.matchId)) || asg;
      const otherWindow = tryHalfOpenWindow(
        other.startAt,
        other.endAt,
        "other"
      );
      if (!otherWindow) continue;
      if (intervalsOverlapHalfOpen(
        matchWindow.startMs,
        matchWindow.endMs,
        otherWindow.startMs,
        otherWindow.endMs
      )) {
        overlappingCount += 1;
      }
    }
    void simultaneous;
    if (overlappingCount >= maxSimultaneous) {
      hardFailures.push(
        createHardFailure({
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.ASSIGNMENT_CAPACITY_EXHAUSTED,
          message: "Maximum simultaneous assignments exceeded",
          details: {
            overlappingCount,
            maxSimultaneousAssignments: maxSimultaneous
          }
        })
      );
    }
  }
  evaluated.push("CONFLICT");
  if (refereeId && matchId) {
    const detected = detectRefereeConflicts({
      refereeId,
      candidate,
      match,
      roleCode: roleCode === REFEREE_ROLE_CODE.ANY ? "" : roleCode,
      existingAssignments,
      scheduleRows: input.scheduleRows,
      conflictPolicy: normalizeConflictPolicy(input.conflictPolicy),
      policy,
      candidateTeamIds: input.candidateTeamIds,
      roleMaxCount: typeof input.roleMaxCount === "number" ? input.roleMaxCount : 1
    });
    for (const conflict of detected.conflicts) {
      const code = conflict.reasonCodes?.[0] || REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST;
      hardFailures.push(
        createHardFailure({
          code,
          message: `Conflict: ${conflict.conflictType}`,
          details: {
            conflictId: conflict.conflictId,
            conflictType: conflict.conflictType,
            metadata: conflict.metadata
          }
        })
      );
      evidenceRefs.push(`conflict:${conflict.conflictId}`);
    }
    for (const note of detected.softNotes || []) {
      softNotes.push(
        createSoftNote({
          code: note.code,
          message: note.code,
          details: note.details || {}
        })
      );
    }
  }
  evaluated.push("SOFT");
  if (Array.isArray(input.preferredTags) && candidate && Array.isArray(candidate.preferenceTags)) {
    for (const tag of input.preferredTags) {
      if (!candidate.preferenceTags.includes(tag)) {
        softNotes.push(
          createSoftNote({
            code: REFEREE_SOFT_NOTE_CODE.PREFERRED_TAG_MISSING,
            message: `Missing preferred tag ${tag}`,
            details: { tag }
          })
        );
      }
    }
  }
  if (input.preferredRoleCode && roleCode && input.preferredRoleCode !== roleCode) {
    softNotes.push(
      createSoftNote({
        code: REFEREE_SOFT_NOTE_CODE.PREFERRED_ROLE_MISMATCH,
        message: "Assigned role differs from preferred role",
        details: {
          preferredRoleCode: input.preferredRoleCode,
          roleCode
        }
      })
    );
  }
  void REFEREE_CONSTRAINT_KIND;
  return createRefereeEligibilityResult({
    refereeId,
    matchId,
    roleCode,
    eligible: hardFailures.length === 0,
    hardFailures,
    softNotes,
    evaluatedConstraintKinds: evaluated,
    evidenceRefs
  });
}

// src/features/competition-core/referee-assignment/services/validateManualRefereeAssignment.js
function validateManualRefereeAssignment(input = {}) {
  let request;
  try {
    request = input.request?.schemaVersion && input.request?.matchId ? input.request : createManualRefereeAssignmentRequest(input.request || input);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? (
      /** @type {{ code: string }} */
      err.code
    ) : REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST;
    return ownedFreeze({
      ok: false,
      accepted: false,
      failure: createManualAssignmentRejection(code, {
        message: err instanceof Error ? err.message : "Invalid manual request",
        matchId: input.request?.matchId || null,
        refereeId: input.request?.refereeId || null,
        reasonCodes: [code]
      })
    });
  }
  if (request.roleCode === REFEREE_ROLE_CODE.ANY) {
    return reject(
      request,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED]
    );
  }
  const dir = input.directorySnapshot;
  const schedule = input.scheduleSnapshot;
  const existing = input.existingAssignmentSnapshot;
  const quals = input.qualificationSnapshot;
  const avail = input.availabilitySnapshot;
  for (const [name, snap] of [
    ["directory", dir],
    ["schedule", schedule],
    ["existingAssignments", existing]
  ]) {
    const fatal = snapshotFatal(snap);
    if (fatal) {
      return reject(request, fatal, [fatal], {
        details: { snapshot: name, status: snap?.status ?? null }
      });
    }
  }
  if (input.requireQualificationSnapshot !== false) {
    const fatal = snapshotFatal(quals);
    if (fatal) {
      return reject(request, fatal, [fatal], {
        details: { snapshot: "qualifications" }
      });
    }
  }
  if (input.requireAvailabilitySnapshot !== false) {
    const fatal = snapshotFatal(avail);
    if (fatal) {
      return reject(request, fatal, [fatal], {
        details: { snapshot: "availability" }
      });
    }
  }
  const candidates = Array.isArray(dir?.items) ? dir.items : [];
  const candidate = candidates.find(
    (c) => String(c.refereeId) === String(request.refereeId)
  );
  if (!candidate) {
    return reject(
      request,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND]
    );
  }
  const scheduleRows = Array.isArray(schedule?.items) ? schedule.items : [];
  const match = scheduleRows.find((m) => String(m.matchId) === String(request.matchId)) || input.match || null;
  if (!match) {
    return reject(
      request,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED]
    );
  }
  const eligibility = evaluateRefereeEligibility({
    tenantId: request.tenantId,
    tournamentId: request.tournamentId,
    candidate,
    match,
    roleCode: request.roleCode,
    qualifications: Array.isArray(quals?.items) ? quals.items : [],
    availabilityWindows: Array.isArray(avail?.items) ? avail.items : [],
    existingAssignments: Array.isArray(existing?.items) ? existing.items : [],
    scheduleRows,
    conflictPolicy: input.conflictPolicy,
    policy: input.policy,
    candidateTeamIds: input.candidateTeamIds,
    preferredTags: input.preferredTags,
    preferredRoleCode: input.preferredRoleCode,
    requireCertification: input.requireCertification === true,
    requireQualification: input.requireQualification !== false,
    requireAvailability: input.requireAvailability !== false
  });
  const hardCodes = collectReasonCodes(eligibility.hardFailures);
  if (hardCodes.length > 0) {
    return reject(request, hardCodes[0], hardCodes, {
      details: { hardFailures: eligibility.hardFailures }
    });
  }
  const allowSoft = request.allowSoftOverride === true || input.allowSoftOverride === true || input.policy?.allowSoftOverride === true;
  if (eligibility.softNotes.length > 0 && !allowSoft) {
    const softCodes = [
      ...new Set(eligibility.softNotes.map((n) => n.code))
    ].sort(compareStableString);
    return ownedFreeze({
      ok: false,
      accepted: false,
      eligibility,
      failure: createRefereeAssignmentFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED,
        message: `Manual assignment rejected: soft preferences require allowSoftOverride`,
        severity: REFEREE_DIAGNOSTIC_SEVERITY.FATAL,
        causedBy: softCodes[0],
        reasonCodes: softCodes,
        matchId: request.matchId,
        refereeId: request.refereeId,
        details: { softNotes: eligibility.softNotes }
      })
    });
  }
  const assignmentId = typeof input.assignmentId === "string" && input.assignmentId.trim() ? input.assignmentId.trim() : `manual:${request.tenantId}:${request.tournamentId}:${request.matchId}:${request.roleCode}:${request.refereeId}`;
  const assignment = createRefereeAssignment({
    assignmentId,
    matchId: request.matchId,
    refereeId: request.refereeId,
    roleCode: request.roleCode,
    status: REFEREE_ASSIGNMENT_STATUS.PLANNED,
    source: REFEREE_ASSIGNMENT_SOURCE.MANUAL,
    constraintsSatisfied: eligibility.evaluatedConstraintKinds
  });
  return ownedFreeze({
    ok: true,
    accepted: true,
    eligibility,
    assignment,
    failure: null
  });
}
function snapshotFatal(snap) {
  if (snap == null) {
    return REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING;
  }
  if (snap.status === REFEREE_SNAPSHOT_STATUS.MISSING) {
    return REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING;
  }
  if (snap.status === REFEREE_SNAPSHOT_STATUS.INVALID) {
    return REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID;
  }
  return null;
}
function reject(request, causedBy, reasonCodes, extra = {}) {
  const uniqueSorted = [...new Set(reasonCodes.filter(Boolean))].sort(
    compareStableString
  );
  return ownedFreeze({
    ok: false,
    accepted: false,
    failure: createManualAssignmentRejection(causedBy, {
      matchId: request.matchId,
      refereeId: request.refereeId,
      reasonCodes: uniqueSorted,
      details: extra.details || {},
      message: `Manual assignment rejected: ${causedBy}`
    })
  });
}

// src/features/competition-core/referee-assignment/engines/replaceRefereeAssignment.js
function replaceRefereeAssignment(input = {}) {
  let request;
  try {
    request = input.request?.requestId && input.request?.incomingRefereeId ? input.request.schemaVersion ? input.request : createRefereeReplacementRequest(input.request) : createRefereeReplacementRequest(input.request || input);
  } catch (err) {
    return rejectResult(
      input.request?.requestId || "unknown",
      err?.code || REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [err?.code || REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      err instanceof Error ? err.message : "Invalid replacement request"
    );
  }
  if (request.roleCode === REFEREE_ROLE_CODE.ANY) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED]
    );
  }
  for (const [name, snap] of [
    ["directory", input.directorySnapshot],
    ["schedule", input.scheduleSnapshot],
    ["existingAssignments", input.existingAssignmentSnapshot],
    ["qualifications", input.qualificationSnapshot],
    ["availability", input.availabilitySnapshot]
  ]) {
    if (snap == null || snap.status === REFEREE_SNAPSHOT_STATUS.MISSING) {
      return rejectResult(
        request.requestId,
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING,
        [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING],
        `Missing snapshot: ${name}`
      );
    }
    if (snap.status === REFEREE_SNAPSHOT_STATUS.INVALID) {
      return rejectResult(
        request.requestId,
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID,
        [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID],
        `Invalid snapshot: ${name}`
      );
    }
  }
  const existing = Array.isArray(input.existingAssignmentSnapshot.items) ? input.existingAssignmentSnapshot.items : [];
  const prior = resolvePrior(existing, request);
  if (!prior) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Prior assignment not found"
    );
  }
  if (prior.status === REFEREE_ASSIGNMENT_STATUS.RELEASED) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Cannot replace RELEASED assignment"
    );
  }
  if (prior.status === REFEREE_ASSIGNMENT_STATUS.REPLACED) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Cannot replace already REPLACED assignment"
    );
  }
  if (prior.status !== REFEREE_ASSIGNMENT_STATUS.PLANNED && prior.status !== REFEREE_ASSIGNMENT_STATUS.CONFIRMED) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Prior assignment must be PLANNED or CONFIRMED"
    );
  }
  if (String(prior.refereeId) === String(request.incomingRefereeId)) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED],
      "Replacement with same referee rejected by default",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED
    );
  }
  const concreteRole = request.roleCode || prior.roleCode;
  if (concreteRole === REFEREE_ROLE_CODE.ANY || !concreteRole) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED]
    );
  }
  if (request.matchId && String(request.matchId) !== String(prior.matchId)) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Replacement must preserve matchId"
    );
  }
  if (request.roleCode && String(request.roleCode) !== String(prior.roleCode)) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Replacement must preserve roleCode"
    );
  }
  const candidates = Array.isArray(input.directorySnapshot.items) ? input.directorySnapshot.items : [];
  const candidate = candidates.find(
    (c) => String(c.refereeId) === String(request.incomingRefereeId)
  );
  if (!candidate) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND]
    );
  }
  const scheduleRows = Array.isArray(input.scheduleSnapshot.items) ? input.scheduleSnapshot.items : [];
  const match = scheduleRows.find((m) => String(m.matchId) === String(prior.matchId)) || input.match || null;
  if (!match) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED]
    );
  }
  const assignmentsForEval = existing.filter(
    (a) => String(a.assignmentId) !== String(prior.assignmentId)
  );
  const policy = input.policy?.policyId ? input.policy.schemaVersion ? input.policy : createRefereeAssignmentPolicy(input.policy) : createRefereeAssignmentPolicy({
    policyId: "pol-replace",
    policyVersion: "1"
  });
  const eligibility = evaluateRefereeEligibility({
    tenantId: request.tenantId,
    tournamentId: request.tournamentId,
    candidate,
    match,
    roleCode: concreteRole,
    qualifications: Array.isArray(input.qualificationSnapshot.items) ? input.qualificationSnapshot.items : [],
    availabilityWindows: Array.isArray(input.availabilitySnapshot.items) ? input.availabilitySnapshot.items : [],
    existingAssignments: assignmentsForEval,
    scheduleRows,
    conflictPolicy: normalizeConflictPolicy(input.conflictPolicy),
    policy,
    requireQualification: input.requireQualification !== false,
    requireAvailability: input.requireAvailability !== false
  });
  if (!eligibility.eligible) {
    const codes = eligibility.hardFailures.map((f) => f.code);
    const unique = [...new Set(codes)].sort(compareStableString);
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED,
      unique,
      `Replacement rejected: ${unique[0]}`,
      unique[0]
    );
  }
  const replacedPrior = createRefereeAssignment({
    assignmentId: prior.assignmentId,
    matchId: prior.matchId,
    refereeId: prior.refereeId,
    roleCode: prior.roleCode,
    status: REFEREE_ASSIGNMENT_STATUS.REPLACED,
    source: prior.source || REFEREE_ASSIGNMENT_SOURCE.AUTO,
    constraintsSatisfied: prior.constraintsSatisfied || [],
    metadata: {
      ...prior.metadata || {},
      replacedByRequestId: request.requestId
    }
  });
  const incomingAssignmentId = buildReplacementId({
    schemaVersion: CORE13_SCHEMA_VERSION,
    requestId: request.requestId,
    tenantId: request.tenantId,
    tournamentId: request.tournamentId,
    matchId: prior.matchId,
    roleCode: concreteRole,
    slotIndex: 0,
    refereeId: request.incomingRefereeId,
    priorAssignmentId: prior.assignmentId,
    source: REFEREE_ASSIGNMENT_SOURCE.REPLACEMENT
  });
  const incomingAssignment = createRefereeAssignment({
    assignmentId: incomingAssignmentId,
    matchId: prior.matchId,
    refereeId: request.incomingRefereeId,
    roleCode: concreteRole,
    status: REFEREE_ASSIGNMENT_STATUS.PLANNED,
    source: REFEREE_ASSIGNMENT_SOURCE.REPLACEMENT,
    constraintsSatisfied: eligibility.evaluatedConstraintKinds
  });
  const resultFingerprint = fingerprintValue(
    {
      requestId: request.requestId,
      priorAssignmentId: prior.assignmentId,
      incomingAssignmentId,
      matchId: prior.matchId,
      roleCode: concreteRole,
      outgoingRefereeId: prior.refereeId,
      incomingRefereeId: request.incomingRefereeId,
      reasonCode: request.reasonCode || "REPLACEMENT"
    },
    CORE13_DIGEST_DOMAIN.REPLACEMENT_RESULT
  );
  const auditId = `${CORE13_ID_PREFIX.AUDIT}${digestCanonical(
    CORE13_DIGEST_DOMAIN.AUDIT,
    {
      requestId: request.requestId,
      resultFingerprint,
      priorAssignmentId: prior.assignmentId,
      incomingAssignmentId
    }
  ).slice(0, 32)}`;
  const auditPayload = createRefereeAssignmentAuditRecord({
    auditId,
    action: REFEREE_AUDIT_ACTION.REPLACED,
    requestId: request.requestId,
    planFingerprint: resultFingerprint,
    beforeRef: prior.assignmentId,
    afterRef: incomingAssignmentId,
    actorRef: request.actorRef,
    reasonCode: request.reasonCode || "REPLACEMENT",
    // recordedAt intentionally omitted — sink owns timestamps
    payload: {
      priorAssignmentId: prior.assignmentId,
      incomingAssignmentId,
      resultFingerprint
    }
  });
  const validationEvidence = {
    schemaVersion: eligibility.schemaVersion,
    refereeId: eligibility.refereeId,
    matchId: eligibility.matchId,
    roleCode: eligibility.roleCode,
    eligible: eligibility.eligible,
    hardFailures: eligibility.hardFailures.map((f) => ({
      code: f.code,
      severity: f.severity,
      constraintKind: f.constraintKind,
      message: f.message,
      details: { ...f.details || {} }
    })),
    softNotes: eligibility.softNotes.map((n) => ({
      code: n.code,
      severity: n.severity,
      constraintKind: n.constraintKind,
      message: n.message,
      details: { ...n.details || {} }
    })),
    evaluatedConstraintKinds: [...eligibility.evaluatedConstraintKinds],
    evidenceRefs: [...eligibility.evidenceRefs]
  };
  const conflictEvidence = validationEvidence.hardFailures.map((f) => ({
    ...f,
    details: { ...f.details || {} }
  }));
  return ownedFreeze({
    ok: true,
    schemaVersion: CORE13_SCHEMA_VERSION,
    requestId: request.requestId,
    priorAssignmentRef: prior.assignmentId,
    outgoingAssignment: replacedPrior,
    incomingAssignment,
    replacementIdentity: incomingAssignmentId,
    reasonCode: request.reasonCode || "REPLACEMENT",
    validationEvidence,
    conflictEvidence,
    auditPayload,
    resultFingerprint,
    failure: null
  });
}
function resolvePrior(existing, request) {
  if (request.assignmentId) {
    return existing.find(
      (a) => String(a.assignmentId) === String(request.assignmentId)
    ) || null;
  }
  if (request.matchId && request.roleCode) {
    return existing.find(
      (a) => String(a.matchId) === String(request.matchId) && String(a.roleCode) === String(request.roleCode) && (a.status === REFEREE_ASSIGNMENT_STATUS.PLANNED || a.status === REFEREE_ASSIGNMENT_STATUS.CONFIRMED)
    ) || null;
  }
  return null;
}
function rejectResult(requestId, envelopeOrCode, reasonCodes, message, causedBy) {
  const unique = [...new Set(reasonCodes.filter(Boolean))].sort(
    compareStableString
  );
  const primary = causedBy || unique[0] || envelopeOrCode;
  const fatalCodes = /* @__PURE__ */ new Set([
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND
  ]);
  const useEnvelope = !fatalCodes.has(envelopeOrCode);
  const code = useEnvelope ? REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED : envelopeOrCode;
  return ownedFreeze({
    ok: false,
    schemaVersion: CORE13_SCHEMA_VERSION,
    requestId,
    outgoingAssignment: null,
    incomingAssignment: null,
    failure: createRefereeAssignmentFailure({
      code,
      message: message || `Replacement rejected: ${primary}`,
      severity: REFEREE_DIAGNOSTIC_SEVERITY.FATAL,
      causedBy: useEnvelope ? primary : unique[0] || primary,
      reasonCodes: unique.length > 0 ? unique : [primary]
    }),
    resultFingerprint: null,
    auditPayload: null
  });
}

// src/features/competition-engine/operations/referee/assignment/assertAssignmentCommandAuthz.js
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE_RE = /^[+]?[\d\s().-]{7,}$/;
function assertCanonicalRefereeId(refereeId, extras = {}) {
  if (extras.email != null && String(extras.email).trim()) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.EMAIL_AS_AUTHORITY_DENIED,
      "Email must not be used as referee assignment authority",
      {}
    );
  }
  if (extras.phone != null && String(extras.phone).trim()) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.PHONE_AS_AUTHORITY_DENIED,
      "Phone must not be used as referee assignment authority",
      {}
    );
  }
  if (extras.displayName != null && String(extras.displayName).trim() || extras.name != null && String(extras.name).trim()) {
  }
  const id = String(refereeId || "").trim();
  if (!id) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_ID_REQUIRED,
      "Canonical refereeId is required",
      {}
    );
  }
  if (EMAIL_RE.test(id)) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.EMAIL_AS_AUTHORITY_DENIED,
      "Email must not be used as refereeId",
      { refereeId: id }
    );
  }
  if (PHONE_RE.test(id) && !/[a-zA-Z_]/.test(id)) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.PHONE_AS_AUTHORITY_DENIED,
      "Phone must not be used as refereeId",
      { refereeId: id }
    );
  }
  if (/\s/.test(id) || id.includes("@")) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.DISPLAY_NAME_IDENTITY_DENIED,
      "Display name must not be used as refereeId",
      { refereeId: id }
    );
  }
  return id;
}
function assertAssignmentCommandAuthz(command = {}, ctx = {}) {
  if (command.clientGrantedPermissions != null) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED,
      "Client-granted permission claims are denied",
      {}
    );
  }
  if (ctx.allowClientGrantedPermissions === true) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED,
      "allowClientGrantedPermissions is forbidden",
      {}
    );
  }
  const tenantId = String(command.tenantId || "").trim();
  const tournamentId = String(
    command.tournamentId || command.competitionId || ""
  ).trim();
  if (!tenantId || !tournamentId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
      "tenantId and tournamentId/competitionId are required",
      {}
    );
  }
  const authorizedTenantId = ctx.authorizedTenantId != null ? String(ctx.authorizedTenantId).trim() : null;
  if (authorizedTenantId && authorizedTenantId !== tenantId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED,
      "Cross-tenant assignment mutation denied",
      { tenantId, authorizedTenantId }
    );
  }
  const authorizedTournamentId = ctx.authorizedTournamentId != null ? String(ctx.authorizedTournamentId).trim() : null;
  if (authorizedTournamentId && authorizedTournamentId !== tournamentId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      "Cross-tournament assignment mutation denied",
      { tournamentId, authorizedTournamentId }
    );
  }
  if (command.staleTenantContext === true) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.STALE_TENANT_CONTEXT,
      "Stale tenant context denied",
      {}
    );
  }
  if (command.staleClubContext === true) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.STALE_CLUB_CONTEXT,
      "Stale club context denied",
      {}
    );
  }
  const clubId = command.clubId != null ? String(command.clubId).trim() : "";
  const authorizedClubId = ctx.authorizedClubId != null ? String(ctx.authorizedClubId).trim() : null;
  if (authorizedClubId && clubId && authorizedClubId !== clubId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.STALE_CLUB_CONTEXT,
      "Club context mismatch denied",
      { clubId, authorizedClubId }
    );
  }
  if (ctx.actorAuthorized === false) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
      "Unauthorized actor",
      {}
    );
  }
  const actorId = String(
    command.actorId || command.actor?.id || command.actorRef || ""
  ).trim();
  if (!actorId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
      "Actor identity required",
      {}
    );
  }
  return Object.freeze({
    tenantId,
    tournamentId,
    actorId,
    clubId: clubId || null
  });
}

// src/features/competition-engine/operations/referee/assignment/evaluateLifecycleGate.js
var PRE_MATCH_ALIASES = /* @__PURE__ */ new Set([
  "PRE_MATCH",
  "NOT_STARTED",
  "SCHEDULED",
  "READY",
  "PENDING",
  "ASSIGNED",
  "ACKNOWLEDGED"
]);
var IN_PROGRESS_ALIASES = /* @__PURE__ */ new Set([
  "IN_PROGRESS",
  "ACTIVE",
  "STARTED",
  "LIVE"
]);
var SCORING_ACTIVE_ALIASES = /* @__PURE__ */ new Set([
  "SCORING_ACTIVE",
  "SCORING",
  "SCORE_ENTRY"
]);
var LOCKED_ALIASES = /* @__PURE__ */ new Set(["LOCKED", "SUSPENDED", "PAUSED"]);
var COMPLETED_ALIASES = /* @__PURE__ */ new Set([
  "COMPLETED",
  "COMPLETE",
  "FINISHED",
  "FINAL",
  "CLOSED"
]);
function normalizeAssignmentLifecycleState(raw, hints = {}) {
  if (hints.scoringActive === true) {
    return ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE;
  }
  const value = String(raw || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!value) return ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH;
  if (SCORING_ACTIVE_ALIASES.has(value)) {
    return ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE;
  }
  if (IN_PROGRESS_ALIASES.has(value)) {
    return ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS;
  }
  if (LOCKED_ALIASES.has(value)) return ASSIGNMENT_LIFECYCLE_STATE.LOCKED;
  if (COMPLETED_ALIASES.has(value)) {
    return ASSIGNMENT_LIFECYCLE_STATE.COMPLETED;
  }
  if (PRE_MATCH_ALIASES.has(value)) {
    return ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH;
  }
  return ASSIGNMENT_LIFECYCLE_STATE.LOCKED;
}
function evaluateAssignmentLifecycleGate(input = {}) {
  const command = String(input.command || "").trim();
  const lifecycleState = normalizeAssignmentLifecycleState(input.lifecycleState);
  const actorAuthorized = input.actorAuthorized !== false;
  const emergencyReplacement = input.emergencyReplacement === true;
  const emergencyAuthorized = input.emergencyAuthorized === true;
  const deny = (reason, code = ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED) => Object.freeze({
    ok: false,
    allowed: false,
    code,
    reason,
    lifecycleState,
    command
  });
  const allow = (policy) => Object.freeze({
    ok: true,
    allowed: true,
    code: null,
    reason: null,
    lifecycleState,
    command,
    policy
  });
  if (!actorAuthorized) {
    return deny(
      "Actor is not authorized for assignment mutation",
      ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR
    );
  }
  if (lifecycleState === ASSIGNMENT_LIFECYCLE_STATE.LOCKED || lifecycleState === ASSIGNMENT_LIFECYCLE_STATE.COMPLETED) {
    return deny(
      `${lifecycleState} forbids assign/replace/unassign`,
      ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED
    );
  }
  if (lifecycleState === ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH) {
    if (command === ASSIGNMENT_COMMAND.ASSIGN || command === ASSIGNMENT_COMMAND.REPLACE || command === ASSIGNMENT_COMMAND.UNASSIGN) {
      return allow("PRE_MATCH_ALLOW");
    }
    return deny(`Unknown command ${command}`);
  }
  if (lifecycleState === ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS) {
    if (command === ASSIGNMENT_COMMAND.ASSIGN) {
      return deny(
        "IN_PROGRESS forbids new assignment (use atomic replace)",
        ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED
      );
    }
    if (command === ASSIGNMENT_COMMAND.UNASSIGN) {
      return deny(
        "IN_PROGRESS forbids unassign without replacement",
        ASSIGNMENT_COMMAND_ERROR_CODE.UNASSIGN_WITHOUT_REPLACEMENT_DENIED
      );
    }
    if (command === ASSIGNMENT_COMMAND.REPLACE) {
      return allow("IN_PROGRESS_ATOMIC_REPLACEMENT_ALLOW_AUTHORIZED");
    }
    return deny(`Unknown command ${command}`);
  }
  if (lifecycleState === ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE) {
    if (command === ASSIGNMENT_COMMAND.ASSIGN) {
      return deny(
        "SCORING_ACTIVE forbids normal assign",
        ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED
      );
    }
    if (command === ASSIGNMENT_COMMAND.UNASSIGN) {
      return deny(
        "SCORING_ACTIVE forbids unassign without replacement",
        ASSIGNMENT_COMMAND_ERROR_CODE.UNASSIGN_WITHOUT_REPLACEMENT_DENIED
      );
    }
    if (command === ASSIGNMENT_COMMAND.REPLACE) {
      if (!emergencyReplacement) {
        return deny(
          "SCORING_ACTIVE requires explicit emergencyReplacement=true",
          ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_REPLACEMENT_REQUIRED
        );
      }
      if (!emergencyAuthorized) {
        return deny(
          "SCORING_ACTIVE emergency replacement requires emergency authorization",
          ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_UNAUTHORIZED
        );
      }
      return allow("SCORING_ACTIVE_ATOMIC_EMERGENCY_REPLACEMENT_ALLOW");
    }
    return deny(`Unknown command ${command}`);
  }
  return deny(`Lifecycle ${lifecycleState} forbids mutation`);
}
function assertAssignmentLifecycleGate(input) {
  const result = evaluateAssignmentLifecycleGate(input);
  if (!result.allowed) {
    failAssignmentCommand(result.code, result.reason, {
      lifecycleState: result.lifecycleState,
      command: result.command
    });
  }
  return result;
}

// src/features/competition-engine/operations/referee/assignment/createCompetitionRefereeAssignmentCommandService.js
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}
function requirePersistence(persistence, production) {
  if (!persistence || typeof persistence !== "object") {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.PERSISTENCE_REQUIRED,
      "Canonical assignment persistence is required",
      {}
    );
  }
  if (production === true && persistence.classification === TEST_DOUBLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN,
      "In-memory assignment persistence is TEST_DOUBLE_ONLY",
      {}
    );
  }
  return persistence;
}
function resolveDailyPlayPolicy(command) {
  const mode = String(command.competitionMode || "").toUpperCase();
  if (mode !== ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY) {
    return { applicable: true, required: true };
  }
  const enabled = command.refereeFeatureEnabled === true;
  if (!enabled) {
    return {
      applicable: false,
      required: false,
      code: "NOT_APPLICABLE_FOR_INSTANCE"
    };
  }
  return { applicable: true, required: true };
}
function defaultRole(command) {
  return command.roleCode || command.role || REFEREE_ROLE_CODE.PRIMARY;
}
function buildDirectorySnapshot(command, refereeId) {
  if (command.directorySnapshot) return command.directorySnapshot;
  const candidates = Array.isArray(command.candidates) ? command.candidates : [
    {
      refereeId,
      active: command.refereeActive !== false,
      userId: command.refereeUserId || null,
      displayLabel: command.refereeDisplayLabel || void 0
    }
  ];
  const items = candidates.map(
    (c) => createRefereeCandidate({
      refereeId: String(c.refereeId),
      active: c.active !== false,
      userId: c.userId || null,
      playerId: c.playerId || null,
      organizationIds: c.organizationIds || [],
      clubIds: c.clubIds || [],
      qualificationRefs: c.qualificationRefs || [],
      preferenceTags: c.preferenceTags || [],
      displayLabel: c.displayLabel
    })
  );
  return createPopulatedSnapshotResult(items);
}
function resolveWindow(command) {
  const startAt = command.startAt || command.windowStart || command.scheduledStartAt || null;
  const endAt = command.endAt || command.windowEnd || command.scheduledEndAt || null;
  return { startAt, endAt };
}
function buildScheduleSnapshot(command) {
  if (command.scheduleSnapshot) return command.scheduleSnapshot;
  const matchId = String(command.matchId || "").trim();
  const { startAt, endAt } = resolveWindow(command);
  const row = createMatchScheduleRow({
    matchId,
    startAt,
    endAt,
    courtId: command.courtId || null
  });
  return createPopulatedSnapshotResult([row]);
}
function buildQualificationSnapshot(command) {
  if (command.qualificationSnapshot) return command.qualificationSnapshot;
  return createEmptySnapshotResult(
    "Referee qualification capability is NOT_CONFIGURED"
  );
}
function buildAvailabilitySnapshot(command) {
  if (command.availabilitySnapshot) return command.availabilitySnapshot;
  return createEmptySnapshotResult(
    "Referee availability capability is NOT_CONFIGURED"
  );
}
function resolveRequirementProfile(command) {
  const { startAt, endAt } = resolveWindow(command);
  const scheduled = Boolean(startAt && endAt) || command.scheduled === true;
  return {
    requireQualification: command.requireQualification === true,
    requireAvailability: command.requireAvailability === true,
    requireScheduleWindowForMandatoryRoles: command.requireScheduleWindowForMandatoryRoles === true || command.requireScheduleWindowForMandatoryRoles !== false && scheduled
  };
}
function resolveCore13Policy(command) {
  if (command.policy && typeof command.policy === "object") {
    return command.policy;
  }
  const profile = resolveRequirementProfile(command);
  return {
    policyId: "core13-assignment-command",
    policyVersion: "1",
    requireScheduleWindowForMandatoryRoles: profile.requireScheduleWindowForMandatoryRoles,
    allowSoftOverride: command.allowSoftOverride === true
  };
}
function buildExistingSnapshot(rows) {
  if (!rows || rows.length === 0) return createEmptySnapshotResult();
  const items = rows.map(
    (row) => createRefereeAssignment({
      assignmentId: String(row.assignmentId),
      matchId: String(row.matchId),
      refereeId: String(row.refereeId),
      roleCode: row.roleCode || row.role || REFEREE_ROLE_CODE.PRIMARY,
      status: row.status === "active" || row.status === REFEREE_ASSIGNMENT_STATUS.CONFIRMED ? REFEREE_ASSIGNMENT_STATUS.CONFIRMED : row.status === REFEREE_ASSIGNMENT_STATUS.PLANNED ? REFEREE_ASSIGNMENT_STATUS.PLANNED : REFEREE_ASSIGNMENT_STATUS.RELEASED,
      source: REFEREE_ASSIGNMENT_SOURCE.MANUAL,
      constraintsSatisfied: []
    })
  );
  return createPopulatedSnapshotResult(items);
}
async function loadExistingForCore13(persistence, scope) {
  const list = await persistence.listActiveAssignments({
    tenantId: scope.tenantId,
    tournamentId: scope.tournamentId
  });
  return list || [];
}
function mapCore13Failure(result) {
  const code = result?.failure?.code || result?.failure?.causedBy || ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED;
  failAssignmentCommand(
    ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED,
    result?.failure?.message || "CORE-13 rejected assignment command",
    { core13Code: code, failure: result?.failure || null }
  );
}
function createCompetitionRefereeAssignmentCommandService(options = {}) {
  const production = options.production === true;
  const persistence = requirePersistence(options.persistence, production);
  async function resolveActorAuthorized(command) {
    if (typeof options.authorize === "function") {
      return Boolean(await options.authorize(command));
    }
    return command.actorAuthorized !== false;
  }
  async function resolveEmergencyAuthorized(command) {
    if (typeof options.authorizeEmergency === "function") {
      return Boolean(await options.authorizeEmergency(command));
    }
    return command.emergencyAuthorized === true;
  }
  async function prepare(command, mutationKind) {
    const daily = resolveDailyPlayPolicy(command);
    if (!daily.applicable) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.DAILY_PLAY_NOT_APPLICABLE,
        "Daily Play referee feature disabled \u2014 CORE-13 assignment not applicable",
        { policy: daily.code }
      );
    }
    const actorAuthorized = await resolveActorAuthorized(command);
    const authz = assertAssignmentCommandAuthz(command, {
      authorizedTenantId: command.authorizedTenantId,
      authorizedTournamentId: command.authorizedTournamentId,
      authorizedClubId: command.authorizedClubId,
      actorAuthorized
    });
    const lifecycleGate = assertAssignmentLifecycleGate({
      command: mutationKind,
      lifecycleState: normalizeAssignmentLifecycleState(
        command.lifecycleState || command.matchStatus,
        { scoringActive: command.scoringActive === true }
      ),
      emergencyReplacement: command.emergencyReplacement === true,
      actorAuthorized,
      emergencyAuthorized: await resolveEmergencyAuthorized(command)
    });
    return { authz, lifecycleGate, daily };
  }
  async function resolveIdempotentReplay(command) {
    if (typeof persistence.peekIdempotency !== "function") return null;
    const peek = await persistence.peekIdempotency({
      ...command,
      tenantId: command.tenantId,
      tournamentId: command.tournamentId || command.competitionId
    });
    if (peek?.replay) {
      return deepFreeze({
        ok: true,
        command: command.operation,
        core13Decision: "ACCEPT",
        replayed: true,
        assignment: peek.result,
        audit: null,
        version: peek.result?.version ?? null,
        engine: CORE13_ASSIGNMENT_COMMAND_VERSION,
        persistenceClassification: persistence.classification
      });
    }
    return null;
  }
  async function assignReferee(rawCommand = {}) {
    const command = { ...rawCommand, operation: ASSIGNMENT_OPERATION.ASSIGN };
    const replay = await resolveIdempotentReplay({
      ...command,
      operation: ASSIGNMENT_OPERATION.ASSIGN
    });
    if (replay) {
      return { ...replay, command: ASSIGNMENT_COMMAND.ASSIGN };
    }
    const { authz, lifecycleGate } = await prepare(
      command,
      ASSIGNMENT_COMMAND.ASSIGN
    );
    const refereeId = assertCanonicalRefereeId(command.refereeId, {
      email: command.email,
      phone: command.phone,
      displayName: command.displayName,
      name: command.name
    });
    const matchId = String(command.matchId || "").trim();
    if (!matchId) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
        "matchId is required",
        {}
      );
    }
    const role = defaultRole(command);
    const existingRows = await loadExistingForCore13(persistence, authz);
    const profile = resolveRequirementProfile(command);
    const request = createManualRefereeAssignmentRequest({
      requestId: String(
        command.commandId || command.idempotencyKey || `assign-${matchId}-${refereeId}`
      ),
      tenantId: authz.tenantId,
      tournamentId: authz.tournamentId,
      matchId,
      refereeId,
      roleCode: role,
      actorRef: authz.actorId,
      allowSoftOverride: command.allowSoftOverride === true
    });
    const core13 = validateManualRefereeAssignment({
      request,
      directorySnapshot: buildDirectorySnapshot(command, refereeId),
      scheduleSnapshot: buildScheduleSnapshot({ ...command, matchId }),
      existingAssignmentSnapshot: buildExistingSnapshot(existingRows),
      qualificationSnapshot: buildQualificationSnapshot(command),
      availabilitySnapshot: buildAvailabilitySnapshot(command),
      requireQualificationSnapshot: profile.requireQualification,
      requireAvailabilitySnapshot: profile.requireAvailability,
      requireQualification: profile.requireQualification,
      requireAvailability: profile.requireAvailability,
      conflictPolicy: command.conflictPolicy,
      policy: resolveCore13Policy(command)
    });
    if (!core13.ok || core13.accepted === false) mapCore13Failure(core13);
    const expectedVersion = command.expectedVersion != null ? Number(command.expectedVersion) : await persistence.getMatchAssignmentVersion({
      tenantId: authz.tenantId,
      tournamentId: authz.tournamentId,
      matchId,
      role
    });
    const persisted = await persistence.assign({
      tenantId: authz.tenantId,
      tournamentId: authz.tournamentId,
      matchId,
      refereeId,
      role,
      actorId: authz.actorId,
      expectedVersion,
      idempotencyKey: String(command.idempotencyKey || "").trim(),
      operation: ASSIGNMENT_OPERATION.ASSIGN,
      reason: command.reason || null,
      lifecycleState: lifecycleGate.lifecycleState
    });
    return deepFreeze({
      ok: true,
      command: ASSIGNMENT_COMMAND.ASSIGN,
      core13Decision: "ACCEPT",
      lifecyclePolicy: lifecycleGate.policy,
      replayed: persisted.replayed === true,
      assignment: persisted.assignment,
      audit: persisted.audit || null,
      version: persisted.assignment?.version ?? null,
      engine: CORE13_ASSIGNMENT_COMMAND_VERSION,
      persistenceClassification: persistence.classification
    });
  }
  async function replaceReferee(rawCommand = {}) {
    const command = { ...rawCommand, operation: ASSIGNMENT_OPERATION.REPLACE };
    const replay = await resolveIdempotentReplay({
      ...command,
      operation: ASSIGNMENT_OPERATION.REPLACE,
      newRefereeId: rawCommand.newRefereeId || rawCommand.refereeId
    });
    if (replay) {
      return { ...replay, command: ASSIGNMENT_COMMAND.REPLACE };
    }
    const { authz, lifecycleGate } = await prepare(
      command,
      ASSIGNMENT_COMMAND.REPLACE
    );
    const newRefereeId = assertCanonicalRefereeId(
      command.newRefereeId || command.refereeId,
      {
        email: command.email,
        phone: command.phone,
        displayName: command.displayName,
        name: command.name
      }
    );
    const matchId = String(command.matchId || "").trim();
    if (!matchId) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
        "matchId is required",
        {}
      );
    }
    const role = defaultRole(command);
    const existingRows = await loadExistingForCore13(persistence, authz);
    const prior = existingRows.find(
      (row) => String(row.matchId) === matchId && String(row.roleCode || row.role || REFEREE_ROLE_CODE.PRIMARY) === String(role)
    ) || null;
    if (!prior) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
        "No active assignment to replace",
        {}
      );
    }
    const profile = resolveRequirementProfile(command);
    const request = createRefereeReplacementRequest({
      requestId: String(
        command.commandId || command.idempotencyKey || `replace-${matchId}`
      ),
      tenantId: authz.tenantId,
      tournamentId: authz.tournamentId,
      matchId,
      assignmentId: prior.assignmentId,
      outgoingRefereeId: prior.refereeId,
      incomingRefereeId: newRefereeId,
      roleCode: role,
      actorRef: authz.actorId,
      allowSoftOverride: command.allowSoftOverride === true,
      reasonCode: command.reason || command.reasonCode || "REPLACE"
    });
    const core13 = replaceRefereeAssignment({
      request,
      directorySnapshot: buildDirectorySnapshot(command, newRefereeId),
      scheduleSnapshot: buildScheduleSnapshot({ ...command, matchId }),
      existingAssignmentSnapshot: buildExistingSnapshot(existingRows),
      qualificationSnapshot: buildQualificationSnapshot(command),
      availabilitySnapshot: buildAvailabilitySnapshot(command),
      requireQualification: profile.requireQualification,
      requireAvailability: profile.requireAvailability,
      conflictPolicy: command.conflictPolicy,
      policy: resolveCore13Policy(command)
    });
    if (!core13.ok || core13.accepted === false) mapCore13Failure(core13);
    const expectedVersion = command.expectedVersion != null ? Number(command.expectedVersion) : Number(prior.version || 0);
    const persisted = await persistence.replace({
      tenantId: authz.tenantId,
      tournamentId: authz.tournamentId,
      matchId,
      oldRefereeId: prior.refereeId,
      newRefereeId,
      role,
      actorId: authz.actorId,
      expectedVersion,
      idempotencyKey: String(command.idempotencyKey || "").trim(),
      operation: ASSIGNMENT_OPERATION.REPLACE,
      reason: command.reason || null,
      lifecycleState: lifecycleGate.lifecycleState,
      emergencyReplacement: command.emergencyReplacement === true
    });
    return deepFreeze({
      ok: true,
      command: ASSIGNMENT_COMMAND.REPLACE,
      core13Decision: "ACCEPT",
      lifecyclePolicy: lifecycleGate.policy,
      replayed: persisted.replayed === true,
      assignment: persisted.assignment,
      previousAssignment: persisted.previousAssignment || null,
      audit: persisted.audit || null,
      version: persisted.assignment?.version ?? null,
      engine: CORE13_ASSIGNMENT_COMMAND_VERSION,
      persistenceClassification: persistence.classification
    });
  }
  async function unassignReferee(rawCommand = {}) {
    const command = { ...rawCommand, operation: ASSIGNMENT_OPERATION.UNASSIGN };
    const replay = await resolveIdempotentReplay({
      ...command,
      operation: ASSIGNMENT_OPERATION.UNASSIGN
    });
    if (replay) {
      return { ...replay, command: ASSIGNMENT_COMMAND.UNASSIGN };
    }
    const { authz, lifecycleGate } = await prepare(
      command,
      ASSIGNMENT_COMMAND.UNASSIGN
    );
    const matchId = String(command.matchId || "").trim();
    if (!matchId) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
        "matchId is required",
        {}
      );
    }
    const role = defaultRole(command);
    const existingRows = await loadExistingForCore13(persistence, authz);
    const prior = existingRows.find(
      (row) => String(row.matchId) === matchId && String(row.roleCode || row.role || REFEREE_ROLE_CODE.PRIMARY) === String(role)
    ) || null;
    if (!prior) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
        "No active assignment to unassign",
        {}
      );
    }
    const expectedVersion = command.expectedVersion != null ? Number(command.expectedVersion) : Number(prior.version || 0);
    const persisted = await persistence.unassign({
      tenantId: authz.tenantId,
      tournamentId: authz.tournamentId,
      matchId,
      oldRefereeId: prior.refereeId,
      role,
      actorId: authz.actorId,
      expectedVersion,
      idempotencyKey: String(command.idempotencyKey || "").trim(),
      operation: ASSIGNMENT_OPERATION.UNASSIGN,
      reason: command.reason || null,
      lifecycleState: lifecycleGate.lifecycleState
    });
    return deepFreeze({
      ok: true,
      command: ASSIGNMENT_COMMAND.UNASSIGN,
      core13Decision: "ACCEPT",
      lifecyclePolicy: lifecycleGate.policy,
      replayed: persisted.replayed === true,
      assignment: persisted.assignment,
      audit: persisted.audit || null,
      version: persisted.assignment?.version ?? null,
      engine: CORE13_ASSIGNMENT_COMMAND_VERSION,
      persistenceClassification: persistence.classification
    });
  }
  async function seedAssignmentsThroughCore13(rawCommand = {}) {
    if (rawCommand.allowCore13Bypass === true) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.SEED_BYPASS_DENIED,
        "seedAssignments cannot bypass CORE-13",
        {}
      );
    }
    const assignments = Array.isArray(rawCommand.assignments) ? rawCommand.assignments : [];
    const results = [];
    for (const row of assignments) {
      const tournamentId = rawCommand.competitionId || rawCommand.tournamentId;
      const role = row.roleCode || row.role || REFEREE_ROLE_CODE.PRIMARY;
      const version = await persistence.getMatchAssignmentVersion({
        tenantId: rawCommand.tenantId,
        tournamentId,
        matchId: row.matchId,
        role
      });
      const active = await persistence.getActiveAssignment({
        tenantId: rawCommand.tenantId,
        tournamentId,
        matchId: row.matchId,
        role
      });
      const cmd = {
        ...rawCommand,
        tournamentId,
        matchId: row.matchId,
        refereeId: row.refereeId || row.assigneeId,
        roleCode: role,
        expectedVersion: version,
        idempotencyKey: row.idempotencyKey || `${rawCommand.idempotencyKey || "seed"}::${row.matchId}::${row.refereeId || row.assigneeId}`,
        lifecycleState: row.lifecycleState || rawCommand.lifecycleState || "PRE_MATCH",
        candidates: rawCommand.candidates,
        directorySnapshot: rawCommand.directorySnapshot,
        scheduleSnapshot: rawCommand.scheduleSnapshot,
        startAt: row.startAt || rawCommand.startAt,
        endAt: row.endAt || rawCommand.endAt
      };
      if (active) {
        results.push(
          await replaceReferee({
            ...cmd,
            newRefereeId: cmd.refereeId,
            expectedVersion: Number(active.version || version)
          })
        );
      } else {
        results.push(await assignReferee(cmd));
      }
    }
    return deepFreeze({
      ok: true,
      seeded: results.length,
      results,
      core13Bypass: false
    });
  }
  return Object.freeze({
    version: CORE13_ASSIGNMENT_COMMAND_VERSION,
    persistenceClassification: persistence.classification,
    durable: persistence.classification === DURABLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
    assignReferee,
    replaceReferee,
    unassignReferee,
    seedAssignmentsThroughCore13,
    getActiveAssignment: (scope) => persistence.getActiveAssignment(scope),
    getMatchAssignmentVersion: (scope) => persistence.getMatchAssignmentVersion(scope),
    listActiveAssignments: (scope) => persistence.listActiveAssignments(scope),
    listAudit: (scope) => persistence.listAudit?.(scope)
  });
}

// src/features/competition-engine/operations/referee/assignment/server/loadCanonicalCompetitionModeState.js
var UUID_RE2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isPlainObject2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function trimId(value) {
  const text = String(value || "").trim();
  return text || null;
}
function isPhysicalCourtId(value) {
  const id = trimId(value);
  if (!id) return null;
  if (/\s/.test(id)) return null;
  return id;
}
function collectMatches(node, acc) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectMatches(item, acc);
    return;
  }
  if (!isPlainObject2(node)) return;
  const matchId = trimId(
    node.matchId || node.id || node.match_id || node.subMatchId
  );
  const looksLikeMatch = matchId && (node.scheduledAt != null || node.scheduledStart != null || node.startAt != null || node.courtId != null || node.physicalCourtId != null || node.entryAId != null || node.entryBId != null || node.teamAId != null || node.teamBId != null || node.status != null || node.sides != null);
  if (looksLikeMatch && !acc.matches[matchId]) {
    acc.matches[matchId] = {
      ...node,
      matchId,
      scheduledAt: node.scheduledAt || node.scheduledStart || node.startAt || null,
      scheduledStart: node.scheduledStart || node.scheduledAt || node.startAt || null,
      scheduledEnd: node.scheduledEnd || node.endAt || null,
      courtId: node.physicalCourtId || node.courtId || node.court_id || null,
      physicalCourtId: node.physicalCourtId || node.physical_court_id || null,
      durationMinutes: node.durationMinutes || node.matchDurationMinutes || null
    };
  }
  const matchupId = trimId(node.matchupId || (node.teamAId && node.teamBId ? node.id : null));
  if (matchupId && (node.teamAId || node.teamBId) && !acc.matchups[matchupId]) {
    acc.matchups[matchupId] = node;
  }
  const nestedKeys = [
    "matches",
    "matchups",
    "events",
    "groups",
    "brackets",
    "rounds",
    "sessions",
    "subMatches",
    "children",
    "schedule",
    "teamData",
    "payload"
  ];
  for (const key of nestedKeys) {
    if (node[key] != null) collectMatches(node[key], acc);
  }
}
function extractCanonicalMatchIndex(row = {}) {
  const acc = { matches: {}, matchups: {} };
  collectMatches(row, acc);
  collectMatches(row?.payload, acc);
  return acc;
}
function buildAdapterBModeState(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const competitionMode = String(input.competitionMode || "INTERNAL").trim().toUpperCase();
  const index = extractCanonicalMatchIndex(input.canonical || input.teamHeader || {});
  const canonical = input.canonical || null;
  return Object.freeze({
    tenantId,
    competitionId: tournamentId,
    competitionMode: competitionMode === "OFFICIAL_OPEN" ? "OFFICIAL" : competitionMode,
    competitionType: canonical?.mode || null,
    venueId: trimId(canonical?.venue_id || canonical?.payload?.venueId) || null,
    clubId: trimId(canonical?.club_id || canonical?.payload?.clubId) || null,
    matches: Object.freeze({ ...index.matches }),
    matchups: Object.freeze({ ...index.matchups }),
    canonicalAssignmentAuthorityAvailable: true
  });
}
function resolvePhysicalCourtId(match = {}) {
  return isPhysicalCourtId(match.physicalCourtId) || isPhysicalCourtId(match.physical_court_id) || isPhysicalCourtId(match.courtId) || isPhysicalCourtId(match.court_id) || null;
}
function isUuid(value) {
  return UUID_RE2.test(String(value || "").trim());
}

// src/features/competition-engine/operations/referee/assignment/server/assertTrustedAssignmentAuthz.js
function rpcFailed(error) {
  if (!error) return false;
  const combined = `${error.message || ""} ${error.details || ""} ${error.code || ""}`;
  return /TOURNAMENT_FORBIDDEN|TOURNAMENT_MISSING_TENANT|TOURNAMENT_NOT_FOUND|42501|PGRST/i.test(
    combined
  ) ? combined : combined || "RPC failed";
}
async function callUserRpc(userClient, name, args) {
  const { data, error } = await userClient.rpc(name, args);
  return { data, error };
}
function unwrapRpc(data) {
  if (data && typeof data === "object") return data;
  return null;
}
async function assertConcreteCanonicalTournament(userClient, input) {
  const tournamentId = String(input.tournamentId || "").trim();
  const tenantId = String(input.tenantId || "").trim();
  const clubId = String(input.clubId || "").trim();
  const canonicalId = String(input.canonicalId || "").trim();
  const targetId = isUuid(canonicalId) ? canonicalId : isUuid(tournamentId) ? tournamentId : "";
  if (!targetId || !clubId) return false;
  const got = await callUserRpc(userClient, "canonical_tournament_get", {
    p_tenant_id: tenantId,
    p_club_id: clubId,
    p_tournament_id: targetId
  });
  if (got.error) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      rpcFailed(got.error) || "Canonical tournament binding failed",
      { tenantId, tournamentId }
    );
  }
  const payload = unwrapRpc(got.data);
  if (payload && payload.ok === false) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      "Canonical tournament is not bound for the authenticated actor",
      { tenantId, tournamentId, code: payload.code || null }
    );
  }
  return true;
}
async function assertConcreteTeamTournament(userClient, tournamentId) {
  const got = await callUserRpc(userClient, "team_tournament_get_setup", {
    p_tournament_id: tournamentId
  });
  if (got.error) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      rpcFailed(got.error) || "Team tournament binding failed",
      { tournamentId }
    );
  }
  const payload = unwrapRpc(got.data);
  if (payload && payload.ok === false) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      "Team tournament is not bound for the authenticated actor",
      { tournamentId, code: payload.code || null }
    );
  }
  return true;
}
async function assertTrustedAssignmentAuthz(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const actorId = String(input.actorId || "").trim();
  const userClient = input.userClient;
  if (!tenantId || !tournamentId || !actorId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
      "tenantId, tournamentId, and authenticated actorId are required",
      {}
    );
  }
  const tenant = await callUserRpc(userClient, "canonical_tournament_assert_tenant", {
    p_tenant_id: tenantId
  });
  if (tenant.error) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED,
      rpcFailed(tenant.error) || "Canonical tenant assertion failed",
      { tenantId }
    );
  }
  let permOk = false;
  const perm = await callUserRpc(
    userClient,
    "canonical_tournament_assert_permission",
    { p_permission: "tournament.update" }
  );
  if (!perm.error) permOk = true;
  if (!permOk) {
    const teamManage = await callUserRpc(userClient, "team_tournament_can_manage", {});
    if (!teamManage.error && teamManage.data === true) permOk = true;
  }
  if (!permOk) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
      "tournament.update / team.manage authorization denied",
      { tenantId, tournamentId, actorId }
    );
  }
  let concreteBound = false;
  if (input.canonicalBound !== false) {
    concreteBound = await assertConcreteCanonicalTournament(userClient, {
      tenantId,
      tournamentId,
      clubId: input.clubId,
      canonicalId: input.canonicalId
    }) || concreteBound;
  }
  if (input.teamBound === true) {
    concreteBound = await assertConcreteTeamTournament(userClient, tournamentId) || concreteBound;
  }
  return Object.freeze({
    tenantId,
    tournamentId,
    actorId,
    actorAuthorized: true,
    tournamentBound: true,
    concreteTournamentBound: concreteBound
  });
}

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
function isRefereeRole(role) {
  return rolesEqual(role, ROLES.REFEREE);
}

// src/features/competition-engine/integration/contracts/kernel/constants.js
var COMPETITION_ADAPTER_CONTRACT_VERSION_V1 = "1.0.0";
var COMPETITION_ADAPTER_CONTRACT_LOCKED = true;
var CAPABILITY_KIND = Object.freeze({
  QUERY: "QUERY",
  COMMAND: "COMMAND",
  EVENT: "EVENT"
});
var CAPABILITY_KIND_VALUES = Object.freeze(Object.values(CAPABILITY_KIND));
var ADAPTER_DIRECTION = Object.freeze({
  INBOUND_QUERY: "INBOUND_QUERY",
  OUTBOUND_COMMAND: "OUTBOUND_COMMAND",
  OUTBOUND_EVENT: "OUTBOUND_EVENT",
  MIXED: "MIXED"
});
var RUNTIME_CLASSIFICATION = Object.freeze({
  EXISTING_CANONICAL_CAPABILITY: "EXISTING_CANONICAL_CAPABILITY",
  EXISTING_PARTIAL_CAPABILITY: "EXISTING_PARTIAL_CAPABILITY",
  CONTRACT_ONLY_NO_RUNTIME: "CONTRACT_ONLY_NO_RUNTIME",
  EXTERNAL_FUTURE_CAPABILITY: "EXTERNAL_FUTURE_CAPABILITY"
});
var PRODUCTION_BINDING_STATUS = Object.freeze({
  BOUND: "BOUND",
  PARTIAL: "PARTIAL",
  NOT_CONFIGURED: "NOT_CONFIGURED"
});
var SHARED_ADAPTER_ERROR_CODE = Object.freeze({
  UNKNOWN_CONTRACT: "COMPETITION_ADAPTER_UNKNOWN_CONTRACT",
  INCOMPATIBLE_CONTRACT_VERSION: "COMPETITION_ADAPTER_INCOMPATIBLE_CONTRACT_VERSION",
  MALFORMED_ADAPTER: "COMPETITION_ADAPTER_MALFORMED_ADAPTER",
  MISSING_REQUIRED_CONTEXT: "COMPETITION_ADAPTER_MISSING_REQUIRED_CONTEXT",
  CROSS_TENANT_CONTEXT: "COMPETITION_ADAPTER_CROSS_TENANT_CONTEXT",
  MISSING_CANONICAL_IDENTITY: "COMPETITION_ADAPTER_MISSING_CANONICAL_IDENTITY",
  FORBIDDEN_AUTHORITY: "COMPETITION_ADAPTER_FORBIDDEN_AUTHORITY",
  NOT_CONFIGURED: "COMPETITION_ADAPTER_NOT_CONFIGURED",
  CAPABILITY_NOT_SUPPORTED: "COMPETITION_ADAPTER_CAPABILITY_NOT_SUPPORTED",
  STALE_WRITE: "COMPETITION_ADAPTER_STALE_WRITE",
  MISSING_IDEMPOTENCY: "COMPETITION_ADAPTER_MISSING_IDEMPOTENCY",
  MALFORMED_RESPONSE: "COMPETITION_ADAPTER_MALFORMED_RESPONSE",
  FUZZY_IDENTITY_FORBIDDEN: "COMPETITION_ADAPTER_FUZZY_IDENTITY_FORBIDDEN",
  DUPLICATE_REGISTRATION: "COMPETITION_ADAPTER_DUPLICATE_REGISTRATION",
  REGISTRY_FROZEN: "COMPETITION_ADAPTER_REGISTRY_FROZEN",
  DISPLAY_NAME_IS_NOT_IDENTITY: "COMPETITION_ADAPTER_DISPLAY_NAME_IS_NOT_IDENTITY"
});
var SHARED_ADAPTER_ERROR_CODE_VALUES = Object.freeze(
  Object.values(SHARED_ADAPTER_ERROR_CODE)
);
var FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS = Object.freeze([
  "eligibilityDecisionEngine",
  "seedingEngine",
  "pairingEngine",
  "drawEngine",
  "scheduleEngine",
  "courtAssignmentEngine",
  "refereeAssignmentEngine",
  "scoringEngine",
  "standingsEngine",
  "qualificationEngine",
  "knockoutEngine",
  "championEngine",
  "competitionLifecycleEngine"
]);
var SHARED_FORBIDDEN_METHODS = Object.freeze([
  "decideEligibility",
  "runSeeding",
  "runPairing",
  "runDraw",
  "runSchedule",
  "assignCourts",
  "assignReferees",
  "calculateScore",
  "writeCanonicalScore",
  "computeStandings",
  "decideQualification",
  "decideKnockout",
  "decideChampion",
  "advanceCompetitionLifecycle"
]);
var CANONICAL_CONTEXT_FIELDS = Object.freeze({
  ALWAYS_APPLICABLE: Object.freeze([
    "contractVersion",
    "tenantId",
    "competitionId",
    "correlationId"
  ]),
  ACTOR_SENSITIVE: Object.freeze(["actorId"]),
  WHEN_APPLICABLE: Object.freeze([
    "organizationId",
    "clubId",
    "teamId",
    "participantId",
    "matchId",
    "sourceVersion",
    "snapshotId",
    "effectiveAt",
    "venueId"
  ]),
  MUTATION: Object.freeze(["expectedVersion", "idempotencyKey"])
});
var FUZZY_IDENTITY_FIELDS = Object.freeze([
  "displayName",
  "playerName",
  "email",
  "phone",
  "phoneNumber",
  "fullName",
  "name"
]);
var DISTINCT_SCOPE_KEYS = Object.freeze([
  "tenantId",
  "organizationId",
  "clubId",
  "venueId"
]);
var WORKSTREAM_OWNED_CONTRACT_IDS = Object.freeze([
  "competition.identity-access.adapter.v1",
  "competition.tenant-organization.adapter.v1",
  "competition.participant.adapter.v1",
  "competition.club-team-membership.adapter.v1",
  "competition.rating.adapter.v1",
  "competition.ranking.adapter.v1",
  "competition.finance-payment.adapter.v1",
  "competition.notification-communication.adapter.v1",
  "competition.file-media.adapter.v1",
  "competition.streaming-scoreboard.adapter.v1",
  "competition.federation-external-authority.adapter.v1",
  "competition.crm-sponsor.adapter.v1",
  "competition.analytics-reporting.adapter.v1",
  "competition.audit.adapter.v1"
]);
var COURT_CONTRACT_PROTECTED_PATHS = Object.freeze([
  "src/features/competition-core/contracts/competitionCourtAdapterContract.js",
  "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js",
  "docs/competition-core/COMPETITION_COURT_ADAPTER_CONTRACT.md",
  "tests/competition-core-court-adapter-contract.test.js",
  "tests/competition-core-court-adapter-architecture.test.js"
]);
var REFEREE_CONTRACT_PROTECTED_PATHS = Object.freeze([
  "src/features/competition-engine/integration/referee/contract.js",
  "src/features/competition-engine/integration/referee/registry.js",
  "src/features/competition-engine/integration/referee/conformance.js",
  "src/features/competition-engine/integration/referee/errors.js",
  "src/features/competition-engine/integration/referee/referenceAdapter.js",
  "src/features/competition-engine/integration/referee/runtimePorts.js",
  "tests/competition-engine-referee-adapter-contract-v1.test.js"
]);
var PRIVATE_PERSISTENCE_IMPORT_PATTERNS = Object.freeze([
  "domain/clubStorage",
  "auth/supabaseClient",
  "@supabase/supabase-js",
  "club_data_v3"
]);

// src/features/competition-engine/integration/contracts/kernel/helpers.js
function deepFreeze2(value) {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    const child = (
      /** @type {Record<string|symbol, unknown>} */
      value[key]
    );
    if (child && typeof child === "object") deepFreeze2(child);
  }
  return Object.freeze(value);
}
function clonePlain(value) {
  return structuredClone(value);
}
function freezeClone(value) {
  return deepFreeze2(clonePlain(value));
}

// src/features/competition-engine/integration/contracts/definitions.js
function capability(name, kind, extra = {}) {
  return Object.freeze({ name, kind, required: extra.required !== false, ...extra });
}
function defineContract(spec) {
  const {
    forbiddenAuthorityKeys = [],
    forbiddenMethods = [],
    errorCodes = [],
    ...rest
  } = spec;
  return freezeClone({
    contractVersion: COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
    locked: COMPETITION_ADAPTER_CONTRACT_LOCKED,
    ...rest,
    forbiddenAuthorityKeys: [
      ...FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS,
      ...forbiddenAuthorityKeys
    ],
    forbiddenMethods: [...SHARED_FORBIDDEN_METHODS, ...forbiddenMethods],
    errorCodes: [...Object.values(SHARED_ADAPTER_ERROR_CODE), ...errorCodes]
  });
}
var IDENTITY_ACCESS_CONTRACT = defineContract({
  ordinal: 1,
  contractId: "competition.identity-access.adapter.v1",
  domain: "identity-access",
  authorityOwner: "src/features/identity",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_CANONICAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.BOUND,
  requiredContext: ["contractVersion", "tenantId", "actorId", "correlationId"],
  capabilities: [
    capability("resolveActorIdentity", CAPABILITY_KIND.QUERY),
    capability("getAuthorizationEvidence", CAPABILITY_KIND.QUERY),
    capability("getCapabilityEvidence", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: [
    "resolveActorIdentity",
    "getAuthorizationEvidence",
    "getCapabilityEvidence"
  ],
  forbiddenMethods: [
    "authenticateCredentials",
    "mintSession",
    "storePassword",
    "grantPermission",
    "createRole",
    "inferIdentityByDisplayName"
  ]
});
var TENANT_ORGANIZATION_CONTRACT = defineContract({
  ordinal: 2,
  contractId: "competition.tenant-organization.adapter.v1",
  domain: "tenant-organization",
  authorityOwner: "src/features/tenant",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("resolveTenantIdentity", CAPABILITY_KIND.QUERY),
    capability("validateScope", CAPABILITY_KIND.QUERY),
    capability("distinguishScopeIds", CAPABILITY_KIND.QUERY),
    capability("resolveOrganizationIdentity", CAPABILITY_KIND.QUERY),
    capability("getOrganizationStatus", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: [
    "resolveTenantIdentity",
    "validateScope",
    "distinguishScopeIds",
    "resolveOrganizationIdentity",
    "getOrganizationStatus"
  ],
  forbiddenMethods: [
    "createTenant",
    "createOrganization",
    "inferTenantFromDisplayName"
  ]
});
var PARTICIPANT_CONTRACT = defineContract({
  ordinal: 3,
  contractId: "competition.participant.adapter.v1",
  domain: "participant",
  authorityOwner: "src/features/player",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_CANONICAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.BOUND,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("resolveCanonicalParticipant", CAPABILITY_KIND.QUERY),
    capability("getCompetitionSafeProfile", CAPABILITY_KIND.QUERY),
    capability("verifySourceStatus", CAPABILITY_KIND.QUERY),
    capability("getParticipantSnapshot", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: [
    "resolveCanonicalParticipant",
    "getCompetitionSafeProfile",
    "verifySourceStatus",
    "getParticipantSnapshot"
  ],
  forbiddenMethods: [
    "mutatePlayerProfile",
    "createPlayer",
    "inferParticipantByDisplayName"
  ]
});
var CLUB_TEAM_MEMBERSHIP_CONTRACT = defineContract({
  ordinal: 4,
  contractId: "competition.club-team-membership.adapter.v1",
  domain: "club-team-membership",
  authorityOwner: "src/features/club",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_CANONICAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getClubAffiliation", CAPABILITY_KIND.QUERY),
    capability("getMembershipStatus", CAPABILITY_KIND.QUERY),
    capability("getMembershipEvidence", CAPABILITY_KIND.QUERY),
    capability("getTeamIdentity", CAPABILITY_KIND.QUERY),
    capability("getTeamRoster", CAPABILITY_KIND.QUERY),
    capability("getCaptainRelationship", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: [
    "getClubAffiliation",
    "getMembershipStatus",
    "getMembershipEvidence",
    "getTeamIdentity",
    "getTeamRoster",
    "getCaptainRelationship"
  ],
  forbiddenMethods: [
    "decideSeed",
    "decideDraw",
    "decideMatchup",
    "decideStandings",
    "decideChampion",
    "decideEligibilityFinal"
  ]
});
var RATING_CONTRACT = defineContract({
  ordinal: 5,
  contractId: "competition.rating.adapter.v1",
  domain: "rating",
  authorityOwner: "src/features/player-rating",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getRatingSnapshot", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: ["getRatingSnapshot"],
  forbiddenMethods: [
    "calculateSeed",
    "formPairs",
    "mutateLockedDraw",
    "ownRatingEngine"
  ]
});
var RANKING_CONTRACT = defineContract({
  ordinal: 6,
  contractId: "competition.ranking.adapter.v1",
  domain: "ranking",
  authorityOwner: "src/features/vpr-ranking",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getRankingSnapshot", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: ["getRankingSnapshot"],
  forbiddenMethods: ["runRankingEngine", "mutateLockedDrawFromRanking"]
});
var FINANCE_PAYMENT_CONTRACT = defineContract({
  ordinal: 9,
  contractId: "competition.finance-payment.adapter.v1",
  domain: "finance-payment",
  authorityOwner: "src/features/finance",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.CONTRACT_ONLY_NO_RUNTIME,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "competitionId", "correlationId"],
  capabilities: [
    capability("getEntryFeeStatus", CAPABILITY_KIND.QUERY),
    capability("getPaymentState", CAPABILITY_KIND.QUERY),
    capability("getWaiverStatus", CAPABILITY_KIND.QUERY),
    capability("getRefundState", CAPABILITY_KIND.QUERY),
    capability("getSettlementReference", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: [
    "getEntryFeeStatus",
    "getPaymentState",
    "getWaiverStatus",
    "getRefundState",
    "getSettlementReference"
  ],
  forbiddenMethods: [
    "postLedgerEntry",
    "ownAccounting",
    "createPaymentProcessor",
    "createPaymentIntent",
    "refundPayment"
  ]
});
var NOTIFICATION_COMMUNICATION_CONTRACT = defineContract({
  ordinal: 10,
  contractId: "competition.notification-communication.adapter.v1",
  domain: "notification-communication",
  authorityOwner: "src/features/notifications",
  direction: ADAPTER_DIRECTION.OUTBOUND_EVENT,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("publishCompetitionCommunicationEvent", CAPABILITY_KIND.EVENT, {
      requiresIdempotencyKey: true
    })
  ],
  requiredMethods: ["publishCompetitionCommunicationEvent"],
  forbiddenMethods: ["decideCompetitionLifecycle", "mutateMatchResult"]
});
var FILE_MEDIA_CONTRACT = defineContract({
  ordinal: 11,
  contractId: "competition.file-media.adapter.v1",
  domain: "file-media",
  authorityOwner: "none-canonical",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.CONTRACT_ONLY_NO_RUNTIME,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getDocumentReference", CAPABILITY_KIND.QUERY),
    capability("getMediaReference", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: ["getDocumentReference", "getMediaReference"],
  forbiddenMethods: ["ownFileStorage", "bindStorageProvider"]
});
var STREAMING_SCOREBOARD_CONTRACT = defineContract({
  ordinal: 12,
  contractId: "competition.streaming-scoreboard.adapter.v1",
  domain: "streaming-scoreboard",
  authorityOwner: "src/features/tournament-broadcast",
  direction: ADAPTER_DIRECTION.OUTBOUND_EVENT,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "competitionId", "correlationId"],
  capabilities: [
    capability("publishScoreboardProjection", CAPABILITY_KIND.EVENT),
    capability("getStreamingMetadata", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: ["publishScoreboardProjection", "getStreamingMetadata"],
  forbiddenMethods: ["writeCanonicalScore", "decideScoring"]
});
var FEDERATION_EXTERNAL_AUTHORITY_CONTRACT = defineContract({
  ordinal: 13,
  contractId: "competition.federation-external-authority.adapter.v1",
  domain: "federation-external-authority",
  authorityOwner: "src/features/ecosystem-integrations",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.CONTRACT_ONLY_NO_RUNTIME,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getFederationPlayerEvidence", CAPABILITY_KIND.QUERY),
    capability("getLicenseEvidence", CAPABILITY_KIND.QUERY),
    capability("getSanctionEvidence", CAPABILITY_KIND.QUERY),
    capability("getExternalEligibilityEvidence", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: [
    "getFederationPlayerEvidence",
    "getLicenseEvidence",
    "getSanctionEvidence",
    "getExternalEligibilityEvidence"
  ],
  forbiddenMethods: ["inventFederationData", "decideFinalEligibility"]
});
var CRM_SPONSOR_CONTRACT = defineContract({
  ordinal: 14,
  contractId: "competition.crm-sponsor.adapter.v1",
  domain: "crm-sponsor",
  authorityOwner: "src/features/crm",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.CONTRACT_ONLY_NO_RUNTIME,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getSponsorReference", CAPABILITY_KIND.QUERY),
    capability("getSponsorPackageReference", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: ["getSponsorReference", "getSponsorPackageReference"],
  forbiddenMethods: ["ownTournament", "exposeSensitiveCrmStorage"]
});
var ANALYTICS_REPORTING_CONTRACT = defineContract({
  ordinal: 15,
  contractId: "competition.analytics-reporting.adapter.v1",
  domain: "analytics-reporting",
  authorityOwner: "src/features/intelligence-analytics",
  direction: ADAPTER_DIRECTION.OUTBOUND_EVENT,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("publishCompetitionAnalyticsFact", CAPABILITY_KIND.EVENT),
    capability("getNonAuthoritativeReport", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: [
    "publishCompetitionAnalyticsFact",
    "getNonAuthoritativeReport"
  ],
  forbiddenMethods: ["writeCanonicalResult", "feedDerivedAsTruth"]
});
var AUDIT_CONTRACT = defineContract({
  ordinal: 16,
  contractId: "competition.audit.adapter.v1",
  domain: "audit",
  authorityOwner: "src/features/identity/services/auditService.js + competition-core/audit",
  direction: ADAPTER_DIRECTION.MIXED,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "actorId", "correlationId"],
  capabilities: [
    capability("appendAuditRecord", CAPABILITY_KIND.COMMAND),
    capability("queryAuditEvidence", CAPABILITY_KIND.QUERY)
  ],
  requiredMethods: ["appendAuditRecord", "queryAuditEvidence"],
  forbiddenMethods: [
    "approveBusinessOperation",
    "mutateCompetitionDecision",
    "replaceDomainPersistence",
    "dropRequiredAuditEvent"
  ]
});
var WORKSTREAM_CONTRACT_DEFINITIONS = Object.freeze([
  IDENTITY_ACCESS_CONTRACT,
  TENANT_ORGANIZATION_CONTRACT,
  PARTICIPANT_CONTRACT,
  CLUB_TEAM_MEMBERSHIP_CONTRACT,
  RATING_CONTRACT,
  RANKING_CONTRACT,
  FINANCE_PAYMENT_CONTRACT,
  NOTIFICATION_COMMUNICATION_CONTRACT,
  FILE_MEDIA_CONTRACT,
  STREAMING_SCOREBOARD_CONTRACT,
  FEDERATION_EXTERNAL_AUTHORITY_CONTRACT,
  CRM_SPONSOR_CONTRACT,
  ANALYTICS_REPORTING_CONTRACT,
  AUDIT_CONTRACT
]);
var WORKSTREAM_CONTRACTS_BY_ID = Object.freeze(
  Object.fromEntries(
    WORKSTREAM_CONTRACT_DEFINITIONS.map((def) => [def.contractId, def])
  )
);

// src/features/competition-engine/operations/referee/assignment/server/createIdentityBackedRefereeDirectoryPort.js
var CONTRACT_01_ID = IDENTITY_ACCESS_CONTRACT.contractId;
var CONTRACT_01_CURRENT_METHODS = Object.freeze([
  ...IDENTITY_ACCESS_CONTRACT.requiredMethods
]);
var CONTRACT_01_SUBJECT_DIRECTORY_METHODS = Object.freeze([
  "resolveSubjectIdentity",
  "getSubjectIdentityEvidence",
  "lookupSubjectIdentity"
]);
var IDENTITY_DIRECTORY_CAPABILITY = Object.freeze({
  NOT_CONFIGURED: "CONTRACT_01_SUBJECT_DIRECTORY_NOT_CONFIGURED",
  SUBJECT_IDENTITY: "CONTRACT_01_SUBJECT_IDENTITY"
});
function findSubjectDirectoryMethod(adapter) {
  if (!adapter || typeof adapter !== "object") return null;
  for (const name of CONTRACT_01_SUBJECT_DIRECTORY_METHODS) {
    if (typeof adapter[name] === "function") return name;
  }
  return null;
}
function readEvidenceData(evidence) {
  if (!evidence || typeof evidence !== "object") return {};
  if (evidence.data && typeof evidence.data === "object") return evidence.data;
  return evidence;
}
function isActiveStatus(value) {
  const raw = String(value ?? "active").trim().toLowerCase();
  return raw !== "inactive" && raw !== "disabled" && raw !== "suspended";
}
function createIdentityBackedRefereeDirectoryPort(options = {}) {
  const identityAccessAdapter = options.identityAccessAdapter || null;
  const subjectMethod = findSubjectDirectoryMethod(identityAccessAdapter);
  const source = subjectMethod ? IDENTITY_DIRECTORY_CAPABILITY.SUBJECT_IDENTITY : IDENTITY_DIRECTORY_CAPABILITY.NOT_CONFIGURED;
  return Object.freeze({
    source,
    contractId: CONTRACT_01_ID,
    synthesizesQualification: false,
    synthesizesAvailability: false,
    queriesIdentityPrivatePersistence: false,
    subjectDirectoryMethod: subjectMethod,
    async resolveRefereeDirectory(request = {}) {
      const refereeId = String(request.refereeId || "").trim();
      const tenantId = String(request.tenantId || "").trim();
      if (!refereeId) {
        return createMissingSnapshotResult(
          "No refereeId supplied for Identity directory lookup",
          { contractId: CONTRACT_01_ID }
        );
      }
      if (!isUuid(refereeId)) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical referee identity must be a UUID with Identity-domain evidence",
          { refereeId }
        );
      }
      if (!subjectMethod) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
          "Contract #01 does not provide subject directory lookup for an arbitrary referee",
          {
            contractId: CONTRACT_01_ID,
            missingCapability: "resolveSubjectIdentityDirectory",
            currentContractCapabilities: CONTRACT_01_CURRENT_METHODS,
            whyRequired: "CORE-13 needs canonical subject id, Identity role, active/inactive, and tenant/scope for the assigned referee \u2014 not the authenticated actor",
            whyDirectProfilesReadIsNotAcceptable: "Competition must not query Identity private persistence; evidence must enter through Contract #01 / Identity Adapter B",
            ownerGoRequired: true,
            sharedContractCapabilityGap: true
          }
        );
      }
      const evidence = await identityAccessAdapter[subjectMethod]({
        tenantId,
        actorId: refereeId,
        subjectId: refereeId,
        correlationId: request.correlationId || `core13-identity-${refereeId}`,
        contractVersion: IDENTITY_ACCESS_CONTRACT.contractVersion
      });
      const data = readEvidenceData(evidence);
      const subjectId = String(
        data.subjectId || data.userId || data.actorId || ""
      ).trim();
      if (!subjectId || subjectId !== refereeId) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical Identity subject evidence did not match refereeId",
          { refereeId, subjectId: subjectId || null }
        );
      }
      const evidenceTenant = String(
        data.tenantId || data.venueId || data.boundTenantId || ""
      ).trim();
      if (evidenceTenant && tenantId && evidenceTenant !== tenantId) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED,
          "Referee identity is not bound to the authenticated tenant",
          { refereeId, evidenceTenant, tenantId }
        );
      }
      if (!isRefereeRole(data.role)) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED,
          "Canonical Referee identity/source evidence is required (Identity role)",
          { refereeId, role: data.role || null }
        );
      }
      const active = isActiveStatus(data.status ?? data.active);
      return createPopulatedSnapshotResult([
        createRefereeCandidate({
          refereeId,
          active,
          userId: refereeId,
          displayLabel: data.displayLabel || data.displayName || void 0
        })
      ]);
    }
  });
}

// src/features/competition-engine/operations/referee/assignment/server/createNotConfiguredRefereeEvidencePorts.js
var REFEREE_EVIDENCE_CAPABILITY = Object.freeze({
  QUALIFICATION: "NOT_CONFIGURED",
  AVAILABILITY: "NOT_CONFIGURED",
  IDENTITY: "CONTRACT_01_SUBJECT_DIRECTORY_NOT_CONFIGURED",
  ACTIVE_STATUS: "CONTRACT_01_SUBJECT_DIRECTORY_NOT_CONFIGURED"
});
function createNotConfiguredQualificationSnapshot() {
  return createEmptySnapshotResult(
    "Referee qualification capability is NOT_CONFIGURED at Contract #08 / Adapter B"
  );
}
function createNotConfiguredAvailabilitySnapshot() {
  return createEmptySnapshotResult(
    "Referee availability capability is NOT_CONFIGURED at Contract #08 / Adapter B"
  );
}
function createRequiredMissingQualificationSnapshot() {
  return createMissingSnapshotResult(
    "Required qualification evidence is unavailable; fail closed"
  );
}
function createRequiredMissingAvailabilitySnapshot() {
  return createMissingSnapshotResult(
    "Required availability evidence is unavailable; fail closed"
  );
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
function isRefereeAdapterContractError(err) {
  return err instanceof RefereeAdapterContractError || Boolean(err) && typeof err === "object" && /** @type {{ name?: unknown }} */
  err.name === "RefereeAdapterContractError" && typeof /** @type {{ code?: unknown }} */
  err.code === "string";
}
function failRefereeAdapter(code, message, details) {
  throw new RefereeAdapterContractError(code, message, details);
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
var MATCH_STATUS = Object.freeze({
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
var MATCH_STATUS_VALUES = new Set(Object.values(MATCH_STATUS));
var MATCH_CORE_STATUS_VALUES = /* @__PURE__ */ new Set([
  MATCH_STATUS.DRAFT,
  MATCH_STATUS.READY,
  MATCH_STATUS.SCHEDULED,
  MATCH_STATUS.READY_TO_START,
  MATCH_STATUS.IN_PROGRESS,
  MATCH_STATUS.PAUSED,
  MATCH_STATUS.SUSPENDED,
  MATCH_STATUS.COMPLETED,
  MATCH_STATUS.CANCELLED,
  MATCH_STATUS.POSTPONED
]);

// src/features/competition-core/matches/mappers/statusMapper.js
var LEGACY_MATCH_STATUS_MAP = Object.freeze({
  waiting: MATCH_STATUS.READY,
  pending: MATCH_STATUS.READY,
  scheduled: MATCH_STATUS.SCHEDULED,
  assigned: MATCH_STATUS.READY_TO_START,
  ready: MATCH_STATUS.READY_TO_START,
  ready_to_start: MATCH_STATUS.READY_TO_START,
  lineup_open: MATCH_STATUS.LINEUPS_PENDING,
  lineups_pending: MATCH_STATUS.LINEUPS_PENDING,
  locked: MATCH_STATUS.READY_TO_START,
  published: MATCH_STATUS.READY_TO_START,
  playing: MATCH_STATUS.IN_PROGRESS,
  in_progress: MATCH_STATUS.IN_PROGRESS,
  inprogress: MATCH_STATUS.IN_PROGRESS,
  active: MATCH_STATUS.IN_PROGRESS,
  running: MATCH_STATUS.IN_PROGRESS,
  // Unambiguous legacy "paused" → canonical PAUSED (distinct from SUSPENDED).
  paused: MATCH_STATUS.PAUSED,
  pause: MATCH_STATUS.PAUSED,
  suspended: MATCH_STATUS.SUSPENDED,
  suspend: MATCH_STATUS.SUSPENDED,
  completed: MATCH_STATUS.COMPLETED,
  done: MATCH_STATUS.COMPLETED,
  finished: MATCH_STATUS.COMPLETED,
  forfeit: MATCH_STATUS.COMPLETED,
  walkover: MATCH_STATUS.COMPLETED,
  postponed: MATCH_STATUS.POSTPONED,
  cancelled: MATCH_STATUS.CANCELLED,
  canceled: MATCH_STATUS.CANCELLED,
  draft: MATCH_STATUS.DRAFT,
  not_started: MATCH_STATUS.READY
});
function mapLegacyMatchStatus(raw, options = {}) {
  if (raw == null || raw === "") {
    return options.defaultStatus || MATCH_STATUS.DRAFT;
  }
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  const mapped = LEGACY_MATCH_STATUS_MAP[key];
  if (mapped) return mapped;
  const upper = String(raw).trim().toUpperCase();
  if (Object.values(MATCH_STATUS).includes(upper)) return upper;
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
function isNonEmptyString(value) {
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
  const matchKey = isNonEmptyString(parts.matchIdentityKey) ? String(parts.matchIdentityKey).trim() : buildMatchIdentityKey({
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
  const identityKey = isNonEmptyString(partial?.identityKey) ? String(partial.identityKey).trim() : matchIdentityKey ? buildMatchSideId({ matchIdentityKey, sideKey }) : null;
  const id = isNonEmptyString(partial?.id) ? String(partial.id).trim() : identityKey || `side:${sideKey}`;
  const participantReferences = Array.isArray(partial?.participantReferences) ? partial.participantReferences.filter((p) => p && typeof p === "object" && isNonEmptyString(p.id)).map((p) => ({
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
  const identityKey = isNonEmptyString(partial?.identityKey) ? String(partial.identityKey).trim() : competitionId && contextId ? buildMatchIdentityKey({ competitionId, contextId }) : null;
  const sides = Array.isArray(partial?.sides) ? partial.sides.map(
    (side) => createMatchSide(side, {
      matchIdentityKey: identityKey || void 0,
      competitionId,
      contextId
    })
  ) : [];
  return {
    schemaVersion: String(partial?.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: isNonEmptyString(partial?.id) ? String(partial.id).trim() : identityKey || "",
    identityKey,
    competitionId,
    contextId,
    fixtureId: partial?.fixtureId == null || partial.fixtureId === "" ? null : String(partial.fixtureId),
    stageId: partial?.stageId == null || partial.stageId === "" ? null : String(partial.stageId),
    roundId: partial?.roundId == null || partial.roundId === "" ? null : String(partial.roundId),
    groupId: partial?.groupId == null || partial.groupId === "" ? null : String(partial.groupId),
    matchNumber: typeof partial?.matchNumber === "number" && Number.isInteger(partial.matchNumber) ? partial.matchNumber : null,
    formatType: partial?.formatType == null || partial.formatType === "" ? null : String(partial.formatType),
    status: isNonEmptyString(partial?.status) ? String(partial.status).trim().toUpperCase() : MATCH_STATUS.DRAFT,
    completionReason: isNonEmptyString(partial?.completionReason) ? String(partial.completionReason).trim().toUpperCase() : MATCH_COMPLETION_REASON.NONE,
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
    sourceType: isNonEmptyString(partial?.sourceType) ? String(partial.sourceType) : MATCH_SOURCE_TYPE.CANONICAL_MATCH,
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
    defaultStatus: MATCH_STATUS.DRAFT
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
    } : status === MATCH_STATUS.COMPLETED ? {
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
  MATCH_STATUS.COMPLETED,
  MATCH_STATUS.CANCELLED
]);
var MATCH_TRANSITION_MATRIX = Object.freeze([
  {
    action: MATCH_ACTION.MARK_READY,
    from: [MATCH_STATUS.DRAFT],
    to: MATCH_STATUS.READY
  },
  {
    action: MATCH_ACTION.SCHEDULE,
    from: [MATCH_STATUS.DRAFT, MATCH_STATUS.READY],
    to: MATCH_STATUS.SCHEDULED
  },
  {
    action: MATCH_ACTION.REQUIRE_LINEUPS,
    from: [
      MATCH_STATUS.READY,
      MATCH_STATUS.SCHEDULED,
      MATCH_STATUS.LINEUPS_PENDING
    ],
    to: MATCH_STATUS.LINEUPS_PENDING
  },
  {
    action: MATCH_ACTION.MARK_READY_TO_START,
    from: [
      MATCH_STATUS.READY,
      MATCH_STATUS.SCHEDULED,
      MATCH_STATUS.LINEUPS_PENDING,
      MATCH_STATUS.POSTPONED
    ],
    to: MATCH_STATUS.READY_TO_START
  },
  {
    action: MATCH_ACTION.START,
    from: [MATCH_STATUS.READY_TO_START, MATCH_STATUS.SCHEDULED],
    to: MATCH_STATUS.IN_PROGRESS
  },
  {
    action: MATCH_ACTION.PAUSE,
    from: [MATCH_STATUS.IN_PROGRESS],
    to: MATCH_STATUS.PAUSED
  },
  {
    action: MATCH_ACTION.SUSPEND,
    from: [MATCH_STATUS.IN_PROGRESS, MATCH_STATUS.PAUSED],
    to: MATCH_STATUS.SUSPENDED
  },
  {
    action: MATCH_ACTION.RESUME,
    from: [MATCH_STATUS.PAUSED, MATCH_STATUS.SUSPENDED],
    to: MATCH_STATUS.IN_PROGRESS
  },
  {
    action: MATCH_ACTION.COMPLETE,
    from: [
      MATCH_STATUS.IN_PROGRESS,
      MATCH_STATUS.PAUSED,
      MATCH_STATUS.SUSPENDED
    ],
    to: MATCH_STATUS.COMPLETED
  },
  {
    action: MATCH_ACTION.ABANDON,
    from: [
      MATCH_STATUS.IN_PROGRESS,
      MATCH_STATUS.PAUSED,
      MATCH_STATUS.SUSPENDED
    ],
    to: MATCH_STATUS.COMPLETED
  },
  {
    action: MATCH_ACTION.CANCEL,
    from: [
      MATCH_STATUS.DRAFT,
      MATCH_STATUS.READY,
      MATCH_STATUS.SCHEDULED,
      MATCH_STATUS.LINEUPS_PENDING,
      MATCH_STATUS.READY_TO_START,
      MATCH_STATUS.IN_PROGRESS,
      MATCH_STATUS.PAUSED,
      MATCH_STATUS.SUSPENDED,
      MATCH_STATUS.POSTPONED
    ],
    to: MATCH_STATUS.CANCELLED
  },
  {
    action: MATCH_ACTION.POSTPONE,
    from: [
      MATCH_STATUS.SCHEDULED,
      MATCH_STATUS.LINEUPS_PENDING,
      MATCH_STATUS.READY_TO_START
    ],
    to: MATCH_STATUS.POSTPONED
  },
  {
    action: MATCH_ACTION.RESCHEDULE,
    from: [MATCH_STATUS.POSTPONED],
    to: MATCH_STATUS.SCHEDULED
  }
]);

// src/features/competition-core/matches/domain/createMatchLifecycleAuditEvent.js
var MATCH_LIFECYCLE_EVENT_TYPE = Object.freeze({
  TRANSITION: "MATCH_LIFECYCLE_TRANSITION"
});

// src/features/competition-engine/integration/referee/helpers.js
function isNonEmptyString2(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isPlainObject3(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function deepFreeze3(value) {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    const child = (
      /** @type {Record<string|symbol, unknown>} */
      value[key]
    );
    if (child && typeof child === "object") deepFreeze3(child);
  }
  return Object.freeze(value);
}
function clonePlain2(value) {
  return structuredClone(value);
}
function freezeClone2(value) {
  return deepFreeze3(clonePlain2(value));
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
  if (!isPlainObject3(request)) {
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
  return freezeClone2({
    tenantId,
    competitionId,
    matchId: isNonEmptyString2(request.matchId) ? String(request.matchId).trim() : null,
    venueId: isNonEmptyString2(request.venueId) ? String(request.venueId).trim() : null,
    clubId: isNonEmptyString2(request.clubId) ? String(request.clubId).trim() : null
  });
}
function assertScoringRulesPayload(scoringRules) {
  if (!isPlainObject3(scoringRules)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      "Scoring rules are required",
      {}
    );
  }
  try {
    return freezeClone2(createScoringFormat(scoringRules));
  } catch (err) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      err instanceof Error ? err.message : "Invalid scoring rules",
      {}
    );
  }
}
function assertResultPropagationPayload(propagation) {
  if (!isPlainObject3(propagation)) {
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
  return freezeClone2({
    propagateOnlyIfAccepted: true,
    targets: Array.isArray(propagation.targets) ? [...propagation.targets] : Object.freeze(["standings", "bracket", "qualification", "aggregate"]),
    instructions: isPlainObject3(propagation.instructions) ? propagation.instructions : {}
  });
}

// src/features/competition-engine/integration/referee/adapters/shared/matchStatusMapper.js
var STATUS_MAP = Object.freeze({
  DRAFT: MATCH_STATUS.DRAFT,
  READY: MATCH_STATUS.READY,
  SCHEDULED: MATCH_STATUS.SCHEDULED,
  LINEUPS_PENDING: MATCH_STATUS.LINEUPS_PENDING,
  READY_TO_START: MATCH_STATUS.READY_TO_START,
  IN_PROGRESS: MATCH_STATUS.IN_PROGRESS,
  PAUSED: MATCH_STATUS.PAUSED,
  SUSPENDED: MATCH_STATUS.SUSPENDED,
  COMPLETED: MATCH_STATUS.COMPLETED,
  CANCELLED: MATCH_STATUS.CANCELLED,
  POSTPONED: MATCH_STATUS.POSTPONED,
  // Legacy / mode labels
  WAITING: MATCH_STATUS.READY_TO_START,
  PENDING: MATCH_STATUS.SCHEDULED,
  PLAYING: MATCH_STATUS.IN_PROGRESS,
  ACTIVE: MATCH_STATUS.IN_PROGRESS,
  RUNNING: MATCH_STATUS.IN_PROGRESS,
  STARTED: MATCH_STATUS.IN_PROGRESS,
  INPROGRESS: MATCH_STATUS.IN_PROGRESS,
  DONE: MATCH_STATUS.COMPLETED,
  FINISHED: MATCH_STATUS.COMPLETED,
  PLAYED: MATCH_STATUS.COMPLETED,
  CLOSED: MATCH_STATUS.COMPLETED,
  CANCEL: MATCH_STATUS.CANCELLED,
  CANCELED: MATCH_STATUS.CANCELLED
});
function mapModeStatusToCore15(raw) {
  const key = String(raw || "").trim().toUpperCase().replace(/[-\s]+/g, "_");
  if (!key) return MATCH_STATUS.READY_TO_START;
  return STATUS_MAP[key] || MATCH_STATUS.READY_TO_START;
}

// src/features/competition-engine/integration/referee/adapters/shared/modeContext.js
function loadModeCompetitionState(state, request, expectedMode) {
  const req = requireAdapterRequest(request);
  if (!isPlainObject3(state)) {
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
  return { req, state: freezeClone2(state), tenantId, competitionId };
}
function requireModeMatch(state, matchId) {
  if (!isNonEmptyString2(matchId)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
      "matchId is required",
      {}
    );
  }
  const id = String(matchId).trim();
  const matches = isPlainObject3(state.matches) ? state.matches : null;
  if (!matches || !isPlainObject3(matches[id])) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
      `Unknown match: ${id}`,
      { matchId: id }
    );
  }
  return freezeClone2({ ...matches[id], matchId: id });
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
    if (!isPlainObject3(side)) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
        "Participant side must be a plain object",
        { index }
      );
    }
    const sideKey = isNonEmptyString2(side.sideKey) || isNonEmptyString2(side.side) ? String(side.sideKey || side.side).trim().toUpperCase() : index === 0 ? "A" : "B";
    const participantIds = Array.isArray(side.participantIds) ? side.participantIds.map((id) => String(id)) : [];
    return freezeClone2({
      sideKey,
      entryId: isNonEmptyString2(side.entryId) ? String(side.entryId).trim() : null,
      teamId: isNonEmptyString2(side.teamId) ? String(side.teamId).trim() : null,
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
  if (isPlainObject3(options.modeState)) {
    return options.modeState;
  }
  if (isPlainObject3(request) && isPlainObject3(request.modeState)) {
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
      MATCH_STATUS.READY_TO_START,
      MATCH_STATUS.SCHEDULED
    ],
    completionRequiresAcceptedResult: overrides.completionRequiresAcceptedResult === true,
    ...overrides
  };
  return freezeClone2({
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
  return freezeClone2({
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
  if (!isPlainObject3(raw)) {
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
  if (!isPlainObject3(state)) {
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
      const session = isPlainObject3(state.session) ? state.session : {};
      return freezeClone2({
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
      return freezeClone2({
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
        sessionId: isPlainObject3(state.session) && state.session.sessionId || competitionId,
        matchType: match.matchType || state.matchType || null
      });
    },
    getParticipants(request) {
      const { match } = load(request);
      return freezeClone2({
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
      const skipScore = state.skipScore === true || isPlainObject3(state.session) && state.session.skipScore === true;
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
      return freezeClone2({
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
      return freezeClone2({
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
      return freezeClone2({
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
      return freezeClone2({
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
      return freezeClone2({
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
  if (!isPlainObject3(state)) {
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
  if (isNonEmptyString2(state.browserExposedPrivilegedRpc) || state.callBrowserExposedPrivilegedRpc === true) {
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
  if (!isPlainObject3(state)) {
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
  if (!isNonEmptyString2(matchId)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
      "matchId is required",
      {}
    );
  }
  const id = String(matchId).trim();
  const matchups = isPlainObject3(state.matchups) ? state.matchups : {};
  const matches = isPlainObject3(state.matches) ? state.matches : {};
  if (isPlainObject3(matches[id])) {
    const row = matches[id];
    const matchupId = String(row.matchupId || row.parentMatchId || "").trim();
    const matchup = matchupId && isPlainObject3(matchups[matchupId]) ? matchups[matchupId] : null;
    return freezeClone2({
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
  if (isPlainObject3(matchups[id])) {
    const matchup = {
      ...matchups[id],
      matchupId: matchups[id].matchupId || id
    };
    return freezeClone2({
      matchId: id,
      matchupId: id,
      matchup,
      subMatch: null,
      isParent: true,
      isDreambreaker: false
    });
  }
  for (const [matchupId, rawMatchup] of Object.entries(matchups)) {
    if (!isPlainObject3(rawMatchup)) continue;
    const matchup = { ...rawMatchup, matchupId: rawMatchup.matchupId || matchupId };
    const subs = Array.isArray(matchup.subMatches) ? matchup.subMatches : [];
    const sub = subs.find((item) => String(item?.id || item?.subMatchId || "") === id);
    if (sub) {
      const isDreambreaker = sub.isDreambreaker === true || String(sub.discipline || "").toLowerCase() === "dreambreaker" || String(id).startsWith("db-");
      return freezeClone2({
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
      return freezeClone2({
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
      return freezeClone2({
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
        dreambreakerProjection: isPlainObject3(matchup.dreambreaker) ? {
          status: matchup.dreambreaker.status || null,
          required: matchup.dreambreaker.required === true,
          // Rotation state stays in Team domain; expose presence only
          rotationOwnedByTeamDomain: true
        } : null
      });
    },
    getParticipants(request) {
      const { resolved } = load(request);
      return freezeClone2({
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
      return freezeClone2({
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
      return freezeClone2({
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

// src/features/competition-engine/operations/referee/assignment/server/createTrustedServerRefereeAdapterB.js
function resolveAdapterMode(competitionMode) {
  const mode = String(competitionMode || "").trim().toUpperCase();
  if (mode === ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY) {
    return COMPETITION_REFEREE_MODE.DAILY_PLAY;
  }
  if (mode === ASSIGNMENT_COMPETITION_MODE.TEAM) {
    return COMPETITION_REFEREE_MODE.TEAM;
  }
  if (mode === ASSIGNMENT_COMPETITION_MODE.OFFICIAL_OPEN || mode === "OFFICIAL") {
    return COMPETITION_REFEREE_MODE.OFFICIAL;
  }
  return COMPETITION_REFEREE_MODE.INTERNAL;
}
function createTrustedServerRefereeAdapterB(input = {}) {
  const adapterMode = resolveAdapterMode(input.competitionMode);
  const modeState = buildAdapterBModeState({
    ...input,
    competitionMode: adapterMode
  });
  const options = { modeState };
  const adapter = adapterMode === COMPETITION_REFEREE_MODE.DAILY_PLAY ? createDailyPlayRefereeAdapter(options) : adapterMode === COMPETITION_REFEREE_MODE.TEAM ? createTeamTournamentRefereeAdapter(options) : adapterMode === COMPETITION_REFEREE_MODE.OFFICIAL ? createOfficialTournamentRefereeAdapter(options) : createInternalTournamentRefereeAdapter(options);
  return Object.freeze({
    adapter,
    modeState,
    adapterMode,
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    ownsRefereeIdentity: false,
    isRefereeAdapterContractError
  });
}

// src/features/competition-engine/operations/referee/assignment/server/projectMatchScheduleFromAdapterB.js
function readInstant(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}
function readDurationMs(match = {}, context = {}) {
  const minutes = Number(match.durationMinutes) || Number(match.matchDurationMinutes) || Number(match.durationMin) || Number(context.durationMinutes) || 0;
  if (Number.isFinite(minutes) && minutes > 0) {
    return minutes * 60 * 1e3;
  }
  const ms = Number(match.durationMs) || Number(match.durationMillis) || 0;
  if (Number.isFinite(ms) && ms > 0) return ms;
  return null;
}
function projectMatchScheduleFromAdapterB(input = {}) {
  const matchId = String(input.matchId || "").trim();
  const context = input.matchContext && typeof input.matchContext === "object" ? input.matchContext : {};
  const modeMatch = input.modeMatch && typeof input.modeMatch === "object" ? input.modeMatch : {};
  const startAt = readInstant(modeMatch.startAt) || readInstant(modeMatch.scheduledStart) || readInstant(modeMatch.scheduledAt) || readInstant(context.scheduledAt) || readInstant(context.startAt);
  const explicitEnd = readInstant(modeMatch.endAt) || readInstant(modeMatch.scheduledEnd) || readInstant(context.endAt) || readInstant(context.scheduledEnd);
  const durationMs = readDurationMs(modeMatch, context);
  const endAt = explicitEnd || (startAt && durationMs ? new Date(Date.parse(startAt) + durationMs).toISOString() : null);
  const courtId = resolvePhysicalCourtId(modeMatch) || resolvePhysicalCourtId(context) || null;
  const scheduled = Boolean(startAt && endAt);
  const row = createMatchScheduleRow({
    matchId,
    startAt,
    endAt,
    courtId
  });
  return Object.freeze({
    scheduleSnapshot: createPopulatedSnapshotResult([row]),
    startAt,
    endAt,
    courtId,
    scheduled,
    assignmentBeforeSchedule: !scheduled,
    source: "ADAPTER_B_GET_MATCH_CONTEXT"
  });
}
function createUnscheduledMatchSnapshot(matchId) {
  const id = trimId(matchId) || "unknown-match";
  const row = createMatchScheduleRow({
    matchId: id,
    startAt: null,
    endAt: null,
    courtId: null
  });
  return Object.freeze({
    scheduleSnapshot: createPopulatedSnapshotResult([row]),
    startAt: null,
    endAt: null,
    courtId: null,
    scheduled: false,
    assignmentBeforeSchedule: true,
    source: "UNSCHEDULED_HONEST"
  });
}

// src/features/competition-engine/operations/referee/assignment/server/loadAuthoritativeAssignmentEvidence.js
function mapLiveStatus(row) {
  if (!row) return { raw: "PRE_MATCH", scoringActive: false };
  const status = String(row.status || "").toLowerCase();
  const scoringActive = Number(row.last_event_sequence || 0) > 0 || Number(row.team_a_score || 0) > 0 || Number(row.team_b_score || 0) > 0;
  return { raw: status, scoringActive };
}
async function loadTournamentRows(serviceClient, tenantId) {
  const { data: canonicalRows } = await serviceClient.from("canonical_tournaments").select("id, tenant_id, club_id, status, mode, payload, external_key").eq("tenant_id", tenantId);
  const { data: teamRows } = await serviceClient.from("team_tournaments").select("id, tenant_id, tournament_id, status, payload").eq("tenant_id", tenantId);
  return { canonicalRows: canonicalRows || [], teamRows: teamRows || [] };
}
function bindTournament(canonicalRows, teamRows, tenantId, tournamentId) {
  const canonical = canonicalRows.find(
    (row) => String(row.id) === tournamentId || String(row.external_key) === tournamentId
  ) || null;
  const teamHeader = teamRows.find(
    (row) => String(row.tournament_id) === tournamentId || String(row.id) === tournamentId
  ) || null;
  if (!canonical && !teamHeader) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      "Tournament is not bound in the authenticated tenant",
      { tenantId, tournamentId }
    );
  }
  if (canonical && String(canonical.tenant_id) !== tenantId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED,
      "Canonical tournament tenant mismatch",
      { tenantId, tournamentId }
    );
  }
  if (teamHeader && String(teamHeader.tenant_id) !== tenantId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED,
      "Team tournament tenant mismatch",
      { tenantId, tournamentId }
    );
  }
  return { canonical, teamHeader };
}
function resolveScheduleFromAdapterB({
  adapterRuntime,
  tenantId,
  tournamentId,
  matchId
}) {
  const request = {
    tenantId,
    competitionId: tournamentId,
    matchId
  };
  try {
    const matchContext = adapterRuntime.adapter.getMatchContext(request);
    const modeMatch = adapterRuntime.modeState?.matches?.[matchId] || adapterRuntime.modeState?.matchups?.[matchId] || null;
    return projectMatchScheduleFromAdapterB({
      matchContext,
      modeMatch,
      matchId
    });
  } catch (err) {
    if (adapterRuntime.isRefereeAdapterContractError(err)) {
      return createUnscheduledMatchSnapshot(matchId);
    }
    throw err;
  }
}
async function loadAuthoritativeAssignmentEvidence(input = {}) {
  const serviceClient = input.serviceClient;
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const matchId = String(input.matchId || "").trim();
  const refereeId = String(input.refereeId || "").trim();
  const roleCode = input.roleCode || REFEREE_ROLE_CODE.PRIMARY;
  const competitionMode = String(input.competitionMode || "INTERNAL").toUpperCase();
  const requireQualification = input.requireQualification === true;
  const requireAvailability = input.requireAvailability === true;
  const { canonicalRows, teamRows } = await loadTournamentRows(
    serviceClient,
    tenantId
  );
  const { canonical, teamHeader } = bindTournament(
    canonicalRows,
    teamRows,
    tenantId,
    tournamentId
  );
  const { data: liveRows } = await serviceClient.from("match_live_states").select("status, last_event_sequence, team_a_score, team_b_score, updated_at").eq("tenant_id", tenantId).eq("match_id", matchId).order("updated_at", { ascending: false }).limit(1);
  const live = Array.isArray(liveRows) && liveRows[0] ? liveRows[0] : null;
  const liveMapped = mapLiveStatus(live);
  let lifecycleState = normalizeAssignmentLifecycleState(liveMapped.raw, {
    scoringActive: liveMapped.scoringActive
  });
  if (canonical?.status === "completed" || canonical?.status === "cancelled" || teamHeader?.status === "completed" || teamHeader?.status === "cancelled") {
    lifecycleState = "COMPLETED";
  }
  const adapterRuntime = createTrustedServerRefereeAdapterB({
    tenantId,
    tournamentId,
    competitionMode: teamHeader ? "TEAM" : competitionMode,
    canonical,
    teamHeader
  });
  const schedule = matchId ? resolveScheduleFromAdapterB({
    adapterRuntime,
    tenantId,
    tournamentId,
    matchId
  }) : createUnscheduledMatchSnapshot("missing-match");
  const directoryPort = createIdentityBackedRefereeDirectoryPort({
    identityAccessAdapter: input.identityAccessAdapter || null
  });
  let directorySnapshot = createEmptySnapshotResult(
    "No refereeId supplied for Identity directory lookup"
  );
  if (refereeId) {
    directorySnapshot = await directoryPort.resolveRefereeDirectory({
      tenantId,
      tournamentId,
      refereeId,
      roleCode
    });
  }
  const qualificationSnapshot = requireQualification ? createRequiredMissingQualificationSnapshot() : createNotConfiguredQualificationSnapshot();
  const availabilitySnapshot = requireAvailability ? createRequiredMissingAvailabilitySnapshot() : createNotConfiguredAvailabilitySnapshot();
  return Object.freeze({
    tenantId,
    tournamentId,
    matchId,
    lifecycleState,
    scoringActive: liveMapped.scoringActive === true || lifecycleState === "SCORING_ACTIVE",
    directorySnapshot,
    qualificationSnapshot,
    availabilitySnapshot,
    scheduleSnapshot: schedule.scheduleSnapshot,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    courtId: schedule.courtId,
    scheduled: schedule.scheduled === true,
    assignmentBeforeSchedule: schedule.assignmentBeforeSchedule === true,
    canonicalBound: Boolean(canonical),
    teamBound: Boolean(teamHeader),
    clubId: canonical?.club_id || null,
    canonicalId: canonical?.id || null,
    adapterBReused: true,
    adapterBContractId: adapterRuntime.contractId,
    adapterBOwnsRefereeIdentity: false,
    refereeIdentityEvidence: directoryPort.source || REFEREE_EVIDENCE_CAPABILITY.IDENTITY,
    refereeActiveStatusEvidence: directoryPort.source || REFEREE_EVIDENCE_CAPABILITY.ACTIVE_STATUS,
    refereeQualificationEvidence: REFEREE_EVIDENCE_CAPABILITY.QUALIFICATION,
    refereeAvailabilityEvidence: REFEREE_EVIDENCE_CAPABILITY.AVAILABILITY,
    requireQualification,
    requireAvailability,
    requireScheduleWindowForMandatoryRoles: schedule.scheduled === true,
    authoritativeScheduleSource: schedule.source
  });
}

// src/features/competition-engine/operations/referee/assignment/server/edgeHttpHandler.js
var COMPETITION_ASSIGNMENT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
async function verifyBearerToken(supabaseUserClient) {
  const { data, error } = await supabaseUserClient.auth.getUser();
  if (error || !data?.user?.id) {
    return {
      ok: false,
      code: ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
      error: "Invalid or expired token."
    };
  }
  return { ok: true, userId: data.user.id };
}
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...COMPETITION_ASSIGNMENT_CORS_HEADERS, "Content-Type": "application/json" }
  });
}
function mapHttpStatus(code) {
  switch (code) {
    case ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR:
      return 401;
    case ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED:
      return 403;
    case ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE:
    case ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT:
      return 409;
    case ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED:
    case ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED:
      return 422;
    default:
      return 400;
  }
}
function toErrorBody(err) {
  if (isCompetitionRefereeAssignmentCommandError(err)) {
    return {
      ok: false,
      code: err.code,
      error: err.message,
      details: err.details || {}
    };
  }
  return {
    ok: false,
    code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
    error: String(err?.message || err)
  };
}
function stripBrowserAuthority(command = {}) {
  const next = { ...command };
  delete next.actorId;
  delete next.actor;
  delete next.actorRef;
  delete next.clientGrantedPermissions;
  delete next.authorizedTenantId;
  delete next.authorizedTournamentId;
  delete next.lifecycleState;
  delete next.matchStatus;
  delete next.scoringActive;
  delete next.directorySnapshot;
  delete next.qualificationSnapshot;
  delete next.availabilitySnapshot;
  delete next.scheduleSnapshot;
  delete next.candidates;
  delete next.emergencyAuthorized;
  return next;
}
function createTrustedCompetitionAssignmentRuntime({ serviceClient }) {
  const persistence = createRpcCanonicalAssignmentPersistence({ serviceClient });
  const commandService = createCompetitionRefereeAssignmentCommandService({
    persistence,
    production: true,
    authorize: () => true,
    authorizeEmergency: (cmd) => cmd.emergencyReplacement === true
  });
  return { persistence, commandService };
}
async function handleCompetitionRefereeAssignmentAction({
  action,
  body,
  userClient,
  serviceClient,
  identityAccessAdapter
}) {
  try {
    return await executeCompetitionRefereeAssignmentAction({
      action,
      body,
      userClient,
      serviceClient,
      identityAccessAdapter
    });
  } catch (err) {
    const payload = toErrorBody(err);
    return { httpStatus: mapHttpStatus(payload.code), body: payload };
  }
}
async function executeCompetitionRefereeAssignmentAction({
  action,
  body,
  userClient,
  serviceClient,
  identityAccessAdapter
}) {
  const verified = await verifyBearerToken(userClient);
  if (!verified.ok) {
    return { httpStatus: 401, body: verified };
  }
  const incoming = body?.command && typeof body.command === "object" ? body.command : body || {};
  const command = stripBrowserAuthority(incoming);
  command.actorId = verified.userId;
  command.competitionMode = String(
    command.competitionMode || ASSIGNMENT_COMPETITION_MODE.INTERNAL
  ).toUpperCase();
  const authz = await assertTrustedAssignmentAuthz({
    userClient,
    tenantId: command.tenantId,
    tournamentId: command.tournamentId || command.competitionId,
    actorId: verified.userId,
    canonicalBound: false
  });
  const evidence = await loadAuthoritativeAssignmentEvidence({
    serviceClient,
    tenantId: authz.tenantId,
    tournamentId: authz.tournamentId,
    matchId: command.matchId,
    refereeId: command.refereeId || command.newRefereeId || null,
    roleCode: command.roleCode || command.role,
    competitionMode: command.competitionMode,
    requireQualification: command.requireQualification === true,
    requireAvailability: command.requireAvailability === true,
    identityAccessAdapter
  });
  await assertTrustedAssignmentAuthz({
    userClient,
    tenantId: authz.tenantId,
    tournamentId: authz.tournamentId,
    actorId: verified.userId,
    clubId: evidence.clubId || command.clubId,
    canonicalId: evidence.canonicalId,
    canonicalBound: evidence.canonicalBound,
    teamBound: evidence.teamBound
  });
  const prepared = {
    ...command,
    tenantId: authz.tenantId,
    tournamentId: authz.tournamentId,
    actorId: verified.userId,
    authorizedTenantId: authz.tenantId,
    authorizedTournamentId: authz.tournamentId,
    actorAuthorized: true,
    lifecycleState: evidence.lifecycleState,
    scoringActive: evidence.scoringActive,
    directorySnapshot: evidence.directorySnapshot,
    qualificationSnapshot: evidence.qualificationSnapshot,
    availabilitySnapshot: evidence.availabilitySnapshot,
    scheduleSnapshot: evidence.scheduleSnapshot,
    startAt: evidence.startAt,
    endAt: evidence.endAt,
    courtId: evidence.courtId,
    scheduled: evidence.scheduled,
    requireQualification: evidence.requireQualification,
    requireAvailability: evidence.requireAvailability,
    requireScheduleWindowForMandatoryRoles: evidence.requireScheduleWindowForMandatoryRoles,
    policy: {
      policyId: "core13-trusted-server-assignment",
      policyVersion: "1",
      requireScheduleWindowForMandatoryRoles: evidence.requireScheduleWindowForMandatoryRoles,
      allowSoftOverride: command.allowSoftOverride === true
    }
  };
  const { commandService } = createTrustedCompetitionAssignmentRuntime({
    serviceClient
  });
  if (action === "getMatchAssignmentVersion") {
    const version = await commandService.getMatchAssignmentVersion({
      tenantId: prepared.tenantId,
      tournamentId: prepared.tournamentId,
      matchId: prepared.matchId,
      role: prepared.roleCode || prepared.role || "PRIMARY"
    });
    return { httpStatus: 200, body: { ok: true, version, action } };
  }
  if (action === "getActiveAssignment") {
    const assignment = await commandService.getActiveAssignment({
      tenantId: prepared.tenantId,
      tournamentId: prepared.tournamentId,
      matchId: prepared.matchId,
      role: prepared.roleCode || prepared.role || "PRIMARY"
    });
    return { httpStatus: 200, body: { ok: true, assignment, action } };
  }
  if (action === "listActiveAssignments") {
    const assignments = await commandService.listActiveAssignments?.({
      tenantId: prepared.tenantId,
      tournamentId: prepared.tournamentId
    });
    const list = Array.isArray(assignments) ? assignments : await createTrustedCompetitionAssignmentRuntime({
      serviceClient
    }).persistence.listActiveAssignments({
      tenantId: prepared.tenantId,
      tournamentId: prepared.tournamentId
    });
    return { httpStatus: 200, body: { ok: true, assignments: list, action } };
  }
  const method = action === ASSIGNMENT_COMMAND.ASSIGN || action === "assignReferee" ? "assignReferee" : action === ASSIGNMENT_COMMAND.REPLACE || action === "replaceReferee" ? "replaceReferee" : action === ASSIGNMENT_COMMAND.UNASSIGN || action === "unassignReferee" ? "unassignReferee" : null;
  if (!method) {
    return {
      httpStatus: 400,
      body: {
        ok: false,
        code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
        error: `Unknown action ${action}`
      }
    };
  }
  const result = await commandService[method](prepared);
  return {
    httpStatus: 200,
    body: {
      ...result,
      ok: true,
      authoritativeExecutionLocation: "TRUSTED_SERVER",
      endpoint: COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
      originatingActorId: verified.userId,
      core13Executed: true
    }
  };
}
async function handleCompetitionRefereeAssignmentHttpRequest(req, { createSupabaseClients }) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: COMPETITION_ASSIGNMENT_CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  }
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(
      {
        ok: false,
        code: ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
        error: "Missing bearer token"
      },
      401
    );
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT },
      400
    );
  }
  const action = String(body.action || "").trim();
  if (!action) {
    return jsonResponse(
      { ok: false, code: ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT, error: "action required" },
      400
    );
  }
  const { user, service } = createSupabaseClients(authHeader);
  try {
    const result = await handleCompetitionRefereeAssignmentAction({
      action,
      body,
      userClient: user,
      serviceClient: service
    });
    return jsonResponse(result.body, result.httpStatus);
  } catch (err) {
    const payload = toErrorBody(err);
    return jsonResponse(payload, mapHttpStatus(payload.code));
  }
}
export {
  assertTrustedAssignmentAuthz,
  createCompetitionRefereeAssignmentCommandService,
  createIdentityBackedRefereeDirectoryPort,
  createRpcCanonicalAssignmentPersistence,
  createTrustedCompetitionAssignmentRuntime,
  createTrustedServerRefereeAdapterB,
  handleCompetitionRefereeAssignmentAction,
  handleCompetitionRefereeAssignmentHttpRequest,
  loadAuthoritativeAssignmentEvidence,
  projectMatchScheduleFromAdapterB,
  stripBrowserAuthority,
  verifyBearerToken
};
