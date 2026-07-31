/**
 * Narrow Phase 5D checksum manifest sync.
 * Index-blob authoritative when tracked; otherwise working-tree for first materialization.
 *
 * Usage:
 *   node .../sync-phase5d-checksum-manifest.mjs           # check
 *   node .../sync-phase5d-checksum-manifest.mjs --write   # write manifest
 *
 * Never runs git add/commit/push.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");
const ROOT = path.resolve(PKG, "../../..");
const PKG_REL =
  "docs/platform-hard-cutover-01/phase-05d-tt5d-controlled-reconciliation";
const MANIFEST_REL = `${PKG_REL}/PHASE5D_CHECKSUM_MANIFEST.json`;
const writeMode = process.argv.includes("--write");

const ALLOWLIST = [
  "README.md",
  "PHASE5D_A_READINESS_MANIFEST.json",
  "evidence/01_STAGING_TARGET_AND_BASELINE_GATE.json",
  "evidence/02_TT5D_EXACT_CATALOG_BASELINE.json",
  "evidence/03_TT5D_SEMANTIC_DELTA.json",
  "evidence/04_TWO_WAY_DEPENDENCY_MAP.json",
  "evidence/05_PHASE5D_A_DECISION.json",
  "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql",
  "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
  "sql/20_TT5D_POST_APPLY_VERIFY.sql",
  "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
  "scripts/generate-phase5d-a-package.mjs",
  "scripts/verify-phase5d-a.mjs",
  "scripts/sync-phase5d-checksum-manifest.mjs",
].map((p) => `${PKG_REL}/${p}`.replace(/\\/g, "/"));

function sha256Exact(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}
function sha256CanonicalLf(buf) {
  const t = buf.toString("utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(Buffer.from(t, "utf8")).digest("hex").toUpperCase();
}
function gitBlobOidForBytes(buf) {
  const store = spawnSync("git", ["hash-object", "--stdin"], {
    cwd: ROOT,
    input: buf,
    encoding: "buffer",
  });
  if (store.status !== 0) throw new Error("git hash-object failed");
  return store.stdout.toString("utf8").trim();
}
function readIndexOrWt(rel) {
  const norm = rel.replace(/\\/g, "/");
  const oidR = spawnSync("git", ["rev-parse", "--verify", "--quiet", `:${norm}`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (oidR.status === 0) {
    const oid = oidR.stdout.trim();
    const blob = spawnSync("git", ["cat-file", "blob", oid], { cwd: ROOT, encoding: "buffer" });
    if (blob.status === 0) {
      const abs = path.join(ROOT, norm);
      if (fs.existsSync(abs)) {
        const wt = fs.readFileSync(abs);
        if (!wt.equals(blob.stdout)) {
          throw new Error(`working-tree differs from index: ${norm}`);
        }
      }
      return { bytes: blob.stdout, oid, source: "INDEX" };
    }
  }
  const abs = path.join(ROOT, norm);
  if (!fs.existsSync(abs)) throw new Error(`missing ${norm}`);
  const bytes = fs.readFileSync(abs);
  return { bytes, oid: gitBlobOidForBytes(bytes), source: "WORKING_TREE" };
}

const files = [];
for (const rel of [...ALLOWLIST].sort()) {
  const { bytes, oid, source } = readIndexOrWt(rel);
  files.push({
    path: rel,
    sha256ExactGitBlobBytes: sha256Exact(bytes),
    sha256CanonicalLf: sha256CanonicalLf(bytes),
    gitBlobOid: oid,
    hashSource: source,
  });
}

const next = {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_CHECKSUM_MANIFEST",
  algorithm: "SHA-256",
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  secondaryField: "sha256CanonicalLf",
  note: "Deterministic package checksums; no mutable timestamps in decisions",
  files,
};

const absMan = path.join(ROOT, MANIFEST_REL);
let status = "IDEMPOTENT_NO_DRIFT";
let updated = [];
if (fs.existsSync(absMan)) {
  const prev = JSON.parse(fs.readFileSync(absMan, "utf8"));
  const prevMap = new Map((prev.files || []).map((f) => [f.path, f]));
  for (const f of files) {
    const p = prevMap.get(f.path);
    if (
      !p ||
      p.sha256ExactGitBlobBytes !== f.sha256ExactGitBlobBytes ||
      p.gitBlobOid !== f.gitBlobOid
    ) {
      updated.push(f.path);
    }
  }
  if (updated.length) status = "DRIFT_DETECTED";
} else {
  status = "MANIFEST_ABSENT";
  updated = files.map((f) => f.path);
}

if (writeMode) {
  fs.writeFileSync(absMan, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  // After write, recompute self is not in allowlist; manifest is separate.
  console.log(
    JSON.stringify({ mode: "write", status: "WRITTEN", files: files.length, updated }, null, 2),
  );
} else {
  console.log(
    JSON.stringify({ mode: "check", status, files: files.length, updated }, null, 2),
  );
  if (status === "DRIFT_DETECTED") process.exit(2);
}
