import { normalizePlayers } from "../models/player.js";
import {
  applyEloUpdatesToPlayers,
  buildEloUpdatesFromMatchRecord,
} from "../tournament/engines/eloEngine.js";
import { loadClubData, saveClubData } from "./clubStorage.js";
import { isRatingV2Enabled } from "../features/competition-core/config/featureFlags.js";
import { applyCompetitionEloFromMatchRecord } from "../features/competition-core/rating/ratingServiceV2.js";

export function applyEloFromMatchRecord(clubId, record, options = {}) {
  if (!record?.id) {
    return { ok: true, skipped: true, updates: [] };
  }

  if (isRatingV2Enabled(options.envSource)) {
    return applyCompetitionEloFromMatchRecord(clubId, record, options);
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
