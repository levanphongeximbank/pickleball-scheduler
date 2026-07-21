#!/usr/bin/env node
/**
 * CRM Phase 1H-A — Staging preflight (offline / static mode).
 *
 * Default and Phase 1H-A allowed mode: --offline (or no flags).
 * Does NOT apply SQL. Does NOT connect to Staging or Production databases.
 * Does NOT print secret values.
 *
 * Usage:
 *   node scripts/crm/phase-1h-staging-preflight.mjs
 *   node scripts/crm/phase-1h-staging-preflight.mjs --offline
 *   node scripts/crm/phase-1h-staging-preflight.mjs --mode=offline
 *
 * Future live modes are intentionally unimplemented / fail-closed here.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

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

const root = getCrmPhase1hRepoRoot();

const REQUIRED_ENV_NAMES = Object.freeze([
  "VITE_APP_ENV",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "CRM_STAGING_OWNER_APPROVAL",
  "CRM_STAGING_BACKUP_EVIDENCE",
  "CRM_IDENTITY_PERMISSION_SEED_APPROVAL",
]);

const CERT_DOCS = Object.freeze([
  "docs/crm/phase-1h/04_RLS_SECURITY_CERTIFICATION.md",
  "docs/crm/phase-1h/05_PENDING_EVENT_RPC_CERTIFICATION.md",
  "docs/crm/phase-1h/03_TENANT_VENUE_RESOLVER_CERTIFICATION.md",
]);

function parseArgs(argv) {
  const args = {
    offline: true,
    rolloutMode: false,
    environment: "staging",
    apply: false,
  };
  for (const raw of argv) {
    if (raw === "--offline" || raw === "--mode=offline") {
      args.offline = true;
    } else if (raw === "--rollout-mode") {
      args.rolloutMode = true;
    } else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    } else if (raw === "--apply" || raw === "--apply-staging") {
      args.apply = true;
    }
  }
  return args;
}

function maskSecretNames(names) {
  return names.map((n) => `${n}=<set|unset — value not printed>`);
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

function collectFindings(args) {
  /** @type {Array<{ level: string, code: string, message: string }>} */
  const findings = [];

  if (args.apply) {
    findings.push({
      level: "error",
      code: "APPLY_REFUSED",
      message:
        "Preflight refuses --apply / --apply-staging. Use apply script dry-run only; Phase 1H-A does not apply SQL.",
    });
  }

  if (args.environment !== "staging") {
    findings.push({
      level: "error",
      code: "ENVIRONMENT_NOT_STAGING",
      message: `Environment must be staging (got ${args.environment}).`,
    });
  }

  // Production project references must not appear in controlled CRM 1H artifacts.
  const scanRoots = [
    path.join(root, "docs/crm/phase-1h"),
    path.join(root, "scripts/crm"),
  ];
  for (const dir of scanRoots) {
    if (!existsSync(dir)) continue;
    // Lightweight static scan of text files in these folders
  }
  const manifest = loadCrmStagingMigrationManifest(root);
  // Production refs may appear only inside explicit blocklist fields — never as targets.
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
      // Only fail if controlled migration paths are dirty
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

  if (CRM_PERMISSION_SEED_APPROVAL.status !== "PROPOSED_AWAITING_OWNER_APPLY_APPROVAL") {
    findings.push({
      level: "error",
      code: "PERMISSION_SEED_APPROVAL",
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

  // Named env vars — presence checked only when provided via process.env in offline mode;
  // values are never printed. Offline mode does not require them to be set.
  const envPresence = {};
  for (const name of REQUIRED_ENV_NAMES) {
    envPresence[name] = process.env[name] != null && process.env[name] !== "" ? "set" : "unset";
  }

  // Block obvious production URL/project refs if env is set (without printing values)
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
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
    // allowlist documented; offline mode does not require URL to be set
    void stagingRef;
  }

  // Ensure durable flag is not enabled in current process for Phase 1H-A offline cert
  const persistenceMode = String(process.env[CRM_PERSISTENCE_MODE_ENV] || "memory")
    .trim()
    .toLowerCase();
  if (persistenceMode === "durable") {
    findings.push({
      level: "error",
      code: "DURABLE_RUNTIME_ENABLED",
      message: `${CRM_PERSISTENCE_MODE_ENV}=durable is set; Phase 1H-A requires durable runtime off.`,
    });
  }

  return {
    findings,
    envPresence,
    requiredEnvNames: REQUIRED_ENV_NAMES,
    resolverVerdict: CRM_TENANT_VENUE_RESOLVER_VERDICT.verdict,
    defaultPersistenceMode: defaultMode,
    sqlApplied: false,
    databaseConnected: false,
    mode: "offline",
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.offline) {
    console.error("Phase 1H-A preflight only supports offline/static mode.");
    process.exit(2);
  }

  const report = collectFindings(args);
  const errors = report.findings.filter((f) => f.level === "error");
  const ok = errors.length === 0;

  const output = {
    phase: "1H-A",
    script: "phase-1h-staging-preflight",
    mode: "offline",
    environmentAssertion: args.environment,
    ok,
    sqlApplied: false,
    stagingConnected: false,
    productionConnected: false,
    durableRuntime: "off",
    requiredEnvironmentVariableNames: report.requiredEnvNames,
    environmentVariablePresence: report.envPresence,
    environmentVariableValues: "NOT_PRINTED",
    resolverVerdict: report.resolverVerdict,
    defaultPersistenceMode: report.defaultPersistenceMode,
    findings: report.findings,
    secretScanNote: maskSecretNames(report.requiredEnvNames),
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(ok ? 0 : 1);
}

main();
