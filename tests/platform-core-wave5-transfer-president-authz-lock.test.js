import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { extractProsrc } from "../scripts/wave5-rpc-prosrc-fingerprint.mjs";

const APPLY = fs.readFileSync(
  path.join(
    process.cwd(),
    "docs/platform-core-wave5-club-context-closure/sql-design/02_APPLY_DESIGN.sql"
  ),
  "utf8"
);
const PHASE2D = fs.readFileSync(
  path.join(
    process.cwd(),
    "docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql"
  ),
  "utf8"
);
const LOCK = fs.readFileSync(
  path.join(
    process.cwd(),
    "docs/platform-core-wave5-club-context-closure/sql-design/08C_PRODUCTION_PREDECESSOR_VARIANT_AND_AUTHZ_LOCK.md"
  ),
  "utf8"
);

test("PROFILES_VENUE_ROLE_AUTHZ_FALLBACK_TEST: Wave5 target does not authorize via profiles.venue_id + venue roles", () => {
  const target = extractProsrc(APPLY, "phase42_can_transfer_president");
  assert.equal(target.md5GitLf, "61dd0458b9240d5407394f6f8d492bf0");
  assert.doesNotMatch(target.body, /profiles/i);
  assert.doesNotMatch(target.body, /venue_id/i);
  assert.doesNotMatch(target.body, /VENUE_OWNER/);
  assert.doesNotMatch(target.body, /COURT_OWNER/);
  assert.doesNotMatch(target.body, /TENANT_OWNER/);

  // Predecessor historical source still contains the retired fallback (must not be copied back).
  assert.match(PHASE2D, /profiles/);
  assert.match(PHASE2D, /venue_id/);
  assert.match(PHASE2D, /VENUE_OWNER/);
  assert.match(PHASE2D, /COURT_OWNER/);
  assert.match(PHASE2D, /TENANT_OWNER/);
});

test("TENANT_MEMBERS_OPERATIONAL_ENTITLEMENT_TEST: Wave5 target keeps tenant_members path", () => {
  const target = extractProsrc(APPLY, "phase42_can_transfer_president");
  assert.match(target.body, /tenant_members/);
  assert.match(target.body, /role_code\s*=\s*'tenant_owner'/);
  assert.match(target.body, /phase42_is_platform_super_admin/);
  assert.match(target.body, /phase42_has_gov_role/);
  assert.match(target.body, /user_has_permission\('club\.update'\)/);
});

test("WAVE4_AUTHORITY_LOCK_PRESERVED: architecture decision retires profiles Venue-role fallback", () => {
  assert.match(LOCK, /TRANSFER_PRESIDENT_PROFILES_VENUE_ROLE_FALLBACK=RETIRE/);
  assert.match(LOCK, /TENANT_OPERATIONAL_ENTITLEMENT=tenant_members/);
  assert.match(LOCK, /PROFILES_VENUE_ID_MAY_GRANT_TENANT_OPERATIONAL_AUTHORITY=NO/);
  assert.match(LOCK, /VENUE_ROLE_FALLBACK_MAY_GRANT_TRANSFER_PRESIDENT=NO/);
  assert.match(LOCK, /LEGACY_PROFILES_VENUE_ROLE_FALLBACK_REINTRODUCED=NO/);
  assert.match(LOCK, /RPC01_TARGET_MD5_UNCHANGED=YES/);
  assert.match(LOCK, /61dd0458b9240d5407394f6f8d492bf0/);
});
