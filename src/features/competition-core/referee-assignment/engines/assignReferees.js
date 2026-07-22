/**
 * assignReferees — pure deterministic assignment planner (Phase 1D).
 */

import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { CORE13_ENGINE_VERSION } from "../constants/versions.js";
import { REFEREE_ROLE_CODE } from "../enums/roleCodes.js";
import { REFEREE_SNAPSHOT_STATUS } from "../enums/snapshotStatus.js";
import { REFEREE_ASSIGNMENT_STATUS } from "../enums/assignmentStatus.js";
import { REFEREE_ASSIGNMENT_SOURCE } from "../enums/assignmentSource.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { createRefereeAssignmentRequest } from "../contracts/refereeAssignmentRequest.js";
import { createRefereeAssignmentPolicy } from "../contracts/refereeAssignmentPolicy.js";
import { createRefereeAssignment } from "../contracts/refereeAssignment.js";
import { createRefereeAssignmentPlan } from "../contracts/refereeAssignmentPlan.js";
import { createRefereeAssignmentFailure } from "../contracts/refereeAssignmentFailure.js";
import { createRefereeRoleRequirement } from "../contracts/refereeRoleRequirement.js";
import { ownedFreeze } from "../contracts/shared.js";
import { compareStableString } from "../deterministic/compare.js";
import {
  buildAssignmentId,
  buildPlanId,
  fingerprintValue,
  serializeCanonical,
  normalizePlannerSeed,
  seedExplorationKey,
  CORE13_DIGEST_DOMAIN,
} from "../deterministic/fingerprint.js";
import { evaluateRefereeEligibility } from "../services/evaluateRefereeEligibility.js";
import { explainUnassignedMatch } from "../services/explainUnassignedMatch.js";
import { tryHalfOpenWindow } from "../services/timeModel.js";
import { normalizeConflictPolicy } from "../services/conflictPolicyNormalize.js";
import {
  buildSoftScoreVector,
  compareCandidates,
} from "../planning/softScoring.js";

/**
 * @param {object} input
 */
export function assignReferees(input = {}) {
  try {
    return planAssignments(input);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? /** @type {{ code: string }} */ (err).code
        : REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST;
    return ownedFreeze({
      ok: false,
      plan: null,
      failure: createRefereeAssignmentFailure({
        code,
        message: err instanceof Error ? err.message : String(code),
        details:
          err && typeof err === "object" && "details" in err
            ? /** @type {{ details: object }} */ (err).details
            : {},
      }),
    });
  }
}

function planAssignments(input) {
  const structural = validateStructural(input);
  if (!structural.ok) {
    return ownedFreeze({
      ok: false,
      plan: null,
      failure: structural.failure,
    });
  }

  const {
    request,
    policy,
    candidates,
    qualifications,
    availabilityWindows,
    existingAssignments,
    scheduleRows,
    conflictPolicy,
    historyWorkloads,
    seed,
    populationRefereeIds,
    workloadCohortSize,
  } = structural;

  const matches = orderMatches(scheduleRows, request.matchIds);

  /** @type {object[]} */
  const planned = [];
  /** @type {object[]} */
  const unassigned = [];

  for (const match of matches) {
    const requirements = orderRequirements(
      resolveRequirements(match, policy, input.roleRequirementsByMatch)
    );

    for (const requirement of requirements) {
      const slotsNeeded = requirement.minCount;
      for (let slotIndex = 0; slotIndex < slotsNeeded; slotIndex += 1) {
        const combinedAssignments = [...existingAssignments, ...planned];

        // Capacity: role already filled for this match?
        const filledForRole = combinedAssignments.filter(
          (a) =>
            String(a.matchId) === String(match.matchId) &&
            String(a.roleCode) ===
              (requirement.roleCode === REFEREE_ROLE_CODE.ANY
                ? String(a.roleCode)
                : requirement.roleCode) &&
            (a.status === REFEREE_ASSIGNMENT_STATUS.PLANNED ||
              a.status === REFEREE_ASSIGNMENT_STATUS.CONFIRMED)
        );

        // For concrete roles, count exact role; for ANY count all active on match toward that req separately per slot
        if (
          requirement.roleCode !== REFEREE_ROLE_CODE.ANY &&
          filledForRole.length >= requirement.maxCount
        ) {
          // already at max — treat as filled for remaining slots
          continue;
        }

        const ranked = rankEligibleCandidates({
          request,
          policy,
          candidates,
          qualifications,
          availabilityWindows,
          existingAssignments: combinedAssignments,
          scheduleRows,
          conflictPolicy,
          match,
          requirement,
          populationRefereeIds,
          seed,
          plannedOnMatch: planned.filter(
            (a) => String(a.matchId) === String(match.matchId)
          ),
        });

        if (ranked.length === 0) {
          const explained = explainUnassignedMatch({
            tenantId: request.tenantId,
            tournamentId: request.tournamentId,
            match,
            roleRequirement: requirement,
            candidates,
            qualifications,
            availabilityWindows,
            existingAssignments: combinedAssignments,
            scheduleRows,
            conflictPolicy,
            policy,
          });
          // Fix mandatory labeling
          unassigned.push(
            ownedFreeze({
              ...explained,
              mandatory: requirement.mandatory === true,
              roleCode:
                requirement.roleCode === REFEREE_ROLE_CODE.ANY
                  ? explained.roleCode
                  : requirement.roleCode,
            })
          );
          continue;
        }

        const winner = ranked[0];
        const concreteRole = winner.concreteRole;
        const assignmentId = buildAssignmentId({
          schemaVersion: CORE13_SCHEMA_VERSION,
          requestId: request.requestId,
          tenantId: request.tenantId,
          tournamentId: request.tournamentId,
          matchId: match.matchId,
          roleCode: concreteRole,
          slotIndex,
          refereeId: winner.refereeId,
          source: REFEREE_ASSIGNMENT_SOURCE.AUTO,
        });

        planned.push(
          createRefereeAssignment({
            assignmentId,
            matchId: match.matchId,
            refereeId: winner.refereeId,
            roleCode: concreteRole,
            status: REFEREE_ASSIGNMENT_STATUS.PLANNED,
            source: REFEREE_ASSIGNMENT_SOURCE.AUTO,
            constraintsSatisfied: winner.eligibility.evaluatedConstraintKinds,
            metadata: {
              slotIndex,
              scoreVector: winner.scoreVector,
            },
          })
        );
      }
    }
  }

  void historyWorkloads;

  const planId = buildPlanId({
    schemaVersion: CORE13_SCHEMA_VERSION,
    requestId: request.requestId,
    tenantId: request.tenantId,
    tournamentId: request.tournamentId,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    seed,
    enableSeededExploration: policy.enableSeededExploration === true,
  });

  const snapshotFingerprints = {
    directory: fingerprintSnapshot(
      candidates,
      CORE13_DIGEST_DOMAIN.SNAPSHOT_DIRECTORY
    ),
    qualifications: fingerprintSnapshot(
      qualifications,
      CORE13_DIGEST_DOMAIN.SNAPSHOT_QUALIFICATION
    ),
    availability: fingerprintSnapshot(
      availabilityWindows,
      CORE13_DIGEST_DOMAIN.SNAPSHOT_AVAILABILITY
    ),
    existing: fingerprintSnapshot(
      existingAssignments,
      CORE13_DIGEST_DOMAIN.SNAPSHOT_EXISTING_ASSIGNMENT
    ),
    schedule: fingerprintSnapshot(
      scheduleRows,
      CORE13_DIGEST_DOMAIN.SNAPSHOT_SCHEDULE
    ),
    conflictPolicy: fingerprintValue(
      conflictPolicy,
      CORE13_DIGEST_DOMAIN.SNAPSHOT_CONFLICT_POLICY
    ),
    history: fingerprintSnapshot(
      historyWorkloads || [],
      CORE13_DIGEST_DOMAIN.SNAPSHOT_WORKLOAD_HISTORY
    ),
  };

  const sortedAssignments = [...planned].sort((a, b) => {
    let c = compareStableString(a.matchId, b.matchId);
    if (c !== 0) return c;
    c = compareStableString(a.roleCode, b.roleCode);
    if (c !== 0) return c;
    c = compareStableString(String(a.metadata?.slotIndex ?? 0), String(b.metadata?.slotIndex ?? 0));
    if (c !== 0) return c;
    return compareStableString(a.refereeId, b.refereeId);
  });

  const sortedUnassigned = [...unassigned].sort((a, b) => {
    let c = compareStableString(a.matchId, b.matchId);
    if (c !== 0) return c;
    return compareStableString(a.roleCode, b.roleCode);
  });

  const planFingerprint = fingerprintValue(
    {
      requestId: request.requestId,
      tenantId: request.tenantId,
      tournamentId: request.tournamentId,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      requireSeed: policy.requireSeed === true,
      enableSeededExploration: policy.enableSeededExploration === true,
      seed: seed ?? null,
      workloadCohortSize,
      populationRefereeIds,
      snapshotFingerprints,
      assignments: sortedAssignments.map((a) => ({
        assignmentId: a.assignmentId,
        matchId: a.matchId,
        refereeId: a.refereeId,
        roleCode: a.roleCode,
        status: a.status,
        source: a.source,
        slotIndex: a.metadata?.slotIndex ?? null,
      })),
      unassigned: sortedUnassigned.map((u) => ({
        matchId: u.matchId,
        roleCode: u.roleCode,
        mandatory: u.mandatory,
        reasonCodes: u.reasonCodes,
        unfilledCount: u.unfilledCount,
      })),
      engineVersion: CORE13_ENGINE_VERSION,
      schemaVersion: CORE13_SCHEMA_VERSION,
    },
    CORE13_DIGEST_DOMAIN.PLAN_FINGERPRINT
  );

  const replayMetadata = ownedFreeze({
    engineVersion: CORE13_ENGINE_VERSION,
    contractSchemaVersion: CORE13_SCHEMA_VERSION,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    seed: seed ?? null,
    enableSeededExploration: policy.enableSeededExploration === true,
    workloadCohortSize,
    planFingerprint,
    snapshotFingerprints,
  });

  const plan = createRefereeAssignmentPlan({
    planId,
    requestId: request.requestId,
    assignments: sortedAssignments,
    unassigned: sortedUnassigned,
    workloads: [],
    diagnostics: [],
    planFingerprint,
    replayMetadata,
  });

  return ownedFreeze({
    ok: true,
    plan,
    failure: null,
  });
}

function validateStructural(input) {
  const fail = (code, message, details = {}) => ({
    ok: false,
    failure: createRefereeAssignmentFailure({ code, message, details }),
  });

  let request;
  let policy;
  try {
    policy = input.policy?.policyId
      ? input.policy.schemaVersion
        ? input.policy
        : createRefereeAssignmentPolicy(input.policy)
      : createRefereeAssignmentPolicy(input.policy || { policyId: "pol", policyVersion: "1" });

    request = input.request?.requestId
      ? input.request.schemaVersion
        ? input.request
        : createRefereeAssignmentRequest({
            ...input.request,
            policy,
            context: input.request.context || {
              tenantId: input.request.tenantId,
              tournamentId: input.request.tournamentId,
              matchIds: input.request.matchIds,
            },
          })
      : null;
  } catch (err) {
    return fail(
      err?.code || REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      err instanceof Error ? err.message : "Invalid request"
    );
  }

  if (!request) {
    return fail(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "RefereeAssignmentRequest required"
    );
  }

  for (const [name, snap] of [
    ["directory", input.directorySnapshot],
    ["schedule", input.scheduleSnapshot],
    ["existingAssignments", input.existingAssignmentSnapshot],
    ["qualifications", input.qualificationSnapshot],
    ["availability", input.availabilitySnapshot],
  ]) {
    if (snap == null || snap.status === REFEREE_SNAPSHOT_STATUS.MISSING) {
      return fail(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING,
        `Missing snapshot: ${name}`,
        { snapshot: name }
      );
    }
    if (snap.status === REFEREE_SNAPSHOT_STATUS.INVALID) {
      return fail(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID,
        `Invalid snapshot: ${name}`,
        { snapshot: name }
      );
    }
  }

  let seed = null;
  try {
    seed = normalizePlannerSeed(request.seed);
  } catch (err) {
    return fail(
      err?.code || REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      err instanceof Error ? err.message : "Invalid seed"
    );
  }
  if (policy.requireSeed && seed == null) {
    return fail(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "Seed required by policy"
    );
  }
  // Seed present but exploration disabled must not affect results or fingerprints.
  if (!policy.enableSeededExploration) {
    seed = null;
  }

  const rawCandidates = Array.isArray(input.directorySnapshot.items)
    ? input.directorySnapshot.items
    : [];
  const rawScheduleRows = Array.isArray(input.scheduleSnapshot.items)
    ? input.scheduleSnapshot.items
    : [];

  const cohort = buildWorkloadCohort(rawCandidates);
  if (!cohort.ok) {
    return fail(cohort.code, cohort.message, cohort.details);
  }

  const scheduleNorm = normalizeScheduleRows(rawScheduleRows);
  if (!scheduleNorm.ok) {
    return fail(scheduleNorm.code, scheduleNorm.message, scheduleNorm.details);
  }

  return {
    ok: true,
    request,
    policy,
    candidates: cohort.candidates,
    populationRefereeIds: cohort.populationRefereeIds,
    workloadCohortSize: cohort.workloadCohortSize,
    qualifications: Array.isArray(input.qualificationSnapshot.items)
      ? input.qualificationSnapshot.items
      : [],
    availabilityWindows: Array.isArray(input.availabilitySnapshot.items)
      ? input.availabilitySnapshot.items
      : [],
    existingAssignments: Array.isArray(input.existingAssignmentSnapshot.items)
      ? input.existingAssignmentSnapshot.items
      : [],
    scheduleRows: scheduleNorm.rows,
    conflictPolicy: normalizeConflictPolicy(input.conflictPolicy),
    historyWorkloads: Array.isArray(input.workloadHistorySnapshot?.items)
      ? input.workloadHistorySnapshot.items
      : [],
    seed,
  };
}

/**
 * Fairness workload cohort: distinct active valid candidates.
 * Match-specific ineligibility does not remove cohort membership.
 */
function buildWorkloadCohort(rawCandidates) {
  /** @type {Map<string, { candidate: object, canon: string }>} */
  const byId = new Map();
  for (const candidate of rawCandidates) {
    if (!candidate || typeof candidate !== "object") {
      return {
        ok: false,
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID,
        message: "Malformed candidate record",
        details: {},
      };
    }
    const refereeId = String(candidate.refereeId || "").trim();
    if (!refereeId) {
      return {
        ok: false,
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID,
        message: "Candidate missing refereeId",
        details: {},
      };
    }
    if (candidate.active !== true) {
      continue;
    }
    const canon = serializeCanonical(authoritativeCandidateFacts(candidate));
    if (byId.has(refereeId)) {
      if (byId.get(refereeId).canon !== canon) {
        return {
          ok: false,
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
          message: "Conflicting duplicate candidate records",
          details: { refereeId },
        };
      }
      continue;
    }
    byId.set(refereeId, { candidate, canon });
  }

  const populationRefereeIds = [...byId.keys()].sort(compareStableString);
  const candidates = populationRefereeIds.map((id) => byId.get(id).candidate);
  return {
    ok: true,
    candidates,
    populationRefereeIds,
    workloadCohortSize: populationRefereeIds.length,
  };
}

function authoritativeCandidateFacts(candidate) {
  return {
    refereeId: String(candidate.refereeId),
    active: candidate.active === true,
    playerId: candidate.playerId == null || candidate.playerId === ""
      ? null
      : String(candidate.playerId),
    clubIds: [...(candidate.clubIds || [])].map(String).sort(compareStableString),
    organizationIds: [...(candidate.organizationIds || [])]
      .map(String)
      .sort(compareStableString),
    preferenceTags: [...(candidate.preferenceTags || [])]
      .map(String)
      .sort(compareStableString),
  };
}

function normalizeScheduleRows(rawRows) {
  /** @type {Map<string, { row: object, canon: string }>} */
  const byId = new Map();
  for (const row of rawRows) {
    if (!row || typeof row !== "object") {
      return {
        ok: false,
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID,
        message: "Malformed schedule row",
        details: {},
      };
    }
    const id = String(row.matchId || "").trim();
    if (!id) continue;
    const canon = serializeCanonical({
      matchId: id,
      startAt: row.startAt ?? null,
      endAt: row.endAt ?? null,
      courtId: row.courtId ?? null,
      scheduleOrder:
        typeof row.scheduleOrder === "number" && Number.isFinite(row.scheduleOrder)
          ? row.scheduleOrder
          : null,
      divisionId: row.divisionId ?? null,
      participantRefs: [...(row.participantRefs || [])]
        .map(String)
        .sort(compareStableString),
      teamRefs: [...(row.teamRefs || [])].map(String).sort(compareStableString),
      clubIds: [...(row.clubIds || [])].map(String).sort(compareStableString),
      organizationIds: [...(row.organizationIds || [])]
        .map(String)
        .sort(compareStableString),
    });
    if (byId.has(id) && byId.get(id).canon !== canon) {
      return {
        ok: false,
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        message: "Conflicting duplicate match schedule rows",
        details: { matchId: id },
      };
    }
    if (!byId.has(id)) {
      byId.set(id, { row, canon });
    }
  }
  const rows = [...byId.keys()]
    .sort(compareStableString)
    .map((id) => byId.get(id).row);
  return { ok: true, rows };
}

function orderMatches(scheduleRows, matchIds) {
  const byId = new Map(
    scheduleRows.map((r) => [String(r.matchId), r])
  );
  const ids = (matchIds && matchIds.length
    ? matchIds
    : scheduleRows.map((r) => r.matchId)
  ).map(String);

  const unique = [...new Set(ids)];
  const rows = unique.map((id) => byId.get(id) || { matchId: id });

  return rows.sort((a, b) => {
    const ao =
      typeof a.scheduleOrder === "number" && Number.isFinite(a.scheduleOrder)
        ? a.scheduleOrder
        : null;
    const bo =
      typeof b.scheduleOrder === "number" && Number.isFinite(b.scheduleOrder)
        ? b.scheduleOrder
        : null;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    let c = compareStableString(a.startAt || "", b.startAt || "");
    if (c !== 0) return c;
    c = compareStableString(a.endAt || "", b.endAt || "");
    if (c !== 0) return c;
    return compareStableString(a.matchId, b.matchId);
  });
}

function resolveRequirements(match, policy, byMatch) {
  if (byMatch && byMatch[match.matchId]) {
    return byMatch[match.matchId].map((r) =>
      r.schemaVersion ? r : createRefereeRoleRequirement(r)
    );
  }
  if (Array.isArray(match.roleRequirements)) {
    return match.roleRequirements.map((r) =>
      r.schemaVersion ? r : createRefereeRoleRequirement(r)
    );
  }
  return [...policy.defaultRoleRequirements];
}

function orderRequirements(requirements) {
  return [...requirements]
    .map((r, index) => ({ r, index }))
    .sort((a, b) => {
      const am = a.r.mandatory === true ? 0 : 1;
      const bm = b.r.mandatory === true ? 0 : 1;
      if (am !== bm) return am - bm;
      const ap =
        typeof a.r.metadata?.priority === "number"
          ? a.r.metadata.priority
          : typeof a.r.priority === "number"
            ? a.r.priority
            : null;
      const bp =
        typeof b.r.metadata?.priority === "number"
          ? b.r.metadata.priority
          : typeof b.r.priority === "number"
            ? b.r.priority
            : null;
      if (ap != null && bp != null && ap !== bp) return ap - bp;
      let c = compareStableString(a.r.roleCode, b.r.roleCode);
      if (c !== 0) return c;
      return a.index - b.index;
    })
    .map((x) => x.r);
}

function rankEligibleCandidates(ctx) {
  const {
    request,
    policy,
    candidates,
    qualifications,
    availabilityWindows,
    existingAssignments,
    scheduleRows,
    conflictPolicy,
    match,
    requirement,
    populationRefereeIds,
    seed,
    plannedOnMatch,
  } = ctx;

  /** @type {object[]} */
  const ranked = [];

  for (const candidate of [...candidates].sort((a, b) =>
    compareStableString(a.refereeId, b.refereeId)
  )) {
    if (
      !policy.allowSameRefereeMultipleRolesOnMatch &&
      plannedOnMatch.some((a) => String(a.refereeId) === String(candidate.refereeId))
    ) {
      continue;
    }

    const concreteRoles = resolveConcreteRoles(
      candidate,
      requirement,
      qualifications,
      policy
    );
    for (const concreteRole of concreteRoles) {
      if (concreteRole === REFEREE_ROLE_CODE.ANY) continue;

      const eligibility = evaluateRefereeEligibility({
        tenantId: request.tenantId,
        tournamentId: request.tournamentId,
        candidate,
        match,
        roleCode: concreteRole,
        qualifications,
        availabilityWindows,
        existingAssignments,
        scheduleRows,
        conflictPolicy,
        policy,
        roleMaxCount: requirement.maxCount,
      });

      if (!eligibility.eligible) continue;

      const soft = buildSoftScoreVector({
        policy,
        candidate,
        match,
        roleCode: concreteRole,
        existingAssignments,
        scheduleRows,
        populationRefereeIds,
        preferredRoleCode: requirement.preferredRoleCode,
        conflictSoftNotes: eligibility.softNotes,
      });

      let seedKey = null;
      if (policy.enableSeededExploration && seed != null) {
        seedKey = seedExplorationKey({
          seed,
          matchId: match.matchId,
          roleCode: concreteRole,
          refereeId: candidate.refereeId,
        });
      }

      ranked.push({
        refereeId: candidate.refereeId,
        concreteRole,
        eligibility,
        scoreVector: soft.scoreVector,
        seedKey,
      });
    }
  }

  ranked.sort(compareCandidates);
  return ranked;
}

function resolveConcreteRoles(candidate, requirement, qualifications, policy) {
  if (requirement.roleCode !== REFEREE_ROLE_CODE.ANY) {
    return [requirement.roleCode];
  }
  const quals = (qualifications || []).filter(
    (q) => String(q.refereeId) === String(candidate.refereeId)
  );
  const roles = [
    ...new Set(
      quals
        .map((q) => String(q.roleCode))
        .filter((r) => r && r !== REFEREE_ROLE_CODE.ANY)
    ),
  ].sort(compareStableString);

  if (policy.preferredConcreteRoles?.length) {
    const preferred = policy.preferredConcreteRoles.filter((r) =>
      roles.includes(r)
    );
    if (preferred.length) return preferred;
  }
  return roles;
}

function fingerprintSnapshot(items, domain) {
  const material = (items || []).map((item) => {
    if (!item || typeof item !== "object") return item;
    // Strip non-authoritative displayLabel from fingerprint material
    const { displayLabel, ...rest } = item;
    void displayLabel;
    return rest;
  });
  // Order must not affect snapshot fingerprint — sort by canonical serialization.
  const sorted = [...material].sort((a, b) =>
    compareStableString(serializeCanonical(a), serializeCanonical(b))
  );
  return fingerprintValue(sorted, domain);
}

void tryHalfOpenWindow;
