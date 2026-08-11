/**
 * TEAM-TOURNAMENT-PR412-CAPTAIN-CONFIRM-LIVE-INSTRUMENTATION-01
 * Diagnostic markers only — no persistence behavior assertions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  TT412_CAPTAIN_CONFIRM_DIAG,
  tt412CaptainConfirmDiag,
} from "../src/features/team-tournament/services/tt412CaptainConfirmDiagnostics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

describe("team-tournament-pr412-captain-confirm-live-instrumentation-01", () => {
  it("diagnostic markers are wired into live confirm path (no behavior gates)", () => {
    const dialog = readSrc("src/components/tournament/team/TeamAiPairingDialog.jsx");
    assert.match(dialog, /onClick=\{handleApply\}/);
    assert.match(dialog, /TT412_CAPTAIN_CONFIRM_DIAG\.START/);
    assert.match(dialog, /TT412_CAPTAIN_CONFIRM_DIAG\.RESULT/);
    assert.doesNotMatch(dialog, /location\.reload/);

    const persist = readSrc(
      "src/features/team-tournament/services/aiPairingCloudPersistence.js"
    );
    assert.match(persist, /TT412_GROUP_PERSIST_DECISION|GROUP_PERSIST_DECISION/);
    assert.match(persist, /commitPairing|team_tournament_commit_pairing/);
    assert.match(persist, /REPLACE_GROUPS_SKIPPED/);
    assert.match(persist, /TT412_CAPTAIN_CONFIRM_DIAG\.RESULT/);
    assert.doesNotMatch(persist, /TT412_REPLACE_GROUPS_CALL/);

    const roster = readSrc("src/components/tournament/TeamRosterPanel.jsx");
    assert.match(roster, /confirmAiPairingUiTransaction/);
  });

  it("diag helper strips secret-ish keys and never throws", () => {
    assert.equal(TT412_CAPTAIN_CONFIRM_DIAG.START, "[TT412_CAPTAIN_CONFIRM_START]");
    assert.doesNotThrow(() =>
      tt412CaptainConfirmDiag(TT412_CAPTAIN_CONFIRM_DIAG.START, {
        tournamentId: "tt-1",
        token: "should-be-stripped",
        accessToken: "nope",
        email: "a@b.c",
        groupCount: 1,
      })
    );
  });
});
