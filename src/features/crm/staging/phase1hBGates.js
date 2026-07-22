/**
 * CRM Phase 1H-B — controlled Staging apply gates (fail-closed).
 *
 * Separate Owner approval gates (never inferred from code merge):
 * 1. Permission seed apply
 * 2. Role matrix apply (optional — may defer)
 * 3. Phase 1G CRM persistence migration apply
 * 4. Staging backup/restore evidence (separate gate; never inferred)
 *
 * Apply approvals (1–3 + umbrella) may be satisfied by:
 *   - matching CLI token ↔ env token, OR
 *   - documented Owner decision JSON (Staging-only limited approval)
 *
 * Backup is never satisfied by apply-approval docs alone.
 * Plus Staging identity, credentials, QA identity, and runtime safety gates.
 * Never prints secret values.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  CRM_PRODUCTION_PROJECT_REF_BLOCKLIST,
  CRM_STAGING_PROJECT_REF_ALLOWLIST,
  verifyCrmStagingMigrationManifest,
  loadCrmStagingMigrationManifest,
  getCrmPhase1hRepoRoot,
} from "./migrationManifest.js";
import { getCrmDefaultRuntimePersistenceMode } from "../persistence/runtimeCompositionGuard.js";

/** Allowed final verdicts for Phase 1H-B. */
export const CRM_PHASE_1H_B_VERDICTS = Object.freeze({
  BLOCKED_APPROVAL_REQUIRED: "CRM_PHASE_1H_B_BLOCKED_APPROVAL_REQUIRED",
  BLOCKED_STAGING_IDENTITY_UNVERIFIED:
    "CRM_PHASE_1H_B_BLOCKED_STAGING_IDENTITY_UNVERIFIED",
  BLOCKED_BACKUP_REQUIRED: "CRM_PHASE_1H_B_BLOCKED_BACKUP_REQUIRED",
  BLOCKED_CREDENTIALS_REQUIRED: "CRM_PHASE_1H_B_BLOCKED_CREDENTIALS_REQUIRED",
  BLOCKED_QA_IDENTITIES_REQUIRED: "CRM_PHASE_1H_B_BLOCKED_QA_IDENTITIES_REQUIRED",
  APPLY_FAILED: "CRM_PHASE_1H_B_APPLY_FAILED",
  QA_FAILED: "CRM_PHASE_1H_B_QA_FAILED",
  READY_FOR_COMMIT_REVIEW: "READY_FOR_PHASE_1H_B_COMMIT_REVIEW",
});

/** Documented Owner limited Staging approval (no secrets). */
export const CRM_PHASE_1H_B_OWNER_DECISION_RELATIVE_PATH =
  "docs/crm/phase-1h-b/OWNER_LIMITED_STAGING_APPROVAL.json";

/** Dedicated Staging QA identity roles required for live authz QA. */
export const CRM_PHASE_1H_B_REQUIRED_QA_IDENTITY_ROLES = Object.freeze([
  "SUPER_ADMIN",
  "TENANT_OWNER_OR_VENUE_OWNER",
  "VENUE_MANAGER",
  "STAFF",
  "PLAYER",
  "CUSTOMER",
  "UNAUTHENTICATED",
]);

/** Env var names for approval / backup tokens (values never printed). */
export const CRM_PHASE_1H_B_ENV_NAMES = Object.freeze({
  APP_ENV: "VITE_APP_ENV",
  SUPABASE_URL: "VITE_SUPABASE_URL",
  SUPABASE_URL_ALT: "SUPABASE_URL",
  STAGING_SUPABASE_URL: "STAGING_SUPABASE_URL",
  ANON_KEY: "VITE_SUPABASE_ANON_KEY",
  ACCESS_TOKEN: "SUPABASE_ACCESS_TOKEN",
  OWNER_APPROVAL: "CRM_STAGING_OWNER_APPROVAL",
  BACKUP_EVIDENCE: "CRM_STAGING_BACKUP_EVIDENCE",
  BACKUP_EVIDENCE_PATH: "CRM_STAGING_BACKUP_EVIDENCE_PATH",
  PERMISSION_SEED_APPROVAL: "CRM_IDENTITY_PERMISSION_SEED_APPROVAL",
  ROLE_MATRIX_APPROVAL: "CRM_IDENTITY_ROLE_MATRIX_APPROVAL",
  PHASE_1G_APPLY_APPROVAL: "CRM_PHASE_1G_PERSISTENCE_APPLY_APPROVAL",
  QA_IDENTITIES_READY: "CRM_STAGING_QA_IDENTITIES_READY",
  PERSISTENCE_MODE: "VITE_CRM_PERSISTENCE_MODE",
});

/**
 * @param {string|undefined|null} value
 * @returns {boolean}
 */
export function isEnvTokenPresent(value) {
  return value != null && String(value).trim() !== "";
}

/**
 * @param {string|undefined|null} flag
 * @param {string|undefined|null} expected
 * @returns {boolean}
 */
export function tokensMatch(flag, expected) {
  if (!isEnvTokenPresent(flag) || !isEnvTokenPresent(expected)) return false;
  return String(flag).trim() === String(expected).trim();
}

/**
 * @param {Record<string, string|undefined>} [env]
 */
function presence(env, name) {
  return {
    name,
    set: isEnvTokenPresent(env?.[name]),
    valuePrinted: false,
  };
}

/**
 * Load documented Owner limited Staging approval (no secrets).
 * @param {string} [repoRoot]
 * @returns {object|null}
 */
export function loadCrmPhase1hBOwnerDecision(repoRoot) {
  const root = repoRoot || getCrmPhase1hRepoRoot();
  const abs = path.join(root, CRM_PHASE_1H_B_OWNER_DECISION_RELATIVE_PATH);
  if (!existsSync(abs)) return null;
  try {
    const raw = JSON.parse(readFileSync(abs, "utf8"));
    if (!raw || raw.phase !== "1H-B") return null;
    if (raw.environmentTarget !== "staging") return null;
    if (raw.productionApplyApproved === true) return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Resolve candidate Supabase URL without returning the full value.
 * @param {Record<string, string|undefined>} env
 */
export function inspectSupabaseUrlIdentity(env = {}) {
  const url = String(
    env[CRM_PHASE_1H_B_ENV_NAMES.STAGING_SUPABASE_URL] ||
      env[CRM_PHASE_1H_B_ENV_NAMES.SUPABASE_URL] ||
      env[CRM_PHASE_1H_B_ENV_NAMES.SUPABASE_URL_ALT] ||
      ""
  ).trim();

  const containsProductionBlocklist = CRM_PRODUCTION_PROJECT_REF_BLOCKLIST.some(
    (ref) => url.includes(ref)
  );
  let projectRefHint = null;
  for (const ref of CRM_STAGING_PROJECT_REF_ALLOWLIST) {
    if (url.includes(ref)) {
      projectRefHint = ref;
      break;
    }
  }
  return {
    present: url.length > 0,
    containsStagingAllowlist: projectRefHint != null,
    containsProductionBlocklist,
    projectRefHint,
    urlValuePrinted: false,
  };
}

/**
 * Evaluate Owner apply-approval gates (permission seed / Phase 1G / umbrella / role matrix).
 * Backup is evaluated separately and is never satisfied by this gate alone.
 *
 * @param {{
 *   env?: Record<string, string|undefined>,
 *   flags?: object,
 *   ownerDecision?: object|null,
 * }} [options]
 */
export function evaluateCrmPhase1hBApprovalGates(options = {}) {
  const env = options.env || {};
  const flags = options.flags || {};
  const decision = options.ownerDecision || null;

  const decisionDefersRoleMatrix =
    decision?.roleMatrixApplyApproved === false ||
    decision?.deferRoleMatrix === true;
  const deferRoleMatrix =
    flags.deferRoleMatrix === true || decisionDefersRoleMatrix;

  const permissionSeedApprovedByDecision =
    decision?.permissionSeedApplyApproved === true &&
    decision?.environmentTarget === "staging";
  const phase1gApprovedByDecision =
    decision?.phase1gPersistenceApplyApproved === true &&
    decision?.environmentTarget === "staging";
  const ownerUmbrellaByDecision =
    decision?.limitedStagingApplyUmbrellaApproved === true &&
    decision?.environmentTarget === "staging" &&
    decision?.productionApplyApproved !== true;

  const permissionSeed = {
    gate: "permission_seed_apply",
    required: true,
    approved:
      permissionSeedApprovedByDecision ||
      tokensMatch(
        flags.permissionSeedApproval,
        env[CRM_PHASE_1H_B_ENV_NAMES.PERMISSION_SEED_APPROVAL]
      ),
    source: permissionSeedApprovedByDecision
      ? "owner_decision_document"
      : "cli_env_token_match",
    envName: CRM_PHASE_1H_B_ENV_NAMES.PERMISSION_SEED_APPROVAL,
    envSet: isEnvTokenPresent(
      env[CRM_PHASE_1H_B_ENV_NAMES.PERMISSION_SEED_APPROVAL]
    ),
    flagProvided: isEnvTokenPresent(flags.permissionSeedApproval),
  };

  const phase1g = {
    gate: "phase_1g_persistence_apply",
    required: true,
    approved:
      phase1gApprovedByDecision ||
      tokensMatch(
        flags.phase1gApplyApproval,
        env[CRM_PHASE_1H_B_ENV_NAMES.PHASE_1G_APPLY_APPROVAL]
      ),
    source: phase1gApprovedByDecision
      ? "owner_decision_document"
      : "cli_env_token_match",
    envName: CRM_PHASE_1H_B_ENV_NAMES.PHASE_1G_APPLY_APPROVAL,
    envSet: isEnvTokenPresent(
      env[CRM_PHASE_1H_B_ENV_NAMES.PHASE_1G_APPLY_APPROVAL]
    ),
    flagProvided: isEnvTokenPresent(flags.phase1gApplyApproval),
  };

  const ownerOverall = {
    gate: "staging_owner_apply_umbrella",
    required: true,
    approved:
      ownerUmbrellaByDecision ||
      tokensMatch(
        flags.ownerApproval,
        env[CRM_PHASE_1H_B_ENV_NAMES.OWNER_APPROVAL]
      ),
    source: ownerUmbrellaByDecision
      ? "owner_decision_document"
      : "cli_env_token_match",
    envName: CRM_PHASE_1H_B_ENV_NAMES.OWNER_APPROVAL,
    envSet: isEnvTokenPresent(env[CRM_PHASE_1H_B_ENV_NAMES.OWNER_APPROVAL]),
    flagProvided: isEnvTokenPresent(flags.ownerApproval),
  };

  const roleMatrixApproved =
    decision?.roleMatrixApplyApproved === true ||
    tokensMatch(
      flags.roleMatrixApproval,
      env[CRM_PHASE_1H_B_ENV_NAMES.ROLE_MATRIX_APPROVAL]
    );
  const roleMatrix = {
    gate: "role_matrix_apply",
    required: !deferRoleMatrix,
    approved: roleMatrixApproved,
    deferred: deferRoleMatrix && !roleMatrixApproved,
    source:
      decision?.roleMatrixApplyApproved === false
        ? "owner_decision_deferred"
        : "cli_env_token_match",
    envName: CRM_PHASE_1H_B_ENV_NAMES.ROLE_MATRIX_APPROVAL,
    envSet: isEnvTokenPresent(env[CRM_PHASE_1H_B_ENV_NAMES.ROLE_MATRIX_APPROVAL]),
    flagProvided: isEnvTokenPresent(flags.roleMatrixApproval),
  };

  const backupStatus = {
    gate: "staging_backup_restore_evidence",
    requiredForWrite: true,
    approvedByOwnerDecision: decision?.backupRestoreApproved === true,
    note: "Backup never inferred from apply approvals or Phase 1H-A merge.",
  };

  const requiredMissing = [permissionSeed, phase1g, ownerOverall].filter(
    (g) => !g.approved
  );
  if (roleMatrix.required && !roleMatrix.approved) {
    requiredMissing.push(roleMatrix);
  }

  return Object.freeze({
    ok: requiredMissing.length === 0,
    requiredMissing: requiredMissing.map((g) => g.gate),
    permissionSeed,
    roleMatrix,
    phase1g,
    ownerOverall,
    backupStatus,
    ownerDecisionLoaded: Boolean(decision),
    note: "Apply approvals are never inferred from Phase 1H-A code merge alone.",
  });
}

/**
 * Staging identity gate (section C).
 * @param {{ env?: Record<string, string|undefined>, environmentFlag?: string|null }} [options]
 */
export function evaluateCrmPhase1hBStagingIdentityGate(options = {}) {
  const env = options.env || {};
  const decision = options.ownerDecision || null;
  const environmentFlag = String(
    options.environmentFlag || env[CRM_PHASE_1H_B_ENV_NAMES.APP_ENV] || ""
  )
    .trim()
    .toLowerCase();
  const urlIdentity = inspectSupabaseUrlIdentity(env);
  const appEnv = String(env[CRM_PHASE_1H_B_ENV_NAMES.APP_ENV] || "")
    .trim()
    .toLowerCase();

  const decisionRef = String(decision?.stagingProjectRefVerified || "").trim();
  const decisionIdentityOk =
    decision?.stagingIdentityVerified === true &&
    decisionRef === CRM_STAGING_PROJECT_REF_ALLOWLIST[0] &&
    decision?.environmentTarget === "staging" &&
    decision?.productionApplyApproved !== true;

  /** @type {string[]} */
  const errors = [];

  if (environmentFlag !== "staging") {
    errors.push("Explicit environment must be staging.");
  }
  if (appEnv && appEnv !== "staging") {
    errors.push("VITE_APP_ENV must be staging when set (got non-staging).");
  }
  if (urlIdentity.containsProductionBlocklist) {
    errors.push("Production project reference detected in Supabase URL (blocklisted).");
  }
  if (urlIdentity.present && !urlIdentity.containsStagingAllowlist) {
    errors.push(
      "Supabase URL does not contain Staging allowlisted project reference."
    );
  }

  const urlProvesStaging =
    urlIdentity.present &&
    urlIdentity.containsStagingAllowlist &&
    !urlIdentity.containsProductionBlocklist;

  if (!urlProvesStaging && !decisionIdentityOk) {
    errors.push("Supabase URL unset - Staging project identity cannot be proven.");
  }
  if (!appEnv && !options.environmentFlag && !decisionIdentityOk) {
    errors.push("No explicit staging environment assertion available.");
  }

  const ok =
    errors.length === 0 &&
    environmentFlag === "staging" &&
    (urlProvesStaging || decisionIdentityOk);

  return Object.freeze({
    ok,
    errors: ok ? [] : errors,
    environmentFlag: environmentFlag || null,
    appEnvSet: Boolean(appEnv),
    appEnvIsStaging: appEnv === "staging",
    productionBlocklist: [...CRM_PRODUCTION_PROJECT_REF_BLOCKLIST],
    stagingAllowlist: [...CRM_STAGING_PROJECT_REF_ALLOWLIST],
    urlIdentity: {
      present: urlIdentity.present,
      containsStagingAllowlist: urlIdentity.containsStagingAllowlist,
      containsProductionBlocklist: urlIdentity.containsProductionBlocklist,
      projectRefHint: urlIdentity.projectRefHint || (decisionIdentityOk ? decisionRef : null),
      valuePrinted: false,
    },
    identitySource: urlProvesStaging
      ? "allowlisted_project_ref_in_supabase_url"
      : decisionIdentityOk
        ? "owner_decision_mcp_verified_staging_ref"
        : "unverified",
  });
}

/**
 * Backup / restore gate (section D).
 * Owner apply approvals alone never satisfy this gate.
 * @param {{
 *   env?: Record<string, string|undefined>,
 *   flags?: { backupEvidence?: string|null },
 *   ownerDecision?: object|null,
 * }} [options]
 */
export function evaluateCrmPhase1hBBackupGate(options = {}) {
  const env = options.env || {};
  const flags = options.flags || {};
  const decision = options.ownerDecision || null;
  const repoRoot = options.repoRoot || getCrmPhase1hRepoRoot();

  if (decision && decision.backupRestoreApproved === false) {
    return Object.freeze({
      ok: false,
      errors: [
        "Owner decision explicitly denies backup/restore approval for this wave.",
      ],
      recoveryMethod: null,
      evidencePathSet: isEnvTokenPresent(
        env[CRM_PHASE_1H_B_ENV_NAMES.BACKUP_EVIDENCE_PATH]
      ),
      evidencePathValuePrinted: false,
      timestampRecorded: false,
      scope: "staging_crm_phase_1h_b",
      limitations:
        "Owner limited Staging approval does not include backup/restore. Do not infer backup readiness.",
      ownerDecisionDeniesBackup: true,
    });
  }

  const evidenceRel =
    String(decision?.recoveryEvidencePath || "").trim() ||
    String(env[CRM_PHASE_1H_B_ENV_NAMES.BACKUP_EVIDENCE_PATH] || "").trim();
  const rollbackRel = String(decision?.rollbackSqlPath || "").trim();
  const evidenceAbs = evidenceRel ? path.join(repoRoot, evidenceRel) : "";
  const rollbackAbs = rollbackRel ? path.join(repoRoot, rollbackRel) : "";
  const evidenceFileOk = Boolean(evidenceAbs && existsSync(evidenceAbs));
  const rollbackFileOk = Boolean(rollbackAbs && existsSync(rollbackAbs));

  const rollbackOnlyApproved =
    decision?.backupRestoreApproved === true &&
    decision?.recoveryMethod === "rollback-only" &&
    decision?.environmentTarget === "staging" &&
    decision?.productionApplyApproved !== true &&
    evidenceFileOk &&
    rollbackFileOk &&
    !decision?.backupPitrClaimed;

  const tokenOk = tokensMatch(
    flags.backupEvidence,
    env[CRM_PHASE_1H_B_ENV_NAMES.BACKUP_EVIDENCE]
  );
  const pathSet =
    isEnvTokenPresent(env[CRM_PHASE_1H_B_ENV_NAMES.BACKUP_EVIDENCE_PATH]) ||
    evidenceFileOk;

  /** @type {string[]} */
  const errors = [];
  if (!rollbackOnlyApproved && !tokenOk) {
    errors.push("Backup evidence token missing or mismatched.");
  }
  if (!rollbackOnlyApproved && !pathSet) {
    errors.push(
      "CRM_STAGING_BACKUP_EVIDENCE_PATH unset - recovery evidence path required."
    );
  }
  if (decision?.backupRestoreApproved === true && !rollbackOnlyApproved) {
    if (!evidenceFileOk) {
      errors.push("Approved recovery evidence file missing on disk.");
    }
    if (!rollbackFileOk) {
      errors.push("Approved rollback SQL file missing on disk.");
    }
    if (decision?.backupPitrClaimed === true) {
      errors.push("PITR/backup snapshot must not be claimed without Dashboard verification.");
    }
  }

  const ok = rollbackOnlyApproved || (tokenOk && pathSet);

  return Object.freeze({
    ok,
    errors: ok ? [] : errors,
    recoveryMethod: rollbackOnlyApproved
      ? "rollback-only"
      : pathSet
        ? "owner_documented_path_marker"
        : null,
    evidencePathSet: pathSet,
    evidencePath: evidenceRel || null,
    rollbackSqlPath: rollbackRel || null,
    evidencePathValuePrinted: false,
    timestampRecorded: Boolean(decision?.recoveryApprovedAt),
    scope: "staging_crm_phase_1h_b",
    limitations: rollbackOnlyApproved
      ? "Rollback-only recovery approved for Staging first-apply. No PITR/backup snapshot claimed."
      : "Gate requires Owner-provided token + evidence path; no backup is claimed without evidence.",
    ownerDecisionDeniesBackup: false,
    backupPitrClaimed: decision?.backupPitrClaimed === true,
  });
}

/**
 * Credentials required to apply via Supabase Management API (Staging only).
 * @param {{ env?: Record<string, string|undefined> }} [options]
 */
export function evaluateCrmPhase1hBCredentialsGate(options = {}) {
  const env = options.env || {};
  const accessTokenSet = isEnvTokenPresent(
    env[CRM_PHASE_1H_B_ENV_NAMES.ACCESS_TOKEN]
  );
  const urlOk = inspectSupabaseUrlIdentity(env);
  /** @type {string[]} */
  const errors = [];
  if (!accessTokenSet) {
    errors.push("SUPABASE_ACCESS_TOKEN unset.");
  }
  if (!urlOk.present || !urlOk.containsStagingAllowlist) {
    errors.push("Staging Supabase URL identity not proven for credentials gate.");
  }
  return Object.freeze({
    ok: errors.length === 0,
    errors,
    accessTokenSet,
    valuesPrinted: false,
  });
}

/**
 * Dedicated Staging QA identities marker (section G).
 * @param {{ env?: Record<string, string|undefined> }} [options]
 */
export function evaluateCrmPhase1hBQaIdentitiesGate(options = {}) {
  const env = options.env || {};
  const ready = isEnvTokenPresent(
    env[CRM_PHASE_1H_B_ENV_NAMES.QA_IDENTITIES_READY]
  );
  return Object.freeze({
    ok: ready,
    errors: ready
      ? []
      : [
          "CRM_STAGING_QA_IDENTITIES_READY unset - dedicated Staging QA identities required.",
        ],
    markerEnv: CRM_PHASE_1H_B_ENV_NAMES.QA_IDENTITIES_READY,
    requiredRoles: [...CRM_PHASE_1H_B_REQUIRED_QA_IDENTITY_ROLES],
    valuesPrinted: false,
  });
}

/**
 * Runtime safety: durable must remain off.
 * @param {{ env?: Record<string, string|undefined>, ownerDecision?: object|null }} [options]
 */
export function evaluateCrmPhase1hBRuntimeSafetyGate(options = {}) {
  const env = options.env || {};
  const decision = options.ownerDecision || null;
  const mode = String(
    env[CRM_PHASE_1H_B_ENV_NAMES.PERSISTENCE_MODE] || "memory"
  )
    .trim()
    .toLowerCase();
  const defaultMode = getCrmDefaultRuntimePersistenceMode();
  const errors = [];
  if (mode === "durable") {
    errors.push(
      "VITE_CRM_PERSISTENCE_MODE=durable - durable runtime must remain off."
    );
  }
  if (decision?.durableRuntimeApproved === true) {
    errors.push("Owner decision must not approve durable runtime in this wave.");
  }
  if (defaultMode !== "memory") {
    errors.push(
      `Default runtime persistence must be memory (got ${defaultMode}).`
    );
  }
  return Object.freeze({
    ok: errors.length === 0,
    errors,
    durableRuntime: mode === "durable" ? "on" : "off",
    defaultPersistenceMode: defaultMode,
    durableApprovedByOwner: decision?.durableRuntimeApproved === true,
  });
}

/**
 * Full Phase 1H-B pre-write gate evaluation. Stops before any DB write when blocked.
 *
 * @param {{
 *   env?: Record<string, string|undefined>,
 *   flags?: object,
 *   repoRoot?: string,
 *   requireQaIdentities?: boolean,
 *   ownerDecision?: object|null,
 *   loadOwnerDecision?: boolean,
 * }} [options]
 */
export function evaluateCrmPhase1hBPreWriteGates(options = {}) {
  const env = options.env || {};
  const flags = options.flags || {};
  const requireQaIdentities = options.requireQaIdentities !== false;
  const loadOwnerDecision = options.loadOwnerDecision !== false;
  const ownerDecision =
    options.ownerDecision !== undefined
      ? options.ownerDecision
      : loadOwnerDecision
        ? loadCrmPhase1hBOwnerDecision(options.repoRoot)
        : null;

  const manifest = loadCrmStagingMigrationManifest(options.repoRoot);
  const manifestVerify = verifyCrmStagingMigrationManifest({
    repoRoot: options.repoRoot,
    manifest,
  });

  const effectiveFlags = {
    ...flags,
    deferRoleMatrix:
      flags.deferRoleMatrix === true ||
      ownerDecision?.roleMatrixApplyApproved === false ||
      ownerDecision?.deferRoleMatrix === true,
  };

  const approvals = evaluateCrmPhase1hBApprovalGates({
    env,
    flags: effectiveFlags,
    ownerDecision,
  });
  const identity = evaluateCrmPhase1hBStagingIdentityGate({
    env,
    environmentFlag: flags.environment,
    ownerDecision,
  });
  const backup = evaluateCrmPhase1hBBackupGate({
    env,
    flags,
    ownerDecision,
    repoRoot: options.repoRoot,
  });
  const credentials = evaluateCrmPhase1hBCredentialsGate({ env });
  const qaIdentities = evaluateCrmPhase1hBQaIdentitiesGate({ env });
  const runtime = evaluateCrmPhase1hBRuntimeSafetyGate({ env, ownerDecision });

  /** @type {string|null} */
  let verdict = null;
  if (!approvals.ok) {
    verdict = CRM_PHASE_1H_B_VERDICTS.BLOCKED_APPROVAL_REQUIRED;
  } else if (!identity.ok) {
    verdict = CRM_PHASE_1H_B_VERDICTS.BLOCKED_STAGING_IDENTITY_UNVERIFIED;
  } else if (!backup.ok) {
    verdict = CRM_PHASE_1H_B_VERDICTS.BLOCKED_BACKUP_REQUIRED;
  } else if (!credentials.ok) {
    verdict = CRM_PHASE_1H_B_VERDICTS.BLOCKED_CREDENTIALS_REQUIRED;
  } else if (requireQaIdentities && !qaIdentities.ok) {
    verdict = CRM_PHASE_1H_B_VERDICTS.BLOCKED_QA_IDENTITIES_REQUIRED;
  } else if (!runtime.ok) {
    verdict = CRM_PHASE_1H_B_VERDICTS.BLOCKED_APPROVAL_REQUIRED;
  } else if (!manifestVerify.ok) {
    verdict = CRM_PHASE_1H_B_VERDICTS.APPLY_FAILED;
  }

  const canWrite = verdict == null;

  const migrations = [...(manifest.migrations || [])].sort(
    (a, b) => Number(a.order) - Number(b.order)
  );
  const roleMatrixPath =
    "docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql";
  const deferredMigrations =
    approvals.roleMatrix.deferred || !approvals.roleMatrix.approved
      ? migrations.filter((m) => m.path === roleMatrixPath).map((m) => m.path)
      : [];
  const approvedMigrations = migrations
    .filter((m) => !deferredMigrations.includes(m.path))
    .map((m) => m.path);

  return Object.freeze({
    phase: "1H-B",
    canWrite,
    verdict: canWrite ? null : verdict,
    sqlApplied: false,
    productionConnected: false,
    stagingConnected: false,
    deploy: false,
    durableRuntime: runtime.durableRuntime,
    ownerDecisionLoaded: Boolean(ownerDecision),
    ownerDecisionPath: ownerDecision
      ? CRM_PHASE_1H_B_OWNER_DECISION_RELATIVE_PATH
      : null,
    approvals,
    identity,
    backup,
    credentials,
    qaIdentities,
    runtime,
    manifestVerify: {
      ok: manifestVerify.ok,
      checked: manifestVerify.checked || 0,
      errors: manifestVerify.errors || [],
    },
    migrationPlan: {
      approvedForApply: approvedMigrations,
      deferred: deferredMigrations,
      stopOnFirstError: true,
      reorderForbidden: true,
      editSqlForbidden: true,
    },
    envPresence: Object.fromEntries(
      Object.values(CRM_PHASE_1H_B_ENV_NAMES).map((name) => [
        name,
        presence(env, name),
      ])
    ),
    localSecureEnvSourcesChecked: [
      ".env",
      ".env.local",
      ".env.development",
      ".env.development.local",
      ".env.staging-qa.local",
      "../pickleball-scheduler/.env.staging-qa.local",
    ],
    secretsPrinted: false,
  });
}

/**
 * Migration subset classification for reporting.
 * @param {object} manifest
 * @param {{ deferRoleMatrix?: boolean, roleMatrixApproved?: boolean }} options
 */
export function classifyCrmPhase1hBMigrationPlan(manifest, options = {}) {
  const deferRoleMatrix =
    options.deferRoleMatrix === true || options.roleMatrixApproved !== true;
  const roleMatrixPath =
    "docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql";
  const ordered = [...(manifest.migrations || [])].sort(
    (a, b) => Number(a.order) - Number(b.order)
  );
  const apply = [];
  const deferred = [];
  for (const entry of ordered) {
    if (deferRoleMatrix && entry.path === roleMatrixPath) {
      deferred.push(entry);
    } else {
      apply.push(entry);
    }
  }
  return Object.freeze({ apply, deferred });
}
