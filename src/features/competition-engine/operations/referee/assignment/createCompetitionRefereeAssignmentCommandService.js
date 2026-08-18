/**
 * Shared Competition referee assignment command service.
 *
 * Flow:
 *   mode shaping → authz → CORE-13 decision → lifecycle gate → CAS+idempotency → durable persist → audit
 *
 * Persistence executes validated commands only — never a second business authority.
 */

import {
  createRefereeCandidate,
  createRefereeAssignment,
  createManualRefereeAssignmentRequest,
  createRefereeReplacementRequest,
  createMatchScheduleRow,
  validateManualRefereeAssignment,
  replaceRefereeAssignment,
  REFEREE_ROLE_CODE,
  REFEREE_ASSIGNMENT_STATUS,
  REFEREE_ASSIGNMENT_SOURCE,
} from "../../../../competition-core/referee-assignment/index.js";
import {
  createPopulatedSnapshotResult,
  createEmptySnapshotResult,
} from "../../../../competition-core/referee-assignment/ports/portResult.js";

import {
  ASSIGNMENT_COMMAND,
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_COMPETITION_MODE,
  ASSIGNMENT_OPERATION,
  CORE13_ASSIGNMENT_COMMAND_VERSION,
  DURABLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
  TEST_DOUBLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION,
} from "./constants.js";
import {
  assertAssignmentCommandAuthz,
  assertCanonicalRefereeId,
} from "./assertAssignmentCommandAuthz.js";
import {
  assertAssignmentLifecycleGate,
  normalizeAssignmentLifecycleState,
} from "./evaluateLifecycleGate.js";
import {
  CompetitionRefereeAssignmentCommandError,
  failAssignmentCommand,
  isCompetitionRefereeAssignmentCommandError,
} from "./errors.js";

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
  if (
    production === true &&
    persistence.classification === TEST_DOUBLE_ASSIGNMENT_PERSISTENCE_CLASSIFICATION
  ) {
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
      code: "NOT_APPLICABLE_FOR_INSTANCE",
    };
  }
  return { applicable: true, required: true };
}

function defaultRole(command) {
  return (
    command.roleCode ||
    command.role ||
    REFEREE_ROLE_CODE.PRIMARY
  );
}

function buildDirectorySnapshot(command, refereeId) {
  if (command.directorySnapshot) return command.directorySnapshot;
  const candidates = Array.isArray(command.candidates)
    ? command.candidates
    : [
        {
          refereeId,
          active: command.refereeActive !== false,
          userId: command.refereeUserId || null,
          displayLabel: command.refereeDisplayLabel || undefined,
        },
      ];
  const items = candidates.map((c) =>
    createRefereeCandidate({
      refereeId: String(c.refereeId),
      active: c.active !== false,
      userId: c.userId || null,
      playerId: c.playerId || null,
      organizationIds: c.organizationIds || [],
      clubIds: c.clubIds || [],
      qualificationRefs: c.qualificationRefs || [],
      preferenceTags: c.preferenceTags || [],
      displayLabel: c.displayLabel,
    })
  );
  return createPopulatedSnapshotResult(items);
}

function resolveWindow(command) {
  const startAt =
    command.startAt ||
    command.windowStart ||
    command.scheduledStartAt ||
    null;
  const endAt =
    command.endAt ||
    command.windowEnd ||
    command.scheduledEndAt ||
    null;
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
    courtId: command.courtId || null,
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
    requireScheduleWindowForMandatoryRoles:
      command.requireScheduleWindowForMandatoryRoles === true ||
      (command.requireScheduleWindowForMandatoryRoles !== false && scheduled),
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
    requireScheduleWindowForMandatoryRoles:
      profile.requireScheduleWindowForMandatoryRoles,
    allowSoftOverride: command.allowSoftOverride === true,
  };
}

function buildExistingSnapshot(rows) {
  if (!rows || rows.length === 0) return createEmptySnapshotResult();
  const items = rows.map((row) =>
    createRefereeAssignment({
      assignmentId: String(row.assignmentId),
      matchId: String(row.matchId),
      refereeId: String(row.refereeId),
      roleCode: row.roleCode || row.role || REFEREE_ROLE_CODE.PRIMARY,
      status:
        row.status === "active" || row.status === REFEREE_ASSIGNMENT_STATUS.CONFIRMED
          ? REFEREE_ASSIGNMENT_STATUS.CONFIRMED
          : row.status === REFEREE_ASSIGNMENT_STATUS.PLANNED
            ? REFEREE_ASSIGNMENT_STATUS.PLANNED
            : REFEREE_ASSIGNMENT_STATUS.RELEASED,
      source: REFEREE_ASSIGNMENT_SOURCE.MANUAL,
      constraintsSatisfied: [],
    })
  );
  return createPopulatedSnapshotResult(items);
}

async function loadExistingForCore13(persistence, scope) {
  const list = await persistence.listActiveAssignments({
    tenantId: scope.tenantId,
    tournamentId: scope.tournamentId,
  });
  return list || [];
}

function mapCore13Failure(result) {
  const code =
    result?.failure?.code ||
    result?.failure?.causedBy ||
    ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED;
  failAssignmentCommand(
    ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED,
    result?.failure?.message || "CORE-13 rejected assignment command",
    { core13Code: code, failure: result?.failure || null }
  );
}

/**
 * @param {{
 *   persistence: object,
 *   production?: boolean,
 *   clockIso?: string,
 *   authorize?: (command: object) => boolean | Promise<boolean>,
 *   authorizeEmergency?: (command: object) => boolean | Promise<boolean>,
 * }} options
 */
export function createCompetitionRefereeAssignmentCommandService(options = {}) {
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
        "Daily Play referee feature disabled — CORE-13 assignment not applicable",
        { policy: daily.code }
      );
    }

    const actorAuthorized = await resolveActorAuthorized(command);
    const authz = assertAssignmentCommandAuthz(command, {
      authorizedTenantId: command.authorizedTenantId,
      authorizedTournamentId: command.authorizedTournamentId,
      authorizedClubId: command.authorizedClubId,
      actorAuthorized,
    });

    const lifecycleGate = assertAssignmentLifecycleGate({
      command: mutationKind,
      lifecycleState: normalizeAssignmentLifecycleState(
        command.lifecycleState || command.matchStatus,
        { scoringActive: command.scoringActive === true }
      ),
      emergencyReplacement: command.emergencyReplacement === true,
      actorAuthorized,
      emergencyAuthorized: await resolveEmergencyAuthorized(command),
    });

    return { authz, lifecycleGate, daily };
  }

  async function resolveIdempotentReplay(command) {
    if (typeof persistence.peekIdempotency !== "function") return null;
    const peek = await persistence.peekIdempotency({
      ...command,
      tenantId: command.tenantId,
      tournamentId: command.tournamentId || command.competitionId,
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
        persistenceClassification: persistence.classification,
      });
    }
    return null;
  }

  async function assignReferee(rawCommand = {}) {
    const command = { ...rawCommand, operation: ASSIGNMENT_OPERATION.ASSIGN };
    const replay = await resolveIdempotentReplay({
      ...command,
      operation: ASSIGNMENT_OPERATION.ASSIGN,
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
      name: command.name,
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
    const sameActive = (existingRows || []).find(
      (row) =>
        String(row.matchId) === matchId &&
        String(row.refereeId) === String(refereeId) &&
        String(row.roleCode || row.role || REFEREE_ROLE_CODE.PRIMARY) ===
          String(role) &&
        String(row.status) === "active"
    );
    const requirementRequested =
      command.requireQualification === true || command.requireAvailability === true;
    if (sameActive && !requirementRequested) {
      return deepFreeze({
        ok: true,
        command: ASSIGNMENT_COMMAND.ASSIGN,
        core13Decision: "ACCEPT",
        replayed: true,
        uniquenessReconciled: true,
        assignment: sameActive,
        audit: null,
        version: sameActive.version ?? null,
        engine: CORE13_ASSIGNMENT_COMMAND_VERSION,
        persistenceClassification: persistence.classification,
      });
    }
    const profile = resolveRequirementProfile(command);

    const request = createManualRefereeAssignmentRequest({
      requestId: String(
        command.commandId ||
          command.idempotencyKey ||
          `assign-${matchId}-${refereeId}`
      ),
      tenantId: authz.tenantId,
      tournamentId: authz.tournamentId,
      matchId,
      refereeId,
      roleCode: role,
      actorRef: authz.actorId,
      allowSoftOverride: command.allowSoftOverride === true,
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
      policy: resolveCore13Policy(command),
    });
    if (!core13.ok || core13.accepted === false) mapCore13Failure(core13);

    const expectedVersion =
      command.expectedVersion != null
        ? Number(command.expectedVersion)
        : await persistence.getMatchAssignmentVersion({
            tenantId: authz.tenantId,
            tournamentId: authz.tournamentId,
            matchId,
            role,
          });

    let persisted;
    try {
      persisted = await persistence.assign({
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
        lifecycleState: lifecycleGate.lifecycleState,
      });
    } catch (err) {
      if (
        isCompetitionRefereeAssignmentCommandError(err) &&
        err.code === ASSIGNMENT_COMMAND_ERROR_CODE.ACTIVE_ASSIGNMENT_EXISTS &&
        typeof persistence.getActiveAssignment === "function"
      ) {
        const active = await persistence.getActiveAssignment({
          tenantId: authz.tenantId,
          tournamentId: authz.tournamentId,
          matchId,
          role,
        });
        if (active && String(active.refereeId) === String(refereeId)) {
          return deepFreeze({
            ok: true,
            command: ASSIGNMENT_COMMAND.ASSIGN,
            core13Decision: "ACCEPT",
            replayed: true,
            uniquenessReconciled: true,
            assignment: active,
            audit: null,
            version: active.version ?? null,
            engine: CORE13_ASSIGNMENT_COMMAND_VERSION,
            persistenceClassification: persistence.classification,
          });
        }
      }
      throw err;
    }

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
      persistenceClassification: persistence.classification,
    });
  }

  async function replaceReferee(rawCommand = {}) {
    const command = { ...rawCommand, operation: ASSIGNMENT_OPERATION.REPLACE };
    const replay = await resolveIdempotentReplay({
      ...command,
      operation: ASSIGNMENT_OPERATION.REPLACE,
      newRefereeId: rawCommand.newRefereeId || rawCommand.refereeId,
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
        name: command.name,
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
    const prior =
      existingRows.find(
        (row) =>
          String(row.matchId) === matchId &&
          String(row.roleCode || row.role || REFEREE_ROLE_CODE.PRIMARY) ===
            String(role)
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
      reasonCode: command.reason || command.reasonCode || "REPLACE",
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
      policy: resolveCore13Policy(command),
    });
    if (!core13.ok || core13.accepted === false) mapCore13Failure(core13);

    const expectedVersion =
      command.expectedVersion != null
        ? Number(command.expectedVersion)
        : Number(prior.version || 0);

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
      emergencyReplacement: command.emergencyReplacement === true,
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
      persistenceClassification: persistence.classification,
    });
  }

  async function unassignReferee(rawCommand = {}) {
    const command = { ...rawCommand, operation: ASSIGNMENT_OPERATION.UNASSIGN };
    const replay = await resolveIdempotentReplay({
      ...command,
      operation: ASSIGNMENT_OPERATION.UNASSIGN,
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
    const prior =
      existingRows.find(
        (row) =>
          String(row.matchId) === matchId &&
          String(row.roleCode || row.role || REFEREE_ROLE_CODE.PRIMARY) ===
            String(role)
      ) || null;
    if (!prior) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
        "No active assignment to unassign",
        {}
      );
    }

    const expectedVersion =
      command.expectedVersion != null
        ? Number(command.expectedVersion)
        : Number(prior.version || 0);

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
      lifecycleState: lifecycleGate.lifecycleState,
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
      persistenceClassification: persistence.classification,
    });
  }

  /**
   * Seed path — MUST run CORE-13 validation per row. No business-authority bypass.
   */
  async function seedAssignmentsThroughCore13(rawCommand = {}) {
    if (rawCommand.allowCore13Bypass === true) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.SEED_BYPASS_DENIED,
        "seedAssignments cannot bypass CORE-13",
        {}
      );
    }
    const assignments = Array.isArray(rawCommand.assignments)
      ? rawCommand.assignments
      : [];
    const results = [];
    for (const row of assignments) {
      const tournamentId = rawCommand.competitionId || rawCommand.tournamentId;
      const role = row.roleCode || row.role || REFEREE_ROLE_CODE.PRIMARY;
      const version = await persistence.getMatchAssignmentVersion({
        tenantId: rawCommand.tenantId,
        tournamentId,
        matchId: row.matchId,
        role,
      });
      const active = await persistence.getActiveAssignment({
        tenantId: rawCommand.tenantId,
        tournamentId,
        matchId: row.matchId,
        role,
      });
      const cmd = {
        ...rawCommand,
        tournamentId,
        matchId: row.matchId,
        refereeId: row.refereeId || row.assigneeId,
        roleCode: role,
        expectedVersion: version,
        idempotencyKey:
          row.idempotencyKey ||
          `${rawCommand.idempotencyKey || "seed"}::${row.matchId}::${row.refereeId || row.assigneeId}`,
        lifecycleState:
          row.lifecycleState || rawCommand.lifecycleState || "PRE_MATCH",
        candidates: rawCommand.candidates,
        directorySnapshot: rawCommand.directorySnapshot,
        scheduleSnapshot: rawCommand.scheduleSnapshot,
        startAt: row.startAt || rawCommand.startAt,
        endAt: row.endAt || rawCommand.endAt,
      };
      if (active) {
        results.push(
          await replaceReferee({
            ...cmd,
            newRefereeId: cmd.refereeId,
            expectedVersion: Number(active.version || version),
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
      core13Bypass: false,
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
    getMatchAssignmentVersion: (scope) =>
      persistence.getMatchAssignmentVersion(scope),
    listActiveAssignments: (scope) => persistence.listActiveAssignments(scope),
    listAudit: (scope) => persistence.listAudit?.(scope),
  });
}

export {
  CompetitionRefereeAssignmentCommandError,
  isCompetitionRefereeAssignmentCommandError,
};
