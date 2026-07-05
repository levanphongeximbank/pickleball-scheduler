import test from "node:test";
import assert from "node:assert/strict";

import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import {
  LINEUP_STATUS,
  MATCHUP_STATUS,
  TEAM_AUDIT_ACTIONS,
  DISCIPLINE_CATEGORY,
  GENDER_REQUIREMENT,
} from "../src/features/team-tournament/constants.js";
import {
  saveLineupDraft,
  submitLineup,
  lockMatchupLineups,
  publishMatchupLineups,
  getVisibleLineup,
  buildOfficialPairings,
} from "../src/features/team-tournament/engines/lineupEngine.js";
import {
  validateLineupSelections,
} from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import {
  findTeamForCaptain,
  isTeamCaptain,
  listMatchupsForTeam,
  assertTeamScope,
  partitionMatchupsForPortal,
} from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import {
  addTeamToTournament,
  buildRoundRobinMatchups,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { createDisciplineRecord, findTeam, getLineup } from "../src/features/team-tournament/models/index.js";
import { appendTeamAuditLog, listTeamAuditLogs } from "../src/features/team-tournament/services/teamAuditService.js";

const auditStorage = new Map();

function installAuditStorageMock() {
  globalThis.localStorage = {
    getItem(key) {
      return auditStorage.has(key) ? auditStorage.get(key) : null;
    },
    setItem(key, value) {
      auditStorage.set(key, String(value));
    },
    removeItem(key) {
      auditStorage.delete(key);
    },
  };
}

function clearAuditStorageMock() {
  auditStorage.clear();
  delete globalThis.localStorage;
}

const players = [
  { id: "p1", name: "Nam A", gender: "Nam" },
  { id: "p2", name: "Nam B", gender: "Nam" },
  { id: "p3", name: "Nam C", gender: "Nam" },
  { id: "p4", name: "Nu A", gender: "Nữ" },
  { id: "p5", name: "Nu B", gender: "Nữ" },
  { id: "p6", name: "Nu C", gender: "Nữ" },
  { id: "p7", name: "Nam D", gender: "Nam" },
  { id: "p8", name: "Nu D", gender: "Nữ" },
  { id: "p9", name: "Nam E", gender: "Nam" },
  { id: "p10", name: "Nu E", gender: "Nữ" },
];

function buildFixture() {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "Future Arena",
    playerIds: ["p1", "p2", "p4", "p5", "p7", "p8", "p9", "p10"],
    captainPlayerId: "p1",
    deputyPlayerIds: ["p2"],
  });
  teamData = addTeamToTournament(teamData, {
    id: "team-b",
    name: "Elite Club",
    playerIds: ["p3", "p6", "p2", "p4", "p7", "p8", "p9", "p10"],
    captainPlayerId: "p3",
  });
  teamData = buildRoundRobinMatchups(teamData, {
    lineupLockAt: "2099-01-01T08:30:00.000Z",
  });
  return teamData;
}

function lineupSelectionsForTeam(teamData, teamId) {
  const team = findTeam(teamData, teamId);
  const [menDouble, womenDouble, mixed1, mixed2] = teamData.disciplines;
  const males = team.playerIds.filter((id) => {
    const player = players.find((item) => item.id === id);
    return player && player.gender === "Nam";
  });
  const females = team.playerIds.filter((id) => {
    const player = players.find((item) => item.id === id);
    return player && player.gender === "Nữ";
  });

  return {
    [menDouble.id]: [males[0], males[1]],
    [womenDouble.id]: [females[0], females[1]],
    [mixed1.id]: [males[2], females[2]],
    [mixed2.id]: [males[3], females[3]],
  };
}

test("captain portal resolves only the captain own team", () => {
  const teamData = buildFixture();

  assert.equal(findTeamForCaptain(teamData, "p1")?.id, "team-a");
  assert.equal(findTeamForCaptain(teamData, "p2")?.id, "team-a");
  assert.equal(findTeamForCaptain(teamData, "p3")?.id, "team-b");
  assert.equal(findTeamForCaptain(teamData, "p9"), null);

  const teamAMatchups = listMatchupsForTeam(teamData, "team-a");
  assert.ok(teamAMatchups.length > 0);
  assert.ok(
    teamAMatchups.every(
      (matchup) => matchup.teamAId === "team-a" || matchup.teamBId === "team-a"
    )
  );
});

test("deputy captain can manage lineup for own team", () => {
  const teamData = buildFixture();
  const teamA = findTeam(teamData, "team-a");

  assert.equal(isTeamCaptain(teamA, "p2"), true);
  assert.equal(
    assertTeamScope(teamData, "team-a", "p2", [PERMISSIONS.TEAM_LINEUP_SUBMIT]).ok,
    true
  );
  assert.equal(
    assertTeamScope(teamData, "team-b", "p2", [PERMISSIONS.TEAM_LINEUP_SUBMIT]).ok,
    false
  );
});

test("captain can save partial lineup draft", () => {
  const teamData = buildFixture();
  const matchup = teamData.matchups[0];
  const [menDouble] = teamData.disciplines;

  const draft = saveLineupDraft(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: {
      [menDouble.id]: ["p1", "p7"],
    },
    players,
  });

  assert.equal(draft.ok, true);
  const lineup = getLineup(draft.teamData, matchup.id, "team-a");
  assert.equal(lineup.status, LINEUP_STATUS.DRAFT);
  assert.deepEqual(lineup.selections[menDouble.id], ["p1", "p7"]);
});

test("captain can submit valid full lineup", () => {
  const teamData = buildFixture();
  const matchup = teamData.matchups[0];

  const result = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: lineupSelectionsForTeam(teamData, "team-a"),
    players,
    now: "2026-01-01T08:00:00.000Z",
  });

  assert.equal(result.ok, true);
  const lineup = getLineup(result.teamData, matchup.id, "team-a");
  assert.equal(lineup.status, LINEUP_STATUS.SUBMITTED);
});

test("portal blocks invalid gender lineup submission", () => {
  const teamData = buildFixture();
  const [menDouble, womenDouble, mixed1, mixed2] = teamData.disciplines;

  const invalid = validateLineupSelections({
    teamData,
    teamId: "team-a",
    selections: {
      [menDouble.id]: ["p4", "p5"],
      [womenDouble.id]: ["p4", "p5"],
      [mixed1.id]: ["p1", "p2"],
      [mixed2.id]: ["p7", "p8"],
    },
    players,
  });

  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => /nam/i.test(error)));
});

test("portal blocks invalid player count submission", () => {
  const teamData = buildFixture();
  const [menDouble, womenDouble, mixed1, mixed2] = teamData.disciplines;

  const invalid = validateLineupSelections({
    teamData,
    teamId: "team-a",
    selections: {
      [menDouble.id]: ["p1"],
      [womenDouble.id]: ["p4", "p5"],
      [mixed1.id]: ["p7", "p8"],
      [mixed2.id]: ["p9", "p10"],
    },
    players,
  });

  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => /cần 2 VĐV/i.test(error)));
});

test("captain cannot edit lineup after lock", () => {
  let teamData = buildFixture();
  const matchup = teamData.matchups[0];

  teamData = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: lineupSelectionsForTeam(teamData, "team-a"),
    players,
    now: "2026-01-01T08:00:00.000Z",
  }).teamData;

  teamData = lockMatchupLineups(teamData, {
    matchupId: matchup.id,
    players,
    now: "2026-01-01T09:00:00.000Z",
  }).teamData;

  const blockedDraft = saveLineupDraft(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: lineupSelectionsForTeam(teamData, "team-a"),
    players,
  });

  assert.equal(blockedDraft.ok, false);
  assert.match(blockedDraft.error, /khóa/i);

  const blockedSubmit = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: lineupSelectionsForTeam(teamData, "team-a"),
    players,
    now: "2026-01-01T09:30:00.000Z",
  });

  assert.equal(blockedSubmit.ok, false);
});

test("portal hides opponent lineup before publish", () => {
  let teamData = buildFixture();
  const matchup = teamData.matchups[0];

  teamData = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: lineupSelectionsForTeam(teamData, "team-a"),
    players,
  }).teamData;

  teamData = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-b",
    selections: lineupSelectionsForTeam(teamData, "team-b"),
    players,
  }).teamData;

  teamData = lockMatchupLineups(teamData, {
    matchupId: matchup.id,
    players,
    now: "2026-01-01T09:00:00.000Z",
  }).teamData;

  const hidden = getVisibleLineup(teamData, {
    matchupId: matchup.id,
    viewerTeamId: "team-a",
    isOrganizer: false,
  });

  assert.equal(hidden.ok, true);
  assert.ok(hidden.ownLineup);
  assert.equal(hidden.opponentLineup, null);

  teamData = publishMatchupLineups(teamData, { matchupId: matchup.id }).teamData;

  const visible = getVisibleLineup(teamData, {
    matchupId: matchup.id,
    viewerTeamId: "team-a",
    isOrganizer: false,
  });

  assert.ok(visible.opponentLineup);
  assert.equal(visible.opponentLineup.status, LINEUP_STATUS.PUBLISHED);

  const pairings = buildOfficialPairings(teamData, matchup.id);
  assert.equal(pairings.ok, true);
  assert.equal(pairings.pairings.length, teamData.disciplines.length);
  assert.equal(teamData.matchups[0].status, MATCHUP_STATUS.PUBLISHED);
});

test("captain can edit submitted lineup before lock time", () => {
  let teamData = buildFixture();
  const matchup = teamData.matchups[0];
  const selections = lineupSelectionsForTeam(teamData, "team-a");

  teamData = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections,
    players,
    now: "2026-01-01T08:00:00.000Z",
  }).teamData;

  const [menDouble, , mixed1] = teamData.disciplines;
  const editedSelections = {
    ...selections,
    [menDouble.id]: ["p1", "p7"],
    [mixed1.id]: ["p2", "p8"],
  };

  const edited = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: editedSelections,
    players,
    now: "2026-01-01T08:15:00.000Z",
  });

  assert.equal(edited.ok, true);
  const lineup = getLineup(edited.teamData, matchup.id, "team-a");
  assert.equal(lineup.status, LINEUP_STATUS.SUBMITTED);
  assert.deepEqual(lineup.selections[menDouble.id], ["p1", "p7"]);
});

test("draft rejects absent player selection", () => {
  let teamData = buildFixture();
  const matchup = teamData.matchups[0];
  const [menDouble] = teamData.disciplines;

  teamData.teams = teamData.teams.map((team) =>
    team.id === "team-a" ? { ...team, absentPlayerIds: ["p1"] } : team
  );

  const blocked = saveLineupDraft(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: {
      [menDouble.id]: ["p1", "p7"],
    },
    players,
  });

  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /vắng mặt/i);
});

test("portal partitions upcoming and past matchups", () => {
  let teamData = buildFixture();
  teamData.matchups = teamData.matchups.map((matchup, index) => ({
    ...matchup,
    scheduledAt:
      index === 0
        ? "2099-06-01T10:00:00.000Z"
        : "2020-01-01T10:00:00.000Z",
    status: index === 0 ? MATCHUP_STATUS.LINEUP_OPEN : MATCHUP_STATUS.PUBLISHED,
  }));

  const { upcoming, past } = partitionMatchupsForPortal(
    listMatchupsForTeam(teamData, "team-a"),
    "2026-01-01T00:00:00.000Z"
  );

  assert.equal(upcoming.length, 1);
  assert.equal(past.length, teamData.matchups.length - 1);
});

test("portal supports singles discipline when configured", () => {
  let teamData = initializeTeamTournamentData({
    disciplines: [
      createDisciplineRecord({
        id: "disc-men-single",
        name: "Đơn nam",
        categoryType: DISCIPLINE_CATEGORY.SINGLES,
        genderRequirement: GENDER_REQUIREMENT.MALE,
        playerCount: 1,
      }),
      createDisciplineRecord({
        id: "disc-women-single",
        name: "Đơn nữ",
        categoryType: DISCIPLINE_CATEGORY.SINGLES,
        genderRequirement: GENDER_REQUIREMENT.FEMALE,
        playerCount: 1,
      }),
    ],
  });

  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "Future Arena",
    playerIds: ["p1", "p4"],
    captainPlayerId: "p1",
  });
  teamData = addTeamToTournament(teamData, {
    id: "team-b",
    name: "Elite Club",
    playerIds: ["p3", "p5"],
    captainPlayerId: "p3",
  });
  teamData = buildRoundRobinMatchups(teamData, {
    lineupLockAt: "2099-01-01T08:30:00.000Z",
  });

  const matchup = teamData.matchups[0];
  const [menSingle, womenSingle] = teamData.disciplines;

  const valid = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: {
      [menSingle.id]: ["p1"],
      [womenSingle.id]: ["p4"],
    },
    players,
  });

  assert.equal(valid.ok, true);

  const invalid = validateLineupSelections({
    teamData,
    teamId: "team-a",
    selections: {
      [menSingle.id]: ["p4"],
      [womenSingle.id]: ["p1"],
    },
    players,
  });

  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => /nam/i.test(error)));
});

test("portal audit logs draft submit and edit actions", () => {
  installAuditStorageMock();
  auditStorage.clear();

  try {
    let teamData = buildFixture();
    const matchup = teamData.matchups[0];
    const [menDouble] = teamData.disciplines;

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.LINEUP_DRAFT,
      targetId: "tournament-1",
      metadata: { matchupId: matchup.id, teamId: "team-a" },
    });

    teamData = saveLineupDraft(teamData, {
      matchupId: matchup.id,
      teamId: "team-a",
      selections: { [menDouble.id]: ["p1", "p7"] },
      players,
    }).teamData;

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.LINEUP_SUBMIT,
      targetId: "tournament-1",
      metadata: { matchupId: matchup.id, teamId: "team-a" },
    });

    teamData = submitLineup(teamData, {
      matchupId: matchup.id,
      teamId: "team-a",
      selections: lineupSelectionsForTeam(teamData, "team-a"),
      players,
    }).teamData;

    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.LINEUP_UPDATE,
      targetId: "tournament-1",
      metadata: { matchupId: matchup.id, teamId: "team-a", status: "edit_before_lock" },
    });

    const logs = listTeamAuditLogs(10);
    assert.ok(logs.some((entry) => entry.action === TEAM_AUDIT_ACTIONS.LINEUP_DRAFT));
    assert.ok(logs.some((entry) => entry.action === TEAM_AUDIT_ACTIONS.LINEUP_SUBMIT));
    assert.ok(logs.some((entry) => entry.action === TEAM_AUDIT_ACTIONS.LINEUP_UPDATE));
    assert.equal(getLineup(teamData, matchup.id, "team-a").status, LINEUP_STATUS.SUBMITTED);
  } finally {
    clearAuditStorageMock();
  }
});
