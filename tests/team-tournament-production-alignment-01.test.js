/**
 * Production Team Tournament alignment package — static contract tests.
 * STAGING_MUTATIONS=0. PRODUCTION_MUTATIONS=0.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-production-alignment-01"
);
const finalDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-canonical-referee-lifecycle-01"
);

const PACKAGE_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "99312a92810834b45c467337fdb664451d641c7f97b05fcaa3dfa7483d72b4f5",
  "02_APPLY.sql":
    "e7d5f4e9326a1768bdde6c05e0a415c80d253d23558bf38250c3efe6fff7278d",
  "03_VERIFY.sql":
    "4d858d7c6af73fc1e837a384ce2034f42b4c32ccbfe3c21e67ec5398d73f2221",
  "04_ROLLBACK.sql":
    "7819cbfb1ed63e8d2ced2aa8595c4da667e3bc51c7d4e4ad110ead38b973c7d7",
});

const FINAL_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "ce9392188218e9a0ee5c45aa0b64ae3955079c2b4c33622b0109a238b71b8956",
  "02_APPLY.sql":
    "eb0fab536f400178339260c259c9ec5ae40e8394ee14913f50bedadda39d7bdb",
  "03_VERIFY.sql":
    "29e21fc20dc0db0af1607129efd259f7920e4f1e3d07348801f48ab0b03a8859",
  "04_ROLLBACK.sql":
    "cbe029e5f4c159fd4e414adcceb45b73781390199c8a76bc3fbc4160947e733d",
});

function sha256Lf(dir, name) {
  const raw = readFileSync(path.join(dir, name));
  const lf = Buffer.from(
    raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  );
  return createHash("sha256").update(lf).digest("hex");
}

function readPkg(name) {
  return readFileSync(path.join(pkgDir, name), "utf8");
}

describe("team-tournament-production-alignment-01", () => {
  it("locks LF SHA256 package hashes", () => {
    for (const [name, expected] of Object.entries(PACKAGE_LF_SHA256)) {
      assert.equal(sha256Lf(pkgDir, name), expected, name);
    }
  });

  it("does not modify hash-locked canonical-referee-lifecycle package", () => {
    for (const [name, expected] of Object.entries(FINAL_LF_SHA256)) {
      assert.equal(sha256Lf(finalDir, name), expected, `final ${name}`);
    }
  });

  it("PRECHECK uses array_append and fail-closed classifiers", () => {
    const pre = readPkg("01_PRECHECK.sql");
    assert.match(pre, /array_append\(v_missing/);
    assert.doesNotMatch(pre, /v_missing\s*:=\s*v_missing\s*\|\|\s*'/);
    assert.match(pre, /PRECHECK_FAIL missing=%/);
    assert.match(pre, /PRECHECK_FAIL conflict=/);
    assert.match(pre, /partial_alignment_state/);
    assert.match(pre, /ABSENT_SUPPORTED/);
    assert.match(pre, /PRESENT_EXACT/);
    assert.match(pre, /PRESENT_SUPPORTED_LEGACY_TO_REPLACE/);
    assert.match(pre, /PR423/);
  });

  it("APPLY is consolidated current-main contract without historical replay or backfill", () => {
    const apply = readPkg("02_APPLY.sql");
    assert.match(apply, /team_tournament_create\(/);
    assert.match(apply, /team_tournament_seed_mlp_disciplines/);
    assert.match(apply, /team_tournament_commit_pairing/);
    assert.match(apply, /team_tournament_get_dashboard/);
    assert.match(apply, /athletes a/);
    assert.match(apply, /scoringMode/);
    assert.match(apply, /p_expected_matchup_version/);
    assert.doesNotMatch(apply, /\\i\s/);
    assert.doesNotMatch(
      apply,
      /update public\.team_tournaments[\s\S]{0,400}captainAccessEnabled',\s*true[\s\S]{0,200}where not/i
    );
    assert.doesNotMatch(apply, /team_tournament_result_write_guard/);
    assert.doesNotMatch(apply, /team_tournament_ensure_referee_runtime_for_matchup/);
    assert.doesNotMatch(apply, /GRANT EXECUTE ON FUNCTION[^\n]+TO PUBLIC/i);
    assert.match(apply, /revoke all on function %s from anon/i);
  });

  it("APPLY does not include canonical referee continuation objects", () => {
    const apply = readPkg("02_APPLY.sql");
    assert.doesNotMatch(apply, /resolve_effective_referee_assignment/);
    assert.doesNotMatch(apply, /trg_tt_matchup_ensure_referee_runtime/);
    assert.doesNotMatch(apply, /list_my_referee_assignments/);
  });

  it("VERIFY proves create path, CAS signatures, security, and foundation intact", () => {
    const verify = readPkg("03_VERIFY.sql");
    assert.match(verify, /CREATE_PATH_READY/);
    assert.match(verify, /save_lineup_draft_6arg/);
    assert.match(verify, /get_setup\.2arg_still_present/);
    assert.match(verify, /anon_privileged_execute/);
    assert.match(verify, /foundation.create_referee_assignment_missing/);
    assert.match(verify, /unexpected.continuation.result_write_guard/);
    assert.match(verify, /captain_access_backfill_detected/);
  });

  it("ROLLBACK restores prestate snapshot and fails closed after post-alignment creates", () => {
    const rollback = readPkg("04_ROLLBACK.sql");
    assert.match(rollback, /ROLLBACK_COMPLETE=NO post_alignment_canonical_team_tournaments/);
    assert.match(rollback, /team_tournament_alignment_01_prestate/);
    assert.match(rollback, /execute r.def/);
    assert.doesNotMatch(rollback, /drop function if exists public.team_tournament_create_referee_assignment/);
  });
});
