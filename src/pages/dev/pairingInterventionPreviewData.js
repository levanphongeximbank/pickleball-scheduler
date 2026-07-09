import { EVENT_TYPE } from "../../models/tournament/constants.js";
import { suggestEntriesFromPlayers } from "../../tournament/engines/teamPairingEngine.js";
import { assignEntriesToGroupsSnake } from "../../tournament/engines/seededGroupEngine.js";
import { buildGroupStageSchedule } from "../../tournament/engines/scheduleEngine.js";
import { recomputeCourt } from "../../pages/selectPlayers.logic.js";

export const PREVIEW_TOURNAMENT_ID = "preview-tournament";
export const PREVIEW_EVENT_ID = "preview-event";

function buildMixedPlayers() {
  const males = Array.from({ length: 8 }, (_, index) => ({
    id: `male-${index + 1}`,
    name: `Nam ${index + 1}`,
    gender: "Nam",
    level: 3 + index * 0.2,
    rating: 3 + index * 0.2,
  }));
  const females = Array.from({ length: 8 }, (_, index) => ({
    id: `female-${index + 1}`,
    name: `Nu ${index + 1}`,
    gender: "Nữ",
    level: 3.1 + index * 0.15,
    rating: 3.1 + index * 0.15,
  }));
  return [...males, ...females];
}

export function buildPreviewTournamentData() {
  const players = buildMixedPlayers();
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: PREVIEW_TOURNAMENT_ID,
    eventId: PREVIEW_EVENT_ID,
  });
  const groups = assignEntriesToGroupsSnake(entries, 4, players).map((group) => ({
    ...group,
    tournamentId: PREVIEW_TOURNAMENT_ID,
    eventId: PREVIEW_EVENT_ID,
  }));
  const schedule = buildGroupStageSchedule(groups, {
    tournamentId: PREVIEW_TOURNAMENT_ID,
    eventId: PREVIEW_EVENT_ID,
    players,
  });

  return {
    players,
    entries,
    groups: schedule.groups,
    matches: schedule.matches,
    eventType: EVENT_TYPE.MIXED_DOUBLE,
  };
}

export function buildPreviewScheduleResult() {
  const court = recomputeCourt({
    court: 1,
    teamA: [
      { id: "male-1", name: "Nam 1", level: 3.5 },
      { id: "male-2", name: "Nam 2", level: 3.8 },
    ],
    teamB: [
      { id: "male-3", name: "Nam 3", level: 3.2 },
      { id: "male-4", name: "Nam 4", level: 3.4 },
    ],
  });

  return {
    courts: [court],
    waiting: [{ id: "male-5", name: "Nam 5", level: 3.0 }],
    aiScore: { total: 82, balance: 75, waiting: 60 },
    bestCandidateScore: 82,
  };
}
