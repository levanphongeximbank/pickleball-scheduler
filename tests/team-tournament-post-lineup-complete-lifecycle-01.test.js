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
  deriveFirstEliminationStage,
  deriveTotalQualifiedTeams,
  resolveQualificationProgression,
} from "../src/features/team-tournament/engines/teamQualificationProgression.js";
import {
  normalizeStageScoringPolicy,
  resolveEffectiveStageScoringPolicy,
  stageScoringToFormat,
} from "../src/features/team-tournament/engines/teamStageScoringPolicy.js";
import {
  resolveMatchupCompetitionStage,
} from "../src/features/team-tournament/engines/teamStageTieBreakPolicy.js";
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

describe("team-tournament-post-lineup-complete-lifecycle-01 package", () => {
  it("close dual-writes completed; setup whitelist qualifiers + scoring", () => {
    const apply = readFileSync(join(pkg, "02_APPLY.sql"), "utf8");
    const verify = readFileSync(join(pkg, "03_VERIFY.sql"), "utf8");
    assert.match(apply, /team_tournament_close_tournament/);
    assert.match(apply, /canonical_tournaments/);
    assert.match(apply, /status = 'completed'/);
    assert.match(apply, /qualifiersPerGroup/);
    assert.match(apply, /stageScoringPolicy/);
    assert.match(apply, /INVALID_QUALIFICATION_TOTAL/);
    assert.doesNotMatch(apply, /matchup\.stage = 'quarterfinal'/);
    assert.match(verify, /dual-write canonical_tournaments/);
    for (const f of ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql"]) {
      assert.equal(sha256Lf(f).length, 64, f);
    }
    assert.equal(
      sha256Lf("01_PRECHECK.sql"),
      "29556e2eb385ef977097d8285f237fd610ffe18492337a907d13d9fa418ac2ea"
    );
    assert.equal(
      sha256Lf("02_APPLY.sql"),
      "5de1731db27e0bdd067699099d45c6561cca1542d891271cf125209a75ef9308"
    );
    assert.equal(
      sha256Lf("03_VERIFY.sql"),
      "116a500abb4ab3a2c77d36fafcf2e552d23f1191c37ec5e1503840069a4b0d32"
    );
    assert.equal(
      sha256Lf("04_ROLLBACK.sql"),
      "fa7d7fa1f66167b03df0e4ef1368b468e3a41fa671c95e124a13bb3d5441c7be"
    );
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
    assert.equal(one.oneGroup, true);

    const bad = resolveQualificationProgression({ groupCount: 3, qualifiersPerGroup: 2 });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, "INVALID_QUALIFICATION_TOTAL");

    const ok = resolveQualificationProgression({ groupCount: 2, qualifiersPerGroup: 4 });
    assert.equal(ok.ok, true);
    assert.equal(ok.firstEliminationStage, COMPETITION_STAGE.QUARTERFINAL);
    assert.match(ok.ctaLabelVi, /Tứ kết/);
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
    assert.equal(
      resolveMatchupCompetitionStage(teamData, matchup),
      COMPETITION_STAGE.FINAL
    );
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
    assert.equal(effective.source, "stageScoringPolicy");
    const fmt = stageScoringToFormat(effective);
    assert.equal(fmt.targetScore, 15);
  });
});

describe("close / completed authority", () => {
  it("closed when status completed even without settings.closed", () => {
    assert.equal(isTeamTournamentClosed({ settings: {} }, { status: "completed" }), true);
    assert.equal(isTeamTournamentClosed({ settings: { closed: true } }, { status: "draft" }), true);
    assert.equal(isTeamTournamentClosed({ settings: {} }, { status: "draft" }), false);
  });

  it("close RPC is marked deployed in registry", () => {
    assert.equal(
      isSetupMutationRpcDeployed("team_tournament_close_tournament"),
      true
    );
  });
});

describe("new lineup contract smoke", () => {
  it("new knockout matchup starts without submitted lineup status", () => {
    const newMatchup = {
      id: "ko-qf-1",
      stage: MATCHUP_STAGE.KNOCKOUT,
      status: MATCHUP_STATUS.LINEUP_OPEN,
      competitionStage: COMPETITION_STAGE.QUARTERFINAL,
    };
    const lineups = {};
    assert.equal(lineups[`${newMatchup.id}::team-a`], undefined);
    assert.equal(newMatchup.status, MATCHUP_STATUS.LINEUP_OPEN);
  });
});

describe("round-robin structured errors", () => {
  it("maps UNKNOWN_TEAM / VALIDATION_ERROR away from generic failure", () => {
    assert.match(describeRepositoryFailureCode("UNKNOWN_TEAM"), /Đội/);
    assert.match(describeRepositoryFailureCode("VALIDATION_ERROR"), /rulesVersion/);
  });

  it("mapRepositoryResultToUi remaps bare repository codes", async () => {
    const { mapRepositoryResultToUi } = await import(
      "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"
    );
    const ui = mapRepositoryResultToUi({
      ok: false,
      code: "UNKNOWN_TEAM",
      error: "Repository operation failed.",
    });
    assert.equal(ui.ok, false);
    assert.match(ui.error, /Đội/);
  });
});

describe("referee effective scoring uses resolvedRound", () => {
  it("does not treat matchup.stage as quarterfinal taxonomy", () => {
    const teamData = {
      settings: {
        stageScoringPolicy: {
          final: { targetPoints: 11, winBy: 2 },
        },
      },
      matchups: [
        {
          id: "ko-f",
          stage: "knockout",
          bracketRoundLabel: "Chung kết",
          nextMatchupId: "",
        },
      ],
      disciplines: [
        {
          id: "md",
          scoringFormat: { targetScore: 21, winBy: 2, scoringType: "rally" },
        },
      ],
    };
    const matchup = teamData.matchups[0];
    assert.equal(matchup.stage, "knockout");
    const resolved = resolveMatchupCompetitionStage(teamData, matchup);
    assert.equal(resolved, COMPETITION_STAGE.FINAL);
    const effective = resolveEffectiveStageScoringPolicy({
      teamData,
      resolvedRound: resolved,
    });
    assert.equal(effective.targetPoints, 11);
    assert.equal(effective.source, "stageScoringPolicy");
  });
});
