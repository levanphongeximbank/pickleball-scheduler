/**
 * Lexicographic soft score vectors — lower is better after normalization.
 */

import { REFEREE_SOFT_OBJECTIVE_KEY } from "../enums/softNotes.js";
import { REFEREE_SOFT_NOTE_CODE } from "../enums/softNotes.js";
import { compareStableString } from "../deterministic/compare.js";
import { calculateRefereeWorkload } from "../services/calculateRefereeWorkload.js";
import { ownedFreeze } from "../contracts/shared.js";

/**
 * @param {object} args
 * @returns {Readonly<{ scoreVector: readonly number[], softNotes: readonly object[] }>}
 */
export function buildSoftScoreVector({
  policy,
  candidate,
  match,
  roleCode,
  existingAssignments,
  scheduleRows,
  populationRefereeIds,
  preferredRoleCode,
  conflictSoftNotes = [],
}) {
  const objectives = policy.softObjectiveKeys || [];
  /** @type {number[]} */
  const vector = [];
  /** @type {object[]} */
  const softNotes = [...conflictSoftNotes];

  const workloadResult = calculateRefereeWorkload({
    assignments: existingAssignments,
    scheduleRows,
    populationRefereeIds,
    consecutiveGapMinutesThreshold: policy.consecutiveGapMinutesThreshold,
    refereeId: candidate.refereeId,
  });
  const wl = workloadResult.workloads[0] || {
    fairnessDelta: 0,
    consecutiveMatchCount: 0,
    courtTransitionCount: 0,
    assignmentCount: 0,
  };

  // Hypothetical: add this match for consecutive/court projection
  const projected = calculateRefereeWorkload({
    assignments: [
      ...existingAssignments,
      {
        assignmentId: "proj",
        matchId: match.matchId,
        refereeId: candidate.refereeId,
        roleCode,
        status: "PLANNED",
      },
    ],
    scheduleRows,
    populationRefereeIds,
    consecutiveGapMinutesThreshold: policy.consecutiveGapMinutesThreshold,
    refereeId: candidate.refereeId,
  });
  const projWl = projected.workloads[0] || wl;

  for (const key of objectives) {
    switch (key) {
      case REFEREE_SOFT_OBJECTIVE_KEY.WORKLOAD_BALANCE:
        vector.push(wl.fairnessDelta);
        if (wl.fairnessDelta > 0) {
          softNotes.push({
            code: REFEREE_SOFT_NOTE_CODE.WORKLOAD_ABOVE_PEER,
            details: { fairnessDelta: wl.fairnessDelta },
          });
        }
        break;
      case REFEREE_SOFT_OBJECTIVE_KEY.CONSECUTIVE_MATCH_MINIMIZATION:
        vector.push(projWl.consecutiveMatchCount);
        break;
      case REFEREE_SOFT_OBJECTIVE_KEY.COURT_TRANSITION_MINIMIZATION:
        vector.push(projWl.courtTransitionCount);
        break;
      case REFEREE_SOFT_OBJECTIVE_KEY.ROLE_PREFERENCE: {
        const preferred =
          preferredRoleCode ||
          (policy.preferredConcreteRoles && policy.preferredConcreteRoles[0]);
        const score =
          preferred && preferred === roleCode
            ? 0
            : preferred
              ? 1
              : 0;
        vector.push(score);
        break;
      }
      case REFEREE_SOFT_OBJECTIVE_KEY.EXPERIENCE_PREFERENCE: {
        const exp =
          typeof candidate.metadata?.experienceLevel === "number" &&
          Number.isFinite(candidate.metadata.experienceLevel)
            ? Math.max(0, Math.floor(candidate.metadata.experienceLevel))
            : 0;
        // Prefer higher experience → lower score = max(0, preferred - exp)
        const preferredExp =
          typeof policy.metadata?.preferredExperienceLevel === "number"
            ? Math.floor(policy.metadata.preferredExperienceLevel)
            : 0;
        const gap = Math.max(0, preferredExp - exp);
        vector.push(gap);
        if (gap > 0) {
          softNotes.push({
            code: REFEREE_SOFT_NOTE_CODE.EXPERIENCE_BELOW_PREFERRED,
            details: { experienceLevel: exp, preferredExp },
          });
        }
        break;
      }
      case REFEREE_SOFT_OBJECTIVE_KEY.DIVISION_FAMILIARITY: {
        const divisionId = match.divisionId ? String(match.divisionId) : "";
        const familiar = Array.isArray(candidate.metadata?.familiarDivisionIds)
          ? candidate.metadata.familiarDivisionIds.map(String)
          : [];
        const score =
          !divisionId || familiar.includes(divisionId) ? 0 : 1;
        vector.push(score);
        if (score === 1) {
          softNotes.push({
            code: REFEREE_SOFT_NOTE_CODE.DIVISION_UNFAMILIAR,
            details: { divisionId },
          });
        }
        break;
      }
      case REFEREE_SOFT_OBJECTIVE_KEY.AFFILIATION_NEUTRALITY: {
        const affCount = conflictSoftNotes.filter((n) =>
          String(n.code).startsWith("AFFILIATED_")
        ).length;
        vector.push(affCount);
        break;
      }
      case REFEREE_SOFT_OBJECTIVE_KEY.ASSIGNMENT_CONTINUITY: {
        const priorCourt = findLastCourt(
          existingAssignments,
          scheduleRows,
          candidate.refereeId
        );
        const score =
          priorCourt && match.courtId && priorCourt === String(match.courtId)
            ? 0
            : priorCourt
              ? 1
              : 0;
        vector.push(score);
        if (score === 1) {
          softNotes.push({
            code: REFEREE_SOFT_NOTE_CODE.CONTINUITY_BREAK,
            details: { priorCourt, courtId: match.courtId || null },
          });
        }
        break;
      }
      default:
        vector.push(0);
    }
  }

  return ownedFreeze({
    scoreVector: Object.freeze(vector),
    softNotes: Object.freeze(softNotes),
  });
}

/**
 * Compare score vectors lexicographically (lower better). Tie → 0.
 * @param {readonly number[]} a
 * @param {readonly number[]} b
 */
export function compareScoreVectors(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

/**
 * @param {object} left
 * @param {object} right
 */
export function compareCandidates(left, right) {
  const c = compareScoreVectors(left.scoreVector, right.scoreVector);
  if (c !== 0) return c;
  if (left.seedKey != null && right.seedKey != null) {
    if (left.seedKey < right.seedKey) return -1;
    if (left.seedKey > right.seedKey) return 1;
  }
  return compareStableString(left.refereeId, right.refereeId);
}

function findLastCourt(assignments, scheduleRows, refereeId) {
  const byId = new Map(
    (scheduleRows || []).map((r) => [String(r.matchId), r])
  );
  const timed = [];
  for (const a of assignments || []) {
    if (String(a.refereeId) !== String(refereeId)) continue;
    if (a.status !== "PLANNED" && a.status !== "CONFIRMED") continue;
    const row = byId.get(String(a.matchId)) || a;
    if (!row.startAt) continue;
    timed.push({
      startAt: row.startAt,
      courtId: row.courtId ? String(row.courtId) : null,
    });
  }
  timed.sort((a, b) => compareStableString(a.startAt, b.startAt));
  const last = timed[timed.length - 1];
  return last?.courtId || null;
}
