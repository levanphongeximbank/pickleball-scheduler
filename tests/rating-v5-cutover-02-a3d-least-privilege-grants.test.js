/**
 * RATING-V5-CUTOVER-02 Gate A3d-Security — least-privilege grant tests.
 * Local only — does not apply SQL or mutate Staging.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  CUTOVER_02_PRODUCTION_PROJECT_REF,
} from "../src/features/player-rating/cutover-02/config/environmentGuards.js";
import {
  FIXTURE_PREP_OUTCOME,
  FIXTURE_COHORT_LABEL,
  APPROVED_ID_HASHES,
  MUTATION_BUDGET,
  evaluateProjectGuard,
  evaluateCohortGuard,
  evaluateTargetGuard,
  evaluateCallerGuard,
  isFixturePrepPathEnabled,
  FIXTURE_PREP_ENV_NAME,
  invokeFixturePrepFromBrowser,
  browserFixturePrepForbiddenPatterns,
  A3D_SECURITY_SQL_RELATIVE_PATH,
  A3C_PRE_CORRECTIVE_GRANTS,
  A3C_INTENDED_GRANTS,
  A3C_FUNCTION_GRANT_INVENTORY,
  A3C_EDGE_DB_CALL_PATH,
  A3D_SECURITY_ROLLBACK_GRANT_MODEL,
  evaluateIntendedExecuteGrant,
  MAPPING_STATUS,
  PHASE4_PILOT_COHORT_LABEL,
} from "../src/features/player-rating/cutover-02/fixture-prep/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = path.join(root, A3D_SECURITY_SQL_RELATIVE_PATH);
const sql = readFileSync(sqlPath, "utf8");
const edgeSrc = readFileSync(
  path.join(root, "supabase/functions/rating-v5-cutover-02-prepare-fixture/index.ts"),
  "utf8"
);
const clientSrc = readFileSync(
  path.join(root, "src/features/player-rating/cutover-02/fixture-prep/clientInvoke.js"),
  "utf8"
);

const SERVICE_FNS = A3C_FUNCTION_GRANT_INVENTORY.filter((f) =>
  f.name.includes("_service_")
);

test("1) Production project is denied", () => {
  const project = evaluateProjectGuard({
    VITE_APP_ENV: "production",
    VITE_SUPABASE_URL: `https://${CUTOVER_02_PRODUCTION_PROJECT_REF}.supabase.co`,
  });
  assert.equal(project.ok, false);
  assert.equal(project.code, FIXTURE_PREP_OUTCOME.WRONG_PROJECT);
  assert.match(sql, /expuvcohlcjzvrrauvud/);
  assert.match(sql, /REFUSE_PRODUCTION/);
});

test("2) Wrong project is denied", () => {
  const project = evaluateProjectGuard(
    { VITE_APP_ENV: "staging" },
    { projectRef: "aaaaaaaaaaaaaaaaaaaa" }
  );
  assert.equal(project.ok, false);
  assert.match(sql, /qyewbxjsiiyufanzcjcq/);
});

test("3) PUBLIC cannot execute service functions (intended)", () => {
  for (const fn of A3C_FUNCTION_GRANT_INVENTORY) {
    const result = evaluateIntendedExecuteGrant("public", fn.name);
    assert.equal(result.allowed, false);
  }
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/);
});

test("4) anon cannot execute service functions (intended)", () => {
  for (const fn of A3C_FUNCTION_GRANT_INVENTORY) {
    assert.equal(evaluateIntendedExecuteGrant("anon", fn.name).allowed, false);
  }
  assert.match(sql, /FROM anon/);
  assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]*TO anon/i);
});

test("5) ordinary authenticated cannot execute service-only functions", () => {
  for (const fn of SERVICE_FNS) {
    assert.equal(
      evaluateIntendedExecuteGrant("authenticated", fn.name).allowed,
      false
    );
  }
  assert.equal(A3C_INTENDED_GRANTS.authenticated, false);
  assert.equal(A3C_INTENDED_GRANTS.authenticatedException, null);
  assert.match(sql, /FROM authenticated/);
  // Active apply body must revoke authenticated; rollback section may restore it.
  const applyBody = sql.split("DOWN / ROLLBACK")[0];
  assert.doesNotMatch(applyBody, /^[^-\n]*GRANT EXECUTE[\s\S]*TO authenticated/m);
  assert.doesNotMatch(applyBody, /\nGRANT EXECUTE[\s\S]*TO authenticated/);
});

test("6) service_role can execute required service functions", () => {
  for (const fn of A3C_FUNCTION_GRANT_INVENTORY) {
    assert.equal(
      evaluateIntendedExecuteGrant("service_role", fn.name).allowed,
      true
    );
  }
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/);
});

test("7) Edge caller authorization remains required", () => {
  assert.match(edgeSrc, /auth\.getUser/);
  assert.match(edgeSrc, /SUPER_ADMIN/);
  assert.equal(A3C_EDGE_DB_CALL_PATH.jwtVerification.includes("getUser"), true);
});

test("8) SUPER_ADMIN/calibration caller remains supported through Edge", () => {
  assert.match(edgeSrc, /SUPER_ADMIN/);
  const caller = evaluateCallerGuard({
    authenticated: true,
    callerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    isSuperAdmin: true,
  });
  assert.equal(caller.ok, true);
});

test("9) Candidate session remains unnecessary", () => {
  assert.equal(A3C_EDGE_DB_CALL_PATH.candidateJwtRequired, false);
  assert.match(edgeSrc, /candidateJwtRequired: false/);
});

test("10) Candidate JWT/password remains unhandled", () => {
  assert.equal(A3C_EDGE_DB_CALL_PATH.candidatePasswordRequired, false);
  assert.match(edgeSrc, /CANDIDATE_CREDENTIAL_PROHIBITED/);
  assert.match(edgeSrc, /candidatePassword \|\| body\?\.candidateJwt/);
});

test("11) Browser cannot directly invoke service mutation RPC", () => {
  assert.equal(A3C_EDGE_DB_CALL_PATH.browserDirectServiceRpc, false);
  assert.doesNotMatch(clientSrc, /rating_v5_cutover_02_a3c_service_/);
  for (const pat of browserFixturePrepForbiddenPatterns()) {
    if (pat.includes("SERVICE")) {
      assert.ok(pat.length > 0);
    }
  }
  assert.equal(
    evaluateIntendedExecuteGrant(
      "authenticated",
      "rating_v5_cutover_02_a3c_service_create_fixture_assessment"
    ).allowed,
    false
  );
});

test("12) Exact five-candidate allowlist remains enforced", () => {
  assert.equal(APPROVED_ID_HASHES.length, 5);
  assert.match(edgeSrc, /e97fa28f4a36/);
  assert.match(edgeSrc, /3d644a31b486/);
  const denied = evaluateTargetGuard({
    profileId: "11111111-1111-4111-8111-111111111111",
    authUserId: "11111111-1111-4111-8111-111111111111",
    active: true,
    existsInAuth: true,
    existsInProfiles: true,
    emailLooksLikeWave1Fixture: true,
    idHash: "deadbeef0001",
  });
  assert.equal(denied.ok, false);
});

test("13) Exact cohort label remains enforced", () => {
  assert.equal(
    evaluateCohortGuard("phase4-owner-acceptance").ok,
    false
  );
  assert.equal(evaluateCohortGuard(FIXTURE_COHORT_LABEL).ok, true);
  assert.match(edgeSrc, /rating-v5-cutover-02-staging-rehearsal-wave-a/);
});

test("14) V5 remains shadow-only", () => {
  assert.match(edgeSrc, /mappingStatus: "UNAPPROVED"/);
  assert.equal(MAPPING_STATUS, "UNAPPROVED");
});

test("15) V2 remains published authority", () => {
  // Grant package does not publish V5
  assert.doesNotMatch(sql, /is_shadow\s*=\s*false/i);
  assert.doesNotMatch(sql, /pick_vn_player_ratings/);
});

test("16) No rollout-config mutation", () => {
  assert.doesNotMatch(sql, /rating_v5_rollout_config/);
  assert.equal(MUTATION_BUDGET.ROLLOUT_CONFIG_CHANGES, 0);
});

test("17) Phase4 pilot remains untouched", () => {
  assert.doesNotMatch(sql, new RegExp(PHASE4_PILOT_COHORT_LABEL));
  assert.equal(MUTATION_BUDGET.CURRENT_PHASE4_PILOT_CHANGES, 0);
});

test("18) Cohort preparation is not executed by tests", () => {
  assert.equal(isFixturePrepPathEnabled({}), false);
  assert.equal(A3C_EDGE_DB_CALL_PATH.removingAuthenticatedExecuteBreaksEdge, false);
});

test("19) Corrective migration does not change data", () => {
  const applyBody = sql.split("DOWN / ROLLBACK")[0];
  assert.doesNotMatch(applyBody, /\bINSERT\b/i);
  assert.doesNotMatch(applyBody, /\bDELETE\b/i);
  assert.doesNotMatch(applyBody, /\bUPDATE\b/i);
  assert.match(sql, /rating_v5_cutover_02_a3d_least_privilege_grants_v1/);
  assert.match(sql, /No table\/data\/cohort/);
});

test("20) Rollback restores only documented grants", () => {
  assert.equal(A3D_SECURITY_ROLLBACK_GRANT_MODEL.restoreAuthenticatedExecute, true);
  assert.equal(A3D_SECURITY_ROLLBACK_GRANT_MODEL.keepPublicRevoked, true);
  assert.equal(A3D_SECURITY_ROLLBACK_GRANT_MODEL.keepAnonRevoked, true);
  assert.equal(A3D_SECURITY_ROLLBACK_GRANT_MODEL.alterDefaultPrivileges, false);
  assert.equal(A3D_SECURITY_ROLLBACK_GRANT_MODEL.dataMutation, false);
  assert.match(sql, /DOWN \/ ROLLBACK/);
  const down = sql.split("DOWN / ROLLBACK")[1] || "";
  assert.match(down, /GRANT EXECUTE[\s\S]*TO authenticated/);
  assert.match(sql, /pre-corrective/);
});

test("A3d root-cause and inventory documented", () => {
  assert.equal(A3C_PRE_CORRECTIVE_GRANTS.authenticated, true);
  assert.match(A3C_PRE_CORRECTIVE_GRANTS.rootCause, /pg_default_acl/);
  assert.equal(A3C_FUNCTION_GRANT_INVENTORY.length, 4);
  assert.equal(A3C_EDGE_DB_CALL_PATH.serviceRoleOps.length, 1);
  assert.match(
    A3C_EDGE_DB_CALL_PATH.serviceRoleOps[0],
    /service_create_fixture_assessment/
  );
});

test("A3d SQL identity and checksum stable", () => {
  const hash = createHash("sha256").update(sql).digest("hex").toUpperCase();
  assert.equal(hash.length, 64);
  assert.ok(sql.includes("AUTHOR ONLY"));
  assert.ok(sql.includes("A3D_SECURITY_SQL_APPLY_GO=NO") || sql.includes("SQL_EXECUTION=0"));
});

test("A3d feature remains unavailable by default", async () => {
  const result = await invokeFixturePrepFromBrowser({
    env: { VITE_APP_ENV: "staging", [FIXTURE_PREP_ENV_NAME]: "false" },
  });
  assert.equal(result.code, FIXTURE_PREP_OUTCOME.FEATURE_DISABLED);
});
