/**
 * Token-scoped Internal scoreboard loader (IT-E2E-BROWSER-015).
 * Live RPC remains scoring authority. Canonical assignment is display fallback
 * when the token exists on Internal matches but tournament_match_live is empty.
 * Does not use ClubProvider / activeClub.
 */
import { fetchMatchLiveByToken, MATCH_LIVE_STATUS } from "../../../domain/matchLiveSync.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { canonicalClubRepository } from "../../club/repositories/index.js";
import { listTournamentsQuery } from "../services/tournamentQueries.js";
import { isInternalRefereeAssignedToMatch } from "./internalRefereeDiscovery.js";

export function resolveRefereeTokenScoreboardScope(matchRow, user) {
  return {
    clubId: matchRow?.clubId || null,
    venueId: matchRow?.venueId || user?.venueId || user?.tenantId || null,
    tournamentId: matchRow?.tournamentId || null,
  };
}

export function findInternalMatchByRefereeToken(tournaments = [], token) {
  const wanted = String(token || "").trim();
  if (wanted.length < 16) return null;
  for (const tournament of tournaments || []) {
    if (String(tournament?.mode || "") !== TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
      continue;
    }
    const event = tournament.events?.[0];
    for (const match of event?.matches || []) {
      if (String(match?.referee?.token || "").trim() === wanted) {
        return { tournament, event, match };
      }
    }
  }
  return null;
}

function entryLabel(event, entryId) {
  const id = String(entryId || "");
  return (
    (event?.entries || []).find((entry) => String(entry.id) === id)?.name || id || "—"
  );
}

export function projectInternalRefereeTokenScoreboardRow({
  tournament,
  event,
  match,
} = {}) {
  if (!tournament || !match?.referee?.token) return null;
  const referee = match.referee;
  const completed = Boolean(
    match.winnerId ||
      match.status === "completed" ||
      match.status === "final" ||
      match.status === MATCH_LIVE_STATUS.LOCKED
  );
  const roundLabel = match.round ? `Vòng ${match.round}` : "";
  const stageLabel =
    match.stageLabel ||
    [match.stage === "group" ? "Vòng bảng" : match.stage, roundLabel]
      .filter(Boolean)
      .join(" · ");
  return {
    id: `${tournament.clubId || ""}::${tournament.id}::${match.id}`,
    clubId: String(tournament.clubId || ""),
    tournamentId: String(tournament.id),
    eventId: String(event?.id || ""),
    matchId: String(match.id),
    refereeToken: String(referee.token),
    refereeName: String(referee.name || ""),
    tournamentName: String(tournament.name || tournament.id),
    stageLabel,
    entryALabel: entryLabel(event, match.entryAId),
    entryBLabel: entryLabel(event, match.entryBId),
    courtLabel: String(match.courtName || match.courtId || ""),
    scheduledStart: match.scheduledStart || null,
    scoreA: Number(match.scoreA) || 0,
    scoreB: Number(match.scoreB) || 0,
    status: completed ? MATCH_LIVE_STATUS.LOCKED : MATCH_LIVE_STATUS.PLAYING,
    venueId: tournament.tenantId || null,
    source: "internal_canonical_token",
  };
}

export async function listInternalRefereeTokenClubScopes(
  user,
  { listClubsForCurrentScope } = {}
) {
  const tenantId = String(user?.venueId || user?.tenantId || "").trim();
  if (!tenantId || !user?.id) return [];
  const listFn =
    listClubsForCurrentScope ||
    ((options) => canonicalClubRepository.listClubsForCurrentScope(options));
  const listed = await listFn({
    user,
    tenantId,
    userContext: user,
  });
  if (!listed?.ok) return [];
  return (listed.data || [])
    .map((club) => ({
      clubId: String(club?.id || club?.clubId || "").trim(),
      tenantId: String(club?.tenantId || club?.venueId || tenantId).trim(),
    }))
    .filter((scope) => scope.clubId && scope.tenantId);
}

export async function loadInternalCanonicalTokenScoreboard({
  token,
  user,
  listCanonicalTournaments = listTournamentsQuery,
  listClubScopes,
} = {}) {
  if (!user?.id) {
    return { ok: false, code: "NOT_AUTHENTICATED", row: null };
  }
  const wanted = String(token || "").trim();
  if (wanted.length < 16) {
    return { ok: false, code: "INVALID_TOKEN", row: null };
  }
  const scopes =
    typeof listClubScopes === "function"
      ? await listClubScopes(user)
      : await listInternalRefereeTokenClubScopes(user);
  for (const scope of scopes) {
    const listed = await listCanonicalTournaments(
      { id: scope.clubId, clubId: scope.clubId, tenantId: scope.tenantId },
      {},
      { tenantId: scope.tenantId }
    );
    if (!listed?.ok) continue;
    const found = findInternalMatchByRefereeToken(listed.tournaments || [], wanted);
    if (!found) continue;
    const roster = found.tournament.settings?.refereeRoster || [];
    if (!isInternalRefereeAssignedToMatch(user, found.match, roster)) {
      return { ok: false, code: "NOT_ASSIGNED", row: null };
    }
    if (
      String(found.tournament.tenantId || "") !== String(user.venueId || user.tenantId || "")
    ) {
      return { ok: false, code: "CROSS_TENANT", row: null };
    }
    const row = projectInternalRefereeTokenScoreboardRow(found);
    if (!row) continue;
    return { ok: true, row, source: "internal_canonical_token" };
  }
  return { ok: false, code: "NOT_FOUND", row: null };
}

export async function loadRefereeTokenScoreboard({
  token,
  user,
  fetchLiveByToken = fetchMatchLiveByToken,
  listCanonicalTournaments = listTournamentsQuery,
  listClubScopes,
} = {}) {
  const live =
    typeof fetchLiveByToken === "function" ? await fetchLiveByToken(token) : { ok: false };
  if (live?.ok && live.row) {
    return { ok: true, row: live.row, source: "match_live" };
  }
  const canonical = await loadInternalCanonicalTokenScoreboard({
    token,
    user,
    listCanonicalTournaments,
    listClubScopes,
  });
  if (canonical.ok) return canonical;
  if (canonical.code === "NOT_ASSIGNED" || canonical.code === "CROSS_TENANT") {
    return { ok: false, code: canonical.code, row: null };
  }
  return live?.error
    ? { ok: false, error: live.error, row: null, code: canonical.code }
    : { ok: false, code: canonical.code || "NOT_FOUND", row: null };
}
