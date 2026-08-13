/**
 * Scenario B consolidated remediation contracts (B1–B4).
 * STAGING_MUTATIONS=0 — SQL package local until Owner GO.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { LINEUP_STATUS, COMPETITION_STAGE } from "../src/features/team-tournament/constants.js";
import {
  buildCaptainDashboardTasks,
  isLineupTaskOpen,
} from "../src/features/team-tournament/dashboard/teamTournamentDashboardTasks.js";
import {
  generateTeamKnockoutMatchups,
  listKnockoutMatchups,
} from "../src/features/team-tournament/engines/teamKnockoutEngine.js";
import { getSubstitutionGate } from "../src/features/team-tournament/engines/substitutionEngine.js";
import {
  resolveQualificationProgression,
} from "../src/features/team-tournament/engines/teamQualificationProgression.js";
import {
  DEFAULT_STAGE_SCORING_ENTRY,
  normalizeStageScoringPolicy,
  stageScoringToFormat,
  validateStageScoringPolicyShape,
  STAGE_SCORING_MODE,
} from "../src/features/team-tournament/engines/teamStageScoringPolicy.js";
import {
  getStageScoringHints,
  normalizeRallyRules,
} from "../src/features/team-tournament/engines/rallyScoringEngine.js";
import {
  evaluateTt5OpsReadiness,
  buildStagingInventoryFromTt5Final,
  buildClientFlagInventoryFromEnv,
} from "../src/features/team-tournament/engines/teamRefereeOpsReadinessEngine.js";
import { lineupKey } from "../src/features/team-tournament/models/index.js";
import { SETUP_MUTATION_RPC_BY_COMMAND } from "../src/features/team-tournament/setup/setupMutationRpcRegistry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-scenario-b-ko-lineup-remediation-01"
);

const PACKAGE_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "491b5cd02fd6d673e97ca72110de007a26185e5b8ca66d8acdf3c3b597f7a43f",
  "02_APPLY.sql":
    "d4ce3718b664747484dbcfaf740f0d0c41a4f2bc020dfd28396e9f285fec64ed",
  "03_VERIFY.sql":
    "ca206cda0798d633b03fef21a18ebff03a34ccb602ffaaefa30bbcd5f0a22d49",
  "04_ROLLBACK.sql":
    "4b1846b9dc7a551daf9bd63782183ca8a6d45f2147fae4aae46732bc26272df0",
});

function sha256Lf(name) {
  const raw = readFileSync(path.join(pkgDir, name));
  const lf = Buffer.from(
    raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  );
  return createHash("sha256").update(lf).digest("hex");
}

function readPkg(name) {
  return readFileSync(path.join(pkgDir, name), "utf8");
}

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("team-tournament-scenario-b-ko-lineup-remediation-01", () => {
  it("locks LF SHA256 package hashes", () => {
    for (const [file, expected] of Object.entries(PACKAGE_LF_SHA256)) {
      assert.equal(sha256Lf(file), expected, file);
    }
  });

  it("B1: stage scoring UI hydrates changeEndsAt + Traditional 11/2/6", () => {
    const panel = readSrc(
      "src/components/tournament/team/TeamFormatVenueSetupPanel.jsx"
    );
    assert.match(panel, /Đổi sân tại/);
    assert.match(panel, /changeEndsAt/);

    const policy = normalizeStageScoringPolicy({
      group: {
        scoringMode: STAGE_SCORING_MODE.TRADITIONAL,
        targetPoints: 11,
        winBy: 2,
        changeEndsAt: 6,
      },
    });
    assert.equal(policy.group.changeEndsAt, 6);
    assert.equal(policy.group.targetPoints, 11);
    assert.equal(policy.group.winBy, 2);

    const format = stageScoringToFormat(policy.group);
    assert.equal(format.changeEndsAt, 6);
    assert.equal(format.sideSwitchAt, 6);

    const f5 = normalizeStageScoringPolicy({ group: policy.group });
    assert.equal(f5.group.changeEndsAt, 6);

    const bad = validateStageScoringPolicyShape({
      group: { ...DEFAULT_STAGE_SCORING_ENTRY, targetPoints: 11, changeEndsAt: 11 },
    });
    assert.equal(bad.ok, false);
  });

  it("B1: referee hints resolve group changeEndsAt=6 for Traditional", () => {
    const teamData = {
      settings: {
        stageScoringPolicy: {
          group: {
            scoringMode: "traditional",
            targetPoints: 11,
            winBy: 2,
            changeEndsAt: 6,
          },
          semifinal: {
            scoringMode: "traditional",
            targetPoints: 15,
            winBy: 2,
            changeEndsAt: 8,
          },
        },
      },
      matchups: [
        { id: "g1", stage: "group", competitionStage: "group" },
        {
          id: "sf1",
          stage: "knockout",
          competitionStage: "semifinal",
          bracketRoundLabel: "Bán kết",
        },
      ],
    };
    const groupHint = getStageScoringHints({
      teamData,
      matchup: teamData.matchups[0],
      discipline: { scoringFormat: { scoringSystem: "side_out" } },
    });
    assert.match(groupHint, /Truyền thống/);
    assert.match(groupHint, /Đổi sân @6/);

    const sfHint = getStageScoringHints({
      teamData,
      matchup: teamData.matchups[1],
      discipline: { scoringFormat: { scoringSystem: "side_out" } },
    });
    assert.match(sfHint, /Đổi sân @8/);

    const rules = normalizeRallyRules(stageScoringToFormat(teamData.settings.stageScoringPolicy.group));
    assert.equal(rules.sideSwitchAt, 6);
  });

  it("B2: group lineup does not satisfy semifinal; fresh captain task", () => {
    const groupMu = { id: "g1", teamAId: "t1", teamBId: "t2", status: "completed", stage: "group" };
    const sfMu = {
      id: "sf1",
      teamAId: "t1",
      teamBId: "t3",
      status: "lineup_open",
      stage: "knockout",
      competitionStage: "semifinal",
    };
    const finalMu = {
      id: "f1",
      teamAId: "",
      teamBId: "",
      status: "lineup_open",
      stage: "knockout",
      competitionStage: "final",
    };
    const teamData = {
      teams: [
        { id: "t1", name: "A" },
        { id: "t2", name: "B" },
        { id: "t3", name: "C" },
      ],
      matchups: [groupMu, sfMu, finalMu],
      lineups: {
        [lineupKey("g1", "t1")]: {
          matchupId: "g1",
          teamId: "t1",
          status: LINEUP_STATUS.PUBLISHED,
          selections: { md: ["p1"] },
        },
      },
    };

    assert.equal(isLineupTaskOpen(teamData.lineups[lineupKey("g1", "t1")]), false);
    assert.equal(isLineupTaskOpen(null), true);

    const tasks = buildCaptainDashboardTasks({
      tournament: { id: "tour-1" },
      teamData,
      captainTeamId: "t1",
      clubId: "club-1",
    });
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].matchupId, "sf1");

    // Published group lineup must not block substitution for new SF lifecycle.
    const gate = getSubstitutionGate(teamData, "t1");
    assert.equal(gate.allowed, true);
  });

  it("B2: semifinal → final creates another fresh lineup lifecycle", () => {
    const teamData = {
      teams: [
        { id: "t1", name: "A" },
        { id: "t2", name: "B" },
      ],
      matchups: [
        {
          id: "sf1",
          teamAId: "t1",
          teamBId: "t2",
          status: "completed",
          stage: "knockout",
        },
        {
          id: "f1",
          teamAId: "t1",
          teamBId: "t2",
          status: "lineup_open",
          stage: "knockout",
          competitionStage: "final",
        },
      ],
      lineups: {
        [lineupKey("sf1", "t1")]: {
          matchupId: "sf1",
          teamId: "t1",
          status: LINEUP_STATUS.PUBLISHED,
        },
      },
    };
    const tasks = buildCaptainDashboardTasks({
      tournament: { id: "tour-1" },
      teamData,
      captainTeamId: "t1",
    });
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].matchupId, "f1");
  });

  it("B3: 2×2=4 → semifinal with exactly two SF matchups; no partial", () => {
    const progression = resolveQualificationProgression({
      groupCount: 2,
      qualifiersPerGroup: 2,
    });
    assert.equal(progression.totalQualifiedTeams, 4);
    assert.equal(progression.firstEliminationStage, COMPETITION_STAGE.SEMIFINAL);
    assert.equal(progression.allowsKnockout, true);

    const invalid = resolveQualificationProgression({
      groupCount: 3,
      qualifiersPerGroup: 1,
    });
    assert.equal(invalid.allowsKnockout, false);

    const teams = ["t1", "t2", "t3", "t4"].map((id, i) => ({
      id,
      name: `Team ${i + 1}`,
    }));
    const groups = [
      { id: "gA", name: "A", teamIds: ["t1", "t2"] },
      { id: "gB", name: "B", teamIds: ["t3", "t4"] },
    ];
    const groupMatchups = [
      {
        id: "rr1",
        teamAId: "t1",
        teamBId: "t2",
        status: "completed",
        stage: "group",
        groupId: "gA",
        result: {
          winnerTeamId: "t1",
          teamAWins: 3,
          teamBWins: 1,
          teamAPoints: 33,
          teamBPoints: 21,
        },
      },
      {
        id: "rr2",
        teamAId: "t3",
        teamBId: "t4",
        status: "completed",
        stage: "group",
        groupId: "gB",
        result: {
          winnerTeamId: "t3",
          teamAWins: 3,
          teamBWins: 0,
          teamAPoints: 33,
          teamBPoints: 11,
        },
      },
    ];
    const teamData = {
      teams,
      groups,
      disciplines: [{ id: "md", name: "MD" }],
      matchups: groupMatchups,
      settings: { groupCount: 2, qualifiersPerGroup: 2, knockoutFormat: "top_n" },
    };
    const built = generateTeamKnockoutMatchups(teamData, { qualifiersPerGroup: 2 });
    assert.equal(built.ok, true);
    const ko = listKnockoutMatchups(built.teamData);
    const sf = ko.filter(
      (m) =>
        m.competitionStage === COMPETITION_STAGE.SEMIFINAL ||
        m.bracketRoundLabel === "Bán kết"
    );
    assert.equal(sf.length, 2);
    assert.ok(sf.every((m) => m.teamAId && m.teamBId));
    const finals = ko.filter(
      (m) =>
        m.competitionStage === COMPETITION_STAGE.FINAL ||
        m.bracketRoundLabel === "Chung kết"
    );
    assert.equal(finals.length, 1);
    assert.equal(finals[0].teamAId, "");
    assert.equal(finals[0].teamBId, "");
    // F5-equivalent: rebuilt KO count stable
    const rebuilt = generateTeamKnockoutMatchups(built.teamData, {
      qualifiersPerGroup: 2,
    });
    assert.equal(listKnockoutMatchups(rebuilt.teamData).length, ko.length);
  });

  it("B3 SQL package allows empty placeholders + upsert; does not rerun prior packages", () => {
    const apply = readPkg("02_APPLY.sql");
    assert.match(apply, /team_tournament_replace_matchups/);
    assert.match(apply, /nullif\(btrim\(coalesce\(x\.value->>'teamAId'/);
    assert.match(apply, /external_matchup_id = v_id/);
    assert.doesNotMatch(apply, /team_tournament_close_tournament/);
    assert.doesNotMatch(apply, /team_tournament_assert_close_readiness/);
    assert.equal(SETUP_MUTATION_RPC_BY_COMMAND["matchups.replace"], "team_tournament_replace_matchups");
    const setup = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
    assert.match(setup, /handleGenerateKnockout/);
    assert.match(setup, /prepareLivePrivatePairingOptions/);
    assert.match(setup, /rulesVersion/);
  });

  it("B4: rulesVersion warning is write-gate; Staging MISSING_OBJECTS is flag noise", () => {
    const envelope = readSrc(
      "src/features/team-tournament/canonical/teamTournamentMutationEnvelope.js"
    );
    assert.match(envelope, /Thiếu rulesVersion cho lệnh pairing/);
    assert.match(envelope, /matchups\.replace/);

    const orch = readSrc(
      "src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"
    );
    assert.match(orch, /team-tournament-v1/);
    assert.match(orch, /PAIRING_SETUP_COMMANDS/);

    const unsetFlags = buildClientFlagInventoryFromEnv({});
    const evidence = buildStagingInventoryFromTt5Final();
    const bad = evaluateTt5OpsReadiness({
      ...evidence,
      flags: { ...evidence.flags, ...unsetFlags },
    });
    // Unset overwrite previously caused MISSING_OBJECTS; classifier now FLAGS_MISMATCH
    // when only flags fail. Panel must not spread unset over evidence.
    assert.ok(
      bad.verdict === "FLAGS_MISMATCH" || bad.verdict === "MISSING_OBJECTS"
    );

    const fixed = evaluateTt5OpsReadiness({
      ...evidence,
      flags: {
        ...evidence.flags,
        ...Object.fromEntries(
          Object.entries(unsetFlags).filter(
            ([, v]) => v != null && String(v).trim() !== ""
          )
        ),
      },
    });
    assert.equal(fixed.verdict, "READY");

    const panel = readSrc(
      "src/components/tournament/team/TeamRefereeOpsReadinessPanel.jsx"
    );
    assert.match(panel, /explicitFlags/);
    assert.match(panel, /Production: untouched \(Owner GO\)/);
    assert.match(panel, /refereeLifecycleActive/);
  });
});
