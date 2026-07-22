/**
 * CORE-12 — pure deterministic greedy court assignment.
 *
 * Processing order:
 * 1. Validate + normalize request
 * 2. Defensive freeze (via factories)
 * 3. Apply / validate locked assignments
 * 4. Stable match ordering
 * 5. Stable court ordering
 * 6. Greedy first-eligible court scan for unlocked matches
 * 7. Structured unassigned reasons
 * 8. Partial-assignment policy
 * 9. Stable result ordering + fingerprint
 * 10. Never mutate caller input
 *
 * No Date.now / Math.random / host timezone defaults in outputs.
 */

import {
  CORE12_COMPARATOR_VERSION,
  CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
  CORE12_COURT_SELECTION_STRATEGY_VERSION,
  CORE12_ENGINE_VERSION,
  CORE12_FINGERPRINT_VERSION,
  CORE12_IDENTITY,
} from "../constants/versions.js";
import {
  CAPABILITY_MATCH_MODE,
  CONFLICT_SEVERITY,
  COURT_ASSIGNMENT_CONFLICT_CODE,
  COURT_ASSIGNMENT_REJECTION_CODE,
  COURT_ASSIGNMENT_SOURCE,
  COURT_ASSIGNMENT_STATUS,
  COURT_AVAILABILITY_STATUS,
  COURT_LOCK_SOURCE,
  INVALID_LOCK_BEHAVIOR,
} from "../enums/index.js";
import {
  createAssignedCourtSlot,
  createCourtAssignmentConflict,
  createCourtAssignmentDiagnostics,
  createCourtAssignmentResult,
  createUnassignedMatch,
} from "../contracts/index.js";
import {
  compareStableId,
  fingerprintValue,
  intervalFullyCovers,
  stableSortCopy,
  compareMatches,
  compareCourts,
} from "../deterministic/index.js";
import {
  detectCourtOverlaps,
  occupancyConflictsWith,
} from "./detectCourtOverlaps.js";
import { validateCourtAssignmentRequest } from "./validateCourtAssignmentRequest.js";
import { isCourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";

/**
 * @param {unknown} input
 * @returns {Readonly<object>}
 */
export function assignCourtsDeterministic(input) {
  const validation = validateCourtAssignmentRequest(input);
  if (!validation.ok) {
    return buildRejectedResult(input, validation);
  }
  return runAssignment(validation.request);
}

/**
 * Alias matching CourtAssignmentPort.assignCourts.
 * @param {unknown} input
 */
export function assignCourts(input) {
  return assignCourtsDeterministic(input);
}

/**
 * @param {object} request
 */
function runAssignment(request) {
  const policy = request.policy;
  const matchById = new Map(request.matches.map((m) => [m.matchId, m]));
  const courtById = new Map(request.courts.map((c) => [c.courtId, c]));

  /** @type {object[]} */
  const assignments = [];
  /** @type {object[]} */
  const unassigned = [];
  /** @type {object[]} */
  const conflicts = [];
  /** @type {{ matchId: string, courtId: string, startMs: number, endMs: number }[]} */
  const occupancies = [];

  const lockedMatchIds = new Set();
  const effectiveLocks = collectEffectiveLocks(request);

  // --- Locked assignments first ---
  let lockedPreservedCount = 0;
  let hardLockFailure = false;

  for (const lock of effectiveLocks) {
    lockedMatchIds.add(lock.matchId);
    const match = matchById.get(lock.matchId);
    const court = courtById.get(lock.courtId);

    if (match.isBye) {
      const conflict = pushConflict(conflicts, {
        conflictId: `bye-lock:${lock.matchId}`,
        code: COURT_ASSIGNMENT_CONFLICT_CODE.BYE_MUST_NOT_CONSUME_COURT,
        severity: CONFLICT_SEVERITY.HARD,
        message: `Bye match ${lock.matchId} cannot consume a locked court`,
        matchIds: [lock.matchId],
        courtIds: [lock.courtId],
      });
      unassigned.push(
        createUnassignedMatch({
          matchId: lock.matchId,
          reasonCode: COURT_ASSIGNMENT_CONFLICT_CODE.BYE_MUST_NOT_CONSUME_COURT,
          message: conflict.message,
          blockingConflictIds: [conflict.conflictId],
        })
      );
      hardLockFailure = true;
      continue;
    }

    if (isTerminal(match, policy)) {
      // Terminal matches are skipped — lock is not applied and not unassigned.
      lockedMatchIds.delete(lock.matchId);
      continue;
    }

    const feasibility = evaluateCourtForMatch(match, court, request, occupancies);
    if (!feasibility.ok) {
      const conflictCode =
        feasibility.code === COURT_ASSIGNMENT_CONFLICT_CODE.COURT_TIME_OVERLAP
          ? COURT_ASSIGNMENT_CONFLICT_CODE.LOCK_OVERLAP
          : feasibility.code ===
              COURT_ASSIGNMENT_CONFLICT_CODE.CAPABILITY_MISMATCH
            ? COURT_ASSIGNMENT_CONFLICT_CODE.LOCK_CAPABILITY_MISMATCH
            : feasibility.code === COURT_ASSIGNMENT_REJECTION_CODE.SCOPE_MISMATCH ||
                feasibility.code ===
                  COURT_ASSIGNMENT_REJECTION_CODE.CROSS_TENANT_REFERENCE ||
                feasibility.code ===
                  COURT_ASSIGNMENT_REJECTION_CODE.CROSS_VENUE_REFERENCE ||
                feasibility.code ===
                  COURT_ASSIGNMENT_REJECTION_CODE.CROSS_CLUB_REFERENCE ||
                feasibility.code === COURT_ASSIGNMENT_CONFLICT_CODE.LOCK_SCOPE_MISMATCH
              ? COURT_ASSIGNMENT_CONFLICT_CODE.LOCK_SCOPE_MISMATCH
              : feasibility.code ===
                    COURT_ASSIGNMENT_CONFLICT_CODE.COURT_UNAVAILABLE ||
                  feasibility.code ===
                    COURT_ASSIGNMENT_CONFLICT_CODE.COURT_DISABLED ||
                  feasibility.code ===
                    COURT_ASSIGNMENT_CONFLICT_CODE.COURT_MAINTENANCE ||
                  feasibility.code ===
                    COURT_ASSIGNMENT_CONFLICT_CODE.COURT_LOCKED_INVENTORY ||
                  feasibility.code ===
                    COURT_ASSIGNMENT_CONFLICT_CODE.WINDOW_INCOMPATIBLE
                ? COURT_ASSIGNMENT_CONFLICT_CODE.LOCK_COURT_UNAVAILABLE
                : COURT_ASSIGNMENT_CONFLICT_CODE.LOCKED_ASSIGNMENT_INFEASIBLE;

      if (policy.invalidLockBehavior === INVALID_LOCK_BEHAVIOR.REJECT_REQUEST) {
        return buildRejectedFromNormalized(request, {
          code: COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
          message: `Invalid lock for match ${lock.matchId}: ${feasibility.message}`,
          details: {
            matchId: lock.matchId,
            courtId: lock.courtId,
            reasonCode: conflictCode,
          },
        });
      }

      if (
        policy.overrideManualLocks &&
        lock.overrideAllowed
      ) {
        // Drop lock; allow auto assignment later.
        lockedMatchIds.delete(lock.matchId);
        pushConflict(conflicts, {
          conflictId: `lock-override:${lock.matchId}`,
          code: COURT_ASSIGNMENT_CONFLICT_CODE.LOCKED_ASSIGNMENT_INFEASIBLE,
          severity: CONFLICT_SEVERITY.INFO,
          message: `Lock for ${lock.matchId} overridden; will attempt auto assignment`,
          matchIds: [lock.matchId],
          courtIds: [lock.courtId],
          details: { originalCode: feasibility.code },
        });
        continue;
      }

      const conflict = pushConflict(conflicts, {
        conflictId: `lock-infeasible:${lock.matchId}`,
        code: conflictCode,
        severity: CONFLICT_SEVERITY.HARD,
        message: feasibility.message,
        matchIds: [lock.matchId],
        courtIds: [lock.courtId],
        details: { underlyingCode: feasibility.code },
      });
      unassigned.push(
        createUnassignedMatch({
          matchId: lock.matchId,
          reasonCode: conflictCode,
          message: feasibility.message,
          blockingConflictIds: [conflict.conflictId],
        })
      );
      hardLockFailure = true;
      continue;
    }

    // Detect lock-vs-lock overlap before accepting
    const candidateOcc = {
      matchId: match.matchId,
      courtId: court.courtId,
      startMs: match._startMs,
      endMs: match._endMs,
    };
    if (occupancyConflictsWith(occupancies, candidateOcc)) {
      const overlap = detectCourtOverlaps([...occupancies, candidateOcc]).find(
        (o) =>
          o.courtId === court.courtId &&
          (o.matchIdA === match.matchId || o.matchIdB === match.matchId)
      );
      if (policy.invalidLockBehavior === INVALID_LOCK_BEHAVIOR.REJECT_REQUEST) {
        return buildRejectedFromNormalized(request, {
          code: COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
          message: `Overlapping locks on court ${court.courtId}`,
          details: { courtId: court.courtId, matchId: match.matchId },
        });
      }
      const conflict = pushConflict(conflicts, {
        conflictId: `lock-overlap:${match.matchId}:${court.courtId}`,
        code: COURT_ASSIGNMENT_CONFLICT_CODE.LOCK_OVERLAP,
        severity: CONFLICT_SEVERITY.HARD,
        message: `Locked assignment for ${match.matchId} overlaps another assignment on ${court.courtId}`,
        matchIds: overlap
          ? [overlap.matchIdA, overlap.matchIdB]
          : [match.matchId],
        courtIds: [court.courtId],
      });
      unassigned.push(
        createUnassignedMatch({
          matchId: match.matchId,
          reasonCode: COURT_ASSIGNMENT_CONFLICT_CODE.LOCK_OVERLAP,
          message: conflict.message,
          blockingConflictIds: [conflict.conflictId],
        })
      );
      hardLockFailure = true;
      continue;
    }

    assignments.push(
      createAssignedCourtSlot({
        matchId: match.matchId,
        courtId: court.courtId,
        venueId: request.venueId,
        scheduledStart: match.scheduledStart,
        scheduledEnd: match.scheduledEnd,
        assignmentSource: COURT_ASSIGNMENT_SOURCE.LOCKED,
        reasonCode: "LOCKED_PRESERVED",
        reason: `Preserved lock from ${lock.lockSource}`,
      })
    );
    occupancies.push(candidateOcc);
    lockedPreservedCount += 1;
  }

  // --- Partition assignable unlocked matches ---
  const assignable = [];
  for (const match of request.matches) {
    if (match.isBye) continue;
    if (isTerminal(match, policy)) continue;
    if (lockedMatchIds.has(match.matchId)) continue;
    // Already unassigned due to failed lock
    if (unassigned.some((u) => u.matchId === match.matchId)) continue;
    assignable.push(match);
  }

  const orderedMatches = stableSortCopy(assignable, (a, b) =>
    compareMatches(a, b, policy.matchOrderingStrategy)
  );
  const orderedCourts = stableSortCopy(request.courts, (a, b) =>
    compareCourts(a, b, policy.courtOrderingStrategy)
  );

  for (const match of orderedMatches) {
    /** @type {string[]} */
    const attempted = [];
    let selected = null;
    let lastReason = COURT_ASSIGNMENT_CONFLICT_CODE.NO_ELIGIBLE_COURT;
    let lastMessage = "No eligible court found";

    for (const court of orderedCourts) {
      attempted.push(court.courtId);
      const feasibility = evaluateCourtForMatch(
        match,
        court,
        request,
        occupancies
      );
      if (!feasibility.ok) {
        lastReason = feasibility.code;
        lastMessage = feasibility.message;
        continue;
      }
      selected = court;
      break;
    }

    if (!selected) {
      const conflict = pushConflict(conflicts, {
        conflictId: `no-court:${match.matchId}`,
        code: COURT_ASSIGNMENT_CONFLICT_CODE.NO_ELIGIBLE_COURT,
        severity: CONFLICT_SEVERITY.HARD,
        message: lastMessage,
        matchIds: [match.matchId],
        courtIds: [],
        details: { lastReason },
      });
      unassigned.push(
        createUnassignedMatch({
          matchId: match.matchId,
          reasonCode: COURT_ASSIGNMENT_CONFLICT_CODE.NO_ELIGIBLE_COURT,
          message: lastMessage,
          attemptedCourtIds: attempted,
          blockingConflictIds: [conflict.conflictId],
        })
      );
      continue;
    }

    assignments.push(
      createAssignedCourtSlot({
        matchId: match.matchId,
        courtId: selected.courtId,
        venueId: request.venueId,
        scheduledStart: match.scheduledStart,
        scheduledEnd: match.scheduledEnd,
        assignmentSource: COURT_ASSIGNMENT_SOURCE.AUTO,
        reasonCode: "AUTO_GREEDY_FIRST_ELIGIBLE",
        reason: `Selected by ${CORE12_COURT_SELECTION_STRATEGY_VERSION}`,
      })
    );
    occupancies.push({
      matchId: match.matchId,
      courtId: selected.courtId,
      startMs: match._startMs,
      endMs: match._endMs,
    });
  }

  // Stable ordering of outputs
  assignments.sort((a, b) => compareStableId(a.matchId, b.matchId));
  unassigned.sort((a, b) => compareStableId(a.matchId, b.matchId));
  conflicts.sort((a, b) => compareStableId(a.conflictId, b.conflictId));

  const assignableMatchCount =
    assignable.length + lockedPreservedCount + unassigned.filter((u) =>
      lockedMatchIds.has(u.matchId)
    ).length;

  // Recompute assignable count: non-bye non-terminal matches that needed a court
  const requiredMatches = request.matches.filter(
    (m) => !m.isBye && !isTerminal(m, policy)
  );
  const requiredCount = requiredMatches.length;

  let status = COURT_ASSIGNMENT_STATUS.SUCCESS;
  /** @type {object|null} */
  let failure = null;

  if (requiredCount === 0) {
    status = COURT_ASSIGNMENT_STATUS.SUCCESS;
  } else if (unassigned.length === 0 && !hardLockFailure) {
    status = COURT_ASSIGNMENT_STATUS.SUCCESS;
  } else if (policy.partialAssignmentAllowed && assignments.length > 0) {
    status = COURT_ASSIGNMENT_STATUS.PARTIAL;
  } else {
    status = COURT_ASSIGNMENT_STATUS.INFEASIBLE;
    if (!policy.partialAssignmentAllowed && unassigned.length > 0) {
      pushConflict(conflicts, {
        conflictId: "partial-not-allowed",
        code: COURT_ASSIGNMENT_CONFLICT_CODE.PARTIAL_ASSIGNMENT_NOT_ALLOWED,
        severity: CONFLICT_SEVERITY.HARD,
        message:
          "Partial assignment is not allowed; one or more matches remain unassigned",
        matchIds: unassigned.map((u) => u.matchId),
        courtIds: [],
      });
      conflicts.sort((a, b) => compareStableId(a.conflictId, b.conflictId));
    }
  }

  const notes = [
    "Phase 1B greedy deterministic assigner",
    "Overlap semantics: HALF_OPEN [start, end)",
    "Partial policy model: B (diagnostic) — INFEASIBLE may retain provisional assignments with committable=false",
  ];

  const diagnostics = createCourtAssignmentDiagnostics({
    engineVersion: CORE12_ENGINE_VERSION,
    inputMatchCount: request.matches.length,
    assignableMatchCount: requiredCount,
    assignedCount: assignments.length,
    lockedPreservedCount,
    unassignedCount: unassigned.length,
    courtCount: request.courts.length,
    orderingVersions: {
      comparatorVersion: CORE12_COMPARATOR_VERSION,
      matchOrderingStrategy: policy.matchOrderingStrategy,
      courtOrderingStrategy: policy.courtOrderingStrategy,
      courtSelectionStrategyVersion: CORE12_COURT_SELECTION_STRATEGY_VERSION,
    },
    notes,
    wallClockMs: null,
  });

  const committable =
    status === COURT_ASSIGNMENT_STATUS.SUCCESS ||
    status === COURT_ASSIGNMENT_STATUS.PARTIAL;

  const fingerprintMaterial = {
    schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
    status,
    committable,
    requestId: request.requestId,
    tenantId: request.tenantId,
    clubId: request.clubId,
    venueId: request.venueId,
    competitionId: request.competitionId,
    policy: {
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      comparatorVersion: policy.comparatorVersion,
      courtSelectionStrategyVersion: policy.courtSelectionStrategyVersion,
      partialAssignmentAllowed: policy.partialAssignmentAllowed,
      capabilityMatchMode: policy.capabilityMatchMode,
      overlapMode: policy.overlapMode,
      matchOrderingStrategy: policy.matchOrderingStrategy,
      courtOrderingStrategy: policy.courtOrderingStrategy,
      acceptLockedAssignments: policy.acceptLockedAssignments,
      invalidLockBehavior: policy.invalidLockBehavior,
    },
    assignments: assignments.map((a) => ({
      matchId: a.matchId,
      courtId: a.courtId,
      assignmentSource: a.assignmentSource,
      scheduledStart: a.scheduledStart,
      scheduledEnd: a.scheduledEnd,
    })),
    unassigned: unassigned.map((u) => ({
      matchId: u.matchId,
      reasonCode: u.reasonCode,
    })),
    conflicts: conflicts.map((c) => ({
      conflictId: c.conflictId,
      code: c.code,
      severity: c.severity,
      matchIds: [...c.matchIds],
      courtIds: [...c.courtIds],
    })),
    diagnostics: {
      assignedCount: diagnostics.assignedCount,
      unassignedCount: diagnostics.unassignedCount,
      lockedPreservedCount: diagnostics.lockedPreservedCount,
      orderingVersions: diagnostics.orderingVersions,
    },
    fingerprintAlgorithmVersion: CORE12_FINGERPRINT_VERSION,
  };

  const resultFingerprint = fingerprintValue(fingerprintMaterial);

  const replayMetadata = Object.freeze({
    engineVersion: CORE12_IDENTITY.version,
    contractSchemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    comparatorVersion: policy.comparatorVersion,
    courtSelectionStrategyVersion: policy.courtSelectionStrategyVersion,
    fingerprintAlgorithmVersion: CORE12_FINGERPRINT_VERSION,
    scheduleSnapshotFingerprint:
      request.scheduleSnapshotRef?.fingerprint ?? null,
    availabilitySnapshotFingerprint:
      request.availabilitySnapshotRef?.fingerprint ?? null,
    resultFingerprint,
  });

  return createCourtAssignmentResult({
    schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
    status,
    requestId: request.requestId,
    tenantId: request.tenantId,
    clubId: request.clubId,
    venueId: request.venueId,
    competitionId: request.competitionId,
    assignments,
    unassigned,
    conflicts,
    diagnostics,
    replayMetadata,
    resultFingerprint,
    failure,
    committable,
  });
}

/**
 * @param {object} request
 */
function collectEffectiveLocks(request) {
  /** @type {object[]} */
  const locks = request.lockedAssignments.map((l) => ({ ...l }));
  const lockedIds = new Set(locks.map((l) => l.matchId));
  for (const match of request.matches) {
    if (!match.manualCourtLock || !match.existingCourtId) continue;
    if (lockedIds.has(match.matchId)) continue;
    locks.push({
      matchId: match.matchId,
      courtId: match.existingCourtId,
      lockSource: COURT_LOCK_SOURCE.MANUAL,
      reason: "manualCourtLock on match",
      overrideAllowed: false,
    });
  }
  locks.sort((a, b) => compareStableId(a.matchId, b.matchId));
  return locks;
}

/**
 * @param {object} match
 * @param {object} policy
 */
function isTerminal(match, policy) {
  if (!policy.skipTerminalStatuses) return false;
  if (match.status == null) return false;
  return policy.terminalStatuses.includes(String(match.status).toLowerCase());
}

/**
 * @param {object} match
 * @param {object} court
 * @param {object} request
 * @param {readonly object[]} occupancies
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
function evaluateCourtForMatch(match, court, request, occupancies) {
  if (court.venueId !== request.venueId || court.clubId !== request.clubId) {
    return {
      ok: false,
      code: COURT_ASSIGNMENT_REJECTION_CODE.SCOPE_MISMATCH,
      message: `Court ${court.courtId} scope mismatch`,
    };
  }
  if (court.tenantId != null && court.tenantId !== request.tenantId) {
    return {
      ok: false,
      code: COURT_ASSIGNMENT_REJECTION_CODE.CROSS_TENANT_REFERENCE,
      message: `Court ${court.courtId} cross-tenant`,
    };
  }
  if (!court.active || court.eligible === false) {
    return {
      ok: false,
      code: COURT_ASSIGNMENT_CONFLICT_CODE.COURT_DISABLED,
      message: `Court ${court.courtId} is disabled or ineligible`,
    };
  }
  if (court.availabilityStatus === COURT_AVAILABILITY_STATUS.DISABLED) {
    return {
      ok: false,
      code: COURT_ASSIGNMENT_CONFLICT_CODE.COURT_DISABLED,
      message: `Court ${court.courtId} status DISABLED`,
    };
  }
  if (court.availabilityStatus === COURT_AVAILABILITY_STATUS.MAINTENANCE) {
    return {
      ok: false,
      code: COURT_ASSIGNMENT_CONFLICT_CODE.COURT_MAINTENANCE,
      message: `Court ${court.courtId} is in maintenance`,
    };
  }
  if (court.availabilityStatus === COURT_AVAILABILITY_STATUS.LOCKED) {
    return {
      ok: false,
      code: COURT_ASSIGNMENT_CONFLICT_CODE.COURT_LOCKED_INVENTORY,
      message: `Court ${court.courtId} inventory is locked`,
    };
  }
  if (court.availabilityStatus === COURT_AVAILABILITY_STATUS.UNAVAILABLE) {
    return {
      ok: false,
      code: COURT_ASSIGNMENT_CONFLICT_CODE.COURT_UNAVAILABLE,
      message: `Court ${court.courtId} is unavailable`,
    };
  }
  if (court.availabilityStatus !== COURT_AVAILABILITY_STATUS.AVAILABLE) {
    return {
      ok: false,
      code: COURT_ASSIGNMENT_CONFLICT_CODE.COURT_UNAVAILABLE,
      message: `Court ${court.courtId} is not AVAILABLE`,
    };
  }

  // Absolute availability coverage
  if (
    Array.isArray(court.availabilityIntervals) &&
    court.availabilityIntervals.length > 0
  ) {
    const covered = court.availabilityIntervals.some((iv) =>
      intervalFullyCovers(match._startMs, match._endMs, iv._startMs, iv._endMs)
    );
    if (!covered) {
      return {
        ok: false,
        code: COURT_ASSIGNMENT_CONFLICT_CODE.WINDOW_INCOMPATIBLE,
        message: `Court ${court.courtId} availability does not fully cover match ${match.matchId}`,
      };
    }
  }

  const capResult = checkCapabilities(match, court, request.policy);
  if (!capResult.ok) return capResult;

  const candidate = {
    matchId: match.matchId,
    courtId: court.courtId,
    startMs: match._startMs,
    endMs: match._endMs,
  };
  if (occupancyConflictsWith(occupancies, candidate)) {
    return {
      ok: false,
      code: COURT_ASSIGNMENT_CONFLICT_CODE.COURT_TIME_OVERLAP,
      message: `Court ${court.courtId} has an overlapping assignment for match ${match.matchId}`,
    };
  }

  return { ok: true };
}

/**
 * @param {object} match
 * @param {object} court
 * @param {object} policy
 */
function checkCapabilities(match, court, policy) {
  if (policy.capabilityMatchMode === CAPABILITY_MATCH_MODE.IGNORE) {
    return { ok: true };
  }
  const required = match.requiredCapabilities;
  if (required == null) return { ok: true };

  const requiredTags = Array.isArray(required)
    ? required
    : typeof required === "object" && required.courtType
      ? [String(required.courtType)]
      : typeof required === "object"
        ? Object.keys(required).filter((k) => required[k])
        : [];

  if (requiredTags.length === 0) return { ok: true };

  const courtCaps = court.capabilities;
  /** @type {Set<string>} */
  const available = new Set();
  if (Array.isArray(courtCaps)) {
    for (const c of courtCaps) available.add(String(c));
  } else if (courtCaps && typeof courtCaps === "object") {
    if (courtCaps.courtType) available.add(String(courtCaps.courtType));
    for (const [k, v] of Object.entries(courtCaps)) {
      if (v === true || typeof v === "string") available.add(k);
      if (typeof v === "string") available.add(v);
    }
  }

  const missing = requiredTags.filter((t) => !available.has(t));
  if (missing.length === 0) return { ok: true };

  if (policy.capabilityMatchMode === CAPABILITY_MATCH_MODE.SOFT) {
    return { ok: true };
  }
  return {
    ok: false,
    code: COURT_ASSIGNMENT_CONFLICT_CODE.CAPABILITY_MISMATCH,
    message: `Court ${court.courtId} missing capabilities: ${missing.join(", ")}`,
  };
}

/**
 * @param {object[]} conflicts
 * @param {object} partial
 */
function pushConflict(conflicts, partial) {
  const conflict = createCourtAssignmentConflict(partial);
  conflicts.push(conflict);
  return conflict;
}

/**
 * @param {unknown} input
 * @param {{ code: string, message: string, details: object }} validation
 */
function buildRejectedResult(input, validation) {
  const scope = extractScopeEcho(input);
  const fingerprintMaterial = {
    status: COURT_ASSIGNMENT_STATUS.REJECTED,
    code: validation.code,
    message: validation.message,
    details: validation.details,
    ...scope,
  };
  return createCourtAssignmentResult({
    schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
    status: COURT_ASSIGNMENT_STATUS.REJECTED,
    requestId: scope.requestId,
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    venueId: scope.venueId,
    competitionId: scope.competitionId,
    assignments: [],
    unassigned: [],
    conflicts: [
      createCourtAssignmentConflict({
        conflictId: `reject:${validation.code}`,
        code: validation.code,
        severity: CONFLICT_SEVERITY.HARD,
        message: validation.message,
        details: validation.details,
      }),
    ],
    diagnostics: createCourtAssignmentDiagnostics({
      engineVersion: CORE12_ENGINE_VERSION,
      inputMatchCount: Array.isArray(
        /** @type {{ matches?: unknown }} */ (input)?.matches
      )
        ? /** @type {{ matches: unknown[] }} */ (input).matches.length
        : 0,
      assignableMatchCount: 0,
      assignedCount: 0,
      lockedPreservedCount: 0,
      unassignedCount: 0,
      courtCount: Array.isArray(
        /** @type {{ courts?: unknown }} */ (input)?.courts
      )
        ? /** @type {{ courts: unknown[] }} */ (input).courts.length
        : 0,
      orderingVersions: {},
      notes: ["Request rejected before assignment"],
    }),
    replayMetadata: null,
    resultFingerprint: fingerprintValue(fingerprintMaterial),
    failure: {
      code: validation.code,
      message: validation.message,
      details: validation.details,
    },
    committable: false,
  });
}

/**
 * @param {object} request
 * @param {{ code: string, message: string, details: object }} failure
 */
function buildRejectedFromNormalized(request, failure) {
  return buildRejectedResult(
    {
      requestId: request.requestId,
      tenantId: request.tenantId,
      clubId: request.clubId,
      venueId: request.venueId,
      competitionId: request.competitionId,
      matches: request.matches,
      courts: request.courts,
    },
    failure
  );
}

/**
 * @param {unknown} input
 */
function extractScopeEcho(input) {
  const obj =
    input && typeof input === "object"
      ? /** @type {Record<string, unknown>} */ (input)
      : {};
  const asId = (v, fallback) =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;
  return {
    requestId: asId(obj.requestId, "unknown-request"),
    tenantId: asId(obj.tenantId, "unknown-tenant"),
    clubId: asId(obj.clubId, "unknown-club"),
    venueId: asId(obj.venueId, "unknown-venue"),
    competitionId: asId(obj.competitionId, "unknown-competition"),
  };
}

/**
 * Host-side safe wrapper (NOT part of the Phase 1B pure production surface).
 * Maps unexpected thrown errors to reserved ERROR status with a sanitized,
 * non-host-specific failure message. Prefer `assignCourtsDeterministic`, which
 * returns REJECTED/INFEASIBLE without throwing for expected failures.
 *
 * Exported only via `adapters/index.js`.
 * @param {unknown} input
 */
export function assignCourtsSafe(input) {
  try {
    return assignCourtsDeterministic(input);
  } catch (err) {
    if (isCourtAssignmentContractError(err)) {
      return buildRejectedResult(input, {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      });
    }
    const scope = extractScopeEcho(input);
    return createCourtAssignmentResult({
      schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
      status: COURT_ASSIGNMENT_STATUS.ERROR,
      ...scope,
      assignments: [],
      unassigned: [],
      conflicts: [],
      diagnostics: createCourtAssignmentDiagnostics({
        engineVersion: CORE12_ENGINE_VERSION,
        notes: ["Unexpected engine error (sanitized)"],
      }),
      resultFingerprint: fingerprintValue({
        status: COURT_ASSIGNMENT_STATUS.ERROR,
        code: "ERROR",
      }),
      failure: {
        code: "ERROR",
        message: "Unexpected court-assignment engine failure",
        details: {},
      },
      committable: false,
    });
  }
}
