/**
 * evaluateRefereeEligibility — pure hard/soft evaluation for one candidate × match × role.
 * Collects all deterministically discoverable hard failures (except when essential
 * scope/schedule input is structurally unavailable — still records scope failures).
 */

import { REFEREE_ROLE_CODE } from "../enums/roleCodes.js";
import { REFEREE_CONSTRAINT_KIND } from "../enums/constraintKind.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { REFEREE_SOFT_NOTE_CODE } from "../enums/softNotes.js";
import {
  createHardFailure,
  createRefereeEligibilityResult,
  createSoftNote,
} from "../contracts/refereeEligibilityResult.js";
import { createRefereeCandidate } from "../contracts/refereeCandidate.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import {
  tryHalfOpenWindow,
  windowFullyCovers,
  parseInstantMs,
  intervalsOverlapHalfOpen,
} from "./timeModel.js";
import { detectRefereeConflicts } from "./detectRefereeConflicts.js";
import {
  isActiveAssignmentStatus,
  normalizeConflictPolicy,
} from "./conflictPolicyNormalize.js";

/**
 * @param {object} input
 */
export function evaluateRefereeEligibility(input = {}) {
  /** @type {object[]} */
  const hardFailures = [];
  /** @type {object[]} */
  const softNotes = [];
  /** @type {string[]} */
  const evaluated = [];
  /** @type {string[]} */
  const evidenceRefs = [];

  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const match =
    input.match && typeof input.match === "object" ? input.match : {};
  const matchId = String(match.matchId || input.matchId || "").trim();
  const roleCode = String(input.roleCode || "").trim();
  const policy =
    input.policy && typeof input.policy === "object" ? input.policy : {};
  const maxSimultaneous =
    typeof policy.maxSimultaneousAssignments === "number"
      ? policy.maxSimultaneousAssignments
      : 1;

  evaluated.push("SCOPE");
  if (!tenantId) {
    hardFailures.push(
      createHardFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TENANT_SCOPE_REQUIRED,
        message: "tenantId is required",
      })
    );
  }
  if (!tournamentId) {
    hardFailures.push(
      createHardFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TOURNAMENT_SCOPE_REQUIRED,
        message: "tournamentId is required",
      })
    );
  }
  if (!matchId) {
    hardFailures.push(
      createHardFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED,
        message: "matchId is required",
      })
    );
  }

  // Role — ANY never concrete
  evaluated.push("ROLE");
  if (!roleCode || roleCode === REFEREE_ROLE_CODE.ANY) {
    hardFailures.push(
      createHardFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
        message: "Concrete roleCode required; ANY is not assignable",
        details: { roleCode: roleCode || null },
      })
    );
  }

  // Candidate
  evaluated.push("CANDIDATE");
  let candidate = null;
  if (input.candidate == null) {
    hardFailures.push(
      createHardFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND,
        message: "Candidate missing",
      })
    );
  } else {
    try {
      candidate = isPlainObject(input.candidate)
        ? input.candidate.refereeId && input.candidate.schemaVersion
          ? input.candidate
          : createRefereeCandidate(input.candidate)
        : null;
    } catch {
      candidate = null;
      hardFailures.push(
        createHardFailure({
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND,
          message: "Candidate invalid",
        })
      );
    }
  }

  const refereeId = candidate
    ? String(candidate.refereeId)
    : String(input.refereeId || "").trim();

  if (candidate) {
    evidenceRefs.push(`candidate:${candidate.refereeId}`);
    evaluated.push("ACTIVE");
    if (candidate.active === false) {
      hardFailures.push(
        createHardFailure({
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_INACTIVE,
          message: "Referee is inactive",
          details: { refereeId },
        })
      );
    }
  }

  // Schedule window for match
  evaluated.push("SCHEDULE_WINDOW");
  const matchWindow = tryHalfOpenWindow(match.startAt, match.endAt, "match");
  const requireWindow = policy.requireScheduleWindowForMandatoryRoles !== false;
  if (!matchWindow) {
    if (requireWindow) {
      hardFailures.push(
        createHardFailure({
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED,
          message: "Match startAt/endAt required",
          details: { matchId },
        })
      );
    }
  }

  // Qualifications
  evaluated.push("QUALIFICATION");
  const qualifications = Array.isArray(input.qualifications)
    ? input.qualifications
    : [];
  if (roleCode && roleCode !== REFEREE_ROLE_CODE.ANY) {
    const matching = qualifications.filter(
      (q) =>
        q &&
        String(q.refereeId) === refereeId &&
        (String(q.roleCode) === roleCode ||
          String(q.roleCode) === REFEREE_ROLE_CODE.ANY)
    );
    if (matching.length === 0) {
      hardFailures.push(
        createHardFailure({
          code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_QUALIFIED,
          message: "No qualification for required role",
          details: { refereeId, roleCode },
        })
      );
    } else {
      let anyValid = false;
      for (const q of matching) {
        evidenceRefs.push(`qualification:${q.qualificationId || q.roleCode}`);
        if (matchWindow) {
          const fromOk =
            !q.validFrom ||
            parseInstantMs(q.validFrom, "validFrom") <= matchWindow.startMs;
          const toOk =
            !q.validTo ||
            parseInstantMs(q.validTo, "validTo") > matchWindow.startMs;
          // validTo exclusive against match start — qualification must still be valid at match start
          if (fromOk && toOk) {
            // Also require valid through match end if validTo present
            const coversEnd =
              !q.validTo ||
              parseInstantMs(q.validTo, "validTo") >= matchWindow.endMs;
            if (coversEnd) anyValid = true;
          }
        } else {
          anyValid = true;
        }
        if (
          input.requireCertification === true &&
          !q.certificationCode
        ) {
          hardFailures.push(
            createHardFailure({
              code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_QUALIFIED,
              message: "Certification evidence required",
              details: { qualificationId: q.qualificationId || null },
            })
          );
        }
      }
      if (matchWindow && matching.length > 0 && !anyValid) {
        hardFailures.push(
          createHardFailure({
            code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_QUALIFIED,
            message: "Qualification expired or not valid for match time",
            details: { refereeId, roleCode },
          })
        );
      }
    }
  }

  // Availability covers full match window
  evaluated.push("AVAILABILITY");
  const windows = Array.isArray(input.availabilityWindows)
    ? input.availabilityWindows
    : [];
  if (matchWindow && refereeId) {
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
          details: { refereeId, matchId },
        })
      );
    }
  }

  // Overlap + capacity via existing assignments
  evaluated.push("OVERLAP");
  evaluated.push("CAPACITY");
  const existingAssignments = Array.isArray(input.existingAssignments)
    ? input.existingAssignments
    : [];
  if (refereeId && matchWindow) {
    let simultaneous = 0;
    for (const asg of existingAssignments) {
      if (!asg || String(asg.refereeId) !== refereeId) continue;
      if (!isActiveAssignmentStatus(asg.status)) continue;
      simultaneous += 1;
    }
    // Capacity: count overlapping actives excluding same match replace case
    // maxSimultaneous applies to concurrent overlapping windows
    let overlappingCount = 0;
    for (const asg of existingAssignments) {
      if (!asg || String(asg.refereeId) !== refereeId) continue;
      if (!isActiveAssignmentStatus(asg.status)) continue;
      if (String(asg.matchId) === matchId) continue;
      // schedule lookup
      const rows = Array.isArray(input.scheduleRows) ? input.scheduleRows : [];
      const other =
        rows.find((r) => String(r.matchId) === String(asg.matchId)) || asg;
      const otherWindow = tryHalfOpenWindow(
        other.startAt,
        other.endAt,
        "other"
      );
      if (!otherWindow) continue;
      if (
        intervalsOverlapHalfOpen(
          matchWindow.startMs,
          matchWindow.endMs,
          otherWindow.startMs,
          otherWindow.endMs
        )
      ) {
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
            maxSimultaneousAssignments: maxSimultaneous,
          },
        })
      );
    }
  }

  // Conflicts (COI, exclusion, duplicate role, overlap facts)
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
      roleMaxCount:
        typeof input.roleMaxCount === "number" ? input.roleMaxCount : 1,
    });
    for (const conflict of detected.conflicts) {
      const code =
        conflict.reasonCodes?.[0] ||
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_CONFLICT_OF_INTEREST;
      hardFailures.push(
        createHardFailure({
          code,
          message: `Conflict: ${conflict.conflictType}`,
          details: {
            conflictId: conflict.conflictId,
            conflictType: conflict.conflictType,
            metadata: conflict.metadata,
          },
        })
      );
      evidenceRefs.push(`conflict:${conflict.conflictId}`);
    }
    for (const note of detected.softNotes || []) {
      softNotes.push(
        createSoftNote({
          code: note.code,
          message: note.code,
          details: note.details || {},
        })
      );
    }
  }

  // Soft preference notes (never hard)
  evaluated.push("SOFT");
  if (
    Array.isArray(input.preferredTags) &&
    candidate &&
    Array.isArray(candidate.preferenceTags)
  ) {
    for (const tag of input.preferredTags) {
      if (!candidate.preferenceTags.includes(tag)) {
        softNotes.push(
          createSoftNote({
            code: REFEREE_SOFT_NOTE_CODE.PREFERRED_TAG_MISSING,
            message: `Missing preferred tag ${tag}`,
            details: { tag },
          })
        );
      }
    }
  }
  if (
    input.preferredRoleCode &&
    roleCode &&
    input.preferredRoleCode !== roleCode
  ) {
    softNotes.push(
      createSoftNote({
        code: REFEREE_SOFT_NOTE_CODE.PREFERRED_ROLE_MISMATCH,
        message: "Assigned role differs from preferred role",
        details: {
          preferredRoleCode: input.preferredRoleCode,
          roleCode,
        },
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
    evidenceRefs,
  });
}
