/**
 * TEAM-TOURNAMENT-PR412-SAVE-DRAFT-LIVE-INSTRUMENTATION-01
 * Hygiene lock: TT412 preview diagnostics removed; save_draft contract unchanged.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

describe("team-tournament-pr412-save-draft-live-instrumentation-01", () => {
  it("TT412 save-draft preview diagnostics are removed", () => {
    assert.equal(
      existsSync(
        path.join(
          ROOT,
          "src/features/team-tournament/services/tt412SaveDraftDiagnostics.js"
        )
      ),
      false
    );
    const page = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
    const orchestrator = readSrc(
      "src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"
    );
    assert.doesNotMatch(page, /tt412SaveDraftDiag/);
    assert.doesNotMatch(page, /TT412_SAVE_DRAFT_DIAG/);
    assert.doesNotMatch(orchestrator, /tt412SaveDraftDiag/);
    assert.doesNotMatch(orchestrator, /TT412_SAVE_DRAFT_DIAG/);
    assert.match(page, /handleSaveDraft/);
    assert.doesNotMatch(page, /location\.reload/);
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
