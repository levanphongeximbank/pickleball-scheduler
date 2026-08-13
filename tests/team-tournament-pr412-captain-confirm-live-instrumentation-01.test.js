/**
 * TEAM-TOURNAMENT-PR412-CAPTAIN-CONFIRM-LIVE-INSTRUMENTATION-01
 * Hygiene lock: TT412 preview diagnostics removed; confirm path unchanged.
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

describe("team-tournament-pr412-captain-confirm-live-instrumentation-01", () => {
  it("TT412 captain-confirm preview diagnostics are removed", () => {
    assert.equal(
      existsSync(
        path.join(
          ROOT,
          "src/features/team-tournament/services/tt412CaptainConfirmDiagnostics.js"
        )
      ),
      false
    );
    const dialog = readSrc("src/components/tournament/team/TeamAiPairingDialog.jsx");
    const persist = readSrc(
      "src/features/team-tournament/services/aiPairingCloudPersistence.js"
    );
    assert.doesNotMatch(dialog, /tt412CaptainConfirmDiag/);
    assert.doesNotMatch(dialog, /TT412_CAPTAIN_CONFIRM_DIAG/);
    assert.doesNotMatch(persist, /tt412CaptainConfirmDiag/);
    assert.doesNotMatch(persist, /TT412_CAPTAIN_CONFIRM_DIAG/);
    assert.match(dialog, /onClick=\{handleApply\}/);
    assert.doesNotMatch(dialog, /location\.reload/);
    assert.match(persist, /commitPairing|team_tournament_commit_pairing/);
  });
});
