/**
 * COACHING-03 — Apply / preflight gate evaluation (fail-closed).
 * Never prints secret values.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import process from "node:process";

import {
  COACHING_03_APPROVAL_TEMPLATE_RELATIVE_PATH,
  COACHING_03_APPROVAL_EVIDENCE_RELATIVE_PATH,
  COACHING_03_ENVIRONMENT_LABEL,
  COACHING_03_ENV_NAMES,
  COACHING_03_OWNER_GO_TOKEN,
  COACHING_03_PRODUCTION_DOMAIN_BLOCKLIST,
  COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  COACHING_03_STAGING_PROJECT_REF,
  COACHING_03_STAGING_PROJECT_REF_ALLOWLIST,
  COACHING_03_VERDICTS,
} from "./constants.js";
import { getCoaching03RepoRoot } from "./loadCoachingStagingEnv.js";
import { verifyCoaching03MigrationManifest } from "./migrationManifest.js";

/**
 * @param {string|undefined|null} urlOrHost
 * @returns {string}
 */
export function extractSupabaseProjectRef(urlOrHost) {
  const raw = String(urlOrHost || "").trim();
  if (!raw) return "";
  const httpsMatch = raw.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (httpsMatch) return httpsMatch[1].toLowerCase();
  const postgresMatch = raw.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  if (postgresMatch) return postgresMatch[1].toLowerCase();
  const bare = raw.match(/^([a-z0-9]{20})$/i);
  if (bare) return bare[1].toLowerCase();
  return "";
}

/**
 * @param {string} text
 * @returns {string}
 */
export function redactSecrets(text) {
  let out = String(text || "");
  out = out.replace(
    /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g,
    "[REDACTED_JWT]"
  );
  out = out.replace(
    /(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+(@)/gi,
    "$1[REDACTED_PASSWORD]$2"
  );
  out = out.replace(
    /((?:SERVICE_ROLE|ACCESS_TOKEN|ANON_KEY|PASSWORD|SECRET|API_KEY)\s*[=:]\s*)([^\s,;]+)/gi,
    "$1[REDACTED]"
  );
  out = out.replace(
    /(Bearer\s+)[A-Za-z0-9._-]+/gi,
    "$1[REDACTED_TOKEN]"
  );
  return out;
}

/**
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} [env]
 */
export function inspectCoaching03EnvironmentIdentity(env = process.env) {
  const url = String(
    env[COACHING_03_ENV_NAMES.STAGING_SUPABASE_URL] ||
      env[COACHING_03_ENV_NAMES.VITE_SUPABASE_URL] ||
      env[COACHING_03_ENV_NAMES.SUPABASE_URL] ||
      ""
  ).trim();
  const dbUrl = String(env[COACHING_03_ENV_NAMES.STAGING_DB_URL] || "").trim();
  const appEnv = String(env[COACHING_03_ENV_NAMES.VITE_APP_ENV] || "").trim();
  const targetConfirm = String(
    env[COACHING_03_ENV_NAMES.TARGET_CONFIRM] || ""
  ).trim();
  const urlRef = extractSupabaseProjectRef(url);
  const dbRef = extractSupabaseProjectRef(dbUrl);
  /** @type {string[]} */
  const errors = [];

  for (const prodRef of COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST) {
    if (url.includes(prodRef) || dbUrl.includes(prodRef)) {
      errors.push(`Production project ref detected: ${prodRef}`);
    }
  }
  for (const domain of COACHING_03_PRODUCTION_DOMAIN_BLOCKLIST) {
    if (url.toLowerCase().includes(domain) || dbUrl.toLowerCase().includes(domain)) {
      errors.push(`Production domain detected: ${domain}`);
    }
  }
  if (urlRef && !COACHING_03_STAGING_PROJECT_REF_ALLOWLIST.includes(urlRef)) {
    errors.push(`URL project ref not Staging allowlist: ${urlRef}`);
  }
  if (dbRef && !COACHING_03_STAGING_PROJECT_REF_ALLOWLIST.includes(dbRef)) {
    errors.push(`DB URL project ref not Staging allowlist: ${dbRef}`);
  }
  if (urlRef && dbRef && urlRef !== dbRef) {
    errors.push("Supabase URL and DB URL project refs do not match.");
  }
  if (
    targetConfirm &&
    targetConfirm !== COACHING_03_STAGING_PROJECT_REF
  ) {
    errors.push("COACHING_03_STAGING_TARGET_CONFIRM mismatch.");
  }

  const resolvedRef =
    urlRef ||
    dbRef ||
    (targetConfirm === COACHING_03_STAGING_PROJECT_REF
      ? COACHING_03_STAGING_PROJECT_REF
      : "");

  const ok =
    errors.length === 0 &&
    resolvedRef === COACHING_03_STAGING_PROJECT_REF;

  return {
    ok,
    errors,
    resolvedProjectRef: resolvedRef || null,
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
    appEnvPresent: Boolean(appEnv),
    urlValuePrinted: false,
    secretsPrinted: false,
  };
}

/**
 * @param {string} [repoRoot]
 */
export function evaluateCoaching03WorktreeClean(repoRoot) {
  const root = repoRoot || getCoaching03RepoRoot();
  try {
    const porcelain = execSync("git status --porcelain", {
      cwd: root,
      encoding: "utf8",
    }).trim();
    return {
      ok: porcelain.length === 0,
      dirty: porcelain.length > 0,
      secretsPrinted: false,
    };
  } catch (err) {
    return {
      ok: false,
      dirty: true,
      error: redactSecrets(err?.message || String(err)),
      secretsPrinted: false,
    };
  }
}

/**
 * @param {string} [repoRoot]
 */
export function getCoaching03HeadSha(repoRoot) {
  const root = repoRoot || getCoaching03RepoRoot();
  return execSync("git rev-parse HEAD", {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

/**
 * True when `ancestorSha` is an ancestor of `descendantSha` (or equal).
 * @param {string} ancestorSha
 * @param {string} descendantSha
 * @param {string} [repoRoot]
 */
export function isCoaching03GitAncestor(ancestorSha, descendantSha, repoRoot) {
  const root = repoRoot || getCoaching03RepoRoot();
  const a = String(ancestorSha || "").trim();
  const d = String(descendantSha || "").trim();
  if (!a || !d) return false;
  if (a === d) return true;
  try {
    execSync(`git merge-base --is-ancestor ${a} ${d}`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Load Owner approval template defaults (must remain false until GO).
 * @param {string} [repoRoot]
 */
export function loadCoaching03ApprovalTemplateDefaults(repoRoot) {
  const root = repoRoot || getCoaching03RepoRoot();
  const abs = path.join(root, COACHING_03_APPROVAL_TEMPLATE_RELATIVE_PATH);
  if (!existsSync(abs)) {
    return {
      ok: false,
      errors: ["Approval template missing."],
    };
  }
  const json = JSON.parse(readFileSync(abs, "utf8"));
  /** @type {string[]} */
  const errors = [];
  if (json.approved !== false) errors.push("approved must default false");
  if (json.environment !== "staging") {
    errors.push("environment must be staging");
  }
  if (json.productionAllowed !== false) {
    errors.push("productionAllowed must be false");
  }
  if (json.goToken !== COACHING_03_OWNER_GO_TOKEN) {
    errors.push("goToken must equal COACHING_03_OWNER_GO_APPLY_STAGING");
  }
  return { ok: errors.length === 0, errors, defaults: json };
}

/**
 * Load live Owner approval evidence used by apply guards (Gate D).
 * @param {string} [repoRoot]
 */
export function loadCoaching03OwnerApprovalEvidence(repoRoot) {
  const root = repoRoot || getCoaching03RepoRoot();
  const abs = path.join(root, COACHING_03_APPROVAL_EVIDENCE_RELATIVE_PATH);
  if (!existsSync(abs)) {
    return {
      ok: false,
      errors: ["Owner approval evidence missing."],
      path: COACHING_03_APPROVAL_EVIDENCE_RELATIVE_PATH,
    };
  }
  const json = JSON.parse(readFileSync(abs, "utf8"));
  /** @type {string[]} */
  const errors = [];
  if (json.approved !== true) errors.push("approval.approved must be true");
  if (json.environment !== "staging") {
    errors.push("approval.environment must be staging");
  }
  if (json.productionAllowed !== false) {
    errors.push("approval.productionAllowed must be false");
  }
  const token = String(json.ownerGoToken || json.goToken || "").trim();
  if (token !== COACHING_03_OWNER_GO_TOKEN) {
    errors.push("approval goToken mismatch");
  }
  if (json.stagingProjectRef !== COACHING_03_STAGING_PROJECT_REF) {
    errors.push("approval stagingProjectRef mismatch");
  }
  if (json.coachGrantsAllowed === true) {
    errors.push("approval must not allow COACH grants");
  }
  if (json.playerGrantsAllowed === true) {
    errors.push("approval must not allow PLAYER grants");
  }
  if (json.uiRuntimeCutoverApproved === true) {
    errors.push("approval must not authorize UI cutover");
  }
  return {
    ok: errors.length === 0,
    errors,
    approval: json,
    path: COACHING_03_APPROVAL_EVIDENCE_RELATIVE_PATH,
    secretsPrinted: false,
  };
}

/**
 * Evaluate whether controlled apply may execute.
 * Defaults to refuse.
 *
 * @param {{
 *   execute?: boolean,
 *   environment?: string,
 *   projectRef?: string,
 *   expectedCommit?: string,
 *   ownerGoToken?: string,
 *   preflightPass?: boolean,
 *   productionAllowed?: boolean,
 *   includeRoleGrants?: boolean,
 *   requireApprovalEvidence?: boolean,
 *   repoRoot?: string,
 *   requireCleanWorktree?: boolean,
 *   env?: NodeJS.ProcessEnv|Record<string,string|undefined>
 * }} input
 */
export function evaluateCoaching03ApplyGuards(input = {}) {
  const repoRoot = input.repoRoot || getCoaching03RepoRoot();
  const env = input.env || process.env;
  /** @type {string[]} */
  const blockers = [];

  const execute = input.execute === true;
  if (!execute) {
    blockers.push("Missing explicit --execute (default APPLY_MODE=REFUSED).");
  }

  const environment = String(
    input.environment || env[COACHING_03_ENV_NAMES.VITE_APP_ENV] || ""
  )
    .trim()
    .toLowerCase();
  if (environment !== COACHING_03_ENVIRONMENT_LABEL) {
    blockers.push(
      `Environment must equal staging (got ${environment || "(empty)"}).`
    );
  }

  const projectRef = String(
    input.projectRef ||
      env[COACHING_03_ENV_NAMES.TARGET_CONFIRM] ||
      ""
  ).trim();
  if (projectRef !== COACHING_03_STAGING_PROJECT_REF) {
    blockers.push(
      `Exact Staging project ref required (got ${projectRef || "(empty)"}).`
    );
  }
  if (
    COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(projectRef)
  ) {
    blockers.push("Production project ref is blocked.");
  }

  const head = getCoaching03HeadSha(repoRoot);
  const expectedCommit = String(
    input.expectedCommit ||
      env[COACHING_03_ENV_NAMES.EXPECTED_COMMIT] ||
      ""
  ).trim();
  if (!expectedCommit || expectedCommit !== head) {
    blockers.push(
      `Exact expected git commit required (head=${head.slice(0, 12)}, expected=${expectedCommit ? expectedCommit.slice(0, 12) : "(empty)"}).`
    );
  }

  const requireClean = input.requireCleanWorktree !== false;
  if (requireClean) {
    const tree = evaluateCoaching03WorktreeClean(repoRoot);
    if (!tree.ok) blockers.push("Working tree must be clean.");
  }

  if (input.preflightPass !== true) {
    blockers.push("Successful preflight PASS report required.");
  }

  const manifest = verifyCoaching03MigrationManifest({ repoRoot });
  if (!manifest.ok) {
    blockers.push(
      `SQL checksum/manifest verification failed: ${(manifest.errors || []).join("; ")}`
    );
  }

  const ownerGoToken = String(
    input.ownerGoToken || env[COACHING_03_ENV_NAMES.OWNER_GO] || ""
  ).trim();
  if (ownerGoToken !== COACHING_03_OWNER_GO_TOKEN) {
    blockers.push(
      `Explicit approval token ${COACHING_03_OWNER_GO_TOKEN} required.`
    );
  }

  const productionAllowed = input.productionAllowed === true;
  if (productionAllowed) {
    blockers.push("productionAllowed must remain false.");
  }

  /** @type {object|null} */
  let approvalEvidence = null;
  // Apply script opts in explicitly; unit tests leave this false by default.
  const requireApproval = input.requireApprovalEvidence === true;
  if (requireApproval) {
    const loaded = loadCoaching03OwnerApprovalEvidence(repoRoot);
    approvalEvidence = loaded;
    if (!loaded.ok) {
      blockers.push(...(loaded.errors || ["Owner approval evidence invalid."]));
    } else {
      const a = loaded.approval;
      // Owner pins the authorized package commit; HEAD may be a Gate D
      // apply-tooling descendant while still requiring CLI expectedCommit===HEAD.
      const approvedCommit = String(a.expectedGitCommit || "").trim();
      if (
        !approvedCommit ||
        !isCoaching03GitAncestor(approvedCommit, head, repoRoot)
      ) {
        blockers.push(
          `Approval expectedGitCommit must be HEAD or an ancestor (approval=${approvedCommit ? approvedCommit.slice(0, 12) : "(empty)"}, head=${head.slice(0, 12)}).`
        );
      }
      if (String(a.ownerGoToken || a.goToken || "").trim() !== ownerGoToken) {
        blockers.push("Approval token does not match CLI/env Owner GO token.");
      }
      if (input.includeRoleGrants === true && a.roleMatrixApproved !== true) {
        blockers.push("Role grants requested but approval.roleMatrixApproved is not true.");
      }
    }
  }

  const identity = inspectCoaching03EnvironmentIdentity(env);
  if (!identity.ok) {
    blockers.push(...identity.errors);
  }

  const canWrite = blockers.length === 0;
  return {
    canWrite,
    applyMode: canWrite ? "EXECUTE_ALLOWED" : "REFUSED",
    verdict: canWrite
      ? COACHING_03_VERDICTS.PREFLIGHT_PASS
      : COACHING_03_VERDICTS.APPLY_REFUSED,
    blockers,
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
    headSha: head,
    approvalEvidenceOk: approvalEvidence ? approvalEvidence.ok : null,
    secretsPrinted: false,
    sqlWouldApply: canWrite,
  };
}
