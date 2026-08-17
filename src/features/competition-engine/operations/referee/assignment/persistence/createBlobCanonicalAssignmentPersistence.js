/**
 * Interim blob-backed canonical assignment persistence for Internal/Official
 * until Owner applies core13-canonical-assignment-runtime-closure-01 SQL.
 *
 * Authority rows live under settings.core13RefereeAssignments (versioned).
 * Legacy settings.refereeAssignments is projection-only when synced by callers.
 *
 * Classification: INTERIM blob projection only. Not product assignment authority
 * after trusted-server cutover. Prefer createRpcCanonicalAssignmentPersistence
 * on the Competition Edge Function.
 */

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  DURABLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
} from "../constants.js";
import { failAssignmentCommand } from "../errors.js";

function scopeKey(matchId, role = "PRIMARY") {
  return `${String(matchId)}::${String(role)}`;
}

function readState(tournament) {
  const raw = tournament?.settings?.core13RefereeAssignments;
  if (!raw || typeof raw !== "object") {
    return { byScope: {}, audit: [], idempotency: {}, versionByScope: {} };
  }
  return {
    byScope: { ...(raw.byScope || {}) },
    audit: Array.isArray(raw.audit) ? [...raw.audit] : [],
    idempotency: { ...(raw.idempotency || {}) },
    versionByScope: { ...(raw.versionByScope || {}) },
  };
}

/**
 * @param {{
 *   getTournament: () => object,
 *   setTournament: (next: object) => void,
 *   tournamentId: string,
 *   tenantId: string,
 *   clockIso?: string,
 * }} options
 */
export function createBlobCanonicalAssignmentPersistence(options = {}) {
  const getTournament = options.getTournament;
  const setTournament = options.setTournament;
  const tournamentId = String(options.tournamentId || "").trim();
  const tenantId = String(options.tenantId || "").trim();
  const clockIso = options.clockIso || "2026-08-17T00:00:00.000Z";
  let seq = 0;

  function nextId(prefix) {
    seq += 1;
    return `${prefix}-${seq}`;
  }

  function persist(state) {
    const tournament = getTournament();
    const next = {
      ...tournament,
      settings: {
        ...(tournament?.settings || {}),
        core13RefereeAssignments: {
          schema: "core13-blob-canonical-v1",
          interimUntilSqlGo: true,
          byScope: state.byScope,
          audit: state.audit.slice(-200),
          idempotency: state.idempotency,
          versionByScope: state.versionByScope,
        },
      },
    };
    setTournament(next);
    return next;
  }

  function getVersion(matchId, role) {
    const state = readState(getTournament());
    const key = scopeKey(matchId, role);
    const active = state.byScope[key];
    if (active && active.status === "active") return Number(active.version || 0);
    return Number(state.versionByScope[key] || 0);
  }

  function assertCas(matchId, role, expectedVersion) {
    if (expectedVersion == null || Number.isNaN(Number(expectedVersion))) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.EXPECTED_VERSION_REQUIRED,
        "expectedVersion is required",
        {}
      );
    }
    const current = getVersion(matchId, role);
    if (current !== Number(expectedVersion)) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE,
        "Fail-closed stale write: expectedVersion mismatch",
        { expectedVersion: Number(expectedVersion), currentVersion: current }
      );
    }
  }

  function payloadFingerprint(command) {
    return JSON.stringify({
      operation: command.operation,
      matchId: command.matchId,
      role: command.role,
      refereeId: command.refereeId || null,
      newRefereeId: command.newRefereeId || null,
      expectedVersion: command.expectedVersion,
      emergencyReplacement: command.emergencyReplacement === true,
    });
  }

  function checkIdempotency(command) {
    const key = String(command.idempotencyKey || "").trim();
    if (!key) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_KEY_REQUIRED,
        "idempotencyKey is required",
        {}
      );
    }
    const state = readState(getTournament());
    const existing = state.idempotency[key];
    if (!existing) return { key, replay: false };
    const fp = payloadFingerprint(command);
    if (existing.payloadFingerprint !== fp) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT,
        "Same idempotencyKey with conflicting command payload",
        { idempotencyKey: key }
      );
    }
    return { key, replay: true, result: existing.result };
  }

  function remember(state, key, command, result) {
    state.idempotency[key] = {
      payloadFingerprint: payloadFingerprint(command),
      result: result.assignment,
    };
  }

  return Object.freeze({
    kind: "blob-canonical-assignment-persistence",
    classification: DURABLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
    durable: true,
    interimUntilSqlGo: true,
    clockIso,
    async getActiveAssignment({ matchId, role = "PRIMARY" }) {
      const state = readState(getTournament());
      const row = state.byScope[scopeKey(matchId, role)];
      return row && row.status === "active" ? Object.freeze({ ...row }) : null;
    },
    async listActiveAssignments() {
      const state = readState(getTournament());
      return Object.freeze(
        Object.values(state.byScope)
          .filter((row) => row.status === "active")
          .map((row) => Object.freeze({ ...row }))
      );
    },
    async getMatchAssignmentVersion({ matchId, role = "PRIMARY" }) {
      return getVersion(matchId, role);
    },
    async assign(command) {
      const idem = checkIdempotency(command);
      if (idem.replay) {
        return Object.freeze({ ok: true, replayed: true, assignment: idem.result });
      }
      const role = command.role || "PRIMARY";
      assertCas(command.matchId, role, command.expectedVersion);
      const state = readState(getTournament());
      const key = scopeKey(command.matchId, role);
      if (state.byScope[key]?.status === "active") {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
          "Active assignment exists; use replaceReferee",
          {}
        );
      }
      const previousVersion = Number(command.expectedVersion);
      const newVersion = previousVersion + 1;
      const assignment = Object.freeze({
        assignmentId: nextId("asg"),
        tenantId: command.tenantId || tenantId,
        tournamentId: command.tournamentId || tournamentId,
        matchId: command.matchId,
        refereeId: command.refereeId,
        role,
        status: "active",
        version: newVersion,
        assignedAt: clockIso,
        assignedBy: command.actorId,
      });
      state.byScope[key] = assignment;
      state.versionByScope[key] = newVersion;
      const audit = {
        auditId: nextId("audit"),
        tenantId: assignment.tenantId,
        tournamentId: assignment.tournamentId,
        matchId: assignment.matchId,
        assignmentId: assignment.assignmentId,
        oldRefereeId: null,
        newRefereeId: assignment.refereeId,
        operation: "ASSIGN",
        actorId: command.actorId,
        reason: command.reason || null,
        lifecycleState: command.lifecycleState,
        idempotencyKey: idem.key,
        previousVersion,
        newVersion,
        recordedAt: clockIso,
      };
      state.audit.push(audit);
      const result = { ok: true, replayed: false, assignment, audit };
      remember(state, idem.key, command, result);
      persist(state);
      return Object.freeze(result);
    },
    async replace(command) {
      const idem = checkIdempotency(command);
      if (idem.replay) {
        return Object.freeze({ ok: true, replayed: true, assignment: idem.result });
      }
      const role = command.role || "PRIMARY";
      assertCas(command.matchId, role, command.expectedVersion);
      const state = readState(getTournament());
      const key = scopeKey(command.matchId, role);
      const existing = state.byScope[key];
      if (!existing || existing.status !== "active") {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
          "No active assignment to replace",
          {}
        );
      }
      const previousVersion = Number(existing.version);
      const newVersion = previousVersion + 1;
      const previousAssignment = Object.freeze({
        ...existing,
        status: "revoked",
        revokedAt: clockIso,
      });
      const assignment = Object.freeze({
        assignmentId: nextId("asg"),
        tenantId: command.tenantId || tenantId,
        tournamentId: command.tournamentId || tournamentId,
        matchId: command.matchId,
        refereeId: command.newRefereeId,
        role,
        status: "active",
        version: newVersion,
        assignedAt: clockIso,
        assignedBy: command.actorId,
        replacedAssignmentId: existing.assignmentId,
        previousRefereeId: existing.refereeId,
      });
      // Atomic swap in one persist
      state.byScope[key] = assignment;
      state.versionByScope[key] = newVersion;
      const audit = {
        auditId: nextId("audit"),
        tenantId: assignment.tenantId,
        tournamentId: assignment.tournamentId,
        matchId: assignment.matchId,
        assignmentId: assignment.assignmentId,
        oldRefereeId: existing.refereeId,
        newRefereeId: command.newRefereeId,
        operation: "REPLACE",
        actorId: command.actorId,
        reason: command.reason || null,
        lifecycleState: command.lifecycleState,
        idempotencyKey: idem.key,
        previousVersion,
        newVersion,
        emergencyReplacement: command.emergencyReplacement === true,
        recordedAt: clockIso,
      };
      state.audit.push(audit);
      const result = {
        ok: true,
        replayed: false,
        assignment,
        previousAssignment,
        audit,
      };
      remember(state, idem.key, command, result);
      persist(state);
      return Object.freeze(result);
    },
    async unassign(command) {
      const idem = checkIdempotency(command);
      if (idem.replay) {
        return Object.freeze({ ok: true, replayed: true, assignment: idem.result });
      }
      const role = command.role || "PRIMARY";
      assertCas(command.matchId, role, command.expectedVersion);
      const state = readState(getTournament());
      const key = scopeKey(command.matchId, role);
      const existing = state.byScope[key];
      if (!existing || existing.status !== "active") {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
          "No active assignment to unassign",
          {}
        );
      }
      const previousVersion = Number(existing.version);
      const newVersion = previousVersion + 1;
      const assignment = Object.freeze({
        ...existing,
        status: "revoked",
        revokedAt: clockIso,
        version: newVersion,
        revokeReason: command.reason || null,
      });
      delete state.byScope[key];
      state.versionByScope[key] = newVersion;
      const audit = {
        auditId: nextId("audit"),
        tenantId: existing.tenantId,
        tournamentId: existing.tournamentId,
        matchId: existing.matchId,
        assignmentId: existing.assignmentId,
        oldRefereeId: existing.refereeId,
        newRefereeId: null,
        operation: "UNASSIGN",
        actorId: command.actorId,
        reason: command.reason || null,
        lifecycleState: command.lifecycleState,
        idempotencyKey: idem.key,
        previousVersion,
        newVersion,
        recordedAt: clockIso,
      };
      state.audit.push(audit);
      const result = { ok: true, replayed: false, assignment, audit };
      remember(state, idem.key, command, result);
      persist(state);
      return Object.freeze(result);
    },
    async listAudit() {
      const state = readState(getTournament());
      return Object.freeze(state.audit.map((row) => Object.freeze({ ...row })));
    },
  });
}
