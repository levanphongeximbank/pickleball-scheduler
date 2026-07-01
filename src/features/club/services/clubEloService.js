import { expectedScore } from "../../../tournament/engines/eloEngine.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { DEFAULT_CLUB_ELO } from "../constants/clubStatus.js";
import { normalizeClubPlayerRating } from "../models/clubPlayerRating.js";
import { normalizeClubRatingHistory } from "../models/clubRatingHistory.js";
import { loadClubExtension, saveClubExtension } from "../storage/clubExtensionStorage.js";
import { markClubMatchEloApplied } from "./clubMatchService.js";
import { guardClubTenant } from "../../tenant/guards/tenantGuard.js";

const K_FACTOR = 32;

function averageElo(playerIds, ratingsByPlayer) {
  const values = playerIds
    .map((id) => ratingsByPlayer.get(id) ?? DEFAULT_CLUB_ELO)
    .filter(Number.isFinite);
  if (!values.length) return DEFAULT_CLUB_ELO;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function computeTeamDelta(teamAIds, teamBIds, ratingsByPlayer, winnerTeam) {
  const ratingA = averageElo(teamAIds, ratingsByPlayer);
  const ratingB = averageElo(teamBIds, ratingsByPlayer);

  const scoreA = winnerTeam === "A" ? 1 : winnerTeam === "B" ? 0 : 0.5;
  const expectedA = expectedScore(ratingA, ratingB);
  const deltaA = K_FACTOR * (scoreA - expectedA);

  return { deltaA, deltaB: -deltaA };
}

/**
 * Áp dụng ELO cho trận CLB đã hoàn thành. An toàn — bỏ qua nếu đã áp dụng.
 */
export async function applyClubMatchElo(matchId, options = {}) {
  const { clubId, tenantId } = options;

  if (!clubId || !matchId) {
    return { ok: false, error: "Thiếu clubId hoặc matchId." };
  }

  if (tenantId) {
    const check = guardClubTenant(clubId, tenantId);
    if (!check.ok) {
      return check;
    }
  }

  const ext = loadClubExtension(clubId);
  const match = ext.matches.find((m) => m.id === matchId);

  if (!match) {
    return { ok: false, error: "Không tìm thấy trận đấu." };
  }

  if (match.eloApplied) {
    return { ok: true, skipped: true, reason: "ELO đã được cập nhật." };
  }

  if (!match.winnerTeam && match.teamAScore == null) {
    return { ok: true, skipped: true, reason: "Trận chưa hoàn thành." };
  }

  const winnerTeam =
    match.winnerTeam ||
    (match.teamAScore > match.teamBScore ? "A" : match.teamBScore > match.teamAScore ? "B" : null);

  if (!winnerTeam) {
    return { ok: true, skipped: true, reason: "Không xác định được đội thắng." };
  }

  const ratingsByPlayer = new Map(
    ext.ratings.map((r) => [r.playerId, r.elo])
  );

  const { deltaA, deltaB } = computeTeamDelta(
    match.teamAPlayerIds,
    match.teamBPlayerIds,
    ratingsByPlayer,
    winnerTeam
  );

  const now = new Date().toISOString();
  const user = getCurrentUser();
  let ratingHistory = [...ext.ratingHistory];

  const ratings = ext.ratings.map((rating) => {
    const isTeamA = match.teamAPlayerIds.includes(rating.playerId);
    const isTeamB = match.teamBPlayerIds.includes(rating.playerId);

    if (!isTeamA && !isTeamB) {
      return rating;
    }

    const delta = isTeamA ? deltaA : deltaB;
    const oldElo = rating.elo;
    const newElo = Math.round(oldElo + delta);
    const won = (isTeamA && winnerTeam === "A") || (isTeamB && winnerTeam === "B");
    const lost = (isTeamA && winnerTeam === "B") || (isTeamB && winnerTeam === "A");

    ratingHistory.push(
      normalizeClubRatingHistory({
        tenantId: match.tenantId,
        clubId,
        playerId: rating.playerId,
        oldElo,
        newElo,
        reason: `Trận ${match.id}`,
        changedByUserId: user?.id || "system",
        changedAt: now,
      })
    );

    return normalizeClubPlayerRating({
      ...rating,
      elo: newElo,
      matchesPlayed: (rating.matchesPlayed || 0) + 1,
      wins: (rating.wins || 0) + (won ? 1 : 0),
      losses: (rating.losses || 0) + (lost ? 1 : 0),
      lastUpdatedAt: now,
    });
  });

  saveClubExtension(clubId, { ...ext, ratings, ratingHistory });
  markClubMatchEloApplied(clubId, matchId);

  return { ok: true, matchId, deltaA, deltaB };
}

export function applyClubMatchEloById(matchId, clubId, tenantId) {
  return applyClubMatchElo(matchId, { clubId, tenantId });
}
