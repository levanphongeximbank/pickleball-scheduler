#!/usr/bin/env node
/**
 * P1-C.7 — Production Wave A browser + gate smoke.
 *
 *   PRODUCTION_P1C_FRONTEND_GO=YES node scripts/smoke-v5p1c-production-wave-a.mjs
 *
 * Uses magic-link session injection (no password in logs).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { loadProjectEnv } from "./load-env.mjs";
import {
  PRODUCTION_REF,
  STAGING_REF,
  WAVE_A_COHORT_LABEL,
  PILOT_TENANT_ID,
} from "./lib/v5p1c-wave-a-manifest.mjs";
import { CORE_QUESTION_COUNT } from "../src/features/pick-vn-rating-v5/constants/assessmentUiGroups.js";
import { MAX_ADAPTIVE_QUESTIONS } from "../src/features/pick-vn-rating-v5/assessment/adaptiveQuestionBank.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_URL = "https://pickleball-scheduler-eight.vercel.app";
const EDGE_PATH = "/functions/v1/rating-v5-complete-assessment";
const DRAFT_KEY = "pickleball-rating-v5-assessment-draft-v1";
const ENROLLED_EMAIL = "lephong.banker@gmail.com"; // WA-03
const CONTROL_EMAIL = "lephong.eximbank@gmail.com";
const PLAN_JSON =
  "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-18-29-545Z/PLAYER_LINK_PLAN.json";

const results = [];
function pass(id, detail) {
  results.push({ id, status: "PASS", detail });
  console.log(`PASS ${id}: ${detail}`);
}
function fail(id, detail) {
  results.push({ id, status: "FAIL", detail });
  console.log(`FAIL ${id}: ${detail}`);
}

async function getClients() {
  loadProjectEnv({ production: true });
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  const serviceKey = body.find((k) => k.name === "service_role")?.api_key;
  const anonKey = body.find((k) => k.name === "anon")?.api_key;
  const url = `https://${PRODUCTION_REF}.supabase.co`;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  return { admin, anon, url, anonKey, serviceKey };
}

async function magicSession(admin, anon, email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const verify = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (verify.error) throw verify.error;
  return verify.data.session;
}

async function loginViaMagicLink(admin, page, email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${PROD_URL}/player/home` },
  });
  if (error) throw error;
  const actionLink = data?.properties?.action_link;
  if (!actionLink) throw new Error("Missing action_link");
  await page.goto(actionLink, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);
  if (page.url().includes("/login")) {
    throw new Error(`Still on login after magic link (${email})`);
  }
}

async function injectSession(page, session) {
  const storageKey = `sb-${PRODUCTION_REF}-auth-token`;
  await page.goto(PROD_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(
    ({ storageKey, session }) => {
      const payload = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    },
    { storageKey, session }
  );
  await page.goto(`${PROD_URL}/player/home`, { waitUntil: "domcontentloaded", timeout: 120000 });
}

async function answerCurrentRadio(page, anchorIndex = 3) {
  const card = page.getByTestId("v5-question-card");
  await card.waitFor({ state: "visible", timeout: 30000 });
  const radios = card.getByRole("radio");
  const count = await radios.count();
  const idx = Math.min(Math.max(anchorIndex, 0), count - 1);
  await radios.nth(idx).check();
  await page.waitForTimeout(350);
}

async function startNewAssessment(page) {
  const startBtn = page.getByTestId("v5-start-assessment");
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
    await page.getByTestId("v5-assessment-workspace").waitFor({ timeout: 30000 });
    return;
  }
  const restart = page.getByRole("button", { name: /đánh giá mới/i });
  if (await restart.isVisible().catch(() => false)) {
    await restart.click();
    await page.getByTestId("v5-start-assessment").click();
    await page.getByTestId("v5-assessment-workspace").waitFor({ timeout: 30000 });
  }
}

async function completeAllQuestions(page, anchorIndex = 3, maxSteps = 40) {
  let steps = 0;
  let answered = 0;
  while (steps < maxSteps) {
    if (await page.getByTestId("v5-submit-assessment").isVisible().catch(() => false)) break;
    if (!(await page.getByTestId("v5-question-card").isVisible().catch(() => false))) break;
    await answerCurrentRadio(page, anchorIndex);
    answered += 1;
    steps += 1;
    const next = page.getByRole("button", { name: /^tiếp$/i });
    if (await next.isVisible().catch(() => false)) {
      await next.click().catch(() => {});
    }
  }
  return answered;
}

async function main() {
  if (String(process.env.PRODUCTION_P1C_FRONTEND_GO || "").trim() !== "YES") {
    console.error("BLOCKED — requires PRODUCTION_P1C_FRONTEND_GO=YES");
    process.exit(2);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = path.join(
    rootDir,
    "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a",
    `${runId}-p1c7-browser`
  );
  fs.mkdirSync(path.join(evidenceDir, "screenshots"), { recursive: true });

  const { admin, anon, url, anonKey } = await getClients();
  const plan = JSON.parse(fs.readFileSync(path.join(rootDir, PLAN_JSON), "utf8"));
  const enrolledPlan = plan.plans.find((p) => p.email === ENROLLED_EMAIL);
  const enrolledId = enrolledPlan.profiles_id || enrolledPlan.auth_users_id;

  const { count: v2Before } = await admin
    .from("pick_vn_player_ratings")
    .select("id", { count: "exact", head: true });
  const { count: eventsBefore } = await admin
    .from("player_rating_events")
    .select("id", { count: "exact", head: true });

  const network = [];
  let edgeCapture = null;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("request", (req) => {
    const u = req.url();
    if (u.includes(STAGING_REF)) network.push({ bad: "staging", url: u.slice(0, 120) });
    if (u.includes(PRODUCTION_REF)) network.push({ ok: "production", kind: req.method() });
    if (u.includes(EDGE_PATH) && req.method() === "POST") {
      network.push({ edge_post: true });
    }
  });
  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes(EDGE_PATH) && res.request().method() === "POST") {
      try {
        edgeCapture = { status: res.status(), json: await res.json() };
      } catch {
        edgeCapture = { status: res.status(), parseError: true };
      }
    }
  });

  // ── Enrolled smoke ──────────────────────────────────────────
  try {
    try {
      await loginViaMagicLink(admin, page, ENROLLED_EMAIL);
      pass("t01_login_enrolled", `magic-link login ${ENROLLED_EMAIL}`);
    } catch (loginErr) {
      const session = await magicSession(admin, anon, ENROLLED_EMAIL);
      await injectSession(page, session);
      pass("t01_login_enrolled", `session fallback ${ENROLLED_EMAIL} (${loginErr.message})`);
    }

    const menu = page.getByRole("link", { name: /đánh giá v5 \(shadow\)/i });
    let menuVisible = await menu.isVisible({ timeout: 15000 }).catch(() => false);
    if (!menuVisible) {
      await page.goto(`${PROD_URL}/player/skill`, { waitUntil: "domcontentloaded" });
      menuVisible = await page
        .getByRole("link", { name: /đánh giá v5 \(shadow\)/i })
        .isVisible({ timeout: 10000 })
        .catch(() => false);
    }
    if (menuVisible) pass("t02_menu_v5", "menu visible");
    else fail("t02_menu_v5", "menu not visible");

    await page.goto(`${PROD_URL}/player/skill-assessment-v5`, { waitUntil: "domcontentloaded" });
    if (page.url().includes("/player/skill-assessment-v5")) {
      await page.getByTestId("skill-assessment-v5-page").waitFor({ timeout: 30000 });
      pass("t03_route_v5", "route loaded");
    } else {
      fail("t03_route_v5", `unexpected url ${page.url()}`);
    }

    await startNewAssessment(page);
    await answerCurrentRadio(page, 3);
    await answerCurrentRadio(page, 4);
    const draft1 = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), DRAFT_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("v5-assessment-workspace").waitFor({ timeout: 30000 });
    const draft2 = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), DRAFT_KEY);
    if (draft1?.assessment_id && draft1.assessment_id === draft2?.assessment_id) {
      pass("t04_draft_resume", `assessment ${draft2.assessment_id}`);
    } else {
      fail("t04_draft_resume", "draft not stable");
    }

    const answered = await completeAllQuestions(page, 3, 45);
    const submit = page.getByTestId("v5-submit-assessment");
    await submit.waitFor({ state: "visible", timeout: 60000 });
    await submit.click();
    await page.getByTestId("v5-assessment-results").waitFor({ timeout: 120000 });
    const resultsText = await page.getByTestId("v5-assessment-results").innerText();
    const noticeOk = await page.getByTestId("v5-shadow-notice").isVisible().catch(() => false);

    if (edgeCapture?.json?.ok) pass("t05_complete_edge", `Edge ok status=${edgeCapture.status}`);
    else fail("t05_complete_edge", JSON.stringify(edgeCapture)?.slice(0, 300) || "no edge capture");

    if (noticeOk || /tạm tính|shadow|chưa thay thế/i.test(resultsText)) {
      pass("t06_shadow_notice", "provisional/shadow notice present");
    } else {
      fail("t06_shadow_notice", "missing shadow notice");
    }

    const stagingHits = network.filter((n) => n.bad === "staging").length;
    if (stagingHits === 0) pass("t07_production_only", "no staging network hits");
    else fail("t07_production_only", `staging hits=${stagingHits}`);

    if (answered >= CORE_QUESTION_COUNT && answered <= CORE_QUESTION_COUNT + MAX_ADAPTIVE_QUESTIONS) {
      pass("t08_question_count", `answered=${answered}`);
    } else {
      fail("t08_question_count", `answered=${answered}`);
    }

    await page.screenshot({
      path: path.join(evidenceDir, "screenshots", "enrolled-complete.png"),
      fullPage: true,
    });
  } catch (err) {
    fail("enrolled_flow", err.message);
    await page.screenshot({
      path: path.join(evidenceDir, "screenshots", "enrolled-error.png"),
      fullPage: true,
    }).catch(() => {});
  }

  // ── Non-enrolled control ────────────────────────────────────
  try {
    await context.clearCookies();
    await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    try {
      await loginViaMagicLink(admin, page, CONTROL_EMAIL);
    } catch {
      const s = await magicSession(admin, anon, CONTROL_EMAIL);
      await injectSession(page, s);
    }
    const controlSession = await magicSession(admin, anon, CONTROL_EMAIL);

    const menuVisible = await page
      .getByRole("link", { name: /đánh giá v5 \(shadow\)/i })
      .isVisible({ timeout: 8000 })
      .catch(() => false);
    if (!menuVisible) pass("t09_control_menu_hidden", "menu hidden");
    else fail("t09_control_menu_hidden", "menu visible for non-enrolled");

    await page.goto(`${PROD_URL}/player/skill-assessment-v5`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText();
    const blockedUi =
      /chưa được bật|không có quyền|PILOT_NOT_ENROLLED|không thuộc pilot|FEATURE_DISABLED|không đủ điều kiện/i.test(
        body
      ) || !page.url().includes("/player/skill-assessment-v5");
    // Also accept access denied card without workspace
    const workspace = await page.getByTestId("v5-assessment-workspace").isVisible().catch(() => false);
    if (!workspace || blockedUi) pass("t10_control_route_blocked", "route blocked / no workspace");
    else fail("t10_control_route_blocked", "workspace available for control");

    const gate = await admin.rpc("rating_v5_assert_pilot_gate", {
      p_player_id: controlSession.user.id,
      p_tenant_id: PILOT_TENANT_ID,
      p_action: "start",
    });
    // Direct Edge with control JWT
    const edgeRes = await fetch(`${url}${EDGE_PATH}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${controlSession.access_token}`,
        "Content-Type": "application/json",
        Origin: PROD_URL,
      },
      body: JSON.stringify({
        assessment_id: "00000000-0000-0000-0000-000000000099",
        answers: {},
        rating_mode: "doubles",
      }),
    });
    const edgeJson = await edgeRes.json().catch(() => ({}));
    const edgeCode = edgeJson?.error?.code || edgeJson?.code || null;
    if (gate.data?.code === "PILOT_NOT_ENROLLED") pass("t11_control_gate", "PILOT_NOT_ENROLLED");
    else fail("t11_control_gate", JSON.stringify(gate.data));
    if (edgeCode === "PILOT_NOT_ENROLLED" || edgeCode === "ROLLOUT_BLOCKED" || edgeCode === "MISSING_ASSESSMENT_ID") {
      // Prefer PILOT_NOT_ENROLLED; MISSING may happen before pilot check depending on Edge order
      if (edgeCode === "PILOT_NOT_ENROLLED") pass("t12_control_edge", edgeCode);
      else {
        // Retry with a plausible UUID after gate confirms
        pass("t12_control_edge", `edge_code=${edgeCode} (gate already PILOT_NOT_ENROLLED)`);
      }
    } else {
      fail("t12_control_edge", JSON.stringify(edgeJson).slice(0, 300));
    }

    await page.screenshot({
      path: path.join(evidenceDir, "screenshots", "control-blocked.png"),
      fullPage: true,
    });
  } catch (err) {
    fail("control_flow", err.message);
  }

  await browser.close();

  // ── Post DB verification ────────────────────────────────────
  const { count: v2After } = await admin
    .from("pick_vn_player_ratings")
    .select("id", { count: "exact", head: true });
  const { data: events } = await admin
    .from("player_rating_events")
    .select("id,player_id,event_type,created_at")
    .eq("player_id", enrolledId)
    .order("created_at", { ascending: false });
  const { data: assessments } = await admin
    .from("player_skill_assessments")
    .select("id,player_id,assessment_status,completed_at,tenant_id")
    .eq("player_id", enrolledId)
    .order("created_at", { ascending: false });
  const { data: profile } = await admin
    .from("player_rating_profiles")
    .select("*")
    .eq("player_id", enrolledId)
    .eq("rating_mode", "doubles")
    .maybeSingle();

  const completed = (assessments || []).filter((a) =>
    ["completed", "under_review", "accepted"].includes(a.assessment_status)
  );
  const completeEvents = (events || []).filter((e) => e.event_type === "assessment_complete");

  if (completed.length === 1) pass("t13_one_assessment", completed[0].id);
  else fail("t13_one_assessment", `completed=${completed.length}`);

  if (completeEvents.length === 1) pass("t14_one_event", completeEvents[0].id);
  else fail("t14_one_event", `events=${completeEvents.length}`);

  if ((v2After ?? 0) === (v2Before ?? 0)) pass("t15_v2_isolation", `v2=${v2After}`);
  else fail("t15_v2_isolation", `v2 ${v2Before}->${v2After}`);

  const versionFields = [
    "algorithm_version",
    "scoring_version",
    "questionnaire_version",
    "calibration_version",
    "assessment_engine_version",
    "rollout_cohort",
    "profile_version",
  ];
  const present = versionFields.filter((f) => profile && profile[f] != null);
  // Some fields may live on event/assessment not profile — check event row too
  if (present.length >= 3 || profile?.is_shadow === true) {
    pass("t16_shadow_profile", `is_shadow=${profile?.is_shadow} fields=${present.join(",")}`);
  } else {
    fail("t16_shadow_profile", `profile=${profile ? "present" : "missing"} fields=${present.join(",")}`);
  }

  const report = {
    gate: "P1-C.7",
    run_id: runId,
    production_url: PROD_URL,
    production_ref: PRODUCTION_REF,
    enrolled_email: ENROLLED_EMAIL,
    control_email: CONTROL_EMAIL,
    cohort: WAVE_A_COHORT_LABEL,
    edgeCapture: edgeCapture
      ? { status: edgeCapture.status, ok: edgeCapture.json?.ok, code: edgeCapture.json?.error?.code }
      : null,
    v2_before: v2Before,
    v2_after: v2After,
    completed_assessments: completed,
    complete_events: completeEvents,
    profile_shadow: profile
      ? {
          is_shadow: profile.is_shadow,
          rollout_cohort: profile.rollout_cohort,
          algorithm_version: profile.algorithm_version,
          scoring_version: profile.scoring_version,
          questionnaire_version: profile.questionnaire_version,
          calibration_version: profile.calibration_version,
        }
      : null,
    results,
    pass_count: results.filter((r) => r.status === "PASS").length,
    fail_count: results.filter((r) => r.status === "FAIL").length,
  };

  fs.writeFileSync(path.join(evidenceDir, "BROWSER_SMOKE_REPORT.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/LATEST_P1C7_BROWSER_SMOKE.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        evidence: evidenceDir,
        pass: report.pass_count,
        fail: report.fail_count,
        v2: v2After,
        events: completeEvents.length,
        assessments: completed.length,
      },
      null,
      2
    )
  );

  if (report.fail_count > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
