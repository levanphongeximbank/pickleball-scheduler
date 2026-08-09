import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { attachPersistedDreambreakerProjection } from "../src/features/team-tournament/engines/dreambreakerProjection.js";
import { normalizeStanding } from "../src/features/team-tournament/models/index.js";
import { normalizeV7TournamentForAggregate } from "../src/features/team-tournament/repositories/mapGetSetupV7.js";
import {
  SETUP_MUTATION_RPC_BY_COMMAND,
  isSetupMutationRpcDeployed,
} from "../src/features/team-tournament/setup/setupMutationRpcRegistry.js";
import { TT1B_COMMAND_RPCS } from "../src/features/team-tournament/services/teamTournamentRpcService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-dreambreaker-advancement-canonical-remediation-01"
);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("SQL package files exist with required contracts", () => {
  const files = [
    "00_README.md",
    "10_RECOMPUTE_AND_DREAMBREAKER_ACTIVATE.sql",
    "20_DREAMBREAKER_COMMAND_RPCS.sql",
    "30_FORFEIT_WITHDRAW_PARITY.sql",
    "40_RANDOMIZE_LINEUP_PARITY.sql",
    "50_VERIFY.sql",
    "90_ROLLBACK.sql",
  ];
  for (const name of files) {
    assert.ok(fs.existsSync(path.join(pkgDir, name)), name);
  }

  const activate = fs.readFileSync(path.join(pkgDir, "10_RECOMPUTE_AND_DREAMBREAKER_ACTIVATE.sql"), "utf8");
  assert.match(activate, /team_tournament_maybe_activate_dreambreaker/);
  assert.match(activate, /DREAMBREAKER_REQUIRED/);
  assert.match(activate, /NOT_AUTHENTICATED/);
  assert.match(activate, /team_tournament_assert_tenant/);
  assert.match(activate, /needsDreambreaker/);

  const commands = fs.readFileSync(path.join(pkgDir, "20_DREAMBREAKER_COMMAND_RPCS.sql"), "utf8");
  for (const fn of [
    "team_tournament_submit_dreambreaker_order",
    "team_tournament_lock_dreambreaker_order",
    "team_tournament_start_dreambreaker",
    "team_tournament_record_dreambreaker_point",
    "team_tournament_undo_dreambreaker_point",
    "team_tournament_dreambreaker_injury",
    "team_tournament_sync_dreambreaker",
  ]) {
    assert.match(commands, new RegExp(fn));
  }

  const forfeit = fs.readFileSync(path.join(pkgDir, "30_FORFEIT_WITHDRAW_PARITY.sql"), "utf8");
  assert.match(forfeit, /team_tournament_apply_forfeit/);
  assert.match(forfeit, /team_tournament_withdraw_team/);
  assert.match(forfeit, /withdrawn_at/);
  assert.match(forfeit, /forfeit_count/);

  const randomize = fs.readFileSync(path.join(pkgDir, "40_RANDOMIZE_LINEUP_PARITY.sql"), "utf8");
  assert.match(randomize, /team_tournament_randomize_lineup/);
});

test("2-2 confirm path activates dreambreaker and does not false-complete", () => {
  const activate = fs.readFileSync(path.join(pkgDir, "10_RECOMPUTE_AND_DREAMBREAKER_ACTIVATE.sql"), "utf8");
  assert.match(activate, /lineup_open/);
  assert.match(activate, /winnerTeamId', null/);
  assert.doesNotMatch(
    activate.split("create or replace function public.team_tournament_confirm_sub_match")[1] || "",
    /status <> 'completed'\) = 0\s*then 'completed'/
  );
});

test("mapGetSetup merges durable dreambreaker onto matchups", () => {
  const normalized = normalizeV7TournamentForAggregate({
    schemaVersion: 7,
    teams: [{ id: "t1", name: "A", playerIds: ["p1"] }],
    matchups: [{ id: "m1", teamAId: "t1", teamBId: "t2", subMatches: [] }],
    dreambreaker: {
      m1: {
        matchupId: "m1",
        status: "lineup_open",
        teamAOrder: ["p1", "p2", "p3", "p4"],
        teamBOrder: [],
        teamAScore: 0,
        teamBScore: 0,
        version: 2,
      },
    },
  });
  assert.equal(normalized.teamData.matchups[0].dreambreaker.status, "lineup_open");
  assert.equal(normalized.teamData.matchups[0].dreambreaker.teamAOrder.length, 4);
});

test("attachPersistedDreambreakerProjection does not invent durable activation", () => {
  const projected = attachPersistedDreambreakerProjection({
    teams: [],
    matchups: [
      {
        id: "m1",
        teamAId: "a",
        teamBId: "b",
        subMatches: [
          { id: "s1", status: "completed", winnerTeamId: "a" },
          { id: "s2", status: "completed", winnerTeamId: "b" },
          { id: "s3", status: "completed", winnerTeamId: "a" },
          { id: "s4", status: "completed", winnerTeamId: "b" },
        ],
        result: { teamAWins: 2, teamBWins: 2 },
      },
    ],
    dreambreaker: {},
    disciplines: [],
  });
  assert.equal(projected.matchups[0].dreambreaker == null, true);
});

test("forfeitCount preserved separately from forfeitWins", () => {
  const standing = normalizeStanding({
    teamId: "t1",
    forfeitWins: 1,
    forfeitCount: 3,
  });
  assert.equal(standing.forfeitWins, 1);
  assert.equal(standing.forfeitCount, 3);
});

test("dreambreaker cloud noops removed from service", () => {
  const service = read("src/features/team-tournament/services/teamTournamentService.js");
  const dreambreakerSection = service.slice(
    service.indexOf("captainSubmitDreambreakerOrder"),
    service.indexOf("export async function refereeLockDreambreakerOrders") + 400
  );
  assert.equal(
    (dreambreakerSection.match(/usedCloud:\s*false/g) || []).length,
    0
  );
  assert.match(service, /cloudSubmitDreambreakerOrder/);
  assert.match(service, /cloudRecordDreambreakerPoint/);
  assert.match(service, /cloudSyncDreambreaker/);
});

test("knockout UI uses persistSetupTeamData cloud path", () => {
  const setup = read("src/pages/tournament/TeamTournamentSetup.jsx");
  assert.match(setup, /generateTeamKnockoutMatchups/);
  assert.match(setup, /persistSetupTeamData\(built\.teamData/);
  assert.doesNotMatch(
    setup.slice(setup.indexOf("async function handleGenerateKnockout")),
    /generateTeamKnockoutBracket\(/
  );
});

test("RPC registry includes dreambreaker commands as deployed", () => {
  assert.ok(TT1B_COMMAND_RPCS.includes("team_tournament_submit_dreambreaker_order"));
  assert.ok(TT1B_COMMAND_RPCS.includes("team_tournament_record_dreambreaker_point"));
  assert.ok(TT1B_COMMAND_RPCS.includes("team_tournament_start_dreambreaker"));
  assert.equal(
    isSetupMutationRpcDeployed(SETUP_MUTATION_RPC_BY_COMMAND["dreambreaker.point"]),
    true
  );
});

test("tenant fail-closed markers present in dreambreaker SQL", () => {
  const commands = fs.readFileSync(path.join(pkgDir, "20_DREAMBREAKER_COMMAND_RPCS.sql"), "utf8");
  assert.match(commands, /NOT_AUTHENTICATED/);
  assert.match(commands, /team_tournament_assert_tenant/);
});
