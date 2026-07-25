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
  "SQL_BINDING_EOL_EQUIVALENCE_2026-07-25.md",
];

/** Historical Windows working-tree representation used for Owner SQL Editor apply. */
const WINDOWS_APPLY_RAW_FORWARD_SHA =
  "4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7";
const WINDOWS_APPLY_RAW_FORWARD_BYTES = 13173;
const WINDOWS_APPLY_RAW_ROLLBACK_SHA =
  "63056ec8ce8140bf06671a1bbf3e375d728047630aeb8bd06a9aefe32a016de5";
const WINDOWS_APPLY_RAW_ROLLBACK_BYTES = 8808;

/**
 * Repository-canonical LF binding (cross-platform CI).
 * Equivalent SQL text to Windows apply raw after CRLF→LF normalization.
 */
const REPOSITORY_CANONICAL_LF_FORWARD_SHA =
  "90b3ff7af7070b6709349cefd570d61f258449f3dc9d3908658b0df0acc65f26";
const REPOSITORY_CANONICAL_LF_FORWARD_BYTES = 12870;
const REPOSITORY_CANONICAL_LF_ROLLBACK_SHA =
  "3de26ec8301d5b53bca350a5dde8f69e82ae90cd230bb2f04962f2cd9737dcc9";
const REPOSITORY_CANONICAL_LF_ROLLBACK_BYTES = 8660;

/**
 * Canonicalize SQL file text for cross-platform binding.
 * CRLF → LF only; does not alter SQL tokens.
 * @param {string} text
 */
function canonicalizeSqlText(text) {
  return String(text || "").replace(/\r\n/g, "\n");
}

/**
 * @param {string} text
 */
function bindingOf(text) {
  const canonical = canonicalizeSqlText(text);
  const bytes = Buffer.byteLength(canonical, "utf8");
  const sha256 = createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");
  return { canonical, bytes, sha256 };
}

/**
 * @param {string} relativePath
 */
function loadSqlBinding(relativePath) {
  const abs = path.join(root, relativePath);
  const rawBuf = fs.readFileSync(abs);
  const rawText = rawBuf.toString("utf8");
  const loneCR = (rawText.match(/(?<!\r)\r(?!\n)/g) || []).length;
  return {
    abs,
    rawBytes: rawBuf.length,
    rawSha256: createHash("sha256").update(rawBuf).digest("hex"),
    loneCR,
    ...bindingOf(rawText),
  };
}

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

  const forward = loadSqlBinding(
    "docs/supabase-communication-comms-act-03-authorization-client-rls.sql"
  );
  const rollback = loadSqlBinding(
    "docs/supabase-communication-comms-act-03-authorization-client-rls-rollback.sql"
  );

  assert.equal(forward.loneCR, 0);
  assert.equal(rollback.loneCR, 0);
  assert.equal(forward.bytes, REPOSITORY_CANONICAL_LF_FORWARD_BYTES);
  assert.equal(forward.sha256, REPOSITORY_CANONICAL_LF_FORWARD_SHA);
  assert.equal(rollback.bytes, REPOSITORY_CANONICAL_LF_ROLLBACK_BYTES);
  assert.equal(rollback.sha256, REPOSITORY_CANONICAL_LF_ROLLBACK_SHA);

  const verify = verifyCommsAct03SqlPackage({ repoRoot: root });
  assert.equal(verify.status, "PASS");
});

test("COMMS-ACT-04 LF and CRLF SQL texts share one canonical binding", () => {
  const forward = loadSqlBinding(
    "docs/supabase-communication-comms-act-03-authorization-client-rls.sql"
  );
  const rollback = loadSqlBinding(
    "docs/supabase-communication-comms-act-03-authorization-client-rls-rollback.sql"
  );

  for (const sample of [forward, rollback]) {
    const fromLf = bindingOf(sample.canonical);
    const fromCrlf = bindingOf(sample.canonical.replace(/\n/g, "\r\n"));
    assert.equal(fromLf.sha256, fromCrlf.sha256);
    assert.equal(fromLf.bytes, fromCrlf.bytes);
    assert.equal(fromLf.canonical, fromCrlf.canonical);
    assert.notEqual(
      createHash("sha256").update(sample.canonical.replace(/\n/g, "\r\n"), "utf8").digest("hex"),
      fromLf.sha256,
      "raw CRLF bytes must differ from canonical LF hash"
    );
  }

  assert.equal(forward.sha256, REPOSITORY_CANONICAL_LF_FORWARD_SHA);
  assert.equal(rollback.sha256, REPOSITORY_CANONICAL_LF_ROLLBACK_SHA);
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
  assert.match(cert, /WINDOWS_APPLY_RAW_SHA256\s*=\s*4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7/);
  assert.match(cert, /WINDOWS_APPLY_RAW_BYTES\s*=\s*13173/);
  assert.match(cert, /REPOSITORY_CANONICAL_LF_SHA256\s*=\s*90b3ff7af7070b6709349cefd570d61f258449f3dc9d3908658b0df0acc65f26/);
  assert.match(cert, /REPOSITORY_CANONICAL_LF_BYTES\s*=\s*12870/);
  assert.match(cert, /EOL_EQUIVALENCE_VERIFIED\s*=\s*PASS/);
  assert.match(cert, /SQL_SEMANTIC_DRIFT\s*=\s*NO/);
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

test("COMMS-ACT-04 forward SQL canonical LF binding matches repository binding", () => {
  const forward = loadSqlBinding(
    "docs/supabase-communication-comms-act-03-authorization-client-rls.sql"
  );
  assert.equal(forward.bytes, REPOSITORY_CANONICAL_LF_FORWARD_BYTES);
  assert.equal(forward.sha256, REPOSITORY_CANONICAL_LF_FORWARD_SHA);

  // Historical Windows apply representation remains documented (may match working tree on Windows).
  assert.equal(WINDOWS_APPLY_RAW_FORWARD_BYTES, 13173);
  assert.equal(
    WINDOWS_APPLY_RAW_FORWARD_SHA,
    "4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7"
  );
  assert.equal(WINDOWS_APPLY_RAW_ROLLBACK_BYTES, 8808);
  assert.equal(
    WINDOWS_APPLY_RAW_ROLLBACK_SHA,
    "63056ec8ce8140bf06671a1bbf3e375d728047630aeb8bd06a9aefe32a016de5"
  );

  // If working tree is CRLF (Windows autocrlf), raw equals historical apply; if LF, raw equals canonical.
  const rawIsWindowsApply =
    forward.rawBytes === WINDOWS_APPLY_RAW_FORWARD_BYTES &&
    forward.rawSha256 === WINDOWS_APPLY_RAW_FORWARD_SHA;
  const rawIsCanonicalLf =
    forward.rawBytes === REPOSITORY_CANONICAL_LF_FORWARD_BYTES &&
    forward.rawSha256 === REPOSITORY_CANONICAL_LF_FORWARD_SHA;
  assert.ok(
    rawIsWindowsApply || rawIsCanonicalLf,
    `unexpected raw binding bytes=${forward.rawBytes} sha=${forward.rawSha256}`
  );
});
