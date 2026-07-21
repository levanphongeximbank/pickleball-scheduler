#!/usr/bin/env node
/**
 * CRM Phase 1H — Future Staging apply script boundary.
 *
 * DEFAULT: dry-run (no SQL apply).
 * Fail-closed. Phase 1H-A must NOT run --apply-staging.
 *
 * Required for future apply (all must be present):
 *   --apply-staging
 *   --owner-approval=<token matching CRM_STAGING_OWNER_APPROVAL>
 *   --backup-evidence=<token matching CRM_STAGING_BACKUP_EVIDENCE>
 *   --environment=staging
 *
 * Never continues to Production. Never deploys. Never logs credentials.
 * Never executes automatic rollback.
 */

import {
  CRM_PRODUCTION_PROJECT_REF_BLOCKLIST,
  verifyCrmStagingMigrationManifest,
  loadCrmStagingMigrationManifest,
  getCrmPhase1hRepoRoot,
} from "../../src/features/crm/staging/migrationManifest.js";

const root = getCrmPhase1hRepoRoot();

function parseArgs(argv) {
  const args = {
    applyStaging: false,
    ownerApproval: null,
    backupEvidence: null,
    environment: null,
    dryRun: true,
  };
  for (const raw of argv) {
    if (raw === "--apply-staging") {
      args.applyStaging = true;
      args.dryRun = false;
    } else if (raw.startsWith("--owner-approval=")) {
      args.ownerApproval = raw.slice("--owner-approval=".length);
    } else if (raw.startsWith("--backup-evidence=")) {
      args.backupEvidence = raw.slice("--backup-evidence=".length);
    } else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    } else if (raw === "--dry-run") {
      args.dryRun = true;
      args.applyStaging = false;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  /** @type {string[]} */
  const errors = [];

  const manifest = loadCrmStagingMigrationManifest(root);
  const verify = verifyCrmStagingMigrationManifest({ repoRoot: root, manifest });
  if (!verify.ok) {
    errors.push(...verify.errors);
  }

  // Always refuse Production references
  for (const ref of CRM_PRODUCTION_PROJECT_REF_BLOCKLIST) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    if (url.includes(ref)) {
      errors.push("Production project reference blocklisted.");
    }
  }

  if (!args.applyStaging || args.dryRun) {
    const report = {
      phase: "1H",
      script: "phase-1h-staging-apply",
      mode: "dry-run",
      ok: errors.length === 0,
      sqlApplied: false,
      migrationsWouldApply: (manifest.migrations || []).map((m) => m.path),
      stopOnFirstError: true,
      automaticRollback: false,
      deploy: false,
      productionContinuation: false,
      credentialsLogged: false,
      errors,
      evidence:
        "Dry-run only. Pass --apply-staging with owner approval + backup evidence + staging assertion for future apply (not Phase 1H-A).",
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(errors.length === 0 ? 0 : 1);
  }

  // Apply mode requested — still fail closed in Phase 1H-A / without gates
  if (args.environment !== "staging") {
    errors.push("Explicit --environment=staging required for apply.");
  }
  if (!args.ownerApproval || args.ownerApproval !== process.env.CRM_STAGING_OWNER_APPROVAL) {
    errors.push("Explicit owner approval flag/token mismatch or missing.");
  }
  if (
    !args.backupEvidence ||
    args.backupEvidence !== process.env.CRM_STAGING_BACKUP_EVIDENCE
  ) {
    errors.push("Explicit backup/restore evidence flag/token mismatch or missing.");
  }

  // Phase 1H-A hard stop: never apply even if flags present
  errors.push(
    "Phase 1H-A refuses SQL apply. Apply mode remains blocked until Owner opens Phase 1H-B."
  );

  const report = {
    phase: "1H-A",
    script: "phase-1h-staging-apply",
    mode: "apply-refused",
    ok: false,
    sqlApplied: false,
    stagingConnected: false,
    productionConnected: false,
    deploy: false,
    automaticRollback: false,
    credentialsLogged: false,
    errors,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

main();
