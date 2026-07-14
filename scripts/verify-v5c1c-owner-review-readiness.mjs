#!/usr/bin/env node
/**
 * V5-C.1C-R — Owner review readiness validation (no enrollment).
 *
 * Usage: node scripts/verify-v5c1c-owner-review-readiness.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import {
  STAGING_REF,
  PRODUCTION_REF,
  WAVE0_AUTH_IDS,
  resolveTenantFromProfile,
} from "./lib/rating-v5-wave1-manifest.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cohortCsvPath = path.join(rootDir, "docs/v5/rating-v5/V5-C1C_WAVE1_COHORT_REVIEW.csv");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDir = path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-c1c-owner-review", runId);

const REQUIRED_COLUMNS = [
  "slot",
  "auth_user_id",
  "player_id",
  "email",
  "display_name",
  "tenant_id",
  "gender",
  "experience_band",
  "expected_skill_band",
  "coach_estimate",
  "coach_confidence",
  "coach_reviewer",
  "coach_reviewed_at",
  "coach_review_status",
  "court_test_status",
  "account_status",
  "enrollment_status",
  "notes",
];

const INTENTIONAL_QA_EMAILS = new Set(["qa42l.nomember@staging.local"]);
const QA_PATTERN = /^(qa\d|test\.|wave0|player\.nomember@)/i;

const SECRET_PATTERNS = [
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
  /service_role/i,
  /password/i,
];

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(",");
    /** @type {Record<string, string>} */
    const row = {};
    headers.forEach((h, i) => {
      row[h] = String(cols[i] ?? "").trim();
    });
    return row;
  });
  return { headers, rows };
}

function coachRowComplete(row) {
  return Boolean(
    row.coach_estimate
      && row.coach_confidence
      && row.coach_reviewer
      && row.coach_reviewed_at
      && String(row.coach_review_status).toUpperCase() === "COMPLETE",
  );
}

async function main() {
  loadProjectEnv();
  const { url, serviceKey } = getStagingSupabaseEnv();
  fs.mkdirSync(evidenceDir, { recursive: true });

  if (!fs.existsSync(cohortCsvPath)) {
    console.log("OWNER REVIEW DATA COMPLETE: FAIL");
    console.log("COACH ESTIMATES COMPLETE: FAIL");
    console.log("GENDER MIX: FAIL");
    console.log("TENANT MIX: FAIL");
    console.log("DATA QUALITY: FAIL");
    console.log("READY FOR OWNER APPROVAL: NO");
    console.log("READY TO ENROLL WAVE 1: NO");
    process.exit(1);
  }

  const raw = fs.readFileSync(cohortCsvPath, "utf8");
  const { headers, rows } = parseCsv(raw);
  const missingCols = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  const secretHits = SECRET_PATTERNS.filter((p) => p.test(raw)).length;

  const readyCount = rows.filter((r) => r.account_status === "READY").length;
  const bands = { "1.5-2.5": 0, "3.0-3.5": 0, "4.0-4.5": 0 };
  for (const row of rows) {
    if (bands[row.expected_skill_band] != null) bands[row.expected_skill_band] += 1;
  }
  const bandOk = bands["1.5-2.5"] === 4 && bands["3.0-3.5"] === 5 && bands["4.0-4.5"] === 3;

  const genderNam = rows.filter((r) => r.gender === "Nam").length;
  const genderNu = rows.filter((r) => r.gender === "Nữ").length;
  const genderEmpty = rows.filter((r) => !r.gender).length;
  const genderMixOk = genderNam >= 2 && genderNu >= 2;

  const tenantA = rows.filter((r) => r.tenant_id === "venue-staging-a").length;
  const tenantPlatform = rows.filter((r) => r.tenant_id === "platform").length;
  const tenantMixOk = tenantA >= 2 && tenantPlatform >= 2;

  const authIds = rows.map((r) => r.auth_user_id).filter(Boolean);
  const emails = rows.map((r) => r.email).filter(Boolean);
  const dupAuth = authIds.length - new Set(authIds).size;
  const dupEmail = emails.length - new Set(emails.map((e) => e.toLowerCase())).size;
  const prodEmail = rows.filter((r) => !r.email.endsWith("@staging.local")).length;
  const wave0In = rows.filter((r) => WAVE0_AUTH_IDS.has(r.auth_user_id)).length;

  const unexpectedQa = rows.filter((r) => {
    const email = r.email.toLowerCase();
    if (INTENTIONAL_QA_EMAILS.has(email)) return false;
    return QA_PATTERN.test(email) || email.includes("qa42l") || email.includes("nomember");
  });

  const coachComplete = rows.filter(coachRowComplete).length;
  const coachEstimatesComplete = coachComplete === rows.length && rows.length === 12;

  let activeEnrollment = 0;
  let dbAligned = true;
  if (serviceKey && url.includes(STAGING_REF) && !url.includes(PRODUCTION_REF)) {
    const service = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: profiles } = await service
      .from("profiles")
      .select("id, email, role, venue_id, status")
      .in("email", emails);
    const byEmail = new Map((profiles || []).map((p) => [String(p.email).toLowerCase(), p]));
    for (const row of rows) {
      const p = byEmail.get(row.email.toLowerCase());
      if (!p || p.id !== row.auth_user_id) dbAligned = false;
      if (p && resolveTenantFromProfile(p) !== row.tenant_id) dbAligned = false;
      if (p && String(p.role).toUpperCase() !== "PLAYER") dbAligned = false;
    }
    const { data: enrollments } = await service
      .from("rating_v5_pilot_enrollments")
      .select("player_id, status")
      .in("player_id", authIds);
    activeEnrollment = (enrollments || []).filter((e) => e.status === "active").length;
  }

  const ownerReviewDataComplete =
    missingCols.length === 0
    && rows.length === 12
    && readyCount === 12
    && bandOk
    && secretHits === 0;

  const dataQualityPass =
    dupAuth === 0
    && dupEmail === 0
    && prodEmail === 0
    && wave0In === 0
    && activeEnrollment === 0
    && unexpectedQa.length === 0
    && dbAligned
    && secretHits === 0;

  const readyForOwnerApproval =
    ownerReviewDataComplete && dataQualityPass && genderMixOk && tenantMixOk;

  const verdict = {
    run_id: runId,
    owner_review_data_complete: ownerReviewDataComplete ? "PASS" : "FAIL",
    coach_estimates_complete: coachEstimatesComplete ? "PASS" : "FAIL",
    gender_mix: genderMixOk ? "PASS" : "FAIL",
    tenant_mix: tenantMixOk ? "PASS" : "FAIL",
    data_quality: dataQualityPass ? "PASS" : "FAIL",
    ready_for_owner_approval: readyForOwnerApproval ? "YES" : "NO",
    ready_to_enroll_wave1: "NO",
    metrics: {
      slot_count: rows.length,
      ready_count: readyCount,
      skill_bands: bands,
      gender: { Nam: genderNam, Nu: genderNu, empty: genderEmpty },
      tenant: { venue_staging_a: tenantA, platform: tenantPlatform },
      coach_complete: coachComplete,
      missing_columns: missingCols,
      unexpected_qa: unexpectedQa.map((r) => r.email),
      active_enrollment: activeEnrollment,
    },
  };

  fs.writeFileSync(path.join(evidenceDir, "REPORT.json"), `${JSON.stringify(verdict, null, 2)}\n`);

  console.log(`OWNER REVIEW DATA COMPLETE: ${verdict.owner_review_data_complete}`);
  console.log(`COACH ESTIMATES COMPLETE: ${verdict.coach_estimates_complete}`);
  console.log(`GENDER MIX: ${verdict.gender_mix}`);
  console.log(`TENANT MIX: ${verdict.tenant_mix}`);
  console.log(`DATA QUALITY: ${verdict.data_quality}`);
  console.log(`READY FOR OWNER APPROVAL: ${verdict.ready_for_owner_approval}`);
  console.log(`READY TO ENROLL WAVE 1: ${verdict.ready_to_enroll_wave1}`);
  console.log(`Evidence: ${evidenceDir}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
