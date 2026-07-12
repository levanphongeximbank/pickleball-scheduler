import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetTeamTournamentDataModeForTests,
  __setTeamTournamentDataModeForTests,
  createTeamTournamentRepository,
  resolveTeamTournamentDataMode,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js";
import { compareTeamTournamentSnapshots } from "../src/features/team-tournament/repositories/teamTournamentCompare.js";

test("data mode rejects cloud_primary in TT-1B", () => {
  __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY);
  assert.throws(
    () => createTeamTournamentRepository(),
    /TT-1B/
  );
  __resetTeamTournamentDataModeForTests();
});

test("legacy mode returns blob repository", () => {
  __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.LEGACY);
  const repo = createTeamTournamentRepository({ forceNew: true });
  assert.equal(repo.getProvider(), "blob");
  __resetTeamTournamentDataModeForTests();
});

test("shadow compare detects lineup mismatch", () => {
  const blob = {
    teams: [{ id: "t1", name: "A" }],
    matchups: [],
    disciplines: [],
    lineups: {
      "m1::t1": {
        matchupId: "m1",
        teamId: "t1",
        status: "draft",
        selections: { d1: ["p1"] },
      },
    },
  };
  const cloud = {
    teams: [{ id: "t1", name: "A" }],
    matchups: [],
    disciplines: [],
    lineups: {
      "m1::t1": {
        matchupId: "m1",
        teamId: "t1",
        status: "draft",
        selections: { d1: ["p2"] },
      },
    },
  };

  const result = compareTeamTournamentSnapshots(blob, cloud);
  assert.equal(result.ok, false);
  assert.ok(result.mismatches.some((m) => m.entityType === "lineup" && m.mismatchType === "value_mismatch"));
});

test("resolveTeamTournamentDataMode invalid enum fails fast", () => {
  const prev = process.env.VITE_TEAM_TOURNAMENT_DATA_MODE;
  process.env.VITE_TEAM_TOURNAMENT_DATA_MODE = "invalid-mode";
  assert.throws(() => resolveTeamTournamentDataMode({ allowFutureModes: true }));
  process.env.VITE_TEAM_TOURNAMENT_DATA_MODE = prev;
});
