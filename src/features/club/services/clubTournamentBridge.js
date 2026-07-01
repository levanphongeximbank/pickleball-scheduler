import { loadClubs } from "../../../data/club.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import { eventMatchToRecord } from "../../../tournament/engines/playerHistoryEngine.js";
import { resolveTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import { CLUB_MATCH_TYPES } from "../models/clubMatch.js";
import { addClubMatch } from "./clubMatchService.js";
import { applyClubMatchEloById } from "./clubEloService.js";
import { loadClubExtension } from "../storage/clubExtensionStorage.js";

function resolveWinnerTeam(scoreA, scoreB) {
  if (scoreA == null || scoreB == null) {
    return null;
  }
  if (Number(scoreA) > Number(scoreB)) {
    return "A";
  }
  if (Number(scoreB) > Number(scoreA)) {
    return "B";
  }
  return null;
}

function findExistingClubMatch(clubId, matchKey) {
  const ext = loadClubExtension(clubId);
  return (
    ext.matches.find(
      (m) => m.matchId === matchKey || m.id === matchKey
    ) || null
  );
}

/**
 * Ghi nhận trận giải nội bộ CLB + cập nhật ELO theo CLB (không đụng ELO blob).
 */
export function processClubInternalMatchCompletion(
  clubId,
  tournament,
  match,
  event,
  tenantId
) {
  if (!clubId || !tournament || !match) {
    return { ok: true, skipped: true, reason: "missing-data" };
  }

  const isClubInternal =
    tournament.type === "club_internal" ||
    (tournament.clubId && tournament.clubId === clubId);

  if (!isClubInternal) {
    return { ok: true, skipped: true, reason: "not-club-internal" };
  }

  const record = eventMatchToRecord(match, tournament, event);
  if (!record) {
    return { ok: true, skipped: true, reason: "match-not-finished" };
  }

  const matchKey = String(match.id);
  const existing = findExistingClubMatch(clubId, matchKey);
  if (existing?.eloApplied) {
    return { ok: true, skipped: true, reason: "already-processed", match: existing };
  }

  const effectiveTenantId = tenantId || tournament.tenantId || resolveTenantIdForClub(clubId);
  const winnerTeam = resolveWinnerTeam(record.scoreA, record.scoreB);

  let clubMatch = existing;
  if (!clubMatch) {
    const created = addClubMatch(
      clubId,
      {
        id: `cmatch-t-${matchKey}`,
        tournamentId: tournament.id,
        matchId: matchKey,
        type: CLUB_MATCH_TYPES.INTERNAL_TOURNAMENT,
        playedAt: record.date || match.completedAt || new Date().toISOString(),
        teamAPlayerIds: record.teamAPlayerIds,
        teamBPlayerIds: record.teamBPlayerIds,
        teamAScore: record.scoreA,
        teamBScore: record.scoreB,
        winnerTeam,
        eloApplied: false,
      },
      effectiveTenantId
    );
    if (!created.ok) {
      return created;
    }
    clubMatch = created.match;
  }

  if (winnerTeam && !clubMatch.eloApplied) {
    return applyClubMatchEloById(clubMatch.id, clubId, effectiveTenantId);
  }

  return { ok: true, match: clubMatch, skipped: !winnerTeam };
}

export function findTournamentClubId(tournamentId) {
  const id = String(tournamentId || "").trim();
  if (!id) {
    return null;
  }

  for (const club of loadClubs()) {
    const data = loadClubData(club.id);
    if ((data.tournaments || []).some((t) => String(t.id) === id)) {
      return club.id;
    }
  }

  return null;
}
