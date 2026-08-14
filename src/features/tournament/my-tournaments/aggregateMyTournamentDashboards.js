/**
 * Shared Giải của tôi aggregator (IT-E2E-BROWSER-014).
 * Team list_my_dashboards stays the Team authority.
 * Internal assigned tournaments reuse listInternalRefereeHubAssignments.
 */
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { normalizeMyDashboardListResult } from "../../team-tournament/my-dashboards/myDashboardsModel.js";
import { listInternalRefereeHubAssignments } from "../internal/internalRefereeDiscovery.js";

export const MY_TOURNAMENTS_SHARED_AGGREGATOR =
  "team_tournament_list_my_dashboards+listInternalRefereeHubAssignments";

export function collectMyTournamentClubScopes({
  clubs = [],
  activeClub = null,
  teamCards = [],
  user = null,
} = {}) {
  const tenantFallback = String(user?.venueId || user?.tenantId || "").trim();
  const seen = new Set();
  const scopes = [];
  const push = (clubId, tenantId) => {
    const id = String(clubId || "").trim();
    const tenant = String(tenantId || tenantFallback || "").trim();
    if (!id || !tenant) return;
    const key = `${tenant}::${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    scopes.push({ id, clubId: id, tenantId: tenant });
  };
  push(activeClub?.id || activeClub?.clubId, activeClub?.tenantId || activeClub?.venueId);
  for (const club of clubs || []) {
    push(club?.id || club?.clubId, club?.tenantId || club?.venueId);
  }
  for (const card of teamCards || []) {
    push(card?.clubId, card?.tenantId);
  }
  return scopes;
}

export function projectInternalRefereeDashboardCard({ tournament, matches = [] } = {}) {
  const id = String(tournament?.id || "").trim();
  if (!id || !matches.length) return null;
  const next = matches[0];
  const scoringPath = String(next?.accessPath || next?.scoringAction || "").trim();
  return {
    id,
    teamDomainId: null,
    name: tournament.name || id,
    status: String(tournament.status || "ready").toLowerCase(),
    clubId: tournament.clubId || null,
    tenantId: tournament.tenantId || null,
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    modeLabel: "Giải nội bộ",
    roles: ["referee"],
    myTeam: null,
    openTaskCount: matches.length,
    nextMatchup: {
      teamAId: next.team1Name || "",
      teamBId: next.team2Name || "",
      scheduledAt: next.scheduledStart || null,
      courtId: next.courtId || null,
      matchId: next.matchId || null,
      status: next.status || null,
    },
    href: scoringPath || "/referee",
    captainPortalHref: null,
    refereeHref: scoringPath || null,
    assignedMatches: matches,
    source: "internal_canonical",
  };
}

export function mergeMyTournamentDashboardCards(teamCards = [], internalCards = []) {
  const seen = new Set();
  const out = [];
  for (const card of [...(teamCards || []), ...(internalCards || [])]) {
    const id = String(card?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(card);
  }
  return out;
}

export async function loadInternalRefereeDashboardCards({
  user,
  clubScopes = [],
  listCanonicalTournaments,
} = {}) {
  if (!user?.id) {
    return { ok: false, code: "NOT_AUTHENTICATED", tournaments: [] };
  }
  if (typeof listCanonicalTournaments !== "function") {
    return { ok: true, tournaments: [] };
  }
  const cards = [];
  const seen = new Set();
  for (const scope of clubScopes) {
    const clubId = String(scope?.clubId || scope?.id || "").trim();
    const tenantId = String(scope?.tenantId || "").trim();
    if (!clubId || !tenantId) continue;
    const listed = await listCanonicalTournaments(
      { id: clubId, clubId, tenantId },
      {},
      { tenantId }
    );
    if (!listed?.ok) continue;
    const discovered = listInternalRefereeHubAssignments({
      tournaments: listed.tournaments || [],
      user,
      clubId,
      tenantId,
    });
    if (!discovered.ok) continue;
    const byTournament = new Map();
    for (const match of discovered.matches || []) {
      const tid = String(match.tournamentId || "");
      if (!tid) continue;
      if (!byTournament.has(tid)) byTournament.set(tid, []);
      byTournament.get(tid).push(match);
    }
    for (const [tournamentId, matches] of byTournament.entries()) {
      if (seen.has(tournamentId)) continue;
      const tournament = (listed.tournaments || []).find(
        (item) => String(item.id) === tournamentId
      );
      const card = projectInternalRefereeDashboardCard({
        tournament: tournament || {
          id: tournamentId,
          name: matches[0]?.tournamentName,
          status: "ready",
          clubId,
          tenantId,
        },
        matches,
      });
      if (!card) continue;
      seen.add(tournamentId);
      cards.push(card);
    }
  }
  return { ok: true, tournaments: cards };
}

export async function aggregateMyTournamentDashboards({
  user,
  clubs = [],
  activeClub = null,
  listTeamDashboards,
  listCanonicalTournaments,
} = {}) {
  if (!user?.id) {
    return {
      ok: false,
      code: "NOT_AUTHENTICATED",
      error: "Phiên đăng nhập hết hạn — đăng nhập lại.",
      tournaments: [],
    };
  }

  const teamRaw =
    typeof listTeamDashboards === "function" ? await listTeamDashboards() : { ok: true, tournaments: [] };
  const team = normalizeMyDashboardListResult(teamRaw);
  const clubScopes = collectMyTournamentClubScopes({
    clubs,
    activeClub,
    teamCards: team.ok ? team.tournaments : [],
    user,
  });
  const internal = await loadInternalRefereeDashboardCards({
    user,
    clubScopes,
    listCanonicalTournaments,
  });

  if (!team.ok && !(internal.tournaments || []).length) {
    return team;
  }

  return {
    ok: true,
    tournaments: mergeMyTournamentDashboardCards(
      team.ok ? team.tournaments : [],
      internal.tournaments || []
    ),
  };
}
