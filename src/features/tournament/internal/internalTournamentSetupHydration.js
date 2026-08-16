/**
 * Hydrate Internal setup form controls from canonical Tournament payload (IT-E2E-003).
 * Pure projection — never reads localStorage / sessionStorage.
 */
import { EVENT_TYPE } from "../../../models/tournament/constants.js";

function collectPlayerIdsFromEntries(entries = []) {
  const ids = [];
  const seen = new Set();
  for (const entry of entries) {
    const list = Array.isArray(entry?.playerIds)
      ? entry.playerIds
      : entry?.playerId
        ? [entry.playerId]
        : [];
    for (const raw of list) {
      const id = String(raw || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * @param {object|null} tournament
 * @param {{ queryEventType?: string|null }} [options]
 */
export function hydrateInternalSetupFromTournament(tournament, options = {}) {
  const event = tournament?.events?.[0] || null;
  const groups = Array.isArray(event?.groups) ? event.groups : [];
  const entries = Array.isArray(event?.entries) ? event.entries : [];
  const matches = Array.isArray(event?.matches) ? event.matches : [];
  const groupStageMatches = matches.filter((match) => !match?.bracketMatchId);

  const eventType =
    event?.eventType ||
    options.queryEventType ||
    EVENT_TYPE.MIXED_DOUBLE;

  const groupCount =
    groups.length > 0
      ? groups.length
      : Number(tournament?.settings?.internal?.groupCount) > 0
        ? Number(tournament.settings.internal.groupCount)
        : 4;

  return {
    eventType,
    groupCount,
    selectedPlayerIds: collectPlayerIdsFromEntries(entries),
    previewEntries: [],
    hasGroups: groups.length > 0,
    hasSchedule: groupStageMatches.length > 0,
    hasEntries: entries.length > 0,
    tournamentVersion: tournament?.version ?? null,
    tournamentStatus: tournament?.status || null,
  };
}

/**
 * Generation fence: ignore stale async athlete loads older than this generation.
 */
export function nextHydrationGeneration(current = 0) {
  return Number(current || 0) + 1;
}
