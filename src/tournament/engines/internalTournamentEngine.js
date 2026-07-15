import { createEventRecord } from "../../models/tournament/event.js";
import { EVENT_TYPE, TOURNAMENT_MODE } from "../../models/tournament/constants.js";
import { runLegacyDrawWithCanonicalAdapter } from "../../features/competition-core/draw/adapters/drawRuntimeAdapter.js";
import {
  COMPETITION_CLASS,
  assignGroupsWithPrivatePairingRules,
} from "../../features/private-pairing-rules/index.js";
import { validateGroupDrawInput } from "./validationEngine.js";
import { suggestEntriesFromPlayers } from "./teamPairingEngine.js";
import { summarizeGroupBalance } from "./seededGroupEngine.js";
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
  pairingConstraints = [],
  privatePairingRules = [],
  clubId = null,
  competitionClass = COMPETITION_CLASS.INTERNAL,
  envSource,
  seed,
  allowedByPublishedRules = false,
  contextTime,
  pointsConfig = { win: 2, loss: 1, forfeit: 0 },
} = {}) {
  const event = ensureInternalEvent(tournament, eventType);
  const selectedPlayers = players.filter((player) =>
    selectedPlayerIds.includes(String(player.id))
  );

  const pairingOptions = {
    tournamentId: tournament.id,
    eventId: event.id,
    pairingConstraints,
    privatePairingRules,
    clubId,
    competitionClass,
    envSource,
    seed,
    allowedByPublishedRules,
    contextTime,
  };

  const entries =
    Array.isArray(manualEntries) && manualEntries.length > 0
      ? manualEntries
      : suggestEntriesFromPlayers(selectedPlayers, eventType, pairingOptions);

  const constraintWarnings = pairingOptions.constraintWarnings || [];

  if (pairingOptions.privatePairingError) {
    return {
      ok: false,
      errors: [pairingOptions.privatePairingError.message],
      warnings: constraintWarnings,
      privatePairingError: pairingOptions.privatePairingError,
    };
  }

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

  const groupResult = runLegacyDrawWithCanonicalAdapter({
    consumer: "internal_tournament",
    strategyKey: "skill_controlled",
    envSource,
    legacyPayload: {
      tournamentId: tournament.id,
      eventId: event.id,
      entries,
      groupCount,
      players: selectedPlayers,
      constraints: pairingConstraints,
      privatePairingRules,
      clubId,
      competitionClass,
      envSource,
      seed,
      allowedByPublishedRules,
      contextTime,
    },
    legacyExecutor: (payload) =>
      assignGroupsWithPrivatePairingRules(
        payload.entries,
        payload.groupCount,
        payload.players,
        {
          pairingConstraints: payload.constraints,
          privatePairingRules: payload.privatePairingRules,
          clubId: payload.clubId,
          tournamentId: payload.tournamentId,
          eventId: payload.eventId,
          competitionClass: payload.competitionClass,
          envSource: payload.envSource,
          seed: payload.seed,
          allowedByPublishedRules: payload.allowedByPublishedRules,
          contextTime: payload.contextTime,
        }
      ),
  });

  if (groupResult.ok === false || groupResult.privatePairingError) {
    const error =
      groupResult.privatePairingError ||
      ({
        message: (groupResult.errors || ["Không chia được bảng."])[0],
      });
    return {
      ok: false,
      errors: [error.message || "Không chia được bảng."],
      warnings: groupResult.warnings || [],
      privatePairingError: groupResult.privatePairingError || null,
    };
  }

  const groups = (groupResult.groups || []).map((group) => ({
    ...group,
    tournamentId: tournament.id,
    eventId: event.id,
    pointsConfig,
  }));

  const schedule = buildGroupStageSchedule(groups, {
    tournamentId: tournament.id,
    eventId: event.id,
    players: selectedPlayers,
    privatePairingRules,
    pairingConstraints,
    clubId,
    competitionClass,
    envSource,
    seed,
    allowedByPublishedRules,
    contextTime,
  });

  if (schedule.ok === false || schedule.privatePairingError) {
    return {
      ok: false,
      errors: [
        schedule.privatePairingError?.message ||
          "Không tạo được lịch vòng bảng thỏa quy tắc đối đầu.",
      ],
      warnings: [
        ...(validation.warnings || []),
        ...(constraintWarnings || []),
        ...(groupResult.warnings || []),
      ],
      privatePairingError: schedule.privatePairingError || null,
    };
  }

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
    warnings: [
      ...(validation.warnings || []),
      ...(constraintWarnings || []),
      ...(groupResult.warnings || []),
    ],
    balance,
    matchCount: countGroupStageMatches(schedule.groups),
    privatePairingError: null,
  };
}

export function applyInternalTournamentPlan(tournament, plan) {
  if (!plan?.ok || !plan.event) {
    return {
      ok: false,
      error: plan?.errors?.[0] || "Khong the ap dung ke hoach bảng.",
      errors: plan?.errors || [],
      privatePairingError: plan?.privatePairingError || null,
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
