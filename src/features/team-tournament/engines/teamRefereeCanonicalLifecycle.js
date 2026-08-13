/**
 * Canonical parent-matchup referee assignment + effective inheritance.
 * Server SQL is write authority after package GO. This module is the
 * client resolver / planner used by UI, dashboard, and unit tests.
 *
 * Do not infer from array order. Child override wins; else parent; else none.
 */

export const REFEREE_ASSIGNMENT_SCOPE = Object.freeze({
  PARENT: "parent",
  CHILD: "child",
});

export const PARENT_ASSIGNMENT_SELECT_VALUE = "";

function liveStatus(row) {
  const status = String(row?.effectiveStatus || row?.status || "").toLowerCase();
  return status === "pending" || status === "active";
}

export function isParentRefereeAssignment(row = {}) {
  if (!row || typeof row !== "object") return false;
  if (String(row.scope || "").toLowerCase() === REFEREE_ASSIGNMENT_SCOPE.PARENT) {
    return true;
  }
  const subId = String(row.externalSubMatchId || row.subMatchId || "").trim();
  return !subId;
}

export function resolveEffectiveRefereeAssignment({
  assignments = [],
  matchupId,
  subMatchId = null,
} = {}) {
  const matchupKey = String(matchupId || "").trim();
  const subKey = String(subMatchId || "").trim();
  const rows = (assignments || []).filter(liveStatus);
  if (!matchupKey) return null;

  if (subKey) {
    const child = rows.find((row) => {
      if (isParentRefereeAssignment(row)) return false;
      const rowSub = String(row.externalSubMatchId || row.subMatchId || row.matchId || "");
      const rowMatchup = String(row.matchupId || row.externalMatchupId || "");
      return rowSub === subKey && (!rowMatchup || rowMatchup === matchupKey);
    });
    if (child) {
      return { ...child, scope: REFEREE_ASSIGNMENT_SCOPE.CHILD, inherited: false };
    }
  }

  const parent = rows.find((row) => {
    if (!isParentRefereeAssignment(row)) return false;
    const rowMatchup = String(
      row.matchupId || row.externalMatchupId || row.assignmentMatchId || row.matchId || ""
    );
    return rowMatchup === matchupKey;
  });
  if (parent) {
    return { ...parent, scope: REFEREE_ASSIGNMENT_SCOPE.PARENT, inherited: Boolean(subKey) };
  }
  return null;
}

export function canAssignedRefereeWriteMatchup({
  assignments = [],
  matchupId,
  subMatchId = null,
  refereeUserId,
  isOrganizer = false,
} = {}) {
  if (isOrganizer) return true;
  const uid = String(refereeUserId || "").trim();
  if (!uid) return false;
  const effective = resolveEffectiveRefereeAssignment({ assignments, matchupId, subMatchId });
  if (!effective) return false;
  return String(effective.refereeUserId || "") === uid;
}

export function buildRefereeDiscoveryHref({
  tournamentId,
  assignment,
} = {}) {
  const id = String(tournamentId || "").trim();
  const matchupId = String(assignment?.matchupId || assignment?.externalMatchupId || "").trim();
  const v5MatchId = isParentRefereeAssignment(assignment)
    ? ""
    : String(assignment?.matchId || assignment?.v5MatchId || "").trim();
  if (v5MatchId) {
    return `/referee/match/${encodeURIComponent(v5MatchId)}?tournamentId=${encodeURIComponent(id)}`;
  }
  return `/team-referee/${encodeURIComponent(id)}?matchup=${encodeURIComponent(matchupId)}`;
}

export function describeDreambreakerStartFailure(raw = {}) {
  const code = String(raw.code || "").trim();
  if (code === "ALREADY_STARTED" || raw.alreadyStarted || raw.replayed) {
    return { ok: true, code: "ALREADY_STARTED", replayed: true };
  }
  return {
    ok: false,
    code: code || "RPC_FAILED",
    error: raw.error || raw.message || "",
  };
}
