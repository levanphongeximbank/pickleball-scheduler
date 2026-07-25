/**
 * NEWS-03 — Fail-closed Staging gates (Customer-07 pattern; no secrets printed).
 */

import { execSync } from "node:child_process";
import process from "node:process";

import {
  NEWS_03_APPLY_CONFIRM_PHRASE,
  NEWS_03_BACKUP_CLASSIFICATION,
  NEWS_03_ENV_NAMES,
  NEWS_03_ENVIRONMENT_LABEL,
  NEWS_03_MODES,
  NEWS_03_PRODUCTION_DOMAIN_BLOCKLIST,
  NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  NEWS_03_ROLLBACK_CONFIRM_PHRASE,
  NEWS_03_STAGING_PROJECT_REF,
  NEWS_03_STAGING_PROJECT_REF_ALLOWLIST,
  NEWS_03_VERDICTS,
} from "./news03Constants.js";
import { getNews03RepoRoot } from "./news03Env.js";
import { news03EnvPresence } from "./news03Redact.js";
import { loadNews03ApplyPackage } from "./news03SqlPackage.js";

/**
 * @param {string|undefined|null} value
 */
function present(value) {
  return value != null && String(value).trim() !== "";
}

/**
 * @param {Record<string, string|undefined>} env
 */
export function resolveNews03SupabaseUrl(env = {}) {
  return String(
    env[NEWS_03_ENV_NAMES.STAGING_SUPABASE_URL] ||
      env[NEWS_03_ENV_NAMES.VITE_SUPABASE_URL] ||
      env[NEWS_03_ENV_NAMES.SUPABASE_URL] ||
      ""
  ).trim();
}

/**
 * @param {Record<string, string|undefined>} env
 */
export function inspectNews03EnvironmentIdentity(env = {}) {
  const url = resolveNews03SupabaseUrl(env);
  const appEnv = String(env[NEWS_03_ENV_NAMES.VITE_APP_ENV] || "")
    .trim()
    .toLowerCase();

  let projectRefHint = null;
  for (const ref of NEWS_03_STAGING_PROJECT_REF_ALLOWLIST) {
    if (url.includes(ref)) {
      projectRefHint = ref;
      break;
    }
  }

  const containsProductionRef = NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST.some(
    (ref) => url.includes(ref)
  );
  const containsProductionDomain = NEWS_03_PRODUCTION_DOMAIN_BLOCKLIST.some(
    (domain) => url.toLowerCase().includes(domain)
  );

  /** @type {string[]} */
  const errors = [];
  if (containsProductionRef) {
    errors.push("Production project ref detected in Supabase URL.");
  }
  if (containsProductionDomain) {
    errors.push("Production domain pickvn.app detected in Supabase URL.");
  }
  if (url && !projectRefHint) {
    errors.push(
      `URL does not contain Staging allowlist ref ${NEWS_03_STAGING_PROJECT_REF}.`
    );
  }
  if (appEnv === "production") {
    errors.push("VITE_APP_ENV=production is incompatible with Staging apply.");
  }

  const stagingService = present(
    env[NEWS_03_ENV_NAMES.STAGING_SERVICE_ROLE_KEY]
  );
  const genericService = present(env.SUPABASE_SERVICE_ROLE_KEY);
  if (genericService && !stagingService) {
    errors.push(
      "Generic SUPABASE_SERVICE_ROLE_KEY without STAGING_SUPABASE_SERVICE_ROLE_KEY is refused."
    );
  }

  // Hard-block if caller tries to pass a project-ref override env.
  if (
    present(env.SUPABASE_PROJECT_REF) &&
    String(env.SUPABASE_PROJECT_REF).trim() !== NEWS_03_STAGING_PROJECT_REF
  ) {
    errors.push("SUPABASE_PROJECT_REF override is not allowlisted.");
  }

  return {
    ok: errors.length === 0 && (!url || projectRefHint != null),
    errors,
    environmentLabel: NEWS_03_ENVIRONMENT_LABEL,
    projectRefHint: projectRefHint || (url ? null : NEWS_03_STAGING_PROJECT_REF),
    hardcodedProjectRef: NEWS_03_STAGING_PROJECT_REF,
    urlPresent: Boolean(url),
    containsStagingAllowlist: projectRefHint != null,
    containsProductionRef,
    containsProductionDomain,
    urlValuePrinted: false,
    isProduction: containsProductionRef || containsProductionDomain,
  };
}

/**
 * @param {{
 *   mode: string,
 *   execute: boolean,
 *   confirm: string|null,
 *   workingTreeClean: boolean|null,
 *   preflightState: string|null,
 *   packageOk: boolean,
 *   identityOk: boolean,
 *   identityIsProduction: boolean,
 *   accessTokenPresent: boolean,
 * }} input
 */
export function evaluateNews03OwnerGoGates(input) {
  /** @type {string[]} */
  const errors = [];
  const mode = input.mode;
  const isApply = mode === NEWS_03_MODES.APPLY;
  const isRollback = mode === NEWS_03_MODES.ROLLBACK;
  const writeMode = isApply || isRollback;

  if (!writeMode) {
    return {
      canWrite: false,
      writeMode: false,
      ok: true,
      errors: [],
      requiredConfirm: null,
      secretsPrinted: false,
    };
  }

  if (!input.execute) {
    errors.push("Missing --execute flag for write mode.");
  }
  if (input.identityIsProduction) {
    errors.push("Production identity hard-blocked.");
  }
  if (!input.identityOk) {
    errors.push("Staging identity gate failed.");
  }
  if (!input.packageOk) {
    errors.push("SQL package inventory incomplete.");
  }
  if (!input.accessTokenPresent) {
    errors.push("SUPABASE_ACCESS_TOKEN missing (PRESENT required for write).");
  }
  if (input.workingTreeClean !== true) {
    errors.push("Git worktree must be clean for write modes.");
  }

  if (isApply) {
    if (input.confirm !== NEWS_03_APPLY_CONFIRM_PHRASE) {
      errors.push(
        `Apply requires --confirm=${NEWS_03_APPLY_CONFIRM_PHRASE}`
      );
    }
    const resumable =
      input.preflightState === "NOT_APPLIED" ||
      input.preflightState === "PARTIALLY_APPLIED";
    // PARTIALLY_APPLIED is recorded but NOT blindly resumed — caller must prove
    // resumable via explicit preflight classification; harness still refuses
    // FULLY_* and STATE_UNKNOWN for apply.
    if (input.preflightState === "PARTIALLY_APPLIED") {
      errors.push(
        "Preflight PARTIALLY_APPLIED — refuse blind resume; Owner remediation required."
      );
    } else if (input.preflightState !== "NOT_APPLIED") {
      errors.push(
        `Apply requires preflight NOT_APPLIED (got ${input.preflightState || "null"}).`
      );
    }
    void resumable;
  }

  if (isRollback) {
    if (input.confirm !== NEWS_03_ROLLBACK_CONFIRM_PHRASE) {
      errors.push(
        `Rollback requires --confirm=${NEWS_03_ROLLBACK_CONFIRM_PHRASE}`
      );
    }
  }

  return {
    canWrite: errors.length === 0,
    writeMode: true,
    ok: errors.length === 0,
    errors,
    requiredConfirm: isApply
      ? NEWS_03_APPLY_CONFIRM_PHRASE
      : NEWS_03_ROLLBACK_CONFIRM_PHRASE,
    backupClassification: NEWS_03_BACKUP_CLASSIFICATION,
    pitr: false,
    verifiedBackup: false,
    secretsPrinted: false,
  };
}

/**
 * @param {{ repoRoot?: string }} [options]
 */
export function probeNews03GitFacts(options = {}) {
  const repoRoot = options.repoRoot || getNews03RepoRoot();
  /** @type {Record<string, unknown>} */
  const facts = {
    branch: null,
    head: null,
    workingTreeClean: null,
  };
  try {
    facts.branch = execSync("git branch --show-current", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    facts.head = execSync("git rev-parse HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const porcelain = execSync("git status --porcelain", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    facts.workingTreeClean = porcelain.length === 0;
  } catch (err) {
    facts.error = String(err?.message || err);
  }
  return facts;
}

/**
 * Static credential presence for write modes (values never returned).
 * @param {Record<string, string|undefined>} env
 */
export function evaluateNews03CredentialsPresence(env = {}) {
  const presence = news03EnvPresence(env, [
    NEWS_03_ENV_NAMES.ACCESS_TOKEN,
    NEWS_03_ENV_NAMES.STAGING_SERVICE_ROLE_KEY,
    NEWS_03_ENV_NAMES.STAGING_ANON_KEY,
    NEWS_03_ENV_NAMES.VITE_ANON_KEY,
    NEWS_03_ENV_NAMES.STAGING_SUPABASE_URL,
    NEWS_03_ENV_NAMES.VITE_SUPABASE_URL,
    NEWS_03_ENV_NAMES.SUPABASE_URL,
  ]);
  return {
    accessTokenPresent:
      presence[NEWS_03_ENV_NAMES.ACCESS_TOKEN] === "PRESENT",
    stagingServiceRolePresent:
      presence[NEWS_03_ENV_NAMES.STAGING_SERVICE_ROLE_KEY] === "PRESENT",
    stagingAnonPresent:
      presence[NEWS_03_ENV_NAMES.STAGING_ANON_KEY] === "PRESENT" ||
      presence[NEWS_03_ENV_NAMES.VITE_ANON_KEY] === "PRESENT",
    urlPresent:
      presence[NEWS_03_ENV_NAMES.STAGING_SUPABASE_URL] === "PRESENT" ||
      presence[NEWS_03_ENV_NAMES.VITE_SUPABASE_URL] === "PRESENT" ||
      presence[NEWS_03_ENV_NAMES.SUPABASE_URL] === "PRESENT",
    presence,
    secretsPrinted: false,
  };
}

/**
 * Aggregate static gates used by plan/preflight without network.
 * @param {{
 *   env?: Record<string, string|undefined>,
 *   repoRoot?: string,
 *   mode?: string,
 *   execute?: boolean,
 *   confirm?: string|null,
 *   preflightState?: string|null,
 *   gitFacts?: object,
 * }} [options]
 */
export function evaluateNews03StaticGates(options = {}) {
  const env = options.env || process.env;
  const repoRoot = options.repoRoot || getNews03RepoRoot();
  const mode = options.mode || NEWS_03_MODES.PREFLIGHT;
  const pkg = loadNews03ApplyPackage(repoRoot);
  const identity = inspectNews03EnvironmentIdentity(env);
  const credentials = evaluateNews03CredentialsPresence(env);
  const gitFacts = options.gitFacts || probeNews03GitFacts({ repoRoot });

  const ownerGo = evaluateNews03OwnerGoGates({
    mode,
    execute: Boolean(options.execute),
    confirm: options.confirm ?? null,
    workingTreeClean: gitFacts.workingTreeClean === true,
    preflightState: options.preflightState ?? null,
    packageOk: pkg.ok,
    identityOk: identity.ok && !identity.isProduction,
    identityIsProduction: identity.isProduction === true,
    accessTokenPresent: credentials.accessTokenPresent,
  });

  let verdict = NEWS_03_VERDICTS.READ_ONLY_OK;
  if (identity.isProduction) {
    verdict = NEWS_03_VERDICTS.BLOCKED_PRODUCTION;
  } else if (
    (mode === NEWS_03_MODES.APPLY || mode === NEWS_03_MODES.ROLLBACK) &&
    !ownerGo.canWrite
  ) {
    verdict =
      mode === NEWS_03_MODES.ROLLBACK
        ? NEWS_03_VERDICTS.ROLLBACK_BLOCKED
        : NEWS_03_VERDICTS.APPLY_BLOCKED;
  } else if (!identity.ok && (mode === NEWS_03_MODES.APPLY || mode === NEWS_03_MODES.ROLLBACK)) {
    verdict = NEWS_03_VERDICTS.BLOCKED_ENVIRONMENT;
  }

  return {
    package: pkg,
    identity,
    credentials,
    gitFacts,
    ownerGo,
    verdict,
    secretsPrinted: false,
    productionBlocked: identity.isProduction === true,
    allowlistRef: NEWS_03_STAGING_PROJECT_REF,
    productionBlocklist: NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  };
}
