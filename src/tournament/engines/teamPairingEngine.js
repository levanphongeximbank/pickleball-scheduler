import { createTeamsFromPlayers } from "../../pages/tournament.seeding.logic.js";
import { getPlayerGenderKey } from "../../models/player.js";
import { EVENT_TYPE } from "../../models/tournament/constants.js";
import { createEntryRecord } from "../../models/tournament/entry.js";

function playerRating(player) {
  return Number(player?.rating ?? player?.level ?? 3.5);
}

function sortByRatingDesc(players = []) {
  return [...players].sort((a, b) => playerRating(b) - playerRating(a));
}

export function filterPlayersForEventType(players = [], eventType) {
  if (eventType === EVENT_TYPE.MEN_DOUBLE) {
    return players.filter((player) => getPlayerGenderKey(player.gender) === "male");
  }

  if (eventType === EVENT_TYPE.MEN_SINGLE) {
    return players.filter((player) => getPlayerGenderKey(player.gender) === "male");
  }

  if (eventType === EVENT_TYPE.WOMEN_SINGLE) {
    return players.filter((player) => getPlayerGenderKey(player.gender) === "female");
  }

  if (eventType === EVENT_TYPE.WOMEN_DOUBLE) {
    return players.filter((player) => getPlayerGenderKey(player.gender) === "female");
  }

  if (eventType === EVENT_TYPE.MIXED_DOUBLE) {
    return players.filter((player) => {
      const gender = getPlayerGenderKey(player.gender);
      return gender === "male" || gender === "female";
    });
  }

  return players;
}

export function createMixedPairsFromPlayers(players = []) {
  const males = sortByRatingDesc(
    players.filter((player) => getPlayerGenderKey(player.gender) === "male")
  );
  const females = sortByRatingDesc(
    players.filter((player) => getPlayerGenderKey(player.gender) === "female")
  );

  const pairCount = Math.min(males.length, females.length);
  const teams = [];

  for (let index = 0; index < pairCount; index += 1) {
    const male = males[index];
    const female = females[pairCount - 1 - index];
    const members = [male, female];
    const avgLevel =
      members.reduce((sum, player) => sum + playerRating(player), 0) / members.length;

    teams.push({
      id: [male.id, female.id].map(String).sort().join("|"),
      name: `${male.name} / ${female.name}`,
      members,
      avgLevel: Math.round(avgLevel * 100) / 100,
    });
  }

  return teams;
}

export function suggestTeamsFromPlayers(players = [], eventType, options = {}) {
  const filtered = filterPlayersForEventType(players, eventType);
  const mode = options.mode || "skill_controlled";

  if (eventType === EVENT_TYPE.MIXED_DOUBLE) {
    return createMixedPairsFromPlayers(filtered);
  }

  return createTeamsFromPlayers(filtered, {
    mode,
    teamSize: 2,
  });
}

export function teamToEntry(team, options = {}) {
  const members = team.members || [];
  const rating = members.reduce((sum, player) => sum + playerRating(player), 0);

  return createEntryRecord({
    id: team.id,
    tournamentId: options.tournamentId || "",
    eventId: options.eventId || "",
    name: team.name,
    playerIds: members.map((player) => String(player.id)),
    rating: Math.round(rating * 100) / 100,
    seed: options.seed ?? null,
  });
}

export function suggestEntriesFromPlayers(players = [], eventType, options = {}) {
  if (isSingleEventType(eventType)) {
    return createSingleEntriesFromPlayers(players, eventType, options);
  }

  const teams = suggestTeamsFromPlayers(players, eventType, options);

  return teams.map((team, index) =>
    teamToEntry(team, {
      tournamentId: options.tournamentId,
      eventId: options.eventId,
      seed: index + 1,
    })
  );
}

export function entriesToTeams(entries = [], players = []) {
  const playersById = new Map(players.map((player) => [String(player.id), player]));

  return entries.map((entry) => {
    const members = (entry.playerIds || [])
      .map((id) => playersById.get(String(id)))
      .filter(Boolean);

    return {
      id: entry.id,
      name: entry.name,
      members,
      avgLevel:
        members.length > 0
          ? members.reduce((sum, player) => sum + playerRating(player), 0) / members.length
          : Number(entry.rating || 0) / 2,
    };
  });
}

export function calculateEntryRating(entry, players = []) {
  const playersById = new Map(players.map((player) => [String(player.id), player]));
  const members = (entry.playerIds || [])
    .map((id) => playersById.get(String(id)))
    .filter(Boolean);

  if (members.length === 0) {
    return Number(entry.rating || 0);
  }

  return members.reduce((sum, player) => sum + playerRating(player), 0);
}

export function assignSeedsToEntries(entries = [], players = []) {
  const sorted = [...entries].sort(
    (a, b) => calculateEntryRating(b, players) - calculateEntryRating(a, players)
  );

  return sorted.map((entry, index) => ({
    ...entry,
    rating: Math.round(calculateEntryRating(entry, players) * 100) / 100,
    seed: index + 1,
  }));
}

export function createSingleEntriesFromPlayers(players = [], eventType, options = {}) {
  const filtered = filterPlayersForEventType(players, eventType);

  const entries = filtered.map((player) =>
    createEntryRecord({
      id: `entry-${player.id}`,
      tournamentId: options.tournamentId || "",
      eventId: options.eventId || "",
      name: player.name,
      playerIds: [String(player.id)],
      clubName: player.clubName || "",
      unitName: player.unitName || "",
      representativeClubName: player.clubName || "",
      rating: playerRating(player),
      seed: null,
      status: "active",
    })
  );

  return assignSeedsToEntries(entries, filtered);
}

export function suggestBalancedEntriesFromIndividuals(
  players = [],
  eventType,
  options = {}
) {
  if (isSingleEventType(eventType)) {
    return createSingleEntriesFromPlayers(players, eventType, options);
  }

  return suggestEntriesFromPlayers(players, eventType, {
    ...options,
    mode: "skill_controlled",
  });
}

function isSingleEventType(eventType) {
  return eventType === EVENT_TYPE.MEN_SINGLE || eventType === EVENT_TYPE.WOMEN_SINGLE;
}
