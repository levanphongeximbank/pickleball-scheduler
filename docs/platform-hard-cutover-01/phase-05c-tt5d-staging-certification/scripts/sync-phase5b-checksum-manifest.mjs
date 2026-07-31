/**
 * Phase 5C narrow remediation — synchronize PHASE5B_CHECKSUM_MANIFEST.json
 * exact-byte hashes with the current Git index blobs.
 *
 * Checksum-only. No git add/commit/push. No network/database.
 *
 * Usage:
 *   node .../sync-phase5b-checksum-manifest.mjs           # check/dry-run
 *   node .../sync-phase5b-checksum-manifest.mjs --write   # write allowlisted updates
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const MANIFEST_REL =
  "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5B_CHECKSUM_MANIFEST.json";
const MANIFEST_ABS = path.join(ROOT, MANIFEST_REL);

const ALLOWLIST = new Map([
  [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/00_SOURCE_PROVENANCE.json",
    {
      sha256ExactGitBlobBytes:
        "0122753BD8BED4586226B180248CAFE0658D2A3242773A560C494035BE51363E",
      sha256CanonicalLf:
        "0122753BD8BED4586226B180248CAFE0658D2A3242773A560C494035BE51363E",
      gitBlobOid: "282a0847881d99226205a1c7e450301620fcacca",
    },
  ],
  [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/M9_MANIFEST.json",
    {
      sha256ExactGitBlobBytes:
        "9343C58442CE7B33547B7D3603FC4AE28B0FA2D2C56D65DA8038153C1E0A4D16",
      sha256CanonicalLf:
        "9343C58442CE7B33547B7D3603FC4AE28B0FA2D2C56D65DA8038153C1E0A4D16",
      gitBlobOid: "c62d34955f88ec54b7a39e4da87bdbe0c0555dd8",
    },
  ],
]);

const writeMode = process.argv.includes("--write");

function git(args, opts = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: opts.encoding ?? "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}

function sha256CanonicalLf(buf) {
  const text = Buffer.from(buf).toString("utf8").replace(/\r\n/g, "\n");
  return sha256(Buffer.from(text, "utf8"));
}

function assertCleanTrackedPath(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  // Git-clean equality (handles autocrlf). Do not hash working-tree bytes.
  try {
    git(["diff", "--quiet", "--", norm]);
    git(["diff", "--quiet", "--cached", "--", norm]);
  } catch {
    fail(`tracked path is dirty vs index/HEAD: ${norm}`);
  }
  const porcelain = git(["status", "--porcelain", "--", norm]).trim();
  if (porcelain) {
    fail(`unexpected porcelain status for ${norm}: ${porcelain}`);
  }
}

function readIndexBlob(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  const oid = git(["rev-parse", "--verify", `:${norm}`]).trim();
  const buf = git(["cat-file", "blob", oid], { encoding: "buffer" });
  return { oid, buf };
}

function fail(msg) {
  console.error(`STOP: ${msg}`);
  process.exit(1);
}

const raw = fs.readFileSync(MANIFEST_ABS, "utf8");
const manifest = JSON.parse(raw);

if (!Array.isArray(manifest.files) || manifest.files.length !== 42) {
  fail(`expected exactly 42 files, got ${manifest.files?.length}`);
}
if (manifest.checksumFieldAuthoritative !== "sha256ExactGitBlobBytes") {
  fail("checksumFieldAuthoritative must be sha256ExactGitBlobBytes");
}
if (manifest.secondaryField !== "sha256CanonicalLf") {
  fail("secondaryField must be sha256CanonicalLf");
}
if (!manifest.orderedApplyRules || !manifest.nonExecutionCandidates) {
  fail("orderedApplyRules / nonExecutionCandidates must be preserved");
}

const beforeSnapshot = JSON.stringify({
  marker: manifest.marker,
  correction: manifest.correction,
  algorithm: manifest.algorithm,
  checksumFieldAuthoritative: manifest.checksumFieldAuthoritative,
  secondaryField: manifest.secondaryField,
  orderedApplyRules: manifest.orderedApplyRules,
  nonExecutionCandidates: manifest.nonExecutionCandidates,
  fileOrder: manifest.files.map((f) => f.path),
});

const drifts = [];
const updated = [];

for (const entry of manifest.files) {
  const p = entry.path;
  assertCleanTrackedPath(p);
  const { oid, buf } = readIndexBlob(p);

  const exact = sha256(buf);
  const canonical = sha256CanonicalLf(buf);

  const next = {
    path: p,
    sha256ExactGitBlobBytes: exact,
    sha256CanonicalLf: canonical,
    hashSource: "INDEX",
    gitBlobOid: oid,
  };

  const changed =
    String(entry.sha256ExactGitBlobBytes || "").toUpperCase() !== exact ||
    String(entry.sha256CanonicalLf || "").toUpperCase() !== canonical ||
    String(entry.gitBlobOid || "") !== oid ||
    String(entry.hashSource || "") !== "INDEX";

  if (!changed) continue;

  if (!ALLOWLIST.has(p)) {
    fail(`unexpected checksum drift outside allowlist: ${p}`);
  }

  const expected = ALLOWLIST.get(p);
  if (exact !== expected.sha256ExactGitBlobBytes) {
    fail(`${p}: exact hash ${exact} != required ${expected.sha256ExactGitBlobBytes}`);
  }
  if (canonical !== expected.sha256CanonicalLf) {
    fail(`${p}: canonical hash mismatch`);
  }
  if (oid !== expected.gitBlobOid) {
    fail(`${p}: blob oid ${oid} != required ${expected.gitBlobOid}`);
  }

  drifts.push({
    path: p,
    from: {
      sha256ExactGitBlobBytes: entry.sha256ExactGitBlobBytes,
      sha256CanonicalLf: entry.sha256CanonicalLf,
      gitBlobOid: entry.gitBlobOid,
      hashSource: entry.hashSource,
    },
    to: next,
  });

  Object.assign(entry, next);
  updated.push(p);
}

const allowlistPaths = [...ALLOWLIST.keys()].sort();
const updatedSorted = [...updated].sort();
if (writeMode || drifts.length > 0) {
  if (JSON.stringify(updatedSorted) !== JSON.stringify(allowlistPaths)) {
    if (drifts.length === 0 && !writeMode) {
      // idempotent check path handled below
    } else if (drifts.length > 0 && JSON.stringify(updatedSorted) !== JSON.stringify(allowlistPaths)) {
      fail(
        `changed-entry allowlist mismatch. expected=${JSON.stringify(allowlistPaths)} got=${JSON.stringify(updatedSorted)}`
      );
    }
  }
}

if (drifts.length > 0 && JSON.stringify(updatedSorted) !== JSON.stringify(allowlistPaths)) {
  fail(
    `changed-entry allowlist mismatch. expected=${JSON.stringify(allowlistPaths)} got=${JSON.stringify(updatedSorted)}`
  );
}

const afterSnapshot = JSON.stringify({
  marker: manifest.marker,
  correction: manifest.correction,
  algorithm: manifest.algorithm,
  checksumFieldAuthoritative: manifest.checksumFieldAuthoritative,
  secondaryField: manifest.secondaryField,
  orderedApplyRules: manifest.orderedApplyRules,
  nonExecutionCandidates: manifest.nonExecutionCandidates,
  fileOrder: manifest.files.map((f) => f.path),
});
if (beforeSnapshot !== afterSnapshot) {
  fail("preserved metadata/order mutated unexpectedly");
}

if (drifts.length === 0) {
  console.log(
    JSON.stringify(
      {
        mode: writeMode ? "write" : "check",
        status: "IDEMPOTENT_NO_DRIFT",
        files: 42,
        updated: [],
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (!writeMode) {
  console.log(
    JSON.stringify(
      {
        mode: "check",
        status: "DRIFT_DETECTED_DRY_RUN",
        files: 42,
        drifts,
      },
      null,
      2
    )
  );
  process.exit(0);
}

fs.writeFileSync(MANIFEST_ABS, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(
  JSON.stringify(
    {
      mode: "write",
      status: "WRITTEN",
      files: 42,
      updated: drifts.map((d) => ({
        path: d.path,
        sha256ExactGitBlobBytes: d.to.sha256ExactGitBlobBytes,
        gitBlobOid: d.to.gitBlobOid,
      })),
    },
    null,
    2
  )
);
