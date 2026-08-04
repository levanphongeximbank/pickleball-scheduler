import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export const PHASE7_CERTIFIED_CONSTANTS = {
  authoritySchemaVersion: 2,
  packageSourceCommit: "93b14e08ae7fa4c20886c8770b168f2495540484",
  packageVersion: "phase7-canonical-production-execution-1",
  targetProjectRef: "expuvcohlcjzvrrauvud",
  ledgerStepCount: 11,
};

const SHA40_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^[A-Fa-f0-9]{64}$/;
const MANIFEST_PATH = "docs/v7/production-execution/MANIFEST.sha256";

function runGit(rootDir, args, opts = {}) {
  const encoding = Object.prototype.hasOwnProperty.call(opts, "encoding") ? opts.encoding : "utf8";
  const out = execFileSync("git", args, {
    cwd: rootDir,
    encoding,
    stdio: opts.stdio,
  });
  if (typeof out === "string") {
    return out.trim();
  }
  return out;
}

function gitExitOk(rootDir, args) {
  try {
    runGit(rootDir, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensureString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Blocked: missing or invalid ${field}`);
  }
  return value.trim();
}

function ensureInteger(value, field) {
  if (!Number.isInteger(value)) {
    throw new Error(`Blocked: missing or invalid ${field}`);
  }
  return value;
}

function ensureSha256(value, field) {
  const s = ensureString(value, field);
  if (!SHA256_RE.test(s)) {
    throw new Error(`Blocked: ${field} must be a 64-char SHA256`);
  }
  return s.toUpperCase();
}

function parseManifestLine(line) {
  const m = line.match(/^([A-Fa-f0-9]{64})\s{2}(.+)$/);
  if (!m) {
    throw new Error(`Blocked: invalid MANIFEST line: ${line}`);
  }
  if (m[2].startsWith("../") || m[2].includes("..\\") || m[2].includes(":\\") || m[2].startsWith("/")) {
    throw new Error(`Blocked: invalid MANIFEST artifact path: ${m[2]}`);
  }
  return { hash: m[1].toUpperCase(), artifactPath: m[2].replace(/\\/g, "/") };
}

function sha256Upper(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function resolveGitBlobObject(rootDir, rev, repoPath) {
  try {
    return runGit(rootDir, ["rev-parse", `${rev}:${repoPath}`]);
  } catch {
    throw new Error(`Blocked: cannot resolve git blob ${rev}:${repoPath}`);
  }
}

function readGitBlob(rootDir, rev, repoPath) {
  const objectId = resolveGitBlobObject(rootDir, rev, repoPath);
  try {
    return runGit(rootDir, ["cat-file", "blob", objectId], { encoding: null });
  } catch {
    throw new Error(`Blocked: cannot read git blob ${objectId} for ${repoPath}`);
  }
}

function readManifestLinesFromBlob(rootDir, approvedExecutionHead, manifestRelativePath) {
  const blob = readGitBlob(rootDir, approvedExecutionHead, manifestRelativePath);
  const lines = String(blob)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return { blob, lines };
}

export function computeWorkingTreeManifestDigest(rootDir, manifestRelativePath = MANIFEST_PATH) {
  return sha256Upper(fs.readFileSync(path.join(rootDir, manifestRelativePath)));
}

export function computeManifestGitBlobDigest(rootDir, approvedExecutionHead, manifestRelativePath = MANIFEST_PATH) {
  const blob = readGitBlob(rootDir, approvedExecutionHead, manifestRelativePath);
  return sha256Upper(blob);
}

export function loadExecutionAuthority(authorityFilePath) {
  const raw = fs.readFileSync(authorityFilePath, "utf8");
  const data = JSON.parse(raw);

  if (data.packageManifestDigest && !data.manifestGitBlobDigest) {
    throw new Error(
      "Blocked: authority schema v1 is rejected (packageManifestDigest is obsolete; use authoritySchemaVersion=2 + manifestGitBlobDigest)"
    );
  }
  if (data.packageManifestDigest && data.manifestGitBlobDigest) {
    throw new Error("Blocked: ambiguous authority digest fields (packageManifestDigest + manifestGitBlobDigest)");
  }

  const authority = {
    authoritySchemaVersion: ensureInteger(data.authoritySchemaVersion, "authoritySchemaVersion"),
    approvedExecutionHead: ensureString(data.approvedExecutionHead, "approvedExecutionHead"),
    packageSourceCommit: ensureString(data.packageSourceCommit, "packageSourceCommit"),
    packageVersion: ensureString(data.packageVersion, "packageVersion"),
    manifestGitBlobDigest: ensureSha256(data.manifestGitBlobDigest, "manifestGitBlobDigest"),
    targetProjectRef: ensureString(data.targetProjectRef, "targetProjectRef"),
    ledgerStepCount: ensureInteger(data.ledgerStepCount, "ledgerStepCount"),
    issuedAt: ensureString(data.issuedAt, "issuedAt"),
    executionWindow: data.executionWindow,
    ownerAuthorizationMarker: ensureString(data.ownerAuthorizationMarker, "ownerAuthorizationMarker"),
    productionGo: ensureString(data.productionGo, "productionGo"),
  };

  if (!SHA40_RE.test(authority.approvedExecutionHead)) {
    throw new Error("Blocked: approvedExecutionHead must be a 40-char SHA");
  }
  if (!SHA40_RE.test(authority.packageSourceCommit)) {
    throw new Error("Blocked: packageSourceCommit must be a 40-char SHA");
  }
  if (authority.authoritySchemaVersion !== 2) {
    throw new Error(`Blocked: unsupported authoritySchemaVersion=${authority.authoritySchemaVersion}; expected=2`);
  }
  if (!authority.executionWindow || typeof authority.executionWindow !== "object") {
    throw new Error("Blocked: missing executionWindow");
  }
  ensureString(authority.executionWindow.start, "executionWindow.start");
  ensureString(authority.executionWindow.end, "executionWindow.end");
  if (authority.productionGo !== "YES") {
    throw new Error("Blocked: Production GO is not active in execution authority");
  }
  if (!/^OWNER_GO_[A-Z0-9_\-]+$/.test(authority.ownerAuthorizationMarker)) {
    throw new Error("Blocked: ownerAuthorizationMarker format invalid");
  }

  return authority;
}

export function verifyManifestEntries(rootDir, approvedExecutionHead, manifestRelativePath = MANIFEST_PATH) {
  const { lines, blob } = readManifestLinesFromBlob(rootDir, approvedExecutionHead, manifestRelativePath);

  const parsed = lines.map(parseManifestLine);
  const mismatches = [];
  for (const entry of parsed) {
    let actual;
    try {
      actual = sha256Upper(readGitBlob(rootDir, approvedExecutionHead, entry.artifactPath));
    } catch {
      mismatches.push({ artifactPath: entry.artifactPath, expected: entry.hash, actual: "MISSING_BLOB" });
      continue;
    }
    if (actual !== entry.hash) {
      mismatches.push({ artifactPath: entry.artifactPath, expected: entry.hash, actual });
    }
  }
  return {
    entryCount: parsed.length,
    mismatches,
    manifestGitBlobDigest: sha256Upper(blob),
  };
}

function toRepoRelative(rootDir, anyPath) {
  const fullPath = path.isAbsolute(anyPath) ? anyPath : path.join(rootDir, anyPath);
  const relPath = path.relative(rootDir, fullPath).split(path.sep).join("/");
  if (relPath.startsWith("..")) {
    throw new Error("Blocked: path must be inside current execution worktree");
  }
  return relPath;
}

function ensureCleanWorktree(rootDir, allowedUntrackedRelPaths = []) {
  const status = runGit(rootDir, ["status", "--porcelain"]);
  if (!status) {
    return { clean: true, untrackedCount: 0 };
  }

  const allow = new Set(allowedUntrackedRelPaths);
  const lines = status.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith("?? ")) {
      throw new Error(`Blocked: execution worktree must be clean before guard passes (entry=${line})`);
    }
    const rel = line.slice(3).trim().split(path.sep).join("/");
    if (!allow.has(rel)) {
      throw new Error(`Blocked: untracked artifact not allowed by execution authority guard (${rel})`);
    }
  }

  return { clean: true, untrackedCount: lines.length };
}

function ensureLocalUntrackedGitignoredFile(rootDir, filePath, label) {
  if (!filePath) {
    throw new Error(`Blocked: missing ${label}`);
  }
  const relPath = toRepoRelative(rootDir, filePath);
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Blocked: ${label} not found: ${filePath}`);
  }
  if (gitExitOk(rootDir, ["ls-files", "--error-unmatch", "--", relPath])) {
    throw new Error(`Blocked: ${label} is tracked by git: ${relPath}`);
  }
  if (!gitExitOk(rootDir, ["check-ignore", "-q", "--", relPath])) {
    throw new Error(`Blocked: ${label} is not gitignored: ${relPath}`);
  }
  return relPath;
}

function ensureCredentialFileGitignored(rootDir, credentialFilePath) {
  if (!credentialFilePath) {
    throw new Error("Blocked: missing credentialFilePath for gitignore validation");
  }
  return ensureLocalUntrackedGitignoredFile(rootDir, credentialFilePath, "credential file");
}

function ensureWarningClosureClosed(rootDir) {
  const w1 = JSON.parse(
    fs.readFileSync(path.join(rootDir, "docs/v7/warning-closure/W-P7-001_BASELINE_RECONCILIATION.json"), "utf8")
  );
  const w2 = JSON.parse(
    fs.readFileSync(path.join(rootDir, "docs/v7/warning-closure/W-P7-002_ROLE_SCHEMA_RECONCILIATION.json"), "utf8")
  );
  const w3 = JSON.parse(
    fs.readFileSync(
      path.join(rootDir, "docs/v7/warning-closure/W-P7-003_PHASE1B_PARTIAL_STATE_RECONCILIATION.json"),
      "utf8"
    )
  );

  const stale = Number(w1.staleExecutionGuardCount || 0);
  const unresolved = Number(
    Array.isArray(w2?.payload?.dependency_inventory?.functions_with_club_members_role_code)
      ? w2.payload.dependency_inventory.functions_with_club_members_role_code.length
      : 0
  );
  const conflicting = Number(w3.conflictingObjects || 0);
  const unknown = Number(w3.unknownObjects || 0);
  const undefinedBehavior = Number(w3.undefinedIdempotencyBehavior || 0);

  if (stale !== 0 || unresolved !== 0 || conflicting !== 0 || unknown !== 0 || undefinedBehavior !== 0) {
    throw new Error(
      "Blocked: warning-closure statuses not CLOSED (W-P7-001/002/003 counters must all be zero)"
    );
  }

  return { stale, unresolved, conflicting, unknown, undefinedBehavior };
}

export function assertPhase7ExecutionAuthority(options) {
  const {
    rootDir,
    authorityFilePath,
    runtimeTargetProjectRef,
    credentialFilePath,
    expected = PHASE7_CERTIFIED_CONSTANTS,
  } = options;

  const fullAuthorityPath = path.isAbsolute(authorityFilePath)
    ? authorityFilePath
    : path.join(rootDir, authorityFilePath);
  if (!fs.existsSync(fullAuthorityPath)) {
    throw new Error(`Blocked: execution authority file not found: ${authorityFilePath}`);
  }

  const authorityRelPath = ensureLocalUntrackedGitignoredFile(
    rootDir,
    fullAuthorityPath,
    "execution authority file"
  );
  const credentialRelPath = ensureCredentialFileGitignored(rootDir, credentialFilePath);

  const authority = loadExecutionAuthority(fullAuthorityPath);
  ensureCleanWorktree(rootDir, [authorityRelPath, credentialRelPath]);

  const originMain = runGit(rootDir, ["rev-parse", "origin/main"]);
  const headSha = runGit(rootDir, ["rev-parse", "HEAD"]);

  if (originMain !== authority.approvedExecutionHead) {
    throw new Error(
      `Blocked: origin/main mismatch. expected=${authority.approvedExecutionHead} actual=${originMain}`
    );
  }
  if (headSha !== authority.approvedExecutionHead) {
    throw new Error(`Blocked: HEAD mismatch. expected=${authority.approvedExecutionHead} actual=${headSha}`);
  }
  if (
    !gitExitOk(rootDir, [
      "merge-base",
      "--is-ancestor",
      authority.packageSourceCommit,
      authority.approvedExecutionHead,
    ])
  ) {
    throw new Error(
      `Blocked: package source commit is not ancestor of approved execution head (${authority.packageSourceCommit} -> ${authority.approvedExecutionHead})`
    );
  }

  if (authority.authoritySchemaVersion !== expected.authoritySchemaVersion) {
    throw new Error(
      `Blocked: authoritySchemaVersion mismatch. expected=${expected.authoritySchemaVersion} actual=${authority.authoritySchemaVersion}`
    );
  }
  if (authority.packageSourceCommit !== expected.packageSourceCommit) {
    throw new Error(
      `Blocked: packageSourceCommit mismatch. expected=${expected.packageSourceCommit} actual=${authority.packageSourceCommit}`
    );
  }
  if (authority.targetProjectRef !== expected.targetProjectRef || runtimeTargetProjectRef !== expected.targetProjectRef) {
    throw new Error(
      `Blocked: target mismatch. expected=${expected.targetProjectRef} authority=${authority.targetProjectRef} runtime=${runtimeTargetProjectRef}`
    );
  }
  if (authority.packageVersion !== expected.packageVersion) {
    throw new Error(
      `Blocked: packageVersion mismatch. expected=${expected.packageVersion} actual=${authority.packageVersion}`
    );
  }

  const manifest = verifyManifestEntries(rootDir, authority.approvedExecutionHead);
  if (manifest.mismatches.length > 0) {
    throw new Error(`Blocked: manifest entry mismatch count=${manifest.mismatches.length}`);
  }

  const manifestGitBlobDigest = manifest.manifestGitBlobDigest;
  const workingTreeManifestDigest = computeWorkingTreeManifestDigest(rootDir);
  if (authority.manifestGitBlobDigest !== manifestGitBlobDigest) {
    throw new Error(
      `Blocked: authority manifest git-blob digest mismatch. expected=${manifestGitBlobDigest} actual=${authority.manifestGitBlobDigest}`
    );
  }
  if (expected.manifestGitBlobDigest && expected.manifestGitBlobDigest !== manifestGitBlobDigest) {
    throw new Error(
      `Blocked: certified manifestGitBlobDigest mismatch. expected=${expected.manifestGitBlobDigest} actual=${manifestGitBlobDigest}`
    );
  }

  const ledgerBlob = readGitBlob(rootDir, authority.approvedExecutionHead, "docs/v7/production-execution/02_ORDERED_EXECUTION_LEDGER.json");
  const ledger = JSON.parse(String(ledgerBlob));
  const stepCount = Array.isArray(ledger.steps) ? ledger.steps.length : 0;
  if (authority.ledgerStepCount !== expected.ledgerStepCount || stepCount !== expected.ledgerStepCount) {
    throw new Error(
      `Blocked: ledgerStepCount mismatch. expected=${expected.ledgerStepCount} authority=${authority.ledgerStepCount} actual=${stepCount}`
    );
  }

  const warning = ensureWarningClosureClosed(rootDir);

  return {
    authority,
    originMain,
    headSha,
    manifestGitBlobDigest,
    workingTreeManifestDigest,
    manifestEntryCount: manifest.entryCount,
    ledgerStepCount: stepCount,
    warning,
  };
}
