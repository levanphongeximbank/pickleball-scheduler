#!/usr/bin/env node
/**
 * CRM Phase 1H-B — Staging preflight.
 *
 * Modes:
 *   --offline (default): static/manifest checks; no DB connection
 *   --rollout-mode: also fail on dirty controlled migration paths
 *   --live-gates: evaluate Owner approval / Staging identity / backup /
 *                 credential / QA identity gates against process.env
 *                 (still no SQL apply; values never printed)
 *
 * Does NOT apply SQL. Does NOT connect to Production.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { loadProjectEnv } from "../load-env.mjs";
import {
  CRM_PRODUCTION_PROJECT_REF_BLOCKLIST,
  CRM_STAGING_PROJECT_REF_ALLOWLIST,
  loadCrmStagingMigrationManifest,
  verifyCrmStagingMigrationManifest,
  getCrmPhase1hRepoRoot,
} from "../../src/features/crm/staging/migrationManifest.js";
import {
  CRM_PERMISSION_SEED_APPROVAL,
} from "../../src/features/crm/identity/crmPermissionSeedDefinitions.js";
import {
  CRM_ROLE_MATRIX_APPROVAL,
} from "../../src/features/crm/identity/crmRolePermissionMatrix.js";
import {
  CRM_TENANT_VENUE_RESOLVER_VERDICT,
  isAcceptableCrmTenantVenueResolverVerdict,
} from "../../src/features/crm/identity/tenantVenueResolverCertification.js";
import {
  CRM_PERSISTENCE_MODE_ENV,
  getCrmDefaultRuntimePersistenceMode,
} from "../../src/features/crm/persistence/runtimeCompositionGuard.js";
import {
  CRM_PHASE_1H_B_ENV_NAMES,
  CRM_PHASE_1H_B_VERDICTS,
  evaluateCrmPhase1hBPreWriteGates,
} from "../../src/features/crm/staging/phase1hBGates.js";

const root = getCrmPhase1hRepoRoot();

const CERT_DOCS = Object.freeze([
  "docs/crm/phase-1h/04_RLS_SECURITY_CERTIFICATION.md",
  "docs/crm/phase-1h/05_PENDING_EVENT_RPC_CERTIFICATION.md",
  "docs/crm/phase-1h/03_TENANT_VENUE_RESOLVER_CERTIFICATION.md",
]);

function parseArgs(argv) {
  const args = {
    offline: true,
    rolloutMode: false,
    liveGates: false,
    environment: "staging",
    apply: false,
    deferRoleMatrix: true,
  };
  for (const raw of argv) {
    if (raw === "--offline" || raw === "--mode=offline") {
      args.offline = true;
    } else if (raw === "--rollout-mode") {
      args.rolloutMode = true;
    } else if (raw === "--live-gates") {
      args.liveGates = true;
    } else if (raw === "--require-role-matrix") {
      args.deferRoleMatrix = false;
    } else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    } else if (raw === "--apply" || raw === "--apply-staging") {
      args.apply = true;
    }
  }
  return args;
}

function gitPorcelain() {
  try {
    return execSync("git status --porcelain", {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function collectStaticFindings(args) {
  /** @type {Array<{ level: string, code: string, message: string }>} */
  const findings = [];

  if (args.apply) {
    findings.push({
      level: "error",
      code: "APPLY_REFUSED",
      message:
        "Preflight refuses --apply / --apply-staging. Use scripts/crm/phase-1h-staging-apply.mjs for controlled apply.",
    });
  }

  if (args.environment !== "staging") {
    findings.push({
      level: "error",
      code: "ENVIRONMENT_NOT_STAGING",
      message: `Environment must be staging (got ${args.environment}).`,
    });
  }

  const manifest = loadCrmStagingMigrationManifest(root);
  const blocklist = new Set([
    ...(manifest.productionProjectRefBlocklist || []),
    ...CRM_PRODUCTION_PROJECT_REF_BLOCKLIST,
  ]);
  const suspiciousKeys = [
    "targetProjectRef",
    "applyProjectRef",
    "supabaseProjectRef",
    "databaseUrl",
  ];
  for (const key of suspiciousKeys) {
    const value = String(manifest[key] || "");
    for (const prodRef of blocklist) {
      if (value.includes(prodRef)) {
        findings.push({
          level: "error",
          code: "PRODUCTION_REF_AS_TARGET",
          message: `Production project ref used as manifest target (${key}): ${prodRef}`,
        });
      }
    }
  }
  for (const entry of manifest.migrations || []) {
    const blob = JSON.stringify(entry);
    for (const prodRef of blocklist) {
      if (blob.includes(prodRef)) {
        findings.push({
          level: "error",
          code: "PRODUCTION_REF_IN_MIGRATION_ENTRY",
          message: `Production project ref in migration entry ${entry.path}: ${prodRef}`,
        });
      }
    }
  }

  const verify = verifyCrmStagingMigrationManifest({ repoRoot: root, manifest });
  if (!verify.ok) {
    for (const err of verify.errors) {
      findings.push({ level: "error", code: "MANIFEST_VERIFY", message: err });
    }
  }

  if (args.rolloutMode) {
    const dirty = gitPorcelain();
    if (dirty) {
      const dirtyLines = dirty.split("\n").filter(Boolean);
      const migrationDirty = dirtyLines.filter((line) =>
        /docs\/crm\/phase-1[gh]\/\d+_.*\.sql|staging-migration-manifest\.json/.test(
          line
        )
      );
      if (migrationDirty.length > 0) {
        findings.push({
          level: "error",
          code: "UNCOMMITTED_MIGRATIONS",
          message: `Uncommitted migration changes in rollout mode: ${migrationDirty.join(" | ")}`,
        });
      }
    }
  }

  for (const rel of CERT_DOCS) {
    if (!existsSync(path.join(root, rel))) {
      findings.push({
        level: "error",
        code: "MISSING_CERT_DOC",
        message: `Missing certification doc: ${rel}`,
      });
    }
  }

  if (
    !isAcceptableCrmTenantVenueResolverVerdict(
      CRM_TENANT_VENUE_RESOLVER_VERDICT.verdict
    )
  ) {
    findings.push({
      level: "error",
      code: "TENANT_VENUE_VERDICT",
      message: `Unacceptable tenant/venue verdict: ${CRM_TENANT_VENUE_RESOLVER_VERDICT.verdict}`,
    });
  }

  // Code markers remain PROPOSED until Owner supplies apply tokens —
  // Phase 1H-B must not infer approval from merge.
  if (
    CRM_PERMISSION_SEED_APPROVAL.status !== "PROPOSED_AWAITING_OWNER_APPLY_APPROVAL" &&
    CRM_PERMISSION_SEED_APPROVAL.status !== "OWNER_APPROVED_FOR_STAGING_APPLY"
  ) {
    findings.push({
      level: "error",
      code: "PERMISSION_SEED_APPROVAL_MARKER",
      message: "Identity permission seed approval marker unexpected.",
    });
  }

  if (CRM_ROLE_MATRIX_APPROVAL.ownerApprovalRequiredBeforeApply !== true) {
    findings.push({
      level: "error",
      code: "ROLE_MATRIX_APPROVAL",
      message: "Role matrix must require owner approval before apply.",
    });
  }

  const defaultMode = getCrmDefaultRuntimePersistenceMode();
  if (defaultMode !== "memory") {
    findings.push({
      level: "error",
      code: "DURABLE_RUNTIME_DEFAULT",
      message: `Default runtime persistence must be memory (got ${defaultMode}).`,
    });
  }

  const envPresence = {};
  for (const name of Object.values(CRM_PHASE_1H_B_ENV_NAMES)) {
    envPresence[name] =
      process.env[name] != null && process.env[name] !== "" ? "set" : "unset";
  }

  const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.STAGING_SUPABASE_URL ||
    "";
  for (const prodRef of CRM_PRODUCTION_PROJECT_REF_BLOCKLIST) {
    if (url.includes(prodRef)) {
      findings.push({
        level: "error",
        code: "PRODUCTION_URL_BLOCKED",
        message: "Supabase URL appears to reference Production project (blocklisted).",
      });
    }
  }
  for (const stagingRef of CRM_STAGING_PROJECT_REF_ALLOWLIST) {
    void stagingRef;
  }

  const persistenceMode = String(process.env[CRM_PERSISTENCE_MODE_ENV] || "memory")
    .trim()
    .toLowerCase();
  if (persistenceMode === "durable") {
    findings.push({
      level: "error",
      code: "DURABLE_RUNTIME_ENABLED",
      message: `${CRM_PERSISTENCE_MODE_ENV}=durable is set; Phase 1H-B requires durable runtime off during controlled apply.`,
    });
  }

  return {
    findings,
    envPresence,
    resolverVerdict: CRM_TENANT_VENUE_RESOLVER_VERDICT.verdict,
    defaultPersistenceMode: defaultMode,
    manifestMigrationCount: (manifest.migrations || []).length,
  };
}

function main() {
  try {
    loadProjectEnv();
  } catch {
    // offline may proceed without env files
  }

  const args = parseArgs(process.argv.slice(2));
  const staticReport = collectStaticFindings(args);
  const staticErrors = staticReport.findings.filter((f) => f.level === "error");

  /** @type {object|null} */
  let liveGates = null;
  /** @type {string|null} */
  let liveVerdict = null;

  if (args.liveGates) {
    // Do NOT pass env tokens as CLI flags — presence ≠ Owner apply confirmation.
    // Apply script requires explicit matching CLI flags; preflight only reports gaps.
    liveGates = evaluateCrmPhase1hBPreWriteGates({
      env: process.env,
      flags: {
        environment: args.environment,
        deferRoleMatrix: args.deferRoleMatrix,
        ownerApproval: null,
        backupEvidence: null,
        permissionSeedApproval: null,
        roleMatrixApproval: null,
        phase1gApplyApproval: null,
      },
      repoRoot: root,
      requireQaIdentities: true,
    });
    liveVerdict = liveGates.canWrite
      ? null
      : liveGates.verdict || CRM_PHASE_1H_B_VERDICTS.BLOCKED_APPROVAL_REQUIRED;
  }

  const output = {
    phase: "1H-B",
    script: "phase-1h-staging-preflight",
    mode: args.liveGates ? "live-gates" : "offline",
    environmentAssertion: args.environment,
    ok: args.liveGates ? staticErrors.length === 0 && Boolean(liveGates?.canWrite) : staticErrors.length === 0,
    sqlApplied: false,
    stagingConnected: false,
    productionConnected: false,
    durableRuntime: "off",
    requiredEnvironmentVariableNames: Object.values(CRM_PHASE_1H_B_ENV_NAMES),
    environmentVariablePresence: staticReport.envPresence,
    environmentVariableValues: "NOT_PRINTED",
    resolverVerdict: staticReport.resolverVerdict,
    defaultPersistenceMode: staticReport.defaultPersistenceMode,
    manifestMigrationCount: staticReport.manifestMigrationCount,
    findings: staticReport.findings,
    liveGates: liveGates
      ? {
          canWrite: liveGates.canWrite,
          verdict: liveGates.verdict,
          approvalsOk: liveGates.approvals.ok,
          requiredMissingApprovals: liveGates.approvals.requiredMissing,
          identityOk: liveGates.identity.ok,
          backupOk: liveGates.backup.ok,
          credentialsOk: liveGates.credentials.ok,
          qaIdentitiesOk: liveGates.qaIdentities.ok,
          runtimeOk: liveGates.runtime.ok,
          migrationPlan: liveGates.migrationPlan,
        }
      : null,
    recommendedVerdictIfBlocked:
      liveVerdict ||
      (args.liveGates
        ? CRM_PHASE_1H_B_VERDICTS.BLOCKED_APPROVAL_REQUIRED
        : null),
  };

  console.log(JSON.stringify(output, null, 2));
  const exitOk = args.liveGates
    ? staticErrors.length === 0 && Boolean(liveGates?.canWrite)
    : staticErrors.length === 0;
  process.exit(exitOk ? 0 : 1);
}

main();
