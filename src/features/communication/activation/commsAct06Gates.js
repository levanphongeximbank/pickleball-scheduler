/**
 * COMMS-ACT-06 — Production readiness release gate (static / fail-closed).
 * Never connects to a database. Never mutates Production.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
  isEnvTokenPresent,
} from "./stagingTarget.js";
import {
  COMMS_ACT_06_CAPABILITY_SCOPE,
  COMMS_ACT_06_ENV_NAMES,
  COMMS_ACT_06_PROD_SMOKE_MARKER,
  COMMS_ACT_06_PRODUCTION_ENABLE_TOKEN,
  evaluateCommunicationProductionRefGate,
  evaluateCommsProductionTargetIdentity,
} from "./productionTarget.js";
import {
  COMMUNICATION_TRUSTED_BACKEND_HOST,
} from "../trustedBackend/constants.js";
import { evaluateCommsAct05TrustedBackendHost } from "./commsAct05Gates.js";
import {
  COMMS_ACT_01_FORWARD_SQL_RELATIVE,
  COMMS_ACT_01_ROLLBACK_SQL_RELATIVE,
} from "./stagingTarget.js";
import {
  COMMS_ACT_03_FORWARD_SQL_RELATIVE,
  COMMS_ACT_03_ROLLBACK_SQL_RELATIVE,
} from "./commsAct03SqlManifest.js";
import { getCommunicationActivationSnapshot } from "../persistence/activationGates.js";

export const COMMS_ACT_06_VERDICTS = Object.freeze({
  READY_FOR_PRODUCTION_OWNER_GO: "READY_FOR_PRODUCTION_OWNER_GO",
  READY_WITH_REMEDIATION_REQUIRED: "READY_WITH_REMEDIATION_REQUIRED",
  BLOCKED_PRODUCTION_ENVIRONMENT: "BLOCKED_PRODUCTION_ENVIRONMENT",
  BLOCKED_PRODUCTION_SCHEMA: "BLOCKED_PRODUCTION_SCHEMA",
  BLOCKED_SECURITY: "BLOCKED_SECURITY",
  BLOCKED_BACKUP_RECOVERY: "BLOCKED_BACKUP_RECOVERY",
  BLOCKED_OBSERVABILITY: "BLOCKED_OBSERVABILITY",
  BLOCKED_TEST_IDENTITIES: "BLOCKED_TEST_IDENTITIES",
  BLOCKED_DEPLOYMENT_HOST: "BLOCKED_DEPLOYMENT_HOST",
});

export const COMMS_ACT_06_RISK_CLASS = Object.freeze({
  RELEASE_BLOCKER: "RELEASE_BLOCKER",
  REQUIRED_BEFORE_SCALE: "REQUIRED_BEFORE_SCALE",
  DEFERRED_NON_BLOCKING: "DEFERRED_NON_BLOCKING",
});

export const COMMS_ACT_06_DOCS_RELATIVE =
  "docs/communication-foundation/activation/comms-act-06";

export const COMMS_ACT_06_REQUIRED_DOCS = Object.freeze([
  "06_PRODUCTION_READINESS.md",
  "06_FRESH_MAIN_ARCHITECTURE_AUDIT.md",
  "06_PRODUCTION_ENVIRONMENT_AUDIT.md",
  "06_PRODUCTION_DATABASE_AUDIT.md",
  "06_SECURITY_ABUSE_READINESS.md",
  "06_RELIABILITY_OPERATIONS.md",
  "06_BACKUP_PLAN.md",
  "06_PRODUCTION_BACKUP_SCRIPT_CONTRACT.md",
  "06_RELEASE_ROLLBACK_PACKAGE.md",
  "06_PRODUCTION_SMOKE_DESIGN.md",
  "06_RELEASE_GATE_VERDICT.md",
  "06_OWNER_GO_PACKAGE.md",
]);

/** CI-verifiable backup contract (inside repository). */
export const COMMS_ACT_06_BACKUP_CONTRACT_RELATIVE =
  "scripts/communication/comms-act-07-production-logical-backup.template.ps1";

/** Documented Owner-local executable — never a CI existence prerequisite. */
export const COMMS_ACT_06_OWNER_LOCAL_BACKUP_SCRIPT_PATH =
  "C:\\Users\\Le Phong\\PICK_VN-Backups\\create-comms-act-07-production-logical-backup.ps1";

export const COMMS_ACT_06_BACKUP_EVIDENCE = Object.freeze({
  OWNER_LOCAL_BACKUP_SCRIPT_PREPARED: "YES",
  OWNER_LOCAL_BACKUP_SCRIPT_EXECUTED: "NO",
  CI_EXTERNAL_FILE_EXISTENCE_REQUIRED: "NO",
  REPOSITORY_BACKUP_CONTRACT_VERIFIED: "YES",
  PRODUCTION_LOGICAL_BACKUP_VERIFIED: "NO",
});

export const COMMS_ACT_06_SQL_PACKAGE = Object.freeze({
  forwardComms05: COMMS_ACT_01_FORWARD_SQL_RELATIVE,
  rollbackComms05: COMMS_ACT_01_ROLLBACK_SQL_RELATIVE,
  forwardClubSelect: COMMS_ACT_03_FORWARD_SQL_RELATIVE,
  rollbackClubSelect: COMMS_ACT_03_ROLLBACK_SQL_RELATIVE,
});

export function getCommsAct06RepoRoot(repoRoot) {
  if (repoRoot) return repoRoot;
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../.."
  );
}

export function getCommsAct06CapabilityScope() {
  return Object.freeze({ ...COMMS_ACT_06_CAPABILITY_SCOPE });
}

/**
 * Classify known readiness risks (static).
 * @returns {ReadonlyArray<{ id: string, class: string, message: string }>}
 */
export function getCommsAct06RiskRegister() {
  return Object.freeze([
    Object.freeze({
      id: "PRODUCTION_RUNTIME_ENABLE_OWNER_GO",
      class: COMMS_ACT_06_RISK_CLASS.RELEASE_BLOCKER,
      message:
        "API hosts refuse Production ref until COMMS_PRODUCTION_RUNTIME_ENABLE exact Owner GO token.",
    }),
    Object.freeze({
      id: "PRODUCTION_READY_ACTIVATION_GATE",
      class: COMMS_ACT_06_RISK_CLASS.RELEASE_BLOCKER,
      message:
        "activationGates.PRODUCTION_READY remains false — Production build stays UNAVAILABLE until ACT-07 Owner gate flip.",
    }),
    Object.freeze({
      id: "PRODUCTION_SCHEMA_NOT_APPLIED_EXPECTED",
      class: COMMS_ACT_06_RISK_CLASS.RELEASE_BLOCKER,
      message:
        "Communication foundation schema is expected absent on Production until Gate D schema apply (not an implementation defect).",
    }),
    Object.freeze({
      id: "PRODUCTION_ENV_METADATA_OWNER_VERIFY",
      class: COMMS_ACT_06_RISK_CLASS.RELEASE_BLOCKER,
      message:
        "Production Vercel/Supabase secret presence must be Owner-verified (worktree has no Production env binding).",
    }),
    Object.freeze({
      id: "PRODUCTION_BACKUP_CAPABILITY",
      class: COMMS_ACT_06_RISK_CLASS.RELEASE_BLOCKER,
      message:
        "Fresh Production logical backup not yet executed/verified (Gate B). Dashboard/PITR unavailable; Owner-local script prepared but PRODUCTION_LOGICAL_BACKUP_VERIFIED=NO.",
    }),
    Object.freeze({
      id: "PRODUCTION_TEST_IDENTITIES",
      class: COMMS_ACT_06_RISK_CLASS.RELEASE_BLOCKER,
      message:
        "Safe QA/test identities must exist on Production or ACT-07 is BLOCKED_TEST_IDENTITIES.",
    }),
    Object.freeze({
      id: "REQUEST_SIZE_AND_RATE_LIMIT",
      class: COMMS_ACT_06_RISK_CLASS.REQUIRED_BEFORE_SCALE,
      message:
        "Minimal body-size + in-memory rate guards ship in ACT-06; durable distributed rate limit before public scale.",
    }),
    Object.freeze({
      id: "OBSERVABILITY_METRICS_ALERTING",
      class: COMMS_ACT_06_RISK_CLASS.REQUIRED_BEFORE_SCALE,
      message:
        "Typed errors + safe diagnostics exist; dedicated metrics/alerting before scale.",
    }),
    Object.freeze({
      id: "COMMUNITY_AND_REALTIME",
      class: COMMS_ACT_06_RISK_CLASS.DEFERRED_NON_BLOCKING,
      message: "Community and Realtime remain fail-closed by design.",
    }),
    Object.freeze({
      id: "API_ERROR_REGISTRY_CODES",
      class: COMMS_ACT_06_RISK_CLASS.DEFERRED_NON_BLOCKING,
      message:
        "CommunicationFoundationError codes remain module-local (documented COMMS-05/07 choice).",
    }),
  ]);
}

/**
 * @param {{ repoRoot?: string }} [options]
 */
export function evaluateCommsAct06DeploymentHost(options = {}) {
  const root = getCommsAct06RepoRoot(options.repoRoot);
  const host = evaluateCommsAct05TrustedBackendHost({ repoRoot: root });
  const vercelPath = path.join(root, "vercel.json");
  const netlifyPath = path.join(root, "netlify.toml");
  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [...host.findings];

  if (!fs.existsSync(vercelPath)) {
    findings.push({
      level: "error",
      code: "VERCEL_JSON_MISSING",
      message: "vercel.json missing — cannot confirm Vercel packaging.",
    });
  } else {
    const vercel = fs.readFileSync(vercelPath, "utf8");
    // SPA rewrite must not swallow /api/communication (identity pattern).
    if (/destination["']:\s*["']\/index\.html["']/.test(vercel) === false) {
      findings.push({
        level: "warning",
        code: "VERCEL_REWRITE_SHAPE_UNEXPECTED",
        message: "vercel.json rewrite shape unexpected — re-check api/ exclusion.",
      });
    }
  }

  if (fs.existsSync(netlifyPath)) {
    const netlify = fs.readFileSync(netlifyPath, "utf8");
    if (/\[functions\]|netlify\/functions/i.test(netlify)) {
      findings.push({
        level: "error",
        code: "NETLIFY_FUNCTIONS_AMBIGUITY",
        message: "netlify.toml declares functions — Communication host must stay Vercel api/.",
      });
    }
  }

  const pass = findings.filter((f) => f.level === "error").length === 0;
  return Object.freeze({
    pass,
    hostFamily: COMMUNICATION_TRUSTED_BACKEND_HOST.family,
    commandPath: COMMUNICATION_TRUSTED_BACKEND_HOST.commandPath,
    systemProducePath: COMMUNICATION_TRUSTED_BACKEND_HOST.systemProducePath,
    stagingRef: COMMS_STAGING_PROJECT_REF,
    productionRef: COMMS_PRODUCTION_PROJECT_REF,
    findings,
  });
}

/**
 * @param {{ repoRoot?: string }} [options]
 */
export function evaluateCommsAct06SqlPackageBinding(options = {}) {
  const root = getCommsAct06RepoRoot(options.repoRoot);
  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];
  for (const rel of Object.values(COMMS_ACT_06_SQL_PACKAGE)) {
    if (!fs.existsSync(path.join(root, rel))) {
      findings.push({
        level: "error",
        code: "SQL_PACKAGE_FILE_MISSING",
        message: `Missing SQL package file: ${rel}`,
      });
    }
  }
  return Object.freeze({
    pass: findings.length === 0,
    package: COMMS_ACT_06_SQL_PACKAGE,
    findings,
  });
}

/**
 * Static safety checks shared by repository contract and Owner-local script text.
 * @param {string} src
 * @param {string} label
 */
export function evaluateCommsAct06BackupScriptSource(src, label = "backup-script") {
  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];
  const text = String(src || "");

  const required = [
    [/expuvcohlcjzvrrauvud/, "PRODUCTION_ALLOWLIST_MISSING"],
    [/qyewbxjsiiyufanzcjcq/, "STAGING_BLOCKLIST_MISSING"],
    [/Production allowlist|allowlist:\s*\$ProductionRef|Allowlist Production/i, "ALLOWLIST_LANGUAGE_MISSING"],
    [/Staging blocklist|blocklist:\s*\$StagingRef|Never targets Staging/i, "BLOCKLIST_LANGUAGE_MISSING"],
    [/roles\.sql/, "ROLES_DUMP_MISSING"],
    [/schema\.sql/, "SCHEMA_DUMP_MISSING"],
    [/data\.sql/, "DATA_DUMP_MISSING"],
    [/migration-history/, "MIGRATION_HISTORY_MISSING"],
    [/SHA256/, "SHA256_MISSING"],
    [/already exists/, "NO_OVERWRITE_GUARD_MISSING"],
  ];

  for (const [pattern, code] of required) {
    if (!pattern.test(text)) {
      findings.push({
        level: "error",
        code,
        message: `${label}: missing required contract marker (${code}).`,
      });
    }
  }

  if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\./.test(text)) {
    findings.push({
      level: "error",
      code: "JWT_LIKE_SECRET_PRESENT",
      message: `${label}: JWT-like secret material must not appear.`,
    });
  }
  if (/postgres:\/\/[^:]+:[^@]+@/i.test(text)) {
    findings.push({
      level: "error",
      code: "CONNECTION_STRING_SECRET_PRESENT",
      message: `${label}: database connection string must not appear.`,
    });
  }
  if (/service_role|sb_secret_/i.test(text)) {
    findings.push({
      level: "error",
      code: "SERVICE_ROLE_SECRET_PRESENT",
      message: `${label}: service-role secret material must not appear.`,
    });
  }

  return Object.freeze({
    pass: findings.filter((f) => f.level === "error").length === 0,
    findings,
  });
}

/**
 * CI-required: repository backup contract/template exists and is statically safe.
 * @param {{ repoRoot?: string }} [options]
 */
export function evaluateCommsAct06BackupContract(options = {}) {
  const root = getCommsAct06RepoRoot(options.repoRoot);
  const relative = COMMS_ACT_06_BACKUP_CONTRACT_RELATIVE;
  const absolute = path.join(root, relative);
  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];

  if (!fs.existsSync(absolute)) {
    findings.push({
      level: "error",
      code: "BACKUP_CONTRACT_MISSING",
      message: `Missing repository backup contract: ${relative}`,
    });
    return Object.freeze({
      pass: false,
      relative,
      absolute,
      findings,
      ciExternalFileExistenceRequired: false,
    });
  }

  const src = fs.readFileSync(absolute, "utf8");
  const sourceCheck = evaluateCommsAct06BackupScriptSource(src, relative);
  findings.push(...sourceCheck.findings);

  return Object.freeze({
    pass: sourceCheck.pass,
    relative,
    absolute,
    findings,
    ciExternalFileExistenceRequired: false,
    repositoryBackupContractVerified: sourceCheck.pass,
  });
}

/**
 * Optional Owner-local executable presence — never a CI failure.
 * @param {{ backupScriptPath?: string }} [input]
 */
export function evaluateCommsAct06OwnerLocalBackupScript(input = {}) {
  const documentedPath = COMMS_ACT_06_OWNER_LOCAL_BACKUP_SCRIPT_PATH;
  const backupScriptPath = String(
    input.backupScriptPath || documentedPath
  ).trim();
  const available =
    backupScriptPath.length > 0 && fs.existsSync(backupScriptPath);

  if (!available) {
    return Object.freeze({
      available: false,
      path: backupScriptPath,
      documentedPath,
      classification: "OWNER_LOCAL_ARTIFACT_NOT_AVAILABLE_IN_CI",
      executed: false,
      ciExternalFileExistenceRequired: false,
      findings: Object.freeze([
        Object.freeze({
          level: "info",
          code: "OWNER_LOCAL_ARTIFACT_NOT_AVAILABLE_IN_CI",
          message:
            "Owner-local Production backup script not present in this environment (expected on Linux CI).",
        }),
      ]),
    });
  }

  const src = fs.readFileSync(backupScriptPath, "utf8");
  const sourceCheck = evaluateCommsAct06BackupScriptSource(
    src,
    "owner-local-backup-script"
  );

  return Object.freeze({
    available: true,
    path: backupScriptPath,
    documentedPath,
    classification: "OWNER_LOCAL_ARTIFACT_PRESENT",
    executed: false,
    ciExternalFileExistenceRequired: false,
    sourceCheck,
    findings: sourceCheck.findings,
  });
}

/**
 * Full static Production readiness preflight (no remote mutation).
 * @param {object} [input]
 */
export function evaluateCommsAct06Preflight(input = {}) {
  const root = getCommsAct06RepoRoot(input.repoRoot);
  const docsDir = path.join(root, COMMS_ACT_06_DOCS_RELATIVE);
  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];
  /** @type {Array<{ id: string, class: string, message: string }>} */
  const remediations = [];

  for (const name of COMMS_ACT_06_REQUIRED_DOCS) {
    if (!fs.existsSync(path.join(docsDir, name))) {
      findings.push({
        level: "error",
        code: "DOC_MISSING",
        message: `Missing ACT-06 doc: ${name}`,
      });
    }
  }

  const host = evaluateCommsAct06DeploymentHost({ repoRoot: root });
  if (!host.pass) findings.push(...host.findings);

  const sql = evaluateCommsAct06SqlPackageBinding({ repoRoot: root });
  if (!sql.pass) findings.push(...sql.findings);

  const backupContract = evaluateCommsAct06BackupContract({ repoRoot: root });
  if (!backupContract.pass) findings.push(...backupContract.findings);

  const ownerLocalBackup = evaluateCommsAct06OwnerLocalBackupScript({
    backupScriptPath: input.backupScriptPath,
  });
  // Presence of Owner-local file is informational only — never CI error.
  // Optional Owner-machine mode may request a warning surface but must not fail CI.
  if (
    input.requireOwnerLocalBackupScript === true &&
    !ownerLocalBackup.available
  ) {
    findings.push({
      level: "warning",
      code: "OWNER_LOCAL_ARTIFACT_NOT_AVAILABLE_IN_CI",
      message:
        "Owner-local backup script requested but not found (non-blocking for repository readiness).",
    });
  }

  const activation = getCommunicationActivationSnapshot();
  if (activation.PRODUCTION_READY === true) {
    findings.push({
      level: "error",
      code: "PRODUCTION_READY_PREMATURE",
      message:
        "PRODUCTION_READY must remain false during ACT-06 (flip only under ACT-07 Owner GO).",
    });
  }

  // Production enable token must NOT be set during ACT-06 local readiness.
  const enableToken = String(
    input.enableToken ||
      input[COMMS_ACT_06_ENV_NAMES.PRODUCTION_RUNTIME_ENABLE] ||
      ""
  ).trim();
  if (enableToken === COMMS_ACT_06_PRODUCTION_ENABLE_TOKEN) {
    findings.push({
      level: "error",
      code: "PRODUCTION_ENABLE_PREMATURE",
      message:
        "COMMS_PRODUCTION_RUNTIME_ENABLE must not be set during ACT-06 readiness.",
    });
  }

  const prodGate = evaluateCommunicationProductionRefGate(
    `https://${COMMS_PRODUCTION_PROJECT_REF}.supabase.co`,
    { enableToken }
  );
  if (prodGate.ok) {
    findings.push({
      level: "error",
      code: "PRODUCTION_GATE_NOT_FAIL_CLOSED",
      message: "Production ref gate unexpectedly allowed without Owner GO.",
    });
  }

  const target = evaluateCommsProductionTargetIdentity({
    url: input.url || `https://${COMMS_PRODUCTION_PROJECT_REF}.supabase.co`,
    environment: "production",
    enableToken,
  });

  const riskRegister = getCommsAct06RiskRegister();
  for (const risk of riskRegister) {
    if (risk.class === COMMS_ACT_06_RISK_CLASS.RELEASE_BLOCKER) {
      remediations.push(risk);
    }
  }

  // Env presence is Owner-supplied; absence is expected in CI/worktree.
  const envPresence = Object.freeze({
    url: isEnvTokenPresent(input.url),
    anonKey: isEnvTokenPresent(input.anonKey),
    serviceRole: isEnvTokenPresent(input.serviceRole),
    systemProducerKey: isEnvTokenPresent(input.systemProducerKey),
    trustedBackendFlag: isEnvTokenPresent(input.trustedBackendFlag),
    accessToken: isEnvTokenPresent(input.accessToken),
    secretsPrinted: false,
    ownerVerifyRequired: true,
  });

  const errors = findings.filter((f) => f.level === "error");
  let verdict;
  let pass;

  if (!host.pass) {
    verdict = COMMS_ACT_06_VERDICTS.BLOCKED_DEPLOYMENT_HOST;
    pass = false;
  } else if (errors.some((e) => e.code === "PRODUCTION_GATE_NOT_FAIL_CLOSED")) {
    verdict = COMMS_ACT_06_VERDICTS.BLOCKED_SECURITY;
    pass = false;
  } else if (errors.length > 0) {
    verdict = COMMS_ACT_06_VERDICTS.READY_WITH_REMEDIATION_REQUIRED;
    pass = false;
  } else if (remediations.length > 0) {
    // Local package complete; Release blockers remain Owner/ACT-07 remediations.
    verdict = COMMS_ACT_06_VERDICTS.READY_WITH_REMEDIATION_REQUIRED;
    pass = true;
  } else {
    verdict = COMMS_ACT_06_VERDICTS.READY_FOR_PRODUCTION_OWNER_GO;
    pass = true;
  }

  return Object.freeze({
    pass,
    verdict,
    act: "COMMS-ACT-06",
    mutationCount: 0,
    remoteMutateAllowed: false,
    productionUntouched: true,
    host,
    sql,
    target,
    activation: Object.freeze({
      PRODUCTION_READY: activation.PRODUCTION_READY,
      STAGING_MIGRATION_READY: activation.STAGING_MIGRATION_READY,
      REALTIME_ACTIVATION_READY: activation.REALTIME_ACTIVATION_READY,
    }),
    capabilityScope: getCommsAct06CapabilityScope(),
    productionEnableToken: COMMS_ACT_06_PRODUCTION_ENABLE_TOKEN,
    smokeMarker: COMMS_ACT_06_PROD_SMOKE_MARKER,
    envPresence,
    backupContract,
    ownerLocalBackup,
    backupScriptOk: ownerLocalBackup.available === true,
    backupEvidence: COMMS_ACT_06_BACKUP_EVIDENCE,
    riskRegister,
    remediations,
    findings,
    secretsPrinted: false,
  });
}
