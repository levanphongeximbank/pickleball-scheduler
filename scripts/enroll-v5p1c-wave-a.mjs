#!/usr/bin/env node
/**
 * P1-C.5 — Enroll Production Wave A (max 5) via rating_v5_admin_upsert_pilot_enrollment.
 *
 * Usage:
 *   PRODUCTION_P1C_ENROLL_GO=YES node scripts/enroll-v5p1c-wave-a.mjs
 *   PRODUCTION_P1C_ENROLL_GO=YES node scripts/enroll-v5p1c-wave-a.mjs --retry
 *
 * Does NOT enable allow_v5_assessment / Vercel flags / assessment.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { loadProjectEnv } from "./load-env.mjs";
import {
  PRODUCTION_REF,
  PILOT_CLUB_ID,
  PILOT_TENANT_ID,
  WAVE_A_COHORT_LABEL,
  CANDIDATE_INPUT_CSV,
  ALLOWED_SKILL_BANDS,
  parseCandidateCsv,
} from "./lib/v5p1c-wave-a-manifest.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLAN_JSON =
  "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-18-29-545Z/PLAYER_LINK_PLAN.json";
const LINK_RESULTS = "docs/v5/rating-v5/V5-P1C_PLAYER_LINK_RESULTS.md";
const ADMIN_EMAIL = "lephong.eximbank@gmail.com";
const CONTROL_EMAIL = "lephong.eximbank@gmail.com";

async function getKeys() {
  loadProjectEnv({ production: true });
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) throw new Error("Missing SUPABASE_ACCESS_TOKEN");
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || "api-keys failed");
  return {
    url: `https://${PRODUCTION_REF}.supabase.co`,
    serviceKey: body.find((k) => k.name === "service_role")?.api_key,
    anonKey: body.find((k) => k.name === "anon")?.api_key,
  };
}

async function signInAsAdmin(url, serviceKey, anonKey) {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: ADMIN_EMAIL,
  });
  if (error) throw error;
  const hashed = data?.properties?.hashed_token;
  if (!hashed) throw new Error("Missing hashed_token for admin magic link");
  const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const verify = await userClient.auth.verifyOtp({ token_hash: hashed, type: "email" });
  if (verify.error) throw verify.error;
  await userClient.auth.setSession({
    access_token: verify.data.session.access_token,
    refresh_token: verify.data.session.refresh_token,
  });
  return { admin, userClient, enrolledBy: verify.data.user.id };
}

function readFrontendFlag() {
  for (const f of [".env.production.local", ".env.production", ".env.local", ".env"]) {
    const p = path.join(rootDir, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^VITE_PICK_VN_RATING_V5_ENABLED=(.*)$/m);
    if (m) return { file: f, value: String(m[1]).trim() };
  }
  return { file: null, value: "unset/false (no local override found)" };
}

async function main() {
  const ownerGo = String(process.env.PRODUCTION_P1C_ENROLL_GO || "").trim() === "YES";
  if (!ownerGo) {
    console.error("BLOCKED — requires PRODUCTION_P1C_ENROLL_GO=YES");
    process.exit(2);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a", `${runId}-enroll`);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const { url, serviceKey, anonKey } = await getKeys();
  const { admin, userClient, enrolledBy } = await signInAsAdmin(url, serviceKey, anonKey);

  const plan = JSON.parse(fs.readFileSync(path.join(rootDir, PLAN_JSON), "utf8"));
  const csvSlots = parseCandidateCsv(fs.readFileSync(path.join(rootDir, CANDIDATE_INPUT_CSV), "utf8"));
  const skillByEmail = new Map(
    csvSlots.map((s) => [String(s.email || "").trim().toLowerCase(), s.expected_skill_band])
  );

  const { data: rollout } = await admin
    .from("rating_v5_rollout_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  const { count: activeBefore } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const { count: v2Before } = await admin
    .from("pick_vn_player_ratings")
    .select("id", { count: "exact", head: true });
  const { data: enrollTableBefore } = await admin.from("rating_v5_pilot_enrollments").select("*");
  const frontendFlag = readFrontendFlag();

  if (rollout?.allow_v5_assessment !== false) {
    throw new Error("ABORT allow_v5_assessment is not false");
  }
  // Fresh enroll expected 0 active. Idempotent re-run OK if already Wave A only.
  const unexpectedActive = (enrollTableBefore || []).filter(
    (r) =>
      r.status === "active" &&
      !(r.cohort_label === WAVE_A_COHORT_LABEL && plan.plans.some((p) => p.profiles_id === r.player_id || p.auth_users_id === r.player_id))
  );
  if (unexpectedActive.length > 0) {
    throw new Error(`ABORT unexpected active enrollments: ${unexpectedActive.length}`);
  }

  const candidates = [];
  for (const p of plan.plans) {
    const email = String(p.email).trim().toLowerCase();
    const band = skillByEmail.get(email);
    if (!band || !ALLOWED_SKILL_BANDS.has(band)) {
      throw new Error(`ABORT skill band invalid for ${email}: ${band}`);
    }
    const profileId = p.profiles_id || p.auth_users_id;
    let { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id,email,status,player_id,venue_id")
      .eq("id", profileId)
      .maybeSingle();
    if (!profile) {
      ({ data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("id,email,status,player_id,venue_id")
        .eq("email", email)
        .maybeSingle());
    }
    if (!profile) {
      throw new Error(
        `ABORT missing profile ${email} id=${profileId} err=${profileErr?.message || "none"}`
      );
    }
    if (String(profile.id) !== String(profileId)) {
      throw new Error(`ABORT profile id drift ${email}`);
    }
    if (profile.player_id !== p.proposed_player_id) {
      throw new Error(
        `ABORT player_id mismatch ${email}: have=${profile.player_id} expected=${p.proposed_player_id}`
      );
    }
    const { data: member } = await admin
      .from("club_members")
      .select("club_id,status")
      .eq("user_id", profile.id)
      .eq("club_id", PILOT_CLUB_ID)
      .maybeSingle();
    if (!member || member.status !== "active") {
      throw new Error(`ABORT club membership ${email}`);
    }
    candidates.push({
      slot: plan.plans.indexOf(p) >= 0 ? `WA-0${plan.plans.indexOf(p) + 1}` : p.slot,
      email,
      skill_band: band,
      profiles_id: profile.id,
      player_id_text: profile.player_id,
      tenant_id: PILOT_TENANT_ID,
      cohort_label: WAVE_A_COHORT_LABEL,
      club_membership: member.status,
    });
  }

  // Fix slots from CSV order
  const emailToSlot = new Map(csvSlots.map((s) => [String(s.email).trim().toLowerCase(), s.slot]));
  for (const c of candidates) c.slot = emailToSlot.get(c.email) || c.slot;

  const pre = {
    production_ref: PRODUCTION_REF,
    url,
    link_results_present: fs.existsSync(path.join(rootDir, LINK_RESULTS)),
    cohort_label: WAVE_A_COHORT_LABEL,
    enrolled_by_admin: { email: ADMIN_EMAIL, id: enrolledBy },
    rollout_config: rollout,
    active_enrollments_before: activeBefore ?? 0,
    v2_rows_before: v2Before ?? 0,
    enrollment_table_before: enrollTableBefore || [],
    vite_pick_vn_rating_v5_enabled: frontendFlag,
    candidates,
  };
  fs.writeFileSync(path.join(evidenceDir, "PRE_ENROLL_SNAPSHOT.json"), JSON.stringify(pre, null, 2));

  const enrollResults = [];
  for (const c of candidates) {
    const { data, error } = await userClient.rpc("rating_v5_admin_upsert_pilot_enrollment", {
      p_player_id: c.profiles_id,
      p_tenant_id: c.tenant_id,
      p_cohort_label: c.cohort_label,
      p_status: "active",
      p_expires_at: null,
      p_notes: `P1-C.5 Wave A ${c.slot} ${c.skill_band}`,
    });
    enrollResults.push({
      slot: c.slot,
      email: c.email,
      profiles_id: c.profiles_id,
      rpc_error: error?.message || null,
      rpc_result: data,
    });
    if (error || !data?.ok) {
      throw new Error(`ENROLL FAILED ${c.slot}: ${error?.message || JSON.stringify(data)}`);
    }
  }

  const { data: activeRows } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("*")
    .eq("status", "active")
    .eq("cohort_label", WAVE_A_COHORT_LABEL);
  const { count: activeAfter } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const { count: v2After } = await admin
    .from("pick_vn_player_ratings")
    .select("id", { count: "exact", head: true });
  const { data: rolloutAfter } = await admin
    .from("rating_v5_rollout_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();

  // Idempotent retry
  const retryResults = [];
  for (const c of candidates) {
    const before = activeRows.find((r) => r.player_id === c.profiles_id);
    const { data, error } = await userClient.rpc("rating_v5_admin_upsert_pilot_enrollment", {
      p_player_id: c.profiles_id,
      p_tenant_id: c.tenant_id,
      p_cohort_label: c.cohort_label,
      p_status: "active",
      p_expected_version: before?.version ?? null,
      p_expires_at: null,
      p_notes: `P1-C.5 Wave A ${c.slot} ${c.skill_band}`,
    });
    retryResults.push({
      slot: c.slot,
      email: c.email,
      rpc_error: error?.message || null,
      rpc_result: data,
      version_before: before?.version ?? null,
      version_after: data?.enrollment?.version ?? null,
    });
    if (error || !data?.ok) {
      throw new Error(`RETRY FAILED ${c.slot}: ${error?.message || JSON.stringify(data)}`);
    }
  }

  const { count: activeAfterRetry } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const { data: activeAfterRetryRows } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("player_id,tenant_id,cohort_label,status")
    .eq("status", "active")
    .eq("cohort_label", WAVE_A_COHORT_LABEL);

  // Control user blocked
  const { data: controlProfile } = await admin
    .from("profiles")
    .select("id,email")
    .eq("email", CONTROL_EMAIL)
    .maybeSingle();
  const { data: controlEnroll } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("id,status,cohort_label")
    .eq("player_id", controlProfile.id)
    .eq("status", "active");
  const gateControl = await admin.rpc("rating_v5_assert_pilot_gate", {
    p_player_id: controlProfile.id,
    p_tenant_id: PILOT_TENANT_ID,
    p_action: "start",
  });
  // Cross-tenant: Wave A player with wrong tenant
  const sample = candidates[0];
  const gateCross = await admin.rpc("rating_v5_assert_pilot_gate", {
    p_player_id: sample.profiles_id,
    p_tenant_id: "venue-staging-a",
    p_action: "start",
  });

  // Membership unchanged
  const memberships = [];
  for (const c of candidates) {
    const { data: member } = await admin
      .from("club_members")
      .select("club_id,status")
      .eq("user_id", c.profiles_id)
      .eq("club_id", PILOT_CLUB_ID)
      .maybeSingle();
    memberships.push({ email: c.email, ...member });
  }

  const duplicateActive =
    (activeAfterRetryRows || []).length -
    new Set((activeAfterRetryRows || []).map((r) => r.player_id)).size;

  const report = {
    gate: "P1-C.5",
    run_id: runId,
    production_ref: PRODUCTION_REF,
    url,
    production_changed: true,
    scope: "rating_v5_pilot_enrollments only",
    cohort_label: WAVE_A_COHORT_LABEL,
    enrolled_by: { email: ADMIN_EMAIL, id: enrolledBy },
    pre,
    enroll_results: enrollResults,
    retry_results: retryResults,
    post: {
      active_enrollments: activeAfter ?? 0,
      active_enrollments_after_retry: activeAfterRetry ?? 0,
      wave_a_active_rows: activeAfterRetryRows,
      duplicate_active_player_ids: duplicateActive,
      v2_rows_before: v2Before ?? 0,
      v2_rows_after: v2After ?? 0,
      allow_v5_assessment: rolloutAfter?.allow_v5_assessment ?? null,
      pilot_cohort_label_config: rolloutAfter?.pilot_cohort_label ?? null,
      frontend_flag: frontendFlag,
      memberships,
      control: {
        email: CONTROL_EMAIL,
        active_enrollments: controlEnroll || [],
        assert_pilot_gate: gateControl.data ?? gateControl.error,
      },
      cross_tenant_assert: gateCross.data ?? gateCross.error,
    },
  };

  fs.writeFileSync(path.join(evidenceDir, "ENROLLMENT_REPORT.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/LATEST_ENROLLMENT_REPORT.json"),
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify({
    evidence: evidenceDir,
    active_enrollments: report.post.active_enrollments,
    duplicates: duplicateActive,
    allow_v5_assessment: report.post.allow_v5_assessment,
    control_gate: report.post.control.assert_pilot_gate,
    cross_tenant_gate: report.post.cross_tenant_assert,
    enroll_ok: enrollResults.every((r) => r.rpc_result?.ok),
    retry_ok: retryResults.every((r) => r.rpc_result?.ok),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
