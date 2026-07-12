import {
  LINEUP_SOURCE,
  LINEUP_STATUS,
  MATCHUP_STATUS,
  MISSING_LINEUP_POLICY,
} from "../constants.js";
import { getLineup } from "../models/index.js";

/** TT-2D normalized policy keys (server mirrors these). */
export const NORMALIZED_MISSING_LINEUP_POLICY = Object.freeze({
  RANDOM: "random",
  FORFEIT_PENDING: "forfeit_pending",
  MANUAL_PENDING: "manual_pending",
});

const SUBMITTED_STATUSES = new Set([
  LINEUP_STATUS.SUBMITTED,
  LINEUP_STATUS.LOCKED,
  LINEUP_STATUS.PUBLISHED,
]);

const LOCKED_MATCHUP_STATUSES = new Set([
  MATCHUP_STATUS.LOCKED,
  MATCHUP_STATUS.PUBLISHED,
  MATCHUP_STATUS.IN_PROGRESS,
  MATCHUP_STATUS.COMPLETED,
]);

const POLICY_MARKER_PREFIX = "tt2d:";

export function normalizeMissingLineupPolicy(rawPolicy) {
  const value = String(rawPolicy || "").trim().toLowerCase();
  if (value === NORMALIZED_MISSING_LINEUP_POLICY.RANDOM || value === MISSING_LINEUP_POLICY.RANDOM) {
    return NORMALIZED_MISSING_LINEUP_POLICY.RANDOM;
  }
  if (
    value === NORMALIZED_MISSING_LINEUP_POLICY.FORFEIT_PENDING ||
    value === MISSING_LINEUP_POLICY.FORFEIT ||
    value === "forfeit"
  ) {
    return NORMALIZED_MISSING_LINEUP_POLICY.FORFEIT_PENDING;
  }
  if (
    value === NORMALIZED_MISSING_LINEUP_POLICY.MANUAL_PENDING ||
    value === MISSING_LINEUP_POLICY.BTC_OVERRIDE ||
    value === "btc_override" ||
    value === "manual"
  ) {
    return NORMALIZED_MISSING_LINEUP_POLICY.MANUAL_PENDING;
  }
  return NORMALIZED_MISSING_LINEUP_POLICY.RANDOM;
}

export function isLineupSubmitted(lineup) {
  const status = lineup?.status || LINEUP_STATUS.NOT_SUBMITTED;
  return SUBMITTED_STATUSES.has(status);
}

export function hasPolicyMarker(auditNote, marker) {
  return String(auditNote || "").includes(`${POLICY_MARKER_PREFIX}${marker}`);
}

export function isMissingLineupPolicyHandled(lineup, policy) {
  if (!lineup) {
    return false;
  }
  if (isLineupSubmitted(lineup)) {
    return true;
  }
  const normalized = normalizeMissingLineupPolicy(policy);
  if (normalized === NORMALIZED_MISSING_LINEUP_POLICY.RANDOM) {
    return (
      lineup.source === LINEUP_SOURCE.RANDOM &&
      SUBMITTED_STATUSES.has(lineup.status) &&
      Object.keys(lineup.selections || {}).length > 0
    );
  }
  if (normalized === NORMALIZED_MISSING_LINEUP_POLICY.FORFEIT_PENDING) {
    return hasPolicyMarker(lineup.auditNote, "forfeit_pending");
  }
  if (normalized === NORMALIZED_MISSING_LINEUP_POLICY.MANUAL_PENDING) {
    return hasPolicyMarker(lineup.auditNote, "manual_resolved");
  }
  return false;
}

export function isDeadlinePassed(matchup, serverTimeMs = Date.now()) {
  const deadline = matchup?.lineupDeadline ?? matchup?.lineupLockAt ?? null;
  if (!deadline) {
    return false;
  }
  const deadlineMs = new Date(deadline).getTime();
  if (Number.isNaN(deadlineMs)) {
    return false;
  }
  return serverTimeMs >= deadlineMs;
}

export function resolveTeamLineupSnapshot(teamData, matchup, teamId) {
  const lineup = getLineup(teamData, matchup.id, teamId);
  return {
    teamId: String(teamId),
    status: lineup?.status || LINEUP_STATUS.NOT_SUBMITTED,
    source: lineup?.source || LINEUP_SOURCE.CAPTAIN,
    submitted: isLineupSubmitted(lineup),
    auditNote: lineup?.auditNote || null,
    version: lineup?.version ?? null,
  };
}

export function resolveMatchupMissingLineupState({
  teamData,
  matchup,
  policy,
  serverTimeMs = Date.now(),
}) {
  const normalizedPolicy = normalizeMissingLineupPolicy(policy);
  const deadlinePassed = isDeadlinePassed(matchup, serverTimeMs);
  const teamIds = [matchup.teamAId, matchup.teamBId].filter(Boolean);

  const teams = teamIds.map((teamId) => {
    const snapshot = resolveTeamLineupSnapshot(teamData, matchup, teamId);
    const missing = !snapshot.submitted;
    const handled = !missing || isMissingLineupPolicyHandled(getLineup(teamData, matchup.id, teamId), normalizedPolicy);
    return {
      ...snapshot,
      missing,
      policyHandled: handled,
    };
  });

  const missingTeamIds = teams.filter((team) => team.missing).map((team) => team.teamId);
  const unhandledMissingTeamIds = teams
    .filter((team) => team.missing && !team.policyHandled)
    .map((team) => team.teamId);

  const matchupLocked = LOCKED_MATCHUP_STATUSES.has(matchup.status);
  const canRandomizeTeamIds =
    normalizedPolicy === NORMALIZED_MISSING_LINEUP_POLICY.RANDOM &&
    deadlinePassed &&
    !matchupLocked
      ? missingTeamIds.filter((teamId) => {
          const lineup = getLineup(teamData, matchup.id, teamId);
          return lineup?.source !== LINEUP_SOURCE.RANDOM || !isLineupSubmitted(lineup);
        })
      : [];

  const canLock =
    !matchupLocked &&
    [MATCHUP_STATUS.LINEUP_OPEN, MATCHUP_STATUS.SCHEDULED].includes(matchup.status) &&
    (missingTeamIds.length === 0 ||
      (deadlinePassed &&
        (normalizedPolicy === NORMALIZED_MISSING_LINEUP_POLICY.RANDOM ||
          normalizedPolicy === NORMALIZED_MISSING_LINEUP_POLICY.FORFEIT_PENDING ||
          unhandledMissingTeamIds.length === 0)));

  const allowedActions = [];
  if (canRandomizeTeamIds.length > 0) {
    allowedActions.push("randomize");
  }
  if (canLock) {
    allowedActions.push("lock");
  }

  return {
    policy: normalizedPolicy,
    deadlinePassed,
    teams,
    missingTeamIds,
    unhandledMissingTeamIds,
    canLock,
    canRandomizeTeamIds,
    allowedActions,
  };
}

export function mergeServerMatchupOps(matchup, serverOps = {}) {
  if (!serverOps || typeof serverOps !== "object") {
    return matchup;
  }
  return {
    ...matchup,
    missingLineupPolicy: serverOps.policy ?? matchup.missingLineupPolicy,
    deadlinePassed: serverOps.deadlinePassed ?? matchup.deadlinePassed,
    missingTeamIds: serverOps.missingTeamIds ?? matchup.missingTeamIds,
    canLock: serverOps.canLock ?? matchup.canLock,
    canRandomizeTeamIds: serverOps.canRandomizeTeamIds ?? matchup.canRandomizeTeamIds,
    lineupOps: serverOps,
  };
}
