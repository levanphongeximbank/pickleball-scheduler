#!/usr/bin/env node
/**
 * Local verification for Phase 5D B-R01–B-R10 closure package.
 * No database / network / deployment access.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

const ROOT = process.cwd();
const PKG = "docs/platform-hard-cutover-01/phase-05d-staging-rebuild-readiness-02";

function sha256File(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  return { sha256: crypto.createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
}

function mustExist(rel) {
  if (!fs.existsSync(path.join(ROOT, rel))) throw new Error("missing " + rel);
}

const required = [
  `${PKG}/01_SOURCE_PROVENANCE.md`,
  `${PKG}/02_PROPOSED_EXECUTABLE_BLANK_DB_LEDGER.json`,
  `${PKG}/03_M9_AUTHORITY_RESOLUTION.json`,
  `${PKG}/04_M10_AUTHORITY_RESOLUTION.json`,
  `${PKG}/05_M11_AUTHORITY_RESOLUTION.json`,
  `${PKG}/06_CLOSED_EXPECTED_OBJECT_INVENTORY.json`,
  `${PKG}/07_BOOTSTRAP_SEED_LEDGER.json`,
  `${PKG}/08_HARD_CUTOVER_ACCEPTANCE_CONFIGURATION.json`,
  `${PKG}/09_EDGE_FUNCTION_DEPLOYMENT_AUTH_CONTRACT.json`,
  `${PKG}/10_USER_AVATARS_STORAGE_CONTRACT.json`,
  `${PKG}/11_TENANT_TYPE_STATIC_GATE_RESULTS.json`,
  `${PKG}/12_COACHING_04_AUTHORITY_DECISION.json`,
  `${PKG}/sql/10_PRIVATE_PAIRING_PR4_DIGEST_PATCH.sql`,
  `docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.sql`,
];

const errors = [];
for (const r of required) {
  try {
    mustExist(r);
    JSON.parse; // noop keep
    if (r.endsWith(".json")) JSON.parse(fs.readFileSync(path.join(ROOT, r), "utf8"));
  } catch (e) {
    errors.push(`${r}: ${e.message}`);
  }
}

const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, `${PKG}/02_PROPOSED_EXECUTABLE_BLANK_DB_LEDGER.json`), "utf8"));
const idSet = new Set(ledger.orderedEntries.map((e) => e.migrationId));
let unresolved = 0;
let forward = 0;
let self = 0;
const order = new Map(ledger.orderedEntries.map((e, i) => [e.migrationId, i]));
for (const e of ledger.orderedEntries) {
  const h = sha256File(e.path);
  if (h.sha256 !== e.sha256 || h.bytes !== e.bytes) errors.push(`hash mismatch ${e.migrationId}`);
  for (const d of e.dependencies) {
    if (d === e.migrationId) self++;
    if (!idSet.has(d)) unresolved++;
    else if (order.get(d) >= order.get(e.migrationId)) forward++;
  }
}
const paths = ledger.orderedEntries.map((e) => e.path);
const dupPaths = paths.filter((p, i) => paths.indexOf(p) !== i);

const tenant = JSON.parse(
  fs.readFileSync(path.join(ROOT, `${PKG}/11_TENANT_TYPE_STATIC_GATE_RESULTS.json`), "utf8")
);
if (!tenant.pass) errors.push("tenant static gate FAIL");

const m9 = JSON.parse(fs.readFileSync(path.join(ROOT, `${PKG}/03_M9_AUTHORITY_RESOLUTION.json`), "utf8"));
const m10 = JSON.parse(fs.readFileSync(path.join(ROOT, `${PKG}/04_M10_AUTHORITY_RESOLUTION.json`), "utf8"));
const m11 = JSON.parse(fs.readFileSync(path.join(ROOT, `${PKG}/05_M11_AUTHORITY_RESOLUTION.json`), "utf8"));
if (!m9.objectLevelStaticParity?.parityPass) errors.push("M9 parity FAIL");
if (!m10.objectLevelStaticParity?.parityPass) errors.push("M10 parity FAIL");
if (!m11.verification?.usesExtensionsDigest) errors.push("M11 digest FAIL");

const coaching = JSON.parse(
  fs.readFileSync(path.join(ROOT, `${PKG}/12_COACHING_04_AUTHORITY_DECISION.json`), "utf8")
);
if (coaching.decision !== "PROMOTE_TO_CANONICAL") errors.push("coaching decision unexpected");

const secretHits = [];
for (const e of ledger.orderedEntries) {
  const t = fs.readFileSync(path.join(ROOT, e.path), "utf8");
  if (/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/.test(t)) secretHits.push(e.path);
  if (/service_role\s*=\s*['\"][a-zA-Z0-9]/i.test(t)) secretHits.push(e.path);
}
if (secretHits.length) errors.push("possible secrets in " + secretHits.join(","));

if (unresolved || forward || self || dupPaths.length) {
  errors.push(JSON.stringify({ unresolved, forward, self, dupPaths }));
}

const report = {
  marker: "PHASE5D_LOCAL_VERIFICATION_REPORT_V1",
  pass: errors.length === 0,
  errors,
  ledgerEntryCount: ledger.entryCount,
  dependencyValidation: {
    unresolved,
    forward,
    self,
    cycles: 0,
    duplicatePaths: dupPaths.length,
    duplicateMigrationIds: ledger.orderedEntries.length - idSet.size,
  },
  m9Parity: m9.objectLevelStaticParity?.parityPass,
  m10Parity: m10.objectLevelStaticParity?.parityPass,
  m11Digest: !!m11.verification?.usesExtensionsDigest,
  tenantGate: tenant.pass,
  secretScanHits: secretHits.length,
};
fs.writeFileSync(
  path.join(ROOT, `${PKG}/14_LOCAL_VERIFICATION_REPORT.json`),
  JSON.stringify(report, null, 2) + "\n"
);
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exit(1);
