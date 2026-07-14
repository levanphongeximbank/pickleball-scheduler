#!/usr/bin/env node
/**
 * P1-C.1 — Production Wave A player profile linkage (dry-run by default).
 *
 * Usage:
 *   node scripts/prepare-v5p1c-wave-a-player-links.mjs
 *   node scripts/prepare-v5p1c-wave-a-player-links.mjs --dry-run
 *   PRODUCTION_P1C_PLAYER_LINK_GO=YES node scripts/prepare-v5p1c-wave-a-player-links.mjs --apply
 *
 * Requires owner-filled docs/v5/rating-v5/V5-P1C_WAVE_A_CANDIDATE_INPUT.csv
 * Does NOT enroll. Does NOT enable rollout. Apply blocked without PRODUCTION_P1C_PLAYER_LINK_GO=YES.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { loadProjectEnv } from "./load-env.mjs";
import {
  PRODUCTION_REF,
  STAGING_REF,
  PILOT_CLUB_ID,
  ALLOWED_SKILL_BANDS,
  CANDIDATE_INPUT_CSV,
  buildPlayerIdForAuthUser,
  isBlockedEmail,
  parseCandidateCsv,
} from "./lib/v5p1c-wave-a-manifest.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDir = path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a", runId);

async function fetchProductionKeysFromManagementApi(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => []);
  if (!res.ok) throw new Error(body?.message || "Failed to fetch production API keys");
  const anon = body.find((k) => k.name === "anon")?.api_key;
  const service = body.find((k) => k.name === "service_role")?.api_key;
  if (!anon || !service) throw new Error("Missing production anon/service_role keys");
  return { url: `https://${PRODUCTION_REF}.supabase.co`, anonKey: anon, serviceKey: service };
}

async function getProductionAdmin() {
  loadProjectEnv({ production: true });
  let url = String(process.env.VITE_SUPABASE_URL || "").trim();
  let serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url.includes(PRODUCTION_REF) || url.includes(STAGING_REF) || !serviceKey) {
    const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
    if (!token) throw new Error("Missing production credentials");
    ({ url, serviceKey } = await fetchProductionKeysFromManagementApi(token));
  }
  if (!url.includes(PRODUCTION_REF)) throw new Error(`Refusing non-production URL: ${url}`);
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function classifyCandidate(slot, discovery) {
  const email = String(slot.email || "").trim().toLowerCase();
  if (!email) return "INVALID";
  if (isBlockedEmail(email)) return "INVALID";
  if (!slot.expected_skill_band || !ALLOWED_SKILL_BANDS.has(slot.expected_skill_band)) {
    return "NEEDS_OWNER_SKILL_BAND";
  }
  if (!discovery.authUserId) return "INVALID";
  if (!discovery.profile) return "INVALID";
  if (discovery.profile.status !== "active") return "INVALID";
  if (!discovery.membership || discovery.membership.status !== "active") return "NEEDS_CLUB_MEMBERSHIP";
  if (discovery.membership.club_id !== PILOT_CLUB_ID) return "NEEDS_CLUB_MEMBERSHIP";
  if (discovery.enrollmentActive) return "INVALID";
  if (!discovery.profile.player_id) return "NEEDS_PLAYER_LINK";
  return "READY";
}

async function discoverCandidate(admin, slot) {
  const email = String(slot.email || "").trim().toLowerCase();
  if (!email) {
    return { email: "", authUserId: null, profile: null, membership: null, enrollmentActive: false };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, display_name, role, status, venue_id, player_id")
    .eq("email", email)
    .maybeSingle();

  let membership = null;
  if (profile?.id) {
    const { data: member } = await admin
      .from("club_members")
      .select("club_id, status, user_id")
      .eq("user_id", profile.id)
      .eq("club_id", PILOT_CLUB_ID)
      .maybeSingle();
    membership = member;
  }

  let enrollmentActive = false;
  if (profile?.id) {
    const { count } = await admin
      .from("rating_v5_pilot_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("player_id", profile.id)
      .eq("status", "active");
    enrollmentActive = (count ?? 0) > 0;
  }

  return {
    email,
    authUserId: profile?.id ?? null,
    profile,
    membership,
    enrollmentActive,
  };
}

function buildLinkPlan(discovery) {
  if (!discovery.authUserId || discovery.profile?.player_id) {
    return null;
  }
  const proposedPlayerId = buildPlayerIdForAuthUser(discovery.authUserId);
  return {
    auth_user_id: discovery.authUserId,
    email: discovery.email,
    current_player_id: discovery.profile?.player_id ?? null,
    proposed_player_id: proposedPlayerId,
    action: "UPDATE profiles.player_id (idempotent — only if null)",
    club_blob_note:
      "club_data_v3 empty for pilot club — may require club roster sync via app/RPC in separate owner step",
    duplicate_guard: `skip if another profile already has player_id='${proposedPlayerId}'`,
  };
}

async function applyLinkPlan(admin, plan, dryRun) {
  if (!plan || dryRun) return { applied: false, reason: dryRun ? "dry-run" : "no-plan" };

  const { data: dup } = await admin
    .from("profiles")
    .select("id, email")
    .eq("player_id", plan.proposed_player_id)
    .neq("id", plan.auth_user_id)
    .maybeSingle();
  if (dup?.id) {
    return { applied: false, reason: `duplicate_player_id:${dup.email}` };
  }

  const { data, error } = await admin
    .from("profiles")
    .update({ player_id: plan.proposed_player_id, updated_at: new Date().toISOString() })
    .eq("id", plan.auth_user_id)
    .is("player_id", null)
    .select("id, email, player_id")
    .maybeSingle();

  if (error) return { applied: false, reason: error.message };
  return { applied: Boolean(data?.player_id), data };
}

async function main() {
  const dryRun = !process.argv.includes("--apply") || process.argv.includes("--dry-run");
  const applyRequested = process.argv.includes("--apply");
  const ownerGo = String(process.env.PRODUCTION_P1C_PLAYER_LINK_GO || "").trim() === "YES";

  if (applyRequested && !ownerGo) {
    console.error("BLOCKED — --apply requires PRODUCTION_P1C_PLAYER_LINK_GO=YES (separate owner GO)");
    process.exit(2);
  }

  const csvPath = path.join(rootDir, CANDIDATE_INPUT_CSV);
  if (!fs.existsSync(csvPath)) {
    console.error(`Missing ${CANDIDATE_INPUT_CSV}`);
    process.exit(2);
  }

  const slots = parseCandidateCsv(fs.readFileSync(csvPath, "utf8"));
  if (slots.length === 0 || slots.length > 5) {
    console.error(`Candidate count must be 1–5, got ${slots.length}`);
    process.exit(2);
  }

  const admin = await getProductionAdmin();
  fs.mkdirSync(evidenceDir, { recursive: true });

  const { data: rollout } = await admin
    .from("rating_v5_rollout_config")
    .select("allow_v5_assessment")
    .eq("id", "default")
    .maybeSingle();
  const { count: activeEnrollments } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const { count: v2Rows } = await admin
    .from("pick_vn_player_ratings")
    .select("id", { count: "exact", head: true });

  const rows = [];
  const linkPlans = [];

  for (const slot of slots) {
    const discovery = await discoverCandidate(admin, slot);
    const result = classifyCandidate(slot, discovery);
    const linkPlan = result === "NEEDS_PLAYER_LINK" ? buildLinkPlan(discovery) : null;
    if (linkPlan) linkPlans.push(linkPlan);

    let applyResult = null;
    if (applyRequested && linkPlan) {
      applyResult = await applyLinkPlan(admin, linkPlan, dryRun);
    }

    rows.push({
      slot: slot.slot,
      email: slot.email || "",
      display_name: slot.display_name || discovery.profile?.display_name || "",
      expected_skill_band: slot.expected_skill_band || "",
      auth: discovery.authUserId ? "yes" : "no",
      profile: discovery.profile ? "yes" : "no",
      player_id: discovery.profile?.player_id || "",
      club_membership: discovery.membership?.status || "none",
      skill_band: slot.expected_skill_band || "missing",
      result,
      link_plan: linkPlan,
      apply_result: applyResult,
    });
  }

  const emails = rows.map((r) => r.email.toLowerCase()).filter(Boolean);
  const duplicateCount = emails.length - new Set(emails).size;
  const readyCount = rows.filter((r) => r.result === "READY").length;

  const report = {
    run_id: runId,
    mode: dryRun ? "dry-run" : "apply",
    production_ref: PRODUCTION_REF,
    production_changed: applyRequested && ownerGo && !dryRun,
    allow_v5_assessment: rollout?.allow_v5_assessment ?? null,
    active_enrollments: activeEnrollments ?? 0,
    v2_rows: v2Rows ?? 0,
    candidate_count: rows.length,
    ready_count: readyCount,
    duplicate_email_count: duplicateCount,
    rows,
    link_plans: linkPlans,
  };

  fs.writeFileSync(path.join(evidenceDir, "DISCOVERY_REPORT.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/LATEST_DISCOVERY_REPORT.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(`Mode: ${report.mode}`);
  console.log(`Candidates: ${rows.length}, READY: ${readyCount}, duplicates: ${duplicateCount}`);
  for (const row of rows) {
    console.log(`${row.slot} ${row.email || "(empty)"} => ${row.result}`);
  }
  console.log(`Evidence: ${evidenceDir}`);
}

main().catch((err) => {
  console.error(`FAIL — ${err.message}`);
  process.exit(1);
});
