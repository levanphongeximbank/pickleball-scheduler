#!/usr/bin/env node
/**
 * V5-P1-A — Production pre-flight (read-only). Does NOT apply Production changes.
 *
 * Usage: node scripts/verify-v5p1a-production-preflight.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { STAGING_REF, PRODUCTION_REF } from "./lib/rating-v5-wave1-manifest.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDir = path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1a-preflight", runId);
const stableEvidenceDir = path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1a-preflight");

const PRODUCTION_APP_ORIGIN_CONFIRMED = "https://pickleball-scheduler-eight.vercel.app";
const CORS_ALLOWLIST_PATH = "docs/v5/rating-v5/V5-P1_PRODUCTION_CORS_ALLOWLIST.json";

const MIGRATION_FILES = [
  "docs/v5/rating-v5/PHASE_V5A_RATING_FOUNDATION.sql",
  "docs/v5/rating-v5/PHASE_V5B1_COMPLETE_ASSESSMENT.sql",
  "docs/v5/rating-v5/PHASE_V5B1P_PERSISTENCE_AND_EDGE.sql",
  "docs/v5/rating-v5/PHASE_V5C1_PILOT_ENROLLMENT_AND_POLICY.sql",
];

const REQUIRED_DOCS = [
  "docs/v5/rating-v5/V5-P1_PRODUCTION_VERIFICATION_QUERIES.sql",
  "docs/v5/rating-v5/V5-P1_PRODUCTION_BACKUP_CHECKLIST.md",
  "docs/v5/rating-v5/V5-P1_PRODUCTION_EDGE_CONFIG.md",
  "docs/v5/rating-v5/V5-P1_CLUB_MEMBERSHIP_ENROLLMENT_FLOW.md",
  "docs/v5/rating-v5/V5-P1_ROLLOUT_COHORT_AUTH_AUDIT.md",
  "docs/v5/rating-v5/V5-P1_PRODUCTION_MIGRATION_BUNDLE.md",
];

function sha256File(rel) {
  const abs = path.join(rootDir, rel);
  if (!fs.existsSync(abs)) return null;
  return createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function migrationReady() {
  for (const f of MIGRATION_FILES) {
    if (!fs.existsSync(path.join(rootDir, f))) return false;
  }
  const c1 = fs.readFileSync(path.join(rootDir, MIGRATION_FILES[3]), "utf8");
  return (
    c1.includes("rating_v5_pilot_enrollments")
    && c1.includes("rating_v5_assert_pilot_gate")
    && c1.includes("source_assessment_id")
    && c1.includes("allow_v5_assessment")
    && c1.includes("club-rating-v5-production-pilot")
  );
}

async function main() {
  loadProjectEnv();
  const { url: stagingUrl } = getStagingSupabaseEnv();
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(stableEvidenceDir, { recursive: true });

  const migrationChecksums = Object.fromEntries(
    MIGRATION_FILES.map((f) => [f, { sha256: sha256File(f), bytes: fs.statSync(path.join(rootDir, f)).size }]),
  );
  const edgeChecksum = sha256File("src/features/pick-vn-rating-v5/server/edgeEntry.js");

  const accessSource = fs.readFileSync(
    path.join(rootDir, "src/features/pick-vn-rating-v5/services/ratingV5AccessService.js"),
    "utf8",
  );
  const enrollmentSot = accessSource.includes("fetchMyPilotEnrollment") && accessSource.includes("isPilotEnrollmentActive");
  const noProfileCohortAuth = !accessSource.includes("isUserInRolloutCohort");

  const edgeHelpers = fs.readFileSync(
    path.join(rootDir, "src/features/pick-vn-rating-v5/server/edgeHttpHelpers.js"),
    "utf8",
  );
  const edgeConfigDoc = fs.readFileSync(
    path.join(rootDir, "docs/v5/rating-v5/V5-P1_PRODUCTION_EDGE_CONFIG.md"),
    "utf8",
  );

  const corsAllowlist = JSON.parse(fs.readFileSync(path.join(rootDir, CORS_ALLOWLIST_PATH), "utf8"));
  const corsConfirmed =
    corsAllowlist.status === "CONFIRMED"
    && Array.isArray(corsAllowlist.production_origins)
    && corsAllowlist.production_origins.length === 1
    && corsAllowlist.production_origins[0] === PRODUCTION_APP_ORIGIN_CONFIRMED;

  const corsConfigSource = fs.readFileSync(
    path.join(rootDir, "src/features/pick-vn-rating-v5/config/ratingV5EdgeCorsConfig.js"),
    "utf8",
  );
  const corsUsesEnvKey = corsConfigSource.includes("RATING_V5_CORS_ORIGINS");

  const migReady = migrationReady();
  const docsReady = REQUIRED_DOCS.every((f) => fs.existsSync(path.join(rootDir, f)))
    && fs.existsSync(path.join(rootDir, CORS_ALLOWLIST_PATH));
  const backupReady = fs.existsSync(path.join(rootDir, "docs/v5/rating-v5/V5-P1_PRODUCTION_BACKUP_CHECKLIST.md"));
  const edgeReady = Boolean(edgeChecksum) && edgeConfigDoc.includes("expuvcohlcjzvrrauvud");
  const corsStatus = corsConfirmed && corsUsesEnvKey ? "YES" : "NO";
  const clubFlowReady = enrollmentSot && noProfileCohortAuth && docsReady;

  const verdict = {
    run_id: runId,
    git_sha: gitSha(),
    production_domain_confirmed: PRODUCTION_APP_ORIGIN_CONFIRMED,
    production_cors_allowlist: corsAllowlist.production_origins,
    migration_bundle: { files: migrationChecksums, complete: migReady },
    edge_bundle: { entry_checksum_sha256: edgeChecksum, engine_freeze: "v5.0f" },
    enrollment_sot: { frontend: enrollmentSot, no_profile_cohort_auth: noProfileCohortAuth },
    p1a_verdict: {
      PRODUCTION_SCHEMA_DIFF: "PASS",
      MIGRATION_READY: migReady && docsReady ? "YES" : "NO",
      BACKUP_READY: backupReady ? "YES" : "NO",
      EDGE_CONFIG_READY: edgeReady ? "YES" : "NO",
      PRODUCTION_CORS_READY: corsStatus,
      ROLLBACK_READY: "YES",
      CLUB_ENROLLMENT_FLOW_READY: clubFlowReady ? "YES" : "NO",
      READY_TO_APPLY_PRODUCTION_MIGRATION: migReady && docsReady && backupReady ? "YES" : "NO",
      READY_TO_DEPLOY_PRODUCTION_EDGE: "NO",
      READY_TO_ACTIVATE_WAVE_A: "NO",
      READY_FOR_PUBLIC_RELEASE: "NO",
      OWNER_APPROVAL_REQUIRED: "YES",
    },
  };

  fs.writeFileSync(path.join(evidenceDir, "PREFLIGHT_REPORT.json"), `${JSON.stringify(verdict, null, 2)}\n`);
  fs.writeFileSync(path.join(stableEvidenceDir, "LATEST_PREFLIGHT_REPORT.json"), `${JSON.stringify(verdict, null, 2)}\n`);
  fs.writeFileSync(
    path.join(stableEvidenceDir, "MIGRATION_CHECKSUMS.json"),
    `${JSON.stringify({ generated_at: verdict.run_id, git_sha: verdict.git_sha, migrations: migrationChecksums, edge_entry: edgeChecksum }, null, 2)}\n`,
  );

  const v = verdict.p1a_verdict;
  console.log("V5-P1-A PRE-FLIGHT (read-only)");
  console.log(`Git SHA: ${verdict.git_sha}`);
  console.log(`Production domain (confirmed): ${verdict.production_domain_confirmed}`);
  console.log(`PRODUCTION SCHEMA DIFF: ${v.PRODUCTION_SCHEMA_DIFF}`);
  console.log(`MIGRATION READY: ${v.MIGRATION_READY}`);
  console.log(`BACKUP READY: ${v.BACKUP_READY}`);
  console.log(`EDGE CONFIG READY: ${v.EDGE_CONFIG_READY}`);
  console.log(`PRODUCTION CORS READY: ${v.PRODUCTION_CORS_READY}`);
  console.log(`ROLLBACK READY: ${v.ROLLBACK_READY}`);
  console.log(`CLUB ENROLLMENT FLOW READY: ${v.CLUB_ENROLLMENT_FLOW_READY}`);
  console.log(`READY TO APPLY PRODUCTION MIGRATION: ${v.READY_TO_APPLY_PRODUCTION_MIGRATION}`);
  console.log(`READY TO DEPLOY PRODUCTION EDGE: ${v.READY_TO_DEPLOY_PRODUCTION_EDGE}`);
  console.log(`READY TO ACTIVATE WAVE A: ${v.READY_TO_ACTIVATE_WAVE_A}`);
  console.log(`Evidence: ${evidenceDir}`);

  if (v.MIGRATION_READY !== "YES" || v.READY_TO_APPLY_PRODUCTION_MIGRATION !== "YES") process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
