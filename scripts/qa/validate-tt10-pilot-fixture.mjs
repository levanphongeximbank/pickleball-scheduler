#!/usr/bin/env node
/**
 * TT-10 read-only pilot fixture validator.
 * Usage: node scripts/qa/validate-tt10-pilot-fixture.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const FIXTURE_DIR = resolve(ROOT, "docs/v5/qa/team-tournament/fixtures");
const FALLBACK_DIR = resolve(ROOT, "docs/v5/qa/team-tournament/fallback");

const GENDERS = new Set(["male", "female", "Nam", "Nữ"]);
const TERMINAL_RESULT_STATUSES = new Set(["confirmed", "forfeit"]);
const EXPECTED_SCENARIO_IDS = Array.from({ length: 15 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`);

function load(name, dir = FIXTURE_DIR) {
  return JSON.parse(readFileSync(resolve(dir, name), "utf8"));
}

function fail(errors, code, message) {
  errors.push({ code, message });
}

function isMale(gender) {
  return gender === "male" || gender === "Nam";
}

function isFemale(gender) {
  return gender === "female" || gender === "Nữ";
}

function resolveLineupTeamId(templateKey) {
  if (templateKey === "team-d-valid" || templateKey === "team-d-invalid-first") {
    return "team-d";
  }
  return templateKey;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (cols[index] ?? "").trim();
    });
    return row;
  });
}

function readCsvFile(path) {
  if (!existsSync(path)) {
    return null;
  }
  return parseCsv(readFileSync(path, "utf8"));
}

function disciplineKind(disciplineId) {
  if (disciplineId === "disc-md") return "md";
  if (disciplineId === "disc-wd") return "wd";
  if (disciplineId.startsWith("disc-mx")) return "mixed";
  return "unknown";
}

function validateDisciplineEligibility(disciplineId, playerIds, playerById, errors, label) {
  const players = playerIds.map((id) => playerById.get(id)).filter(Boolean);
  if (players.length !== playerIds.length) {
    fail(errors, "LINEUP_PLAYER_MISSING", `${label}: lineup references missing player`);
    return;
  }

  const kind = disciplineKind(disciplineId);
  if (kind === "md") {
    if (!players.every((player) => isMale(player.gender))) {
      fail(errors, "LINEUP_GENDER_MD", `${label}: MD requires two male players`);
    }
  } else if (kind === "wd") {
    if (!players.every((player) => isFemale(player.gender))) {
      fail(errors, "LINEUP_GENDER_WD", `${label}: WD requires two female players`);
    }
  } else if (kind === "mixed") {
    const males = players.filter((player) => isMale(player.gender)).length;
    const females = players.filter((player) => isFemale(player.gender)).length;
    if (males !== 1 || females !== 1) {
      fail(errors, "LINEUP_GENDER_MIXED", `${label}: mixed discipline requires one male and one female`);
    }
  } else {
    fail(errors, "LINEUP_DISCIPLINE_UNKNOWN", `${label}: unknown discipline ${disciplineId}`);
  }
}

export function validateLineupTemplateRules({
  templateKey,
  lineup,
  teamById,
  playerById,
  disciplineIds,
  policy = {},
}) {
  const violations = [];
  const teamId = resolveLineupTeamId(templateKey);
  const label = `lineupTemplates.${templateKey}`;

  if (!teamById.has(teamId)) {
    violations.push({ code: "LINEUP_TEAM", message: `${label}: team ${teamId} does not exist` });
    return violations;
  }

  const ignoredKeys = new Set(["validationError", "expectedRejectionCode"]);
  const entries = Object.entries(lineup).filter(([key]) => !ignoredKeys.has(key));
  const requiredDisciplines = policy.requiredDisciplineIds || disciplineIds;

  for (const disciplineId of requiredDisciplines) {
    if (!lineup[disciplineId]) {
      violations.push({
        code: "LINEUP_MISSING_DISCIPLINE",
        message: `${label}: missing required discipline ${disciplineId}`,
      });
    }
  }

  for (const [disciplineId, playerIds] of entries) {
    if (!disciplineIds.includes(disciplineId)) {
      violations.push({
        code: "LINEUP_INVALID_DISCIPLINE",
        message: `${label}: invalid discipline ${disciplineId}`,
      });
      continue;
    }

    if (!Array.isArray(playerIds)) {
      violations.push({
        code: "LINEUP_SHAPE",
        message: `${label}: discipline ${disciplineId} must be player id array`,
      });
      continue;
    }

    const expectedCount = policy.playersPerDiscipline ?? 2;
    if (playerIds.length !== expectedCount) {
      violations.push({
        code: "LINEUP_PLAYER_COUNT",
        message: `${label}: discipline ${disciplineId} expects ${expectedCount} players`,
      });
    }

    const unique = new Set(playerIds);
    if (unique.size !== playerIds.length) {
      violations.push({
        code: "LINEUP_DUPLICATE_PLAYER",
        message: `${label}: duplicate player within discipline ${disciplineId}`,
      });
    }

    for (const playerId of playerIds) {
      const player = playerById.get(playerId);
      if (!player) {
        violations.push({
          code: "LINEUP_PLAYER_UNKNOWN",
          message: `${label}: unknown player ${playerId}`,
        });
        continue;
      }
      if (player.teamId !== teamId) {
        violations.push({
          code: "LINEUP_PLAYER_TEAM",
          message: `${label}: player ${playerId} is not on team ${teamId}`,
        });
      }
    }

    const fakeErrors = [];
    validateDisciplineEligibility(disciplineId, playerIds, playerById, fakeErrors, label);
    fakeErrors.forEach((error) => violations.push(error));
  }

  if (policy.disallowMixedDisciplinePlayerReuse !== false) {
    const mx1 = new Set(lineup["disc-mx1"] || []);
    const mx2 = new Set(lineup["disc-mx2"] || []);
    const overlap = [...mx1].filter((playerId) => mx2.has(playerId));
    if (overlap.length > 0) {
      violations.push({
        code: "LINEUP_MIXED_REUSE",
        message: `${label}: player reuse across mixed disciplines (${overlap.join(", ")})`,
      });
    }
  }

  return violations;
}

function resolveActor(actor, users) {
  if (!actor || actor === "system") {
    return { ok: true, actor };
  }
  const aliases = users.actorAliases || {};
  const accountId = aliases[actor] ?? actor;
  if (accountId === null) {
    return { ok: true, actor };
  }
  const account = (users.accounts || []).find((entry) => entry.fixtureAccountId === accountId);
  if (!account) {
    return { ok: false, actor, accountId };
  }
  return { ok: true, actor, accountId, account };
}

function validateCsvSync(tournament, users, errors, fallbackDir) {
  const teamsCsv = readCsvFile(resolve(fallbackDir, "teams.csv"));
  const playersCsv = readCsvFile(resolve(fallbackDir, "players.csv"));
  const scheduleCsv = readCsvFile(resolve(fallbackDir, "schedule.csv"));
  const lineupsCsv = readCsvFile(resolve(fallbackDir, "lineups.csv"));
  const resultsCsv = readCsvFile(resolve(fallbackDir, "results.csv"));
  const usersCsv = readCsvFile(resolve(fallbackDir, "users.csv"));

  if (!teamsCsv || !playersCsv || !scheduleCsv || !lineupsCsv || !resultsCsv || !usersCsv) {
    fail(errors, "CSV_MISSING", "One or more required fallback CSV files are missing");
    return;
  }

  if (teamsCsv.length !== (tournament.teams || []).length) {
    fail(errors, "CSV_TEAMS_COUNT", `teams.csv count ${teamsCsv.length} != JSON ${tournament.teams.length}`);
  }

  for (const team of tournament.teams || []) {
    const row = teamsCsv.find((entry) => entry.team_id === team.id);
    if (!row) {
      fail(errors, "CSV_TEAM_ID", `teams.csv missing team ${team.id}`);
      continue;
    }
    if (row.team_code !== team.code || row.captain_player_id !== team.captainPlayerId) {
      fail(errors, "CSV_TEAM_DRIFT", `teams.csv drift for ${team.id}`);
    }
  }

  if (playersCsv.length !== (tournament.players || []).length) {
    fail(errors, "CSV_PLAYERS_COUNT", `players.csv count ${playersCsv.length} != JSON ${tournament.players.length}`);
  }

  for (const player of tournament.players || []) {
    const row = playersCsv.find((entry) => entry.player_id === player.id);
    if (!row) {
      fail(errors, "CSV_PLAYER_ID", `players.csv missing player ${player.id}`);
      continue;
    }
    if (row.team_id !== player.teamId || row.gender !== player.gender) {
      fail(errors, "CSV_PLAYER_DRIFT", `players.csv drift for ${player.id}`);
    }
  }

  if (scheduleCsv.length !== (tournament.matchups || []).length) {
    fail(errors, "CSV_SCHEDULE_COUNT", `schedule.csv count ${scheduleCsv.length} != JSON ${tournament.matchups.length}`);
  }

  for (const matchup of tournament.matchups || []) {
    const row = scheduleCsv.find((entry) => entry.matchup_id === matchup.id);
    if (!row) {
      fail(errors, "CSV_MATCHUP_ID", `schedule.csv missing matchup ${matchup.id}`);
      continue;
    }
    if (row.team_a_id !== matchup.teamAId || row.team_b_id !== matchup.teamBId || row.court_id !== matchup.courtId) {
      fail(errors, "CSV_SCHEDULE_DRIFT", `schedule.csv drift for ${matchup.id}`);
    }
  }

  if (usersCsv.length !== (users.accounts || []).length) {
    fail(errors, "CSV_USERS_COUNT", `users.csv count ${usersCsv.length} != JSON ${users.accounts.length}`);
  }

  for (const account of users.accounts || []) {
    const row = usersCsv.find((entry) => entry.fixture_account_id === account.fixtureAccountId);
    if (!row) {
      fail(errors, "CSV_USER_ID", `users.csv missing account ${account.fixtureAccountId}`);
      continue;
    }
    if (row.role !== account.role) {
      fail(errors, "CSV_USER_DRIFT", `users.csv drift for ${account.fixtureAccountId}`);
    }
  }

  const jsonLineupRows = [];
  for (const [templateKey, lineup] of Object.entries(tournament.lineupTemplates || {})) {
    if (templateKey.endsWith("-invalid-first")) {
      continue;
    }
    const teamId = resolveLineupTeamId(templateKey);
    for (const [disciplineId, playerIds] of Object.entries(lineup)) {
      if (disciplineId === "validationError" || !Array.isArray(playerIds)) {
        continue;
      }
      jsonLineupRows.push({
        matchup_id: templateKey === "team-a" || templateKey === "team-b" ? "m-ab" : "m-cd",
        team_id: teamId,
        discipline_id: disciplineId,
        player_1_id: playerIds[0],
        player_2_id: playerIds[1],
      });
    }
  }

  for (const row of lineupsCsv) {
    const jsonRow = jsonLineupRows.find(
      (entry) =>
        entry.team_id === row.team_id &&
        entry.discipline_id === row.discipline_id &&
        entry.player_1_id === row.player_1_id &&
        entry.player_2_id === row.player_2_id
    );
    if (!jsonRow && (row.matchup_id === "m-ab" || row.matchup_id === "m-cd")) {
      fail(errors, "CSV_LINEUP_DRIFT", `lineups.csv row not represented in JSON templates (${row.team_id}/${row.discipline_id})`);
    }
  }

  const catalog = tournament.resultsCatalog || {};
  const catalogRows = [];
  for (const [matchupId, result] of Object.entries(catalog)) {
    for (const sub of result.subResults || []) {
      catalogRows.push({
        matchup_id: matchupId,
        discipline_id: sub.disciplineId,
        team_a_sub_wins: String(sub.teamASubWins ?? 0),
        team_b_sub_wins: String(sub.teamBSubWins ?? 0),
        team_a_points: String(sub.teamAPoints ?? 0),
        team_b_points: String(sub.teamBPoints ?? 0),
        winner_team_id: sub.winnerTeamId || result.winnerTeamId || "",
        status: result.status,
        forfeit: String(Boolean(result.forfeit)),
      });
    }
    if ((result.subResults || []).length === 0 && result.status === "forfeit") {
      catalogRows.push({
        matchup_id: matchupId,
        discipline_id: "disc-md",
        team_a_sub_wins: "0",
        team_b_sub_wins: "0",
        team_a_points: "0",
        team_b_points: "0",
        winner_team_id: result.winnerTeamId || "",
        status: result.status,
        forfeit: "true",
      });
    }
  }

  if (resultsCsv.length !== catalogRows.length) {
    fail(errors, "CSV_RESULTS_COUNT", `results.csv count ${resultsCsv.length} != JSON catalog ${catalogRows.length}`);
  }

  for (const expected of catalogRows) {
    const row = resultsCsv.find(
      (entry) => entry.matchup_id === expected.matchup_id && entry.discipline_id === expected.discipline_id
    );
    if (!row) {
      fail(errors, "CSV_RESULTS_ID", `results.csv missing ${expected.matchup_id}/${expected.discipline_id}`);
      continue;
    }
    if (
      row.team_a_sub_wins !== expected.team_a_sub_wins ||
      row.team_b_sub_wins !== expected.team_b_sub_wins ||
      row.status !== expected.status ||
      row.forfeit !== expected.forfeit
    ) {
      fail(errors, "CSV_RESULTS_DRIFT", `results.csv drift for ${expected.matchup_id}/${expected.discipline_id}`);
    }
  }
}

function validateScenarioChain(tournament, scenarios, users, errors) {
  const steps = [...(scenarios.steps || [])].sort((a, b) => a.order - b.order);
  const ids = steps.map((step) => step.id);
  const idSet = new Set(ids);

  if (idSet.size !== ids.length) {
    fail(errors, "SCENARIO_DUP", "Duplicate scenario step ids");
  }

  for (const expectedId of EXPECTED_SCENARIO_IDS) {
    if (!idSet.has(expectedId)) {
      fail(errors, "SCENARIO_MISSING", `Missing scenario id ${expectedId}`);
    }
  }

  steps.forEach((step, index) => {
    const expectedOrder = index + 1;
    if (step.order !== expectedOrder) {
      fail(errors, "SCENARIO_ORDER", `Scenario ${step.id} order ${step.order} != ${expectedOrder}`);
    }
    if (!String(step.expectedOutcome || "").trim()) {
      fail(errors, "SCENARIO_OUTCOME", `Scenario ${step.id} expectedOutcome is empty`);
    }
    if (step.matchupId && !(tournament.matchups || []).some((matchup) => matchup.id === step.matchupId)) {
      fail(errors, "SCENARIO_MATCHUP", `Scenario ${step.id} references unknown matchup ${step.matchupId}`);
    }
    const actor = resolveActor(step.actor, users);
    if (!actor.ok) {
      fail(errors, "SCENARIO_ACTOR", `Scenario ${step.id} actor ${step.actor} not found`);
    }
  });

  const matchupIds = new Set((tournament.matchups || []).map((matchup) => matchup.id));
  const terminalByStep = new Set();
  let reachedS14 = false;

  for (const step of steps) {
    if (step.id === "S14") {
      reachedS14 = true;
      if (step.preconditionAllMatchupsTerminal !== true) {
        fail(errors, "SCENARIO_S14_PRECONDITION", "S14 must set preconditionAllMatchupsTerminal: true");
      }
      const missing = [...matchupIds].filter((matchupId) => !terminalByStep.has(matchupId));
      if (missing.length > 0) {
        fail(
          errors,
          "SCENARIO_TERMINAL_BEFORE_S14",
          `Before S14, matchups not terminal via scenario chain: ${missing.join(", ")}`
        );
      }
    }

    for (const matchupId of step.confirmsTerminalFor || []) {
      if (!matchupIds.has(matchupId)) {
        fail(errors, "SCENARIO_TERMINAL_REF", `Scenario ${step.id} confirms unknown matchup ${matchupId}`);
      }
      terminalByStep.add(matchupId);
    }
  }

  if (!reachedS14) {
    fail(errors, "SCENARIO_S14_MISSING", "Scenario chain must include S14");
  }

  const catalog = tournament.resultsCatalog || {};
  for (const matchupId of matchupIds) {
    const result = catalog[matchupId];
    if (!result || !TERMINAL_RESULT_STATUSES.has(result.status)) {
      fail(errors, "RESULTS_CATALOG_TERMINAL", `resultsCatalog.${matchupId} is not terminal`);
      continue;
    }
    if (!terminalByStep.has(matchupId)) {
      fail(errors, "RESULTS_CATALOG_PATH", `resultsCatalog.${matchupId} has no scenario terminal confirmation path`);
    }
  }
}

export function validateTt10PilotFixture(tournament, users, scenarios, options = {}) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const fallbackDir = options.fallbackDir || FALLBACK_DIR;
  const skipCsv = Boolean(options.skipCsv);

  function trackId(id, label) {
    if (!id) {
      fail(errors, "MISSING_ID", `${label}: empty id`);
      return;
    }
    if (ids.has(id)) {
      fail(errors, "DUPLICATE_ID", `Duplicate id: ${id}`);
    }
    ids.add(id);
  }

  trackId(tournament.meta?.tournamentId, "tournament");
  (tournament.teams || []).forEach((team) => trackId(team.id, "team"));
  (tournament.players || []).forEach((player) => trackId(player.id, "player"));
  (tournament.courts || []).forEach((court) => trackId(court.id, "court"));
  (tournament.matchups || []).forEach((matchup) => trackId(matchup.id, "matchup"));
  (users.accounts || []).forEach((account) => trackId(account.fixtureAccountId, "account"));

  const teamById = new Map((tournament.teams || []).map((team) => [team.id, team]));
  const playerById = new Map((tournament.players || []).map((player) => [player.id, player]));
  const disciplineIds = (tournament.settings?.disciplines || []).map((discipline) => discipline.id);
  const lineupPolicy = tournament.settings?.lineupPolicy || {
    requiredDisciplineIds: disciplineIds,
    playersPerDiscipline: 2,
    disallowMixedDisciplinePlayerReuse: true,
  };
  const courtSchedule = new Map();

  (tournament.players || []).forEach((player) => {
    if (!player.teamId || !teamById.has(player.teamId)) {
      fail(errors, "PLAYER_TEAM", `Player ${player.id} has invalid teamId ${player.teamId}`);
    }
    const gender = String(player.gender || "").trim();
    if (!GENDERS.has(gender)) {
      fail(errors, "PLAYER_GENDER", `Player ${player.id} invalid gender: ${player.gender}`);
    }
  });

  (tournament.teams || []).forEach((team) => {
    const roster = (tournament.players || []).filter((player) => player.teamId === team.id);
    if (roster.length < 4 || roster.length > 6) {
      fail(errors, "ROSTER_SIZE", `Team ${team.id} roster size ${roster.length} (expected 4-6)`);
    }
    const males = roster.filter((player) => isMale(player.gender));
    const females = roster.filter((player) => isFemale(player.gender));
    if (males.length < 2 || females.length < 2) {
      fail(errors, "ROSTER_GENDER", `Team ${team.id} needs min 2 male + 2 female`);
    }
    if (team.captainPlayerId && !playerById.has(team.captainPlayerId)) {
      fail(errors, "CAPTAIN_PLAYER", `Team ${team.id} captainPlayerId invalid`);
    }
    if (team.captainPlayerId) {
      const captain = playerById.get(team.captainPlayerId);
      if (captain?.teamId !== team.id) {
        fail(errors, "CAPTAIN_MAPPING", `Captain ${team.captainPlayerId} not on team ${team.id}`);
      }
    }
  });

  (tournament.matchups || []).forEach((matchup) => {
    if (!teamById.has(matchup.teamAId) || !teamById.has(matchup.teamBId)) {
      fail(errors, "MATCHUP_TEAM", `Matchup ${matchup.id} invalid team ids`);
    }
    if (matchup.teamAId === matchup.teamBId) {
      fail(errors, "MATCHUP_SELF", `Matchup ${matchup.id} same team both sides`);
    }
    if (matchup.courtId) {
      const slot = `${matchup.scheduledAt || "TBD"}::${matchup.courtId}`;
      if (courtSchedule.has(slot)) {
        fail(errors, "COURT_CONFLICT", `Court ${matchup.courtId} double-booked at ${matchup.scheduledAt}`);
      }
      courtSchedule.set(slot, matchup.id);
    }
  });

  (users.accounts || []).forEach((account) => {
    if (account.role === "captain") {
      const team = teamById.get(account.teamId);
      if (!team) {
        fail(errors, "CAPTAIN_ACCOUNT", `Captain account ${account.fixtureAccountId} missing team`);
      } else if (team.captainPlayerId !== account.playerId) {
        warnings.push({
          code: "CAPTAIN_ACCOUNT_MISMATCH",
          message: `Account ${account.fixtureAccountId} playerId != team.captainPlayerId`,
        });
      }
    }
    if (account.role === "referee") {
      const assigned = account.assignedMatchupIds || [];
      assigned.forEach((matchupId) => {
        if (!(tournament.matchups || []).some((matchup) => matchup.id === matchupId)) {
          fail(errors, "REFEREE_MATCHUP", `Referee ${account.fixtureAccountId} invalid matchup ${matchupId}`);
        }
      });
    }
  });

  if (!tournament.settings?.lineupDeadline) {
    fail(errors, "MISSING_DEADLINE", "settings.lineupDeadline required");
  }
  if (!tournament.settings?.missingLineupPolicy) {
    fail(errors, "MISSING_POLICY", "settings.missingLineupPolicy required");
  }
  if (!tournament.settings?.tiebreakOrder?.length) {
    fail(errors, "MISSING_TIEBREAK", "settings.tiebreakOrder required");
  }
  if (tournament.settings?.dreambreakerEnabled !== false) {
    warnings.push({ code: "DREAMBREAKER", message: "Pilot default expects dreambreakerEnabled: false" });
  }

  for (const [templateKey, lineup] of Object.entries(tournament.lineupTemplates || {})) {
    const violations = validateLineupTemplateRules({
      templateKey,
      lineup,
      teamById,
      playerById,
      disciplineIds,
      policy: lineupPolicy,
    });

    const expectedError = lineup.validationError;
    if (expectedError) {
      if (violations.length === 0) {
        fail(
          errors,
          "INVALID_LINEUP_FALSE_NEGATIVE",
          `${templateKey} marked invalid but passes lineup rules`
        );
      }
      if (
        String(expectedError).toLowerCase().includes("reuse") &&
        !violations.some((violation) => violation.code === "LINEUP_MIXED_REUSE")
      ) {
        fail(
          errors,
          "INVALID_LINEUP_REASON",
          `${templateKey} validationError does not match detected violations`
        );
      }
      if (!lineup.expectedRejectionCode) {
        fail(errors, "INVALID_LINEUP_CODE", `${templateKey} missing expectedRejectionCode`);
      }
    } else {
      violations.forEach((violation) => fail(errors, violation.code, violation.message));
    }
  }

  validateScenarioChain(tournament, scenarios, users, errors);

  if (!skipCsv) {
    validateCsvSync(tournament, users, errors, fallbackDir);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      teams: (tournament.teams || []).length,
      players: (tournament.players || []).length,
      matchups: (tournament.matchups || []).length,
      accounts: (users.accounts || []).length,
      scenarioSteps: (scenarios.steps || []).length,
      terminalMatchups: Object.values(tournament.resultsCatalog || {}).filter((result) =>
        TERMINAL_RESULT_STATUSES.has(result.status)
      ).length,
    },
  };
}

function main() {
  const tournament = load("tt10-pilot-tournament.json");
  const users = load("tt10-users.json");
  const scenarios = load("tt10-scenarios.json");
  const result = validateTt10PilotFixture(tournament, users, scenarios);

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
