import { createEventRecord } from "../../models/tournament/event.js";
import { createEntryRecord } from "../../models/tournament/entry.js";
import {
  EVENT_TYPE,
  OFFICIAL_MODE,
  PAIR_TYPE,
  TOURNAMENT_MODE,
} from "../../models/tournament/constants.js";
import { getPlayerGenderKey } from "../../models/player.js";
import { validateEntryForEvent, validateGroupDrawInput } from "./validationEngine.js";
import { assignEntriesOpenConditional } from "./openConditionalRandomEngine.js";
import { runLegacyDrawWithCanonicalAdapter } from "../../features/competition-core/draw/adapters/drawRuntimeAdapter.js";
import {
  COMPETITION_CLASS,
  assignGroupsWithPrivatePairingRules,
} from "../../features/private-pairing-rules/index.js";
import { summarizeGroupBalance } from "./seededGroupEngine.js";
import { buildGroupStageSchedule, countGroupStageMatches } from "./scheduleEngine.js";
import {
  assignSeedsToEntries,
  suggestBalancedEntriesFromIndividuals,
  suggestEntriesFromPlayers,
} from "./teamPairingEngine.js";

const SINGLE_EVENT_TYPES = new Set([
  EVENT_TYPE.MEN_SINGLE,
  EVENT_TYPE.WOMEN_SINGLE,
]);

const DOUBLE_EVENT_TYPES = new Set([
  EVENT_TYPE.MEN_DOUBLE,
  EVENT_TYPE.WOMEN_DOUBLE,
  EVENT_TYPE.MIXED_DOUBLE,
  EVENT_TYPE.OPEN_DOUBLE,
]);

function inferPairType(playerA, playerB) {
  const clubA = String(playerA?.clubName || "").trim();
  const clubB = String(playerB?.clubName || "").trim();

  if (clubA && clubB && clubA !== clubB) {
    return PAIR_TYPE.MIXED_CLUB;
  }

  const visitorTypes = new Set(["guest", "visitor", "external"]);
  const typeA = String(playerA?.playerType || "").toLowerCase();
  const typeB = String(playerB?.playerType || "").toLowerCase();

  if (visitorTypes.has(typeA) || visitorTypes.has(typeB)) {
    return PAIR_TYPE.VISITOR_PAIR;
  }

  return PAIR_TYPE.SAME_CLUB;
}

export function stripOpenEntryMetadata(entry) {
  return {
    ...entry,
    rating: 0,
    seed: null,
  };
}

export function createOpenEntryFromPlayer(player, options = {}) {
  return stripOpenEntryMetadata(
    createEntryRecord({
      id: `entry-${player.id}`,
      tournamentId: options.tournamentId || "",
      eventId: options.eventId || "",
      name: player.name,
      playerIds: [String(player.id)],
      clubName: player.clubName || options.clubName || "",
      unitName: player.unitName || options.unitName || "",
      representativeClubName: player.clubName || options.clubName || "",
      pairType: PAIR_TYPE.SAME_CLUB,
      status: "active",
    })
  );
}

export function createOpenEntryFromPair(playerA, playerB, options = {}) {
  const ids = [String(playerA.id), String(playerB.id)].sort();
  const clubName =
    options.clubName || playerA.clubName || playerB.clubName || "";

  return stripOpenEntryMetadata(
    createEntryRecord({
      id: ids.join("|"),
      tournamentId: options.tournamentId || "",
      eventId: options.eventId || "",
      name: `${playerA.name} / ${playerB.name}`,
      playerIds: ids,
      clubName,
      unitName: options.unitName || playerA.unitName || playerB.unitName || "",
      representativeClubName: clubName,
      pairType: inferPairType(playerA, playerB),
      status: "active",
    })
  );
}

export function ensureOfficialEvent(tournament, eventType = EVENT_TYPE.MEN_DOUBLE, eventId = null) {
  return resolveOfficialEventForPlan(tournament, { eventId, eventType });
}

export function resolveOfficialEventForPlan(tournament, { eventId = null, eventType = EVENT_TYPE.MEN_DOUBLE } = {}) {
  const events = Array.isArray(tournament?.events) ? tournament.events : [];

  if (eventId) {
    const found = events.find((event) => String(event.id) === String(eventId));
    if (found) {
      return {
        ...found,
        eventType: found.eventType || eventType,
      };
    }
  }

  const sameType = events.find((event) => event.eventType === eventType);
  if (sameType) {
    return sameType;
  }

  if (events.length === 0) {
    return createOfficialEventRecord(tournament, { eventType });
  }

  return createOfficialEventRecord(tournament, { eventType });
}

export function createOfficialEventRecord(tournament, options = {}) {
  const eventType = options.eventType || EVENT_TYPE.MEN_DOUBLE;
  const label =
    options.name ||
    EVENT_OPTIONS_LABELS[eventType] ||
    `Noi dung ${(tournament?.events?.length || 0) + 1}`;

  return createEventRecord({
    id: options.id || `event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tournamentId: tournament?.id || "",
    name: label,
    eventType,
    entries: [],
    groups: [],
    matches: [],
    standings: [],
    bracket: null,
    status: "draft",
  });
}

const EVENT_OPTIONS_LABELS = {
  [EVENT_TYPE.MEN_SINGLE]: "Don nam",
  [EVENT_TYPE.WOMEN_SINGLE]: "Don nu",
  [EVENT_TYPE.MEN_DOUBLE]: "Doi nam",
  [EVENT_TYPE.WOMEN_DOUBLE]: "Doi nu",
  [EVENT_TYPE.MIXED_DOUBLE]: "Doi nam nu",
  [EVENT_TYPE.OPEN_DOUBLE]: "Doi tu do",
};

export function upsertOfficialEvent(events = [], event) {
  const list = Array.isArray(events) ? [...events] : [];
  const index = list.findIndex((item) => String(item.id) === String(event.id));

  if (index < 0) {
    return [...list, event];
  }

  const next = [...list];
  next[index] = event;
  return next;
}

export function removeOfficialEvent(events = [], eventId) {
  return (events || []).filter((event) => String(event.id) !== String(eventId));
}

export function isSingleEventType(eventType) {
  return SINGLE_EVENT_TYPES.has(eventType);
}

export function isDoubleEventType(eventType) {
  return DOUBLE_EVENT_TYPES.has(eventType);
}

export function validateOpenRegistrationPlayers(players = [], eventType) {
  const errors = [];

  players.forEach((player) => {
    const gender = getPlayerGenderKey(player.gender);

    if (eventType === EVENT_TYPE.MEN_SINGLE || eventType === EVENT_TYPE.MEN_DOUBLE) {
      if (gender !== "male") {
        errors.push(`${player.name} khong phu hop noi dung nam.`);
      }
    }

    if (eventType === EVENT_TYPE.WOMEN_SINGLE || eventType === EVENT_TYPE.WOMEN_DOUBLE) {
      if (gender !== "female") {
        errors.push(`${player.name} khong phu hop noi dung nu.`);
      }
    }
  });

  if (isDoubleEventType(eventType) && players.length === 2) {
    const entryCheck = validateEntryForEvent(
      {
        name: `${players[0].name} / ${players[1].name}`,
        playerIds: players.map((player) => String(player.id)),
      },
      players,
      eventType
    );
    if (!entryCheck.ok) {
      errors.push(...entryCheck.errors);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function buildOfficialOpenPlan({
  tournament,
  entries = [],
  eventType = EVENT_TYPE.MEN_DOUBLE,
  eventId = null,
  groupCount = 4,
  players = [],
  splitUnits = true,
  randomFn,
  privatePairingRules = [],
  clubId = null,
  competitionClass = COMPETITION_CLASS.OFFICIAL,
  envSource,
  seed,
  allowedByPublishedRules = false,
  contextTime,
  pairingConstraints = [],
  pointsConfig = { win: 2, loss: 1, forfeit: 0 },
} = {}) {
  const event = ensureOfficialEvent(tournament, eventType, eventId);
  const normalizedEntries = entries.map(stripOpenEntryMetadata);
  const playersById = new Map(players.map((player) => [String(player.id), player]));

  const validation = validateGroupDrawInput({
    entries: normalizedEntries,
    players,
    eventType,
    groupCount,
    courtCount: 1,
    tournamentMode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
  });

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const draw = runLegacyDrawWithCanonicalAdapter({
    consumer: "official_open",
    strategyKey: "official_open",
    legacyPayload: {
      tournamentId: tournament.id,
      eventId: event.id,
      entries: normalizedEntries,
      groupCount,
      options: {
        hostClubName: tournament.hostClubName || tournament.settings?.hostClubName || "",
        splitUnits,
        playersById,
        randomFn,
        pointsConfig,
      },
    },
    legacyExecutor: (payload) =>
      assignEntriesOpenConditional(payload.entries, payload.groupCount, payload.options),
  });

  if (!draw.ok) {
    return {
      ok: false,
      errors: draw.errors || ["Khong the chia bang open."],
      warnings: draw.warnings || [],
    };
  }

  const groups = draw.groups.map((group) => ({
    ...group,
    tournamentId: tournament.id,
    eventId: event.id,
    pointsConfig,
  }));

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
      errors: [
        schedule.privatePairingError?.message ||
          "Không tạo được lịch vòng bảng thỏa quy tắc đối đầu.",
      ],
      warnings: [...validation.warnings, ...draw.warnings],
      privatePairingError: schedule.privatePairingError || null,
    };
  }

  return {
    ok: true,
    event: {
      ...event,
      eventType,
      entries: normalizedEntries,
      groups: schedule.groups,
      matches: schedule.matches,
    },
    warnings: [...validation.warnings, ...draw.warnings],
    balance: draw.balance,
    matchCount: countGroupStageMatches(schedule.groups),
    drawScore: draw.score,
    privatePairingError: null,
  };
}

export function applyOfficialOpenPlan(tournament, plan) {
  if (!plan?.ok || !plan.event) {
    return {
      ok: false,
      error: plan?.errors?.[0] || "Khong the ap dung ke hoach giai open.",
      errors: plan?.errors || [],
    };
  }

  const events = upsertOfficialEvent(tournament.events || [], plan.event);

  return {
    ok: true,
    tournament: {
      ...tournament,
      officialMode: OFFICIAL_MODE.OPEN,
      events,
    },
    event: plan.event,
    warnings: plan.warnings || [],
    balance: plan.balance,
    matchCount: plan.matchCount,
    drawScore: plan.drawScore,
  };
}

export function buildOfficialOpenPatch(tournament, plan) {
  const applied = applyOfficialOpenPlan(tournament, plan);
  if (!applied.ok) {
    return applied;
  }

  return {
    ok: true,
    events: applied.tournament.events,
    officialMode: OFFICIAL_MODE.OPEN,
    warnings: applied.warnings,
    balance: applied.balance,
    matchCount: applied.matchCount,
    drawScore: applied.drawScore,
    event: applied.event,
  };
}

export function buildOfficialAiBalancePlan({
  tournament,
  eventId = null,
  players = [],
  selectedPlayerIds = [],
  eventType = EVENT_TYPE.MEN_DOUBLE,
  groupCount = 2,
  manualEntries = null,
  individualRegistration = true,
  pairingConstraints = [],
  privatePairingRules = [],
  clubId = null,
  competitionClass = COMPETITION_CLASS.OFFICIAL,
  envSource,
  seed,
  allowedByPublishedRules = false,
  contextTime,
  pointsConfig = { win: 2, loss: 1, forfeit: 0 },
} = {}) {
  const event = ensureOfficialEvent(tournament, eventType, eventId);
  const selectedPlayers = players.filter((player) =>
    selectedPlayerIds.includes(String(player.id))
  );

  const pairingOptions = {
    tournamentId: tournament.id,
    eventId: event.id,
    mode: "skill_controlled",
    pairingConstraints,
    privatePairingRules,
    clubId,
    competitionClass,
    envSource,
    seed,
    allowedByPublishedRules,
    contextTime,
  };

  const baseEntries =
    Array.isArray(manualEntries) && manualEntries.length > 0
      ? manualEntries
      : individualRegistration
        ? suggestBalancedEntriesFromIndividuals(selectedPlayers, eventType, pairingOptions)
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

  const entries = assignSeedsToEntries(baseEntries, selectedPlayers);

  const validation = validateGroupDrawInput({
    entries,
    players: selectedPlayers,
    eventType,
    groupCount,
    courtCount: 1,
    tournamentMode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.AI_BALANCE,
  });

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const groupResult = runLegacyDrawWithCanonicalAdapter({
    consumer: "official_ai_balance",
    strategyKey: "official_ai_balance",
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
      name: event.name || EVENT_OPTIONS_LABELS[eventType] || event.name,
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

export function applyOfficialAiBalancePlan(tournament, plan) {
  if (!plan?.ok || !plan.event) {
    return {
      ok: false,
      error: plan?.errors?.[0] || "Khong the ap dung ke hoach AI Balance.",
      errors: plan?.errors || [],
    };
  }

  const events = upsertOfficialEvent(tournament.events || [], plan.event);

  return {
    ok: true,
    tournament: {
      ...tournament,
      officialMode: OFFICIAL_MODE.AI_BALANCE,
      events,
    },
    event: plan.event,
    warnings: plan.warnings || [],
    balance: plan.balance,
    matchCount: plan.matchCount,
  };
}

export function buildOfficialAiBalancePatch(tournament, plan) {
  const applied = applyOfficialAiBalancePlan(tournament, plan);
  if (!applied.ok) {
    return applied;
  }

  return {
    ok: true,
    events: applied.tournament.events,
    officialMode: OFFICIAL_MODE.AI_BALANCE,
    warnings: applied.warnings,
    balance: applied.balance,
    matchCount: applied.matchCount,
    event: applied.event,
  };
}
