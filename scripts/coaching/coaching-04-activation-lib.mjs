/**
 * COACHING-04 — Guarded Staging activation library.
 * Authoring + guard evaluation only. Does not open DB connections by itself.
 * CODEX_DELETE_ALLOWED=NO.
 *
 * Owner GO token is NOT granted in this package step.
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COACHING_04_STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";
export const COACHING_04_STAGING_PROJECT_REF_ALLOWLIST = Object.freeze([
  COACHING_04_STAGING_PROJECT_REF,
]);
export const COACHING_04_PRODUCTION_PROJECT_REF_BLOCKLIST = Object.freeze([
  "expuvcohlcjzvrrauvud",
]);
export const COACHING_04_ENVIRONMENT_LABEL = "staging";
export const COACHING_04_OWNER_GO_TOKEN = "COACHING_04_OWNER_GO_APPLY_STAGING";
export const COACHING_04_MANIFEST_HASH_ALGORITHM = "sha256-lf-normalized";

export const COACHING_04_PACK_DIR = "docs/coaching-training/coaching-04";
export const COACHING_04_ACTIVATION_DIR =
  "docs/coaching-training/coaching-04/activation";
export const COACHING_04_MANIFEST_RELATIVE_PATH =
  "docs/coaching-training/coaching-04/sql-migration-manifest.json";
export const COACHING_04_EVIDENCE_DIR =
  "docs/coaching-training/coaching-04/evidence";
export const COACHING_04_APPROVAL_TEMPLATE_RELATIVE_PATH =
  "docs/coaching-training/coaching-04/activation/OWNER_STAGING_APPLY_APPROVAL.template.json";
export const COACHING_04_APPROVAL_EVIDENCE_RELATIVE_PATH =
  "docs/coaching-training/coaching-04/activation/OWNER_STAGING_APPLY_APPROVAL.json";

/** Exact forward SQL execution order (rollback 90 excluded). */
export const COACHING_04_FORWARD_SQL_ORDER = Object.freeze([
  "docs/coaching-training/coaching-04/10_COACHING_04_ASSIGNMENT_HELPERS.sql",
  "docs/coaching-training/coaching-04/11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql",
  "docs/coaching-training/coaching-04/20_COACHING_04_ASSIGNMENT_RLS.sql",
  "docs/coaching-training/coaching-04/21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql",
  "docs/coaching-training/coaching-04/30_COACHING_04_SCOPED_RPCS.sql",
  "docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql",
]);

export const COACHING_04_VERIFICATION_SQL_PATH =
  "docs/coaching-training/coaching-04/99_COACHING_04_VERIFICATION.sql";

export const COACHING_04_ROLLBACK_SQL_PATH =
  "docs/coaching-training/coaching-04/90_COACHING_04_ROLLBACK.sql";

/** Apply plan order: forward then verification. Rollback never auto. */
export const COACHING_04_APPLY_EXECUTION_ORDER = Object.freeze([
  ...COACHING_04_FORWARD_SQL_ORDER,
  COACHING_04_VERIFICATION_SQL_PATH,
]);

export const COACHING_04_PINNED_AGGREGATE_SHA256_FORWARD =
  "662e70fbb3c76785d7910492284224df6bd04fa6a0ef358231f2ddccbc3386d4";
export const COACHING_04_PINNED_COMBINED_MANIFEST_HASH =
  "16cdb19ff57b0e0460610e8a341ca8f2786ff19a067839a80996866f61111eaa";

/** Proposed function names that must not already collide on Staging before apply. */
export const COACHING_04_PROPOSED_FUNCTION_NAMES = Object.freeze([
  "coaching_04_actor_uid",
  "coaching_04_active_coach_reference_id",
  "coaching_04_coach_assigned_to_player",
  "coaching_04_coach_owns_session",
  "coaching_04_coach_can_access_enrollment",
  "coaching_04_coach_can_access_program",
  "coaching_04_has_assigned_action",
  "coaching_04_mapped_player_id",
  "coaching_04_player_is_self",
  "coaching_04_player_identity_is_mapped",
  "coaching_04_has_self_action",
  "coaching_04_player_can_access_enrollment",
  "coaching_04_record_assigned_attendance",
  "coaching_04_submit_assigned_evaluation",
  "coaching_04_consume_assigned_entitlement",
]);

export const COACHING_04_VERDICTS = Object.freeze({
  APPLY_REFUSED: "COACHING_04_APPLY_REFUSED",
  APPLY_REFUSED_OWNER_GO_NOT_GRANTED:
    "COACHING_04_APPLY_REFUSED_OWNER_GO_NOT_GRANTED",
  APPLY_BLOCKED: "COACHING_04_STAGING_APPLY_BLOCKED",
  EXECUTION_COMMIT_MISMATCH_REFUSED:
    "COACHING_04_EXECUTION_COMMIT_MISMATCH_REFUSED",
  MANIFEST_HASH_MISMATCH_REFUSED:
    "COACHING_04_MANIFEST_HASH_MISMATCH_REFUSED",
  SQL_HASH_MISMATCH_REFUSED: "COACHING_04_SQL_HASH_MISMATCH_REFUSED",
  ORDER_MISMATCH_REFUSED: "COACHING_04_SQL_ORDER_MISMATCH_REFUSED",
  WRONG_TARGET_REFUSED: "COACHING_04_WRONG_TARGET_REFUSED",
  PRODUCTION_TARGET_REFUSED: "COACHING_04_PRODUCTION_TARGET_REFUSED",
  DIRTY_WORKTREE_REFUSED: "COACHING_04_DIRTY_WORKTREE_REFUSED",
  MISSING_CREDENTIALS_REFUSED: "COACHING_04_MISSING_CREDENTIALS_REFUSED",
  PREFLIGHT_PASS: "COACHING_04_ACTIVATION_REMOTE_READ_ONLY_PREFLIGHT_PASS",
  PREFLIGHT_OFFLINE_PASS:
    "COACHING_04_ACTIVATION_REMOTE_READ_ONLY_PREFLIGHT_OFFLINE_PASS",
  PREFLIGHT_FAIL: "COACHING_04_ACTIVATION_REMOTE_READ_ONLY_PREFLIGHT_FAIL",
  PREFLIGHT_BLOCKED:
    "COACHING_04_ACTIVATION_REMOTE_READ_ONLY_PREFLIGHT_BLOCKED",
  STAGING_ACTIVATION_PR_OPEN_CI_PENDING_NO_GO:
    "COACHING_04_STAGING_ACTIVATION_PR_OPEN_CI_PENDING_NO_GO",
  STAGING_ACTIVATION_PR_OPEN_CI_GREEN_NO_GO:
    "COACHING_04_STAGING_ACTIVATION_PR_OPEN_CI_GREEN_NO_GO",
});

export const COACHING_04_ENV_NAMES = Object.freeze({
  OWNER_GO: "COACHING_04_OWNER_GO",
  TARGET_CONFIRM: "COACHING_04_STAGING_TARGET_CONFIRM",
  EXPECTED_COMMIT: "COACHING_04_EXPECTED_COMMIT",
  APPROVED_COMMIT: "COACHING_04_OWNER_APPROVED_COMMIT",
  EXPECTED_MANIFEST_HASH: "COACHING_04_EXPECTED_MANIFEST_HASH",
  EXPECTED_AGGREGATE_SQL_HASH: "COACHING_04_EXPECTED_AGGREGATE_SQL_HASH",
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
export function getCoaching04RepoRoot(fromUrl) {
  const here = path.dirname(fileURLToPath(fromUrl || import.meta.url));
  return path.resolve(here, "../..");
}

/**
 * @param {string|Buffer|Uint8Array} input
 * @returns {string}
 */
export function canonicalizeCoaching04MigrationText(input) {
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
  const canonical = canonicalizeCoaching04MigrationText(input);
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
export function isCoaching04FullGitSha(value) {
  return FULL_SHA_RE.test(String(value || "").trim());
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function looksLikeCoaching04BranchName(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  if (isCoaching04FullGitSha(v)) return false;
  if (/^[0-9a-f]{7,39}$/i.test(v)) return false;
  return BRANCH_LIKE_RE.test(v) || /[\s\/]/.test(v) || !/^[0-9a-f]+$/i.test(v);
}

/**
 * @param {string} repoRoot
 * @returns {string}
 */
export function getCoaching04HeadSha(repoRoot) {
  return execSync("git rev-parse HEAD", {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

/**
 * @param {string} repoRoot
 * @returns {{ ok: boolean, porcelain?: string }}
 */
export function evaluateCoaching04WorktreeClean(repoRoot) {
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
export function isCoaching04GitAncestor(ancestorSha, descendantSha, repoRoot) {
  const a = String(ancestorSha || "").trim();
  const d = String(descendantSha || "").trim();
  if (!isCoaching04FullGitSha(a) || !isCoaching04FullGitSha(d)) return false;
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
export function loadCoaching04MigrationManifest(repoRoot) {
  const root = repoRoot || getCoaching04RepoRoot();
  const manifestPath = path.join(root, COACHING_04_MANIFEST_RELATIVE_PATH);
  if (!existsSync(manifestPath)) {
    throw new Error(`COACHING-04 migration manifest missing: ${manifestPath}`);
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/**
 * @param {{ repoRoot?: string, manifest?: object }} [options]
 */
export function verifyCoaching04MigrationManifest(options = {}) {
  const repoRoot = options.repoRoot || getCoaching04RepoRoot();
  const manifest =
    options.manifest || loadCoaching04MigrationManifest(repoRoot);
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
  if (manifest.stagingProjectRef !== COACHING_04_STAGING_PROJECT_REF) {
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
  if (manifest.durableRuntimeDefault !== false) {
    errors.push("Manifest durableRuntimeDefault must be false.");
  }
  if (manifest.localStorageRetired !== false) {
    errors.push("Manifest localStorageRetired must be false.");
  }
  if (manifest.hashAlgorithm !== COACHING_04_MANIFEST_HASH_ALGORITHM) {
    errors.push(
      `Manifest hashAlgorithm must be ${COACHING_04_MANIFEST_HASH_ALGORITHM}.`
    );
  }
  if (manifest.ownerGoTokenRequired !== COACHING_04_OWNER_GO_TOKEN) {
    errors.push("Manifest ownerGoTokenRequired mismatch.");
  }

  const forwardOrderPinned = Array.isArray(manifest.forwardExecutionOrder)
    ? manifest.forwardExecutionOrder.map((p) => String(p).replace(/\\/g, "/"))
    : [];
  if (forwardOrderPinned.length !== COACHING_04_FORWARD_SQL_ORDER.length) {
    errors.push(
      `Manifest forwardExecutionOrder length mismatch (got ${forwardOrderPinned.length}).`
    );
  }
  for (let i = 0; i < COACHING_04_FORWARD_SQL_ORDER.length; i += 1) {
    if (forwardOrderPinned[i] !== COACHING_04_FORWARD_SQL_ORDER[i]) {
      errors.push(
        `Manifest forwardExecutionOrder mismatch at index ${i}: expected ${COACHING_04_FORWARD_SQL_ORDER[i]}`
      );
    }
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

  if (forward.length !== COACHING_04_FORWARD_SQL_ORDER.length) {
    errors.push(
      `Forward migration count must be ${COACHING_04_FORWARD_SQL_ORDER.length} (got ${forward.length}).`
    );
  }
  const expectedOrders = [10, 11, 20, 21, 30, 40];
  for (let i = 0; i < COACHING_04_FORWARD_SQL_ORDER.length; i += 1) {
    const expectedPath = COACHING_04_FORWARD_SQL_ORDER[i];
    const entry = forward[i];
    if (!entry || String(entry.path).replace(/\\/g, "/") !== expectedPath) {
      errors.push(
        `Forward order mismatch at index ${i}: expected ${expectedPath}`
      );
    } else if (Number(entry.order) !== expectedOrders[i]) {
      errors.push(
        `Forward numeric order mismatch at index ${i}: expected ${expectedOrders[i]}, got ${entry.order}`
      );
    }
  }

  const rollback = manifest.migrations.find(
    (m) => m.classification === "rollback"
  );
  if (!rollback) errors.push("Rollback migration entry missing.");
  else {
    if (String(rollback.path).replace(/\\/g, "/") !== COACHING_04_ROLLBACK_SQL_PATH) {
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
    COACHING_04_VERIFICATION_SQL_PATH
  ) {
    errors.push("Verification path mismatch.");
  }

  if (
    COACHING_04_APPLY_EXECUTION_ORDER.includes(COACHING_04_ROLLBACK_SQL_PATH)
  ) {
    errors.push("Rollback must never appear in apply execution order.");
  }

  const forwardAgg = aggregateSha256ForEntries(forward);
  if (
    String(manifest.aggregateSha256Forward || "").toLowerCase() !== forwardAgg
  ) {
    errors.push(
      `aggregateSha256Forward mismatch: expected ${forwardAgg}, got ${manifest.aggregateSha256Forward}`
    );
  }
  if (forwardAgg !== COACHING_04_PINNED_AGGREGATE_SHA256_FORWARD) {
    errors.push(
      `Pinned aggregate forward hash drift: library=${COACHING_04_PINNED_AGGREGATE_SHA256_FORWARD} computed=${forwardAgg}`
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
  if (combined !== COACHING_04_PINNED_COMBINED_MANIFEST_HASH) {
    errors.push(
      `Pinned combined manifest hash drift: library=${COACHING_04_PINNED_COMBINED_MANIFEST_HASH} computed=${combined}`
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
export function loadCoaching04ApprovalTemplateDefaults(repoRoot) {
  const root = repoRoot || getCoaching04RepoRoot();
  const p = path.join(root, COACHING_04_APPROVAL_TEMPLATE_RELATIVE_PATH);
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
  if (defaults.goToken !== COACHING_04_OWNER_GO_TOKEN) {
    errors.push("template.goToken mismatch");
  }
  if (defaults.stagingProjectRef !== COACHING_04_STAGING_PROJECT_REF) {
    errors.push("template.stagingProjectRef mismatch");
  }
  if (defaults.durableRuntimeActivationApproved === true) {
    errors.push("template must not authorize durable runtime activation");
  }
  if (defaults.localStorageRetirementApproved === true) {
    errors.push("template must not authorize localStorage retirement");
  }
  if (defaults.mappingRowsCreationApproved === true) {
    errors.push("template must not authorize mapping row creation");
  }
  if (defaults.backfillApproved === true) {
    errors.push("template must not authorize backfill");
  }
  return { ok: errors.length === 0, errors, defaults };
}

/**
 * @param {string} [repoRoot]
 */
export function loadCoaching04OwnerApprovalEvidence(repoRoot) {
  const root = repoRoot || getCoaching04RepoRoot();
  const p = path.join(root, COACHING_04_APPROVAL_EVIDENCE_RELATIVE_PATH);
  if (!existsSync(p)) {
    return {
      ok: false,
      errors: [
        "Owner approval evidence file missing (OWNER_STAGING_APPLY_APPROVAL.json).",
      ],
      approval: null,
      path: COACHING_04_APPROVAL_EVIDENCE_RELATIVE_PATH,
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
  if (token !== COACHING_04_OWNER_GO_TOKEN) {
    errors.push("approval goToken mismatch");
  }
  if (json.stagingProjectRef !== COACHING_04_STAGING_PROJECT_REF) {
    errors.push("approval stagingProjectRef mismatch");
  }
  if (json.backfillApproved === true) {
    errors.push("approval must not authorize backfill");
  }
  if (json.mappingRowsCreationApproved === true) {
    errors.push("approval must not authorize mapping row creation");
  }
  if (json.durableRuntimeActivationApproved === true) {
    errors.push("approval must not authorize durable runtime activation");
  }
  if (json.localStorageRetirementApproved === true) {
    errors.push("approval must not authorize localStorage retirement");
  }
  if (json.automaticRollbackApproved === true) {
    errors.push("approval must not authorize automatic rollback");
  }
  return {
    ok: errors.length === 0,
    errors,
    approval: json,
    path: COACHING_04_APPROVAL_EVIDENCE_RELATIVE_PATH,
  };
}

/**
 * Extract project ref from common Supabase URL env vars.
 * @param {NodeJS.ProcessEnv|Record<string,string|undefined>} env
 */
export function inspectCoaching04EnvironmentIdentity(env = process.env) {
  /** @type {string[]} */
  const errors = [];
  const urls = [
    env[COACHING_04_ENV_NAMES.STAGING_SUPABASE_URL],
    env[COACHING_04_ENV_NAMES.VITE_SUPABASE_URL],
    env[COACHING_04_ENV_NAMES.SUPABASE_URL],
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
    COACHING_04_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(resolvedProjectRef)
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
export function evaluateCoaching04ApplyGuards(input = {}) {
  const repoRoot = input.repoRoot || getCoaching04RepoRoot();
  const env = input.env || process.env;
  /** @type {string[]} */
  const blockers = [];
  /** @type {string[]} */
  const commitMismatchReasons = [];
  /** @type {string[]} */
  const hashMismatchReasons = [];

  const execute = input.execute === true;
  if (!execute) {
    blockers.push("Missing explicit --execute (default APPLY_MODE=REFUSED).");
  }

  const environment = String(input.environment || "")
    .trim()
    .toLowerCase();
  if (environment !== COACHING_04_ENVIRONMENT_LABEL) {
    blockers.push(
      `Environment must equal staging (got ${environment || "(empty)"}).`
    );
  }

  const projectRef = String(
    input.projectRef || env[COACHING_04_ENV_NAMES.TARGET_CONFIRM] || ""
  ).trim();
  if (projectRef !== COACHING_04_STAGING_PROJECT_REF) {
    blockers.push(
      `Exact Staging project ref required (got ${projectRef || "(empty)"}).`
    );
  }
  if (COACHING_04_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(projectRef)) {
    blockers.push("Production project ref is blocked.");
  }

  const actualGitHead = String(
    input.actualGitHead != null
      ? input.actualGitHead
      : getCoaching04HeadSha(repoRoot)
  ).trim();
  const expectedCommit = String(
    input.expectedCommit || env[COACHING_04_ENV_NAMES.EXPECTED_COMMIT] || ""
  ).trim();
  const ownerApprovedCommit = String(
    input.ownerApprovedCommit ||
      env[COACHING_04_ENV_NAMES.APPROVED_COMMIT] ||
      ""
  ).trim();

  const enforceCommit =
    execute || Boolean(expectedCommit) || Boolean(ownerApprovedCommit);

  if (enforceCommit) {
    if (looksLikeCoaching04BranchName(expectedCommit)) {
      commitMismatchReasons.push(
        `CLI expected commit must not be a branch name (got ${expectedCommit}).`
      );
    } else if (!isCoaching04FullGitSha(expectedCommit)) {
      commitMismatchReasons.push(
        `CLI/env expected commit must be full 40-char SHA (got ${expectedCommit ? expectedCommit.slice(0, 12) : "(empty)"}).`
      );
    }

    if (!isCoaching04FullGitSha(actualGitHead)) {
      commitMismatchReasons.push(
        `actualGitHead must be full 40-char SHA (got ${actualGitHead ? actualGitHead.slice(0, 12) : "(empty)"}).`
      );
    }

    if (
      isCoaching04FullGitSha(expectedCommit) &&
      isCoaching04FullGitSha(actualGitHead) &&
      expectedCommit.toLowerCase() !== actualGitHead.toLowerCase()
    ) {
      commitMismatchReasons.push(
        `CLI expected commit must equal actual git HEAD (head=${actualGitHead.slice(0, 12)}, expected=${expectedCommit.slice(0, 12)}).`
      );
    }

    if (ownerApprovedCommit) {
      if (looksLikeCoaching04BranchName(ownerApprovedCommit)) {
        commitMismatchReasons.push(
          "Owner-approved commit must not be a branch name."
        );
      } else if (!isCoaching04FullGitSha(ownerApprovedCommit)) {
        commitMismatchReasons.push(
          `Owner-approved commit must be full 40-char SHA (got ${ownerApprovedCommit.slice(0, 12)}).`
        );
      } else if (
        isCoaching04FullGitSha(actualGitHead) &&
        ownerApprovedCommit.toLowerCase() !== actualGitHead.toLowerCase()
      ) {
        const ancestorOnly =
          input.allowAncestorCheck !== false &&
          isCoaching04GitAncestor(ownerApprovedCommit, actualGitHead, repoRoot);
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
        : evaluateCoaching04WorktreeClean(repoRoot);
    if (!tree.ok) blockers.push("Working tree must be clean.");
  }

  if (input.preflightPass !== true) {
    blockers.push("Successful preflight PASS report required.");
  }

  const manifest = verifyCoaching04MigrationManifest({
    repoRoot,
    manifest: input.manifest,
  });
  if (!manifest.ok) {
    blockers.push(
      `SQL checksum/manifest verification failed: ${(manifest.errors || []).join("; ")}`
    );
  }

  const expectedManifestHash = String(
    input.expectedManifestHash ||
      env[COACHING_04_ENV_NAMES.EXPECTED_MANIFEST_HASH] ||
      ""
  )
    .trim()
    .toLowerCase();
  const expectedAggregateSqlHash = String(
    input.expectedAggregateSqlHash ||
      env[COACHING_04_ENV_NAMES.EXPECTED_AGGREGATE_SQL_HASH] ||
      ""
  )
    .trim()
    .toLowerCase();

  if (execute || expectedManifestHash || expectedAggregateSqlHash) {
    const actualCombined = String(
      manifest.combinedManifestHash || ""
    ).toLowerCase();
    const actualAgg = String(
      manifest.aggregateSha256Forward || ""
    ).toLowerCase();

    if (!expectedManifestHash) {
      hashMismatchReasons.push(
        "Exact combinedManifestHash pin required for Owner GO binding."
      );
    } else if (expectedManifestHash !== actualCombined) {
      hashMismatchReasons.push(
        `combinedManifestHash mismatch: expected ${expectedManifestHash}, actual ${actualCombined || "(missing)"}.`
      );
    }

    if (!expectedAggregateSqlHash) {
      hashMismatchReasons.push(
        "Exact aggregateSha256Forward pin required for Owner GO binding."
      );
    } else if (expectedAggregateSqlHash !== actualAgg) {
      hashMismatchReasons.push(
        `aggregateSha256Forward mismatch: expected ${expectedAggregateSqlHash}, actual ${actualAgg || "(missing)"}.`
      );
    }
  }

  const ownerGoToken = String(
    input.ownerGoToken || env[COACHING_04_ENV_NAMES.OWNER_GO] || ""
  ).trim();
  const ownerGoGranted = ownerGoToken === COACHING_04_OWNER_GO_TOKEN;
  if (!ownerGoGranted) {
    blockers.push(
      `Explicit approval token ${COACHING_04_OWNER_GO_TOKEN} required.`
    );
  }

  if (input.productionAllowed === true) {
    blockers.push("productionAllowed must remain false.");
  }

  if (input.mappingRowsCreationApproved === true) {
    blockers.push("mapping-row creation is refused by activation package.");
  }
  if (input.backfillApproved === true) {
    blockers.push("backfill is refused by activation package.");
  }
  if (input.durableRuntimeActivationApproved === true) {
    blockers.push("durable runtime activation is refused by activation package.");
  }
  if (input.localStorageRetirementApproved === true) {
    blockers.push("localStorage retirement is refused by activation package.");
  }
  if (input.automaticRetry === true) {
    blockers.push("automatic retry is refused by activation package.");
  }
  if (input.automaticRollback === true) {
    blockers.push("automatic rollback is refused by activation package.");
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
            path: COACHING_04_APPROVAL_EVIDENCE_RELATIVE_PATH,
          }
        : loadCoaching04OwnerApprovalEvidence(repoRoot);
    approvalEvidence = loaded;
    if (!loaded.ok) {
      blockers.push(...(loaded.errors || ["Owner approval evidence invalid."]));
    } else {
      const a = loaded.approval;
      const approvedCommit = String(a.expectedGitCommit || "").trim();
      if (!isCoaching04FullGitSha(approvedCommit)) {
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
          isCoaching04FullGitSha(expectedCommit) &&
          approvedCommit.toLowerCase() !== expectedCommit.toLowerCase()
        ) {
          commitMismatchReasons.push(
            `Approval expectedGitCommit must equal CLI expected commit.`
          );
        }
      }
      const pinnedManifest = String(
        a.combinedManifestHash || a.expectedManifestHash || ""
      )
        .trim()
        .toLowerCase();
      const pinnedAgg = String(
        a.aggregateSha256Forward || a.expectedAggregateSqlHash || ""
      )
        .trim()
        .toLowerCase();
      if (
        pinnedManifest &&
        pinnedManifest !== String(manifest.combinedManifestHash || "").toLowerCase()
      ) {
        hashMismatchReasons.push(
          "Approval combinedManifestHash does not match verified manifest."
        );
      }
      if (
        pinnedAgg &&
        pinnedAgg !==
          String(manifest.aggregateSha256Forward || "").toLowerCase()
      ) {
        hashMismatchReasons.push(
          "Approval aggregateSha256Forward does not match verified manifest."
        );
      }
      if (String(a.ownerGoToken || a.goToken || "").trim() !== ownerGoToken) {
        blockers.push("Approval token does not match CLI/env Owner GO token.");
      }
      if (String(a.stagingProjectRef || "").trim() !== COACHING_04_STAGING_PROJECT_REF) {
        blockers.push("Approval stagingProjectRef mismatch.");
      }
    }
  }

  if (commitMismatchReasons.length > 0) {
    blockers.push(...commitMismatchReasons);
  }
  if (hashMismatchReasons.length > 0) {
    blockers.push(...hashMismatchReasons);
  }

  const identity = inspectCoaching04EnvironmentIdentity(env);
  if (!identity.ok) blockers.push(...identity.errors);

  const canWrite = blockers.length === 0;
  const commitMismatch = commitMismatchReasons.length > 0;
  const hashMismatch = hashMismatchReasons.length > 0;
  const productionBlocked =
    COACHING_04_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(projectRef) ||
    blockers.some((b) => /Production/i.test(b));
  const dirtyTree = blockers.some((b) => /Working tree must be clean/i.test(b));
  const wrongTarget =
    projectRef &&
    projectRef !== COACHING_04_STAGING_PROJECT_REF &&
    !COACHING_04_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(projectRef);

  let verdict = COACHING_04_VERDICTS.APPLY_REFUSED;
  if (canWrite) {
    verdict = "COACHING_04_APPLY_GUARDS_PASS";
  } else if (!ownerGoGranted) {
    verdict = COACHING_04_VERDICTS.APPLY_REFUSED_OWNER_GO_NOT_GRANTED;
  } else if (productionBlocked) {
    verdict = COACHING_04_VERDICTS.PRODUCTION_TARGET_REFUSED;
  } else if (wrongTarget) {
    verdict = COACHING_04_VERDICTS.WRONG_TARGET_REFUSED;
  } else if (dirtyTree) {
    verdict = COACHING_04_VERDICTS.DIRTY_WORKTREE_REFUSED;
  } else if (commitMismatch) {
    verdict = COACHING_04_VERDICTS.EXECUTION_COMMIT_MISMATCH_REFUSED;
  } else if (hashMismatch) {
    const orderFail = hashMismatchReasons.some((r) => /order/i.test(r));
    const sqlFail = hashMismatchReasons.some((r) =>
      /aggregateSha256Forward/i.test(r)
    );
    verdict = orderFail
      ? COACHING_04_VERDICTS.ORDER_MISMATCH_REFUSED
      : sqlFail
        ? COACHING_04_VERDICTS.SQL_HASH_MISMATCH_REFUSED
        : COACHING_04_VERDICTS.MANIFEST_HASH_MISMATCH_REFUSED;
  } else if (!manifest.ok) {
    const joined = (manifest.errors || []).join(" ");
    if (/order mismatch/i.test(joined)) {
      verdict = COACHING_04_VERDICTS.ORDER_MISMATCH_REFUSED;
    } else if (/SHA-256 mismatch|aggregateSha256Forward/i.test(joined)) {
      verdict = COACHING_04_VERDICTS.SQL_HASH_MISMATCH_REFUSED;
    } else {
      verdict = COACHING_04_VERDICTS.MANIFEST_HASH_MISMATCH_REFUSED;
    }
  }

  return {
    canWrite,
    applyMode: canWrite ? "EXECUTE_ALLOWED" : "REFUSED",
    verdict,
    blockers,
    commitMismatchReasons,
    hashMismatchReasons,
    stagingProjectRef: COACHING_04_STAGING_PROJECT_REF,
    headSha: actualGitHead,
    actualGitHead,
    ownerGoGranted,
    ownerGoRequired: COACHING_04_OWNER_GO_TOKEN,
    expectedManifestHash: expectedManifestHash || null,
    expectedAggregateSqlHash: expectedAggregateSqlHash || null,
    combinedManifestHash: manifest.combinedManifestHash || null,
    aggregateSha256Forward: manifest.aggregateSha256Forward || null,
    approvalEvidenceOk: approvalEvidence ? approvalEvidence.ok : null,
    databaseConnectionOpened: false,
    databaseWrites: 0,
    sqlApplied: false,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    runtimeActivated: false,
    localStorageRetired: false,
    roleGrantsApplied: false,
    productionTouched: false,
    filesDeleted: false,
    automaticRetry: false,
    automaticRollback: false,
    CODEX_DELETE_ALLOWED: "NO",
    secretsPrinted: false,
    sqlWouldApply: canWrite,
    verificationRunsOnlyAfterForwardSuccess: true,
    rollbackExcludedFromForward: true,
  };
}

/**
 * Static audit helpers for canonical SQL package (read-only).
 * @param {string} repoRoot
 */
export function auditCoaching04CanonicalSqlPackage(repoRoot) {
  const root = repoRoot || getCoaching04RepoRoot();
  /** @type {string[]} */
  const findings = [];
  /** @type {string[]} */
  const defects = [];

  const stripSqlComments = (sql) =>
    String(sql || "")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/--[^\n]*/g, " ");

  const forwardTexts = COACHING_04_FORWARD_SQL_ORDER.map((rel) => ({
    rel,
    text: readFileSync(path.join(root, rel), "utf8"),
  }));

  for (const { rel, text } of forwardTexts) {
    const stripped = stripSqlComments(text);
    if (
      /auth\.uid\(\)\s*=\s*player_id|player_id\s*=\s*auth\.uid\(\)/i.test(
        stripped
      )
    ) {
      defects.push(`${rel}: implicit auth.uid() = player_id`);
    }
    if (
      /\bBACKFILL\b/i.test(stripped) &&
      /INSERT\s+INTO\s+public\.player_identity_links/i.test(stripped)
    ) {
      if (/backfill/i.test(rel)) {
        defects.push(`${rel}: backfill INSERT in forward package`);
      }
    }
  }

  const helpers10 =
    forwardTexts.find((f) => f.rel.includes("10_"))?.text || "";
  if (!/CREATE OR REPLACE FUNCTION public\.coaching_04_actor_uid/i.test(helpers10)) {
    defects.push("Assignment helpers missing coaching_04_actor_uid");
  }

  const helpers11 =
    forwardTexts.find((f) => f.rel.includes("11_"))?.text || "";
  if (!/player_identity_resolve_mapping/i.test(helpers11)) {
    defects.push("PLAYER helpers must consume player_identity_resolve_mapping");
  }
  if (!/CREATE OR REPLACE FUNCTION public\.coaching_04_mapped_player_id/i.test(helpers11)) {
    defects.push("PLAYER helpers missing coaching_04_mapped_player_id");
  }

  for (const { rel, text } of forwardTexts) {
    if (!/CREATE OR REPLACE FUNCTION/i.test(text)) continue;
    const defs = text.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/gi) || [];
    for (const d of defs) {
      // COACHING-04 convention: fixed search_path = public, pg_temp
      if (!/SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(d)) {
        defects.push(`${rel}: function missing fixed search_path`);
      }
    }
  }

  findings.push(
    "Forward package is additive helpers/policies/RPCs/grants; no mapping-row INSERT; no durable runtime flip."
  );

  return {
    ok: defects.length === 0,
    defects,
    findings,
    forwardOrder: [...COACHING_04_FORWARD_SQL_ORDER],
    rollbackExcludedFromForward: true,
    verificationAfterForwardOnly: true,
    productionTargetReferenced: false,
    mappingRowsCreated: false,
    backfillIncluded: false,
    durableRuntimeDefault: false,
    localStorageRetired: false,
  };
}

/**
 * Catalog read-only activation preflight SQL (BEGIN READ ONLY … ROLLBACK).
 * Single summary SELECT so Management API responses are parseable.
 */
export function buildCoaching04ActivationReadOnlyPreflightSql() {
  return `
BEGIN TRANSACTION READ ONLY;
SET search_path = public, pg_temp;

SELECT
  current_setting('transaction_read_only', true) AS transaction_read_only,
  to_regclass('public.coaching_programs') IS NOT NULL AS coaching_programs_present,
  to_regclass('public.coaching_coach_references') IS NOT NULL AS coaching_coach_references_present,
  to_regclass('public.coaching_coach_player_relationships') IS NOT NULL AS coaching_cpr_present,
  to_regclass('public.coaching_enrollments') IS NOT NULL AS coaching_enrollments_present,
  to_regclass('public.coaching_curricula') IS NOT NULL AS coaching_curricula_present,
  to_regclass('public.coaching_lessons') IS NOT NULL AS coaching_lessons_present,
  to_regclass('public.coaching_training_sessions') IS NOT NULL AS coaching_sessions_present,
  to_regclass('public.coaching_attendance_records') IS NOT NULL AS coaching_attendance_present,
  to_regclass('public.coaching_attendance_corrections') IS NOT NULL AS coaching_acorr_present,
  to_regclass('public.coaching_packages') IS NOT NULL AS coaching_packages_present,
  to_regclass('public.coaching_package_entitlements') IS NOT NULL AS coaching_entitlements_present,
  to_regclass('public.coaching_package_usage_events') IS NOT NULL AS coaching_usage_present,
  to_regclass('public.coaching_evaluations') IS NOT NULL AS coaching_evaluations_present,
  to_regclass('public.player_identity_links') IS NOT NULL AS player_identity_links_present,
  to_regclass('public.permissions') IS NOT NULL AS permissions_present,
  to_regclass('public.role_permissions') IS NOT NULL AS role_permissions_present,
  to_regclass('public.roles') IS NOT NULL AS roles_present,
  CASE
    WHEN to_regclass('public.player_identity_links') IS NULL THEN -1
    ELSE (SELECT count(*)::int FROM public.player_identity_links)
  END AS player_identity_links_row_count,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'player_identity_resolve_mapping'
  ) AS player_identity_resolve_mapping_present,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'player_identity_is_mapped'
  ) AS player_identity_is_mapped_present,
  (
    SELECT count(DISTINCT p.proname)::int
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'user_venue_id',
        'user_club_id',
        'user_has_permission',
        'is_super_admin',
        'coaching_02_scope_allows',
        'coaching_02_has_action'
      )
  ) = 6 AS rls_prerequisites_present,
  (
    SELECT count(*)::int
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'coaching_04_%'
  ) AS coaching_04_function_collision_count,
  (
    SELECT count(*)::int
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND pol.polname LIKE 'coaching_04_%'
  ) AS coaching_04_policy_collision_count,
  CASE
    WHEN to_regclass('public.roles') IS NULL THEN -1
    ELSE (SELECT count(*)::int FROM public.roles WHERE id = 'PLAYER')
  END AS player_role_count,
  CASE
    WHEN to_regclass('public.roles') IS NULL THEN -1
    ELSE (SELECT count(*)::int FROM public.roles WHERE id = 'COACH')
  END AS coach_role_count,
  CASE
    WHEN to_regclass('public.roles') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.roles
      WHERE id IN ('PLAYER', 'COACH')
    )
  END AS required_roles_present_count,
  CASE
    WHEN to_regclass('public.permissions') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.permissions
      WHERE module = 'coaching' OR id LIKE 'coaching.%'
    )
  END AS coaching_permission_count,
  CASE
    WHEN to_regclass('public.permissions') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.permissions
      WHERE id LIKE 'coaching.assigned.%'
         OR id LIKE 'coaching.self.%'
    )
  END AS coaching_04_permission_seed_count;

ROLLBACK;
`.trim();
}
