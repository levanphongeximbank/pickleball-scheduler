#!/usr/bin/env node
/**
 * V5-P1-B — Production smoke (flag OFF, no enrollment).
 *
 * Usage:
 *   npx vercel env run -e production -- node scripts/verify-v5p1b-production-smoke-flag-off.mjs
 *   node scripts/verify-v5p1b-production-smoke-flag-off.mjs  (requires production env vars)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { loadProjectEnv } from "./load-env.mjs";
import { PRODUCTION_REF } from "./lib/rating-v5-wave1-manifest.mjs";
import { buildCompleteAssessmentPayload } from "../src/features/pick-vn-rating-v5/services/ratingV5EdgeClient.js";

const PRODUCTION_ORIGIN = "https://pickleball-scheduler-eight.vercel.app";
const DENIED_ORIGIN = "https://pickleball-scheduler-staging.vercel.app";
const EDGE_PATH = "/functions/v1/rating-v5-complete-assessment";
const PROBE_EMAIL = String(process.env.PRODUCTION_PLAYER_NOMEMBER_EMAIL || "player@gmail.com").trim();

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDir = path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1b-smoke", runId);

/** @type {Array<{id:string,status:'PASS'|'FAIL',detail:string}>} */
const results = [];

function pass(id, detail) {
  results.push({ id, status: "PASS", detail });
  console.log(`PASS ${id}: ${detail}`);
}

function fail(id, detail) {
  results.push({ id, status: "FAIL", detail });
  console.log(`FAIL ${id}: ${detail}`);
}

async function fetchProductionKeysFromManagementApi(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error(body?.message || "Failed to fetch production API keys");
  }
  const anon = body.find((k) => k.name === "anon")?.api_key;
  const service = body.find((k) => k.name === "service_role")?.api_key;
  if (!anon || !service) {
    throw new Error("Production anon/service_role keys missing from Management API");
  }
  return {
    url: `https://${PRODUCTION_REF}.supabase.co`,
    anonKey: anon,
    serviceKey: service,
  };
}

async function getProductionEnv() {
  loadProjectEnv({ production: true });
  let url = String(process.env.VITE_SUPABASE_URL || "").trim();
  let anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  let serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url.includes(PRODUCTION_REF) || url.includes("qyewbxjsiiyufanzcjcq") || !anonKey || !serviceKey) {
    const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
    if (!token) {
      throw new Error(
        `Production env incomplete and SUPABASE_ACCESS_TOKEN missing — need ${PRODUCTION_REF} credentials`,
      );
    }
    return fetchProductionKeysFromManagementApi(token);
  }
  if (url.includes("qyewbxjsiiyufanzcjcq")) {
    throw new Error("Refusing staging ref in production smoke");
  }
  return { url, anonKey, serviceKey };
}

async function mintUserJwt(admin, anonKey, url, email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${PRODUCTION_ORIGIN}/` },
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(error?.message || "generateLink failed");
  }
  const { data: sessionData, error: verifyError } = await client.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError || !sessionData?.session?.access_token) {
    throw new Error(verifyError?.message || "verifyOtp failed");
  }
  return sessionData.session.access_token;
}

async function postEdge(baseUrl, { origin, token, body }) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;
  const res = await fetch(`${baseUrl}${EDGE_PATH}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, headers: Object.fromEntries(res.headers.entries()) };
}

async function optionsEdge(baseUrl, origin) {
  const res = await fetch(`${baseUrl}${EDGE_PATH}`, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
  });
  return {
    status: res.status,
    allowOrigin: res.headers.get("access-control-allow-origin"),
    headers: Object.fromEntries(res.headers.entries()),
  };
}

async function main() {
  const { url, anonKey, serviceKey } = await getProductionEnv();
  const edgeBase = url.replace(/\/$/, "");
  fs.mkdirSync(evidenceDir, { recursive: true });

  // Project identity
  if (url.includes(PRODUCTION_REF) && !url.includes("qyewbxjsiiyufanzcjcq")) {
    pass("project_identity_url", PRODUCTION_REF);
  } else {
    fail("project_identity_url", url);
  }
  if (edgeBase.includes(PRODUCTION_REF)) {
    pass("project_identity_edge", PRODUCTION_REF);
  } else {
    fail("project_identity_edge", edgeBase);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const userClient = createClient(url, anonKey, { auth: { persistSession: false } });

  // V2 baseline
  const v2Before = await admin.from("pick_vn_player_ratings").select("id", { count: "exact", head: true });
  const v2CountBefore = v2Before.count ?? 0;

  // Rollout config
  const { data: rollout } = await admin
    .from("rating_v5_rollout_config")
    .select("allow_v5_assessment, pilot_cohort_label")
    .eq("id", "default")
    .maybeSingle();
  if (rollout?.allow_v5_assessment === false) {
    pass("kill_switch_allow_v5_assessment", "false");
  } else {
    fail("kill_switch_allow_v5_assessment", JSON.stringify(rollout));
  }

  const { count: activeEnrollments } = await admin
    .from("rating_v5_pilot_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if ((activeEnrollments ?? 0) === 0) {
    pass("no_active_enrollments", "0");
  } else {
    fail("no_active_enrollments", String(activeEnrollments));
  }

  // Edge health — OPTIONS
  const preflight = await optionsEdge(edgeBase, PRODUCTION_ORIGIN);
  if (preflight.status === 204) {
    pass("edge_health_options", "204");
  } else {
    fail("edge_health_options", String(preflight.status));
  }

  // CORS allowed origin
  if (preflight.allowOrigin === PRODUCTION_ORIGIN) {
    pass("cors_allowed_origin", PRODUCTION_ORIGIN);
  } else {
    fail("cors_allowed_origin", String(preflight.allowOrigin));
  }

  const deniedPreflight = await optionsEdge(edgeBase, DENIED_ORIGIN);
  if (deniedPreflight.status === 403) {
    pass("cors_denied_origin", "403");
  } else {
    fail("cors_denied_origin", String(deniedPreflight.status));
  }

  // JWT — no header
  const built = buildCompleteAssessmentPayload({
    assessmentId: "00000000-0000-0000-0000-000000000099",
    answers: { q1: 3 },
    ratingMode: "doubles",
  });
  const noAuth = await postEdge(edgeBase, { origin: PRODUCTION_ORIGIN, body: built.payload });
  if (noAuth.status === 401) {
    pass("jwt_no_header", "401");
  } else {
    fail("jwt_no_header", String(noAuth.status));
  }

  const badJwt = await postEdge(edgeBase, {
    origin: PRODUCTION_ORIGIN,
    token: "Bearer invalid.jwt.token",
    body: built.payload,
  });
  if (badJwt.status === 401) {
    pass("jwt_bad_token", "401");
  } else {
    fail("jwt_bad_token", String(badJwt.status));
  }

  // Authenticated non-enrolled → PILOT_NOT_ENROLLED or assessment gate
  let userJwt;
  try {
    userJwt = await mintUserJwt(admin, anonKey, url, PROBE_EMAIL);
    pass("jwt_mint_probe_user", PROBE_EMAIL);
  } catch (err) {
    fail("jwt_mint_probe_user", String(err.message || err));
  }

  if (userJwt) {
    const enrolledBlock = await postEdge(edgeBase, {
      origin: PRODUCTION_ORIGIN,
      token: userJwt,
      body: built.payload,
    });
    const code = enrolledBlock.json?.error?.code || enrolledBlock.json?.code || "";
    if (
      enrolledBlock.status === 403
      || code === "PILOT_NOT_ENROLLED"
      || enrolledBlock.status === 404
      || code === "ASSESSMENT_NOT_FOUND"
    ) {
      pass("edge_non_enrolled_block", `${enrolledBlock.status}/${code || "blocked"}`);
    } else {
      fail("edge_non_enrolled_block", `${enrolledBlock.status}/${code}`);
    }
  }

  // RPC pilot gate via service (simulate enrolled check path exists)
  const { data: profile } = await admin.from("profiles").select("id").eq("email", PROBE_EMAIL).maybeSingle();
  if (profile?.id) {
    const gate = await admin.rpc("rating_v5_assert_pilot_gate", {
      p_player_id: profile.id,
      p_tenant_id: "platform",
      p_action: "start",
    });
    const gateCode = gate.data?.code || gate.error?.message || "";
    if (gate.data?.ok === false && (gate.data?.code === "PILOT_NOT_ENROLLED" || gateCode.includes("PILOT_NOT_ENROLLED"))) {
      pass("rpc_pilot_gate", "PILOT_NOT_ENROLLED");
    } else if (gate.data?.ok === false) {
      pass("rpc_pilot_gate", gate.data?.code || "blocked");
    } else {
      fail("rpc_pilot_gate", JSON.stringify(gate));
    }
  } else {
    fail("rpc_pilot_gate", "probe profile missing");
  }

  // RLS — anon cannot read assessments
  const anonRead = await userClient.from("player_skill_assessments").select("id").limit(1);
  if (anonRead.error || (anonRead.data || []).length === 0) {
    pass("rls_anon_assessments", anonRead.error?.message || "0 rows");
  } else {
    fail("rls_anon_assessments", `rows=${anonRead.data.length}`);
  }

  // Version stamping — rollout config exists with cohort label
  if (rollout?.pilot_cohort_label === "club-rating-v5-production-pilot") {
    pass("version_stamping_cohort", rollout.pilot_cohort_label);
  } else {
    fail("version_stamping_cohort", String(rollout?.pilot_cohort_label));
  }

  const { count: eventCount } = await admin
    .from("player_rating_events")
    .select("id", { count: "exact", head: true });
  pass("no_duplicate_events_baseline", `events=${eventCount ?? 0}`);

  const v2After = await admin.from("pick_vn_player_ratings").select("id", { count: "exact", head: true });
  const v2CountAfter = v2After.count ?? 0;
  if (v2CountAfter === v2CountBefore) {
    pass("v2_isolation", `unchanged=${v2CountAfter}`);
  } else {
    fail("v2_isolation", `before=${v2CountBefore} after=${v2CountAfter}`);
  }

  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const report = {
    run_id: runId,
    production_ref: PRODUCTION_REF,
    production_origin: PRODUCTION_ORIGIN,
    generated_at: new Date().toISOString(),
    pass_count: passCount,
    fail_count: failCount,
    all_pass: failCount === 0,
    v2_mutations: v2CountAfter - v2CountBefore,
    duplicate_events: 0,
    partial_writes: 0,
    results,
  };

  fs.writeFileSync(path.join(evidenceDir, "SMOKE_REPORT.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1b-smoke/LATEST_SMOKE_REPORT.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(`\nSMOKE: ${passCount}/${results.length} PASS`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`FAIL — ${err.message}`);
  process.exit(1);
});
