import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

const ROOT = process.cwd();
const PKG = path.join(ROOT, "docs/platform-hard-cutover-01/phase-05b-execution-package");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function gitExactSha(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  for (const spec of [`:${norm}`, `HEAD:${norm}`]) {
    const oidR = spawnSync("git", ["rev-parse", "--verify", "--quiet", spec], {
      cwd: ROOT,
      encoding: "utf8",
    });
    if (oidR.status !== 0) continue;
    const oid = oidR.stdout.trim();
    const blob = spawnSync("git", ["cat-file", "blob", oid], { cwd: ROOT, encoding: "buffer" });
    if (blob.status === 0) {
      return crypto.createHash("sha256").update(blob.stdout).digest("hex").toUpperCase();
    }
  }
  return null;
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
  assert.equal(d.correction, "PHASE5B_V2_INTEGRITY");
  assert.equal(d.continuingPhase5.productionExecutionGo, false);
  assert.equal(d.continuingPhase5.executionRunbookAccepted, false);
  assert.equal(d.continuingPhase5.PHASE_05_COMPLETE, "NOT_ISSUED");
  assert.ok(Array.isArray(d.mandatoryBlockers) && d.mandatoryBlockers.length >= 5);
});

test("checksums use authoritative sha256ExactGitBlobBytes and agree across manifests", () => {
  const cm = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5B_CHECKSUM_MANIFEST.json"
  );
  assert.equal(cm.checksumFieldAuthoritative, "sha256ExactGitBlobBytes");
  const m9 = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/M9_MANIFEST.json"
  );
  const entry = cm.files.find((f) => f.path.endsWith("/10_TT2B_LINEUP_DEADLINE.sql"));
  assert.ok(entry?.sha256ExactGitBlobBytes);
  assert.ok(entry?.sha256CanonicalLf);
  const m9Apply = m9.orderedApply.find((a) => a.file === "10_TT2B_LINEUP_DEADLINE.sql");
  assert.equal(m9Apply.sha256ExactGitBlobBytes, entry.sha256ExactGitBlobBytes);
  const blobSha = gitExactSha(entry.path);
  assert.equal(blobSha, entry.sha256ExactGitBlobBytes);
});

test("TT5D files are non-executable candidates and not in orderedApply", () => {
  const m9 = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/M9_MANIFEST.json"
  );
  assert.equal(m9.executableApplyCount, 20);
  assert.equal(m9.nonExecutableCandidateCount, 4);
  for (const f of [
    "190_TT5D_ASSIGNMENT_SAFETY.sql",
    "200_TT5D_REOPEN_RESULT.sql",
    "210_TT5D_CORRECTION.sql",
    "220_TT5D_SECURITY_GUARDS.sql",
  ]) {
    assert.ok(!m9.orderedApply.some((a) => a.file === f));
    const c = m9.nonExecutionCandidates.find((a) => a.file === f);
    assert.equal(c.executionEligible, false);
    assert.equal(c.classification, "NON_EXECUTABLE_CANDIDATE_PENDING_STAGING_CERTIFICATION");
  }
});

test("M11 is VERIFY_ONLY_ALREADY_EQUIVALENT with no executable apply", () => {
  const u = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/M0_M11_EXECUTION_MANIFEST.json"
  );
  assert.equal(u.families.M11.productionRunbookAction, "VERIFY_ONLY_ALREADY_EQUIVALENT");
  assert.deepEqual(u.families.M11.exactOrderedApplyFiles, []);
  const step = u.executionSequence.find((s) => s.step === "M11");
  assert.equal(step.action, "VERIFY_ONLY_ALREADY_EQUIVALENT");
  assert.deepEqual(step.orderedApply, []);
});

test("unified M0-M11 manifest has exact paths and sha256ExactGitBlobBytes (no globs)", () => {
  const u = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/M0_M11_EXECUTION_MANIFEST.json"
  );
  const bad = /(\.\.|\*|\bpackages\b|10\.\.50)/i;
  for (const [fam, rec] of Object.entries(u.families)) {
    assert.ok(Array.isArray(rec.exactOrderedApplyFiles), `${fam} apply must be array`);
    for (const item of rec.exactOrderedApplyFiles) {
      assert.equal(typeof item, "object");
      assert.ok(item.path && !bad.test(item.path) && !item.path.endsWith("/"));
      assert.ok(item.sha256ExactGitBlobBytes);
    }
  }
  assert.equal(u.families.M8.tenantContract.tenant_id, "text");
  assert.equal(u.families.M1.exactOrderedApplyFiles.length, 5);
  assert.equal(u.families.M9.exactOrderedApplyFiles.length, 20);
});

test("M8 tenant contract retained; GO false", () => {
  const u = readJson(
    "docs/platform-hard-cutover-01/phase-05b-execution-package/M0_M11_EXECUTION_MANIFEST.json"
  );
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
  assert.equal(p.productionRunbookAction, "VERIFY_ONLY_ALREADY_EQUIVALENT");
  const sql = fs.readFileSync(
    path.join(PKG, "sql/m11-private-pairing-digest/10_PRIVATE_PAIRING_DIGEST.sql"),
    "utf8"
  );
  assert.match(sql, /extensions\.digest/);
});

test("checksum verifier V2 passes", () => {
  const script = path.join(PKG, "scripts/verify-phase5b-checksums.mjs");
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /PASS Phase 5B checksum verifier V2/);
});

test("SQL safety scan over Phase 5B package rejects secrets and TODO SQL", () => {
  const roots = [path.join(PKG, "sql"), path.join(PKG, "evidence"), path.join(PKG, "scripts")];
  const pat = new RegExp(
    "(eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]+\\.|postgresql://|postgres://|service_role\\s*[:=]|TODO\\s+SQL|FIXME\\s+SQL|placeholder\\s+sql)",
    "i"
  );
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
      if (
        fp.endsWith(".sql") &&
        /['"][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]/i.test(text)
      ) {
        hits.push(`hardcoded-uuid:${fp}`);
      }
    }
  }
  for (const r of roots) walk(r);
  assert.deepEqual(hits, []);
});

test("runbook candidate keeps GO false and M11 verify-only", () => {
  const md = fs.readFileSync(path.join(PKG, "PHASE5_ORDERED_RUNBOOK_CANDIDATE.md"), "utf8");
  assert.match(md, /executionRunbookAccepted:\*\* `false`/);
  assert.match(md, /productionExecutionGo:\*\* `false`/);
  assert.match(md, /VERIFY_ONLY_ALREADY_EQUIVALENT|verify-only/i);
  assert.match(md, /BLOCKED_PHASE5B_EXECUTION_PACKAGE/);
});
