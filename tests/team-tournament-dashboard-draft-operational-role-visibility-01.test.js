/**
 * Draft operational-role Dashboard visibility package contracts.
 * Does not mutate Staging.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkg = join(
  root,
  "docs/v5/migrations/team-tournament-dashboard-draft-operational-role-visibility-01"
);

const LOCKED = Object.freeze({
  "01_PRECHECK.sql":
    "933e273b2cfcfa30e4b8710f5ebef6f3a2400ab3bbb2a2b2ca506087672252a2",
  "02_APPLY.sql":
    "cc059feb5f25c34f824d9233eee3128ec1095dead8926449150454b6815200a2",
  "03_VERIFY.sql":
    "3c0e7e9ee71ef896db59985920ce2796a8d85ca07d5a6bfe9ae38f711ef4ed80",
  "04_ROLLBACK.sql":
    "517aa6fde5eba6922491d3a5b163cdc25531db381b9325bb99a3c58f1d741ab9",
});

function sha256(rel) {
  const text = readFileSync(join(pkg, rel), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("team-tournament-dashboard-draft-operational-role-visibility-01", () => {
  it("package encodes role-before-visibility ordering and helper decision", () => {
    const apply = readFileSync(join(pkg, "02_APPLY.sql"), "utf8");
    const verify = readFileSync(join(pkg, "03_VERIFY.sql"), "utf8");
    const precheck = readFileSync(join(pkg, "01_PRECHECK.sql"), "utf8");
    const rollback = readFileSync(join(pkg, "04_ROLLBACK.sql"), "utf8");

    assert.match(precheck, /306f3d55f27cc2ac1010b6ece771388b/);
    assert.match(apply, /team_tournament_can_view_dashboard/);
    assert.match(apply, /v_is_captain_or_deputy/);
    assert.match(apply, /v_is_assigned_referee/);
    assert.match(apply, /from public\.athletes a/);
    assert.match(apply, /captain_player_id/);
    assert.match(apply, /deputy_player_ids/);
    assert.match(apply, /referee_assignments/);
    // Captain/referee resolve before DRAFT_NOT_VISIBLE return.
    const captainIdx = apply.indexOf("v_is_captain_or_deputy :=");
    const refereeIdx = apply.indexOf("v_is_assigned_referee :=");
    const decideIdx = apply.indexOf("team_tournament_can_view_dashboard(");
    const denyIdx = apply.indexOf("'DRAFT_NOT_VISIBLE'");
    assert.ok(captainIdx > 0 && refereeIdx > 0 && decideIdx > 0 && denyIdx > 0);
    assert.ok(captainIdx < denyIdx);
    assert.ok(refereeIdx < denyIdx);
    assert.ok(decideIdx < denyIdx);
    assert.doesNotMatch(
      apply.slice(0, decideIdx),
      /return jsonb_build_object\('ok', false, 'code', 'DRAFT_NOT_VISIBLE'\)/
    );

    assert.match(verify, /helper_draft_captain_pass/);
    assert.match(verify, /helper_draft_ordinary_deny/);
    assert.match(verify, /c412a001-7e57-4000-8000-000000000004/);
    assert.match(verify, /c412a001-7e57-4000-8000-000000000008/);
    assert.match(verify, /DRAFT_NOT_VISIBLE/);
    assert.match(rollback, /306f3d55f27cc2ac1010b6ece771388b/);
    assert.match(rollback, /drop function if exists public\.team_tournament_can_view_dashboard/);
  });

  it("locked SHA256 fingerprints match package files", () => {
    for (const [file, expected] of Object.entries(LOCKED)) {
      assert.equal(sha256(file), expected, file);
    }
  });
});
