#!/usr/bin/env node
/**
 * TT-10 read-only pilot fixture validator.
 * Usage: node scripts/qa/validate-tt10-pilot-fixture.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const FIXTURE_DIR = resolve(ROOT, "docs/v5/qa/team-tournament/fixtures");

const GENDERS = new Set(["male", "female", "Nam", "Nữ"]);

function load(name) {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), "utf8"));
}

function fail(errors, code, message) {
  errors.push({ code, message });
}

export function validateTt10PilotFixture(tournament, users, scenarios) {
  const errors = [];
  const warnings = [];
  const ids = new Set();

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
  (tournament.teams || []).forEach((t) => trackId(t.id, "team"));
  (tournament.players || []).forEach((p) => trackId(p.id, "player"));
  (tournament.courts || []).forEach((c) => trackId(c.id, "court"));
  (tournament.matchups || []).forEach((m) => trackId(m.id, "matchup"));
  (users.accounts || []).forEach((a) => trackId(a.fixtureAccountId, "account"));

  const teamById = new Map((tournament.teams || []).map((t) => [t.id, t]));
  const playerById = new Map((tournament.players || []).map((p) => [p.id, p]));
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
    const roster = (tournament.players || []).filter((p) => p.teamId === team.id);
    if (roster.length < 4 || roster.length > 6) {
      fail(errors, "ROSTER_SIZE", `Team ${team.id} roster size ${roster.length} (expected 4-6)`);
    }
    const males = roster.filter((p) => p.gender === "male" || p.gender === "Nam");
    const females = roster.filter((p) => p.gender === "female" || p.gender === "Nữ");
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
        if (!(tournament.matchups || []).some((m) => m.id === matchupId)) {
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

  const scenarioIds = new Set((scenarios.steps || []).map((s) => s.id));
  if (scenarioIds.size !== (scenarios.steps || []).length) {
    fail(errors, "SCENARIO_DUP", "Duplicate scenario step ids");
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
