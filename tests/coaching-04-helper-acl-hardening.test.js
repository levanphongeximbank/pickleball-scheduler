/**
 * COACHING-04 — Helper EXECUTE ACL hardening patch tests.
 * Authoring only. No Staging apply. No file deletion.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Act from "../scripts/coaching/coaching-04-activation-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

const PATCH = Act.COACHING_04_HELPER_ACL_PATCH_RELATIVE_PATH;
const VERIFY = Act.COACHING_04_HELPER_ACL_PATCH_VERIFY_RELATIVE_PATH;
const MANIFEST = Act.COACHING_04_HELPER_ACL_PATCH_MANIFEST_RELATIVE_PATH;

test("helper ACL patch artifacts exist", () => {
  for (const rel of [PATCH, VERIFY, MANIFEST, "docs/coaching-training/coaching-04/activation/06_COACHING_04_HELPER_ACL_CALL_SITE_AUDIT.md"]) {
    assert.equal(existsSync(path.join(root, rel)), true, `missing ${rel}`);
  }
});

test("exact 12 helper signatures covered; no broad wildcard revoke", () => {
  const sql = read(PATCH);
  assert.equal(Act.COACHING_04_HELPER_ACL_PATCH_SIGNATURES.length, 12);
  for (const sig of Act.COACHING_04_HELPER_ACL_PATCH_SIGNATURES) {
    const bare = sig.replace(/^public\./, "");
    assert.match(sql, new RegExp(bare.replace(/[()]/g, "\\$&").replace(/text, text/g, "text, text")), `missing ${sig}`);
    assert.match(
      sql,
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${bare.replace(/[()]/g, "\\$&").replace(/,/g, ",?\\s*")} FROM anon;`,
        "i"
      ),
      `anon revoke missing for ${sig}`
    );
    assert.match(
      sql,
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${bare.replace(/[()]/g, "\\$&").replace(/,/g, ",?\\s*")} FROM service_role;`,
        "i"
      ),
      `service_role revoke missing for ${sig}`
    );
    assert.match(
      sql,
      new RegExp(
        `GRANT EXECUTE ON FUNCTION public\\.${bare.replace(/[()]/g, "\\$&").replace(/,/g, ",?\\s*")} TO authenticated;`,
        "i"
      ),
      `authenticated grant missing for ${sig}`
    );
  }
  assert.equal(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.coaching_04_%/i.test(sql), false);
  assert.equal(/REVOKE\s+ALL\s+ON\s+ALL\s+FUNCTIONS/i.test(sql), false);
  assert.equal(/CREATE OR REPLACE FUNCTION/i.test(sql), false);
  assert.equal(/CREATE\s+POLICY/i.test(sql), false);
  assert.equal(/DROP\s+POLICY/i.test(sql), false);
  assert.equal(/ALTER\s+POLICY/i.test(sql), false);
});

test("authenticated required permissions preserved; patch additive and deterministic", () => {
  const sql = read(PATCH);
  const grantCount = (sql.match(/GRANT EXECUTE ON FUNCTION public\.coaching_04_/gi) || []).length;
  assert.equal(grantCount, 12);
  const anonRevokes = (sql.match(/FROM anon;/gi) || []).length;
  const serviceRevokes = (sql.match(/FROM service_role;/gi) || []).length;
  const publicRevokes = (sql.match(/FROM PUBLIC;/gi) || []).length;
  assert.equal(anonRevokes, 12);
  assert.equal(serviceRevokes, 12);
  assert.equal(publicRevokes, 12);

  const actual = Act.sha256File(path.join(root, PATCH));
  assert.equal(actual, Act.COACHING_04_HELPER_ACL_PATCH_SHA256);
  const verifyHash = Act.sha256File(path.join(root, VERIFY));
  assert.equal(verifyHash, Act.COACHING_04_HELPER_ACL_PATCH_VERIFY_SHA256);

  const manifest = JSON.parse(read(MANIFEST));
  assert.equal(manifest.patchOrder, 41);
  assert.equal(manifest.patchSha256, Act.COACHING_04_HELPER_ACL_PATCH_SHA256);
  assert.equal(manifest.patchApplied, false);
  assert.equal(manifest.executeSql, false);
  assert.equal(manifest.productionApplyApproved, false);
  assert.equal(manifest.ownerGoTokenRequired, Act.COACHING_04_HELPER_ACL_PATCH_OWNER_GO_TOKEN);
  assert.equal(manifest.serviceRoleDependencyAudit.intentionalServiceRoleCallerFound, false);
  assert.deepEqual(manifest.exactHelperSignatures, [...Act.COACHING_04_HELPER_ACL_PATCH_SIGNATURES]);
});

test("old forward SQL 10→40 not rerun; mutation RPC ACL not targeted", () => {
  const sql = read(PATCH);
  for (const name of Act.COACHING_04_MUTATION_RPC_NAMES) {
    assert.equal(
      new RegExp(`FUNCTION\\s+public\\.${name}\\b`, "i").test(sql),
      false,
      `patch must not touch ${name}`
    );
  }
  assert.equal(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i.test(sql), false);
  assert.equal(/^\s*CREATE\s+POLICY/im.test(sql), false);

  const main = Act.verifyCoaching04MigrationManifest({ repoRoot: root });
  assert.equal(main.ok, true, (main.errors || []).join(" | "));
  assert.equal(
    main.aggregateSha256Forward,
    Act.COACHING_04_PINNED_AGGREGATE_SHA256_FORWARD
  );
  assert.equal(
    main.combinedManifestHash,
    Act.COACHING_04_PINNED_COMBINED_MANIFEST_HASH
  );
  const forward = Act.loadCoaching04MigrationManifest(root).migrations.filter(
    (m) => m.classification === "forward"
  );
  assert.equal(forward.length, 6);
  assert.equal(
    forward.some((f) => String(f.path).includes("41_COACHING_04")),
    false
  );
});

test("verification asserts anon/service_role zero and authenticated preserved", () => {
  const v = read(VERIFY);
  assert.match(v, /anon_execute_count/i);
  assert.match(v, /service_role_execute_count/i);
  assert.match(v, /authenticated_execute_count/i);
  assert.match(v, /coaching_04_record_assigned_attendance/);
  assert.match(v, /policyname LIKE 'coaching_04_%'/);
  assert.equal(/INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|DROP\s+FUNCTION/i.test(v), false);
});

test("Production refused; no automatic retry/rollback; no tracked deletions", () => {
  const manifest = JSON.parse(read(MANIFEST));
  assert.equal(manifest.productionApplyApproved, false);
  assert.ok(manifest.productionProjectRefBlocklist.includes("expuvcohlcjzvrrauvud"));
  assert.equal(manifest.automaticRollback, false);
  assert.equal(manifest.automaticRetry, false);
  assert.equal(manifest.stagingProjectRef, Act.COACHING_04_STAGING_PROJECT_REF);

  const audit = read(
    "docs/coaching-training/coaching-04/activation/06_COACHING_04_HELPER_ACL_CALL_SITE_AUDIT.md"
  );
  assert.match(audit, /No legitimate dependency/i);
  assert.match(audit, /REVOKE `service_role`/i);
  assert.match(audit, /CODEX_DELETE_ALLOWED/);
  assert.match(audit, /NOT_GRANTED|not granted/i);

  assert.equal(Act.COACHING_04_HELPER_ACL_PATCH_ORDER, 41);
  assert.equal(
    Act.COACHING_04_HELPER_ACL_PATCH_OWNER_GO_TOKEN,
    "COACHING_04_HELPER_ACL_PATCH_OWNER_GO"
  );
});
