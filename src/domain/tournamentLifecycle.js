import { TOURNAMENT_MODE } from "../models/tournament/index.js";
import {
  dailyMatchToRecord,
  eventMatchToRecord,
} from "../tournament/engines/playerHistoryEngine.js";
import { applyEloFromMatchRecord } from "./eloService.js";
import { applySeasonPointsFromMatchRecord } from "./seasonStandingsService.js";
import { loadClubData } from "./clubStorage.js";
import { processClubInternalMatchCompletion } from "../features/club/services/clubTournamentBridge.js";
import { resolveTenantIdForClub } from "../features/tenant/guards/tenantGuard.js";

function getTournamentFromClub(clubId, tournamentId) {
  const data = loadClubData(clubId);
  return (data.tournaments || []).find((item) => String(item.id) === String(tournamentId)) || null;
}

function resolveMatchRecord({ tournament, match, event = null }) {
  if (!tournament || !match) {
    return null;
  }

  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return dailyMatchToRecord(match, tournament);
  }

  if (!event) {
    return null;
  }

  return eventMatchToRecord(match, tournament, event);
}

function findMatchInTournament(tournament, matchId, eventId = null) {
  if (!tournament || !matchId) {
    return { match: null, event: null };
  }

  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    const match = (tournament.settings?.dailyPlay?.matches || []).find(
      (item) => String(item.id) === String(matchId)
    );
    return { match: match || null, event: null };
  }

  const events = tournament.events || [];
  const scopedEvents = eventId
    ? events.filter((item) => String(item.id) === String(eventId))
    : events;

  for (const event of scopedEvents) {
    const match = (event.matches || []).find(
      (item) => String(item.id) === String(matchId)
    );
    if (match) {
      return { match, event };
    }
  }

  return { match: null, event: null };
}

export function processCompletedMatch(clubId, { tournament, match, event = null }) {
  const isClubInternal =
    tournament?.type === "club_internal" ||
    (tournament?.clubId && tournament.clubId === clubId);

  let clubEloResult = null;
  if (isClubInternal) {
    const tenantId = tournament.tenantId || resolveTenantIdForClub(clubId);
    clubEloResult = processClubInternalMatchCompletion(
      clubId,
      tournament,
      match,
      event,
      tenantId
    );
  }

  if (!tournament?.leagueId) {
    return {
      ok: clubEloResult?.ok !== false,
      skipped: !isClubInternal,
      reason: isClubInternal ? "club-internal-only" : "missing-league",
      clubEloResult,
    };
  }

  const record = resolveMatchRecord({ tournament, match, event });
  if (!record) {
    return { ok: true, skipped: true, reason: "no-record", clubEloResult };
  }

  const seasonResult = applySeasonPointsFromMatchRecord(
    clubId,
    tournament.leagueId,
    record
  );

  const skipEloForDailyPlay = tournament.mode === TOURNAMENT_MODE.DAILY_PLAY;
  const eloResult =
    isClubInternal || skipEloForDailyPlay
      ? {
          ok: true,
          skipped: true,
          reason: skipEloForDailyPlay ? "daily-play-excluded" : "club-scoped-elo",
        }
      : applyEloFromMatchRecord(clubId, record);

  return {
    ok: seasonResult.ok !== false && eloResult.ok !== false && clubEloResult?.ok !== false,
    seasonResult,
    eloResult,
    clubEloResult,
    record,
  };
}

export function processCompletedMatchById(
  clubId,
  tournamentId,
  matchId,
  { eventId = null } = {}
) {
  const tournament = getTournamentFromClub(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Khong tim thay giai." };
  }

  const { match, event } = findMatchInTournament(tournament, matchId, eventId);
  if (!match) {
    return { ok: false, error: "Khong tim thay tran." };
  }

  return processCompletedMatch(clubId, { tournament, match, event });
}
