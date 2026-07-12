#!/usr/bin/env node
/**
 * TT-7 QA oracle — independent expected standings calculator.
 * Does NOT import teamStandingsEngine.js (by design).
 *
 * Usage:
 *   node scripts/qa/calculate-expected-team-standings.mjs <fixture.json>
 *   node scripts/qa/calculate-expected-team-standings.mjs --write <fixture.json> <output.json>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const MATCHUP_STATUS = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
};

export const DEFAULT_TIE_BREAK_ORDER = [
  "wins",
  "subMatchDiff",
  "pointsScored",
  "manual",
];

function emptyStanding(teamId) {
  return {
    teamId,
    rank: 0,
    played: 0,
    wins: 0,
    losses: 0,
    subMatchWins: 0,
    subMatchLosses: 0,
    subMatchDiff: 0,
    pointsScored: 0,
    pointsConceded: 0,
    pointDiff: 0,
    rankingPoints: 0,
    withdrawn: false,
    forfeitLosses: 0,
    forfeitWins: 0,
  };
}

function headToHeadWinner(teamAId, teamBId, matchups = []) {
  const direct = matchups.find(
    (matchup) =>
      matchup.result?.winnerTeamId &&
      ((matchup.teamAId === teamAId && matchup.teamBId === teamBId) ||
        (matchup.teamAId === teamBId && matchup.teamBId === teamAId))
  );
  return direct?.result?.winnerTeamId || "";
}

function compareByTiebreak(left, right, tiebreakKey, matchups) {
  switch (tiebreakKey) {
    case "wins":
      return right.wins - left.wins;
    case "subMatchDiff":
      return right.subMatchDiff - left.subMatchDiff;
    case "pointsScored":
      return right.pointsScored - left.pointsScored;
    case "pointDiff":
      return right.pointDiff - left.pointDiff;
    case "headToHead": {
      const winner = headToHeadWinner(left.teamId, right.teamId, matchups);
      if (winner === left.teamId) return -1;
      if (winner === right.teamId) return 1;
      return 0;
    }
    case "manual":
    default:
      return String(left.teamId).localeCompare(String(right.teamId));
  }
}

function isMatchupCountable(matchup) {
  const result = matchup.result;
  if (!result) return false;

  const hasSubMatchResults =
    (result.teamAWins || 0) + (result.teamBWins || 0) > 0;
  const isCompleted =
    matchup.status === MATCHUP_STATUS.COMPLETED && Boolean(result.winnerTeamId);

  return hasSubMatchResults || isCompleted;
}

/**
 * @param {object} fixture
 * @param {object} [options]
 * @param {string[]} [options.tiebreakOrder]
 * @param {boolean} [options.excludeWithdrawnFromRanking]
 */
export function calculateExpectedStandings(fixture, options = {}) {
  const teams = fixture.teams || [];
  const includeExhibition = options.includeExhibition ?? false;
  const matchups = [
    ...(fixture.matchups || []),
    ...(includeExhibition ? fixture.exhibitionMatchups || [] : []),
  ].filter((matchup) => matchup.activeForStandings !== false);
  const tiebreakOrder =
    options.tiebreakOrder ||
    fixture.settings?.tiebreakOrder ||
    DEFAULT_TIE_BREAK_ORDER;

  const teamNameById = new Map(teams.map((t) => [t.id, t.name || t.id]));
  const withdrawnIds = new Set(
    teams.filter((t) => t.withdrawn).map((t) => t.id)
  );

  const standingsMap = new Map();
  teams.forEach((team) => {
    const row = emptyStanding(team.id);
    row.withdrawn = Boolean(team.withdrawn);
    standingsMap.set(team.id, row);
  });

  matchups.forEach((matchup) => {
    if (!isMatchupCountable(matchup)) return;

    const result = matchup.result;
    const teamA = standingsMap.get(matchup.teamAId) || emptyStanding(matchup.teamAId);
    const teamB = standingsMap.get(matchup.teamBId) || emptyStanding(matchup.teamBId);

    const hasSubMatchResults =
      (result.teamAWins || 0) + (result.teamBWins || 0) > 0;
    const isCompleted =
      matchup.status === MATCHUP_STATUS.COMPLETED && Boolean(result.winnerTeamId);

    if (hasSubMatchResults) {
      teamA.subMatchWins += result.teamAWins || 0;
      teamA.subMatchLosses += result.teamBWins || 0;
      teamB.subMatchWins += result.teamBWins || 0;
      teamB.subMatchLosses += result.teamAWins || 0;

      teamA.pointsScored += result.teamAPoints || 0;
      teamA.pointsConceded += result.teamBPoints || 0;
      teamB.pointsScored += result.teamBPoints || 0;
      teamB.pointsConceded += result.teamAPoints || 0;

      teamA.subMatchDiff = teamA.subMatchWins - teamA.subMatchLosses;
      teamB.subMatchDiff = teamB.subMatchWins - teamB.subMatchLosses;
      teamA.pointDiff = teamA.pointsScored - teamA.pointsConceded;
      teamB.pointDiff = teamB.pointsScored - teamB.pointsConceded;
    }

    if (isCompleted) {
      teamA.played += 1;
      teamB.played += 1;

      if (result.forfeit || result.resultType === "forfeit") {
        const forfeitingTeamId =
          result.forfeitingTeamId ||
          (result.winnerTeamId === matchup.teamAId
            ? matchup.teamBId
            : matchup.teamAId);

        if (forfeitingTeamId === matchup.teamAId) {
          teamA.forfeitLosses += 1;
          teamB.forfeitWins += 1;
        } else if (forfeitingTeamId === matchup.teamBId) {
          teamB.forfeitLosses += 1;
          teamA.forfeitWins += 1;
        }
      }

      if (result.winnerTeamId === matchup.teamAId) {
        teamA.wins += 1;
        teamB.losses += 1;
        teamA.rankingPoints += 2;
        teamB.rankingPoints += 1;
      } else if (result.winnerTeamId === matchup.teamBId) {
        teamB.wins += 1;
        teamA.losses += 1;
        teamB.rankingPoints += 2;
        teamA.rankingPoints += 1;
      }
    }

    standingsMap.set(matchup.teamAId, teamA);
    standingsMap.set(matchup.teamBId, teamB);
  });

  let standings = [...standingsMap.values()];

  if (options.excludeWithdrawnFromRanking) {
    standings = standings.filter((row) => !withdrawnIds.has(row.teamId));
  }

  standings.sort((left, right) => {
    for (const tiebreakKey of tiebreakOrder) {
      const delta = compareByTiebreak(left, right, tiebreakKey, matchups);
      if (delta !== 0) return delta;
    }
    return 0;
  });

  const ranked = standings.map((standing, index) => ({
    ...standing,
    rank: index + 1,
    teamName: teamNameById.get(standing.teamId) || standing.teamId,
  }));

  return {
    fixtureId: fixture.meta?.fixtureId || fixture.fixtureId || "unknown",
    generatedAt: new Date().toISOString(),
    tiebreakOrder,
    standings: ranked,
    summary: {
      teamCount: teams.length,
      matchupCount: matchups.length,
      completedMatchups: matchups.filter((m) => m.status === MATCHUP_STATUS.COMPLETED).length,
      incompleteMatchups: matchups.filter((m) => m.status !== MATCHUP_STATUS.COMPLETED).length,
      withdrawnTeams: [...withdrawnIds],
    },
  };
}

export function calculateTiebreakProfiles(fixture, profiles = {}) {
  const output = {};
  for (const [profileName, config] of Object.entries(profiles)) {
    output[profileName] = calculateExpectedStandings(fixture, {
      tiebreakOrder: config.tiebreakOrder,
      excludeWithdrawnFromRanking: config.excludeWithdrawnFromRanking ?? false,
    });
  }
  return output;
}

export function loadFixture(path) {
  const raw = readFileSync(resolve(path), "utf8");
  return JSON.parse(raw);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: node calculate-expected-team-standings.mjs [--write] <fixture.json> [output.json]"
    );
    process.exit(1);
  }

  let writeMode = false;
  let positional = args;
  if (args[0] === "--write") {
    writeMode = true;
    positional = args.slice(1);
  }

  const fixturePath = positional[0];
  const fixture = loadFixture(fixturePath);
  const result = calculateExpectedStandings(fixture);

  if (writeMode && positional[1]) {
    const profiles = fixture.expectedProfiles || {};
    const payload = {
      fixtureId: result.fixtureId,
      generatedAt: result.generatedAt,
      default: result,
      profiles:
        Object.keys(profiles).length > 0
          ? calculateTiebreakProfiles(fixture, profiles)
          : {},
      scenarios: fixture.scenarios || [],
    };
    writeFileSync(resolve(positional[1]), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Wrote ${positional[1]}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
