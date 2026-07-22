/**
 * explainUnassignedMatch — deterministic unassigned diagnostics.
 */

import { REFEREE_ROLE_CODE } from "../enums/roleCodes.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { createUnassignedRefereeRequirement } from "../contracts/unassignedRefereeRequirement.js";
import { createRefereeRoleRequirement } from "../contracts/refereeRoleRequirement.js";
import { compareStableString } from "../deterministic/compare.js";
import { evaluateRefereeEligibility } from "./evaluateRefereeEligibility.js";
import { detectRefereeConflicts } from "./detectRefereeConflicts.js";
import { tryHalfOpenWindow } from "./timeModel.js";
import { isActiveAssignmentStatus } from "./conflictPolicyNormalize.js";

/**
 * @param {object} input
 */
export function explainUnassignedMatch(input = {}) {
  const match =
    input.match && typeof input.match === "object" ? input.match : {};
  const matchId = String(match.matchId || input.matchId || "").trim() || "unknown";

  const roleRequirement = normalizeRoleRequirement(input);
  const roleCode = roleRequirement.roleCode;
  const requiredCount = roleRequirement.minCount;
  const existingAssignments = Array.isArray(input.existingAssignments)
    ? input.existingAssignments
    : [];
  const assignedCount = existingAssignments.filter(
    (a) =>
      a &&
      String(a.matchId) === matchId &&
      String(a.roleCode) === roleCode &&
      isActiveAssignmentStatus(a.status)
  ).length;
  const unfilledCount = Math.max(0, requiredCount - assignedCount);

  /** @type {Record<string, number>} */
  const reasonCounts = {};
  const bump = (code) => {
    reasonCounts[code] = (reasonCounts[code] || 0) + 1;
  };

  /** @type {object[]} */
  const blockingConflicts = [];
  /** @type {string[]} */
  const evidenceRefs = [];

  if (matchId === "unknown" || !(input.match?.matchId || input.matchId)) {
    bump(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED);
  }

  if (roleCode === REFEREE_ROLE_CODE.ANY) {
    bump(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED);
  }

  const matchWindow = tryHalfOpenWindow(match.startAt, match.endAt, "match");
  if (!matchWindow) {
    bump(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED);
  }

  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const ordered = [...candidates].sort((a, b) =>
    compareStableString(a?.refereeId, b?.refereeId)
  );

  if (ordered.length === 0) {
    bump(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NO_REFEREE_CANDIDATES);
  }

  const concreteRole =
    roleCode === REFEREE_ROLE_CODE.ANY
      ? REFEREE_ROLE_CODE.PRIMARY
      : roleCode;

  let eligibleCount = 0;
  for (const candidate of ordered) {
    if (!candidate?.refereeId) continue;
    const result = evaluateRefereeEligibility({
      tenantId: input.tenantId || "tenant",
      tournamentId: input.tournamentId || "tournament",
      candidate,
      match: { ...match, matchId },
      roleCode: concreteRole,
      qualifications: input.qualifications,
      availabilityWindows: input.availabilityWindows,
      existingAssignments,
      scheduleRows: input.scheduleRows,
      conflictPolicy: input.conflictPolicy,
      policy: input.policy,
      candidateTeamIds: input.candidateTeamIdsByReferee?.[candidate.refereeId],
      requireCertification: input.requireCertification === true,
    });

    evidenceRefs.push(`candidate:${candidate.refereeId}`);
    for (const ref of result.evidenceRefs) evidenceRefs.push(ref);

    if (result.eligible) {
      eligibleCount += 1;
    } else {
      for (const failure of result.hardFailures) {
        bump(failure.code);
      }
    }

    const detected = detectRefereeConflicts({
      refereeId: candidate.refereeId,
      candidate,
      match: { ...match, matchId },
      roleCode: concreteRole,
      existingAssignments,
      scheduleRows: input.scheduleRows,
      conflictPolicy: input.conflictPolicy,
      policy: input.policy,
      candidateTeamIds: input.candidateTeamIdsByReferee?.[candidate.refereeId],
    });
    for (const conflict of detected.conflicts) {
      blockingConflicts.push(conflict);
    }
  }

  if (ordered.length > 0 && eligibleCount === 0) {
    bump(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NO_ELIGIBLE_REFEREE);
  }

  if (unfilledCount > 0) {
    bump(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REQUIRED_REFEREE_ROLE_UNFILLED);
  }

  // Capacity exhausted signal when role already has assignee and still evaluating gap
  if (
    assignedCount >= requiredCount &&
    unfilledCount === 0 &&
    Object.keys(reasonCounts).length === 0
  ) {
    bump(REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REQUIRED_REFEREE_ROLE_UNFILLED);
  }

  const reasonCodes =
    Object.keys(reasonCounts).sort(compareStableString).length > 0
      ? Object.keys(reasonCounts).sort(compareStableString)
      : [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NO_ELIGIBLE_REFEREE];

  /** @type {Record<string, number>} */
  const sortedCounts = {};
  for (const code of reasonCodes) {
    sortedCounts[code] = reasonCounts[code] || 1;
  }

  const conflictMap = new Map();
  for (const c of blockingConflicts) {
    if (!conflictMap.has(c.conflictId)) conflictMap.set(c.conflictId, c);
  }
  const sortedConflicts = [...conflictMap.values()].sort((a, b) => {
    let c = compareStableString(a.matchId, b.matchId);
    if (c !== 0) return c;
    c = compareStableString(a.refereeId, b.refereeId);
    if (c !== 0) return c;
    c = compareStableString(a.conflictType, b.conflictType);
    if (c !== 0) return c;
    return compareStableString(a.conflictId, b.conflictId);
  });

  return createUnassignedRefereeRequirement({
    matchId,
    roleCode,
    mandatory: roleRequirement.mandatory,
    requiredCount,
    assignedCount,
    unfilledCount,
    candidateCountEvaluated: ordered.length,
    candidateCountEligible: eligibleCount,
    reasonCodes,
    reasonCounts: sortedCounts,
    blockingConflicts: sortedConflicts,
    evidenceRefs: [...new Set(evidenceRefs)].sort(compareStableString),
  });
}

function normalizeRoleRequirement(input) {
  try {
    if (input.roleRequirement?.roleCode != null) {
      return input.roleRequirement.schemaVersion
        ? input.roleRequirement
        : createRefereeRoleRequirement(input.roleRequirement);
    }
    return createRefereeRoleRequirement({
      roleCode: input.roleCode || REFEREE_ROLE_CODE.PRIMARY,
      mandatory: input.mandatory !== false,
      minCount: input.requiredCount ?? 1,
      maxCount: input.requiredCount ?? input.maxCount ?? 1,
    });
  } catch {
    return createRefereeRoleRequirement({
      roleCode: REFEREE_ROLE_CODE.PRIMARY,
      mandatory: true,
      minCount: 1,
      maxCount: 1,
    });
  }
}
