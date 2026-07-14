import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { SCORING_SYSTEM } from "../src/features/team-tournament/constants.js";
import { DISCIPLINE_CATEGORY } from "../src/features/team-tournament/constants.js";
import {
  SCORING_VARIANT,
  RULE_SET_ID,
  SCORING_SYSTEM as V5_SCORING_SYSTEM,
} from "../src/features/referee-v5/constants/scoringStrategy.js";
import {
  applyOfficialResultRevision,
  assertProvisionScoringAllowed,
  assertScoringFormatImmutable,
  buildUsap2026RallyDoublesScoringFormat,
  buildSideOutScoringFormat,
  isUsap2026RallyDoublesConfig,
  mapRefereeV5ResultToSubMatch,
  mapTtScoringToV5StateFields,
  resolveBestOfMatchOutcome,
  resolveOfficialScoringConfig,
  shouldUpdateStandingsFromRefereeEvent,
  summarizeOfficialResultForStandings,
  isLegacyScoreBlocked,
  canSaveLegacyDraft,
  canConfirmLegacyResult,
} from "../src/features/team-tournament/engines/teamRefereeV5BridgeEngine.js";

describe("R2-2G configuration hierarchy", () => {
  it("1. tournament default Rally config", () => {
    const resolved = resolveOfficialScoringConfig({
      tournamentSettings: { scoringFormat: buildUsap2026RallyDoublesScoringFormat() },
    });
    assert.equal(resolved.scoringSystem, SCORING_SYSTEM.RALLY);
    assert.equal(resolved.scoringVariant, SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY);
    assert.equal(resolved.pointsToWin, 11);
    assert.equal(resolved.source, "tournament");
    assert.equal(resolved.supported, true);
  });

  it("2. discipline override", () => {
    const resolved = resolveOfficialScoringConfig({
      tournamentSettings: { scoringFormat: buildSideOutScoringFormat({ targetScore: 21 }) },
      discipline: { scoringFormat: buildUsap2026RallyDoublesScoringFormat({ matchFormat: "best_of_3" }) },
    });
    assert.equal(resolved.scoringSystem, SCORING_SYSTEM.RALLY);
    assert.equal(resolved.bestOf, 3);
    assert.equal(resolved.source, "discipline");
  });

  it("3. sub-match override", () => {
    const resolved = resolveOfficialScoringConfig({
      tournamentSettings: { scoringFormat: buildSideOutScoringFormat() },
      discipline: { scoringFormat: buildSideOutScoringFormat({ targetScore: 15 }) },
      subMatch: { scoringFormat: buildUsap2026RallyDoublesScoringFormat() },
    });
    assert.equal(resolved.scoringSystem, SCORING_SYSTEM.RALLY);
    assert.equal(resolved.pointsToWin, 11);
    assert.equal(resolved.source, "sub_match");
  });

  it("4. unsupported Singles Rally rejected", () => {
    process.env.VITE_TT5_REFEREE_V5_RALLY_ENABLED = "true";
    const resolved = resolveOfficialScoringConfig({
      discipline: { scoringFormat: buildUsap2026RallyDoublesScoringFormat() },
    });
    const gate = assertProvisionScoringAllowed(resolved, DISCIPLINE_CATEGORY.SINGLES);
    assert.equal(gate.ok, false);
    assert.equal(gate.code, "UNSUPPORTED_SCORING_VARIANT");
  });

  it("4b. MLP freeze Rally rejected", () => {
    process.env.VITE_TT5_REFEREE_V5_RALLY_ENABLED = "true";
    const resolved = resolveOfficialScoringConfig({
      discipline: {
        scoringFormat: {
          scoringSystem: SCORING_SYSTEM.RALLY,
          targetScore: 21,
          winBy: 2,
          freezeAt: 20,
        },
      },
    });
    assert.equal(resolved.supported, false);
    const gate = assertProvisionScoringAllowed(resolved, "doubles");
    assert.equal(gate.ok, false);
  });

  it("5. format immutable after provision/start", () => {
    const prev = buildUsap2026RallyDoublesScoringFormat();
    const next = buildSideOutScoringFormat();
    const locked = assertScoringFormatImmutable({
      previousFormat: prev,
      nextFormat: next,
      refereeLinkStatus: "provisioned",
    });
    assert.equal(locked.ok, false);
    assert.equal(locked.code, "SCORING_FORMAT_IMMUTABLE");

    const started = assertScoringFormatImmutable({
      previousFormat: prev,
      nextFormat: next,
      matchStatus: "in_progress",
    });
    assert.equal(started.ok, false);

    const free = assertScoringFormatImmutable({
      previousFormat: prev,
      nextFormat: next,
      refereeLinkStatus: "none",
    });
    assert.equal(free.ok, true);
  });
});

describe("R2-2G provision mapping", () => {
  before(() => {
    process.env.VITE_TT5_REFEREE_V5_RALLY_ENABLED = "true";
  });
  after(() => {
    delete process.env.VITE_TT5_REFEREE_V5_RALLY_ENABLED;
  });

  it("6-8. Rally maps to V5 state fields with correct variant/points", () => {
    const resolved = resolveOfficialScoringConfig({
      discipline: { scoringFormat: buildUsap2026RallyDoublesScoringFormat({ matchFormat: "best_of_3" }) },
    });
    const mapped = mapTtScoringToV5StateFields(resolved, "doubles");
    assert.equal(mapped.ok, true);
    assert.equal(mapped.scoringSystem, V5_SCORING_SYSTEM.RALLY);
    assert.equal(mapped.scoringVariant, SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY);
    assert.equal(mapped.ruleSetId, RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1);
    assert.equal(mapped.pointsToWin, 11);
    assert.equal(mapped.winBy, 2);
    assert.equal(mapped.bestOf, 3);
    assert.equal(mapped.freezeRule, "NONE");
    assert.equal(mapped.serverNumberRule, "NONE");
    assert.equal(mapped.serverNumber, null);
    assert.equal(mapped.matchType, "doubles");
  });

  it("9-10. idempotent identity + no duplicate conceptual match id", () => {
    assert.equal(isUsap2026RallyDoublesConfig(buildUsap2026RallyDoublesScoringFormat()), true);
    const a = mapTtScoringToV5StateFields(
      resolveOfficialScoringConfig({
        discipline: { scoringFormat: buildUsap2026RallyDoublesScoringFormat() },
      }),
      "doubles",
    );
    const b = mapTtScoringToV5StateFields(
      resolveOfficialScoringConfig({
        discipline: { scoringFormat: buildUsap2026RallyDoublesScoringFormat() },
      }),
      "doubles",
    );
    assert.deepEqual(a, b);
  });

  it("rally flag off blocks provision", () => {
    process.env.VITE_TT5_REFEREE_V5_RALLY_ENABLED = "false";
    const resolved = resolveOfficialScoringConfig({
      discipline: { scoringFormat: buildUsap2026RallyDoublesScoringFormat() },
    });
    const gate = assertProvisionScoringAllowed(resolved, "doubles");
    assert.equal(gate.ok, false);
    assert.equal(gate.code, "RALLY_PROVISION_DISABLED");
    process.env.VITE_TT5_REFEREE_V5_RALLY_ENABLED = "true";
  });
});

describe("R2-2G legacy lock", () => {
  it("11. legacy scoring blocked for V5-linked match", () => {
    const ops = {
      canSaveDraft: false,
      canConfirm: false,
      blockCode: "referee_v5_linked_legacy_write_blocked",
    };
    assert.equal(isLegacyScoreBlocked(ops), true);
    assert.equal(canSaveLegacyDraft(ops), false);
    assert.equal(canConfirmLegacyResult(ops), false);
  });

  it("12. Side-Out legacy unchanged when not linked", () => {
    const ops = { canSaveDraft: true, canConfirm: true, blockCode: null };
    assert.equal(canSaveLegacyDraft(ops), true);
    assert.equal(canConfirmLegacyResult(ops), true);
  });
});

describe("R2-2G result consumer + standings", () => {
  const matchup = { teamAId: "team-a", teamBId: "team-b" };

  it("13-15. final Rally result updates sub-match winner and team points", () => {
    const mapped = mapRefereeV5ResultToSubMatch({
      revision: {
        id: "rev-r1",
        revision: 1,
        status: "confirmed",
        officialScore: { teamA: 11, teamB: 7 },
        winnerId: "team-a",
        games: [{ teamA: 11, teamB: 7 }],
      },
      matchup,
    });
    assert.equal(mapped.ok, true);
    assert.equal(mapped.winnerTeamId, "team-a");
    assert.equal(mapped.score.teamA, 11);
    const standings = summarizeOfficialResultForStandings({
      winnerTeamId: mapped.winnerTeamId,
      score: mapped.score,
      games: mapped.score.games,
      winPoints: 1,
    });
    assert.equal(standings.teamPointsAwarded, 1);
    assert.equal(standings.gameWinsA, 1);
  });

  it("16-18. standings once + duplicate ignored + stale rejected", () => {
    const first = applyOfficialResultRevision({
      previousAppliedRevision: null,
      incomingRevision: { revision: 1, winnerId: "team-a" },
    });
    assert.equal(first.ok, true);
    assert.equal(first.duplicate, false);

    const dup = applyOfficialResultRevision({
      previousAppliedRevision: 1,
      incomingRevision: { revision: 1, winnerId: "team-a" },
      previousEffect: first.effect,
    });
    assert.equal(dup.duplicate, true);

    const stale = applyOfficialResultRevision({
      previousAppliedRevision: 2,
      incomingRevision: { revision: 1, winnerId: "team-b" },
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, "STALE_REVISION");
  });

  it("19. correction revision safely replaces result", () => {
    const corrected = applyOfficialResultRevision({
      previousAppliedRevision: 1,
      incomingRevision: { revision: 2, winnerId: "team-b", officialScore: { teamA: 9, teamB: 11 } },
      previousEffect: { revision: 1, winnerId: "team-a" },
    });
    assert.equal(corrected.ok, true);
    assert.equal(corrected.duplicate, false);
    assert.equal(corrected.reversedPrevious.winnerId, "team-a");
    assert.equal(corrected.effect.winnerId, "team-b");
  });

  it("20-21. live event / undo before finalize do not update standings", () => {
    assert.equal(shouldUpdateStandingsFromRefereeEvent("POINT_SCORED", false), false);
    assert.equal(shouldUpdateStandingsFromRefereeEvent("EVENT_REVERTED", false), false);
    assert.equal(shouldUpdateStandingsFromRefereeEvent("UNDO", false), false);
    assert.equal(shouldUpdateStandingsFromRefereeEvent("REFEREE_MATCH_FINALIZED", true), true);
  });
});

describe("R2-2G best-of", () => {
  it("22. 2-0 accepted without forced third game", () => {
    const outcome = resolveBestOfMatchOutcome(
      [
        { teamA: 11, teamB: 5 },
        { teamA: 11, teamB: 8 },
      ],
      3,
    );
    assert.equal(outcome.complete, true);
    assert.equal(outcome.gamesPlayed, 2);
    assert.equal(outcome.winsA, 2);
    assert.equal(outcome.forcedThirdGame, false);
    assert.equal(outcome.unnecessaryThirdGame, true);
  });

  it("23. 2-1 accepted", () => {
    const outcome = resolveBestOfMatchOutcome(
      [
        { teamA: 11, teamB: 5 },
        { teamA: 8, teamB: 11 },
        { teamA: 11, teamB: 9 },
      ],
      3,
    );
    assert.equal(outcome.complete, true);
    assert.equal(outcome.gamesPlayed, 3);
    assert.equal(outcome.winsA, 2);
    assert.equal(outcome.winsB, 1);
  });

  it("24. no forced third game after 2-0", () => {
    const outcome = resolveBestOfMatchOutcome(
      [
        { teamA: 11, teamB: 4 },
        { teamA: 11, teamB: 6 },
        { teamA: 0, teamB: 0 },
      ],
      3,
    );
    assert.equal(outcome.gamesPlayed, 2);
    assert.equal(outcome.winnerSide, "teamA");
  });
});

describe("R2-2G Side-Out result contract shape", () => {
  it("25. Side-Out official result uses same mapper shape", () => {
    const mapped = mapRefereeV5ResultToSubMatch({
      revision: {
        revision: 1,
        status: "confirmed",
        officialScore: { teamA: 21, teamB: 18 },
        winnerId: "team-a",
      },
      matchup: { teamAId: "team-a", teamBId: "team-b" },
    });
    assert.equal(mapped.ok, true);
    assert.ok(mapped.score);
    assert.equal(mapped.status, "completed");
  });
});
