import { createEventRecord } from "../../models/tournament/event.js";
import { EVENT_TYPE, TOURNAMENT_MODE } from "../../models/tournament/constants.js";
import { validateGroupDrawInput } from "./validationEngine.js";
import { suggestEntriesFromPlayers } from "./teamPairingEngine.js";
import { assignEntriesToGroupsSnake, summarizeGroupBalance } from "./seededGroupEngine.js";
import { buildGroupStageSchedule, countGroupStageMatches } from "./scheduleEngine.js";

export function getDefaultInternalEventType() {
  return EVENT_TYPE.MIXED_DOUBLE;
}

export function ensureInternalEvent(tournament, eventType = getDefaultInternalEventType()) {
  const events = Array.isArray(tournament?.events) ? [...tournament.events] : [];

  if (events.length > 0) {
    return {
      ...events[0],
      eventType: events[0].eventType || eventType,
    };
  }

  return createEventRecord({
    id: `event-${tournament?.id || "internal"}`,
    tournamentId: tournament?.id || "",
    name: "Giải nội bộ",
    eventType,
    entries: [],
    groups: [],
    matches: [],
  });
}

export function buildInternalTournamentPlan({
  tournament,
  players = [],
  selectedPlayerIds = [],
  eventType = EVENT_TYPE.MIXED_DOUBLE,
  groupCount = 4,
  manualEntries = null,
  pointsConfig = { win: 2, loss: 1, forfeit: 0 },
} = {}) {
  const event = ensureInternalEvent(tournament, eventType);
  const selectedPlayers = players.filter((player) =>
    selectedPlayerIds.includes(String(player.id))
  );

  const entries =
    Array.isArray(manualEntries) && manualEntries.length > 0
      ? manualEntries
      : suggestEntriesFromPlayers(selectedPlayers, eventType, {
          tournamentId: tournament.id,
          eventId: event.id,
        });

  const validation = validateGroupDrawInput({
    entries,
    players: selectedPlayers,
    eventType,
    groupCount,
    courtCount: 1,
    tournamentMode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
  });

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const groups = assignEntriesToGroupsSnake(entries, groupCount, selectedPlayers).map(
    (group) => ({
      ...group,
      tournamentId: tournament.id,
      eventId: event.id,
      pointsConfig,
    })
  );

  const schedule = buildGroupStageSchedule(groups, {
    tournamentId: tournament.id,
    eventId: event.id,
    players: selectedPlayers,
  });

  const balance = summarizeGroupBalance(schedule.groups);

  return {
    ok: true,
    event: {
      ...event,
      eventType,
      entries,
      groups: schedule.groups,
      matches: schedule.matches,
    },
    warnings: validation.warnings,
    balance,
    matchCount: countGroupStageMatches(schedule.groups),
  };
}

export function applyInternalTournamentPlan(tournament, plan) {
  if (!plan?.ok || !plan.event) {
    return {
      ok: false,
      error: plan?.errors?.[0] || "Khong the ap dung ke hoach giai.",
      errors: plan?.errors || [],
    };
  }

  return {
    ok: true,
    tournament: {
      ...tournament,
      events: [plan.event],
    },
    warnings: plan.warnings || [],
    balance: plan.balance,
    matchCount: plan.matchCount,
  };
}

export function buildInternalTournamentPatch(tournament, plan) {
  const applied = applyInternalTournamentPlan(tournament, plan);
  if (!applied.ok) {
    return applied;
  }

  return {
    ok: true,
    events: applied.tournament.events,
    warnings: applied.warnings,
    balance: applied.balance,
    matchCount: applied.matchCount,
  };
}
