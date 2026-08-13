/**
 * Daily Director projection — display-only view of canonical Daily session.
 * Does not mutate session/tournament authority.
 */

import { partitionDailyMatches } from "../../../../tournament/engines/dailyPlayEngine.js";
import { getRefereeSettings } from "../../../../tournament/engines/refereeEngine.js";

export const DAILY_REFEREE_ASSIGNMENTS_KEY = "dailyRefereeAssignments";

export function applyDailyRefereeAssignments(matches = [], assignments = {}) {
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) {
    return Array.isArray(matches) ? matches : [];
  }

  return (matches || []).map((match) => {
    const assigned = assignments[String(match.id)];
    if (!assigned || typeof assigned !== "object") {
      return match;
    }
    return {
      ...match,
      referee: match.referee?.token ? match.referee : assigned,
    };
  });
}

export function getDailyRefereeAssignments(tournament) {
  const raw = tournament?.settings?.[DAILY_REFEREE_ASSIGNMENTS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw;
}

/**
 * @param {{
 *   tournament?: object|null,
 *   session?: {
 *     dailyPlay?: object,
 *     courts?: object[],
 *     courtStates?: object[],
 *     leases?: object[],
 *   }|null,
 *   players?: object[],
 * }} input
 */
export function buildCanonicalDailyDirectorSnapshot({
  tournament = null,
  session = null,
  players = [],
} = {}) {
  const dailyPlay = session?.dailyPlay || { matches: [] };
  const assignments = getDailyRefereeAssignments(tournament);
  const matches = applyDailyRefereeAssignments(dailyPlay.matches || [], assignments);
  const partitioned = partitionDailyMatches(matches);
  const courts = Array.isArray(session?.courts) ? session.courts : [];
  const courtStates = Array.isArray(session?.courtStates)
    ? session.courtStates
    : [];
  const refereeSettings = getRefereeSettings(tournament);

  return {
    mode: "daily_play",
    settings: dailyPlay,
    matches: {
      waiting: partitioned.waiting,
      assigned: partitioned.assigned,
      onCourt: partitioned.playing,
      playing: partitioned.playing,
      completed: partitioned.completed,
    },
    courtStates,
    courts,
    players,
    leases: session?.leases || [],
    standings: [],
    bracketProgress: null,
    refereeSettings,
    summary: {
      waiting: partitioned.waiting.length,
      assigned: partitioned.assigned.length,
      onCourt: partitioned.playing.length,
      playing: partitioned.playing.length,
      completed: partitioned.completed.length,
      courtsBusy: courtStates.filter((court) => court.currentMatchId).length,
    },
  };
}
