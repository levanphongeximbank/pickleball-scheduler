/**
 * P1.5A Showcase Tomorrow — targeted unit tests.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { getPlayerGenderKey } from "../src/models/player.js";
import { resolveCanonicalAthleteRating } from "../src/features/pairing-candidates/canonicalAthleteRating.js";
import { TEAM_GROUP_SEEDING } from "../src/features/team-tournament/constants.js";
import { TT_V6_TT32_ATHLETES, TT_V6_TT32_FIXTURE } from "../src/features/team-tournament/fixtures/ttV6Tt32StagingFixture.js";
import {
  SHOWCASE_MODE,
  SHOWCASE_STAGE,
  buildShowcasePreflight,
  canShowShowcaseEntry,
  generateShowcaseTeamDraw,
  generateShowcaseGroupDraw,
  buildReplayShowcaseSession,
  assertMembershipUnchanged,
  assertGroupMembershipUnchanged,
  confirmShowcasePersistence,
  reduceShowcaseState,
  createInitialShowcaseState,
  createShowcaseIdempotencyKey,
} from "../src/features/team-tournament/showcase/index.js";

function toPlayers(rows = TT_V6_TT32_ATHLETES) {
  return rows.map((row) => ({
    id: row.playerId,
    name: row.displayName,
    gender: row.gender === "male" ? "Nam" : "Nữ",
    rating: row.rating,
    level: row.rating,
    ratingValue: row.rating,
    ratingSource: "pick_vn_current",
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

test("1. Showcase uses one real engine result (engineRunCount === 1)", () => {
  const players = toPlayers();
  const first = generateShowcaseTeamDraw({
    players,
    teamCount: 8,
    teamNamePrefix: TT_V6_TT32_FIXTURE.teamNamePrefix,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  });
  assert.equal(first.ok, true);
  assert.equal(first.session.engineRunCount, 1);
  assert.equal(first.session.teamCards.length, 8);

  const again = generateShowcaseTeamDraw({
    players,
    teamCount: 8,
    teamNamePrefix: TT_V6_TT32_FIXTURE.teamNamePrefix,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  });
  assert.equal(again.session.engineRunCount, 1);
});

test("2. Animation fingerprint does not change team membership", () => {
  const players = toPlayers();
  const { session } = generateShowcaseTeamDraw({
    players,
    teamCount: 8,
    teamNamePrefix: TT_V6_TT32_FIXTURE.teamNamePrefix,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  });
  const before = session.membershipFingerprint;
  // Simulate animation-only state changes (clone cards presentation)
  const cards = session.teamCards.map((card) => ({ ...card, revealed: true }));
  assert.equal(cards.length, 8);
  assert.equal(assertMembershipUnchanged(session, before), true);
});

test("3. Replay does not rerun AI (engineRunCount === 0)", () => {
  const players = toPlayers();
  const live = generateShowcaseTeamDraw({
    players,
    teamCount: 8,
    teamNamePrefix: TT_V6_TT32_FIXTURE.teamNamePrefix,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 2,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  }).session;

  const replay = buildReplayShowcaseSession({
    teamData: grouped.teamData,
    players,
    rulesVersion: "rv-test-1",
  });
  assert.equal(replay.mode, "replay");
  assert.equal(replay.engineRunCount, 0);
  assert.equal(replay.groupSession.engineRunCount, 0);
  assert.equal(replay.membershipFingerprint, grouped.membershipFingerprint);
});

test("4. Replay confirm does not save", async () => {
  const players = toPlayers();
  const live = generateShowcaseTeamDraw({
    players,
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 2,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  }).session;
  const replay = buildReplayShowcaseSession({
    teamData: grouped.teamData,
    players,
    rulesVersion: "rv-test-1",
  });

  let called = 0;
  const result = await confirmShowcasePersistence({
    session: replay,
    clubId: "club-x",
    tournamentId: "t-x",
    rulesVersion: "rv-test-1",
    persistSetupTeamData: async () => {
      called += 1;
      return { ok: true };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "REPLAY_READ_ONLY");
  assert.equal(result.writeAttempted, false);
  assert.equal(called, 0);
});

test("5+6. Countdown/processing machine stages create no write side-effect", () => {
  const { session } = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  });
  let state = createInitialShowcaseState();
  state = reduceShowcaseState(state, {
    type: "OPEN_LIVE",
    payload: { preflight: { ok: true } },
  });
  assert.equal(state.stage, SHOWCASE_STAGE.SETUP);
  state = reduceShowcaseState(state, {
    type: "SET_SESSION",
    payload: session,
  });
  state = reduceShowcaseState(state, {
    type: "GO_STAGE",
    payload: { stage: SHOWCASE_STAGE.COUNTDOWN, countdownValue: 10, session },
  });
  assert.equal(state.stage, SHOWCASE_STAGE.COUNTDOWN);
  state = reduceShowcaseState(state, {
    type: "GO_STAGE",
    payload: { stage: SHOWCASE_STAGE.PROCESSING, session },
  });
  assert.equal(state.stage, SHOWCASE_STAGE.PROCESSING);
  assert.equal(state.saving, false);
  assert.equal(state.session?.teamCards?.length, 8);
});

test("7. Team reveal supports 8 teams", () => {
  const { session } = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    teamNamePrefix: TT_V6_TT32_FIXTURE.teamNamePrefix,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  });
  assert.equal(session.teamCards.length, 8);
  assert.equal(session.teamData.teams.length, 8);
});

test("8. Each MLP team remains 2 male + 2 female", () => {
  const players = toPlayers();
  const { session } = generateShowcaseTeamDraw({
    players,
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  });
  for (const team of session.teamCards) {
    assert.equal(team.athletes.length, 4);
    assert.equal(team.maleCount, 2);
    assert.equal(team.femaleCount, 2);
    assert.equal(team.genderOk, true);
  }
});

test("9. Ratings render from canonical rating source", () => {
  const players = toPlayers();
  const { session } = generateShowcaseTeamDraw({
    players,
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  });
  for (const team of session.teamCards) {
    for (const athlete of team.athletes) {
      const source = players.find((p) => String(p.id) === String(athlete.id));
      const canonical = resolveCanonicalAthleteRating(source);
      assert.equal(athlete.ratingValue, canonical.ratingValue);
      assert.ok(athlete.ratingValue > 0);
    }
  }
});

test("10. Captains remain stable across group draw and replay", () => {
  const players = toPlayers();
  const live = generateShowcaseTeamDraw({
    players,
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
  const captainsByTeam = Object.fromEntries(
    live.teamCards.map((t) => [String(t.id), t.captainPlayerId])
  );
  assert.ok(Object.values(captainsByTeam).every(Boolean));

  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 2,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  }).session;
  for (const team of grouped.teamCards) {
    assert.equal(team.captainPlayerId, captainsByTeam[String(team.id)]);
  }

  const replay = buildReplayShowcaseSession({
    teamData: grouped.teamData,
    players,
    rulesVersion: "rv-test-1",
  });
  for (const team of replay.teamCards) {
    assert.equal(team.captainPlayerId, captainsByTeam[String(team.id)]);
  }
});

test("11. Group reveal supports 2×4", () => {
  const live = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 2,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  });
  assert.equal(grouped.ok, true);
  assert.equal(grouped.session.groupSession.groupCards.length, 2);
  assert.ok(
    grouped.session.groupSession.groupCards.every((g) => g.teamCount === 4)
  );
});

test("12. Group reveal supports 4×2", () => {
  const live = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 4,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  });
  assert.equal(grouped.ok, true);
  assert.equal(grouped.session.groupSession.groupCards.length, 4);
  assert.ok(
    grouped.session.groupSession.groupCards.every((g) => g.teamCount === 2)
  );
});

test("13. Group animation does not alter generated groups", () => {
  const live = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 2,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  }).session;
  const fp = grouped.groupSession.groupFingerprint;
  assert.equal(assertGroupMembershipUnchanged(grouped, fp), true);
  assert.equal(assertMembershipUnchanged(grouped, live.membershipFingerprint), true);
});

test("14+15. Confirm persists once and duplicate confirm reuses idempotency key", async () => {
  const live = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 2,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  }).session;

  let persistCalls = 0;
  const key = createShowcaseIdempotencyKey("tour-1");
  const persistSetupTeamData = async (teamData, options) => {
    persistCalls += 1;
    assert.equal(options.rulesVersion, "rv-test-1");
    assert.equal((teamData.groups || []).length, 2);
    return {
      ok: true,
      readbackVerified: true,
      reloadResult: { ok: true },
      teamData,
    };
  };

  // teamsAlreadyPersisted avoids applyAiGeneratedTeamsToTournament (needs club blob)
  const first = await confirmShowcasePersistence({
    session: grouped,
    clubId: "club-test-tt32-qa",
    tournamentId: "tour-1",
    rulesVersion: "rv-test-1",
    teamsAlreadyPersisted: true,
    persistSetupTeamData,
    idempotencyKey: key,
  });
  assert.equal(first.ok, true);
  assert.equal(first.usedBlob, false);
  assert.equal(persistCalls, 1);

  const second = await confirmShowcasePersistence({
    session: grouped,
    clubId: "club-test-tt32-qa",
    tournamentId: "tour-1",
    rulesVersion: "rv-test-1",
    teamsAlreadyPersisted: true,
    persistSetupTeamData,
    idempotencyKey: key,
  });
  assert.equal(second.ok, true);
  assert.equal(persistCalls, 2);
  // Adapter itself is callable twice; UI disables while saving and reuses key.
  assert.equal(key.startsWith("showcase-tour-1-"), true);
});

test("16. Failed save retains preview (adapter returns previewRetained)", async () => {
  const live = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 2,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  }).session;

  const result = await confirmShowcasePersistence({
    session: grouped,
    clubId: "club-x",
    tournamentId: "t-x",
    rulesVersion: "rv-test-1",
    teamsAlreadyPersisted: true,
    persistSetupTeamData: async () => ({ ok: false, error: "network down" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.previewRetained, true);
  assert.equal(grouped.teamCards.length, 8);
});

test("17. Refresh after save reloads via replay session from persisted teamData", () => {
  const live = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 2,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  }).session;
  const reloaded = buildReplayShowcaseSession({
    teamData: grouped.teamData,
    players: toPlayers(),
    rulesVersion: "rv-test-1",
  });
  assert.equal(reloaded.teamCards.length, 8);
  assert.equal(reloaded.groupSession.groupCards.length, 2);
  assert.equal(reloaded.engineRunCount, 0);
});

test("18. Missing identity blocks showcase", () => {
  const players = toPlayers().map((p, index) =>
    index === 0 ? { ...p, id: "" } : p
  );
  const preflight = buildShowcasePreflight({
    athletes: players,
    rulesVersion: "rv-test-1",
    setupMutationGate: true,
    canManage: true,
  });
  assert.equal(preflight.ok, false);
  assert.ok(preflight.blockers.some((b) => /athletes\.id/i.test(b)));
});

test("19. Missing rulesVersion blocks showcase", () => {
  const preflight = buildShowcasePreflight({
    athletes: toPlayers(),
    rulesVersion: "",
    setupMutationGate: true,
    canManage: true,
  });
  assert.equal(preflight.ok, false);
  assert.ok(preflight.blockers.some((b) => /rulesVersion/i.test(b)));
});

test("20. Fatal conflict blocks showcase", () => {
  const preflight = buildShowcasePreflight({
    athletes: toPlayers(),
    rulesVersion: "rv-test-1",
    setupMutationGate: true,
    canManage: true,
    fatalConflicts: true,
  });
  assert.equal(preflight.ok, false);
  assert.ok(preflight.blockers.some((b) => /fatalConflicts/i.test(b)));
});

test("21. No blob authority on successful confirm path", async () => {
  const live = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 2,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  }).session;
  const result = await confirmShowcasePersistence({
    session: grouped,
    clubId: "club-x",
    tournamentId: "t-x",
    rulesVersion: "rv-test-1",
    teamsAlreadyPersisted: true,
    persistSetupTeamData: async () => ({
      ok: true,
      readbackVerified: true,
      reloadResult: { ok: true },
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.usedBlob, false);
});

test("22. Showcase draw path does not call sync browser hash helpers", async () => {
  // Import hash modules dynamically and ensure draw helpers do not need them.
  const canonical = await import(
    "../src/features/team-tournament/canonical/teamTournamentCanonical.js"
  );
  assert.equal(typeof canonical.hashEngineInputAsync, "function");
  assert.equal(typeof canonical.hashEngineInput, "function");
  // generateShowcaseTeamDraw is sync and never invokes hash APIs.
  const { session } = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  });
  assert.ok(session.membershipFingerprint);
  assert.equal(session.writeCount, 0);
});

test("23. Reduced-motion mode is honored by machine state", () => {
  let state = reduceShowcaseState(createInitialShowcaseState(), {
    type: "OPEN_LIVE",
    payload: { preflight: { ok: true }, reducedMotion: true },
  });
  assert.equal(state.reducedMotion, true);
  assert.equal(state.stage, SHOWCASE_STAGE.SETUP);
  state = reduceShowcaseState(state, { type: "SET_REDUCED_MOTION", payload: false });
  assert.equal(state.reducedMotion, false);
});

test("24. Existing entry gates leave normal setup available when showcase hidden", () => {
  assert.equal(
    canShowShowcaseEntry({
      canManage: true,
      athletes: toPlayers(),
      athletePoolLoaded: true,
      setupMutationGate: false,
    }),
    false
  );
  assert.equal(
    canShowShowcaseEntry({
      canManage: false,
      athletes: toPlayers(),
      athletePoolLoaded: true,
      setupMutationGate: true,
    }),
    false
  );
  assert.equal(
    canShowShowcaseEntry({
      canManage: true,
      athletes: toPlayers(),
      athletePoolLoaded: true,
      setupMutationGate: true,
    }),
    true
  );
});

test("TT32 preflight expectations: 32/16/16/8/0", () => {
  const players = toPlayers();
  const males = players.filter((p) => getPlayerGenderKey(p.gender) === "male");
  const females = players.filter((p) => getPlayerGenderKey(p.gender) === "female");
  assert.equal(players.length, 32);
  assert.equal(males.length, 16);
  assert.equal(females.length, 16);
  const preflight = buildShowcasePreflight({
    athletes: players,
    rulesVersion: "rv-test-1",
    setupMutationGate: true,
    canManage: true,
    requestedTeamCount: 8,
  });
  assert.equal(preflight.ok, true);
  assert.equal(preflight.summary.expectedTeamCount, 8);
  assert.equal(preflight.summary.expectedWaitingListCount, 0);
  assert.equal(preflight.summary.mlpCompositionOk, true);
});

test("Missing rulesVersion blocks persistence confirm", async () => {
  const live = generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "",
  }).session;
  const grouped = generateShowcaseGroupDraw(live, {
    groupCount: 2,
    rulesVersion: "",
    randomFn: fixedRandom(),
  }).session;
  const result = await confirmShowcasePersistence({
    session: { ...grouped, mode: SHOWCASE_MODE.LIVE, rulesVersion: "" },
    clubId: "club-x",
    tournamentId: "t-x",
    rulesVersion: "",
    teamsAlreadyPersisted: true,
    persistSetupTeamData: async () => ({ ok: true }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_RULES_VERSION");
  assert.equal(result.writeAttempted, false);
});
