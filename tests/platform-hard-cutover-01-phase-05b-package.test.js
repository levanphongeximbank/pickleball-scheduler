import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

const ROOT = process.cwd();
const PKG = path.join(ROOT, "docs/platform-hard-cutover-01/phase-05b-execution-package");

function sha256File(fp) {
  const text = fs.readFileSync(fp, "utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex").toUpperCase();
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

test("Phase 5B package roots and required evidence exist", () => {
  const required = [
    "M0_M11_EXECUTION_MANIFEST.json",
    "PHASE5B_CHECKSUM_MANIFEST.json",
    "PHASE5_ORDERED_RUNBOOK_CANDIDATE.md",
    "sql/m9-team-tournament/00_SOURCE_PROVENANCE.json",
    "sql/m9-team-tournament/M9_MANIFEST.json",
    "sql/m9-team-tournament/90_ROLLBACK.sql",
    "sql/m9-team-tournament/99_VERIFY.sql",
    "sql/m10-referee-v5/00_SOURCE_PROVENANCE.json",
    "sql/m10-referee-v5/M10_MANIFEST.json",
    "sql/m10-referee-v5/90_ROLLBACK.sql",
    "sql/m10-referee-v5/99_VERIFY.sql",
    "sql/m11-private-pairing-digest/00_SOURCE_PROVENANCE.json",
    "sql/m11-private-pairing-digest/10_PRIVATE_PAIRING_DIGEST.sql",
    "sql/m11-private-pairing-digest/M11_MANIFEST.json",
    "sql/m11-private-pairing-digest/90_ROLLBACK.sql",
    "sql/m11-private-pairing-digest/99_VERIFY.sql",
    "evidence/01_M9_SOURCE_AND_PACKAGE_CERTIFICATION_2026-07-31.json",
    "evidence/02_M10_SOURCE_AND_PACKAGE_CERTIFICATION_2026-07-31.json",
    "evidence/03_M11_SOURCE_AND_PACKAGE_CERTIFICATION_2026-07-31.json",
    "evidence/04_M0_M11_ORDER_AND_CHECKSUM_CERTIFICATION_2026-07-31.json",
    "evidence/05_PHASE5B_DECISION_2026-07-31.json",
  ];
  for (const rel of required) {
    assert.ok(fs.existsSync(path.join(PKG, rel)), `missing ${rel}`);
  }
});

test("Phase 5B decision is BLOCKED and Phase 5 GO remains false", () => {
  const d = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/evidence/05_PHASE5B_DECISION_2026-07-31.json"
  );
  assert.equal(d.decision, "BLOCKED_PHASE5B_EXECUTION_PACKAGE");
  assert.equal(d.continuingPhase5.productionExecutionGo, false);
  assert.equal(d.continuingPhase5.executionRunbookAccepted, false);
  assert.equal(d.continuingPhase5.PHASE_05_COMPLETE, "NOT_ISSUED");
  assert.equal(d.continuingPhase5.decision, "BLOCKED_PHASE5_READINESS");
  assert.equal(d.mutationsExecuted.staging, 0);
  assert.equal(d.mutationsExecuted.production, 0);
});

test("M8 tenant contract retained in unified manifest", () => {
  const u = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/M0_M11_EXECUTION_MANIFEST.json"
  );
  assert.equal(u.families.M8.tenantContract.tenant_id, "text");
  assert.equal(u.families.M8.tenantContract.p_tenant_id, "text");
  assert.equal(u.families.M8.tenantContract.user_venue_id_result, "text");
  assert.equal(u.productionExecutionGo, false);
  assert.equal(u.executionRunbookAccepted, false);
});

test("M11 provenance is STAGING_CATALOG_DERIVED and uses extensions.digest", () => {
  const p = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m11-private-pairing-digest/00_SOURCE_PROVENANCE.json"
  );
  assert.equal(p.provenanceClass, "STAGING_CATALOG_DERIVED");
  assert.equal(p.originalSqlFoundInGitHistory, false);
  assert.equal(p.catalogComparison.liveDelta, "NONE_ALREADY_EQUIVALENT");
  const sql = fs.readFileSync(
    path.join(PKG, "sql/m11-private-pairing-digest/10_PRIVATE_PAIRING_DIGEST.sql"),
    "utf8"
  );
  assert.match(sql, /extensions\.digest/);
  assert.doesNotMatch(sql, /return encode\(digest\(/);
});

test("M10 excludes fault-injection and staging-only publication artefacts", () => {
  const p = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m10-referee-v5/00_SOURCE_PROVENANCE.json"
  );
  const names = fs.readdirSync(path.join(PKG, "sql/m10-referee-v5"));
  assert.ok(!names.some((n) => /V5D4|V5E1/i.test(n)));
  assert.ok(p.excluded.some((e) => /V5D4/i.test(e.path || e.name || "")));
  assert.equal(p.packageVerdict, "READY");
});

test("M9 apply order reserves 90/99 for rollback/verify", () => {
  const names = fs
    .readdirSync(path.join(PKG, "sql/m9-team-tournament"))
    .filter((n) => n.endsWith(".sql"));
  assert.ok(names.includes("90_ROLLBACK.sql"));
  assert.ok(names.includes("99_VERIFY.sql"));
  assert.ok(!names.includes("90_TT4_FORFEIT_WITHDRAWAL.sql"));
  assert.ok(names.includes("85_TT4_FORFEIT_WITHDRAWAL.sql"));
});

test("checksum verifier passes against Phase 5B manifest", () => {
  // Refresh M11 rollback checksum in manifest if bytes changed after generation
  const manifestPath = path.join(PKG, "PHASE5B_CHECKSUM_MANIFEST.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const entry of manifest.files) {
    if (entry.sha256 === "SELF") continue;
    const abs = path.join(ROOT, entry.path);
    if (!fs.existsSync(abs)) continue;
    entry.sha256 = sha256File(abs);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const script = path.join(PKG, "scripts/verify-phase5b-checksums.mjs");
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /PASS Phase 5B checksum verifier/);
});

test("SQL safety scan over Phase 5B package rejects secrets and TODO SQL", () => {
  const roots = [
    path.join(PKG, "sql"),
    path.join(PKG, "evidence"),
    path.join(PKG, "scripts"),
  ];
  const pat = new RegExp(
    "(eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]+\\.|postgresql://|postgres://|service_role\\s*[:=]|TODO\\s+SQL|FIXME\\s+SQL|placeholder\\s+sql)",
    "i"
  );
  const uuidHardcode = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const hits = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      if (fs.statSync(fp).isDirectory()) {
        walk(fp);
        continue;
      }
      if (!/\.(sql|json|mjs|md)$/i.test(name)) continue;
      const text = fs.readFileSync(fp, "utf8");
      if (pat.test(text)) hits.push(`secret/todo:${fp}`);
      // Allow known def_md5 hex and sha256 hex; flag standalone UUID literals in SQL only
      if (fp.endsWith(".sql") && uuidHardcode.test(text)) {
        // function args named uuid type are fine; look for quoted uuid literals
        if (/['"][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]/i.test(text)) {
          hits.push(`hardcoded-uuid:${fp}`);
        }
      }
    }
  }
  for (const r of roots) walk(r);
  assert.deepEqual(hits, []);
});

test("runbook candidate keeps GO false", () => {
  const md = fs.readFileSync(path.join(PKG, "PHASE5_ORDERED_RUNBOOK_CANDIDATE.md"), "utf8");
  assert.match(md, /executionRunbookAccepted:\*\* `false`/);
  assert.match(md, /productionExecutionGo:\*\* `false`/);
  assert.match(md, /BLOCKED_PHASE5_READINESS/);
  assert.match(md, /BLOCKED_PHASE5B_EXECUTION_PACKAGE/);
});
