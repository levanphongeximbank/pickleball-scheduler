#!/usr/bin/env node
/**
 * V5-C.1C — Prepare Wave 1 staging PLAYER accounts (no enrollment).
 *
 * Usage:
 *   node scripts/prepare-rating-v5-wave1-accounts.mjs --dry-run
 *   node scripts/prepare-rating-v5-wave1-accounts.mjs
 *
 * Password: STAGING_WAVE1_ACCOUNT_PASSWORD or PHASE42L_QA_PASSWORD (never logged).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import {
  WAVE1_MANIFEST,
  STAGING_REF,
  PRODUCTION_REF,
  WAVE0_EMAILS,
  resolveVenueId,
  resolveTenantFromProfile,
} from "./lib/rating-v5-wave1-manifest.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const artifactDir = path.join(rootDir, "artifacts", "rating-v5-wave1", runId);
const cohortCsvPath = path.join(rootDir, "docs/v5/rating-v5/V5-C1C_WAVE1_COHORT_REVIEW.csv");

const SECRET_PATTERNS = [
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
  /service_role/i,
  /password\s*[:=]/i,
];

function parseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") };
}

function wave1Password() {
  return String(
    process.env.STAGING_WAVE1_ACCOUNT_PASSWORD
      || process.env.PHASE42L_QA_PASSWORD
      || process.env.STAGING_PLAYER_NEW_PASSWORD
      || "",
  ).trim();
}

function assertStaging(url) {
  if (!url.includes(STAGING_REF) || url.includes(PRODUCTION_REF)) {
    throw new Error(`Staging env guard failed (expected ${STAGING_REF})`);
  }
}

async function findUserIdByEmail(admin, email) {
  let page = 1;
  while (page <= 10) {
    const res = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (res.error) throw new Error(res.error.message);
    const hit = (res.data?.users || []).find(
      (u) => String(u.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit.id;
    if ((res.data?.users || []).length < 200) break;
    page += 1;
  }
  return null;
}

function auditStatus({ authUserId, profile, enrollment, slot }) {
  if (WAVE0_EMAILS.has(slot.email)) return "INVALID";
  if (!authUserId) return "NEEDS_AUTH_USER";
  if (!profile) return "NEEDS_PROFILE";
  const tenant = resolveTenantFromProfile(profile);
  if (tenant !== slot.tenant_id) return "NEEDS_TENANT";
  if (String(profile.role || "").toUpperCase() !== "PLAYER") return "NEEDS_ROLE";
  if (enrollment?.status === "active") return "INVALID";
  return "READY";
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCohortCsv(rows) {
  const headers = [
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
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  fs.mkdirSync(path.dirname(cohortCsvPath), { recursive: true });
  fs.writeFileSync(cohortCsvPath, `${lines.join("\n")}\n`);
}

function scanSecrets(text) {
  return SECRET_PATTERNS.some((p) => p.test(text));
}

async function main() {
  const { dryRun } = parseArgs(process.argv);
  loadProjectEnv();
  const { url, serviceKey } = getStagingSupabaseEnv();
  assertStaging(url);
  if (!serviceKey) throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");

  const password = wave1Password();
  if (!password && !dryRun) {
    throw new Error("Set STAGING_WAVE1_ACCOUNT_PASSWORD or PHASE42L_QA_PASSWORD");
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  fs.mkdirSync(artifactDir, { recursive: true });

  /** @type {Array<Record<string, unknown>>} */
  const accountReports = [];

  for (const slot of WAVE1_MANIFEST) {
    let authUserId = await findUserIdByEmail(admin, slot.email);
    let created = false;

    if (!authUserId && slot.create) {
      if (dryRun) {
        accountReports.push({ slot: slot.slot, email: slot.email, action: "would_create_auth_user" });
        continue;
      }
      const { data, error } = await admin.auth.admin.createUser({
        email: slot.email,
        password,
        email_confirm: true,
        user_metadata: { wave1_slot: slot.slot, purpose: "v5-wave1-prep" },
      });
      if (error) {
        accountReports.push({ slot: slot.slot, email: slot.email, action: "create_failed", error: error.message });
        continue;
      }
      authUserId = data.user?.id ?? null;
      created = true;
    }

    if (!authUserId) {
      accountReports.push({ slot: slot.slot, email: slot.email, action: "skip_no_auth", audit: auditStatus({ authUserId: null, profile: null, enrollment: null, slot }) });
      continue;
    }

    const venueId = resolveVenueId(slot.tenant_id);
    if (!dryRun) {
      const { error: profErr } = await admin.from("profiles").upsert(
        {
          id: authUserId,
          email: slot.email,
          display_name: slot.display_name,
          role: "PLAYER",
          venue_id: venueId,
          gender: slot.gender || null,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (profErr) {
        accountReports.push({ slot: slot.slot, email: slot.email, action: "profile_upsert_failed", error: profErr.message });
        continue;
      }
    }

    const { data: profile } = dryRun
      ? { data: null }
      : await admin.from("profiles").select("*").eq("id", authUserId).maybeSingle();

    const { data: enrollment } = dryRun
      ? { data: null }
      : await admin
          .from("rating_v5_pilot_enrollments")
          .select("status, cohort_label")
          .eq("player_id", authUserId)
          .maybeSingle();

    const audit = auditStatus({ authUserId, profile: profile ?? { role: "PLAYER", venue_id: venueId }, enrollment, slot });

    accountReports.push({
      slot: slot.slot,
      email: slot.email,
      action: created ? "created" : dryRun ? "dry_run_ok" : "verified",
      auth_user_id: authUserId,
      audit,
      enrollment_status: enrollment?.status ?? "none",
    });
  }

  const { data: allProfiles } = dryRun
    ? { data: [] }
    : await admin.from("profiles").select("id, email, role, venue_id, player_id, gender, status").in(
        "email",
        WAVE1_MANIFEST.map((s) => s.email),
      );

  const profileByEmail = new Map((allProfiles || []).map((p) => [String(p.email).toLowerCase(), p]));

  const cohortRows = WAVE1_MANIFEST.map((slot) => {
    const p = profileByEmail.get(slot.email.toLowerCase());
    const report = accountReports.find((r) => r.slot === slot.slot);
    return {
      slot: slot.slot,
      auth_user_id: p?.id ?? report?.auth_user_id ?? "",
      player_id: p?.player_id ?? p?.id ?? "",
      email: slot.email,
      display_name: slot.display_name,
      tenant_id: slot.tenant_id,
      gender: slot.gender,
      experience_band: slot.experience_band,
      expected_skill_band: slot.expected_skill_band,
      coach_estimate: "",
      coach_confidence: "",
      coach_reviewer: "",
      coach_reviewed_at: "",
      coach_review_status: "PENDING_COACH_REVIEW",
      court_test_status: "PENDING",
      account_status: report?.audit ?? (dryRun ? "DRY_RUN" : "UNKNOWN"),
      enrollment_status: report?.enrollment_status ?? "none",
      notes: "V5-C.1C prep — not enrolled; coach estimate independent pending",
    };
  });

  writeCohortCsv(cohortRows);

  const report = {
    run_id: runId,
    dry_run: dryRun,
    staging_ref: STAGING_REF,
    candidate_count: WAVE1_MANIFEST.length,
    account_reports: accountReports,
    cohort_csv: cohortCsvPath,
    secret_scan_pass: !scanSecrets(JSON.stringify(accountReports)),
  };

  fs.writeFileSync(path.join(artifactDir, "prepare-report.json"), `${JSON.stringify(report, null, 2)}\n`);

  const ready = accountReports.filter((r) => r.audit === "READY").length;
  console.log(`Wave 1 prepare ${dryRun ? "(dry-run)" : "complete"}: ${ready}/${WAVE1_MANIFEST.length} READY`);
  console.log(`Cohort CSV: ${cohortCsvPath}`);
  console.log(`Evidence: ${artifactDir}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
