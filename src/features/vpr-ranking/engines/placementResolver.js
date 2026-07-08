import { MATCH_STAGE, MATCH_STATUS, TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { VPR_CATEGORY, eventTypeToVprCategory } from "../constants/vprCategories.js";
import { VPR_PLACEMENT } from "../constants/vprPlacements.js";
import { computeTeamStandings } from "../../team-tournament/engines/teamStandingsEngine.js";

const STAGE_TO_PLACEMENT = {
  [MATCH_STAGE.FINAL]: VPR_PLACEMENT.CHAMPION,
  [MATCH_STAGE.THIRD_PLACE]: VPR_PLACEMENT.SEMIFINAL,
};

function isDoneMatch(match) {
  return (
    match?.status === MATCH_STATUS.COMPLETED || match?.status === MATCH_STATUS.FORFEIT
  );
}

function collectKnockoutMatches(event) {
  return (event.matches || []).filter((match) => match.stage && match.stage !== MATCH_STAGE.GROUP);
}

function resolveFinalPlacements(event) {
  const entries = event.entries || [];
  const entryById = new Map(entries.map((entry) => [String(entry.id), entry]));
  const knockout = collectKnockoutMatches(event);
  const finalMatch = knockout.find((match) => match.stage === MATCH_STAGE.FINAL && isDoneMatch(match));
  const placements = [];

  if (finalMatch?.winnerId && finalMatch?.loserId) {
    const champion = entryById.get(String(finalMatch.winnerId));
    const runnerUp = entryById.get(String(finalMatch.loserId));
    if (champion) {
      placements.push({ entry: champion, placement: VPR_PLACEMENT.CHAMPION });
    }
    if (runnerUp) {
      placements.push({ entry: runnerUp, placement: VPR_PLACEMENT.RUNNER_UP });
    }
  }

  const semifinalMatches = knockout.filter(
    (match) => match.stage === MATCH_STAGE.SEMIFINAL && isDoneMatch(match)
  );
  semifinalMatches.forEach((match) => {
    const loserId = match.loserId || (match.winnerId === match.entryAId ? match.entryBId : match.entryAId);
    const entry = entryById.get(String(loserId));
    if (entry && !placements.some((row) => row.entry.id === entry.id)) {
      placements.push({ entry, placement: VPR_PLACEMENT.SEMIFINAL });
    }
  });

  const quarterMatches = knockout.filter(
    (match) => match.stage === MATCH_STAGE.QUARTERFINAL && isDoneMatch(match)
  );
  quarterMatches.forEach((match) => {
    const loserId = match.loserId || (match.winnerId === match.entryAId ? match.entryBId : match.entryAId);
    const entry = entryById.get(String(loserId));
    if (
      entry &&
      !placements.some((row) => row.entry.id === entry.id)
    ) {
      placements.push({ entry, placement: VPR_PLACEMENT.QUARTERFINAL });
    }
  });

  const round16Matches = knockout.filter(
    (match) => match.stage === MATCH_STAGE.ROUND_OF_16 && isDoneMatch(match)
  );
  round16Matches.forEach((match) => {
    const loserId = match.loserId || (match.winnerId === match.entryAId ? match.entryBId : match.entryAId);
    const entry = entryById.get(String(loserId));
    if (
      entry &&
      !placements.some((row) => row.entry.id === entry.id)
    ) {
      placements.push({ entry, placement: VPR_PLACEMENT.ROUND_16 });
    }
  });

  const placedIds = new Set(placements.map((row) => String(row.entry.id)));
  entries.forEach((entry) => {
    if (!placedIds.has(String(entry.id))) {
      placements.push({ entry, placement: VPR_PLACEMENT.PARTICIPATION });
    }
  });

  return placements;
}

function standingRankToPlacement(rank, total) {
  if (rank === 1) {
    return VPR_PLACEMENT.CHAMPION;
  }
  if (rank === 2) {
    return VPR_PLACEMENT.RUNNER_UP;
  }
  if (rank <= 4) {
    return VPR_PLACEMENT.SEMIFINAL;
  }
  if (rank <= 8) {
    return VPR_PLACEMENT.QUARTERFINAL;
  }
  if (rank <= 16 && total > 16) {
    return VPR_PLACEMENT.ROUND_16;
  }
  return VPR_PLACEMENT.PARTICIPATION;
}

function resolveGroupOnlyPlacements(event) {
  const standings = event.standings || [];
  if (!standings.length) {
    return (event.entries || []).map((entry) => ({
      entry,
      placement: VPR_PLACEMENT.PARTICIPATION,
    }));
  }

  const sorted = [...standings].sort((a, b) => (a.rank || 999) - (b.rank || 999));
  const entryById = new Map((event.entries || []).map((entry) => [String(entry.id), entry]));
  const total = sorted.length;

  return sorted
    .map((row) => {
      const entry = entryById.get(String(row.entryId || row.id));
      if (!entry) {
        return null;
      }
      return {
        entry,
        placement: standingRankToPlacement(row.rank || total, total),
      };
    })
    .filter(Boolean);
}

function resolveEventPlacements(event) {
  const knockout = collectKnockoutMatches(event);
  if (knockout.some(isDoneMatch)) {
    return resolveFinalPlacements(event);
  }
  return resolveGroupOnlyPlacements(event);
}

function teamRankToPlacement(rank, total) {
  return standingRankToPlacement(rank, total);
}

function resolveTeamPlacements(tournament) {
  const teamData = tournament.teamData;
  if (!teamData?.teams?.length) {
    return [];
  }

  const standings = computeTeamStandings(teamData);
  const teamById = new Map(teamData.teams.map((team) => [String(team.id), team]));
  const total = standings.length;

  return standings.map((row) => {
    const team = teamById.get(String(row.teamId));
    const playerIds = (team?.roster || team?.players || [])
      .map((player) => player.playerId || player.id)
      .filter(Boolean);
    return {
      placement: teamRankToPlacement(row.rank, total),
      playerIds,
      teamName: team?.name || "",
      clubName: team?.clubName || tournament.hostClubName || "",
    };
  });
}

/**
 * Resolve placements per VPR category from a completed tournament.
 * @returns {Array<{ category: string, placements: Array }>}
 */
export function resolvePlacementsPerCategory(tournament) {
  if (!tournament) {
    return [];
  }

  if (tournament.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
    const teamPlacements = resolveTeamPlacements(tournament);
    return [
      {
        category: VPR_CATEGORY.TEAM,
        participantCount: teamPlacements.length,
        placements: teamPlacements,
      },
    ];
  }

  const results = [];

  for (const event of tournament.events || []) {
    const category = eventTypeToVprCategory(event.eventType);
    if (!category) {
      continue;
    }
    const placements = resolveEventPlacements(event);
    results.push({
      category,
      eventId: event.id,
      participantCount: (event.entries || []).length,
      placements,
    });
  }

  return results;
}

export { STAGE_TO_PLACEMENT };
