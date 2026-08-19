/**
 * TEST_DOUBLE_ONLY canonical assignment persistence.
 * Production must inject DURABLE persistence — never use this as fallback.
 */

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  TEST_DOUBLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
} from "../constants.js";
import { failAssignmentCommand } from "../errors.js";

function scopeKey(tenantId, tournamentId, matchId, role = "REFEREE") {
  return `${tenantId}::${tournamentId}::${matchId}::${role}`;
}

function clone(row) {
  return row ? Object.freeze({ ...row }) : null;
}

/**
 * @param {{ clockIso?: string }} [options]
 */
export function createInMemoryCanonicalAssignmentPersistence(options = {}) {
  const clockIso = options.clockIso || "2026-08-17T00:00:00.000Z";
  /** @type {Map<string, object>} */
  const byScope = new Map();
  /** @type {Map<string, object>} */
  const byId = new Map();
  /** @type {Map<string, object>} */
  const idempotency = new Map();
  /** @type {object[]} */
  const audit = [];
  let seq = 0;

  function nextId(prefix) {
    seq += 1;
    return `${prefix}-${seq}`;
  }

  function idemKey(tenantId, tournamentId, key) {
    return `${tenantId}::${tournamentId}::${key}`;
  }

  function listActive(tenantId, tournamentId) {
    return [...byScope.values()].filter(
      (row) =>
        row.tenantId === tenantId &&
        row.tournamentId === tournamentId &&
        row.status === "active"
    );
  }

  function getActive(scope) {
    const key = scopeKey(
      scope.tenantId,
      scope.tournamentId,
      scope.matchId,
      scope.role || "REFEREE"
    );
    const row = byScope.get(key);
    if (!row || row.status !== "active") return null;
    return clone(row);
  }

  function getScopeVersion(scope) {
    const key = scopeKey(
      scope.tenantId,
      scope.tournamentId,
      scope.matchId,
      scope.role || "REFEREE"
    );
    const active = byScope.get(key);
    if (active && active.status === "active") {
      return Number(active.version || 0);
    }
    const empty = byScope.get(`${key}::__version__`);
    if (empty) return Number(empty.version || 0);
    return 0;
  }

  function assertCas(row, expectedVersion) {
    if (expectedVersion == null || Number.isNaN(Number(expectedVersion))) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.EXPECTED_VERSION_REQUIRED,
        "expectedVersion is required for assignment mutation",
        {}
      );
    }
    const current = row ? Number(row.version || 0) : 0;
    if (current !== Number(expectedVersion)) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE,
        "Fail-closed stale write: expectedVersion mismatch",
        { expectedVersion: Number(expectedVersion), currentVersion: current }
      );
    }
  }

  function findIdempotent(tenantId, tournamentId, idempotencyKey) {
    if (!idempotencyKey) return null;
    return idempotency.get(idemKey(tenantId, tournamentId, idempotencyKey)) || null;
  }

  function rememberIdempotent(tenantId, tournamentId, idempotencyKey, payload, result) {
    if (!idempotencyKey) return;
    idempotency.set(idemKey(tenantId, tournamentId, idempotencyKey), {
      payloadFingerprint: payload,
      result: clone(result.assignment) || result,
      committed: true,
    });
  }

  function payloadFingerprint(command) {
    const operation = command.operation;
    const targetRefereeId =
      operation === "REPLACE"
        ? command.newRefereeId || command.refereeId || null
        : operation === "UNASSIGN"
          ? null
          : command.refereeId || command.newRefereeId || null;
    return JSON.stringify({
      operation,
      tenantId: command.tenantId || null,
      tournamentId: command.tournamentId || command.competitionId || null,
      matchId: command.matchId,
      role: command.roleCode || command.role || "PRIMARY",
      targetRefereeId,
      expectedVersion: Number(command.expectedVersion),
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
    const existing = findIdempotent(
      command.tenantId,
      command.tournamentId,
      key
    );
    if (!existing) return { replay: false, key };
    const nextFp = payloadFingerprint(command);
    if (existing.payloadFingerprint !== nextFp) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT,
        "Same idempotencyKey with conflicting command payload",
        { idempotencyKey: key }
      );
    }
    return { replay: true, key, result: existing.result };
  }

  function appendAudit(entry) {
    const row = Object.freeze({
      auditId: entry.auditId || nextId("audit"),
      tenantId: entry.tenantId,
      tournamentId: entry.tournamentId,
      matchId: entry.matchId,
      assignmentId: entry.assignmentId || null,
      oldRefereeId: entry.oldRefereeId || null,
      newRefereeId: entry.newRefereeId || null,
      operation: entry.operation,
      actorId: entry.actorId,
      reason: entry.reason || null,
      lifecycleState: entry.lifecycleState || null,
      idempotencyKey: entry.idempotencyKey || null,
      previousVersion: entry.previousVersion ?? null,
      newVersion: entry.newVersion ?? null,
      recordedAt: entry.recordedAt || clockIso,
      emergencyReplacement: entry.emergencyReplacement === true,
    });
    audit.push(row);
    return row;
  }

  return Object.freeze({
    kind: "in-memory-canonical-assignment-persistence",
    classification: TEST_DOUBLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
    durable: false,
    clockIso,
    peekIdempotency: async (command) => checkIdempotency(command),
    getActiveAssignment: async (scope) => getActive(scope),
    listActiveAssignments: async ({ tenantId, tournamentId }) =>
      Object.freeze(listActive(tenantId, tournamentId).map(clone)),
    getMatchAssignmentVersion: async (scope) => getScopeVersion(scope),
    async assign(command) {
      const idem = checkIdempotency(command);
      if (idem.replay) {
        return Object.freeze({
          ok: true,
          replayed: true,
          assignment: clone(idem.result),
        });
      }
      const role = command.roleCode || command.role || "PRIMARY";
      const existing = getActive({
        tenantId: command.tenantId,
        tournamentId: command.tournamentId,
        matchId: command.matchId,
        role,
      });
      const currentVersion = getScopeVersion({
        tenantId: command.tenantId,
        tournamentId: command.tournamentId,
        matchId: command.matchId,
        role,
      });
      assertCas({ version: currentVersion }, command.expectedVersion);
      if (existing) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
          "Active assignment exists; use replaceReferee",
          { assignmentId: existing.assignmentId }
        );
      }
      const previousVersion = currentVersion;
      const newVersion = previousVersion + 1;
      const assignmentId = nextId("asg");
      const row = Object.freeze({
        assignmentId,
        tenantId: command.tenantId,
        tournamentId: command.tournamentId,
        matchId: command.matchId,
        refereeId: command.refereeId,
        role,
        status: "active",
        version: newVersion,
        assignedAt: clockIso,
        assignedBy: command.actorId,
      });
      const scope = scopeKey(
        command.tenantId,
        command.tournamentId,
        command.matchId,
        role
      );
      byScope.delete(`${scope}::__version__`);
      byScope.set(scope, row);
      byId.set(assignmentId, row);
      const auditRow = appendAudit({
        tenantId: command.tenantId,
        tournamentId: command.tournamentId,
        matchId: command.matchId,
        assignmentId,
        oldRefereeId: null,
        newRefereeId: command.refereeId,
        operation: "ASSIGN",
        actorId: command.actorId,
        reason: command.reason || null,
        lifecycleState: command.lifecycleState,
        idempotencyKey: idem.key,
        previousVersion,
        newVersion,
      });
      const result = { ok: true, replayed: false, assignment: row, audit: auditRow };
      rememberIdempotent(
        command.tenantId,
        command.tournamentId,
        idem.key,
        payloadFingerprint(command),
        result
      );
      return Object.freeze(result);
    },
    async replace(command) {
      const idem = checkIdempotency(command);
      if (idem.replay) {
        return Object.freeze({
          ok: true,
          replayed: true,
          assignment: clone(idem.result),
        });
      }
      const role = command.role || "REFEREE";
      const key = scopeKey(
        command.tenantId,
        command.tournamentId,
        command.matchId,
        role
      );
      const existing = getActive({
        tenantId: command.tenantId,
        tournamentId: command.tournamentId,
        matchId: command.matchId,
        role,
      });
      assertCas(existing, command.expectedVersion);
      if (!existing) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
          "No active assignment to replace",
          {}
        );
      }
      // Atomic: single map swap — no intermediate empty publish
      const previousVersion = Number(existing.version);
      const newVersion = previousVersion + 1;
      const revoked = Object.freeze({
        ...existing,
        status: "revoked",
        revokedAt: clockIso,
        version: previousVersion,
      });
      byId.set(existing.assignmentId, revoked);
      const assignmentId = nextId("asg");
      const row = Object.freeze({
        assignmentId,
        tenantId: command.tenantId,
        tournamentId: command.tournamentId,
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
      byScope.set(key, row);
      byId.set(assignmentId, row);
      const auditRow = appendAudit({
        tenantId: command.tenantId,
        tournamentId: command.tournamentId,
        matchId: command.matchId,
        assignmentId,
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
      });
      const result = {
        ok: true,
        replayed: false,
        assignment: row,
        previousAssignment: revoked,
        audit: auditRow,
      };
      rememberIdempotent(
        command.tenantId,
        command.tournamentId,
        idem.key,
        payloadFingerprint(command),
        result
      );
      return Object.freeze(result);
    },
    async unassign(command) {
      const idem = checkIdempotency(command);
      if (idem.replay) {
        return Object.freeze({
          ok: true,
          replayed: true,
          assignment: clone(idem.result),
        });
      }
      const role = command.role || "REFEREE";
      const key = scopeKey(
        command.tenantId,
        command.tournamentId,
        command.matchId,
        role
      );
      const existing = getActive({
        tenantId: command.tenantId,
        tournamentId: command.tournamentId,
        matchId: command.matchId,
        role,
      });
      assertCas(existing, command.expectedVersion);
      if (!existing) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
          "No active assignment to unassign",
          {}
        );
      }
      const previousVersion = Number(existing.version);
      const newVersion = previousVersion + 1;
      const revoked = Object.freeze({
        ...existing,
        status: "revoked",
        revokedAt: clockIso,
        version: newVersion,
        revokeReason: command.reason || null,
      });
      byScope.delete(key);
      byId.set(existing.assignmentId, revoked);
      // Scope version sentinel for empty match (CAS continuum)
      byScope.set(
        `${key}::__version__`,
        Object.freeze({
          assignmentId: null,
          tenantId: command.tenantId,
          tournamentId: command.tournamentId,
          matchId: command.matchId,
          refereeId: null,
          role,
          status: "empty",
          version: newVersion,
        })
      );
      const auditRow = appendAudit({
        tenantId: command.tenantId,
        tournamentId: command.tournamentId,
        matchId: command.matchId,
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
      });
      const result = {
        ok: true,
        replayed: false,
        assignment: revoked,
        audit: auditRow,
      };
      rememberIdempotent(
        command.tenantId,
        command.tournamentId,
        idem.key,
        payloadFingerprint(command),
        result
      );
      return Object.freeze(result);
    },
    async listAudit({ tenantId, tournamentId }) {
      return Object.freeze(
        audit
          .filter(
            (row) =>
              row.tenantId === tenantId && row.tournamentId === tournamentId
          )
          .map((row) => clone(row))
      );
    },
  });
}
