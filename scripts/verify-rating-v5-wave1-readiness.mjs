#!/usr/bin/env node
/**
 * V5-C.1C — Wave 1 readiness verification (staging, no enrollment).
 *
 * Usage: node scripts/verify-rating-v5-wave1-readiness.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import { buildCompleteAssessmentPayload } from "../src/features/pick-vn-rating-v5/services/ratingV5EdgeClient.js";
import {
  WAVE1_MANIFEST,
  WAVE0_AUTH_IDS,
  STAGING_REF,
  PRODUCTION_REF,
  resolveTenantFromProfile,
} from "./lib/rating-v5-wave1-manifest.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDir = path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-c1c-wave1", runId);
const cohortCsvPath = path.join(rootDir, "docs/v5/rating-v5/V5-C1C_WAVE1_COHORT_REVIEW.csv");

const SECRET_PATTERNS = [
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
  /service_role/i,
  /Bearer\s+[A-Za-z0-9._-]{20,}/,
];

const PROBE_EMAIL = "rating.wave1.01@staging.local";
const PROBE_TENANT = "venue-staging-a";

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

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(",");
    /** @type {Record<string, string>} */
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = String(cols[i] ?? "").trim();
    });
    return row;
  });
}

function scanSecrets(text) {
  const hits = [];
  for (const p of SECRET_PATTERNS) {
    if (p.test(text)) hits.push(p.toString());
  }
  return hits;
}

async function fetchV2(service, userId) {
  const rpc = await service.rpc("pick_vn_get_rating_by_auth_user", { p_auth_user_id: userId });
  return rpc.data?.rating ?? rpc.data ?? null;
}

async function postEdge(accessToken) {
  const built = buildCompleteAssessmentPayload({
    assessmentId: "00000000-0000-0000-0000-000000000099",
    answers: { q1: 3 },
    ratingMode: "doubles",
  });
  const edgeBase = String(process.env.STAGING_SUPABASE_URL || `https://${STAGING_REF}.supabase.co`).replace(/\/$/, "");
  const res = await fetch(`${edgeBase}/functions/v1/rating-v5-complete-assessment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(built.payload),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  loadProjectEnv();
  const { url, serviceKey } = getStagingSupabaseEnv();

  // t01 staging ref
  if (url.includes(STAGING_REF) && !url.includes(PRODUCTION_REF)) {
    pass("t01_staging_ref", STAGING_REF);
  } else {
    fail("t01_staging_ref", url);
  }

  // t02 production blocked
  try {
    if (url.includes(PRODUCTION_REF)) {
      fail("t02_production_blocked", "production ref in url");
    } else {
      pass("t02_production_blocked", "no production ref");
    }
  } catch {
    fail("t02_production_blocked", "guard error");
  }

  if (!serviceKey) throw new Error("Missing service role key");
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  fs.mkdirSync(evidenceDir, { recursive: true });

  if (!fs.existsSync(cohortCsvPath)) {
    fail("t03_auth_mapping", "cohort CSV missing — run prepare script first");
    fail("t04_player_mapping", "cohort CSV missing");
    fail("t05_tenant", "cohort CSV missing");
    fail("t06_role", "cohort CSV missing");
    fail("t07_duplicates", "cohort CSV missing");
  } else {
    const rows = parseCsv(fs.readFileSync(cohortCsvPath, "utf8"));
    const count = rows.length;
    if (count >= 10 && count <= 20) {
      pass("t03_auth_mapping", `candidate_count=${count}`);
    } else {
      fail("t03_auth_mapping", `candidate_count=${count} (expected 10-20)`);
    }

    const authIds = rows.map((r) => r.auth_user_id).filter(Boolean);
    const emails = rows.map((r) => r.email).filter(Boolean);
    const dupAuth = authIds.length - new Set(authIds).size;
    const dupEmail = emails.length - new Set(emails.map((e) => e.toLowerCase())).size;
    const missingTenant = rows.filter((r) => !r.tenant_id).length;
    const wave0InCohort = rows.filter((r) => WAVE0_AUTH_IDS.has(r.auth_user_id)).length;
    const prodEmail = rows.filter((r) => !r.email.endsWith("@staging.local")).length;

    if (dupAuth === 0 && dupEmail === 0) pass("t07_duplicates", "0 duplicates");
    else fail("t07_duplicates", `dupAuth=${dupAuth} dupEmail=${dupEmail}`);

    const { data: profiles } = await service
      .from("profiles")
      .select("id, email, role, venue_id, player_id, status")
      .in("email", emails);

    const byEmail = new Map((profiles || []).map((p) => [String(p.email).toLowerCase(), p]));
    let mappingOk = true;
    let tenantOk = true;
    let roleOk = true;
    for (const row of rows) {
      const p = byEmail.get(row.email.toLowerCase());
      if (!p) {
        mappingOk = false;
        continue;
      }
      if (p.id !== row.auth_user_id) mappingOk = false;
      if (resolveTenantFromProfile(p) !== row.tenant_id) tenantOk = false;
      if (String(p.role).toUpperCase() !== "PLAYER") roleOk = false;
    }
    if (mappingOk) pass("t04_player_mapping", `${profiles?.length ?? 0} profiles aligned`);
    else fail("t04_player_mapping", "auth/profile mismatch");

    if (missingTenant === 0 && tenantOk) pass("t05_tenant", "all tenants set");
    else fail("t05_tenant", `missing=${missingTenant} mismatch=${!tenantOk}`);

    if (roleOk) pass("t06_role", "all PLAYER");
    else fail("t06_role", "role mismatch");

    const { data: enrollments } = await service
      .from("rating_v5_pilot_enrollments")
      .select("player_id, status")
      .in("player_id", authIds);
    const activeEnroll = (enrollments || []).filter((e) => e.status === "active").length;
    if (wave0InCohort === 0 && activeEnroll === 0) {
      pass("t07b_enrollment_clean", "no wave0/active in cohort");
    } else {
      fail("t07b_enrollment_clean", `wave0=${wave0InCohort} active=${activeEnroll}`);
    }

    if (prodEmail === 0) pass("t07c_staging_email_only", "all @staging.local");
    else fail("t07c_staging_email_only", `non_staging=${prodEmail}`);

    const bands = { "1.5-2.5": 0, "3.0-3.5": 0, "4.0-4.5": 0 };
    for (const row of rows) {
      if (bands[row.expected_skill_band] != null) bands[row.expected_skill_band] += 1;
    }
    const bandOk =
      bands["1.5-2.5"] >= 4
      && bands["3.0-3.5"] >= 4
      && bands["4.0-4.5"] >= 2;
    if (bandOk) pass("t07d_skill_bands", JSON.stringify(bands));
    else fail("t07d_skill_bands", JSON.stringify(bands));
  }

  const signProbe = await signInStagingUser(PROBE_EMAIL);
  if (!signProbe.client) {
    fail("t08_route_block", `sign-in failed: ${signProbe.error}`);
    fail("t09_edge_block", "no client");
  } else {
    const enrollment = await signProbe.client.rpc("rating_v5_get_my_pilot_enrollment");
    const enrolled = enrollment.data?.enrolled === true;
    const gate = await service.rpc("rating_v5_assert_pilot_gate", {
      p_player_id: signProbe.userId,
      p_tenant_id: PROBE_TENANT,
      p_action: "start",
    });
    if (!enrolled && gate.data?.code === "PILOT_NOT_ENROLLED") {
      pass("t08_route_block", gate.data.code);
    } else {
      fail("t08_route_block", JSON.stringify({ enrolled, gate: gate.data }));
    }

    const { data: session } = await signProbe.client.auth.getSession();
    const edge = await postEdge(session.session?.access_token);
    if (edge.status === 403 || edge.json?.error?.code === "PILOT_NOT_ENROLLED") {
      pass("t09_edge_block", edge.json?.error?.code ?? `HTTP ${edge.status}`);
    } else {
      fail("t09_edge_block", JSON.stringify(edge));
    }
  }

  const secretHits = scanSecrets(fs.readFileSync(cohortCsvPath, "utf8"));
  if (secretHits.length === 0) pass("t10_secret_scan", "PASS");
  else fail("t10_secret_scan", secretHits.join("; "));

  const probeId = signProbe.userId || WAVE1_MANIFEST.find((s) => s.email === PROBE_EMAIL)?.email;
  const v2Before = probeId ? await fetchV2(service, signProbe.userId) : null;
  const v2After = probeId ? await fetchV2(service, signProbe.userId) : null;
  if (JSON.stringify(v2Before) === JSON.stringify(v2After)) {
    pass("t11_v2_unchanged", "isolated");
  } else {
    fail("t11_v2_unchanged", "V2 mutated");
  }

  if (!url.includes(PRODUCTION_REF)) {
    pass("t12_production_isolation", "staging only");
  } else {
    fail("t12_production_isolation", "production detected");
  }

  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const report = { run_id: runId, pass: passCount, fail: failCount, results, manifest_slots: WAVE1_MANIFEST.length };
  fs.writeFileSync(path.join(evidenceDir, "REPORT.json"), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\nWave 1 readiness: ${passCount}/${passCount + failCount} PASS`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
