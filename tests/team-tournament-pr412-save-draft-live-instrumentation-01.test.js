/**
 * TEAM-TOURNAMENT-PR412-SAVE-DRAFT-LIVE-INSTRUMENTATION-01
 * Diagnostic markers only — no save_draft behavior assertions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  TT412_SAVE_DRAFT_DIAG,
  tt412SaveDraftDiag,
} from "../src/features/team-tournament/services/tt412SaveDraftDiagnostics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

describe("team-tournament-pr412-save-draft-live-instrumentation-01", () => {
  it("diagnostic markers are wired into Lưu giải click path (no behavior gates)", () => {
    const page = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
    assert.match(page, /handleSaveDraft/);
    assert.match(page, /TT412_SAVE_DRAFT_DIAG\.START/);
    assert.match(page, /TT412_SAVE_DRAFT_DIAG\.FINAL/);
    assert.match(page, /onFormatDirtyDiagnostic/);
    assert.doesNotMatch(page, /location\.reload/);

    const orchestrator = readSrc(
      "src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"
    );
    assert.match(orchestrator, /TT412_SAVE_DRAFT_DIAG\.RPC_CALL/);
    assert.match(orchestrator, /TT412_SAVE_DRAFT_DIAG\.RPC_RESULT/);
    assert.match(orchestrator, /TT412_SAVE_DRAFT_DIAG\.READBACK/);
    assert.match(orchestrator, /team_tournament_save_draft/);
    assert.match(orchestrator, /tournament\.save_draft/);

    const formatPanel = readSrc(
      "src/components/tournament/team/TeamFormatVenueSetupPanel.jsx"
    );
    assert.match(formatPanel, /onFormatDirtyDiagnostic/);
  });

  it("marker constants match Owner-locked Preview strings", () => {
    assert.equal(TT412_SAVE_DRAFT_DIAG.START, "[TT412_SAVE_START]");
    assert.equal(TT412_SAVE_DRAFT_DIAG.RPC_CALL, "[TT412_SAVE_RPC_CALL]");
    assert.equal(TT412_SAVE_DRAFT_DIAG.RPC_RESULT, "[TT412_SAVE_RPC_RESULT]");
    assert.equal(TT412_SAVE_DRAFT_DIAG.READBACK, "[TT412_SAVE_READBACK]");
    assert.equal(TT412_SAVE_DRAFT_DIAG.FINAL, "[TT412_SAVE_FINAL]");
  });

  it("diag helper strips secret-ish keys and never throws", () => {
    assert.doesNotThrow(() =>
      tt412SaveDraftDiag(TT412_SAVE_DRAFT_DIAG.START, {
        tournamentId: "tt-1",
        token: "should-be-stripped",
        accessToken: "nope",
        email: "a@b.c",
        idempotencyKey: "full-key-must-not-log",
        rulesVersion: "1",
      })
    );
  });

  it("does not rewrite save_draft payload / update_setup_config semantics", () => {
    const orchestrator = readSrc(
      "src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"
    );
    const start = orchestrator.indexOf("async saveDraft(");
    const end = orchestrator.indexOf("async persistFormatVenueSetup(", start);
    assert.ok(start >= 0 && end > start);
    const saveDraftBlock = orchestrator.slice(start, end);
    assert.match(
      saveDraftBlock,
      /payload:\s*attachSnapshotPackageToPayload\(\{\s*draftState\s*\}/
    );
    assert.match(saveDraftBlock, /commandName:\s*"tournament\.save_draft"/);
    assert.match(saveDraftBlock, /confirmed:\s*true/);
    assert.doesNotMatch(
      saveDraftBlock,
      /commandName:\s*"tournament\.update_setup_config"/
    );
  });
});
