/**
 * Competition / tournament entryId → auth userId resolver (Phase 1.4).
 *
 * Does NOT import Competition Engine internals.
 * Uses tournament entry.playerIds + athlete link / player.authUserId.
 */
import { findUserIdByPlayerId } from "../../club/storage/athleteClubLinkStore.js";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";

function collectEntries(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (Array.isArray(source.entries)) return source.entries;
  if (typeof source.getEntries === "function") {
    try {
      return source.getEntries() || [];
    } catch {
      return [];
    }
  }
  return [];
}

function resolvePlayerUserId(playerId, playersById) {
  const player = playersById.get(String(playerId));
  if (player?.authUserId) return String(player.authUserId);
  const linked = findUserIdByPlayerId(playerId);
  return linked ? String(linked) : null;
}

/**
 * @param {object} [options]
 * @param {() => object|object[]} [options.loadTournament] — returns tournament or entries
 * @param {string} [options.clubId] — for player authUserId lookup
 * @param {Map|object[]} [options.entryIndex] — Map<entryId, entry> or entry list
 */
export function createCompetitionEntryResolver(options = {}) {
  return function resolveEntriesToUsers({
    tenantId,
    competitionId = null,
    entryIds = [],
  } = {}) {
    if (!tenantId || !Array.isArray(entryIds) || entryIds.length === 0) {
      return [];
    }

    let entries = [];
    if (options.entryIndex instanceof Map) {
      entries = entryIds.map((id) => options.entryIndex.get(String(id))).filter(Boolean);
    } else if (Array.isArray(options.entryIndex)) {
      const map = new Map(options.entryIndex.map((e) => [String(e.id || e.entryId), e]));
      entries = entryIds.map((id) => map.get(String(id))).filter(Boolean);
    } else if (typeof options.loadTournament === "function") {
      const tournament = options.loadTournament({ tenantId, competitionId }) || {};
      const all = collectEntries(tournament);
      const map = new Map(all.map((e) => [String(e.id || e.entryId), e]));
      entries = entryIds.map((id) => map.get(String(id))).filter(Boolean);
    } else if (options.tournament) {
      const all = collectEntries(options.tournament);
      const map = new Map(all.map((e) => [String(e.id || e.entryId), e]));
      entries = entryIds.map((id) => map.get(String(id))).filter(Boolean);
    }

    const clubId = options.clubId || options.tournament?.clubId || null;
    const players = clubId ? loadPlayersForClub(clubId) : [];
    const playersById = new Map(players.map((p) => [String(p.id), p]));

    const out = [];
    const seen = new Set();
    for (const entry of entries) {
      const entryTenant =
        entry.tenantId || entry.venueId || entry.tenant_id || tenantId;
      if (String(entryTenant) !== String(tenantId)) {
        continue;
      }
      const playerIds = Array.isArray(entry.playerIds)
        ? entry.playerIds
        : Array.isArray(entry.players)
          ? entry.players.map((p) => p.id || p.playerId).filter(Boolean)
          : [];
      for (const playerId of playerIds) {
        const userId = resolvePlayerUserId(playerId, playersById);
        if (!userId || seen.has(userId)) continue;
        seen.add(userId);
        out.push({
          userId,
          tenantId: String(tenantId),
          entryId: String(entry.id || entry.entryId || ""),
          playerId: String(playerId),
        });
      }
      // Direct auth user on entry (if present)
      const directUserId = entry.userId || entry.authUserId || entry.ownerUserId;
      if (directUserId && !seen.has(String(directUserId))) {
        seen.add(String(directUserId));
        out.push({
          userId: String(directUserId),
          tenantId: String(tenantId),
          entryId: String(entry.id || entry.entryId || ""),
        });
      }
    }
    return out;
  };
}

/**
 * Structured skip reasons for unresolved entryIds.
 */
export function explainUnresolvedEntryIds({
  tenantId,
  entryIds = [],
  entryResolver,
  competitionId = null,
} = {}) {
  const wanted = (entryIds || []).map(String);
  if (!wanted.length) return [];
  const resolved = entryResolver
    ? entryResolver({ tenantId, competitionId, entryIds: wanted }) || []
    : [];
  const resolvedEntryIds = new Set(
    resolved.map((r) => String(r.entryId || "")).filter(Boolean)
  );
  return wanted
    .filter((id) => !resolvedEntryIds.has(id))
    .map((entryId) => ({
      entryId,
      reason: "unresolved_entry_or_no_linked_user",
    }));
}
