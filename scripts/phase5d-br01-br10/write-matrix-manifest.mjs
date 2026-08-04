#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = process.cwd();
const PKG = "docs/platform-hard-cutover-01/phase-05d-staging-rebuild-readiness-02";

function sha(rel) {
  const b = fs.readFileSync(path.join(ROOT, rel));
  return {
    path: rel.replace(/\\/g, "/"),
    sha256: crypto.createHash("sha256").update(b).digest("hex"),
    bytes: b.length,
  };
}

function walk(d, acc = []) {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name);
    if (n.isDirectory()) walk(p, acc);
    else if (/\.(json|md|sql|mjs)$/.test(n.name) && !n.name.startsWith("_")) {
      acc.push(path.relative(ROOT, p).replace(/\\/g, "/"));
    }
  }
  return acc;
}

const files = [
  ...walk(path.join(ROOT, PKG)),
  ...walk(path.join(ROOT, "scripts/phase5d-br01-br10")),
  "docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.sql",
];
const uniq = [...new Set(files)].filter((f) => !f.includes("_ledger_snapshot") && !/[\\/]1[45]_(?:LOCAL_VERIFICATION_REPORT|ARTIFACT_HASH_MANIFEST)\.json$/.test(f)).sort();

const ledger = JSON.parse(
  fs.readFileSync(path.join(ROOT, `${PKG}/02_PROPOSED_EXECUTABLE_BLANK_DB_LEDGER.json`), "utf8")
);
const matrix = {
  marker: "PHASE5D_BR01_BR10_CLOSURE_MATRIX_V1",
  verdictCandidate: "LOCAL_TECHNICAL_CLOSURE_PROPOSED_PENDING_INDEPENDENT_REVIEW",
  blockers: [
    {
      id: "B-R01",
      status: "PROPOSED_CLOSED",
      evidence: `${PKG}/02_PROPOSED_EXECUTABLE_BLANK_DB_LEDGER.json`,
    },
    {
      id: "B-R02",
      status: "PROPOSED_CLOSED",
      evidence: `${PKG}/03_M9_AUTHORITY_RESOLUTION.json`,
    },
    {
      id: "B-R03",
      status: "PROPOSED_CLOSED",
      evidence: `${PKG}/04_M10_AUTHORITY_RESOLUTION.json`,
    },
    {
      id: "B-R04",
      status: "PROPOSED_CLOSED",
      evidence: `${PKG}/05_M11_AUTHORITY_RESOLUTION.json`,
    },
    {
      id: "B-R05",
      status: "PROPOSED_CLOSED",
      evidence: [
        `${PKG}/06_CLOSED_EXPECTED_OBJECT_INVENTORY.json`,
        `${PKG}/08_HARD_CUTOVER_ACCEPTANCE_CONFIGURATION.json`,
      ],
    },
    {
      id: "B-R06",
      status: "PROPOSED_CLOSED",
      evidence: `${PKG}/07_BOOTSTRAP_SEED_LEDGER.json`,
    },
    {
      id: "B-R07",
      status: "PROPOSED_CLOSED",
      evidence: `${PKG}/09_EDGE_FUNCTION_DEPLOYMENT_AUTH_CONTRACT.json`,
    },
    {
      id: "B-R08",
      status: "PROPOSED_CLOSED",
      evidence: `${PKG}/10_USER_AVATARS_STORAGE_CONTRACT.json`,
    },
    {
      id: "B-R09",
      status: "PROPOSED_CLOSED",
      evidence: `${PKG}/11_TENANT_TYPE_STATIC_GATE_RESULTS.json`,
    },
    {
      id: "B-R10",
      status: "PROPOSED_CLOSED",
      evidence: `${PKG}/12_COACHING_04_AUTHORITY_DECISION.json`,
    },
    { id: "B-R11", status: "ACCEPTED_ORTHOGONAL", evidence: "unchanged from V1R3" },
    { id: "B-R12", status: "OPEN", evidence: "GO-A not claimed" },
  ],
  ledgerEntryCount: ledger.entryCount,
  g01_g17: "NOT_EXECUTED",
  ownerGoClaimed: false,
  phase05CompleteIssued: false,
};
fs.writeFileSync(
  path.join(ROOT, `${PKG}/13_BR01_BR10_CLOSURE_MATRIX.json`),
  JSON.stringify(matrix, null, 2) + "\n"
);

const manifest = {
  marker: "PHASE5D_ARTIFACT_HASH_MANIFEST_V2",
  scope: "Immutable implementation artifacts only; excludes mutable verification report 14 and self-referential manifest 15",
  excluded: [`${PKG}/14_LOCAL_VERIFICATION_REPORT.json`, `${PKG}/15_ARTIFACT_HASH_MANIFEST.json`],
  artifacts: uniq.map(sha),
};
fs.writeFileSync(
  path.join(ROOT, `${PKG}/15_ARTIFACT_HASH_MANIFEST.json`),
  JSON.stringify(manifest, null, 2) + "\n"
);

console.log(
  JSON.stringify({ artifacts: uniq.length, ledgerEntryCount: ledger.entryCount }, null, 2)
);
