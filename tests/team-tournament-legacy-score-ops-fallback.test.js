import test from "node:test";
import assert from "node:assert/strict";

import {
  LEGACY_SCORE_HARD_BLOCK_CODES,
  canConfirmLegacyResult,
  canSaveLegacyDraft,
  isLegacyScoreBlocked,
  isSubMatchImmutableForLegacyScore,
  resolveLegacyScorePanelEditable,
} from "../src/features/team-tournament/engines/teamRefereeV5BridgeEngine.js";
import {
  resolveScorePanelServerSync,
  buildSubMatchScoreFingerprint,
} from "../src/features/team-tournament/engines/teamRefereePortalUiState.js";

const authorizedBase = {
  canEdit: true,
  hasOfficialLineup: true,
  subMatch: {
    subMatchId: "sub-1",
    status: "waiting",
    resultConfirmedAt: null,
    score: { teamA: 0, teamB: 0, games: [] },
  },
};

test("A: scoreOps undefined + canEdit + official lineup → enabled", () => {
  assert.equal(
    resolveLegacyScorePanelEditable({
      ...authorizedBase,
      scoreOps: undefined,
    }),
    true
  );
  assert.equal(canSaveLegacyDraft(undefined), true);
});

test("B: scoreOps null → enabled under authorized conditions", () => {
  assert.equal(
    resolveLegacyScorePanelEditable({
      ...authorizedBase,
      scoreOps: null,
    }),
    true
  );
  assert.equal(canSaveLegacyDraft(null), true);
});

test("C: scoreOps explicit canSaveDraft=true → enabled if no hard block", () => {
  assert.equal(
    canSaveLegacyDraft({ canSaveDraft: true, canConfirm: true, blockCode: null }),
    true
  );
  assert.equal(
    resolveLegacyScorePanelEditable({
      ...authorizedBase,
      scoreOps: { canSaveDraft: true, blockCode: null },
    }),
    true
  );
});

test("D: scoreOps explicit V5 block → disabled", () => {
  const ops = {
    canSaveDraft: false,
    canConfirm: false,
    blockCode: "referee_v5_linked_legacy_write_blocked",
  };
  assert.equal(isLegacyScoreBlocked(ops), true);
  assert.equal(canSaveLegacyDraft(ops), false);
  assert.equal(
    resolveLegacyScorePanelEditable({ ...authorizedBase, scoreOps: ops }),
    false
  );
});

test("E: recognized referee_v5_* block → disabled", () => {
  for (const blockCode of [
    "referee_v5_linked_legacy_write_blocked",
    "referee_v5_match_active",
    "referee_v5_result_finalized",
  ]) {
    assert.equal(
      canSaveLegacyDraft({ canSaveDraft: false, blockCode }),
      false,
      blockCode
    );
  }
  assert.ok(LEGACY_SCORE_HARD_BLOCK_CODES.includes("reprovision_required"));
  assert.ok(LEGACY_SCORE_HARD_BLOCK_CODES.includes("result_already_confirmed"));
});

test("F: canEdit=false → disabled", () => {
  assert.equal(
    resolveLegacyScorePanelEditable({
      ...authorizedBase,
      canEdit: false,
      scoreOps: null,
    }),
    false
  );
});

test("G: hasOfficialLineup=false → disabled", () => {
  assert.equal(
    resolveLegacyScorePanelEditable({
      ...authorizedBase,
      hasOfficialLineup: false,
      scoreOps: null,
    }),
    false
  );
});

test("H: confirmed/finalized result → disabled", () => {
  assert.equal(
    isSubMatchImmutableForLegacyScore({
      status: "completed",
      resultConfirmedAt: "2026-08-10T12:00:00.000Z",
    }),
    true
  );
  assert.equal(
    resolveLegacyScorePanelEditable({
      ...authorizedBase,
      scoreOps: null,
      subMatch: {
        status: "completed",
        resultConfirmedAt: "2026-08-10T12:00:00.000Z",
      },
    }),
    false
  );
  assert.equal(
    resolveLegacyScorePanelEditable({
      ...authorizedBase,
      scoreOps: { canSaveDraft: true, blockCode: "referee_v5_result_finalized" },
      subMatch: { status: "waiting", resultConfirmedAt: null },
    }),
    false
  );
});

test("I: Organizer/Super Admin direct score without referee assignment → enabled", () => {
  assert.equal(
    resolveLegacyScorePanelEditable({
      canEdit: true,
      hasOfficialLineup: true,
      scoreOps: null,
      subMatch: { status: "waiting", resultConfirmedAt: null },
    }),
    true
  );
});

test("J: + click mutates local score when enabled (dirty sync keeps local)", () => {
  const server = {
    subMatchId: "sub-1",
    version: 1,
    status: "waiting",
    score: { teamA: 0, teamB: 0, games: [] },
  };
  const fingerprint = buildSubMatchScoreFingerprint(server);
  // After local + to 1, dirty state must survive equivalent refresh
  const sync = resolveScorePanelServerSync({
    dirty: true,
    previousFingerprint: fingerprint,
    subMatch: { ...server, score: { teamA: 0, teamB: 0, games: [] } },
  });
  assert.equal(sync.action, "keep");
  assert.equal(sync.dirty, true);
  // Enabled panel is prerequisite for click
  assert.equal(
    resolveLegacyScorePanelEditable({
      ...authorizedBase,
      scoreOps: null,
    }),
    true
  );
});

test("malformed scoreOps without allow signal is not authorization", () => {
  assert.equal(canSaveLegacyDraft({}), false);
  assert.equal(canSaveLegacyDraft("nope"), false);
  assert.equal(canConfirmLegacyResult({}), false);
});

test("explicit canSaveDraft false without hard block still denies", () => {
  assert.equal(
    canSaveLegacyDraft({ canSaveDraft: false, blockCode: "FORBIDDEN" }),
    false
  );
});

test("confirm mirrors null fallback + V5 hard block", () => {
  assert.equal(canConfirmLegacyResult(null), true);
  assert.equal(
    canConfirmLegacyResult({
      canConfirm: false,
      blockCode: "referee_v5_match_active",
    }),
    false
  );
  assert.equal(
    canConfirmLegacyResult({ canConfirm: true, blockCode: null }),
    true
  );
});
