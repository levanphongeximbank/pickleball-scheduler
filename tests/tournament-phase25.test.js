import test from "node:test";
import assert from "node:assert/strict";

import {
  addTeamToTournament,
  buildRoundRobinMatchups,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import {
  checkPlayerEligibility,
  ELIGIBILITY_VIOLATION,
  updateEligibilityRules,
  checkAllTeamsEligibility,
} from "../src/features/team-tournament/engines/eligibilityEngine.js";
import {
  getEntryFeeSummary,
  PAYMENT_STATUS,
  recordTeamPayment,
  setEntryFee,
} from "../src/features/team-tournament/engines/entryFeeEngine.js";
import {
  lockPublishedSchedule,
  publishSchedule,
  SCHEDULE_PUBLISH_STATUS,
} from "../src/features/team-tournament/engines/publishScheduleEngine.js";
import {
  addReferee,
  assignReferee,
  buildRefereeAssignmentTable,
  getRefereeForMatch,
} from "../src/features/team-tournament/engines/refereeAssignEngine.js";
import {
  approveWithdrawal,
  isTeamWithdrawn,
  requestWithdrawal,
  WITHDRAWAL_STATUS,
} from "../src/features/team-tournament/engines/withdrawalEngine.js";
import { buildAwardsSheet } from "../src/features/team-tournament/engines/awardsEngine.js";
import { recordSubMatchResult } from "../src/features/team-tournament/engines/teamResultEngine.js";

const players = [
  { id: "p1", name: "Nam A", gender: "Nam", birthYear: 1995, level: 3.5 },
  { id: "p2", name: "Nam B", gender: "Nam", birthYear: 2012, level: 2.0 },
  { id: "p3", name: "Nu A", gender: "Nữ", birthYear: 1998, level: 4.0 },
];

function buildTeamData() {
  let teamData = initializeTeamTournamentData();
  teamData = updateEligibilityRules(teamData, {
    age: { enabled: true, minAge: 18, maxAge: 50, asOfDate: "2026-01-01" },
    gender: { enabled: true, allowedGenders: ["male", "female"] },
    skill: { enabled: true, minLevel: 2.5, maxLevel: 4.5 },
  }).teamData;
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "Team A",
    playerIds: ["p1", "p2", "p3"],
  });
  teamData = addTeamToTournament(teamData, {
    id: "team-b",
    name: "Team B",
    playerIds: [],
  });
  return buildRoundRobinMatchups(teamData, {
    scheduledAt: "2026-07-10T08:00:00.000Z",
  });
}

test("eligibility engine flags age, gender, and skill violations", () => {
  const rules = updateEligibilityRules(initializeTeamTournamentData(), {
    age: { enabled: true, minAge: 18, maxAge: 50, asOfDate: "2026-01-01" },
    gender: { enabled: true, allowedGenders: ["male"] },
    skill: { enabled: true, minLevel: 3.0, maxLevel: 4.0 },
  }).rules;

  const young = checkPlayerEligibility(players[1], rules);
  assert.equal(young.ok, false);
  assert.ok(
    young.violations.some((item) => item.code === ELIGIBILITY_VIOLATION.AGE_TOO_YOUNG)
  );

  const female = checkPlayerEligibility(players[2], rules);
  assert.equal(female.ok, false);
  assert.ok(
    female.violations.some((item) => item.code === ELIGIBILITY_VIOLATION.GENDER_NOT_ALLOWED)
  );

  const teamData = buildTeamData();
  const report = checkAllTeamsEligibility(teamData, players);
  assert.equal(report.ok, false);
  assert.equal(report.teams[0].players.some((item) => !item.ok), true);
});

test("entry fee engine tracks team payments", () => {
  let teamData = buildTeamData();
  const feeResult = setEntryFee(teamData, {
    enabled: true,
    amount: 500000,
    perPlayer: false,
  });
  assert.equal(feeResult.ok, true);

  const unpaid = getEntryFeeSummary(feeResult.teamData);
  assert.equal(unpaid.unpaidCount, 2);

  const paid = recordTeamPayment(feeResult.teamData, "team-a", {
    status: PAYMENT_STATUS.PAID,
    amountPaid: 500000,
  });
  assert.equal(paid.ok, true);

  const summary = getEntryFeeSummary(paid.teamData);
  assert.equal(summary.rows.find((row) => row.teamId === "team-a")?.paid, true);
});

test("publish schedule engine publishes and locks schedule", () => {
  const teamData = buildTeamData();
  const published = publishSchedule(teamData, { userId: "btc" });
  assert.equal(published.ok, true);
  assert.equal(published.schedulePublish.status, SCHEDULE_PUBLISH_STATUS.PUBLISHED);

  const locked = lockPublishedSchedule(published.teamData, { userId: "btc" });
  assert.equal(locked.ok, true);
  assert.equal(locked.schedulePublish.status, SCHEDULE_PUBLISH_STATUS.LOCKED);
});

test("referee assign engine maps match to referee", () => {
  let teamData = buildTeamData();
  teamData = addReferee(teamData, { id: "ref-1", name: "Ref A" }).teamData;
  const matchupId = teamData.matchups[0].id;

  const assigned = assignReferee(teamData, matchupId, "ref-1");
  assert.equal(assigned.ok, true);
  assert.equal(getRefereeForMatch(assigned.teamData, matchupId)?.id, "ref-1");

  const table = buildRefereeAssignmentTable(assigned.teamData);
  assert.equal(table[0].assigned, true);
});

test("withdrawal engine approves team withdrawal", () => {
  let teamData = buildTeamData();
  const requested = requestWithdrawal(teamData, {
    teamId: "team-a",
    reason: "Không đủ người",
  });
  assert.equal(requested.ok, true);
  assert.equal(requested.withdrawal.status, WITHDRAWAL_STATUS.PENDING);

  const approved = approveWithdrawal(requested.teamData, requested.withdrawal.id);
  assert.equal(approved.ok, true);
  assert.equal(isTeamWithdrawn(approved.teamData, "team-a"), true);
});

test("awards engine builds sheet from standings", () => {
  let teamData = buildTeamData();
  const matchup = teamData.matchups[0];
  for (const subMatch of matchup.subMatches) {
    teamData = recordSubMatchResult(teamData, {
      matchupId: matchup.id,
      subMatchId: subMatch.id,
      winnerTeamId: matchup.teamAId,
      score: { teamA: 11, teamB: 3 },
    }).teamData;
  }

  const sheet = buildAwardsSheet(teamData);
  assert.ok(sheet.awards.length >= 2);
  assert.equal(sheet.awards[0].key, "champion");
  assert.ok(sheet.awards[0].teamName);
});
