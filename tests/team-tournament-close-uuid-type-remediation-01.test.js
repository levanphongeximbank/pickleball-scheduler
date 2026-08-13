/**
 * Close dual-write uuid=text remediation package contracts.
 * STAGING_MUTATIONS=0 — package local only until Owner GO.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  STAGE_SCORING_MODE,
  STAGE_SCORING_MODE_LABELS,
  normalizeStageScoringMode,
} from "../src/features/team-tournament/engines/teamStageScoringPolicy.js";
import {
  buildCloseTournamentPayload,
  isCloseMutationPersisted,
} from "../src/features/team-tournament/setup/closeTournamentMutation.js";
import { SETUP_MUTATION_RPC_BY_COMMAND } from "../src/features/team-tournament/setup/setupMutationRpcRegistry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-close-uuid-type-remediation-01"
);

const PACKAGE_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "bdbfdb97eda7704106ae1444ece83b6aeeab086656d2d04184070745c33d7d51",
  "02_APPLY.sql":
    "3235f8e768800cc1eff209423815d331fbcb41baa6743209888a0b4db1823ca4",
  "03_VERIFY.sql":
    "72fcbeb5944a847bdea16b7d29a849b3b2b7c9920a0c88fd28cd5322f20a64b8",
  "04_ROLLBACK.sql":
    "6c837b9b57c73f31b8e10170f6fee661ed33ba821936530e8b5f1471948cbc15",
});

function readPkg(name) {
  return readFileSync(path.join(pkgDir, name), "utf8");
}

function sha256Lf(name) {
  const raw = readFileSync(path.join(pkgDir, name));
  const lf = Buffer.from(
    raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  );
  return createHash("sha256").update(lf).digest("hex");
}

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("team-tournament-close-uuid-type-remediation-01", () => {
  it("locks LF SHA256 package hashes", () => {
    for (const [file, expected] of Object.entries(PACKAGE_LF_SHA256)) {
      assert.equal(sha256Lf(file), expected, file);
    }
  });

  it("close dual-write uses uuid cast / external_key — no bare uuid=text", () => {
    const apply = readPkg("02_APPLY.sql");
    assert.match(apply, /update public\.canonical_tournaments/);
    assert.match(apply, /nullif\(btrim\(coalesce\(v_header\.tournament_id/i);
    assert.match(apply, /\)::uuid/);
    assert.match(apply, /external_key = nullif\(btrim/);
    assert.doesNotMatch(
      apply,
      /where id = v_header\.tournament_id\s*\n\s*or id = p_tournament_id/
    );
  });

  it("preserves readiness gate, completed dual-write, and client champion discard", () => {
    const apply = readPkg("02_APPLY.sql");
    assert.match(apply, /team_tournament_assert_close_readiness\(v_header\.id\)/);
    assert.match(apply, /status = 'completed'/);
    assert.match(apply, /CLIENT_RESULT_PAYLOAD_TRUSTED_AS_AUTHORITY=NO/);
    assert.match(apply, /v_payload \? 'championTeamId'/);
    assert.match(apply, /CHAMPION_UNRESOLVED/);
  });

  it("client close path reaches team_tournament_close_tournament with confirmed+snapshot", () => {
    assert.equal(
      SETUP_MUTATION_RPC_BY_COMMAND["tournament.close"],
      "team_tournament_close_tournament"
    );
    const orchestrator = readSrc(
      "src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"
    );
    const closeBlock = orchestrator.slice(
      orchestrator.indexOf("async persistCloseTournament")
    );
    assert.match(closeBlock, /confirmed: true/);
    assert.match(closeBlock, /buildCloseTournamentPayload/);
    assert.match(closeBlock, /buildSetupMutationSnapshotPackageAsync/);

    const payload = buildCloseTournamentPayload(
      { reason: "tournament.close", championTeamId: "forged-client" },
      { snapshotHash: "h", snapshotCanonicalText: "{}", normalizedReadHash: "h" }
    );
    assert.equal(payload.championTeamId, undefined);
    assert.equal(payload.snapshot.snapshotHash, "h");
    assert.equal(
      isCloseMutationPersisted({ ok: true, rpcCalled: true, version: 2 }),
      true
    );
  });

  it("one-group requires no knockout (readiness package still documents one_group)", () => {
    const verify = readPkg("03_VERIFY.sql");
    assert.match(verify, /assert_close_readiness|one.group|GROUP_STAGE/i);
    assert.doesNotMatch(verify, /fake knockout|invent.*quarterfinal/i);
  });

  it("VERIFY forbids leftover disposable rows and requires name+venue tenant", () => {
    const verify = readPkg("03_VERIFY.sql");
    assert.match(verify, /venues/);
    assert.match(verify, /name/);
    assert.match(verify, /verify-close-uuid/);
  });

  it("stage scoring UI still exposes Truyền thống / Trực tiếp (Rally) only", () => {
    assert.equal(STAGE_SCORING_MODE_LABELS[STAGE_SCORING_MODE.TRADITIONAL], "Truyền thống");
    assert.equal(STAGE_SCORING_MODE_LABELS[STAGE_SCORING_MODE.RALLY], "Trực tiếp (Rally)");
    assert.equal(normalizeStageScoringMode(undefined), STAGE_SCORING_MODE.RALLY);
    assert.equal(normalizeStageScoringMode("rally"), STAGE_SCORING_MODE.RALLY);
    const panel = readSrc(
      "src/components/tournament/team/TeamFormatVenueSetupPanel.jsx"
    );
    assert.match(panel, /STAGE_SCORING_MODE\.TRADITIONAL/);
    assert.match(panel, /STAGE_SCORING_MODE\.RALLY/);
  });

  it("does not rerun prior applied packages", () => {
    const apply = readPkg("02_APPLY.sql");
    assert.doesNotMatch(apply, /team_tournament_referee_competition_athlete_directory/);
    assert.doesNotMatch(apply, /create or replace function public\.team_tournament_assert_close_readiness/);
    const readme = readPkg("README.md");
    assert.match(readme, /NEVER re-run|never rerun|Do NOT re-run/i);
  });
});
