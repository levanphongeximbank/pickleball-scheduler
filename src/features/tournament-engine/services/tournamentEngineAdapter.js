import { getPlayerGenderKey } from "../../../models/player.js";
import { EVENT_TYPE } from "../../../models/tournament/constants.js";
import { createEntryRecord } from "../../../models/tournament/entry.js";
import {
  DEFAULT_RANKING_RULES,
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_SEED_WEIGHTS,
} from "../constants/defaults.js";
import { enrichParticipantWithRatingV5 } from "../../individual-tournament/adapters/ratingV5SeedAdapter.js";

function playerRating(player) {
  return Number(player?.rating ?? player?.level ?? player?.elo ?? 3.5);
}

function playerElo(player) {
  if (player?.elo != null && Number.isFinite(Number(player.elo))) {
    return Number(player.elo);
  }
  if (player?.clubRating?.elo != null) {
    return Number(player.clubRating.elo);
  }
  return null;
}

function playerWinRate(player) {
  const stats = player?.stats || player?.historyStats || {};
  const played = Number(stats.matchesPlayed ?? stats.games ?? 0);
  const wins = Number(stats.wins ?? stats.won ?? 0);
  if (played <= 0) {
    return null;
  }
  return wins / played;
}

function entryToParticipant(entry, playersById) {
  const playerIds = entry.playerIds || [];
  const members = playerIds.map((id) => playersById.get(String(id))).filter(Boolean);
  const avgSkill =
    members.length > 0
      ? members.reduce((sum, p) => sum + playerRating(p), 0) / members.length
      : playerRating(entry);

  const elos = members.map(playerElo).filter((v) => v != null);
  const avgElo = elos.length ? elos.reduce((a, b) => a + b, 0) / elos.length : null;

  const played = members.reduce(
    (sum, p) => sum + Number(p?.stats?.matchesPlayed ?? p?.stats?.games ?? 0),
    0
  );

  const winRates = members.map(playerWinRate).filter((v) => v != null);
  const avgWinRate = winRates.length
    ? winRates.reduce((a, b) => a + b, 0) / winRates.length
    : null;

  const base = {
    id: String(entry.id),
    name: entry.name,
    playerIds: playerIds.map(String),
    elo: avgElo,
    skillLevel: avgSkill,
    winRate: avgWinRate,
    matchesPlayed: played,
    clubName: entry.clubName || members[0]?.clubName || "",
    gender: members[0] ? getPlayerGenderKey(members[0].gender) : undefined,
    status: entry.status || "active",
    seed: entry.seed ?? null,
    seedScore: entry.seedScore ?? null,
    manualSeedOverride: Boolean(entry.manualSeedOverride),
    unseeded: entry.unseeded ?? false,
  };

  return enrichParticipantWithRatingV5(base, members.length ? members : [entry]);
}

function playersToParticipants(players, eventType, tournamentId, eventId) {
  const filtered = players.filter((player) => {
    if (eventType === EVENT_TYPE.MEN_DOUBLE || eventType === EVENT_TYPE.MEN_SINGLE) {
      return getPlayerGenderKey(player.gender) === "male";
    }
    if (eventType === EVENT_TYPE.WOMEN_DOUBLE || eventType === EVENT_TYPE.WOMEN_SINGLE) {
      return getPlayerGenderKey(player.gender) === "female";
    }
    return true;
  });

  return filtered.map((player) =>
    entryToParticipant(
      createEntryRecord({
        id: `entry-${player.id}`,
        tournamentId,
        eventId,
        name: player.name,
        playerIds: [String(player.id)],
        clubName: player.clubName || "",
        rating: playerRating(player),
        status: player.status || "active",
      }),
      new Map([[String(player.id), player]])
    )
  );
}

export function getPrimaryEvent(tournament) {
  const events = tournament?.events || [];
  return events[0] || null;
}

export function buildEngineContext({
  tournament,
  players = [],
  courts = [],
  selectedPlayerIds = null,
  engineState = null,
} = {}) {
  const event = getPrimaryEvent(tournament);
  const eventId = event?.id || "";
  const eventType = event?.eventType || EVENT_TYPE.MIXED_DOUBLE;
  const playersById = new Map(players.map((p) => [String(p.id), p]));

  let participants;
  if (event?.entries?.length) {
    participants = event.entries.map((entry) => entryToParticipant(entry, playersById));
  } else if (selectedPlayerIds?.length) {
    const selected = players.filter((p) => selectedPlayerIds.includes(String(p.id)));
    participants = playersToParticipants(selected, eventType, tournament.id, eventId);
  } else {
    participants = playersToParticipants(players, eventType, tournament.id, eventId);
  }

  if (engineState?.participants?.length) {
    participants = engineState.participants;
  }

  const settings = tournament?.settings?.engineV4 || {};
  const courtSchedule = tournament?.courtSchedule;
  const schedulePublish = tournament?.settings?.schedule || {};

  return {
    tournamentId: tournament.id,
    clubId: tournament.clubId,
    eventId,
    eventType,
    participants,
    courts: courts.map((court, index) => ({
      id: String(court.id),
      name: court.name || `Sân ${court.number || index + 1}`,
      locked: Boolean(court.locked),
      priority: court.priority ?? courts.length - index,
      availableSessions: court.availableSessions || court.sessions || undefined,
    })),
    groupCount: settings.groupCount ?? engineState?.groupCount ?? 4,
    scheduleConfig: {
      ...DEFAULT_SCHEDULE_CONFIG,
      ...settings.scheduleConfig,
      date: courtSchedule?.date || settings.scheduleConfig?.date || undefined,
      startTime:
        courtSchedule?.startTime ||
        settings.scheduleConfig?.startTime ||
        DEFAULT_SCHEDULE_CONFIG.startTime,
      endTime:
        courtSchedule?.endTime ||
        settings.scheduleConfig?.endTime ||
        DEFAULT_SCHEDULE_CONFIG.endTime,
      minRestMinutes:
        schedulePublish.minRestMinutes ??
        settings.scheduleConfig?.minRestMinutes ??
        settings.scheduleConfig?.restMinutes ??
        DEFAULT_SCHEDULE_CONFIG.minRestMinutes ??
        15,
      sessions: settings.scheduleConfig?.sessions,
    },
    seedWeights: { ...DEFAULT_SEED_WEIGHTS, ...settings.seedWeights },
    rankingRules: { ...DEFAULT_RANKING_RULES, ...settings.rankingRules },
    pointsConfig: settings.pointsConfig || { win: 2, loss: 1, forfeit: 0 },
    groups: engineState?.groups ?? event?.groups ?? [],
    matches: engineState?.matches ?? event?.matches ?? [],
    engineState,
  };
}

export function mergeEngineStateIntoSettings(tournament, engineState) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      engineV4: {
        ...(tournament.settings?.engineV4 || {}),
        ...engineState,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

export function applyEnginePlanToEvent(tournament, plan) {
  const event = getPrimaryEvent(tournament);
  if (!event) {
    return { ok: false, error: "Giải chưa có nội dung thi đấu." };
  }

  const nextEvent = {
    ...event,
    entries: plan.seed?.participants || event.entries,
    groups: plan.draw?.groups || event.groups,
    matches: plan.schedule?.matches || plan.courts?.matches || event.matches,
  };

  const events = [...(tournament.events || [])];
  events[0] = nextEvent;

  return {
    ok: true,
    tournament: {
      ...tournament,
      events,
    },
  };
}

export { entryToParticipant, playersToParticipants };
