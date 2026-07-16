import test from "node:test";
import assert from "node:assert/strict";

import {
  SHOWCASE_CLUB_SCOPE,
  SHOWCASE_STAGE,
  buildShowcaseActionGates,
  buildShowcaseAthleteCounters,
  buildShowcaseTeamConfiguration,
  canTransitionShowcaseStage,
  clearShowcaseAthleteSelection,
  generateShowcaseGroupDraw,
  generateShowcaseMatchupPreview,
  generateShowcaseTeamDraw,
  mergeShowcaseAthletePool,
  reduceShowcaseState,
  createInitialShowcaseState,
  selectAllEligibleShowcaseAthletes,
} from "../src/features/team-tournament/showcase/index.js";
import {
  TT_V6_TT32_ATHLETES,
  TT_V6_TT32_FIXTURE,
} from "../src/features/team-tournament/fixtures/ttV6Tt32StagingFixture.js";
import { TEAM_GROUP_SEEDING } from "../src/features/team-tournament/constants.js";
import { annotateShowcaseSessionEngineHashes } from "../src/features/team-tournament/setup/buildShowcasePreviewHashes.js";

function toPlayers(rows = TT_V6_TT32_ATHLETES) {
  return rows.map((row) => ({
    id: row.playerId,
    athleteId: row.playerId,
    name: row.displayName,
    gender: row.gender,
    ratingValue: row.rating,
    ratingSource: "pick_vn_current",
    clubId: TT_V6_TT32_FIXTURE.clubId,
    clubName: TT_V6_TT32_FIXTURE.clubName,
    membershipStatus: "active",
  }));
}

function fixedRandom() {
  let i = 0;
  const seq = [0.11, 0.42, 0.73, 0.28, 0.55, 0.91, 0.07, 0.63, 0.34, 0.88];
  return () => {
    const value = seq[i % seq.length];
    i += 1;
    return value;
  };
}

test("club scope: tenant merge dedupes athletes.id", () => {
  const clubAthletes = toPlayers().slice(0, 20);
  const tenantAthletes = toPlayers();
  const merged = mergeShowcaseAthletePool({
    scopeMode: SHOWCASE_CLUB_SCOPE.TENANT,
    clubAthletes,
    tenantAthletes,
  });
  assert.equal(merged.length, 32);
  assert.equal(new Set(merged.map((row) => row.id)).size, 32);
});

test("select all / clear all behavior", () => {
  const athletes = toPlayers();
  const all = selectAllEligibleShowcaseAthletes(athletes);
  assert.equal(all.length, 32);
  assert.deepEqual(clearShowcaseAthleteSelection(), []);
  const counters = buildShowcaseAthleteCounters(athletes, all);
  assert.equal(counters.selectedCount, 32);
  assert.equal(counters.selectedMale, 16);
  assert.equal(counters.selectedFemale, 16);
});

test("team configuration TT32: 8 teams, 0 waiting", () => {
  const athletes = toPlayers();
  const selected = athletes.map((row) => row.id);
  const config = buildShowcaseTeamConfiguration({
    athletes,
    selectedAthleteIds: selected,
    requestedTeamCount: 8,
  });
  assert.equal(config.expectedTeamCount, 8);
  assert.equal(config.expectedWaitingListCount, 0);
  assert.equal(config.canGenerateTeams, true);
});

test("team preview + group preview + explicit matchup generation", () => {
  const players = toPlayers();
  const teamDraw = generateShowcaseTeamDraw({
    players,
    selectedPlayerIds: players.map((row) => row.id),
    teamCount: 8,
    teamNamePrefix: TT_V6_TT32_FIXTURE.teamNamePrefix,
    randomFn: fixedRandom(),
    rulesVersion: "rules-tt32-v1",
  });
  assert.equal(teamDraw.ok, true);
  const annotated = annotateShowcaseSessionEngineHashes(teamDraw.session, {
    players,
    selectedPlayerIds: players.map((row) => row.id),
    teamCount: 8,
    rulesVersion: "rules-tt32-v1",
  });
  assert.equal(annotated.teamCards.length, 8);
  assert.ok(annotated.engineInputHash);
  assert.ok(annotated.engineOutputHash);

  const group2x4 = generateShowcaseGroupDraw(annotated, {
    groupCount: 2,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    rulesVersion: "rules-tt32-v1",
    randomFn: fixedRandom(),
  });
  assert.equal(group2x4.ok, true);
  assert.equal(group2x4.session.groupSession.groupCards.length, 2);

  const group4x2 = generateShowcaseGroupDraw(annotated, {
    groupCount: 4,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    rulesVersion: "rules-tt32-v1",
    randomFn: fixedRandom(),
  });
  assert.equal(group4x2.ok, true);
  assert.equal(group4x2.session.groupSession.groupCards.length, 4);

  const matchups = generateShowcaseMatchupPreview(group4x2.session, {
    rulesVersion: "rules-tt32-v1",
  });
  assert.equal(matchups.ok, true);
  assert.ok(matchups.matchupPreview.matchups.length > 0);
});

test("state machine guards block invalid transitions", () => {
  let state = createInitialShowcaseState();
  state = reduceShowcaseState(state, {
    type: "OPEN_LIVE",
    payload: { preflight: { ok: true } },
  });
  const blocked = canTransitionShowcaseStage(state, SHOWCASE_STAGE.TEAM_REVEAL, {
    session: null,
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /ghép đội/i);
});

test("replay cannot enter saving or regenerating", () => {
  const state = {
    ...createInitialShowcaseState(),
    mode: "replay",
    session: { teamCards: [{ id: "t1" }] },
    stage: SHOWCASE_STAGE.REPLAY,
  };
  const saveGuard = canTransitionShowcaseStage(state, SHOWCASE_STAGE.SAVING, {
    session: state.session,
    mode: "replay",
  });
  assert.equal(saveGuard.ok, false);
});

test("action gates disable generate when pool invalid", () => {
  const gates = buildShowcaseActionGates({
    counters: { availableEligible: 0, selectedCount: 0 },
    teamConfig: { canGenerateTeams: false, blockers: ["Chưa chọn VĐV hợp lệ."] },
    preflight: { ok: false, blockers: ["Thiếu rulesVersion"] },
    hasTeamPreview: false,
    hasGroupPreview: false,
  });
  assert.equal(gates.generateTeams.disabled, true);
  assert.ok(gates.generateTeams.reason);
  assert.equal(gates.confirmSave.disabled, true);
});
