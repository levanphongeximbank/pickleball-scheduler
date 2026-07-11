import { normalizePlayers } from "../models/player.js";
import {
  applyEloUpdatesToPlayers,
  buildEloUpdatesFromMatchRecord,
} from "../tournament/engines/eloEngine.js";
import { loadClubData, saveClubData } from "./clubStorage.js";
import { getSupabaseAuthClient, hasSupabaseConfig } from "../auth/supabaseClient.js";
import { isRatingV2Enabled } from "../features/competition-core/config/featureFlags.js";
import { applyCompetitionEloFromMatchRecord } from "../features/competition-core/rating/ratingServiceV2.js";

export function applyEloFromMatchRecord(clubId, record, options = {}) {
  if (!record?.id) {
    return { ok: true, skipped: true, updates: [] };
  }

  if (isRatingV2Enabled(options.envSource)) {
    return applyCompetitionEloFromMatchRecord(clubId, record, {
      ...options,
      ratingApplyBackend: options.ratingApplyBackend ?? "blob",
    });
  }

  const data = loadClubData(clubId);
  const updates = buildEloUpdatesFromMatchRecord(record, data.players || [], options);

  if (!updates.length) {
    return { ok: true, skipped: true, updates: [] };
  }

  data.players = normalizePlayers(applyEloUpdatesToPlayers(data.players || [], updates));
  data.updatedAt = new Date().toISOString();
  saveClubData(clubId, data);

  return { ok: true, updates };
}

/** Async path — prefers database RPC when Supabase configured (CC-02D). */
export async function applyEloFromMatchRecordAsync(clubId, record, options = {}) {
  if (!record?.id) {
    return { ok: true, skipped: true, updates: [] };
  }

  if (isRatingV2Enabled(options.envSource)) {
    const result = applyCompetitionEloFromMatchRecord(clubId, record, {
      ...options,
      ratingApplyBackend:
        options.ratingApplyBackend ?? (hasSupabaseConfig() ? "database" : "blob"),
      supabaseClient: options.supabaseClient ?? getSupabaseAuthClient() ?? undefined,
      tenantId: options.tenantId ?? record.tenantId ?? clubId,
    });

    if (result && typeof result.then === "function") {
      return result;
    }

    return result;
  }

  return applyEloFromMatchRecord(clubId, record, options);
}
