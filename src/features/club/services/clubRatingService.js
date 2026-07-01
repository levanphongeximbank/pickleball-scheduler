import { normalizeClubRatingHistory } from "../models/clubRatingHistory.js";
import { loadClubExtension, saveClubExtension } from "../storage/clubExtensionStorage.js";
import { guardClubTenant } from "../../tenant/guards/tenantGuard.js";
import { guardClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { getCurrentUser } from "../../../auth/authService.js";
import {
  normalizeClubPlayerRating,
  createDefaultClubRating,
} from "../models/clubPlayerRating.js";

function guardRatingAccess(clubId, tenantId, permission) {
  if (tenantId) {
    const tenantCheck = guardClubTenant(clubId, tenantId);
    if (!tenantCheck.ok) {
      return tenantCheck;
    }
  }
  return guardClubAction(clubId, permission);
}

export function getClubRatings(clubId, tenantId) {
  if (tenantId) {
    guardClubTenant(clubId, tenantId);
  }
  const ext = loadClubExtension(clubId);
  return ext.ratings;
}

export function getPlayerClubRating(clubId, playerId, tenantId) {
  if (tenantId) {
    guardClubTenant(clubId, tenantId);
  }
  const ext = loadClubExtension(clubId);
  return ext.ratings.find((r) => r.playerId === String(playerId)) || null;
}

export function createDefaultClubRatingForPlayer(clubId, playerId, tenantId, level) {
  const ext = loadClubExtension(clubId);
  const existing = ext.ratings.find((r) => r.playerId === String(playerId));
  if (existing) {
    return { ok: true, rating: existing, skipped: true };
  }

  const rating = createDefaultClubRating({ tenantId, clubId, playerId, level });
  const ratings = [...ext.ratings, rating];
  saveClubExtension(clubId, { ...ext, ratings });
  return { ok: true, rating };
}

export function updateClubRating(clubId, playerId, newElo, reason, tenantId) {
  const check = guardRatingAccess(clubId, tenantId, PERMISSIONS.PLAYER_UPDATE);
  if (!check.ok) {
    return check;
  }

  const trimmedPlayerId = String(playerId || "").trim();
  const elo = Number(newElo);
  if (!Number.isFinite(elo) || elo < 0) {
    return { ok: false, error: "ELO không hợp lệ." };
  }

  const ext = loadClubExtension(clubId);
  const index = ext.ratings.findIndex((r) => r.playerId === trimmedPlayerId);

  if (index < 0) {
    return { ok: false, error: "Chưa có rating cho player này." };
  }

  const oldElo = ext.ratings[index].elo;
  const now = new Date().toISOString();
  const user = getCurrentUser();

  const ratings = ext.ratings.map((r, i) =>
    i === index
      ? normalizeClubPlayerRating({
          ...r,
          elo,
          lastUpdatedAt: now,
        })
      : r
  );

  const historyEntry = normalizeClubRatingHistory({
    tenantId,
    clubId,
    playerId: trimmedPlayerId,
    oldElo,
    newElo: elo,
    reason: reason || "Chỉnh thủ công",
    changedByUserId: user?.id || "system",
    changedAt: now,
  });

  const ratingHistory = [...ext.ratingHistory, historyEntry];
  saveClubExtension(clubId, { ...ext, ratings, ratingHistory });

  return { ok: true, rating: ratings[index], history: historyEntry };
}

export function getClubRatingHistory(clubId, tenantId, playerId) {
  if (tenantId) {
    guardClubTenant(clubId, tenantId);
  }
  const ext = loadClubExtension(clubId);
  const history = ext.ratingHistory;
  if (playerId) {
    return history.filter((h) => h.playerId === String(playerId));
  }
  return history;
}
