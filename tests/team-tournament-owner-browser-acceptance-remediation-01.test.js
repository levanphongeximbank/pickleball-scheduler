/**
 * TEAM-TOURNAMENT-OWNER-BROWSER-ACCEPTANCE-REMEDIATION-01
 *
 * R1 — referee flicker + competition-scoped athlete identity (no club members).
 * R2 — per-stage scoringMode rally | traditional (side_out) end to end.
 * R3 — tournament.close is a confirmed snapshot mutation; preview-only never
 *      celebrates as a close.
 *
 * STAGING_MUTATIONS=0 — no SQL, no cloud calls.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { COMPETITION_STAGE } from "../src/features/team-tournament/constants.js";
import { resolveLoadFailureApplyMode } from "../src/features/team-tournament/ui/useTeamTournamentPage.js";
import {
  collectRefereeCompetitionAthletesFromTeamData,
  preserveRefereeCompetitionAthletes,
  projectRefereeCompetitionAthletePlayers,
  REFEREE_COMPETITION_ATHLETES_KEY,
  REFEREE_COMPETITION_SCOPED,
} from "../src/features/team-tournament/engines/refereeCompetitionAthleteProjection.js";
import {
  getRefereeCompetitionAthleteDirectory,
  isRefereeDirectoryRpcMissing,
  REFEREE_COMPETITION_ATHLETE_DIRECTORY_RPC,
  REFEREE_DIRECTORY_CODES,
} from "../src/features/team-tournament/services/refereeCompetitionAthleteDirectoryService.js";
import {
  mapScoringSystemToStageScoringMode,
  mapStageScoringModeToScoringSystem,
  normalizeStageScoringMode,
  normalizeStageScoringPolicy,
  resolveEffectiveStageScoringPolicy,
  STAGE_SCORING_MODE,
  stageScoringToFormat,
  validateStageScoringPolicyShape,
} from "../src/features/team-tournament/engines/teamStageScoringPolicy.js";
import {
  getStageScoringHints,
  resolveStageScoringMode,
  validateSideOutScore,
  validateStageScore,
} from "../src/features/team-tournament/engines/rallyScoringEngine.js";
import {
  buildCloseTournamentPayload,
  CLOSE_DEFAULT_REASON,
  isCloseMutationPersisted,
  resolveCloseMutationOutcome,
} from "../src/features/team-tournament/setup/closeTournamentMutation.js";
import { applyRallyOrSideOutPoint } from "../src/features/competition-core/scoring/services/progression.js";
import { SCORING_SIDE } from "../src/features/competition-core/scoring/enums/scoringSides.js";
import { SCORING_SYSTEM as CORE16_SCORING_SYSTEM } from "../src/features/competition-core/scoring/enums/scoringSystems.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-owner-browser-acceptance-remediation-01"
);

/** Required LF SHA256 lock for follow-up package (never re-run lifecycle-01 APPLY). */
const FOLLOWUP_PACKAGE_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "43b37e1fc65ef175ac194f27eb3aaa773fbd361fee0122b46cffab82e0797f10",
  "02_APPLY.sql":
    "a0a405526ea19229e4a89cd65b592f341a7e9514bbe0c4ee1ff226be0dd2756e",
  "03_VERIFY.sql":
    "4b10a680f7896447730e984665f4fcc34a0b90a27d0047e797190cd718f936c1",
  "04_ROLLBACK.sql":
    "b696f6c9910cba48cb5198d15238cdfedcdc6b83ebd249351fc252d8a9c2cfcb",
});

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function sha256Lf(fileName) {
  const raw = readFileSync(path.join(pkgDir, fileName));
  const lf = Buffer.from(
    raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  );
  return createHash("sha256").update(lf).digest("hex");
}

function stageScoringTeamData(stage, entry) {
  return {
    settings: {
      stageScoringPolicy: {
        [stage]: entry,
      },
    },
  };
}

describe("R1 — referee flicker + competition-scoped identity", () => {
  it("keeps last-good canonical state on a silent load failure", () => {
    assert.equal(
      resolveLoadFailureApplyMode({ silent: true, hasTournament: true }),
      "soft"
    );
    assert.equal(
      resolveLoadFailureApplyMode({ silent: true, hasTeamData: true }),
      "soft"
    );
  });

  it("hard-clears only when nothing is hydrated or the load is explicit", () => {
    assert.equal(
      resolveLoadFailureApplyMode({ silent: true, hasTournament: false }),
      "hard"
    );
    assert.equal(
      resolveLoadFailureApplyMode({ silent: false, hasTournament: true }),
      "hard"
    );
    assert.equal(resolveLoadFailureApplyMode(), "hard");
  });

  it("applyLoadResult receives silent and never nulls tournament in soft mode", () => {
    const hook = readSrc("src/features/team-tournament/ui/useTeamTournamentPage.js");
    assert.match(hook, /applyLoadResult = useCallback\(\(result, \{ silent = false \} = \{\}\)/);
    assert.match(hook, /applyLoadResult\(result, \{ silent \}\)/);
    assert.match(hook, /if \(applyMode === "soft"\)/);
    assert.match(hook, /preserveRefereeCompetitionAthletes/);
    assert.match(hook, /activePageMode === "refereePortal"/);
  });

  it("projects competition athletes with REFEREE_COMPETITION_SCOPED gender source", () => {
    const players = projectRefereeCompetitionAthletePlayers([
      { athleteId: "a1", displayName: "Nguyễn A", gender: "Nam" },
      { athlete_id: "a2", display_name: "Trần B", gender: "nữ" },
      { athleteId: "", displayName: "bỏ qua" },
    ]);
    assert.equal(players.length, 2);
    assert.deepEqual(players[0], {
      id: "a1",
      athleteId: "a1",
      name: "Nguyễn A",
      displayName: "Nguyễn A",
      gender: "male",
      genderSource: REFEREE_COMPETITION_SCOPED,
    });
    assert.equal(players[1].gender, "female");
    assert.equal(players[1].genderSource, REFEREE_COMPETITION_SCOPED);
  });

  it("falls back to canonical rosterAthletes without touching club members", () => {
    const teamData = {
      teams: [
        { id: "t1", rosterAthletes: [{ athleteId: "a1", displayName: "A", gender: "male" }] },
        { id: "t2", rosterAthletes: '[{"athleteId":"a2","displayName":"B"}]' },
      ],
    };
    const rows = collectRefereeCompetitionAthletesFromTeamData(teamData);
    assert.deepEqual(
      rows.map((row) => row.athleteId).sort(),
      ["a1", "a2"]
    );
  });

  it("preserves the directory + rosterAthletes across a silent apply", () => {
    const previous = {
      [REFEREE_COMPETITION_ATHLETES_KEY]: [
        { athleteId: "a1", displayName: "A", gender: "male" },
      ],
      teams: [{ id: "t1", rosterAthletes: [{ athleteId: "a1", displayName: "A" }] }],
    };
    const next = { teams: [{ id: "t1" }] };
    const merged = preserveRefereeCompetitionAthletes(previous, next);
    assert.equal(merged[REFEREE_COMPETITION_ATHLETES_KEY].length, 1);
    assert.equal(merged.teams[0].rosterAthletes[0].athleteId, "a1");
  });

  it("reads the competition directory RPC by tournament id", async () => {
    const calls = [];
    const client = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return {
          data: { ok: true, athletes: [{ athleteId: "a1", displayName: "A", gender: "m" }] },
          error: null,
        };
      },
    };
    const result = await getRefereeCompetitionAthleteDirectory(
      { tournamentId: "tt-1" },
      { client }
    );
    assert.equal(result.ok, true);
    assert.deepEqual(calls[0], {
      name: REFEREE_COMPETITION_ATHLETE_DIRECTORY_RPC,
      args: { p_tournament_id: "tt-1" },
    });
    assert.equal(result.athletes[0].gender, "male");
  });

  it("flags an undeployed directory RPC instead of falling back to club members", async () => {
    assert.equal(isRefereeDirectoryRpcMissing({ code: "PGRST202" }), true);
    assert.equal(
      isRefereeDirectoryRpcMissing({ message: "Could not find the function public.x" }),
      true
    );
    assert.equal(isRefereeDirectoryRpcMissing({ code: "42501" }), false);

    const client = {
      rpc: async () => ({ data: null, error: { code: "42883", message: "does not exist" } }),
    };
    const result = await getRefereeCompetitionAthleteDirectory(
      { tournamentId: "tt-1" },
      { client }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, REFEREE_DIRECTORY_CODES.RPC_NOT_DEPLOYED);
    assert.equal(result.missingRpc, true);
    assert.deepEqual(result.athletes, []);
  });

  it("referee portal drops the club athlete pool and the reload-on-identity loop", () => {
    const portal = readSrc("src/pages/tournament/TeamRefereePortal.jsx");
    assert.doesNotMatch(portal, /useTeamTournamentAthletePool/);
    assert.doesNotMatch(portal, /TEAM_TOURNAMENT_ATHLETE_SCOPE/);
    assert.doesNotMatch(portal, /reloadTournament/);
    assert.match(portal, /pageMode: "refereePortal"/);
    assert.match(portal, /loading && !tournament/);
    assert.match(portal, /getRefereeCompetitionAthleteDirectory/);
    assert.match(portal, /projectRefereeCompetitionAthletePlayers/);
  });
});

describe("R2 — stage scoringMode rally | traditional", () => {
  it("defaults to rally and accepts scoringSystem aliases", () => {
    assert.equal(normalizeStageScoringMode(undefined), STAGE_SCORING_MODE.RALLY);
    assert.equal(normalizeStageScoringMode("rally"), STAGE_SCORING_MODE.RALLY);
    assert.equal(normalizeStageScoringMode("RALLY"), STAGE_SCORING_MODE.RALLY);
    assert.equal(
      normalizeStageScoringMode("traditional"),
      STAGE_SCORING_MODE.TRADITIONAL
    );
    assert.equal(
      normalizeStageScoringMode("side_out"),
      STAGE_SCORING_MODE.TRADITIONAL
    );
    assert.equal(
      normalizeStageScoringMode("SIDE_OUT"),
      STAGE_SCORING_MODE.TRADITIONAL
    );
  });

  it("maps traditional ↔ side_out for engines", () => {
    assert.equal(mapStageScoringModeToScoringSystem("traditional"), "side_out");
    assert.equal(mapStageScoringModeToScoringSystem("rally"), "rally");
    assert.equal(
      mapScoringSystemToStageScoringMode("side_out"),
      STAGE_SCORING_MODE.TRADITIONAL
    );
    assert.equal(
      mapScoringSystemToStageScoringMode("rally"),
      STAGE_SCORING_MODE.RALLY
    );
  });

  it("normalizes + validates the persisted stage entry shape", () => {
    const policy = normalizeStageScoringPolicy({
      [COMPETITION_STAGE.FINAL]: { scoringMode: "traditional", targetPoints: 15, winBy: 2 },
    });
    assert.equal(policy[COMPETITION_STAGE.FINAL].scoringMode, "traditional");
    assert.equal(policy[COMPETITION_STAGE.FINAL].targetPoints, 15);
    assert.equal(policy[COMPETITION_STAGE.GROUP].scoringMode, "rally");

    const shape = validateStageScoringPolicyShape({
      [COMPETITION_STAGE.GROUP]: { scoringSystem: "SIDE_OUT", targetPoints: 11 },
    });
    assert.equal(shape.ok, true);
    assert.equal(shape.policy[COMPETITION_STAGE.GROUP].scoringMode, "traditional");
    assert.equal(shape.policy[COMPETITION_STAGE.GROUP].targetPoints, 11);
  });

  it("stageScoringToFormat carries scoringSystem for engines", () => {
    assert.equal(
      stageScoringToFormat({ scoringMode: "traditional", targetPoints: 11 }).scoringSystem,
      "side_out"
    );
    assert.equal(
      stageScoringToFormat({ scoringMode: "rally", targetPoints: 21 }).scoringSystem,
      "rally"
    );
  });

  it("hints use the resolved stage target 11 / 15 / 21", () => {
    for (const [target, mode] of [
      [11, "traditional"],
      [15, "traditional"],
      [21, "rally"],
    ]) {
      const teamData = stageScoringTeamData(COMPETITION_STAGE.GROUP, {
        scoringMode: mode,
        targetPoints: target,
        winBy: 2,
      });
      const hints = getStageScoringHints({
        teamData,
        matchup: { id: "m1", stage: "group" },
        discipline: { scoringFormat: { scoringSystem: "rally", targetScore: 21 } },
      });
      assert.match(hints, new RegExp(`đến ${target}`));
      assert.match(hints, /thắng cách 2/);
      assert.match(
        hints,
        mode === "traditional" ? /Truyền thống/ : /Trực tiếp \(Rally\)/
      );
    }
  });

  it("resolves the stage mode used by the referee caption", () => {
    const teamData = stageScoringTeamData(COMPETITION_STAGE.GROUP, {
      scoringMode: "traditional",
      targetPoints: 15,
    });
    assert.equal(
      resolveStageScoringMode({ teamData, matchup: { id: "m1", stage: "group" } }),
      STAGE_SCORING_MODE.TRADITIONAL
    );
    assert.equal(
      resolveEffectiveStageScoringPolicy({
        teamData,
        resolvedRound: COMPETITION_STAGE.GROUP,
      }).scoringMode,
      "traditional"
    );
  });

  it("traditional confirm still enforces target + winBy (no freeze claim)", () => {
    const rules = { targetScore: 15, winBy: 2 };
    assert.equal(
      validateStageScore({ scoreA: 15, scoreB: 13, rules, scoringMode: "traditional" }).ok,
      true
    );
    assert.equal(
      validateStageScore({ scoreA: 14, scoreB: 12, rules, scoringMode: "traditional" }).ok,
      false
    );
    assert.equal(
      validateStageScore({ scoreA: 15, scoreB: 14, rules, scoringMode: "traditional" }).ok,
      false
    );
    // Freeze is rally-only: 15-14... traditional accepts 16-14 without freeze text.
    const traditional = validateSideOutScore({ scoreA: 16, scoreB: 14, rules });
    assert.equal(traditional.ok, true);
    assert.equal(traditional.winnerSide, "teamA");
  });

  it("rally mode keeps the existing rally validator", () => {
    const rally = validateStageScore({
      scoreA: 21,
      scoreB: 19,
      rules: { targetScore: 21, winBy: 2, freezeAt: 20 },
      scoringMode: "rally",
    });
    assert.equal(rally.ok, true);
    assert.equal(
      validateStageScore({
        scoreA: 21,
        scoreB: 20,
        rules: { targetScore: 21, winBy: 2, freezeAt: 20 },
        scoringMode: "rally",
      }).ok,
      false
    );
  });

  it("exposes the per-stage mode selector + traditional caption in UI", () => {
    const panel = readSrc(
      "src/components/tournament/team/TeamFormatVenueSetupPanel.jsx"
    );
    assert.match(panel, /Chế độ tính điểm/);
    assert.match(panel, /STAGE_SCORING_MODE\.TRADITIONAL/);
    assert.match(panel, /STAGE_SCORING_MODE\.RALLY/);

    const portal = readSrc("src/pages/tournament/TeamRefereePortal.jsx");
    assert.match(portal, /getStageScoringHints\(\{ discipline, teamData, matchup \}\)/);
    assert.match(
      portal,
      /Chế độ Truyền thống: quyền giao bóng được enforce trên Referee V5 \/ CORE-16\./
    );
    assert.doesNotMatch(portal, /getRallyScoringHints/);
  });

  it("CORE-16 SIDE_OUT progression smoke: receiver wins rally → no point", () => {
    const draft = {
      format: { scoringSystem: CORE16_SCORING_SYSTEM.SIDE_OUT, serversPerSide: 2 },
      points: { [SCORING_SIDE.SIDE_A]: 5, [SCORING_SIDE.SIDE_B]: 3 },
      serve: { servingSide: SCORING_SIDE.SIDE_A, serverNumber: 1 },
    };

    const denied = applyRallyOrSideOutPoint(draft, SCORING_SIDE.SIDE_B);
    assert.equal(denied.awardedPoint, false);
    assert.equal(draft.points[SCORING_SIDE.SIDE_B], 3);
    assert.equal(draft.serve.serverNumber, 2);

    const awarded = applyRallyOrSideOutPoint(draft, SCORING_SIDE.SIDE_A);
    assert.equal(awarded.awardedPoint, true);
    assert.equal(draft.points[SCORING_SIDE.SIDE_A], 6);
  });
});

describe("R3 — close is a confirmed snapshot mutation", () => {
  it("close payload = reason + snapshot, never client awards/standings", () => {
    const payload = buildCloseTournamentPayload(
      { reason: "tournament.close" },
      { snapshotHash: "h", snapshotCanonicalText: "{}", normalizedReadHash: "h" }
    );
    assert.equal(payload.reason, CLOSE_DEFAULT_REASON);
    assert.equal(payload.snapshot.snapshotHash, "h");
    assert.equal(payload.snapshot.normalizedReadHash, "h");
    assert.equal(payload.awardsSheet, undefined);
    assert.equal(payload.frozenStandings, undefined);

    const bare = buildCloseTournamentPayload();
    assert.deepEqual(bare, { reason: CLOSE_DEFAULT_REASON });
  });

  it("preview-only / rpcCalled=false is not a close", () => {
    assert.equal(
      isCloseMutationPersisted({ ok: true, rpcCalled: true, version: 4 }),
      true
    );
    assert.equal(
      isCloseMutationPersisted({ ok: true, rpcCalled: false, code: "PREVIEW_ONLY" }),
      false
    );
    assert.equal(isCloseMutationPersisted({ ok: true, code: "PREVIEW_ONLY" }), false);
    assert.equal(isCloseMutationPersisted({ ok: false }), false);

    const previewOutcome = resolveCloseMutationOutcome({
      ok: true,
      rpcCalled: false,
      code: "PREVIEW_ONLY",
    });
    assert.equal(previewOutcome.ok, false);
    assert.match(previewOutcome.error, /Chưa đóng giải/);
    assert.equal(resolveCloseMutationOutcome({ ok: true, rpcCalled: true }).ok, true);
  });

  it("orchestrator confirms close and attaches the canonical snapshot", () => {
    const orchestrator = readSrc(
      "src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"
    );
    const closeBlock = orchestrator.slice(
      orchestrator.indexOf("async persistCloseTournament")
    );
    assert.match(closeBlock, /buildSetupMutationSnapshotPackageAsync/);
    assert.match(closeBlock, /buildCloseTournamentPayload\(payload, snapshot\)/);
    assert.match(closeBlock, /confirmed: true/);
    assert.match(closeBlock, /resolveCloseMutationOutcome\(result\)/);
  });

  it("awards panel refuses to celebrate an unpersisted close", () => {
    const panel = readSrc("src/components/tournament/team/TeamAwardsClosePanel.jsx");
    assert.match(panel, /assertPersisted: resolveCloseMutationOutcome/);
    assert.match(panel, /if \(!persisted\.ok\)/);
  });
});

describe("R4 — follow-up package provenance (no lifecycle APPLY rerun)", () => {
  it("locks LF SHA256 for follow-up SQL package", () => {
    for (const [file, expected] of Object.entries(FOLLOWUP_PACKAGE_LF_SHA256)) {
      assert.equal(sha256Lf(file), expected, file);
    }
  });

  it("VERIFY fixture requires name + real venue tenant; APPLY does not re-run lifecycle close", () => {
    const verify = readFileSync(path.join(pkgDir, "03_VERIFY.sql"), "utf8");
    const apply = readFileSync(path.join(pkgDir, "02_APPLY.sql"), "utf8");
    assert.match(verify, /name,\s*status/);
    assert.match(verify, /from public\.venues/);
    assert.match(verify, /VERIFY_FAIL: disposable cleanup left/);
    assert.match(verify, /VERIFY owner-browser-acceptance-01/);
    assert.doesNotMatch(apply, /create or replace function public\.team_tournament_assert_close_readiness/i);
    assert.doesNotMatch(apply, /create or replace function public\.team_tournament_close_tournament/i);
    assert.match(apply, /team_tournament_referee_competition_athlete_directory/);
    assert.match(apply, /scoringMode/);
  });
});
