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
    "docs/platform-hard-cutover-01/phase-05b-execution-package/M0_M11_EXECUTION_MANIFEST.json",
    {
      sha256ExactGitBlobBytes: "74C4A34E027D3BD3E0488516B055251C9A764F3CF481EE78276EFE5B5DFC9FD2",
      sha256CanonicalLf: "74C4A34E027D3BD3E0488516B055251C9A764F3CF481EE78276EFE5B5DFC9FD2",
      gitBlobOid: "b0fdc0c1f0bb9b4b64ff572d97929c7ff0fdbad4",
    },
  ],
  [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/00_SOURCE_PROVENANCE.json",
    {
      sha256ExactGitBlobBytes: "D7AC0B5661CC770712ED440AA5CD6696286ABBA07D9A7F574B3EF1C6F0BE6F3F",
      sha256CanonicalLf: "D7AC0B5661CC770712ED440AA5CD6696286ABBA07D9A7F574B3EF1C6F0BE6F3F",
      gitBlobOid: "628a17a86ade5a59e258939dccae895359a0c5a5",
    },
  ],
  [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/M9_MANIFEST.json",
    {
      sha256ExactGitBlobBytes: "A7E8320B193142510B7F13A5D6AFFA13402FA4E8B18B8B10953127B5D83FD9A5",
      sha256CanonicalLf: "A7E8320B193142510B7F13A5D6AFFA13402FA4E8B18B8B10953127B5D83FD9A5",
      gitBlobOid: "bd44fcabe4c071feaa95e02a4604f5b675de518f",
    },
  ],
  [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/190_TT5D_ASSIGNMENT_SAFETY.sql",
    {
      sha256ExactGitBlobBytes: "6A36CD2E0AB9005B9DAA666A888C3EF816110BC697EDFDAD8C19FC9E79040C6C",
      sha256CanonicalLf: "6A36CD2E0AB9005B9DAA666A888C3EF816110BC697EDFDAD8C19FC9E79040C6C",
      gitBlobOid: "2f5c598d2dc19bce4577ed025154a75ef86a77e8",
    },
  ],
  [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/200_TT5D_REOPEN_RESULT.sql",
    {
      sha256ExactGitBlobBytes: "FF78962C82A15C2EB84364273475AE1EA38E3FD921080D41908E7320BFF112BC",
      sha256CanonicalLf: "FF78962C82A15C2EB84364273475AE1EA38E3FD921080D41908E7320BFF112BC",
      gitBlobOid: "b0a7a94eb6ef774850266c629c5f7c05be5636f5",
    },
  ],
  [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/210_TT5D_CORRECTION.sql",
    {
      sha256ExactGitBlobBytes: "DE04F4D6BFC37C2D4CA9257BD9F7C51E118545F6E20DB66DFF2B575B1A26AFAE",
      sha256CanonicalLf: "DE04F4D6BFC37C2D4CA9257BD9F7C51E118545F6E20DB66DFF2B575B1A26AFAE",
      gitBlobOid: "f1d0ce3ebcf95682e93c9c85332d4d9ffe7337bf",
    },
  ],
  [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/220_TT5D_SECURITY_GUARDS.sql",
    {
      sha256ExactGitBlobBytes: "B4651420105810340D8181C5054AC14C5553EA75DFFDB3BC38146C4ADB3EE08C",
      sha256CanonicalLf: "B4651420105810340D8181C5054AC14C5553EA75DFFDB3BC38146C4ADB3EE08C",
      gitBlobOid: "4c32c460690f87ee17edee9c490417becdc44cf5",
    },
  ]
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
  // Autocrlf-safe: working tree must match index. Staged-vs-HEAD drift is allowed
  // during Phase 5D-A.1 pre-commit verification of intentional consumers.
  try {
    git(["diff", "--quiet", "--", norm]);
  } catch {
    fail("tracked path is dirty vs index: " + norm);
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
