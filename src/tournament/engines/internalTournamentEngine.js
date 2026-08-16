import { createEventRecord } from "../../models/tournament/event.js";
import { EVENT_TYPE, TOURNAMENT_MODE } from "../../models/tournament/constants.js";
import { runLegacyDrawWithCanonicalAdapter } from "../../features/competition-core/draw/adapters/drawRuntimeAdapter.js";
import {
  COMPETITION_CLASS,
  assignGroupsWithPrivatePairingRules,
} from "../../features/private-pairing-rules/index.js";
import { validateGroupDrawInput } from "./validationEngine.js";
import { summarizeGroupBalance } from "./seededGroupEngine.js";
import { buildGroupStageSchedule, countGroupStageMatches } from "./scheduleEngine.js";
import { resolveInternalGroupingEntries } from "../../features/tournament/internal/internalTournamentCompetitionUnit.js";

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

  const grouping = resolveInternalGroupingEntries({
    eventType,
    previewEntries: Array.isArray(manualEntries) ? manualEntries : [],
    selectedPlayers,
    pairingOptions,
  });

  if (!grouping.ok) {
    return {
      ok: false,
      errors: [grouping.error || "Không chia được bảng theo đơn vị thi đấu."],
      warnings: pairingOptions.constraintWarnings || [],
      privatePairingError: pairingOptions.privatePairingError || null,
    };
  }

  const entries = grouping.entries;
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

/**
 * Persist-ready draw event: entries + groups only (no RR matches).
 * Schedule is a separate durable business step.
 */
export function buildInternalDrawEventWithoutMatches(plan) {
  if (!plan?.ok || !plan.event) {
    return {
      ok: false,
      error: plan?.errors?.[0] || "Không tạo được kết quả chia bảng.",
      errors: plan?.errors || [],
    };
  }
  return {
    ok: true,
    event: {
      ...plan.event,
      matches: [],
    },
    warnings: plan.warnings || [],
    balance: plan.balance,
    groupCount: (plan.event.groups || []).length,
  };
}

/**
 * Generate group-stage RR matches from already-persisted groups (IT-E2E-002 STEP B).
 * Reuses scheduleEngine — does not invent a second scheduler.
 * Idempotent guard: refuses when group-stage matches already exist.
 */
export function buildInternalScheduleFromPersistedGroups({
  tournament,
  players = [],
  pairingConstraints = [],
  privatePairingRules = [],
  clubId = null,
  competitionClass = COMPETITION_CLASS.INTERNAL,
  envSource,
  seed,
  allowedByPublishedRules = false,
  contextTime,
} = {}) {
  const event = ensureInternalEvent(tournament, tournament?.events?.[0]?.eventType);
  const groups = Array.isArray(event.groups) ? event.groups : [];
  if (!groups.length) {
    return {
      ok: false,
      code: "NO_GROUPS",
      errors: ["Chưa có bảng đấu để tạo lịch."],
    };
  }

  const existingGroupMatches = (event.matches || []).filter(
    (match) => !match?.bracketMatchId
  );
  if (existingGroupMatches.length > 0) {
    return {
      ok: false,
      code: "SCHEDULE_ALREADY_EXISTS",
      errors: ["Lịch vòng bảng đã tồn tại. Không tạo trùng."],
      matchCount: existingGroupMatches.length,
      event,
    };
  }

  const schedule = buildGroupStageSchedule(groups, {
    tournamentId: tournament.id,
    eventId: event.id,
    players,
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
      code: "SCHEDULE_FAILED",
      errors: [
        schedule.privatePairingError?.message ||
          "Không tạo được lịch vòng bảng thỏa quy tắc đối đầu.",
      ],
      privatePairingError: schedule.privatePairingError || null,
    };
  }

  const knockoutMatches = (event.matches || []).filter((match) => match?.bracketMatchId);

  return {
    ok: true,
    event: {
      ...event,
      groups: schedule.groups,
      matches: [...schedule.matches, ...knockoutMatches],
    },
    matchCount: countGroupStageMatches(schedule.groups),
    warnings: schedule.warnings || [],
  };
}
