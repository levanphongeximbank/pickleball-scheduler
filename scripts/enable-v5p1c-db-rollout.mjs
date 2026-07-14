#!/usr/bin/env node
/**
 * P1-C.6 — Enable Rating V5 database rollout only (Production).
 *
 * Usage:
 *   PRODUCTION_P1C_DB_ROLLOUT_GO=YES node scripts/enable-v5p1c-db-rollout.mjs
 *
 * Does NOT change Vercel/frontend flags, does NOT start assessment, does NOT enroll.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { loadProjectEnv } from "./load-env.mjs";
import {
  PRODUCTION_REF,
  PILOT_CLUB_ID,
  PILOT_TENANT_ID,
  WAVE_A_COHORT_LABEL,
} from "./lib/v5p1c-wave-a-manifest.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLAN_JSON =
  "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-18-29-545Z/PLAYER_LINK_PLAN.json";
const ADMIN_EMAIL = "lephong.eximbank@gmail.com";
const CONTROL_EMAIL = "lephong.eximbank@gmail.com";
const KILL_SWITCH_SQL =
  "UPDATE public.rating_v5_rollout_config SET allow_v5_assessment = false, updated_at = now() WHERE id = 'default';";

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

async function signInAs(admin, anonKey, url, email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const verify = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (verify.error) throw verify.error;
  await client.auth.setSession({
    access_token: verify.data.session.access_token,
    refresh_token: verify.data.session.refresh_token,
  });
  return client;
}

function readLocalFrontendFlag() {
  for (const f of [".env.production.local", ".env.production", ".env.local", ".env"]) {
    const p = path.join(rootDir, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^VITE_PICK_VN_RATING_V5_ENABLED=(.*)$/m);
    if (m) return { file: f, value: String(m[1]).trim() };
  }
  return { file: null, value: "unset/false" };
}

function readVercelFrontendFlag() {
  try {
    const out = execSync("npx vercel env ls production", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 90000,
      cwd: rootDir,
    });
    const lines = out.split(/\r?\n/).filter((l) => l.includes("VITE_PICK_VN_RATING_V5_ENABLED"));
    return { ok: true, lines, mentions: lines.length > 0 };
  } catch (e) {
    return { ok: false, error: String(e.message || e).slice(0, 300) };
  }
}

async function main() {
  if (String(process.env.PRODUCTION_P1C_DB_ROLLOUT_GO || "").trim() !== "YES") {
    console.error("BLOCKED — requires PRODUCTION_P1C_DB_ROLLOUT_GO=YES");
    process.exit(2);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = path.join(
    rootDir,
    "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a",
    `${runId}-db-rollout`
  );
  fs.mkdirSync(evidenceDir, { recursive: true });

  const { url, serviceKey, anonKey } = await getKeys();
  if (!url.includes(PRODUCTION_REF)) throw new Error(`Wrong project URL: ${url}`);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const plan = JSON.parse(fs.readFileSync(path.join(rootDir, PLAN_JSON), "utf8"));
  const wavePlayers = plan.plans.map((p) => ({
    slot: p.slot,
    email: p.email,
    id: p.profiles_id || p.auth_users_id,
    player_id_text: p.proposed_player_id,
  }));

  const { data: rolloutBefore } = await admin
    .from("rating_v5_rollout_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  const { data: waveActive } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("*")
    .eq("status", "active")
    .eq("cohort_label", WAVE_A_COHORT_LABEL);
  const { count: activeAll } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const { count: v2Before } = await admin
    .from("pick_vn_player_ratings")
    .select("id", { count: "exact", head: true });
  const { count: eventsBefore } = await admin
    .from("player_rating_events")
    .select("id", { count: "exact", head: true });

  const preProfiles = [];
  for (const w of wavePlayers) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id,email,player_id,status")
      .eq("id", w.id)
      .maybeSingle();
    const { data: member } = await admin
      .from("club_members")
      .select("club_id,status")
      .eq("user_id", w.id)
      .eq("club_id", PILOT_CLUB_ID)
      .maybeSingle();
    preProfiles.push({
      slot: w.slot,
      email: w.email,
      player_id_ok: profile?.player_id === w.player_id_text,
      player_id: profile?.player_id || null,
      membership: member?.status || "none",
    });
  }

  const frontendFlag = {
    local: readLocalFrontendFlag(),
    vercel: readVercelFrontendFlag(),
  };

  const uniqueWavePlayers = new Set((waveActive || []).map((r) => r.player_id));
  const pre = {
    production_ref: PRODUCTION_REF,
    url,
    rollout_before: rolloutBefore,
    active_wave_a: (waveActive || []).length,
    active_all: activeAll ?? 0,
    duplicate_wave_a: (waveActive || []).length - uniqueWavePlayers.size,
    v2_before: v2Before ?? 0,
    events_before: eventsBefore ?? 0,
    profiles: preProfiles,
    frontend_flag: frontendFlag,
  };

  if ((waveActive || []).length !== 5) {
    throw new Error(`expected 5 wave-a active, got ${(waveActive || []).length}`);
  }
  if (pre.duplicate_wave_a !== 0) throw new Error("duplicate wave-a enrollments");
  if (!preProfiles.every((p) => p.player_id_ok && p.membership === "active")) {
    throw new Error("link/membership precheck fail");
  }
  const flagVal = String(frontendFlag.local.value || "").toLowerCase();
  if (flagVal === "true" || flagVal === "1") {
    throw new Error("frontend local flag unexpectedly true");
  }

  fs.writeFileSync(path.join(evidenceDir, "PRE_DB_ROLLOUT_SNAPSHOT.json"), JSON.stringify(pre, null, 2));
  console.log("PRECHECK PASS");

  const { data: updated, error: updErr } = await admin
    .from("rating_v5_rollout_config")
    .update({
      allow_v5_assessment: true,
      shadow_mode_enabled: true,
      compare_v2_enabled: true,
      pilot_cohort_label: WAVE_A_COHORT_LABEL,
      max_completed_assessments: 1,
      cooldown_days: 7,
      reassessment_requires_approval: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default")
    .select("*")
    .maybeSingle();
  if (updErr) throw updErr;
  console.log("ROLLOUT UPDATED");

  const sample = wavePlayers[0];
  const gateEnrolled = await admin.rpc("rating_v5_assert_pilot_gate", {
    p_player_id: sample.id,
    p_tenant_id: PILOT_TENANT_ID,
    p_action: "start",
  });

  const { data: controlProfile } = await admin
    .from("profiles")
    .select("id,email")
    .eq("email", CONTROL_EMAIL)
    .maybeSingle();
  const gateControl = await admin.rpc("rating_v5_assert_pilot_gate", {
    p_player_id: controlProfile.id,
    p_tenant_id: PILOT_TENANT_ID,
    p_action: "start",
  });
  const gateCross = await admin.rpc("rating_v5_assert_pilot_gate", {
    p_player_id: sample.id,
    p_tenant_id: "venue-staging-a",
    p_action: "start",
  });

  const pauseTarget = wavePlayers[4];
  const adminClient = await signInAs(admin, anonKey, url, ADMIN_EMAIL);
  const pauseRes = await adminClient.rpc("rating_v5_admin_upsert_pilot_enrollment", {
    p_player_id: pauseTarget.id,
    p_tenant_id: PILOT_TENANT_ID,
    p_cohort_label: WAVE_A_COHORT_LABEL,
    p_status: "paused",
    p_notes: "P1-C.6 temporary pause for gate verification",
  });
  const gatePaused = await admin.rpc("rating_v5_assert_pilot_gate", {
    p_player_id: pauseTarget.id,
    p_tenant_id: PILOT_TENANT_ID,
    p_action: "start",
  });
  const unpauseRes = await adminClient.rpc("rating_v5_admin_upsert_pilot_enrollment", {
    p_player_id: pauseTarget.id,
    p_tenant_id: PILOT_TENANT_ID,
    p_cohort_label: WAVE_A_COHORT_LABEL,
    p_status: "active",
    p_notes: "P1-C.6 restore active after pause probe",
  });
  const gateAfterUnpause = await admin.rpc("rating_v5_assert_pilot_gate", {
    p_player_id: pauseTarget.id,
    p_tenant_id: PILOT_TENANT_ID,
    p_action: "start",
  });

  let edge = { ok: false };
  try {
    const edgeUrl = `${url}/functions/v1/rating-v5-complete-assessment`;
    const er = await fetch(edgeUrl, {
      method: "OPTIONS",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    const er2 = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const bodyText = await er2.text();
    edge = {
      ok: er.status < 500 && er2.status < 500,
      options_status: er.status,
      post: { status: er2.status, body: bodyText.slice(0, 400) },
      url: edgeUrl,
    };
  } catch (e) {
    edge = { ok: false, error: String(e.message || e) };
  }

  const { count: v2Mid } = await admin
    .from("pick_vn_player_ratings")
    .select("id", { count: "exact", head: true });
  const { count: eventsMid } = await admin
    .from("player_rating_events")
    .select("id", { count: "exact", head: true });

  const { data: killOff } = await admin
    .from("rating_v5_rollout_config")
    .update({
      allow_v5_assessment: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default")
    .select("allow_v5_assessment")
    .maybeSingle();
  const gateKill = await admin.rpc("rating_v5_assert_pilot_gate", {
    p_player_id: sample.id,
    p_tenant_id: PILOT_TENANT_ID,
    p_action: "start",
  });

  const checks = {
    enrolled_gate_ok: gateEnrolled.data?.ok === true,
    control_code: gateControl.data?.code || null,
    cross_code: gateCross.data?.code || null,
    paused_blocked:
      gatePaused.data?.ok === false &&
      (gatePaused.data?.code === "PILOT_NOT_ENROLLED" ||
        gatePaused.data?.enrollment_status === "paused"),
    unpause_gate_ok: gateAfterUnpause.data?.ok === true,
    kill_off_code: gateKill.data?.code || null,
    events_unchanged: (eventsMid ?? 0) === (eventsBefore ?? 0),
    v2_unchanged: (v2Mid ?? 0) === (v2Before ?? 0),
    edge_ok: edge.ok === true,
    pause_rpc_ok: pauseRes.data?.ok === true,
    unpause_rpc_ok: unpauseRes.data?.ok === true,
    frontend_flag_not_true: !(flagVal === "true" || flagVal === "1"),
  };

  const allPass =
    checks.enrolled_gate_ok &&
    checks.control_code === "PILOT_NOT_ENROLLED" &&
    checks.cross_code === "PILOT_NOT_ENROLLED" &&
    checks.paused_blocked &&
    checks.unpause_gate_ok &&
    checks.kill_off_code === "ROLLOUT_BLOCKED" &&
    checks.events_unchanged &&
    checks.v2_unchanged &&
    checks.edge_ok &&
    checks.pause_rpc_ok &&
    checks.unpause_rpc_ok &&
    checks.frontend_flag_not_true;

  let finalConfig = null;
  if (allPass) {
    const { data: restored } = await admin
      .from("rating_v5_rollout_config")
      .update({
        allow_v5_assessment: true,
        shadow_mode_enabled: true,
        compare_v2_enabled: true,
        pilot_cohort_label: WAVE_A_COHORT_LABEL,
        max_completed_assessments: 1,
        cooldown_days: 7,
        reassessment_requires_approval: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default")
      .select("*")
      .maybeSingle();
    finalConfig = restored;
    console.log("ALL CHECKS PASS — allow_v5_assessment restored true");
  } else {
    const { data } = await admin
      .from("rating_v5_rollout_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    finalConfig = data;
    console.log("CHECKS FAILED — leaving allow_v5_assessment=", finalConfig?.allow_v5_assessment);
  }

  const { data: waveFinal } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("player_id,status,cohort_label,tenant_id")
    .eq("cohort_label", WAVE_A_COHORT_LABEL);
  const { count: v2After } = await admin
    .from("pick_vn_player_ratings")
    .select("id", { count: "exact", head: true });
  const { count: eventsAfter } = await admin
    .from("player_rating_events")
    .select("id", { count: "exact", head: true });

  const report = {
    gate: "P1-C.6",
    run_id: runId,
    production_ref: PRODUCTION_REF,
    url,
    pre,
    updated_config: updated,
    verification: {
      gate_enrolled: gateEnrolled.data ?? gateEnrolled.error,
      gate_control: gateControl.data ?? gateControl.error,
      gate_cross_tenant: gateCross.data ?? gateCross.error,
      gate_paused: gatePaused.data ?? gatePaused.error,
      gate_after_unpause: gateAfterUnpause.data ?? gateAfterUnpause.error,
      gate_kill_switch_off: gateKill.data ?? gateKill.error,
      kill_switch_off_value: killOff,
      edge,
      checks,
      all_pass: allPass,
    },
    final_config: finalConfig,
    post: {
      wave_a_rows: waveFinal,
      active_wave_a: (waveFinal || []).filter((r) => r.status === "active").length,
      v2_after: v2After ?? 0,
      events_after: eventsAfter ?? 0,
    },
    kill_switch_sql: KILL_SWITCH_SQL,
  };

  fs.writeFileSync(path.join(evidenceDir, "DB_ROLLOUT_REPORT.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/LATEST_DB_ROLLOUT_REPORT.json"),
    JSON.stringify(report, null, 2)
  );

  console.log(
    JSON.stringify(
      {
        evidence: evidenceDir,
        all_pass: allPass,
        checks,
        final_allow: finalConfig?.allow_v5_assessment,
        final_cohort: finalConfig?.pilot_cohort_label,
        shadow: finalConfig?.shadow_mode_enabled,
        compare_v2: finalConfig?.compare_v2_enabled,
        active_wave_a: report.post.active_wave_a,
        events: report.post.events_after,
        v2: report.post.v2_after,
      },
      null,
      2
    )
  );

  if (!allPass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
