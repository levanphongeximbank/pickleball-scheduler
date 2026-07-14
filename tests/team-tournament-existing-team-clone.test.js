import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  listExistingTeamCatalog,
  buildClonedTeamForTournament,
  uniqueTeamName,
} from "../src/features/team-tournament/engines/existingTeamCatalogEngine.js";
import {
  canViewExistingTeams,
  canSelectExistingTeam,
} from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import {
  addTeamToTournament,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { findTeam } from "../src/features/team-tournament/models/index.js";

test("T-S2-B01 uniqueTeamName appends suffix on collision", () => {
  assert.equal(uniqueTeamName("Alpha", ["Alpha"]), "Alpha (2)");
  assert.equal(uniqueTeamName("Alpha", ["Alpha", "Alpha (2)"]), "Alpha (3)");
});

test("T-S2-B02 listExistingTeamCatalog flattens teams and can exclude target", () => {
  const tournaments = [
    {
      id: "t-old",
      name: "Giải cũ",
      teamData: {
        teams: [
          { id: "team-a", name: "Đội A", playerIds: ["p1", "p2"], captainPlayerId: "p1" },
          { id: "empty", name: "Trống", playerIds: [] },
        ],
      },
    },
    {
      id: "t-new",
      name: "Giải mới",
      teamData: {
        teams: [{ id: "team-b", name: "Đội B", playerIds: ["p3"], captainPlayerId: "p3" }],
      },
    },
  ];
  assert.equal(listExistingTeamCatalog(tournaments).length, 2);
  assert.equal(
    listExistingTeamCatalog(tournaments, { excludeTournamentId: "t-new" }).length,
    1
  );
});

test("T-S2-B03 buildClonedTeamForTournament copies roster + captain with new id", () => {
  let target = initializeTeamTournamentData();
  const source = {
    id: "src-1",
    name: "Rồng Vàng",
    playerIds: ["p1", "p2", "p3"],
    captainPlayerId: "p2",
    deputyPlayerIds: ["p3"],
  };
  const built = buildClonedTeamForTournament(source, target, {
    sourceTournamentId: "t-old",
  });
  assert.equal(built.ok, true);
  assert.notEqual(built.teamRecord.id, source.id);
  assert.deepEqual(built.teamRecord.playerIds, ["p1", "p2", "p3"]);
  assert.equal(built.teamRecord.captainPlayerId, "p2");
  target = addTeamToTournament(target, built.teamRecord);
  assert.equal(findTeam(target, built.teamRecord.id).clonedFrom.teamId, "src-1");
});

test("T-S2-B04 skips players already on a target team", () => {
  let target = initializeTeamTournamentData();
  target = addTeamToTournament(target, {
    id: "occupied",
    name: "Occupied",
    playerIds: ["p1"],
    captainPlayerId: "p1",
  });
  const built = buildClonedTeamForTournament(
    { id: "src-2", name: "Occupied", playerIds: ["p1", "p2"], captainPlayerId: "p1" },
    target
  );
  assert.equal(built.ok, true);
  assert.deepEqual(built.teamRecord.playerIds, ["p2"]);
  assert.equal(built.teamRecord.name, "Occupied (2)");
});

test("T-S2-B05 fails when all players conflict", () => {
  let target = initializeTeamTournamentData();
  target = addTeamToTournament(target, {
    id: "occupied",
    name: "Occupied",
    playerIds: ["p1", "p2"],
  });
  const built = buildClonedTeamForTournament(
    { id: "src", name: "X", playerIds: ["p1", "p2"], captainPlayerId: "p1" },
    target
  );
  assert.equal(built.ok, false);
  assert.equal(built.code, "ALL_PLAYERS_CONFLICT");
});

test("T-S2-B06 EXISTING_TEAM permissions gate view/select", () => {
  assert.equal(canViewExistingTeams({ permissions: [] }), false);
  assert.equal(
    canViewExistingTeams({ permissions: [PERMISSIONS.EXISTING_TEAM_VIEW] }),
    true
  );
  assert.equal(
    canSelectExistingTeam({ permissions: [PERMISSIONS.EXISTING_TEAM_SELECT] }),
    true
  );
});

test("T-S2-B07 UI hub + clone panel exist", () => {
  assert.equal(
    fs.existsSync(path.resolve("src/components/tournament/ExistingTeamClonePanel.jsx")),
    true
  );
  assert.equal(
    fs.existsSync(path.resolve("src/pages/tournament/hubs/TournamentExistingTeamsHub.jsx")),
    true
  );
});
