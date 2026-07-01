import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { listBookingsForDate } from "../../../domain/bookingService.js";
import { listTournaments } from "../../../domain/tournamentService.js";
import { getLeagueStandingsBoard } from "../../../domain/seasonStandingsService.js";
import { loadPlayerHistoryProfileForClub } from "../../../tournament/engines/playerHistoryEngine.js";
import { MATCH_STATUS } from "../../../models/tournament/constants.js";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePlayerName(player) {
  return String(player?.name || "").trim().toLowerCase();
}

function bookingMatchesPlayer(booking, player) {
  if (!booking || !player) {
    return false;
  }
  const name = normalizePlayerName(player);
  const customer = String(booking.customerName || booking.customer || "").trim().toLowerCase();
  const note = String(booking.note || "").trim().toLowerCase();
  return (
    (customer && customer === name) ||
    (note && note.includes(name)) ||
    String(booking.playerId || "") === String(player.id)
  );
}

function collectUpcomingMatches(tournaments, playerId) {
  const upcoming = [];
  const pid = String(playerId);
  const list = Array.isArray(tournaments) ? tournaments : Object.values(tournaments || {});

  list.forEach((tournament) => {
    if (!tournament || typeof tournament !== "object") {
      return;
    }
    const events = tournament.events || [];
    events.forEach((event) => {
      const groups = event.groups || [];
      groups.forEach((group) => {
        (group.matches || []).forEach((match) => {
          const ids = [
            ...(match.teamAPlayerIds || []),
            ...(match.teamBPlayerIds || []),
            ...(match.playerIds || []),
          ].map(String);
          if (!ids.includes(pid)) {
            return;
          }
          if (match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT) {
            return;
          }
          upcoming.push({
            matchId: match.id,
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            status: match.status,
            scheduledAt: match.scheduledAt || match.startTime || null,
            courtLabel: match.courtLabel || match.courtId || "",
          });
        });
      });
    });
  });

  return upcoming.sort((a, b) => String(a.scheduledAt || "").localeCompare(String(b.scheduledAt || "")));
}

function resolveRankingRow(clubId, playerId, leagueId, seasonId) {
  if (!leagueId) {
    return null;
  }
  const board = getLeagueStandingsBoard(clubId, leagueId);
  const row = board.find((item) => String(item.playerId) === String(playerId));
  if (!row) {
    return null;
  }
  return {
    rank: row.rank,
    points: row.points,
    wins: row.wins,
    losses: row.losses,
    leagueId,
    seasonId: seasonId || null,
  };
}

/**
 * Load player mobile home data from club blob (real local/staging data).
 */
export function loadPlayerMobileHome({
  clubId,
  playerId,
  tenantId,
  leagueId = null,
  seasonId = null,
} = {}) {
  if (!clubId) {
    return { ok: false, error: "Chưa chọn CLB.", code: "NO_CLUB" };
  }

  const players = loadPlayersForClub(clubId);
  const player =
    players.find((p) => String(p.id) === String(playerId)) || null;

  if (!player) {
    return {
      ok: true,
      player: null,
      schedule: [],
      bookings: [],
      tournaments: [],
      upcomingMatches: [],
      recentResults: [],
      ranking: null,
      stats: null,
      tenantId,
    };
  }

  const tournaments = listTournaments(clubId) || [];

  const today = todayIsoDate();
  const bookings = listBookingsForDate(today, clubId)
    .filter((b) => bookingMatchesPlayer(b, player))
    .map((b) => ({
      id: b.id,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      courtName: b.courtName || b.courtId,
      status: b.status,
      paymentStatus: b.paymentStatus,
    }));

  const history = loadPlayerHistoryProfileForClub(clubId, player.id, { recentLimit: 8 });

  const upcomingMatches = collectUpcomingMatches(tournaments, player.id);

  const registeredTournaments = tournaments.filter((t) => {
    const ids = (t.registeredPlayerIds || t.playerIds || []).map(String);
    return ids.includes(String(player.id));
  });

  return {
    ok: true,
    player,
    schedule: [...bookings, ...upcomingMatches.map((m) => ({
      id: m.matchId,
      type: "match",
      label: m.tournamentName,
      time: m.scheduledAt,
      courtName: m.courtLabel,
      status: m.status,
    }))],
    bookings,
    tournaments: registeredTournaments.length ? registeredTournaments : tournaments.slice(0, 5),
    upcomingMatches,
    recentResults: history.ok ? history.recentMatches || [] : [],
    ranking: resolveRankingRow(clubId, player.id, leagueId, seasonId),
    stats: history.ok ? history.stats : null,
    tenantId,
  };
}
