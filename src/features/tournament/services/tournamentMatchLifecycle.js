/**
 * Canonical match-completion lifecycle for cloud Tournament authority.
 *
 * Uses the in-memory tournament returned from a successful cloud update —
 * never reloads tournament state from the legacy club blob.
 */
import { processCompletedMatch } from "../../../domain/tournamentLifecycle.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";

export function findMatchInCanonicalTournament(tournament, matchId, { eventId = null } = {}) {
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

/**
 * Apply rating / season side-effects from a completed match already present
 * on the canonical tournament snapshot.
 *
 * Idempotency is delegated to existing processors:
 * - Club Elo: `eloApplied` on club extension match ledger
 * - Season points: `matchContributions[matchId]` replace-on-reapply
 * - Competition Elo V2: rating application ledger / RPC uniqueness
 *
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string, error?: string, seasonResult?: unknown, eloResult?: unknown, clubEloResult?: unknown }}
 */
export function processCanonicalCompletedMatch(
  clubId,
  tournament,
  matchId,
  { eventId = null } = {}
) {
  if (!clubId || !tournament || !matchId) {
    return { ok: false, error: "Thiếu clubId, tournament hoặc matchId." };
  }

  const { match, event } = findMatchInCanonicalTournament(tournament, matchId, {
    eventId,
  });

  if (!match) {
    return { ok: false, error: "Không tìm thấy trận trong giải canonical." };
  }

  try {
    const result = processCompletedMatch(clubId, { tournament, match, event });
    if (result?.ok === false) {
      return {
        ...result,
        ok: false,
        error: result.error || "Lifecycle Elo/điểm mùa thất bại.",
      };
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Lifecycle Elo/điểm mùa thất bại.",
    };
  }
}
