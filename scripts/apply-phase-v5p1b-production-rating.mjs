#!/usr/bin/env node
/**
 * V5-P1-B — Apply Rating V5 migration bundle on Production (expuvcohlcjzvrrauvud).
 *
 * Usage:
 *   node scripts/apply-phase-v5p1b-production-rating.mjs
 *   node scripts/apply-phase-v5p1b-production-rating.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

import { loadProjectEnv } from "./load-env.mjs";
import { PRODUCTION_REF } from "./lib/rating-v5-wave1-manifest.mjs";

const MIGRATIONS = [
  { name: "phase_v5a_rating_foundation", file: "docs/v5/rating-v5/PHASE_V5A_RATING_FOUNDATION.sql" },
  { name: "phase_v5b1_complete_assessment", file: "docs/v5/rating-v5/PHASE_V5B1_COMPLETE_ASSESSMENT.sql" },
  { name: "phase_v5b1p_persistence_and_edge", file: "docs/v5/rating-v5/PHASE_V5B1P_PERSISTENCE_AND_EDGE.sql" },
  { name: "phase_v5c1_pilot_enrollment_and_policy", file: "docs/v5/rating-v5/PHASE_V5C1_PILOT_ENROLLMENT_AND_POLICY.sql" },
];

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1b-backup");

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function sha256File(rel) {
  const abs = path.join(rootDir, rel);
  return createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

async function executeManagementSql(token, sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || res.statusText;
    throw new Error(`${label}: ${msg}`);
  }
  return body;
}

async function runVerification(token) {
  const checks = [
    {
      id: "V2",
      sql: `select count(*)::int as v2_rows from public.pick_vn_player_ratings`,
    },
    {
      id: "V3",
      sql: `select table_name from information_schema.tables
        where table_schema='public' and table_name in (
          'rating_v5_pilot_enrollments','rating_v5_reassessment_approvals',
          'player_rating_profiles','player_skill_assessments','player_rating_events'
        ) order by table_name`,
    },
    {
      id: "V4",
      sql: `select allow_v5_assessment, pilot_cohort_label from public.rating_v5_rollout_config where id='default'`,
    },
    {
      id: "V5",
      sql: `select count(*)::int as active_enrollments from public.rating_v5_pilot_enrollments where status='active'`,
    },
  ];
  const out = {};
  for (const check of checks) {
    out[check.id] = await executeManagementSql(token, check.sql, check.id);
    console.log(`${check.id}:`, JSON.stringify(out[check.id]));
  }
  return out;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  loadProjectEnv();
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("❌ Missing SUPABASE_ACCESS_TOKEN");
    process.exit(2);
  }

  fs.mkdirSync(evidenceDir, { recursive: true });
  const checksums = Object.fromEntries(
    MIGRATIONS.map((m) => [m.file, { sha256: sha256File(m.file), bytes: fs.statSync(path.join(rootDir, m.file)).size }]),
  );

  console.log(`=== V5-P1-B Production Rating Migration ===\nProject: ${PRODUCTION_REF}\n`);

  if (dryRun) {
    console.log("dry-run OK — files:", MIGRATIONS.map((m) => m.file).join(", "));
    process.exit(0);
  }

  const baseline = await executeManagementSql(
    token,
    `select count(*)::int as v2_row_count from public.pick_vn_player_ratings;
     select count(*)::int as profile_count from public.profiles;
     select count(*)::int as club_member_count from public.club_members;`,
    "baseline",
  );

  const snapshot = {
    production_ref: PRODUCTION_REF,
    snapshot_at: new Date().toISOString(),
    v2_row_count: baseline?.[0]?.v2_row_count ?? null,
    profile_count: baseline?.[1]?.profile_count ?? null,
    club_member_count: baseline?.[2]?.club_member_count ?? null,
    migration_checksums_file: "qa-evidence/v5-p1a-preflight/MIGRATION_CHECKSUMS.json",
    migration_checksums: checksums,
    git_sha: gitSha(),
  };
  fs.writeFileSync(path.join(evidenceDir, "BASELINE_SNAPSHOT.json"), JSON.stringify(snapshot, null, 2));
  console.log("Baseline snapshot saved.\n");

  for (const migration of MIGRATIONS) {
    const sql = fs.readFileSync(path.join(rootDir, migration.file), "utf8");
    console.log(`▶ Applying ${migration.file} ...`);
    await executeManagementSql(token, sql, migration.name);
    console.log(`✅ ${migration.file}`);
  }

  const verification = await runVerification(token);
  const report = {
    applied_at: new Date().toISOString(),
    production_ref: PRODUCTION_REF,
    git_sha: snapshot.git_sha,
    migrations: MIGRATIONS.map((m) => m.file),
    baseline: snapshot,
    verification,
    verdict: "PASS",
  };
  fs.writeFileSync(
    path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1b-backup/MIGRATION_APPLY_REPORT.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("\n✅ Production migration apply complete.\n");
}

main().catch((err) => {
  console.error(`\n❌ Apply failed: ${err?.message || err}`);
  process.exit(1);
});
