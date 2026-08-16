import { loadAIData } from "../../../ai/storage.js";
import { fetchMatchLiveForTournament } from "../../../domain/matchLiveSync.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { ROLES, normalizeRole } from "../constants/roles.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { can } from "../../../auth/rbac.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import { getRefereeSettings } from "../../../models/tournament/refereeRoster.js";
import { listTournamentsQuery } from "../../tournament/services/tournamentQueries.js";
import { listInternalRefereeHubAssignments } from "../../tournament/internal/internalRefereeDiscovery.js";

function refereeMatchesUser(refereeEntry, user) {
  if (!refereeEntry || !user) {
    return false;
  }

  const canonicalUserId = String(
    refereeEntry.canonicalUserId || refereeEntry.refereeUserId || ""
  ).trim();
  if (canonicalUserId && String(user.id) === canonicalUserId) {
    return true;
  }

  const name = String(refereeEntry.name || "").trim().toLowerCase();
  const displayName = String(user.displayName || "").trim().toLowerCase();
  const emailPrefix = String(user.email || "").split("@")[0].toLowerCase();
  const email = String(user.email || "").trim().toLowerCase();
  const entryEmail = String(refereeEntry.email || "").trim().toLowerCase();

  if (email && entryEmail && email === entryEmail) {
    return true;
  }

  return (
    (name && (name === displayName || name.includes(displayName) || displayName.includes(name))) ||
    (name && emailPrefix && name.includes(emailPrefix)) ||
    (name && email && name === email)
  );
}

function collectTournaments(aiData) {
  const tournaments = aiData?.tournaments || {};
  return Object.entries(tournaments).map(([id, tournament]) => ({
    id,
    ...tournament,
  }));
}

function assignmentKey(match) {
  return `${match.tournamentId || ""}::${match.matchId || ""}`;
}

export async function listRefereeAssignments({ clubId, tenantId } = {}, deps = {}) {
  const user = (deps.getCurrentUser || getCurrentUser)();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  const rbacOn = { rbacEnabled: (deps.isRbacEnabled || isRbacEnabled)() };
  const isReferee =
    normalizeRole(user.role) === ROLES.REFEREE ||
    can(user, PERMISSIONS.MATCH_UPDATE, { clubId, venueId: user.venueId }, rbacOn);

  if ((deps.isRbacEnabled || isRbacEnabled)() && !isReferee) {
    return { ok: false, error: "Chỉ dành cho trọng tài.", code: "FORBIDDEN" };
  }

  if (!clubId) {
    return { ok: true, matches: [] };
  }

  const assignments = [];
  const resolvedTenant = String(
    tenantId || user.venueId || user.tenantId || ""
  ).trim();
  if (resolvedTenant) {
    const listed = await (deps.listTournaments || listTournamentsQuery)(
      { clubId, tenantId: resolvedTenant },
      {},
      { tenantId: resolvedTenant }
    );
    if (listed?.ok) {
      const internal = listInternalRefereeHubAssignments({
        tournaments: listed.tournaments || [],
        user,
        clubId,
        tenantId: resolvedTenant,
      });
      for (const match of internal.matches || []) {
        assignments.push(match);
      }
    }
  }

  const aiData = (deps.loadAIData || loadAIData)(clubId);
  const tournaments = collectTournaments(aiData);

  for (const tournament of tournaments) {
    const { roster } = getRefereeSettings(tournament);
    const myRosterIds = roster
      .filter((entry) => refereeMatchesUser(entry, user))
      .map((entry) => entry.id);

    if (myRosterIds.length === 0 && normalizeRole(user.role) !== ROLES.SUPER_ADMIN) {
      continue;
    }

    const liveResult = await (deps.fetchMatchLiveForTournament || fetchMatchLiveForTournament)(
      clubId,
      tournament.id
    );
    const liveRows = liveResult.ok ? liveResult.rows || [] : [];

    liveRows.forEach((row) => {
      const assignedToMe =
        myRosterIds.length === 0 ||
        myRosterIds.some((id) => String(row.refereeName || "").includes(id)) ||
        refereeMatchesUser({ name: row.refereeName }, user);

      if (!assignedToMe && normalizeRole(user.role) === ROLES.REFEREE) {
        return;
      }

      assignments.push({
        matchId: row.matchId,
        tournamentId: tournament.id,
        tournamentName: tournament.name || tournament.id,
        courtId: row.courtId,
        refereeToken: row.refereeToken,
        refereeName: row.refereeName,
        team1Name: row.team1Name,
        team2Name: row.team2Name,
        score1: row.score1,
        score2: row.score2,
        status: row.status,
        source: "match_live",
      });
    });
  }

  const deduped = [];
  const seen = new Set();
  for (const match of assignments) {
    const key = assignmentKey(match);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(match);
  }

  return { ok: true, matches: deduped };
}

export function canAccessRefereeSession(user, scope = {}) {
  if (!user) {
    return false;
  }

  return can(
    user,
    PERMISSIONS.MATCH_UPDATE,
    { clubId: scope.clubId, venueId: scope.venueId || user.venueId },
    { rbacEnabled: isRbacEnabled() }
  );
}
