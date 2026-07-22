/**
 * detectRefereeConflicts — pure deterministic conflict detection.
 */

import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_CONFLICT_TYPE } from "../enums/conflictType.js";
import { REFEREE_DIAGNOSTIC_SEVERITY } from "../enums/diagnosticSeverity.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { createRefereeConflict } from "../contracts/refereeConflict.js";
import { createRefereeResourceConflictProjection } from "../contracts/refereeResourceConflictProjection.js";
import { ownedFreeze } from "../contracts/shared.js";
import { compareStableString } from "../deterministic/compare.js";
import {
  intervalsOverlapHalfOpen,
  tryHalfOpenWindow,
} from "./timeModel.js";
import {
  isActiveAssignmentStatus,
  normalizeConflictPolicy,
} from "./conflictPolicyNormalize.js";
import { REFEREE_ASSIGNMENT_STATUS } from "../enums/assignmentStatus.js";

/**
 * Deterministic conflict id (no random).
 */
function buildConflictId(parts) {
  return parts.map((p) => String(p ?? "")).join("::");
}

/**
 * @param {object} input
 * @returns {Readonly<{ schemaVersion: string, conflicts: readonly object[], projections: readonly object[] }>}
 */
export function detectRefereeConflicts(input = {}) {
  const refereeId = String(input.refereeId || "").trim();
  const match = input.match && typeof input.match === "object" ? input.match : {};
  const matchId = String(match.matchId || input.matchId || "").trim();
  const roleCode =
    input.roleCode == null || input.roleCode === ""
      ? ""
      : String(input.roleCode).trim();
  const candidate =
    input.candidate && typeof input.candidate === "object"
      ? input.candidate
      : null;
  const policy = normalizeConflictPolicy(input.conflictPolicy);
  const assignmentPolicy =
    input.policy && typeof input.policy === "object" ? input.policy : {};
  const allowSelfRefereed = assignmentPolicy.allowSelfRefereed === true;
  const existingAssignments = Array.isArray(input.existingAssignments)
    ? input.existingAssignments
    : [];
  const scheduleByMatchId = buildScheduleIndex(input.scheduleRows);
  const candidateTeamIds = normalizeIdList(
    input.candidateTeamIds ?? candidate?.teamIds
  );

  /** @type {object[]} */
  const conflicts = [];
  /** @type {object[]} */
  const softNotes = [];

  if (!refereeId || !matchId) {
    return ownedFreeze({
      schemaVersion: CORE13_SCHEMA_VERSION,
      conflicts: Object.freeze([]),
      projections: Object.freeze([]),
      softNotes: Object.freeze([]),
    });
  }

  // Explicit referee exclusion
  if (policy.excludedRefereeIds.includes(refereeId)) {
    conflicts.push(
      makeConflict({
        conflictType: REFEREE_CONFLICT_TYPE.EXCLUSION,
        refereeId,
        matchId,
        roleCode,
        reasonCodes: [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST],
        details: { kind: "excluded_referee" },
      })
    );
  }

  // Explicit referee-match exclusion
  for (const ex of policy.matchExclusions) {
    if (ex.refereeId === refereeId && ex.matchId === matchId) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.EXCLUSION,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST,
          ],
          details: { kind: "referee_match_exclusion" },
        })
      );
    }
  }

  // Self-refereeing / participant COI
  const participantRefs = normalizeIdList(match.participantRefs);
  const playerId = candidate?.playerId ? String(candidate.playerId).trim() : "";
  if (
    policy.prohibitSamePlayerId &&
    playerId &&
    participantRefs.includes(playerId)
  ) {
    conflicts.push(
      makeConflict({
        conflictType: REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST,
        refereeId,
        matchId,
        roleCode,
        reasonCodes: [
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST,
        ],
        details: { kind: "referee_is_participant", playerId },
      })
    );
  }

  // Policy-forbidden self-refereeing (player link or explicit flag)
  if (
    !allowSelfRefereed &&
    policy.prohibitSelfReferee &&
    playerId &&
    participantRefs.includes(playerId)
  ) {
    // already added above when prohibitSamePlayerId; if that was false, still add
    if (!policy.prohibitSamePlayerId) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST,
          ],
          details: { kind: "self_referee_forbidden", playerId },
        })
      );
    }
  }

  // Prohibited team (explicit list — always hard)
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
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST,
          ],
          details: { kind: "prohibited_team", teamId },
          relatedIds: [teamId],
        })
      );
    }
  }

  // General team affiliation with match sides — hard only when flag true
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
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST,
          ],
          details: { kind: "affiliated_team", teamId },
          relatedIds: [teamId],
        })
      );
    } else if (policy.softAffiliationAwareness) {
      softNotes.push({
        code: "AFFILIATED_TEAM",
        details: { teamId },
      });
    }
  }

  // Club: explicit prohibited always hard; general affiliation gated
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
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST,
          ],
          details: { kind: "prohibited_club", clubId },
          relatedIds: [clubId],
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
              REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST,
            ],
            details: { kind: "affiliated_club", clubId },
            relatedIds: [clubId],
          })
        );
      } else if (policy.softAffiliationAwareness) {
        softNotes.push({
          code: "AFFILIATED_CLUB",
          details: { clubId },
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
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST,
          ],
          details: { kind: "prohibited_organization", orgId },
          relatedIds: [orgId],
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
              REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST,
            ],
            details: { kind: "affiliated_organization", orgId },
            relatedIds: [orgId],
          })
        );
      } else if (policy.softAffiliationAwareness) {
        softNotes.push({
          code: "AFFILIATED_ORGANIZATION",
          details: { orgId },
        });
      }
    }
  }

  // Duplicate concrete role on same match.
  // Same referee + match + role is always forbidden.
  // Other referees conflict only when active same-role count already at roleMaxCount
  // (default 1 — preserves single-PRIMARY semantics unless requirement raises maxCount).
  const roleMaxCount =
    typeof input.roleMaxCount === "number" &&
    Number.isInteger(input.roleMaxCount) &&
    input.roleMaxCount >= 0
      ? input.roleMaxCount
      : 1;
  if (roleCode) {
    const sameRoleActives = existingAssignments.filter(
      (asg) =>
        asg &&
        typeof asg === "object" &&
        String(asg.matchId) === matchId &&
        isActiveAssignmentStatus(asg.status) &&
        String(asg.roleCode) === roleCode
    );
    if (
      sameRoleActives.some((asg) => String(asg.refereeId) === refereeId)
    ) {
      conflicts.push(
        makeConflict({
          conflictType: REFEREE_CONFLICT_TYPE.CAPACITY,
          refereeId,
          matchId,
          roleCode,
          reasonCodes: [
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED,
          ],
          details: { kind: "duplicate_role_same_referee" },
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
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.ASSIGNMENT_CAPACITY_EXHAUSTED,
          ],
          details: {
            kind: "duplicate_role_other_referee",
            otherRefereeId: String(others[0].refereeId),
            roleMaxCount,
            sameRoleActiveCount: others.length,
          },
          relatedIds: others.map((a) => String(a.refereeId)).sort(compareStableString),
        })
      );
    }
  }

  // Schedule overlap with other active assignments
  const targetWindow = tryHalfOpenWindow(match.startAt, match.endAt, "match");
  if (targetWindow) {
    for (const asg of existingAssignments) {
      if (!asg || typeof asg !== "object") continue;
      if (String(asg.refereeId) !== refereeId) continue;
      if (!isActiveAssignmentStatus(asg.status || REFEREE_ASSIGNMENT_STATUS.PLANNED))
        continue;
      const otherMatchId = String(asg.matchId || "");
      if (!otherMatchId || otherMatchId === matchId) continue;
      const other =
        scheduleByMatchId.get(otherMatchId) ||
        (asg.startAt && asg.endAt
          ? { startAt: asg.startAt, endAt: asg.endAt, matchId: otherMatchId }
          : null);
      if (!other) continue;
      const otherWindow = tryHalfOpenWindow(
        other.startAt,
        other.endAt,
        "otherMatch"
      );
      if (!otherWindow) continue;
      if (
        intervalsOverlapHalfOpen(
          targetWindow.startMs,
          targetWindow.endMs,
          otherWindow.startMs,
          otherWindow.endMs
        )
      ) {
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
              REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED,
            ],
            details: { kind: "schedule_overlap", otherMatchId },
            relatedMatchIds: [otherMatchId],
          })
        );
      }
    }
  }

  const sorted = dedupeAndSortConflicts(conflicts);
  const projections = sorted
    .filter(
      (c) =>
        c.conflictType === REFEREE_CONFLICT_TYPE.OVERLAP ||
        c.conflictType === REFEREE_CONFLICT_TYPE.CONFLICT_OF_INTEREST ||
        c.conflictType === REFEREE_CONFLICT_TYPE.EXCLUSION
    )
    .map((c) =>
      createRefereeResourceConflictProjection({
        conflictId: `proj::${c.conflictId}`,
        refereeId: c.refereeId,
        matchId: c.matchId,
        conflictingMatchId: c.relatedMatchIds?.[0] || null,
        conflictType: c.conflictType,
        startAt: c.startAt,
        endAt: c.endAt,
        severity: c.severity,
        reasonCodes: [...c.reasonCodes],
      })
    );

  return ownedFreeze({
    schemaVersion: CORE13_SCHEMA_VERSION,
    conflicts: Object.freeze(sorted),
    projections: Object.freeze(projections),
    softNotes: Object.freeze(
      softNotes.map((n) =>
        ownedFreeze({
          code: String(n.code),
          details: ownedFreeze(n.details || {}),
        })
      )
    ),
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
  endAt = null,
}) {
  const conflictId = buildConflictId([
    conflictType,
    matchId,
    refereeId,
    conflictingMatchId || relatedMatchIds[0] || "",
    roleCode || "",
    details.kind || "",
  ]);
  return createRefereeConflict({
    conflictId,
    conflictType,
    refereeId,
    matchId,
    relatedMatchIds: relatedMatchIds.length
      ? relatedMatchIds
      : conflictingMatchId
        ? [conflictingMatchId]
        : [],
    relatedIds,
    severity: REFEREE_DIAGNOSTIC_SEVERITY.MATCH_RECOVERABLE,
    reasonCodes,
    startAt,
    endAt,
    metadata: details,
  });
}

function dedupeAndSortConflicts(conflicts) {
  const byId = new Map();
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
    // roleCode is not on conflict contract as first-class — use conflictId tail
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
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const id = String(row.matchId || "").trim();
    if (id) map.set(id, row);
  }
  return map;
}
