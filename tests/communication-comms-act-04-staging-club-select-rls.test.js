/**
 * COMMS-ACT-04 — Staging Club SELECT apply certification (static tests only).
 * Does not connect to Supabase. Does not apply SQL. Does not deploy.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  ACTIVATION_GATES,
  loadCommsAct03SqlPackageManifest,
  verifyCommsAct03SqlPackage,
} from "../src/features/communication/index.js";
import {
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
} from "../src/features/communication/activation/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const act04Dir = path.join(
  root,
  "docs/communication-foundation/activation/comms-act-04"
);
const evidenceDir = path.join(act04Dir, "evidence");

const REQUIRED_EVIDENCE = [
  "GATE_A_SQL_READINESS_2026-07-25.md",
  "GATE_B_BACKUP_VERIFIED_2026-07-25.md",
  "GATE_C_LIVE_PREFLIGHT_2026-07-25.md",
  "GATE_D_POST_APPLY_2026-07-25.md",
  "FIXTURE_SEED_2026-07-25.md",
  "FIXTURE_CLEANUP_2026-07-25.md",
  "MANAGER_OWNER_PREDICATE_EQUIVALENCE_2026-07-25.md",
  "OWNER_APPLY_ACTION_2026-07-25.md",
  "FINAL_REMOTE_VERIFY_2026-07-25.md",
  "STAGING_CERTIFICATION_2026-07-25.md",
];

const EXPECTED_FORWARD_SHA =
  "4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7";
const EXPECTED_FORWARD_BYTES = 13173;
const EXPECTED_ROLLBACK_SHA =
  "63056ec8ce8140bf06671a1bbf3e375d728047630aeb8bd06a9aefe32a016de5";
const EXPECTED_ROLLBACK_BYTES = 8808;

test("COMMS-ACT-04 docs and evidence exist", () => {
  assert.ok(
    fs.existsSync(path.join(act04Dir, "04_STAGING_CLUB_SELECT_APPLY.md"))
  );
  for (const name of REQUIRED_EVIDENCE) {
    assert.ok(fs.existsSync(path.join(evidenceDir, name)), name);
  }
  assert.ok(
    fs.existsSync(
      path.join(act04Dir, "sql", "COMMS_ACT_04_CERT_FIXTURES_STAGING.sql")
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(
        act04Dir,
        "sql",
        "COMMS_ACT_04_CERT_FIXTURES_STAGING_CLEANUP.sql"
      )
    )
  );
});

test("COMMS-ACT-04 binds canonical ACT-03 SQL SHA256/bytes", () => {
  const manifest = loadCommsAct03SqlPackageManifest({ repoRoot: root });
  assert.equal(manifest.status, "PASS", JSON.stringify(manifest.findings));
  assert.equal(manifest.forwardSha256, EXPECTED_FORWARD_SHA);
  assert.equal(manifest.rollbackSha256, EXPECTED_ROLLBACK_SHA);

  const forwardBuf = fs.readFileSync(
    path.join(root, "docs/supabase-communication-comms-act-03-authorization-client-rls.sql")
  );
  const rollbackBuf = fs.readFileSync(
    path.join(
      root,
      "docs/supabase-communication-comms-act-03-authorization-client-rls-rollback.sql"
    )
  );
  assert.equal(forwardBuf.length, EXPECTED_FORWARD_BYTES);
  assert.equal(rollbackBuf.length, EXPECTED_ROLLBACK_BYTES);

  const verify = verifyCommsAct03SqlPackage({ repoRoot: root });
  assert.equal(verify.status, "PASS");
});

test("COMMS-ACT-04 activation gate reflects Staging Club SELECT certified", () => {
  assert.equal(
    ACTIVATION_GATES.CLIENT_RLS_POLICY,
    "CLUB_SELECT_ACTIVE_ON_STAGING"
  );
  assert.equal(ACTIVATION_GATES.REALTIME_PUBLICATION, "DEFERRED_NOT_ENABLED");
  assert.equal(COMMS_STAGING_PROJECT_REF, "qyewbxjsiiyufanzcjcq");
  assert.equal(COMMS_PRODUCTION_PROJECT_REF, "expuvcohlcjzvrrauvud");
});

test("COMMS-ACT-04 certification doc states capability matrix", () => {
  const cert = fs.readFileSync(
    path.join(evidenceDir, "STAGING_CERTIFICATION_2026-07-25.md"),
    "utf8"
  );
  assert.match(cert, /CLUB_SELECT_ONLY\s*=\s*ACTIVE_ON_STAGING/);
  assert.match(cert, /DIRECT\/SYSTEM\s*=\s*TRUSTED_BACKEND_ONLY/);
  assert.match(cert, /CLUB_WRITES_ADMIN\s*=\s*TRUSTED_BACKEND_ONLY/);
  assert.match(cert, /COMMUNITY\s*=\s*BLOCKED_FAIL_CLOSED/);
  assert.match(cert, /REALTIME\s*=\s*BLOCKED_FAIL_CLOSED/);
  assert.match(cert, /PRODUCTION\s*=\s*UNTOUCHED/);
  assert.match(cert, /COMMS_ACT_04_STAGING_CLUB_SELECT_CERTIFIED/);
});

test("COMMS-ACT-04 fixture SQL is marker-scoped and Communication-only", () => {
  const seed = fs.readFileSync(
    path.join(act04Dir, "sql", "COMMS_ACT_04_CERT_FIXTURES_STAGING.sql"),
    "utf8"
  );
  const cleanup = fs.readFileSync(
    path.join(act04Dir, "sql", "COMMS_ACT_04_CERT_FIXTURES_STAGING_CLEANUP.sql"),
    "utf8"
  );
  assert.match(seed, /COMMS_ACT_04_CERT_FIXTURE_/);
  assert.match(cleanup, /COMMS_ACT_04_CERT_FIXTURE_/);
  assert.doesNotMatch(seed, /insert into public\.club_members/i);
  assert.doesNotMatch(seed, /insert into auth\.users/i);
  assert.doesNotMatch(seed, /alter publication supabase_realtime/i);
  // Production ref may appear only as an explicit block / refuse target.
  assert.match(seed, /Production: expuvcohlcjzvrrauvud — BLOCKED/i);
  assert.match(seed, /fixture blocked: Production target detected/i);
  assert.doesNotMatch(cleanup, /insert into/i);
});

test("COMMS-ACT-04 preflight script refuses --apply", () => {
  const script = path.join(
    root,
    "scripts/communication/comms-act-04-staging-preflight.mjs"
  );
  const result = spawnSync(process.execPath, [script, "--apply"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(
    String(result.stderr || result.stdout || ""),
    /COMMS_ACT_04_BLOCKED_APPLY_REFUSED|refuses --apply/
  );
});

test("COMMS-ACT-04 forward SQL byte hash still matches Gate A binding", () => {
  const forward = path.join(
    root,
    "docs/supabase-communication-comms-act-03-authorization-client-rls.sql"
  );
  const buf = fs.readFileSync(forward);
  assert.equal(buf.length, EXPECTED_FORWARD_BYTES);
  const sha = createHash("sha256").update(buf).digest("hex");
  assert.equal(sha, EXPECTED_FORWARD_SHA);
});
