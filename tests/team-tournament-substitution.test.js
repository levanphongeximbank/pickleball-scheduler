import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  applyRosterSubstitution,
  getSubstitutionGate,
  listSubstitutionLog,
} from "../src/features/team-tournament/engines/substitutionEngine.js";
import {
  canApproveSubstitution,
  canRequestSubstitution,
} from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import {
  addTeamToTournament,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { findTeam, lineupKey } from "../src/features/team-tournament/models/index.js";
import { LINEUP_STATUS } from "../src/features/team-tournament/constants.js";

function baseTeamData() {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "Alpha",
    playerIds: ["p1", "p2", "p3"],
    captainPlayerId: "p1",
    deputyPlayerIds: ["p2"],
  });
  return teamData;
}

function withDraftLineup(teamData, { status = LINEUP_STATUS.DRAFT, selections } = {}) {
  const key = lineupKey("m1", "team-a");
  return {
    ...teamData,
    lineups: {
      ...(teamData.lineups || {}),
      [key]: {
        matchupId: "m1",
        teamId: "team-a",
        status,
        selections: selections || { d1: ["p1", "p2"] },
      },
    },
  };
}

const players = [
  { id: "p1", name: "A", gender: "male" },
  { id: "p2", name: "B", gender: "female" },
  { id: "p3", name: "C", gender: "male" },
  { id: "p4", name: "D", gender: "female" },
];

test("T-S2-C01 allow substitution before lock", () => {
  const teamData = withDraftLineup(baseTeamData());
  const gate = getSubstitutionGate(teamData, "team-a");
  assert.equal(gate.allowed, true);

  const result = applyRosterSubstitution(
    teamData,
    { teamId: "team-a", outPlayerId: "p3", inPlayerId: "p4", reason: "chấn thương" },
    players
  );
  assert.equal(result.ok, true);
  const team = findTeam(result.teamData, "team-a");
  assert.ok(team.playerIds.includes("p4"));
  assert.ok(!team.playerIds.includes("p3"));
});

test("T-S2-C02 block when lineup locked", () => {
  const teamData = withDraftLineup(baseTeamData(), {
    status: LINEUP_STATUS.LOCKED,
  });
  const gate = getSubstitutionGate(teamData, "team-a");
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "LINEUP_LOCKED");

  const result = applyRosterSubstitution(
    teamData,
    { teamId: "team-a", outPlayerId: "p3", inPlayerId: "p4" },
    players
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "LINEUP_LOCKED");
});

test("T-S2-C03 block when lineup published", () => {
  const teamData = withDraftLineup(baseTeamData(), {
    status: LINEUP_STATUS.PUBLISHED,
  });
  const gate = getSubstitutionGate(teamData, "team-a");
  assert.equal(gate.allowed, false);
  assert.equal(gate.code, "LINEUP_LOCKED");
});

test("T-S2-C04 replaces selection in editable lineups", () => {
  const teamData = withDraftLineup(baseTeamData(), {
    status: LINEUP_STATUS.SUBMITTED,
    selections: { d1: ["p1", "p3"] },
  });
  const result = applyRosterSubstitution(
    teamData,
    { teamId: "team-a", outPlayerId: "p3", inPlayerId: "p4" },
    players
  );
  assert.equal(result.ok, true);
  const key = lineupKey("m1", "team-a");
  assert.deepEqual(result.teamData.lineups[key].selections.d1, ["p1", "p4"]);
});

test("T-S2-C05 captain transfer when out player is captain + log", () => {
  const teamData = withDraftLineup(baseTeamData());
  const result = applyRosterSubstitution(
    teamData,
    {
      teamId: "team-a",
      outPlayerId: "p1",
      inPlayerId: "p4",
      actorRole: "btc",
    },
    players
  );
  assert.equal(result.ok, true);
  assert.equal(result.entry.captainChanged, true);
  const team = findTeam(result.teamData, "team-a");
  assert.equal(team.captainPlayerId, "p4");

  const log = listSubstitutionLog(result.teamData, "team-a");
  assert.equal(log.length, 1);
  assert.equal(log[0].outPlayerId, "p1");
  assert.equal(log[0].inPlayerId, "p4");
});

test("T-S2-C06 TEAM_SUBSTITUTION permissions", () => {
  assert.equal(canRequestSubstitution({ permissions: [] }), false);
  assert.equal(
    canRequestSubstitution({
      permissions: [PERMISSIONS.TEAM_SUBSTITUTION_REQUEST],
    }),
    true
  );
  assert.equal(
    canApproveSubstitution({
      permissions: [PERMISSIONS.TEAM_SUBSTITUTION_REQUEST],
    }),
    false
  );
  assert.equal(
    canApproveSubstitution({
      permissions: [PERMISSIONS.TEAM_SUBSTITUTION_APPROVE],
    }),
    true
  );
  assert.equal(
    canApproveSubstitution({ permissions: [PERMISSIONS.TEAM_MANAGE] }),
    true
  );

  const panel = path.resolve("src/components/tournament/TeamSubstitutionPanel.jsx");
  assert.equal(fs.existsSync(panel), true);
  const src = fs.readFileSync(panel, "utf8");
  assert.match(src, /substituteTeamPlayer/);
  assert.match(src, /Thay người/);
});
