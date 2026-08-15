/**
 * Production referee foundation package — static contract tests.
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
  "docs/v5/migrations/team-tournament-production-referee-foundation-01"
);
const finalDir = path.join(
  root,
  "docs/v5/migrations/team-tournament-canonical-referee-lifecycle-01"
);

const PACKAGE_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "7fdc406e95eb34b7d9a52dd0a6038d9df82184dd3d7d968b99ce94912b95eeb3",
  "02_APPLY.sql":
    "0844ba3cb5bb76d9d09df84a43beb05951d35c033ec4856ab29393899ee8a8e7",
  "03_VERIFY.sql":
    "43af44345a3adea5b90b481bee8d645872d79a08d734a6be8cea621fe2ca5e29",
  "04_ROLLBACK.sql":
    "3aacae2af388e19fa6cb90d549bc77b231cae5d7069c43bcae06327225206679",
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

describe("team-tournament-production-referee-foundation-01", () => {
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

  it("PRECHECK uses array_append and fail-closed missing diagnostic", () => {
    const pre = readPkg("01_PRECHECK.sql");
    assert.match(pre, /array_append\(v_missing/);
    assert.doesNotMatch(pre, /v_missing\s*:=\s*v_missing\s*\|\|\s*'/);
    assert.match(pre, /PRECHECK_FAIL missing=%/);
    assert.match(pre, /partial_foundation_state/);
    assert.match(pre, /PRECHECK_FAIL conflict=/);
    assert.match(pre, /unexpected_grants=/);
  });

  it("APPLY is additive foundation only", () => {
    const apply = readPkg("02_APPLY.sql");
    assert.match(apply, /create table if not exists public\.referee_assignments/);
    assert.match(apply, /create table if not exists public\.match_live_states/);
    assert.match(apply, /create table if not exists public\.team_sub_match_referee_links/);
    assert.match(apply, /state_payload/);
    assert.match(apply, /expires_at/);
    assert.match(apply, /sub_match_id/);
    assert.match(apply, /team_tournament_create_referee_assignment/);
    assert.match(apply, /team_tournament_provision_eligibility/);
    assert.match(apply, /team_tournament_build_v5_state_shell/);
    assert.match(apply, /dreambreaker_out_of_scope/);
    assert.doesNotMatch(apply, /\bv_parent\b/);
    assert.doesNotMatch(apply, /team_tournament_resolve_effective_referee_assignment/);
    assert.doesNotMatch(apply, /team_tournament_result_write_guard/);
    assert.doesNotMatch(apply, /team_tournament_ensure_referee_runtime_for_matchup/);
    assert.doesNotMatch(apply, /insert into public\.permissions/);
    assert.doesNotMatch(apply, /GRANT EXECUTE TO PUBLIC/i);
    assert.doesNotMatch(apply, /grant execute on function[\s\S]{0,200} to public/i);
    assert.doesNotMatch(apply, /referee_device_sessions/);
    assert.doesNotMatch(apply, /phase_v5d3_staging_fault_injection/);
    assert.doesNotMatch(apply, /from public\.profiles where id = auth\.uid\(\)/);
    assert.match(apply, /user_venue_id\(\)/);
    assert.match(apply, /force row level security/);
    assert.match(apply, /revoke all on function public\.team_tournament_build_v5_state_shell/);
    assert.match(apply, /from public, anon, authenticated/);
  });

  it("VERIFY asserts canonical lifecycle prestate ready and anon denied", () => {
    const verify = readPkg("03_VERIFY.sql");
    assert.match(verify, /CANONICAL_REFEREE_LIFECYCLE_PRESTATE_READY/);
    assert.match(verify, /anon_denied/);
    assert.match(verify, /relforcerowsecurity/);
    assert.match(verify, /dreambreaker_out_of_scope/);
    assert.match(verify, /create_already_canonical_parent_scope/);
  });

  it("ROLLBACK fails closed on live data and final continuation", () => {
    const rollback = readPkg("04_ROLLBACK.sql");
    assert.match(rollback, /ROLLBACK_REFUSED live_data=/);
    assert.match(rollback, /ROLLBACK_REFUSED final_continuation_present/);
    assert.match(rollback, /drop table if exists public\.referee_assignments/);
    assert.doesNotMatch(rollback, /drop function if exists public\.team_tournament_start_dreambreaker/);
    assert.doesNotMatch(rollback, /drop function if exists public\.team_tournament_confirm_sub_match/);
  });

  it("manifest classifies required vs excluded historical objects", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(pkgDir, "FOUNDATION_OBJECT_MANIFEST.json"), "utf8")
    );
    assert.equal(manifest.staging_history_replayed, false);
    assert.equal(manifest.staging_rows_copied, 0);
    assert.equal(manifest.permission_catalog_dml, false);
    assert.equal(manifest.existing_tournament_backfill_required, false);
    assert.equal(manifest.objects.length, 10);
    const names = manifest.objects.map((o) => o.OBJECT);
    assert.ok(names.some((n) => n.includes("referee_assignments")));
    assert.ok(names.some((n) => n.includes("match_live_states")));
    assert.ok(names.some((n) => n.includes("team_sub_match_referee_links")));
    const excluded = manifest.excluded.map((o) => o.OBJECT);
    assert.ok(excluded.includes("public.referee_device_sessions"));
    assert.ok(excluded.includes("public.team_tournament_provision_referee_match"));
    assert.ok(excluded.includes("phase_v5d3_staging_fault_injection"));
  });
});
