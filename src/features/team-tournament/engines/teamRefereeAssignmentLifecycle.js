/**
 * Client planner helper for TT-5D referee assign / change preflight.
 * NOT assignment authority — CORE-13 owns decisions; Team RPC is thin transport.
 */

import { isUnresolvedBracketPlaceholder } from "./teamKnockoutEngine.js";
import { TEAM_TOURNAMENT_DOMAIN_CODES } from "./teamTournamentDomainErrors.js";

export const REFEREE_ASSIGN_ACTION = Object.freeze({
  IDEMPOTENT_NOOP: "IDEMPOTENT_NOOP",
  CREATE: "CREATE",
  SUPERSEDE: "SUPERSEDE",
  REACTIVATE: "REACTIVATE",
});

function effectiveStatus(row) {
  return String(row?.effectiveStatus || row?.status || "").toLowerCase();
}

function isLiveStatus(status) {
  return status === "pending" || status === "active";
}

function sameCanonicalKey(row, { tenantId, tournamentId, matchId, role }) {
  if (tenantId && row.tenantId && String(row.tenantId) !== String(tenantId)) return false;
  if (tournamentId && row.tournamentId && String(row.tournamentId) !== String(tournamentId)) {
    return false;
  }
  if (
    matchId &&
    String(
      row.matchId ||
        row.assignmentMatchId ||
        row.externalSubMatchId ||
        row.matchupId ||
        ""
    ) !== String(matchId)
  ) {
    return false;
  }
  return String(row.role || "REFEREE") === String(role || "REFEREE");
}

export function planRefereeAssignment({
  matchup,
  existingAssignments = [],
  refereeUserId,
  tenantId,
  tournamentTenantId,
  tournamentId,
  matchId,
  role = "REFEREE",
} = {}) {
  if (tenantId && tournamentTenantId && String(tenantId) !== String(tournamentTenantId)) {
    return {
      ok: false,
      code: TEAM_TOURNAMENT_DOMAIN_CODES.CROSS_TENANT_DENIED,
      action: null,
    };
  }
  if (isUnresolvedBracketPlaceholder(matchup)) {
    return {
      ok: false,
      code: TEAM_TOURNAMENT_DOMAIN_CODES.MATCHUP_TEAMS_UNRESOLVED,
      action: null,
    };
  }
  const uid = String(refereeUserId || "").trim();
  if (!uid) {
    return { ok: false, code: "REFEREE_NOT_FOUND", action: null };
  }

  const scoped = (existingAssignments || []).filter((row) =>
    sameCanonicalKey(row, {
      tenantId,
      tournamentId,
      matchId: matchId || row.matchId,
      role,
    })
  );
  const live = scoped.filter((row) => isLiveStatus(effectiveStatus(row)));
  const sameLive = live.find((row) => String(row.refereeUserId) === uid);
  if (sameLive) {
    return {
      ok: true,
      action: REFEREE_ASSIGN_ACTION.IDEMPOTENT_NOOP,
      assignment: sameLive,
    };
  }
  const sameHistorical = scoped.find(
    (row) => String(row.refereeUserId) === uid && !isLiveStatus(effectiveStatus(row))
  );
  if (live.length > 0) {
    return {
      ok: true,
      action: REFEREE_ASSIGN_ACTION.SUPERSEDE,
      revoke: live,
      reactivate: sameHistorical || null,
    };
  }
  if (sameHistorical) {
    return {
      ok: true,
      action: REFEREE_ASSIGN_ACTION.REACTIVATE,
      reactivate: sameHistorical,
    };
  }
  return { ok: true, action: REFEREE_ASSIGN_ACTION.CREATE };
}

/**
 * In-memory model of the SQL transaction (tests + UI preflight).
 * Failed bind leaves the input rows unchanged.
 */
export function applyRefereeAssignmentTransaction(rows = [], command = {}) {
  const snapshot = (rows || []).map((row) => ({ ...row }));
  const {
    tenantId,
    tournamentId,
    matchId,
    role = "REFEREE",
    refereeUserId,
    failBind = false,
  } = command;
  const plan = planRefereeAssignment({
    matchup: command.matchup || { teamAId: "a", teamBId: "b" },
    existingAssignments: snapshot,
    refereeUserId,
    tenantId,
    tournamentTenantId: command.tournamentTenantId || tenantId,
    tournamentId,
    matchId,
    role,
  });
  if (!plan.ok) {
    return { ok: false, code: plan.code, rows: snapshot, liveCount: countLive(snapshot, command) };
  }
  if (plan.action === REFEREE_ASSIGN_ACTION.IDEMPOTENT_NOOP) {
    return { ok: true, replayed: true, rows: snapshot, liveCount: countLive(snapshot, command) };
  }
  if (failBind) {
    return {
      ok: false,
      code: TEAM_TOURNAMENT_DOMAIN_CODES.REFEREE_ASSIGNMENT_CONFLICT,
      rows: snapshot,
      liveCount: countLive(snapshot, command),
    };
  }

  let next = snapshot.map((row) => {
    if (!sameCanonicalKey(row, { tenantId, tournamentId, matchId, role })) return row;
    if (isLiveStatus(effectiveStatus(row)) && String(row.refereeUserId) !== String(refereeUserId)) {
      return { ...row, status: "revoked", effectiveStatus: "revoked" };
    }
    if (String(row.refereeUserId) === String(refereeUserId)) {
      return { ...row, status: "active", effectiveStatus: "active", revokedAt: null };
    }
    return row;
  });
  const hasSame = next.some(
    (row) =>
      sameCanonicalKey(row, { tenantId, tournamentId, matchId, role }) &&
      String(row.refereeUserId) === String(refereeUserId)
  );
  if (!hasSame) {
    next = [
      ...next,
      {
        tenantId,
        tournamentId,
        matchId,
        role,
        refereeUserId,
        status: "active",
        effectiveStatus: "active",
      },
    ];
  }
  return { ok: true, rows: next, liveCount: countLive(next, command) };
}

function countLive(rows, command) {
  return (rows || []).filter(
    (row) =>
      sameCanonicalKey(row, command) && isLiveStatus(effectiveStatus(row))
  ).length;
}
