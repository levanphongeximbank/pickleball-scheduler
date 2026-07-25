/**
 * PM-ID-01 — Guarded Staging activation library.
 * Authoring + guard evaluation only. Does not open DB connections by itself.
 * CODEX_DELETE_ALLOWED=NO.
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PM_ID_01_STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";
export const PM_ID_01_STAGING_PROJECT_REF_ALLOWLIST = Object.freeze([
  PM_ID_01_STAGING_PROJECT_REF,
]);
export const PM_ID_01_PRODUCTION_PROJECT_REF_BLOCKLIST = Object.freeze([
  "expuvcohlcjzvrrauvud",
]);
export const PM_ID_01_ENVIRONMENT_LABEL = "staging";
export const PM_ID_01_OWNER_GO_TOKEN = "PM_ID_01_OWNER_GO_APPLY_STAGING";
export const PM_ID_01_MANIFEST_HASH_ALGORITHM = "sha256-lf-normalized";

export const PM_ID_01_PACK_DIR = "docs/player-management/pm-id-01";
export const PM_ID_01_ACTIVATION_DIR =
  "docs/player-management/pm-id-01/activation";
export const PM_ID_01_MANIFEST_RELATIVE_PATH =
  "docs/player-management/pm-id-01/activation/sql-migration-manifest.json";
export const PM_ID_01_EVIDENCE_DIR =
  "docs/player-management/pm-id-01/activation/evidence";
export const PM_ID_01_APPROVAL_TEMPLATE_RELATIVE_PATH =
  "docs/player-management/pm-id-01/activation/OWNER_STAGING_APPLY_APPROVAL.template.json";
export const PM_ID_01_APPROVAL_EVIDENCE_RELATIVE_PATH =
  "docs/player-management/pm-id-01/activation/OWNER_STAGING_APPLY_APPROVAL.json";

/** Exact forward SQL execution order (rollback 90 excluded). */
export const PM_ID_01_FORWARD_SQL_ORDER = Object.freeze([
  "docs/player-management/pm-id-01/10_PM_ID_01_MAPPING_TABLE.sql",
  "docs/player-management/pm-id-01/20_PM_ID_01_CONSTRAINTS_AND_INDEXES.sql",
  "docs/player-management/pm-id-01/30_PM_ID_01_RESOLUTION_HELPERS.sql",
  "docs/player-management/pm-id-01/40_PM_ID_01_MAPPING_MANAGEMENT_RPCS.sql",
  "docs/player-management/pm-id-01/50_PM_ID_01_RLS_AND_GRANTS.sql",
]);

export const PM_ID_01_VERIFICATION_SQL_PATH =
  "docs/player-management/pm-id-01/99_PM_ID_01_VERIFICATION.sql";

export const PM_ID_01_ROLLBACK_SQL_PATH =
  "docs/player-management/pm-id-01/90_PM_ID_01_ROLLBACK.sql";

/** Apply plan order: forward then verification. Rollback never auto. */
export const PM_ID_01_APPLY_EXECUTION_ORDER = Object.freeze([
  ...PM_ID_01_FORWARD_SQL_ORDER,
  PM_ID_01_VERIFICATION_SQL_PATH,
]);

export const PM_ID_01_VERDICTS = Object.freeze({
  APPLY_REFUSED: "PM_ID_01_APPLY_REFUSED",
  APPLY_REFUSED_OWNER_GO_NOT_GRANTED:
    "PM_ID_01_APPLY_REFUSED_OWNER_GO_NOT_GRANTED",
  APPLY_BLOCKED: "PM_ID_01_STAGING_APPLY_BLOCKED",
  EXECUTION_COMMIT_MISMATCH_REFUSED:
    "PM_ID_01_EXECUTION_COMMIT_MISMATCH_REFUSED",
  PREFLIGHT_PASS: "PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_PASS",
  PREFLIGHT_OFFLINE_PASS: "PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_OFFLINE_PASS",
  PREFLIGHT_FAIL: "PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_FAIL",
  PREFLIGHT_BLOCKED: "PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_BLOCKED",
  ACTIVATION_SCOPE_BLOCKED: "PM_ID_01_ACTIVATION_SCOPE_BLOCKED",
  ACTIVATION_BASE_ALIGNMENT_BLOCKED:
    "PM_ID_01_ACTIVATION_BASE_ALIGNMENT_BLOCKED",
});

export const PM_ID_01_ENV_NAMES = Object.freeze({
  OWNER_GO: "PM_ID_01_OWNER_GO",
  TARGET_CONFIRM: "PM_ID_01_STAGING_TARGET_CONFIRM",
  EXPECTED_COMMIT: "PM_ID_01_EXPECTED_COMMIT",
  APPROVED_COMMIT: "PM_ID_01_OWNER_APPROVED_COMMIT",
  ACCESS_TOKEN: "SUPABASE_ACCESS_TOKEN",
  STAGING_SUPABASE_URL: "STAGING_SUPABASE_URL",
  VITE_SUPABASE_URL: "VITE_SUPABASE_URL",
  SUPABASE_URL: "SUPABASE_URL",
});

const FULL_SHA_RE = /^[0-9a-f]{40}$/i;
const BRANCH_LIKE_RE = /^(main|master|origin\/|feature\/|hotfix\/|release\/)/i;

/**
 * @param {string} [fromUrl]
 * @returns {string}
 */
export function getPmId01RepoRoot(fromUrl) {
  const here = path.dirname(fileURLToPath(fromUrl || import.meta.url));
  return path.resolve(here, "../..");
}

/**
 * @param {string|Buffer|Uint8Array} input
 * @returns {string}
 */
export function canonicalizePmId01MigrationText(input) {
  let text;
  if (typeof input === "string") text = input;
  else if (input instanceof Uint8Array) {
    text = new TextDecoder("utf8").decode(input);
  } else text = String(input ?? "");
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * @param {string|Buffer|Uint8Array} input
 * @returns {string}
 */
export function sha256CanonicalContent(input) {
  const canonical = canonicalizePmId01MigrationText(input);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * @param {string} absolutePath
 * @returns {string}
 */
export function sha256File(absolutePath) {
  return sha256CanonicalContent(readFileSync(absolutePath));
}

/**
 * @param {Array<{ order: number, path: string, sha256: string }>} entries
 * @returns {string}
 */
export function aggregateSha256ForEntries(entries) {
  const lines = [...entries]
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map(
      (e) =>
        `${Number(e.order)}|${String(e.path).replace(/\\/g, "/")}|${String(e.sha256).toLowerCase()}`
    )
    .join("\n");
  return sha256CanonicalContent(`${lines}\n`);
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isPmId01FullGitSha(value) {
  return FULL_SHA_RE.test(String(value || "").trim());
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function looksLikePmId01BranchName(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  if (isPmId01FullGitSha(v)) return false;
  if (/^[0-9a-f]{7,39}$/i.test(v)) return false;
  return BRANCH_LIKE_RE.test(v) || /[\s\/]/.test(v) || !/^[0-9a-f]+$/i.test(v);
}

/**
 * @param {string} repoRoot
 * @returns {string}
 */
export function getPmId01HeadSha(repoRoot) {
  return execSync("git rev-parse HEAD", {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

/**
 * @param {string} repoRoot
 * @returns {{ ok: boolean, porcelain?: string }}
 */
export function evaluatePmId01WorktreeClean(repoRoot) {
  const porcelain = execSync("git status --porcelain", {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return { ok: porcelain.trim().length === 0, porcelain };
}

/**
 * True when ancestorSha is an ancestor of descendantSha (or equal).
 * Apply guards must NOT accept ancestors — exported for negative tests only.
 * @param {string} ancestorSha
 * @param {string} descendantSha
 * @param {string} repoRoot
 */
export function isPmId01GitAncestor(ancestorSha, descendantSha, repoRoot) {
  const a = String(ancestorSha || "").trim();
  const d = String(descendantSha || "").trim();
  if (!isPmId01FullGitSha(a) || !isPmId01FullGitSha(d)) return false;
  if (a.toLowerCase() === d.toLowerCase()) return true;
  try {
    execSync(`git merge-base --is-ancestor ${a} ${d}`, {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} [repoRoot]
 * @returns {object}
 */
export function loadPmId01MigrationManifest(repoRoot) {
  const root = repoRoot || getPmId01RepoRoot();
  const manifestPath = path.join(root, PM_ID_01_MANIFEST_RELATIVE_PATH);
  if (!existsSync(manifestPath)) {
    throw new Error(`PM-ID-01 migration manifest missing: ${manifestPath}`);
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/**
 * @param {{ repoRoot?: string, manifest?: object }} [options]
 */
export function verifyPmId01MigrationManifest(options = {}) {
  const repoRoot = options.repoRoot || getPmId01RepoRoot();
  const manifest =
    options.manifest || loadPmId01MigrationManifest(repoRoot);
  /** @type {string[]} */
  const errors = [];

  if (!manifest || !Array.isArray(manifest.migrations)) {
    return { ok: false, errors: ["Manifest migrations array missing."] };
  }
  if (manifest.environmentTarget !== "staging") {
    errors.push(
      `Manifest environmentTarget must be staging (got ${manifest.environmentTarget}).`
    );
  }
  if (manifest.stagingProjectRef !== PM_ID_01_STAGING_PROJECT_REF) {
    errors.push("Manifest stagingProjectRef mismatch.");
  }
  if (manifest.productionApplyApproved !== false) {
    errors.push("Manifest productionApplyApproved must be false.");
  }
  if (manifest.executeSql !== false) {
    errors.push("Manifest executeSql must be false (author-only pin).");
  }
  if (manifest.automaticRollback !== false) {
    errors.push("Manifest automaticRollback must be false.");
  }
  if (manifest.backfillIncluded !== false) {
    errors.push("Manifest backfillIncluded must be false.");
  }
  if (manifest.mappingRowsCreated !== false && manifest.mappingRowsCreated !== 0) {
    errors.push("Manifest must not authorize mapping row creation.");
  }
  if (manifest.hashAlgorithm !== PM_ID_01_MANIFEST_HASH_ALGORITHM) {
    errors.push(
      `Manifest hashAlgorithm must be ${PM_ID_01_MANIFEST_HASH_ALGORITHM}.`
    );
  }

  /** @type {Map<string, object>} */
  const byPath = new Map();
  for (const entry of manifest.migrations) {
    const rel = String(entry.path || "").replace(/\\/g, "/");
    if (!rel) {
      errors.push("Migration entry missing path.");
      continue;
    }
    if (byPath.has(rel)) errors.push(`Duplicate migration entry: ${rel}`);
    byPath.set(rel, entry);

    const abs = path.join(repoRoot, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      errors.push(`Missing migration file: ${rel}`);
      continue;
    }
    const actual = sha256File(abs);
    const expected = String(entry.sha256 || "").toLowerCase();
    if (actual !== expected) {
      errors.push(
        `SHA-256 mismatch for ${rel}: expected ${expected}, actual ${actual}`
      );
    }
  }

  const forward = [...manifest.migrations]
    .filter((m) => m.classification === "forward")
    .sort((a, b) => Number(a.order) - Number(b.order));

  if (forward.length !== PM_ID_01_FORWARD_SQL_ORDER.length) {
    errors.push(
      `Forward migration count must be ${PM_ID_01_FORWARD_SQL_ORDER.length} (got ${forward.length}).`
    );
  }
  for (let i = 0; i < PM_ID_01_FORWARD_SQL_ORDER.length; i += 1) {
    const expectedPath = PM_ID_01_FORWARD_SQL_ORDER[i];
    const entry = forward[i];
    if (!entry || String(entry.path).replace(/\\/g, "/") !== expectedPath) {
      errors.push(
        `Forward order mismatch at index ${i}: expected ${expectedPath}`
      );
    }
  }

  const rollback = manifest.migrations.find(
    (m) => m.classification === "rollback"
  );
  if (!rollback) errors.push("Rollback migration entry missing.");
  else {
    if (String(rollback.path).replace(/\\/g, "/") !== PM_ID_01_ROLLBACK_SQL_PATH) {
      errors.push("Rollback path mismatch.");
    }
    if (rollback.autoExecute !== false) {
      errors.push("Rollback must have autoExecute=false.");
    }
    if (forward.some((f) => f.path === rollback.path)) {
      errors.push("Rollback must not appear in forward classification.");
    }
  }

  const verification = manifest.migrations.find(
    (m) => m.classification === "verification"
  );
  if (!verification) errors.push("Verification migration entry missing.");
  else if (
    String(verification.path).replace(/\\/g, "/") !==
    PM_ID_01_VERIFICATION_SQL_PATH
  ) {
    errors.push("Verification path mismatch.");
  }

  const forwardAgg = aggregateSha256ForEntries(forward);
  if (
    String(manifest.aggregateSha256Forward || "").toLowerCase() !== forwardAgg
  ) {
    errors.push(
      `aggregateSha256Forward mismatch: expected ${forwardAgg}, got ${manifest.aggregateSha256Forward}`
    );
  }

  const combined = aggregateSha256ForEntries(manifest.migrations);
  if (
    String(manifest.combinedManifestHash || "").toLowerCase() !== combined
  ) {
    errors.push(
      `combinedManifestHash mismatch: expected ${combined}, got ${manifest.combinedManifestHash}`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    checked: manifest.migrations.length,
    aggregateSha256Forward: forwardAgg,
    combinedManifestHash: combined,
  };
}

/**
 * @param {string} [repoRoot]
 */
export function loadPmId01ApprovalTemplateDefaults(repoRoot) {
  const root = repoRoot || getPmId01RepoRoot();
  const p = path.join(root, PM_ID_01_APPROVAL_TEMPLATE_RELATIVE_PATH);
  if (!existsSync(p)) {
    return { ok: false, errors: [`Missing approval template: ${p}`] };
  }
  const defaults = JSON.parse(readFileSync(p, "utf8"));
  /** @type {string[]} */
  const errors = [];
  if (defaults.approved !== false) errors.push("template.approved must be false");
  if (defaults.productionAllowed !== false) {
    errors.push("template.productionAllowed must be false");
  }
  if (defaults.goToken !== PM_ID_01_OWNER_GO_TOKEN) {
    errors.push("template.goToken mismatch");
  }
  if (defaults.stagingProjectRef !== PM_ID_01_STAGING_PROJECT_REF) {
    errors.push("template.stagingProjectRef mismatch");
  }
  return { ok: errors.length === 0, errors, defaults };
}

/**
 * @param {string} [repoRoot]
 */
export function loadPmId01OwnerApprovalEvidence(repoRoot) {
  const root = repoRoot || getPmId01RepoRoot();
  const p = path.join(root, PM_ID_01_APPROVAL_EVIDENCE_RELATIVE_PATH);
  if (!existsSync(p)) {
    return {
      ok: false,
      errors: [
        "Owner approval evidence file missing (OWNER_STAGING_APPLY_APPROVAL.json).",
      ],
      approval: null,
      path: PM_ID_01_APPROVAL_EVIDENCE_RELATIVE_PATH,
    };
  }
  const json = JSON.parse(readFileSync(p, "utf8"));
  /** @type {string[]} */
  const errors = [];
  if (json.approved !== true) errors.push("approval.approved must be true");
  if (json.productionAllowed !== false) {
    errors.push("approval.productionAllowed must be false");
  }
  const token = String(json.ownerGoToken || json.goToken || "").trim();
  if (token !== PM_ID_01_OWNER_GO_TOKEN) {
    errors.push("approval goToken mismatch");
  }
  if (json.stagingProjectRef !== PM_ID_01_STAGING_PROJECT_REF) {
    errors.push("approval stagingProjectRef mismatch");
  }
  if (json.backfillApproved === true) {
    errors.push("approval must not authorize backfill");
  }
  if (json.mappingRowsCreationApproved === true) {
    errors.push("approval must not authorize mapping row creation");
  }
  if (json.coachingChangesApproved === true) {
    errors.push("approval must not authorize Coaching changes");
  }
  return {
    ok: errors.length === 0,
    errors,
    approval: json,
    path: PM_ID_01_APPROVAL_EVIDENCE_RELATIVE_PATH,
  };
}

/**
 * Extract project ref from common Supabase URL env vars.
 * @param {NodeJS.ProcessEnv|Record<string,string|undefined>} env
 */
export function inspectPmId01EnvironmentIdentity(env = process.env) {
  /** @type {string[]} */
  const errors = [];
  const urls = [
    env[PM_ID_01_ENV_NAMES.STAGING_SUPABASE_URL],
    env[PM_ID_01_ENV_NAMES.VITE_SUPABASE_URL],
    env[PM_ID_01_ENV_NAMES.SUPABASE_URL],
  ].filter(Boolean);
  /** @type {string|null} */
  let resolvedProjectRef = null;
  for (const raw of urls) {
    const m = String(raw).match(
      /https?:\/\/([a-z0-9]+)\.supabase\.co/i
    );
    if (m) {
      resolvedProjectRef = m[1].toLowerCase();
      break;
    }
  }
  if (
    resolvedProjectRef &&
    PM_ID_01_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(resolvedProjectRef)
  ) {
    errors.push("Production project ref detected in environment URL.");
  }
  return { ok: errors.length === 0, errors, resolvedProjectRef };
}

/**
 * Evaluate whether controlled apply may execute. Defaults to refuse.
 * Refuses before any database connection when blockers exist.
 *
 * @param {object} input
 */
export function evaluatePmId01ApplyGuards(input = {}) {
  const repoRoot = input.repoRoot || getPmId01RepoRoot();
  const env = input.env || process.env;
  /** @type {string[]} */
  const blockers = [];
  /** @type {string[]} */
  const commitMismatchReasons = [];

  const execute = input.execute === true;
  if (!execute) {
    blockers.push("Missing explicit --execute (default APPLY_MODE=REFUSED).");
  }

  const environment = String(input.environment || "")
    .trim()
    .toLowerCase();
  if (environment !== PM_ID_01_ENVIRONMENT_LABEL) {
    blockers.push(
      `Environment must equal staging (got ${environment || "(empty)"}).`
    );
  }

  const projectRef = String(
    input.projectRef || env[PM_ID_01_ENV_NAMES.TARGET_CONFIRM] || ""
  ).trim();
  if (projectRef !== PM_ID_01_STAGING_PROJECT_REF) {
    blockers.push(
      `Exact Staging project ref required (got ${projectRef || "(empty)"}).`
    );
  }
  if (PM_ID_01_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(projectRef)) {
    blockers.push("Production project ref is blocked.");
  }

  const actualGitHead = String(
    input.actualGitHead != null
      ? input.actualGitHead
      : getPmId01HeadSha(repoRoot)
  ).trim();
  const expectedCommit = String(
    input.expectedCommit || env[PM_ID_01_ENV_NAMES.EXPECTED_COMMIT] || ""
  ).trim();
  const ownerApprovedCommit = String(
    input.ownerApprovedCommit ||
      env[PM_ID_01_ENV_NAMES.APPROVED_COMMIT] ||
      ""
  ).trim();

  // Commit equality is enforced whenever execute is requested, or when commit
  // arguments are explicitly supplied (negative tests / partial CLI).
  const enforceCommit =
    execute || Boolean(expectedCommit) || Boolean(ownerApprovedCommit);

  if (enforceCommit) {
    if (looksLikePmId01BranchName(expectedCommit)) {
      commitMismatchReasons.push(
        `CLI expected commit must not be a branch name (got ${expectedCommit}).`
      );
    } else if (!isPmId01FullGitSha(expectedCommit)) {
      commitMismatchReasons.push(
        `CLI/env expected commit must be full 40-char SHA (got ${expectedCommit ? expectedCommit.slice(0, 12) : "(empty)"}).`
      );
    }

    if (!isPmId01FullGitSha(actualGitHead)) {
      commitMismatchReasons.push(
        `actualGitHead must be full 40-char SHA (got ${actualGitHead ? actualGitHead.slice(0, 12) : "(empty)"}).`
      );
    }

    if (
      isPmId01FullGitSha(expectedCommit) &&
      isPmId01FullGitSha(actualGitHead) &&
      expectedCommit.toLowerCase() !== actualGitHead.toLowerCase()
    ) {
      commitMismatchReasons.push(
        `CLI expected commit must equal actual git HEAD (head=${actualGitHead.slice(0, 12)}, expected=${expectedCommit.slice(0, 12)}).`
      );
    }

    // Owner-approved commit must equal current HEAD exactly (no ancestor shortcut).
    if (ownerApprovedCommit) {
      if (looksLikePmId01BranchName(ownerApprovedCommit)) {
        commitMismatchReasons.push(
          "Owner-approved commit must not be a branch name."
        );
      } else if (!isPmId01FullGitSha(ownerApprovedCommit)) {
        commitMismatchReasons.push(
          `Owner-approved commit must be full 40-char SHA (got ${ownerApprovedCommit.slice(0, 12)}).`
        );
      } else if (
        isPmId01FullGitSha(actualGitHead) &&
        ownerApprovedCommit.toLowerCase() !== actualGitHead.toLowerCase()
      ) {
        const ancestorOnly =
          input.allowAncestorCheck !== false &&
          isPmId01GitAncestor(ownerApprovedCommit, actualGitHead, repoRoot);
        commitMismatchReasons.push(
          ancestorOnly
            ? `Owner-approved commit is ancestor-only of HEAD — exact equality required (approval=${ownerApprovedCommit.slice(0, 12)}, head=${actualGitHead.slice(0, 12)}).`
            : `Owner-approved commit must equal actual git HEAD (approval=${ownerApprovedCommit.slice(0, 12)}, head=${actualGitHead.slice(0, 12)}).`
        );
      }
    } else if (execute) {
      commitMismatchReasons.push(
        "Owner-approved commit (full 40-char SHA) is required and must equal HEAD."
      );
    }
  }

  const requireClean = input.requireCleanWorktree !== false;
  if (requireClean) {
    const tree =
      typeof input.worktreeCleanOverride === "boolean"
        ? { ok: input.worktreeCleanOverride }
        : evaluatePmId01WorktreeClean(repoRoot);
    if (!tree.ok) blockers.push("Working tree must be clean.");
  }

  if (input.preflightPass !== true) {
    blockers.push("Successful preflight PASS report required.");
  }

  const manifest = verifyPmId01MigrationManifest({
    repoRoot,
    manifest: input.manifest,
  });
  if (!manifest.ok) {
    blockers.push(
      `SQL checksum/manifest verification failed: ${(manifest.errors || []).join("; ")}`
    );
  }

  const ownerGoToken = String(
    input.ownerGoToken || env[PM_ID_01_ENV_NAMES.OWNER_GO] || ""
  ).trim();
  const ownerGoGranted = ownerGoToken === PM_ID_01_OWNER_GO_TOKEN;
  if (!ownerGoGranted) {
    blockers.push(
      `Explicit approval token ${PM_ID_01_OWNER_GO_TOKEN} required.`
    );
  }

  if (input.productionAllowed === true) {
    blockers.push("productionAllowed must remain false.");
  }

  /** @type {object|null} */
  let approvalEvidence = null;
  const requireApproval = input.requireApprovalEvidence === true;
  if (requireApproval) {
    const loaded =
      input.approvalOverride != null
        ? {
            ok: true,
            errors: [],
            approval: input.approvalOverride,
            path: PM_ID_01_APPROVAL_EVIDENCE_RELATIVE_PATH,
          }
        : loadPmId01OwnerApprovalEvidence(repoRoot);
    approvalEvidence = loaded;
    if (!loaded.ok) {
      blockers.push(...(loaded.errors || ["Owner approval evidence invalid."]));
    } else {
      const a = loaded.approval;
      const approvedCommit = String(a.expectedGitCommit || "").trim();
      if (!isPmId01FullGitSha(approvedCommit)) {
        commitMismatchReasons.push(
          `Approval expectedGitCommit must be full 40-char SHA (got ${approvedCommit ? approvedCommit.slice(0, 12) : "(empty)"}).`
        );
      } else {
        if (approvedCommit.toLowerCase() !== actualGitHead.toLowerCase()) {
          commitMismatchReasons.push(
            `Approval expectedGitCommit must equal actual git HEAD (approval=${approvedCommit.slice(0, 12)}, head=${actualGitHead.slice(0, 12)}). Descendants/ancestors are refused.`
          );
        }
        if (
          isPmId01FullGitSha(expectedCommit) &&
          approvedCommit.toLowerCase() !== expectedCommit.toLowerCase()
        ) {
          commitMismatchReasons.push(
            `Approval expectedGitCommit must equal CLI expected commit.`
          );
        }
      }
      if (String(a.ownerGoToken || a.goToken || "").trim() !== ownerGoToken) {
        blockers.push("Approval token does not match CLI/env Owner GO token.");
      }
    }
  }

  if (commitMismatchReasons.length > 0) {
    blockers.push(...commitMismatchReasons);
  }

  const identity = inspectPmId01EnvironmentIdentity(env);
  if (!identity.ok) blockers.push(...identity.errors);

  const canWrite = blockers.length === 0;
  const commitMismatch = commitMismatchReasons.length > 0;

  let verdict = PM_ID_01_VERDICTS.APPLY_REFUSED;
  if (canWrite) {
    verdict = "PM_ID_01_APPLY_GUARDS_PASS";
  } else if (!ownerGoGranted) {
    verdict = PM_ID_01_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED;
  } else if (commitMismatch) {
    verdict = PM_ID_01_VERDICTS.EXECUTION_COMMIT_MISMATCH_REFUSED;
  }

  return {
    canWrite,
    applyMode: canWrite ? "EXECUTE_ALLOWED" : "REFUSED",
    verdict,
    blockers,
    commitMismatchReasons,
    stagingProjectRef: PM_ID_01_STAGING_PROJECT_REF,
    headSha: actualGitHead,
    actualGitHead,
    ownerGoGranted,
    ownerGoRequired: PM_ID_01_OWNER_GO_TOKEN,
    approvalEvidenceOk: approvalEvidence ? approvalEvidence.ok : null,
    databaseConnectionOpened: false,
    databaseWrites: 0,
    sqlApplied: false,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    roleGrantsApplied: false,
    productionTouched: false,
    filesDeleted: false,
    CODEX_DELETE_ALLOWED: "NO",
    automaticRollback: false,
    secretsPrinted: false,
    sqlWouldApply: canWrite,
  };
}

/**
 * Static audit helpers for canonical SQL package (read-only).
 * @param {string} repoRoot
 */
export function auditPmId01CanonicalSqlPackage(repoRoot) {
  const root = repoRoot || getPmId01RepoRoot();
  /** @type {string[]} */
  const findings = [];
  /** @type {string[]} */
  const defects = [];

  const forwardTexts = PM_ID_01_FORWARD_SQL_ORDER.map((rel) => ({
    rel,
    text: readFileSync(path.join(root, rel), "utf8"),
  }));

  for (const { rel, text } of forwardTexts) {
    if (/auth\.uid\(\)\s*=\s*player_id|player_id\s*=\s*auth\.uid\(\)/i.test(text)) {
      defects.push(`${rel}: implicit auth.uid() = player_id`);
    }
    if (/\bBACKFILL\b/i.test(text) && /INSERT\s+INTO\s+public\.player_identity_links/i.test(text)) {
      // Management RPC may INSERT via admin path — only flag dedicated backfill scripts.
      if (/backfill/i.test(rel)) {
        defects.push(`${rel}: backfill INSERT in forward package`);
      }
    }
  }

  const tableSql = forwardTexts.find((f) => f.rel.includes("10_"))?.text || "";
  if (!/CREATE TABLE IF NOT EXISTS public\.player_identity_links/i.test(tableSql)) {
    defects.push("Mapping table DDL missing");
  }

  const helpers =
    forwardTexts.find((f) => f.rel.includes("30_"))?.text || "";
  if (!/v_uid uuid := auth\.uid\(\)/.test(helpers)) {
    defects.push("Resolve helper must bind principal from auth.uid()");
  }
  if (/p_principal|p_player_id|p_auth_user/i.test(helpers.split("AS $$")[0] || "")) {
    defects.push("Resolve helper must not accept caller principal/player args");
  }

  const rls = forwardTexts.find((f) => f.rel.includes("50_"))?.text || "";
  if (!/ENABLE ROW LEVEL SECURITY/i.test(rls) || !/FORCE ROW LEVEL SECURITY/i.test(rls)) {
    defects.push("RLS enable+force missing");
  }
  if (!/REVOKE ALL[\s\S]*FROM PUBLIC/i.test(rls) || !/FROM anon/i.test(rls)) {
    defects.push("PUBLIC/anon revoke missing");
  }

  for (const { rel, text } of forwardTexts) {
    if (
      /SET search_path = pg_catalog, public/.test(text) ||
      !/CREATE OR REPLACE FUNCTION/i.test(text)
    ) {
      // ok — either fixed path present or no functions
    } else if (/CREATE OR REPLACE FUNCTION/i.test(text)) {
      const defs = text.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/gi) || [];
      for (const d of defs) {
        if (!/SET search_path = pg_catalog, public/.test(d)) {
          defects.push(`${rel}: function missing fixed search_path`);
        }
      }
    }
  }

  const backfillDoc = path.join(
    root,
    PM_ID_01_PACK_DIR,
    "04_PM_ID_01_BACKFILL_AND_AMBIGUITY_POLICY.md"
  );
  if (existsSync(backfillDoc)) {
    findings.push("Backfill policy is documentation-only (not in forward SQL).");
  }

  return {
    ok: defects.length === 0,
    defects,
    findings,
    forwardOrder: [...PM_ID_01_FORWARD_SQL_ORDER],
    rollbackExcludedFromForward: true,
    productionTargetReferenced: false,
  };
}

/**
 * Catalog read-only preflight SQL (BEGIN READ ONLY … ROLLBACK).
 */
export function buildPmId01ActivationReadOnlyPreflightSql() {
  return `
BEGIN TRANSACTION READ ONLY;
SET search_path = public, pg_temp;

SELECT version() AS pg_version;

SELECT
  current_database() AS database_name,
  current_user AS current_user_name,
  current_setting('transaction_read_only', true) AS transaction_read_only;

SELECT
  to_regclass('public.profiles') IS NOT NULL AS profiles_present,
  to_regclass('public.club_members') IS NOT NULL AS club_members_present,
  to_regclass('public.clubs') IS NOT NULL AS clubs_present,
  to_regclass('public.venues') IS NOT NULL AS venues_present,
  to_regclass('public.athletes') IS NOT NULL AS athletes_present,
  to_regclass('public.player_identity_links') IS NOT NULL AS player_identity_links_present,
  to_regclass('public.permissions') IS NOT NULL AS permissions_present;

SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS data_type,
  a.attnotnull AS not_null
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN ('id', 'player_id', 'status', 'venue_id', 'club_id')
ORDER BY a.attname;

SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'club_members'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN ('user_id', 'club_id', 'status', 'tenant_id')
ORDER BY a.attname;

SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'clubs'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN ('id', 'tenant_id')
ORDER BY a.attname;

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE 'player_identity_%'
    OR p.proname IN (
      'team_tournament_user_player_id',
      'user_venue_id',
      'user_club_id',
      'user_has_permission',
      'is_super_admin',
      'coaching_04_mapped_player_id'
    )
  )
ORDER BY p.proname, identity_args;

SELECT
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND (
    c.relname = 'player_identity_links'
    OR c.relname LIKE 'player_identity_%'
  )
ORDER BY c.relname;

SELECT
  e.extname AS extension_name
FROM pg_extension e
WHERE e.extname IN ('pgcrypto', 'uuid-ossp')
ORDER BY e.extname;

SELECT
  CASE
    WHEN to_regclass('public.permissions') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.permissions
      WHERE id = 'player.identity_link.manage'
         OR id LIKE 'player.identity_link.%'
    )
  END AS player_identity_link_permission_count;

ROLLBACK;
`.trim();
}
