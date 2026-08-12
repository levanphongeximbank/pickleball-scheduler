/**
 * Lifecycle closure contracts for PR #418 (local package + client engines).
 * STAGING_MUTATIONS=0 — does not apply SQL.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { COMPETITION_STAGE, MATCHUP_STATUS } from "../src/features/team-tournament/constants.js";
import {
  assertCloseReadinessFromCanonical,
  CLOSE_READINESS_CODES,
} from "../src/features/team-tournament/engines/teamCloseReadiness.js";
import {
  deriveFirstEliminationStage,
  deriveTotalQualifiedTeams,
  resolveQualificationProgression,
} from "../src/features/team-tournament/engines/teamQualificationProgression.js";
import {
  normalizeStageScoringPolicy,
  resolveEffectiveStageScoringPolicy,
  stageScoringToFormat,
  validateStageScoringPolicyShape,
} from "../src/features/team-tournament/engines/teamStageScoringPolicy.js";
import { resolveMatchupCompetitionStage } from "../src/features/team-tournament/engines/teamStageTieBreakPolicy.js";
import { MATCHUP_STAGE } from "../src/features/team-tournament/engines/teamKnockoutEngine.js";
import { isTeamTournamentClosed } from "../src/features/team-tournament/engines/teamClosingEngine.js";
import { describeRepositoryFailureCode } from "../src/features/team-tournament/repositories/teamTournamentRepositoryValidation.js";
import { isSetupMutationRpcDeployed } from "../src/features/team-tournament/setup/setupMutationRpcRegistry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkg = join(root, "docs/v5/migrations/team-tournament-post-lineup-complete-lifecycle-01");

function sha256Lf(name) {
  const text = readFileSync(join(pkg, name), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function completedMatchup(id, stage, winner, extras = {}) {
  return {
    id,
    stage,
    status: MATCHUP_STATUS.COMPLETED,
    teamAId: "team-a",
    teamBId: "team-b",
    result: {
      winnerTeamId: winner,
      teamAWins: winner === "team-a" ? 3 : 1,
      teamBWins: winner === "team-b" ? 3 : 1,
      teamAPoints: winner === "team-a" ? 33 : 21,
      teamBPoints: winner === "team-b" ? 33 : 21,
    },
    scheduleMeta: { stage, ...extras.scheduleMeta },
    ...extras,
  };
}

describe("team-tournament-post-lineup-complete-lifecycle-01 package", () => {
  it("locks close readiness + rejects client awards authority + hardens scoring", () => {
    const apply = readFileSync(join(pkg, "02_APPLY.sql"), "utf8");
    const verify = readFileSync(join(pkg, "03_VERIFY.sql"), "utf8");
    assert.match(apply, /team_tournament_assert_close_readiness/);
    assert.match(apply, /GROUP_STAGE_INCOMPLETE/);
    assert.match(apply, /ELIMINATION_INCOMPLETE/);
    assert.match(apply, /FINAL_NOT_COMPLETED/);
    assert.match(apply, /CHAMPION_UNRESOLVED/);
    assert.match(apply, /team_tournament_search_referee_candidates/);
    assert.match(apply, /CLIENT_RESULT_PAYLOAD_TRUSTED_AS_AUTHORITY=NO/);
    assert.doesNotMatch(apply, /v_payload->'awardsSheet'/);
    assert.doesNotMatch(apply, /v_payload->'frozenStandings'/);
    assert.match(apply, /targetPoints/);
    assert.match(apply, /winBy must be between/);
    assert.match(verify, /one-group incomplete/);
    assert.match(verify, /final complete should be eligible/);
    assert.match(verify, /disposable close-readiness matrix/);
    assert.doesNotMatch(apply, /matchup\.stage = 'quarterfinal'/);

    assert.equal(
      sha256Lf("01_PRECHECK.sql"),
      "a3b8fa006681e0c3cdc66cb6b6ade80b536885f134c3be76d2c5bf7615232134"
    );
    assert.equal(
      sha256Lf("02_APPLY.sql"),
      "dfbaa6e318cc7c9e86bc6255661fa14eb535030827f7cc0245cf78095357f394"
    );
    assert.equal(
      sha256Lf("03_VERIFY.sql"),
      "bd5abbc8848dd8e852fc8bd679fcd206285acee3ca40d8b6e7092cdd55808747"
    );
    assert.equal(
      sha256Lf("04_ROLLBACK.sql"),
      "e4c714c1e6e2781586ffabe4a45a071d437acde43d05d3bd82594b0b80e91f03"
    );
  });
});

describe("close readiness authority", () => {
  it("denies incomplete one-group; allows completed one-group", () => {
    const incomplete = assertCloseReadinessFromCanonical({
      teamData: {
        settings: { groupCount: 1 },
        teams: [{ id: "team-a" }, { id: "team-b" }],
        matchups: [
          {
            id: "g1",
            stage: "group",
            status: MATCHUP_STATUS.LINEUP_OPEN,
            teamAId: "team-a",
            teamBId: "team-b",
            result: {},
          },
        ],
      },
    });
    assert.equal(incomplete.ok, false);
    assert.equal(incomplete.code, CLOSE_READINESS_CODES.GROUP_STAGE_INCOMPLETE);

    const complete = assertCloseReadinessFromCanonical({
      teamData: {
        settings: { groupCount: 1 },
        teams: [{ id: "team-a" }, { id: "team-b" }],
        matchups: [completedMatchup("g1", "group", "team-a")],
      },
    });
    assert.equal(complete.ok, true);
    assert.equal(complete.championTeamId, "team-a");
    assert.equal(complete.mode, "one_group");
  });

  it("denies incomplete elimination; allows final completed champion", () => {
    const incomplete = assertCloseReadinessFromCanonical({
      teamData: {
        settings: { groupCount: 2 },
        teams: [{ id: "team-a" }, { id: "team-b" }],
        matchups: [
          completedMatchup("g1", "group", "team-a"),
          completedMatchup("g2", "group", "team-b"),
          {
            id: "final-1",
            stage: "knockout",
            status: MATCHUP_STATUS.SCHEDULED,
            teamAId: "team-a",
            teamBId: "team-b",
            result: {},
            scheduleMeta: { stage: "knockout", competitionStage: "final" },
            competitionStage: COMPETITION_STAGE.FINAL,
          },
        ],
      },
    });
    assert.equal(incomplete.ok, false);
    assert.ok(
      [
        CLOSE_READINESS_CODES.ELIMINATION_INCOMPLETE,
        CLOSE_READINESS_CODES.FINAL_NOT_COMPLETED,
      ].includes(incomplete.code)
    );

    const complete = assertCloseReadinessFromCanonical({
      teamData: {
        settings: { groupCount: 2 },
        teams: [{ id: "team-a" }, { id: "team-b" }],
        matchups: [
          completedMatchup("g1", "group", "team-a"),
          completedMatchup("g2", "group", "team-b"),
          completedMatchup("final-1", "knockout", "team-b", {
            competitionStage: COMPETITION_STAGE.FINAL,
            scheduleMeta: { stage: "knockout", competitionStage: "final" },
          }),
        ],
      },
    });
    assert.equal(complete.ok, true);
    assert.equal(complete.championTeamId, "team-b");
    assert.equal(complete.championSource, "final_winner");
  });

  it("does not trust client forged champion fields", () => {
    const denied = assertCloseReadinessFromCanonical({
      teamData: {
        settings: {
          groupCount: 1,
          championTeamId: "forged-champ",
          awardsSheet: { awards: [{ key: "champion", teamId: "forged-champ" }] },
        },
        teams: [{ id: "team-a" }, { id: "team-b" }],
        matchups: [
          {
            id: "g1",
            stage: "group",
            status: MATCHUP_STATUS.LINEUP_OPEN,
            teamAId: "team-a",
            teamBId: "team-b",
            result: {},
          },
        ],
      },
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, CLOSE_READINESS_CODES.GROUP_STAGE_INCOMPLETE);
  });
});

describe("qualification progression", () => {
  it("derives total and first elim stages", () => {
    assert.equal(deriveTotalQualifiedTeams(2, 4), 8);
    assert.equal(deriveFirstEliminationStage(16), COMPETITION_STAGE.ROUND_OF_16);
    assert.equal(deriveFirstEliminationStage(8), COMPETITION_STAGE.QUARTERFINAL);
    assert.equal(deriveFirstEliminationStage(4), COMPETITION_STAGE.SEMIFINAL);
    assert.equal(deriveFirstEliminationStage(2), COMPETITION_STAGE.FINAL);
  });

  it("one-group forbids knockout; multi-group PoT fail-closed", () => {
    const one = resolveQualificationProgression({ groupCount: 1, qualifiersPerGroup: 4 });
    assert.equal(one.ok, true);
    assert.equal(one.allowsKnockout, false);

    const bad = resolveQualificationProgression({ groupCount: 3, qualifiersPerGroup: 2 });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, "INVALID_QUALIFICATION_TOTAL");
  });
});

describe("#416 coarse stage + resolved round (no second taxonomy)", () => {
  it("matchup.stage stays knockout; resolver yields competition stage", () => {
    const teamData = {
      matchups: [
        {
          id: "ko-final",
          stage: MATCHUP_STAGE.KNOCKOUT,
          bracketRoundLabel: "Chung kết",
          nextMatchupId: "",
        },
      ],
    };
    const matchup = teamData.matchups[0];
    assert.equal(matchup.stage, "knockout");
    assert.equal(resolveMatchupCompetitionStage(teamData, matchup), COMPETITION_STAGE.FINAL);
  });
});

describe("stage scoring policy", () => {
  it("resolves stage policy then defaults; 21 is default not authority", () => {
    const policy = normalizeStageScoringPolicy({
      final: { targetPoints: 15, winBy: 2 },
    });
    assert.equal(policy.final.targetPoints, 15);
    const effective = resolveEffectiveStageScoringPolicy({
      teamData: { settings: { stageScoringPolicy: policy } },
      resolvedRound: COMPETITION_STAGE.FINAL,
    });
    assert.equal(effective.targetPoints, 15);
    assert.equal(stageScoringToFormat(effective).targetScore, 15);
  });

  it("rejects malformed stage scoring shape", () => {
    const bad = validateStageScoringPolicyShape({ weird: { targetPoints: 11 } });
    assert.equal(bad.ok, false);
  });
});

describe("close / completed authority", () => {
  it("closed when status completed even without settings.closed", () => {
    assert.equal(isTeamTournamentClosed({ settings: {} }, { status: "completed" }), true);
    assert.equal(isTeamTournamentClosed({ settings: {} }, { status: "draft" }), false);
  });

  it("close RPC is marked deployed in registry", () => {
    assert.equal(isSetupMutationRpcDeployed("team_tournament_close_tournament"), true);
  });
});

describe("referee assignment UX contracts", () => {
  it("organizer UI uses searchable selector; no manual UUID field", () => {
    const panel = readFileSync(
      join(root, "src/components/tournament/team/TeamRefereeSafetyPanel.jsx"),
      "utf8"
    );
    assert.match(panel, /Autocomplete/);
    assert.match(panel, /rpcTeamTournamentSearchRefereeCandidates/);
    assert.match(panel, /MANUAL_REFEREE_UUID_REQUIRED=NO/);
    assert.doesNotMatch(panel, /Referee user id \(UUID\)/);
    assert.match(panel, /Đổi trọng tài/);
    assert.match(panel, /Revoke/);
  });

  it("package search RPC does not filter profiles.role", () => {
    const apply = readFileSync(join(pkg, "02_APPLY.sql"), "utf8");
    const searchFn = apply.slice(
      apply.indexOf("team_tournament_search_referee_candidates"),
      apply.indexOf("team_tournament_update_setup_config")
    );
    assert.doesNotMatch(searchFn, /p\.role/);
  });
});

describe("round-robin structured errors", () => {
  it("maps readiness / RR codes away from generic failure", () => {
    assert.match(describeRepositoryFailureCode("UNKNOWN_TEAM"), /Đội/);
    assert.match(describeRepositoryFailureCode("GROUP_STAGE_INCOMPLETE"), /bảng/);
    assert.match(describeRepositoryFailureCode("CHAMPION_UNRESOLVED"), /vô địch/);
  });
});
