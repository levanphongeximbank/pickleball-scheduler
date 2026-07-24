/**
 * CUSTOMER-07 — Pre-write gates (fail-closed).
 *
 * Order:
 * 1. Staging environment identity
 * 2. Backup / rollback capability
 * 3. Credentials for Staging-only apply
 * 4. Migration manifest integrity
 *
 * Never prints secret values. Never accepts Production targets.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import process from "node:process";

import {
  CUSTOMER_07_CRM_SAFETY_STASH_MARKERS,
  CUSTOMER_07_ENV_NAMES,
  CUSTOMER_07_ENVIRONMENT_LABEL,
  CUSTOMER_07_PRODUCTION_DOMAIN_BLOCKLIST,
  CUSTOMER_07_PRODUCTION_PROJECT_REF_BLOCKLIST,
  CUSTOMER_07_ROLLBACK_PATHS,
  CUSTOMER_07_SOFT_DISABLE_RELATIVE_PATH,
  CUSTOMER_07_STAGING_PROJECT_REF,
  CUSTOMER_07_STAGING_PROJECT_REF_ALLOWLIST,
  CUSTOMER_07_VERDICTS,
} from "./constants.js";
import { getCustomer07RepoRoot } from "./loadCustomerStagingEnv.js";
import { verifyCustomer07MigrationManifest } from "./migrationManifest.js";

/**
 * @param {string|undefined|null} value
 */
function present(value) {
  return value != null && String(value).trim() !== "";
}

/**
 * @param {Record<string, string|undefined>} env
 */
export function resolveCustomer07SupabaseUrl(env = {}) {
  return String(
    env[CUSTOMER_07_ENV_NAMES.STAGING_SUPABASE_URL] ||
      env[CUSTOMER_07_ENV_NAMES.VITE_SUPABASE_URL] ||
      env[CUSTOMER_07_ENV_NAMES.SUPABASE_URL] ||
      ""
  ).trim();
}

/**
 * Inspect URL identity without returning the secretful full connection string
 * beyond the project-ref hint already public in docs.
 * @param {Record<string, string|undefined>} env
 */
export function inspectCustomer07EnvironmentIdentity(env = {}) {
  const url = resolveCustomer07SupabaseUrl(env);
  const appEnv = String(env[CUSTOMER_07_ENV_NAMES.VITE_APP_ENV] || "")
    .trim()
    .toLowerCase();

  let projectRefHint = null;
  for (const ref of CUSTOMER_07_STAGING_PROJECT_REF_ALLOWLIST) {
    if (url.includes(ref)) {
      projectRefHint = ref;
      break;
    }
  }

  const containsProductionRef = CUSTOMER_07_PRODUCTION_PROJECT_REF_BLOCKLIST.some(
    (ref) => url.includes(ref)
  );
  const containsProductionDomain = CUSTOMER_07_PRODUCTION_DOMAIN_BLOCKLIST.some(
    (domain) => url.toLowerCase().includes(domain)
  );

  /** @type {string[]} */
  const errors = [];
  if (!url) {
    errors.push("Supabase Staging URL is missing.");
  }
  if (containsProductionRef) {
    errors.push("Production project ref detected in Supabase URL.");
  }
  if (containsProductionDomain) {
    errors.push("Production domain pickvn.app detected in Supabase URL.");
  }
  if (url && !projectRefHint) {
    errors.push(
      `URL does not contain Staging allowlist ref ${CUSTOMER_07_STAGING_PROJECT_REF}.`
    );
  }
  if (appEnv === "production") {
    errors.push("VITE_APP_ENV=production is incompatible with Staging apply.");
  }

  // Reject Production service-role key usage: require STAGING_SUPABASE_SERVICE_ROLE_KEY
  // when any service role is present, and never accept a URL with Production ref.
  const stagingService = present(
    env[CUSTOMER_07_ENV_NAMES.STAGING_SERVICE_ROLE_KEY]
  );
  const genericService = present(env.SUPABASE_SERVICE_ROLE_KEY);
  if (genericService && !stagingService) {
    errors.push(
      "Generic SUPABASE_SERVICE_ROLE_KEY without STAGING_SUPABASE_SERVICE_ROLE_KEY is refused."
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    environmentLabel: CUSTOMER_07_ENVIRONMENT_LABEL,
    projectRefHint,
    hostnameHint: projectRefHint
      ? `${projectRefHint}.supabase.co`
      : null,
    urlPresent: Boolean(url),
    containsStagingAllowlist: projectRefHint != null,
    containsProductionRef,
    containsProductionDomain,
    urlValuePrinted: false,
    isProduction: false,
    servesPickvnApp: false,
  };
}

/**
 * @param {{
 *   repoRoot?: string,
 *   env?: Record<string, string|undefined>,
 *   preApplyObjectState?: {
 *     customerTablesPresent?: boolean,
 *     customerRowCount?: number,
 *     nonTestCustomerRowCount?: number,
 *     importantDataPresent?: boolean,
 *     queried?: boolean,
 *   } | null,
 * }} [options]
 */
export function evaluateCustomer07BackupRollbackGate(options = {}) {
  const repoRoot = options.repoRoot || getCustomer07RepoRoot();
  const env = options.env || {};
  const state = options.preApplyObjectState || null;
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const notes = [];

  const rollbackPresence = CUSTOMER_07_ROLLBACK_PATHS.map((rel) => {
    const abs = path.join(repoRoot, rel);
    const ok = existsSync(abs);
    if (!ok) errors.push(`Missing rollback/soft-disable script: ${rel}`);
    return { path: rel, present: ok };
  });

  const softDisableOk = existsSync(
    path.join(repoRoot, CUSTOMER_07_SOFT_DISABLE_RELATIVE_PATH)
  );
  if (!softDisableOk) {
    errors.push("CUSTOMER-07 soft-disable script missing.");
  }

  const ownerBackupToken = present(env[CUSTOMER_07_ENV_NAMES.BACKUP_EVIDENCE]);
  const ownerBackupPath = String(
    env[CUSTOMER_07_ENV_NAMES.BACKUP_EVIDENCE_PATH] || ""
  ).trim();
  const ownerBackupPathExists =
    ownerBackupPath.length > 0 && existsSync(ownerBackupPath);

  if (ownerBackupToken || ownerBackupPathExists) {
    notes.push("Owner backup evidence token/path present.");
  }

  // First-apply / empty Customer schema is acceptable rollback risk when
  // executable reverse SQL + soft-disable scripts exist.
  if (state && state.queried === true) {
    const nonTest = Number(state.nonTestCustomerRowCount || 0);
    const important =
      state.importantDataPresent === true ||
      (state.customerTablesPresent === true && nonTest > 0);
    if (important && !ownerBackupToken && !ownerBackupPathExists) {
      errors.push(
        "Staging has non-test Customer data but no Owner backup evidence."
      );
    } else if (!state.customerTablesPresent) {
      notes.push(
        "Pre-apply: Customer tables absent — first-apply rollback via phase SQL is reasonable."
      );
    } else if (nonTest === 0) {
      notes.push(
        "Pre-apply: Customer tables present but only empty/test rows — rollback scripts sufficient."
      );
    }
  } else {
    notes.push(
      "Live pre-apply object state not yet queried; gate requires queried state before write."
    );
    // Without queried state, allow static rollback inventory PASS only when
    // Owner backup evidence exists; otherwise require queried state.
    if (!ownerBackupToken && !ownerBackupPathExists) {
      errors.push(
        "Backup/rollback gate requires pre-apply object state query or Owner backup evidence."
      );
    }
  }

  // Migrations must not be destructive outside Customer namespace — static note.
  notes.push(
    "Forward migrations are additive Customer-scoped DDL; rollback scripts DROP only Customer objects."
  );

  return {
    ok: errors.length === 0,
    errors,
    notes,
    rollbackPresence,
    softDisablePresent: softDisableOk,
    ownerBackupEvidencePresent: ownerBackupToken || ownerBackupPathExists,
    preApplyObjectState: state,
    evidenceValuePrinted: false,
  };
}

/**
 * @param {Record<string, string|undefined>} env
 */
export function evaluateCustomer07CredentialsGate(env = {}) {
  /** @type {string[]} */
  const errors = [];
  const accessToken = present(env[CUSTOMER_07_ENV_NAMES.ACCESS_TOKEN]);
  const stagingService = present(
    env[CUSTOMER_07_ENV_NAMES.STAGING_SERVICE_ROLE_KEY]
  );
  const anon = present(
    env[CUSTOMER_07_ENV_NAMES.STAGING_ANON_KEY] ||
      env[CUSTOMER_07_ENV_NAMES.VITE_ANON_KEY]
  );
  const urlOk = present(resolveCustomer07SupabaseUrl(env));

  if (!urlOk) errors.push("Staging Supabase URL missing.");
  if (!accessToken) {
    errors.push("SUPABASE_ACCESS_TOKEN missing (required for Staging SQL apply).");
  }
  if (!stagingService) {
    errors.push(
      "STAGING_SUPABASE_SERVICE_ROLE_KEY missing (required for live repository certification)."
    );
  }
  if (!anon) {
    errors.push("Staging anon key missing (required for RLS role certification).");
  }

  return {
    ok: errors.length === 0,
    errors,
    accessTokenPresent: accessToken,
    stagingServiceRolePresent: stagingService,
    stagingAnonPresent: anon,
    urlPresent: urlOk,
    secretsPrinted: false,
  };
}

/**
 * @param {{ repoRoot?: string }} [options]
 */
export function evaluateCustomer07SafetyBaseline(options = {}) {
  const repoRoot = options.repoRoot || getCustomer07RepoRoot();
  /** @type {string[]} */
  const errors = [];
  /** @type {Record<string, unknown>} */
  const facts = {
    repoRoot,
    branch: null,
    head: null,
    originMain: null,
    workingTreeClean: null,
    customer06InHistory: null,
    crmSafetyStashPresent: null,
    packageJsonUnchanged: null,
    lockfileUnchanged: null,
  };

  try {
    facts.branch = execSync("git branch --show-current", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    facts.head = execSync("git rev-parse HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    facts.originMain = execSync("git rev-parse origin/main", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    const porcelain = execSync("git status --porcelain", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    facts.workingTreeClean = porcelain.length === 0;
    if (!facts.workingTreeClean) {
      // During implementation the tree will be dirty; baseline records state only.
      facts.workingTreeDirtyPreview = porcelain
        .split("\n")
        .slice(0, 20)
        .map((line) => line.slice(0, 120));
    }

    if (
      facts.branch !==
      "feature/customer-management-phase-7-staging-live-certification"
    ) {
      errors.push(`Wrong branch: ${facts.branch}`);
    }

    const stashList = execSync("git stash list", {
      cwd: repoRoot,
      encoding: "utf8",
    });
    facts.crmSafetyStashPresent = CUSTOMER_07_CRM_SAFETY_STASH_MARKERS.every(
      (marker) => stashList.includes(marker)
    );
    if (!facts.crmSafetyStashPresent) {
      errors.push("CRM safety stash marker missing from git stash list.");
    }

    // CUSTOMER-06 merge commit on origin/main ancestry.
    try {
      execSync("git merge-base --is-ancestor 5349f1cf HEAD", {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "ignore", "ignore"],
      });
      facts.customer06InHistory = true;
    } catch {
      facts.customer06InHistory = false;
      errors.push("CUSTOMER-06 commit 5349f1cf is not an ancestor of HEAD.");
    }

    // package/lockfile must match HEAD (no local edits).
    const pkgDiff = execSync("git diff --name-only HEAD -- package.json package-lock.json", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    facts.packageJsonUnchanged = !pkgDiff.includes("package.json");
    facts.lockfileUnchanged = !pkgDiff.includes("package-lock.json");
    if (!facts.packageJsonUnchanged || !facts.lockfileUnchanged) {
      errors.push("package.json and/or package-lock.json differ from HEAD.");
    }
  } catch (err) {
    errors.push(`Safety baseline git probe failed: ${err?.message || String(err)}`);
  }

  return {
    ok: errors.length === 0 || (errors.length === 1 && !facts.workingTreeClean && errors[0]?.includes?.("Wrong branch") === false && facts.branch === "feature/customer-management-phase-7-staging-live-certification"),
    // Soft: dirty tree during implementation is expected; hard errors are branch/stash/packages.
    hardOk:
      facts.branch ===
        "feature/customer-management-phase-7-staging-live-certification" &&
      facts.crmSafetyStashPresent === true &&
      facts.customer06InHistory === true &&
      facts.packageJsonUnchanged === true &&
      facts.lockfileUnchanged === true,
    errors,
    facts,
  };
}

/**
 * Aggregate pre-write gates.
 * @param {{
 *   env?: Record<string, string|undefined>,
 *   repoRoot?: string,
 *   preApplyObjectState?: object|null,
 *   requireCleanTree?: boolean,
 * }} [options]
 */
export function evaluateCustomer07PreWriteGates(options = {}) {
  const env = options.env || process.env;
  const repoRoot = options.repoRoot || getCustomer07RepoRoot();

  const safety = evaluateCustomer07SafetyBaseline({ repoRoot });
  const identity = inspectCustomer07EnvironmentIdentity(env);
  const backup = evaluateCustomer07BackupRollbackGate({
    repoRoot,
    env,
    preApplyObjectState: options.preApplyObjectState,
  });
  const credentials = evaluateCustomer07CredentialsGate(env);
  const manifestVerify = verifyCustomer07MigrationManifest({ repoRoot });

  /** @type {string[]} */
  const blocking = [];
  if (!safety.hardOk) {
    blocking.push(...safety.errors);
  }
  if (options.requireCleanTree && safety.facts.workingTreeClean === false) {
    blocking.push("Working tree is dirty.");
  }
  if (!identity.ok) blocking.push(...identity.errors);
  if (!backup.ok) blocking.push(...backup.errors);
  if (!credentials.ok) blocking.push(...credentials.errors);
  if (!manifestVerify.ok) blocking.push(...(manifestVerify.errors || []));

  let verdict = null;
  if (!identity.ok) {
    verdict = CUSTOMER_07_VERDICTS.BLOCKED_ENVIRONMENT_IDENTITY;
  } else if (!backup.ok) {
    verdict = CUSTOMER_07_VERDICTS.BLOCKED_BACKUP_ROLLBACK;
  } else if (blocking.length > 0) {
    verdict = CUSTOMER_07_VERDICTS.BLOCKED;
  }

  return {
    canWrite: blocking.length === 0,
    verdict,
    blocking,
    safety,
    identity,
    backup,
    credentials,
    manifestVerify,
    secretsPrinted: false,
    productionConnected: false,
  };
}

/**
 * Read optional Owner decision JSON (no secrets).
 * @param {string} [repoRoot]
 */
export function loadCustomer07OwnerDecision(repoRoot) {
  const root = repoRoot || getCustomer07RepoRoot();
  const abs = path.join(
    root,
    "docs/customer-management/phase-7/OWNER_STAGING_APPLY_APPROVAL.json"
  );
  if (!existsSync(abs)) return null;
  try {
    const raw = JSON.parse(readFileSync(abs, "utf8"));
    if (!raw || raw.phase !== "CUSTOMER-07") return null;
    if (raw.environmentTarget !== "staging") return null;
    if (raw.productionApplyApproved === true) return null;
    return raw;
  } catch {
    return null;
  }
}
