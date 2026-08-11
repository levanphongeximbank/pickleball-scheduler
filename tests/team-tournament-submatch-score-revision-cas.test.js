import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SUBMATCH_REVISION,
  SUBMATCH_REVISION_ENTITY,
  evaluateSubMatchRevisionCas,
  resolveSubMatchExpectedVersion,
  resolveSubMatchRevision,
} from "../src/features/team-tournament/engines/subMatchRevisionContract.js";
import {
  freezeBaseVersionOnFirstEdit,
  rebaseScorePanelAfterSuccessfulWrite,
  resolveDirtyBaseSubMatchVersion,
  resolveScorePanelServerSync,
  buildSubMatchScoreFingerprint,
  bindScoreActionIds,
} from "../src/features/team-tournament/engines/teamRefereePortalUiState.js";
import { buildRefereeMatchupView } from "../src/features/team-tournament/engines/teamRefereeEngine.js";
import {
  TT1B_REQUIRES_EXPECTED_VERSION,
  TT1B_RPC_ARG_CONTRACTS,
  prepareTt1bCommandRpcCall,
} from "../src/features/team-tournament/services/teamTournamentRpcService.js";

const TOURNAMENT_VERSION = 11;
const MATCHUP_VERSION = 3;
const SUBMATCH_VERSION = 1;

function sampleTeamData() {
  return {
    teams: [
      { id: "team-a", name: "Đội A" },
      { id: "team-b", name: "Đội B" },
    ],
    disciplines: [
      {
        id: "md",
        name: "MD",
        scoringFormat: { matchFormat: "best_of_1" },
      },
    ],
    lineups: [
      {
        matchupId: "matchup-1",
        teamId: "team-a",
        status: "published",
        selections: { md: ["p1", "p2"] },
      },
      {
        matchupId: "matchup-1",
        teamId: "team-b",
        status: "published",
        selections: { md: ["p3", "p4"] },
      },
    ],
    matchups: [
      {
        id: "matchup-1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "published",
        version: MATCHUP_VERSION,
        subMatches: [
          {
            id: "sub-1",
            disciplineId: "md",
            status: "waiting",
            version: SUBMATCH_VERSION,
            score: { teamA: 0, teamB: 0, games: [] },
            scoreOps: { canSaveDraft: true, canConfirm: true, subMatchVersion: SUBMATCH_VERSION },
          },
        ],
      },
    ],
  };
}

test("A: fresh draft edit starts from subMatch.version", () => {
  const sub = { version: SUBMATCH_VERSION, scoreOps: { subMatchVersion: 99 } };
  assert.equal(resolveSubMatchRevision(sub), SUBMATCH_VERSION);
  assert.equal(resolveSubMatchExpectedVersion(sub), SUBMATCH_VERSION);
  assert.equal(SUBMATCH_REVISION_ENTITY, "team_tournament_sub_matches");
});

test("B: Save Draft expectedVersion uses subMatch.version not tournament", () => {
  const expected = resolveSubMatchExpectedVersion({ version: SUBMATCH_VERSION });
  assert.equal(expected, SUBMATCH_VERSION);
  assert.notEqual(expected, TOURNAMENT_VERSION);
  assert.notEqual(expected, MATCHUP_VERSION);
});

test("C/D: Save succeeds with matching revision and bumps once", () => {
  const cas = evaluateSubMatchRevisionCas({
    currentVersion: SUBMATCH_VERSION,
    expectedVersion: SUBMATCH_VERSION,
  });
  assert.equal(cas.ok, true);
  assert.equal(cas.write, true);
  assert.equal(cas.nextVersion, SUBMATCH_VERSION + 1);
});

test("E: F5/readback fingerprint includes saved score + revision", () => {
  const after = {
    subMatchId: "sub-1",
    version: 2,
    status: "playing",
    score: { teamA: 11, teamB: 5, games: [] },
  };
  const fp = buildSubMatchScoreFingerprint(after);
  assert.match(fp, /"version":2/);
  assert.match(fp, /"scoreA":11/);
});

test("F/L: Stale Save/Confirm → conflict + zero write", () => {
  const stale = evaluateSubMatchRevisionCas({
    currentVersion: SUBMATCH_VERSION,
    expectedVersion: TOURNAMENT_VERSION,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "version_conflict");
  assert.equal(stale.write, false);
});

test("G/H: Dirty local score freezes base revision; poll does not change it", () => {
  const serverV1 = { version: 1, score: { teamA: 0, teamB: 0, games: [] }, subMatchId: "sub-1" };
  const base = resolveDirtyBaseSubMatchVersion({
    dirty: false,
    previousBaseVersion: null,
    subMatch: serverV1,
  });
  assert.equal(base.baseSubMatchVersion, 1);
  assert.equal(base.frozen, false);

  const frozen = freezeBaseVersionOnFirstEdit({
    wasDirty: false,
    previousBaseVersion: base.baseSubMatchVersion,
    serverVersion: 1,
  });
  assert.equal(frozen, 1);

  const afterPoll = resolveDirtyBaseSubMatchVersion({
    dirty: true,
    previousBaseVersion: frozen,
    subMatch: { ...serverV1, version: 2, score: { teamA: 9, teamB: 1, games: [] } },
  });
  assert.equal(afterPoll.baseSubMatchVersion, 1);
  assert.equal(afterPoll.frozen, true);
  assert.equal(afterPoll.serverVersion, 2);
});

test("I: External server revision change while dirty produces conflict action", () => {
  const pristine = {
    subMatchId: "sub-1",
    version: 1,
    status: "waiting",
    score: { teamA: 0, teamB: 0, games: [] },
  };
  const fp0 = buildSubMatchScoreFingerprint(pristine);
  const sync = resolveScorePanelServerSync({
    dirty: true,
    previousFingerprint: fp0,
    subMatch: { ...pristine, version: 2, score: { teamA: 7, teamB: 3, games: [] } },
  });
  assert.equal(sync.action, "conflict");
  assert.equal(sync.conflict, true);
  assert.equal(sync.dirty, true);
});

test("J/K: Confirm uses subMatch.version and bumps once", () => {
  const expected = resolveSubMatchExpectedVersion({ version: 4 });
  assert.equal(expected, 4);
  const cas = evaluateSubMatchRevisionCas({
    currentVersion: 4,
    expectedVersion: expected,
  });
  assert.equal(cas.nextVersion, 5);
});

test("M/N: No tournament.version or matchup.version coupling in resolver", () => {
  const fromOps = resolveSubMatchRevision({
    scoreOps: { subMatchVersion: 3 },
  });
  assert.equal(fromOps, 3);
  assert.equal(resolveSubMatchRevision({}), DEFAULT_SUBMATCH_REVISION);
  assert.notEqual(resolveSubMatchRevision({ version: 1 }), TOURNAMENT_VERSION);
});

test("O: Wrong subMatch ID binding rejects score action", () => {
  const binding = bindScoreActionIds({
    panelMatchupId: "matchup-1",
    panelSubMatchId: "sub-1",
    requestedMatchupId: "matchup-1",
    requestedSubMatchId: "sub-OTHER",
  });
  assert.equal(binding.ok, false);
  assert.equal(binding.error, "SCORE_ACTION_MATCHUP_BINDING_MISMATCH");
});

test("P: Idempotent CAS decision is pure (same inputs → same outcome)", () => {
  const a = evaluateSubMatchRevisionCas({ currentVersion: 2, expectedVersion: 2 });
  const b = evaluateSubMatchRevisionCas({ currentVersion: 2, expectedVersion: 2 });
  assert.deepEqual(a, b);
  assert.equal(a.nextVersion, 3);
});

test("Q: Missing expectedVersion cannot write", () => {
  const missing = evaluateSubMatchRevisionCas({
    currentVersion: 1,
    expectedVersion: null,
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.write, false);
  assert.equal(missing.code, "MISSING_EXPECTED_VERSION");
});

test("R: buildRefereeMatchupView exposes canonical version field", () => {
  const view = buildRefereeMatchupView(sampleTeamData(), "matchup-1", []);
  assert.equal(view.ok, true);
  assert.equal(view.matchup.subMatches[0].version, SUBMATCH_VERSION);
});

test("S: rebase after successful write updates base revision", () => {
  const rebased = rebaseScorePanelAfterSuccessfulWrite({
    subMatchId: "sub-1",
    version: 2,
    status: "playing",
    score: { teamA: 11, teamB: 8, games: [] },
  });
  assert.equal(rebased.baseSubMatchVersion, 2);
  assert.equal(rebased.dirty, false);
  assert.equal(rebased.scoreA, 11);
});

test("TT-1B: save_sub_match_draft requires expectedVersion + contract args", () => {
  assert.ok(TT1B_REQUIRES_EXPECTED_VERSION.includes("team_tournament_save_sub_match_draft"));
  assert.ok(TT1B_REQUIRES_EXPECTED_VERSION.includes("team_tournament_confirm_sub_match"));
  assert.deepEqual(TT1B_RPC_ARG_CONTRACTS.team_tournament_save_sub_match_draft, [
    "p_tournament_id",
    "p_matchup_id",
    "p_sub_match_id",
    "p_score",
    "p_expected_version",
    "p_idempotency_key",
  ]);

  const missing = prepareTt1bCommandRpcCall(
    "team_tournament_save_sub_match_draft",
    {
      p_tournament_id: "t1",
      p_matchup_id: "m1",
      p_sub_match_id: "s1",
      p_score: { teamA: 1, teamB: 0 },
    },
    { expectedVersion: null, idempotencyKey: "k1" }
  );
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "MISSING_EXPECTED_VERSION");

  const ok = prepareTt1bCommandRpcCall(
    "team_tournament_save_sub_match_draft",
    {
      p_tournament_id: "t1",
      p_matchup_id: "m1",
      p_sub_match_id: "s1",
      p_score: { teamA: 1, teamB: 0 },
    },
    { expectedVersion: 1, idempotencyKey: "k1" }
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.args.p_expected_version, 1);
  assert.equal(ok.args.p_idempotency_key, "k1");
});
