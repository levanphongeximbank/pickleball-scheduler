/**
 * RPC-backed durable assignment persistence — translation/execution only.
 *
 * Maps command-service persistence calls to competition_* SQL RPCs.
 * Does not make Competition / CORE-13 decisions.
 * Intended for the trusted server (service-role client) only.
 */

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  DURABLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
} from "../constants.js";
import { failAssignmentCommand } from "../errors.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COMPETITION_ASSIGNMENT_MUTATION_RPC = Object.freeze({
  ASSIGN: "competition_assign_referee",
  REPLACE: "competition_replace_referee",
  UNASSIGN: "competition_unassign_referee",
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
    ["ACTIVE_ASSIGNMENT_EXISTS", ASSIGNMENT_COMMAND_ERROR_CODE.ACTIVE_ASSIGNMENT_EXISTS],
    ["REFEREE_ALREADY_ASSIGNED", ASSIGNMENT_COMMAND_ERROR_CODE.ACTIVE_ASSIGNMENT_EXISTS],
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
    ["TOURNAMENT_FORBIDDEN", ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR],
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
    assignedBy: row.assigned_by || row.assignedBy || null,
  });
}

function mapRpcResult(data, command) {
  const payload = data && typeof data === "object" ? data : {};
  const assignment = Object.freeze({
    assignmentId: payload.assignmentId || payload.assignment_id || null,
    tenantId: command.tenantId,
    tournamentId: command.tournamentId,
    matchId: payload.matchId || command.matchId,
    refereeId:
      payload.refereeUserId ||
      payload.newRefereeUserId ||
      command.refereeId ||
      command.newRefereeId ||
      null,
    role: fromSqlRole(payload.role || command.role),
    roleCode: fromSqlRole(payload.role || command.role),
    status: payload.status || (command.operation === "UNASSIGN" ? "revoked" : "active"),
    version: payload.version != null ? Number(payload.version) : null,
  });
  return Object.freeze({
    ok: payload.ok !== false,
    replayed: payload.replayed === true,
    assignment,
    previousAssignment: payload.previousAssignmentId
      ? Object.freeze({ assignmentId: payload.previousAssignmentId })
      : null,
    audit: payload.auditId ? Object.freeze({ auditId: payload.auditId }) : null,
  });
}

/**
 * @param {{
 *   serviceClient: { rpc: Function, from: Function },
 * }} options
 */
export function createRpcCanonicalAssignmentPersistence(options = {}) {
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
      const { data, error } = await serviceClient
        .from("referee_assignments")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("tournament_id", tournamentId)
        .eq("match_id", matchId)
        .eq("status", "active")
        .limit(20);
      if (error) mapRpcError(error);
      const rows = Array.isArray(data) ? data : [];
      const match =
        rows.find((row) => fromSqlRole(row.role) === fromSqlRole(sqlRole)) ||
        rows.find((row) => String(row.role) === sqlRole) ||
        null;
      return match ? mapRow(match) : null;
    },
    async listActiveAssignments({ tenantId, tournamentId } = {}) {
      let query = serviceClient
        .from("referee_assignments")
        .select("*")
        .eq("status", "active");
      if (tenantId) query = query.eq("tenant_id", tenantId);
      if (tournamentId) query = query.eq("tournament_id", tournamentId);
      const { data, error } = await query;
      if (error) mapRpcError(error);
      return Object.freeze((Array.isArray(data) ? data : []).map(mapRow));
    },
    async getMatchAssignmentVersion({ tenantId, tournamentId, matchId, role = "PRIMARY" }) {
      const sqlRole = toSqlRole(role);
      const { data, error } = await serviceClient
        .from("referee_assignments")
        .select("version, status, role")
        .eq("tenant_id", tenantId)
        .eq("tournament_id", tournamentId)
        .eq("match_id", matchId);
      if (error) mapRpcError(error);
      const rows = Array.isArray(data) ? data : [];
      const scoped = rows.filter(
        (row) =>
          fromSqlRole(row.role) === fromSqlRole(sqlRole) ||
          String(row.role) === sqlRole
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
          originatingActorId: actorId,
        },
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
          originatingActorId: actorId,
        },
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
          originatingActorId: actorId,
        },
      });
      return mapRpcResult(data, command);
    },
  });
}
