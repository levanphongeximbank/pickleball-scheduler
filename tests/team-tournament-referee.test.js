import test from "node:test";
import assert from "node:assert/strict";

import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import { getPermissionsForRole } from "../src/features/identity/matrix/rolePermissions.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import {
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
  TEAM_AUDIT_ACTIONS,
} from "../src/features/team-tournament/constants.js";
import {
  lockMatchupLineups,
  publishMatchupLineups,
  submitLineup,
} from "../src/features/team-tournament/engines/lineupEngine.js";
import {
  buildRefereeMatchupView,
  canEditSubMatchResult,
  confirmSubMatchResult,
  listRefereeMatchupSummaries,
  listRefereeMatchups,
  MATCH_FORMAT,
  saveSubMatchDraft,
  validateSubMatchScoreInput,
} from "../src/features/team-tournament/engines/teamRefereeEngine.js";
import {
  canManageTeamMatchResult,
} from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { computeMatchupResult } from "../src/features/team-tournament/engines/teamResultEngine.js";
import {
  getStandingsTable,
} from "../src/features/team-tournament/engines/teamStandingsEngine.js";
import {
  addTeamToTournament,
  buildRoundRobinMatchups,
  initializeTeamTournamentData,
  refreshStandings,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { findTeam } from "../src/features/team-tournament/models/index.js";
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

function lineupSelectionsForTeam(teamData, teamId) {
  const [menDouble, womenDouble, mixed1, mixed2] = teamData.disciplines;
  const team = findTeam(teamData, teamId);
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

function buildPublishedFixture() {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "Future Arena",
    playerIds: ["p1", "p2", "p4", "p5", "p7", "p8", "p9", "p10"],
    captainPlayerId: "p1",
  });
  teamData = addTeamToTournament(teamData, {
    id: "team-b",
    name: "Elite Club",
    playerIds: ["p3", "p6", "p2", "p4", "p7", "p8", "p9", "p10"],
    captainPlayerId: "p3",
  });
  teamData = buildRoundRobinMatchups(teamData, {
    lineupLockAt: "2099-01-01T08:30:00.000Z",
    scheduledAt: "2026-07-10T09:00:00.000Z",
    courtLabel: "1",
  });

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
  teamData = publishMatchupLineups(teamData, { matchupId: matchup.id }).teamData;

  return { teamData, matchup };
}

test("list referee matchups only after publish", () => {
  let { teamData, matchup } = buildPublishedFixture();
  const lockedData = {
    ...teamData,
    matchups: teamData.matchups.map((item) =>
      item.id === matchup.id ? { ...item, status: MATCHUP_STATUS.LOCKED } : item
    ),
  };

  assert.equal(listRefereeMatchups(lockedData).length, 0);
  assert.equal(listRefereeMatchups(teamData).length, 1);
});

test("build referee matchup view shows published sub matches and players", () => {
  const { teamData, matchup } = buildPublishedFixture();
  const view = buildRefereeMatchupView(teamData, matchup.id, players);

  assert.equal(view.ok, true);
  assert.equal(view.matchup.subMatches.length, teamData.disciplines.length);
  assert.equal(view.matchup.courtLabel, "1 Sân 1");
  assert.ok(view.matchup.subMatches[0].teamAPlayerNames.length > 0);
  assert.ok(view.matchup.subMatches[0].teamBPlayerNames.length > 0);
});

test("block score entry before publish", () => {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "A",
    playerIds: ["p1", "p2", "p4", "p5"],
    captainPlayerId: "p1",
  });
  teamData = addTeamToTournament(teamData, {
    id: "team-b",
    name: "B",
    playerIds: ["p3", "p6", "p7", "p8"],
    captainPlayerId: "p3",
  });
  teamData = buildRoundRobinMatchups(teamData);
  const matchup = teamData.matchups[0];
  const subMatchId = matchup.subMatches[0].id;

  const validation = validateSubMatchScoreInput({
    teamData,
    matchupId: matchup.id,
    subMatchId,
    score: { teamA: 11, teamB: 5 },
    confirm: true,
    permissions: [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.error, /chưa được công bố/);
});

test("save draft score for published sub match", () => {
  const { teamData, matchup } = buildPublishedFixture();
  const subMatchId = matchup.subMatches[0].id;

  const draft = saveSubMatchDraft(teamData, {
    matchupId: matchup.id,
    subMatchId,
    score: { teamA: 11, teamB: 5 },
    permissions: [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE],
  });

  assert.equal(draft.ok, true);
  const updated = draft.teamData.matchups[0].subMatches[0];
  assert.equal(updated.status, SUB_MATCH_STATUS.PLAYING);
  assert.equal(updated.score.teamA, 11);
  assert.equal(updated.winnerTeamId, "");
  assert.equal(draft.teamData.matchups[0].status, MATCHUP_STATUS.IN_PROGRESS);

  const aggregate = computeMatchupResult(draft.teamData, matchup.id);
  assert.equal(aggregate.result.teamAWins, 0);
});

test("confirm sub match determines winner and aggregate score", () => {
  const { teamData, matchup } = buildPublishedFixture();
  const subMatchId = matchup.subMatches[0].id;

  const confirmed = confirmSubMatchResult(teamData, {
    matchupId: matchup.id,
    subMatchId,
    score: { teamA: 11, teamB: 5 },
    permissions: [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE],
  });

  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.subMatch.winnerTeamId, "team-a");
  assert.equal(confirmed.matchupResult.teamAWins, 1);
  assert.equal(confirmed.matchupResult.teamBWins, 0);
  assert.equal(confirmed.matchupResult.winnerTeamId, "");

  const standings = getStandingsTable(confirmed.teamData);
  const teamAStanding = standings.find((row) => row.teamId === "team-a");
  const teamBStanding = standings.find((row) => row.teamId === "team-b");
  assert.equal(teamAStanding.played, 0);
  assert.equal(teamBStanding.played, 0);
  assert.equal(teamAStanding.subMatchDiff, 1);
  assert.equal(teamBStanding.subMatchDiff, -1);
});

test("reject tied score on confirm", () => {
  const { teamData, matchup } = buildPublishedFixture();
  const subMatchId = matchup.subMatches[0].id;

  const validation = validateSubMatchScoreInput({
    teamData,
    matchupId: matchup.id,
    subMatchId,
    score: { teamA: 10, teamB: 10 },
    confirm: true,
    permissions: [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.error, /bằng điểm/);
});

test("reject negative score", () => {
  const { teamData, matchup } = buildPublishedFixture();
  const subMatchId = matchup.subMatches[0].id;

  const validation = validateSubMatchScoreInput({
    teamData,
    matchupId: matchup.id,
    subMatchId,
    score: { teamA: -1, teamB: 5 },
    confirm: false,
    permissions: [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE],
  });

  assert.equal(validation.ok, false);
});

test("best of 3 format resolves winner from games", () => {
  let { teamData, matchup } = buildPublishedFixture();
  const discipline = teamData.disciplines[0];
  teamData.disciplines = teamData.disciplines.map((item) =>
    item.id === discipline.id
      ? {
          ...item,
          scoringFormat: { winPoints: 1, matchFormat: MATCH_FORMAT.BEST_OF_3 },
        }
      : item
  );

  const subMatchId = matchup.subMatches[0].id;
  const confirmed = confirmSubMatchResult(teamData, {
    matchupId: matchup.id,
    subMatchId,
    score: { teamA: 0, teamB: 0 },
    games: [
      { teamA: 11, teamB: 8 },
      { teamA: 9, teamB: 11 },
      { teamA: 11, teamB: 6 },
    ],
    permissions: [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE],
  });

  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.subMatch.score.teamA, 2);
  assert.equal(confirmed.subMatch.score.teamB, 1);
  assert.equal(confirmed.subMatch.winnerTeamId, "team-a");
});

test("full matchup completion updates standings", () => {
  let { teamData, matchup } = buildPublishedFixture();

  matchup.subMatches.forEach((subMatch, index) => {
    const score =
      index < 3
        ? { teamA: 11, teamB: 6 }
        : { teamA: 6, teamB: 11 };
    const result = confirmSubMatchResult(teamData, {
      matchupId: matchup.id,
      subMatchId: subMatch.id,
      score,
      permissions: [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE],
    });
    assert.equal(result.ok, true);
    teamData = result.teamData;
  });

  const withStandings = refreshStandings({
    id: "t1",
    mode: "team_tournament",
    teamData,
  });
  const standings = getStandingsTable(withStandings.teamData);

  assert.equal(withStandings.teamData.matchups[0].status, MATCHUP_STATUS.COMPLETED);
  assert.equal(withStandings.teamData.matchups[0].result.teamAWins, 3);
  assert.equal(withStandings.teamData.matchups[0].result.teamBWins, 1);
  assert.equal(standings[0].wins, 1);
  assert.equal(standings[1].losses, 1);
});

test("referee role can manage team match results", () => {
  const permissions = getPermissionsForRole(ROLES.REFEREE);
  assert.equal(canManageTeamMatchResult({ permissions }), true);
});

test("viewer without manage permission cannot edit confirmed result", () => {
  const refereePermissions = [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE];
  const adminPermissions = [PERMISSIONS.TOURNAMENT_UPDATE];

  assert.equal(
    canEditSubMatchResult(
      { status: SUB_MATCH_STATUS.COMPLETED },
      { permissions: refereePermissions }
    ),
    false
  );
  assert.equal(
    canEditSubMatchResult(
      { status: SUB_MATCH_STATUS.COMPLETED },
      { permissions: adminPermissions }
    ),
    true
  );
});

test("audit log records draft and confirm actions", () => {
  installAuditStorageMock();
  try {
    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT_DRAFT,
      targetId: "tournament-1",
      metadata: { matchupId: "m1", subMatchId: "s1" },
    });
    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT_CONFIRM,
      targetId: "tournament-1",
      metadata: { matchupId: "m1", subMatchId: "s1" },
    });
    appendTeamAuditLog({
      action: TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT_OVERRIDE,
      targetId: "tournament-1",
      metadata: { matchupId: "m1", subMatchId: "s1" },
    });

    const logs = listTeamAuditLogs(10);
    assert.equal(logs[0].action, TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT_OVERRIDE);
    assert.equal(logs[1].action, TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT_CONFIRM);
    assert.equal(logs[2].action, TEAM_AUDIT_ACTIONS.SUB_MATCH_RESULT_DRAFT);
  } finally {
    clearAuditStorageMock();
  }
});

test("list referee matchup summaries for mobile list view", () => {
  const { teamData } = buildPublishedFixture();
  const summaries = listRefereeMatchupSummaries(teamData, players);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].teamAName, "Future Arena");
  assert.equal(summaries[0].subMatches.length, teamData.disciplines.length);
});

test("block confirm when lineup not published", () => {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "A",
    playerIds: ["p1", "p2", "p4", "p5"],
    captainPlayerId: "p1",
  });
  teamData = addTeamToTournament(teamData, {
    id: "team-b",
    name: "B",
    playerIds: ["p3", "p6", "p7", "p8"],
    captainPlayerId: "p3",
  });
  teamData = buildRoundRobinMatchups(teamData);
  const matchup = teamData.matchups[0];
  teamData.matchups = teamData.matchups.map((item) =>
    item.id === matchup.id
      ? { ...item, status: MATCHUP_STATUS.PUBLISHED }
      : item
  );

  const validation = validateSubMatchScoreInput({
    teamData,
    matchupId: matchup.id,
    subMatchId: matchup.subMatches[0].id,
    score: { teamA: 11, teamB: 5 },
    confirm: true,
    permissions: [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.error, /đội hình chính thức/);
});
