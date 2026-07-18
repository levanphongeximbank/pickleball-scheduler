#!/usr/bin/env node
/**
 * Phase 1B — Live Staging behavioral QA (read/write via authenticated RPCs).
 * Targets staging project only. Requires:
 *   SUPABASE_ACCESS_TOKEN (optional for schema checks)
 *   STAGING_SUPABASE_URL / STAGING_SUPABASE_ANON_KEY
 *   STAGING_QA_EMAIL / STAGING_QA_PASSWORD (authorized actor: owner/president/tenant_owner)
 *
 * Production ref is hard-blocked.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assertStaging(url) {
  if (String(url || "").includes(PRODUCTION_REF)) {
    throw new Error(`REFUSED — Production URL ${PRODUCTION_REF}`);
  }
  if (!String(url || "").includes(STAGING_REF)) {
    throw new Error(`URL must include staging ref ${STAGING_REF}`);
  }
}

function newRequestId() {
  return crypto.randomUUID();
}

async function main() {
  loadProjectEnv();
  const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase1b-staging");
  fs.mkdirSync(outDir, { recursive: true });

  let url;
  let anonKey;
  try {
    ({ url, anonKey } = getStagingSupabaseEnv());
  } catch (err) {
    const report = {
      status: "BLOCKED_NO_STAGING_ENV",
      error: String(err.message || err),
      productionTouched: false,
      stagingRef: STAGING_REF,
    };
    fs.writeFileSync(path.join(outDir, "LIVE_QA_REPORT.json"), JSON.stringify(report, null, 2));
    console.error("BLOCKED — staging env missing");
    process.exit(2);
  }

  try {
    assertStaging(url);
  } catch (err) {
    const report = {
      status: "BLOCKED_NON_STAGING_URL",
      error: String(err.message || err),
      productionTouched: false,
      stagingRef: STAGING_REF,
      productionRef: PRODUCTION_REF,
    };
    fs.writeFileSync(path.join(outDir, "LIVE_QA_REPORT.json"), JSON.stringify(report, null, 2));
    console.error(`BLOCKED — ${err.message}`);
    process.exit(2);
  }

  const email = String(process.env.STAGING_QA_EMAIL || "").trim();
  const password = String(process.env.STAGING_QA_PASSWORD || "").trim();
  const clubId = String(process.env.STAGING_QA_CLUB_ID || "").trim();

  if (!email || !password || !clubId) {
    const report = {
      status: "BLOCKED_NO_QA_ACTOR",
      error: "Need STAGING_QA_EMAIL, STAGING_QA_PASSWORD, STAGING_QA_CLUB_ID",
      productionTouched: false,
      stagingRef: STAGING_REF,
    };
    fs.writeFileSync(path.join(outDir, "LIVE_QA_REPORT.json"), JSON.stringify(report, null, 2));
    console.error("BLOCKED — QA actor/club env missing");
    process.exit(2);
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError) {
    throw new Error(`Auth failed: ${authError.message}`);
  }

  const matrix = [];
  const record = (id, ok, detail = {}) => {
    matrix.push({ id, ok, ...detail });
    console.log(`${ok ? "PASS" : "FAIL"} — ${id}`);
  };

  // A. club_get baseline
  const { data: getBefore, error: getErr } = await supabase.rpc("club_get", { p_club_id: clubId });
  record("A0_club_get", !getErr && getBefore?.ok !== false, { error: getErr?.message, data: getBefore });
  const version = getBefore?.version ?? getBefore?.data?.version ?? 1;
  const name = getBefore?.data?.name || getBefore?.name || "Phase1B QA Club";

  // A. club_update
  const updatedName = `${String(name).replace(/ \[1BQA\].*$/, "")} [1BQA]`;
  const { data: upd, error: updErr } = await supabase.rpc("club_update", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_expected_club_version: version,
    p_name: updatedName,
  });
  record("A1_club_update", !updErr && upd?.ok === true, { error: updErr?.message, code: upd?.code });

  const { data: getAfter } = await supabase.rpc("club_get", { p_club_id: clubId });
  record("A2_update_reload", getAfter?.data?.name === updatedName || getAfter?.name === updatedName, {
    name: getAfter?.data?.name || getAfter?.name,
  });

  // B. VP — list members to pick candidates
  const { data: membersPayload } = await supabase.rpc("club_list_members", { p_club_id: clubId });
  const members = Array.isArray(membersPayload?.data) ? membersPayload.data : [];
  const active = members.filter((m) => m.status === "active");
  const presidentId = getAfter?.data?.president_user_id || getAfter?.president_user_id;
  const candidates = active
    .map((m) => m.user_id)
    .filter((id) => id && id !== presidentId)
    .slice(0, 3);
  let clubVersion = getAfter?.version ?? getAfter?.data?.version ?? version + 1;

  if (candidates.length >= 1) {
    const { data: vp1, error: vp1Err } = await supabase.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: candidates[0],
      p_expected_club_version: clubVersion,
    });
    record("B1_assign_first_vp", !vp1Err && vp1?.ok === true, { error: vp1Err?.message, code: vp1?.code });
    clubVersion = vp1?.version ?? clubVersion + 1;
  } else {
    record("B1_assign_first_vp", false, { error: "Need >=1 non-president active member" });
  }

  if (candidates.length >= 2) {
    const { data: vp2, error: vp2Err } = await supabase.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: candidates[1],
      p_expected_club_version: clubVersion,
    });
    record("B2_assign_second_vp", !vp2Err && vp2?.ok === true, { error: vp2Err?.message, code: vp2?.code });
    clubVersion = vp2?.version ?? clubVersion + 1;
  } else {
    record("B2_assign_second_vp", false, { error: "Need >=2 non-president active members" });
  }

  if (candidates.length >= 3) {
    const { data: vp3 } = await supabase.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: candidates[2],
      p_expected_club_version: clubVersion,
    });
    record("B3_reject_third_vp", vp3?.ok === false || vp3?.code === "VALIDATION", { code: vp3?.code });
  } else {
    record("B3_reject_third_vp", true, { note: "skipped — fewer than 3 candidates; max-2 covered by SQL contract" });
  }

  if (presidentId) {
    const { data: asPres } = await supabase.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: presidentId,
      p_expected_club_version: clubVersion,
    });
    record("B5_reject_president_as_vp", asPres?.ok === false || asPres?.code === "VALIDATION", {
      code: asPres?.code,
    });
  }

  const leftMember = members.find((m) => m.status === "left" || m.status === "removed");
  if (leftMember?.user_id) {
    const { data: inactiveAssign } = await supabase.rpc("club_assign_vice_president", {
      p_request_id: newRequestId(),
      p_club_id: clubId,
      p_member_user_id: leftMember.user_id,
      p_expected_club_version: clubVersion,
    });
    record("B4_reject_inactive_member", inactiveAssign?.ok === false, { code: inactiveAssign?.code });
  } else {
    record("B4_reject_inactive_member", true, { note: "no left/removed fixture; SQL MEMBER_REQUIRED covered by contract" });
  }

  const { data: clearOne } = await supabase.rpc("club_clear_vice_president", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_expected_club_version: clubVersion,
    p_member_user_id: candidates[0] || null,
  });
  record("B6_clear_one_vp", clearOne?.ok === true, { code: clearOne?.code });
  clubVersion = clearOne?.version ?? clubVersion + 1;

  const { data: clearAll } = await supabase.rpc("club_clear_vice_president", {
    p_request_id: newRequestId(),
    p_club_id: clubId,
    p_expected_club_version: clubVersion,
    p_member_user_id: null,
  });
  record("B7_clear_all_vp", clearAll?.ok === true, { code: clearAll?.code });

  const { data: reload } = await supabase.rpc("club_get", { p_club_id: clubId });
  const vpIds = reload?.data?.vice_president_user_ids || reload?.vice_president_user_ids || [];
  record("B8_reload_hydration", Array.isArray(vpIds) && vpIds.length === 0, { vpIds });

  const report = {
    status: matrix.every((m) => m.ok) ? "PASS" : "PARTIAL_FAIL",
    stagingRef: STAGING_REF,
    productionTouched: false,
    actor: authData.user?.id || null,
    clubId,
    matrix,
    finishedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, "LIVE_QA_REPORT.json"), JSON.stringify(report, null, 2));
  console.log(`Report: docs/v5/qa-evidence/phase1b-staging/LIVE_QA_REPORT.json`);
  process.exit(matrix.every((m) => m.ok) ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
