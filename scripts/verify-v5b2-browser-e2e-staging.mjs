#!/usr/bin/env node
/**
 * V5-B.2 — Browser E2E on Vercel Preview + Supabase Staging (anon/JWT only).
 *
 * Usage:
 *   node scripts/verify-v5b2-browser-e2e-staging.mjs
 *   npm run qa:v5b2:browser
 *
 * Required env (.env.staging-qa.local):
 *   STAGING_PREVIEW_URL=https://<preview-branch>.vercel.app
 *   STAGING_PLAYER_PASSWORD=...
 *   STAGING_NON_COHORT_PASSWORD=... (or STAGING_OWNER_B_PASSWORD)
 *
 * Optional:
 *   STAGING_PLAYER_EMAIL=player@staging.local
 *   STAGING_NON_COHORT_EMAIL=owner-b@staging.local
 *   STAGING_SUPABASE_PROJECT_REF=qyewbxjsiiyufanzcjcq
 *   VERCEL_AUTOMATION_BYPASS_SECRET=...
 *   HEADLESS=true|false
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import { CORE_QUESTION_COUNT } from "../src/features/pick-vn-rating-v5/constants/assessmentUiGroups.js";
import { MAX_ADAPTIVE_QUESTIONS } from "../src/features/pick-vn-rating-v5/assessment/adaptiveQuestionBank.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const EDGE_PATH = "/functions/v1/rating-v5-complete-assessment";
const DRAFT_STORAGE_KEY = "pickleball-rating-v5-assessment-draft-v1";
const ALLOWED_PAYLOAD_KEYS = new Set([
  "assessment_id",
  "answers",
  "rating_mode",
  "assessment_version",
]);
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "user_id",
  "tenant_id",
  "player_id",
  "rating",
  "estimated_rating",
  "verified_rating",
  "domain_scores",
  "reliability_score",
  "evidence_level",
]);
const PLACEHOLDER_PATTERNS = [/\{\{serve\}\}/i, /\{\{third_shot\}\}/i, /\{\{kitchen\}\}/i, /\{\{[a-z0-9_]+\}\}/i];
const SHADOW_NOTICE_SNIPPETS = [
  "Đây là kết quả thử nghiệm Rating V5 ở chế độ shadow",
  "chưa thay thế rating V2 hiện tại",
];

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const artifactsDir = path.join(rootDir, "artifacts", "v5b2-browser-e2e", runId);

/** @type {Array<{id:string,status:'PASS'|'FAIL'|'BLOCKED',detail:string}>} */
const testResults = [];

const metrics = {
  unresolvedPlaceholders: 0,
  duplicateAssessments: 0,
  duplicateEvents: 0,
  v2Mutations: 0,
  productionRequests: 0,
};

let blockedReason = null;
let productionDetected = false;

const TEST_IDS = [
  "t01_login_cohort",
  "t02_menu_v5",
  "t03_route_v5",
  "t04_question_counts",
  "t05_terminology",
  "t06_back_next",
  "t07_draft_resume",
  "t08_payload_allowlist",
  "t09_ui_parity",
  "t10_shadow_notice",
  "t11_rating_cap",
  "t12_idempotency",
  "t13_v2_isolation",
  "t14_non_cohort",
];

function blockAllTests(reason) {
  blockedReason = reason;
  for (const id of TEST_IDS) {
    blocked(id, reason);
  }
}

function record(id, status, detail) {
  testResults.push({ id, status, detail });
  const label = status === "PASS" ? "PASS" : status === "BLOCKED" ? "BLOCKED" : "FAIL";
  console.log(`${label} ${id}: ${detail}`);
}

function pass(id, detail) {
  record(id, "PASS", detail);
}

function fail(id, detail) {
  record(id, "FAIL", detail);
}

function blocked(id, detail) {
  record(id, "BLOCKED", detail);
}

function ensureArtifactsDir() {
  fs.mkdirSync(path.join(artifactsDir, "screenshots"), { recursive: true });
}

async function saveArtifacts(page, context, extra = {}) {
  ensureArtifactsDir();
  try {
    await page.screenshot({
      path: path.join(artifactsDir, "screenshots", "failure.png"),
      fullPage: true,
    });
  } catch {
    /* ignore */
  }
  try {
    await context.tracing.stop({ path: path.join(artifactsDir, "trace.zip") });
  } catch {
    /* ignore */
  }
  fs.writeFileSync(
    path.join(artifactsDir, "test-results.json"),
    JSON.stringify({ runId, testResults, metrics, blockedReason, ...extra }, null, 2),
  );
}

function resolveEnv() {
  loadProjectEnv();
  const previewUrl = String(process.env.STAGING_PREVIEW_URL || "").trim().replace(/\/+$/, "");
  const playerEmail = String(process.env.STAGING_PLAYER_EMAIL || "player@staging.local").trim();
  const nonCohortEmail = String(process.env.STAGING_NON_COHORT_EMAIL || "owner-b@staging.local").trim();
  const projectRef = String(process.env.STAGING_SUPABASE_PROJECT_REF || STAGING_REF).trim();
  const playerPassword = String(
    process.env.STAGING_PLAYER_PASSWORD
      || process.env.STAGING_CAPTAIN_A_PASSWORD
      || "",
  ).trim();
  const nonCohortPassword = String(
    process.env.STAGING_NON_COHORT_PASSWORD
      || process.env.STAGING_OWNER_B_PASSWORD
      || "",
  ).trim();
  const bypass = String(
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      || process.env.VERCEL_PROTECTION_BYPASS
      || "",
  ).trim();
  const headless = String(process.env.HEADLESS ?? "true").toLowerCase() !== "false";

  return {
    previewUrl,
    playerEmail,
    nonCohortEmail,
    projectRef,
    playerPassword,
    nonCohortPassword,
    bypass,
    headless,
  };
}

function assertEnvironment(env) {
  const issues = [];

  if (!env.previewUrl) {
    issues.push("STAGING_PREVIEW_URL missing");
  } else {
    if (!env.previewUrl.startsWith("https://")) {
      issues.push("STAGING_PREVIEW_URL must use https");
    }
    if (env.previewUrl.includes(PRODUCTION_REF)) {
      issues.push("STAGING_PREVIEW_URL contains Production Supabase ref");
    }
    const host = new URL(env.previewUrl).hostname.toLowerCase();
    if (host.includes("expuvcohlcjzvrrauvud")) {
      issues.push("Preview hostname looks like Production");
    }
    if (/pickleball-scheduler\.vercel\.app$/i.test(host) && !host.includes("-git-")) {
      issues.push("Preview URL may be Production Vercel domain (use branch preview URL)");
    }
  }

  if (env.projectRef !== STAGING_REF) {
    issues.push(`STAGING_SUPABASE_PROJECT_REF must be ${STAGING_REF}`);
  }

  if (!env.playerPassword) {
    issues.push("STAGING_PLAYER_PASSWORD missing");
  }
  if (!env.nonCohortPassword) {
    issues.push("STAGING_NON_COHORT_PASSWORD (or STAGING_OWNER_B_PASSWORD) missing");
  }

  const { url: stagingUrl } = getStagingSupabaseEnv();
  if (!stagingUrl.includes(STAGING_REF)) {
    issues.push("Staging Supabase URL ref mismatch in env files");
  }
  if (stagingUrl.includes(PRODUCTION_REF)) {
    issues.push("Production Supabase URL detected in env");
  }

  return issues;
}

async function probePreview(env) {
  const headers = {};
  if (env.bypass) {
    headers["x-vercel-protection-bypass"] = env.bypass;
  }
  const loginUrl = `${env.previewUrl}/login`;
  const res = await fetch(loginUrl, { headers, redirect: "follow" });
  if (!res.ok) {
    return { ok: false, detail: `/login HTTP ${res.status}` };
  }
  const text = await res.text();
  if (text.includes("Authentication Required") && text.includes("Vercel")) {
    return {
      ok: false,
      detail: "Deployment Protection — set VERCEL_AUTOMATION_BYPASS_SECRET",
    };
  }
  return { ok: true, detail: `login HTTP ${res.status}` };
}

function attachNetworkGuards(page, networkLog) {
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes(PRODUCTION_REF)) {
      productionDetected = true;
      metrics.productionRequests += 1;
      networkLog.push({ type: "production_request", url: sanitizeUrl(url), method: req.method() });
    }
    if (url.includes(EDGE_PATH) && req.method() === "POST") {
      networkLog.push({ type: "edge_request", url: sanitizeUrl(url), method: "POST" });
    }
    if (url.includes(`${STAGING_REF}.supabase.co`)) {
      networkLog.push({ type: "staging_supabase", url: sanitizeUrl(url), method: req.method() });
    }
  });
}

function sanitizeUrl(url) {
  return String(url).replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]");
}

async function loginViaForm(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90_000 });
}

async function logoutViaMenu(page, baseUrl) {
  const accountBtn = page.getByRole("button", { name: /menu tài khoản/i });
  if (await accountBtn.isVisible().catch(() => false)) {
    await accountBtn.click();
    await page.getByRole("menuitem", { name: /đăng xuất/i }).click();
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 30_000 });
    return;
  }
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
}

async function readDraft(page) {
  return page.evaluate((key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }, DRAFT_STORAGE_KEY);
}

async function answerCurrentRadio(page, anchorIndex = 3) {
  const card = page.getByTestId("v5-question-card");
  await card.waitFor({ state: "visible", timeout: 30_000 });
  const radios = card.getByRole("radio");
  const count = await radios.count();
  const idx = Math.min(Math.max(anchorIndex, 0), count - 1);
  await radios.nth(idx).check();
  await page.waitForTimeout(400);
}

async function clickBack(page) {
  await page.getByRole("button", { name: /^quay lại$/i }).click();
  await page.waitForTimeout(300);
}

async function startNewAssessment(page) {
  const startBtn = page.getByTestId("v5-start-assessment");
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
    await page.getByTestId("v5-assessment-workspace").waitFor({ timeout: 30_000 });
    return;
  }
  const restart = page.getByRole("button", { name: /đánh giá mới/i });
  if (await restart.isVisible().catch(() => false)) {
    await restart.click();
    await page.getByTestId("v5-start-assessment").click();
    await page.getByTestId("v5-assessment-workspace").waitFor({ timeout: 30_000 });
  }
}

async function completeAllQuestions(page, anchorIndex = 3, maxSteps = 35) {
  let steps = 0;
  let questionsAnswered = 0;
  while (steps < maxSteps) {
    if (await page.getByTestId("v5-submit-assessment").isVisible().catch(() => false)) {
      break;
    }
    if (!(await page.getByTestId("v5-question-card").isVisible().catch(() => false))) {
      break;
    }
    await answerCurrentRadio(page, anchorIndex);
    questionsAnswered += 1;
    steps += 1;
  }
  return questionsAnswered;
}

function scanPlaceholders(pageText) {
  let hits = 0;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(pageText)) {
      hits += 1;
    }
  }
  return hits;
}

async function fetchV2Row(client, userId) {
  const rpc = await client.rpc("pick_vn_get_rating_by_auth_user", { p_auth_user_id: userId });
  if (rpc.error) {
    return { ok: false, error: rpc.error.message, row: null };
  }
  const row = rpc.data?.rating ?? rpc.data?.row ?? rpc.data ?? null;
  return { ok: true, row, count: row ? 1 : 0 };
}

async function fetchAssessmentSnapshot(client, assessmentId) {
  const [assessment, events] = await Promise.all([
    client.from("player_skill_assessments").select("*").eq("id", assessmentId).maybeSingle(),
    client
      .from("player_rating_events")
      .select("id", { count: "exact" })
      .eq("source_id", assessmentId)
      .eq("event_type", "assessment_complete"),
  ]);
  return {
    assessment: assessment.data,
    assessmentError: assessment.error?.message,
    eventCount: events.count ?? events.data?.length ?? 0,
    eventsError: events.error?.message,
  };
}

function validatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, detail: "payload not an object" };
  }
  const keys = Object.keys(body);
  const extra = keys.filter((k) => !ALLOWED_PAYLOAD_KEYS.has(k));
  const forbidden = keys.filter((k) => FORBIDDEN_PAYLOAD_KEYS.has(k));
  if (extra.length) {
    return { ok: false, detail: `extra keys: ${extra.join(", ")}` };
  }
  if (forbidden.length) {
    return { ok: false, detail: `forbidden keys: ${forbidden.join(", ")}` };
  }
  if (keys.length !== 4) {
    return { ok: false, detail: `expected 4 keys, got ${keys.length}` };
  }
  return { ok: true, detail: "4-field allowlist" };
}

function printSummary() {
  const passN = testResults.filter((t) => t.status === "PASS").length;
  const failN = testResults.filter((t) => t.status === "FAIL").length;
  const blockedN = testResults.filter((t) => t.status === "BLOCKED").length;

  console.log("\nBROWSER E2E RESULTS\n");
  console.log(`PASS: ${passN}`);
  console.log(`FAIL: ${failN}`);
  console.log(`BLOCKED: ${blockedN}`);
  console.log(`TOTAL: ${testResults.length}\n`);
  console.log(`UNRESOLVED PLACEHOLDERS: ${metrics.unresolvedPlaceholders}`);
  console.log(`DUPLICATE ASSESSMENTS: ${metrics.duplicateAssessments}`);
  console.log(`DUPLICATE EVENTS: ${metrics.duplicateEvents}`);
  console.log(`V2 MUTATIONS: ${metrics.v2Mutations}`);
  console.log(`PRODUCTION REQUESTS: ${metrics.productionRequests}`);

  if (blockedReason) {
    console.log(`\nBROWSER E2E: BLOCKED — ${blockedReason}`);
  } else if (failN === 0 && blockedN === 0 && passN === 14) {
    console.log("\nBROWSER E2E: 14/14 PASS");
  } else {
    console.log(`\nBROWSER E2E: FAIL (${passN}/14 PASS)`);
  }
}

async function run() {
  const env = resolveEnv();
  const networkLog = [];
  const edgeCaptures = [];
  let browser;
  let context;
  let page;
  let cohortClient = null;
  let cohortUserId = null;
  let v2Before = null;
  let assessmentIdA = null;
  let assessmentIdB = null;

  const envIssues = assertEnvironment(env);
  if (envIssues.length) {
    blockAllTests(envIssues.join("; "));
    printSummary();
    process.exit(2);
  }

  const probe = await probePreview(env);
  if (!probe.ok) {
    blockAllTests(probe.detail);
    printSummary();
    process.exit(2);
  }
  console.log(`PREVIEW_PROBE: ${probe.detail}`);

  const signIn = await signInStagingUser(env.playerEmail);
  if (signIn.error || !signIn.client) {
    blockAllTests(`cohort login failed: ${signIn.error}`);
    printSummary();
    process.exit(2);
  }
  cohortClient = signIn.client;
  cohortUserId = signIn.userId;
  v2Before = await fetchV2Row(cohortClient, cohortUserId);

  const contextOptions = {
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: env.bypass ? { "x-vercel-protection-bypass": env.bypass } : {},
  };

  browser = await chromium.launch({ headless: env.headless });
  context = await browser.newContext(contextOptions);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  page = await context.newPage();
  attachNetworkGuards(page, networkLog);

  page.on("request", (req) => {
    if (!req.url().includes(EDGE_PATH) || req.method() !== "POST") return;
    try {
      const body = req.postDataJSON();
      edgeCaptures.push({ phase: "request", body, url: sanitizeUrl(req.url()) });
    } catch {
      edgeCaptures.push({ phase: "request", body: null, parseError: true });
    }
  });

  page.on("response", async (res) => {
    if (!res.url().includes(EDGE_PATH) || res.request().method() !== "POST") return;
    try {
      const json = await res.json();
      edgeCaptures.push({ phase: "response", status: res.status(), json });
    } catch {
      edgeCaptures.push({ phase: "response", status: res.status(), parseError: true });
    }
  });

  try {
    // T01 — Login cohort
    try {
      await loginViaForm(page, env.previewUrl, env.playerEmail, env.playerPassword);
      if (productionDetected) {
        throw new Error("PRODUCTION TARGET DETECTED");
      }
      pass("t01_login_cohort", `logged in as ${env.playerEmail}`);
    } catch (err) {
      fail("t01_login_cohort", err.message);
      throw err;
    }

    // T02 — Menu V5
    try {
      const menuLink = page.getByRole("link", { name: /đánh giá v5 \(shadow\)/i });
      const visible = await menuLink.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!visible) {
        await page.goto(`${env.previewUrl}/player/skill`, { waitUntil: "domcontentloaded" });
      }
      const menuVisible = await page.getByRole("link", { name: /đánh giá v5 \(shadow\)/i })
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      if (menuVisible) {
        pass("t02_menu_v5", "menu Đánh giá V5 (shadow) visible");
      } else {
        fail("t02_menu_v5", "menu not visible — VITE_PICK_VN_RATING_V5_ENABLED may be off on Preview");
      }
    } catch (err) {
      fail("t02_menu_v5", err.message);
    }

    // T03 — Route
    try {
      await page.goto(`${env.previewUrl}/player/skill-assessment-v5`, { waitUntil: "domcontentloaded" });
      const url = page.url();
      if (!url.includes("/player/skill-assessment-v5")) {
        fail("t03_route_v5", `redirected to ${url}`);
      } else if (url.includes("/player/skill-assessment") && !url.includes("-v5")) {
        fail("t03_route_v5", "redirected to V2 route");
      } else {
        await page.getByTestId("skill-assessment-v5-page").waitFor({ timeout: 20_000 });
        pass("t03_route_v5", "route /player/skill-assessment-v5 loaded");
      }
    } catch (err) {
      fail("t03_route_v5", err.message);
    }

    // T04 — Question counts (full run on assessment A)
    let questionCountA = 0;
    try {
      await startNewAssessment(page);
      questionCountA = await completeAllQuestions(page, 3, 40);
      const bodyText = await page.locator("body").innerText();
      const shows152 = /1\s*\/\s*52/.test(bodyText);
      const coreOk = questionCountA >= CORE_QUESTION_COUNT;
      const totalOk = questionCountA <= CORE_QUESTION_COUNT + MAX_ADAPTIVE_QUESTIONS;
      const adaptiveOk = questionCountA - CORE_QUESTION_COUNT <= MAX_ADAPTIVE_QUESTIONS;
      if (shows152) {
        fail("t04_question_counts", "displays 1/52 style progress");
      } else if (!coreOk || !totalOk || !adaptiveOk) {
        fail(
          "t04_question_counts",
          `answered=${questionCountA} (core>=${CORE_QUESTION_COUNT}, adaptive<=${MAX_ADAPTIVE_QUESTIONS})`,
        );
      } else {
        pass(
          "t04_question_counts",
          `answered=${questionCountA}, core=${CORE_QUESTION_COUNT}, adaptive<=${MAX_ADAPTIVE_QUESTIONS}`,
        );
      }
    } catch (err) {
      fail("t04_question_counts", err.message);
    }

    // T05 — Placeholders / terminology
    try {
      const text = await page.locator("body").innerText();
      const hits = scanPlaceholders(text);
      metrics.unresolvedPlaceholders = hits;
      const englishOnlyServe = /\bServe\b(?!\s*\()/i.test(text) && !/Serve\s*\(/i.test(text);
      if (hits > 0) {
        fail("t05_terminology", `${hits} unresolved placeholder patterns`);
      } else if (englishOnlyServe) {
        fail("t05_terminology", "possible English-only term without Vietnamese gloss");
      } else {
        pass("t05_terminology", "no unresolved placeholders detected");
      }
    } catch (err) {
      fail("t05_terminology", err.message);
    }

    // T06 — Back/Next (restart partial flow)
    try {
      await page.goto(`${env.previewUrl}/player/skill-assessment-v5`, { waitUntil: "domcontentloaded" });
      await startNewAssessment(page);
      await answerCurrentRadio(page, 2);
      await answerCurrentRadio(page, 3);
      await answerCurrentRadio(page, 4);
      await clickBack(page);
      const checked = await page.getByTestId("v5-question-card").getByRole("radio", { checked: true }).count();
      if (checked < 1) {
        fail("t06_back_next", "answer lost after Back");
      } else {
        await answerCurrentRadio(page, 4);
        pass("t06_back_next", "answers preserved across Back/Next");
      }
    } catch (err) {
      fail("t06_back_next", err.message);
    }

    // T07 — Draft resume
    try {
      const draftBefore = await readDraft(page);
      assessmentIdA = draftBefore?.assessment_id ?? null;
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("v5-assessment-workspace").waitFor({ timeout: 30_000 });
      const draftAfter = await readDraft(page);
      const sameId = draftBefore?.assessment_id && draftAfter?.assessment_id === draftBefore.assessment_id;
      const hasAnswers = Object.keys(draftAfter?.answers ?? {}).length > 0;
      if (!sameId || !hasAnswers) {
        fail("t07_draft_resume", `assessment_id stable=${sameId}, answers=${hasAnswers}`);
      } else {
        assessmentIdA = draftAfter.assessment_id;
        pass("t07_draft_resume", `resumed assessment ${assessmentIdA}`);
      }
    } catch (err) {
      fail("t07_draft_resume", err.message);
    }

    // T08 — Payload allowlist (complete assessment A)
    let edgeResponseA = null;
    try {
      edgeCaptures.length = 0;
      await completeAllQuestions(page, 3, 40);
      const submit = page.getByTestId("v5-submit-assessment");
      await submit.waitFor({ state: "visible", timeout: 60_000 });
      await submit.click();
      await page.getByTestId("v5-assessment-results").waitFor({ timeout: 120_000 });

      const reqCapture = edgeCaptures.find((c) => c.phase === "request" && c.body);
      if (!reqCapture) {
        fail("t08_payload_allowlist", "no Edge request captured");
      } else {
        const check = validatePayload(reqCapture.body);
        if (!check.ok) {
          fail("t08_payload_allowlist", check.detail);
        } else {
          pass("t08_payload_allowlist", check.detail);
        }
      }
      edgeResponseA = edgeCaptures.find((c) => c.phase === "response" && c.json)?.json;
    } catch (err) {
      fail("t08_payload_allowlist", err.message);
    }

    // T09 — UI parity
    try {
      const data = edgeResponseA?.data ?? edgeResponseA;
      if (!data) {
        fail("t09_ui_parity", "no Edge response JSON");
      } else {
        const uiText = await page.getByTestId("v5-assessment-results").innerText();
        const est = data.estimated_rating ?? data.rating_before_gates;
        const prov = data.provisional_display_rating ?? data.provisional_rating;
        const conf = data.confidence_score;
        const checks = [
          est != null && uiText.includes(String(Number(est).toFixed(1))),
          prov != null && uiText.includes(String(Number(prov).toFixed(1))),
          conf != null && uiText.includes(String(conf)),
        ];
        if (checks.every(Boolean)) {
          pass("t09_ui_parity", "UI shows canonical Edge values");
        } else {
          fail("t09_ui_parity", "UI text mismatch vs Edge response");
        }
      }
    } catch (err) {
      fail("t09_ui_parity", err.message);
    }

    // T10 — Shadow notice
    try {
      const notice = page.getByTestId("v5-shadow-notice");
      const text = await notice.innerText();
      const ok = SHADOW_NOTICE_SNIPPETS.every((s) => text.includes(s));
      if (ok) {
        pass("t10_shadow_notice", "shadow notice visible");
      } else {
        fail("t10_shadow_notice", "shadow notice text incomplete");
      }
    } catch (err) {
      fail("t10_shadow_notice", err.message);
    }

    // T11 — High rating cap (assessment B)
    try {
      await page.goto(`${env.previewUrl}/player/skill-assessment-v5`, { waitUntil: "domcontentloaded" });
      await startNewAssessment(page);
      const draftB = await readDraft(page);
      assessmentIdB = draftB?.assessment_id ?? null;
      await completeAllQuestions(page, 7, 40);
      edgeCaptures.length = 0;
      const submitB = page.getByTestId("v5-submit-assessment");
      await submitB.dblclick();
      await page.getByTestId("v5-assessment-results").waitFor({ timeout: 120_000 });
      const resp = edgeCaptures.find((c) => c.phase === "response" && c.json)?.json;
      const data = resp?.data ?? resp;
      const provDisplay = Number(data?.provisional_display_rating);
      const status = String(data?.rating_status ?? "");
      const verifyReq = Boolean(data?.verification_required);
      const uiText = await page.getByTestId("v5-assessment-results").innerText();
      const showsVerified = /verified rating/i.test(uiText) && !/provisional/i.test(uiText);
      if (provDisplay !== 4.5 || status !== "under_review" || !verifyReq) {
        fail(
          "t11_rating_cap",
          `prov=${provDisplay}, status=${status}, verification_required=${verifyReq}`,
        );
      } else if (showsVerified) {
        fail("t11_rating_cap", "UI presents Verified label");
      } else {
        pass("t11_rating_cap", "provisional cap 4.5 + under_review");
      }
    } catch (err) {
      fail("t11_rating_cap", err.message);
    }

    // T12 — Idempotency (reload results + DB event count)
    try {
      const targetId = assessmentIdB || assessmentIdA;
      const beforeSnap = targetId
        ? await fetchAssessmentSnapshot(cohortClient, targetId)
        : { eventCount: 0 };

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("v5-assessment-results").waitFor({ timeout: 30_000 }).catch(() => {});

      const afterSnap = targetId
        ? await fetchAssessmentSnapshot(cohortClient, targetId)
        : { eventCount: 0 };

      if (afterSnap.eventCount > 1) {
        metrics.duplicateEvents = afterSnap.eventCount - 1;
        fail("t12_idempotency", `eventCount=${afterSnap.eventCount}`);
      } else if (beforeSnap.eventCount > 1) {
        metrics.duplicateEvents = beforeSnap.eventCount - 1;
        fail("t12_idempotency", `duplicate events already present (${beforeSnap.eventCount})`);
      } else {
        pass("t12_idempotency", `eventCount=${afterSnap.eventCount ?? 0}`);
      }
    } catch (err) {
      fail("t12_idempotency", err.message);
    }

    // T13 — V2 isolation
    try {
      const v2After = await fetchV2Row(cohortClient, cohortUserId);
      const beforeCount = v2Before?.count ?? 0;
      const afterCount = v2After?.count ?? 0;
      const beforeRating = v2Before?.row?.current_rating ?? v2Before?.row?.currentRating ?? null;
      const afterRating = v2After?.row?.current_rating ?? v2After?.row?.currentRating ?? null;
      if (beforeCount === 0 && afterCount === 0) {
        pass("t13_v2_isolation", "V2 row before=0 after=0");
      } else if (beforeRating !== afterRating || beforeCount !== afterCount) {
        metrics.v2Mutations = 1;
        fail("t13_v2_isolation", `V2 changed before=${beforeRating} after=${afterRating}`);
      } else {
        pass("t13_v2_isolation", "pick_vn_player_ratings unchanged");
      }
    } catch (err) {
      fail("t13_v2_isolation", err.message);
    }

    // T14 — Non-cohort access
    try {
      await logoutViaMenu(page, env.previewUrl);
      await loginViaForm(page, env.previewUrl, env.nonCohortEmail, env.nonCohortPassword);
      const menuVisible = await page
        .getByRole("link", { name: /đánh giá v5 \(shadow\)/i })
        .isVisible({ timeout: 8_000 })
        .catch(() => false);
      await page.goto(`${env.previewUrl}/player/skill-assessment-v5`, { waitUntil: "domcontentloaded" });
      const blockedRoute = !(await page.getByTestId("v5-assessment-workspace").isVisible().catch(() => false))
        && !(await page.getByTestId("v5-start-assessment").isVisible().catch(() => false));
      const onV5 = page.url().includes("/player/skill-assessment-v5");
      if (menuVisible) {
        fail("t14_non_cohort", "V5 menu visible for non-cohort user");
      } else if (!blockedRoute && onV5) {
        fail("t14_non_cohort", "non-cohort user can access V5 workspace");
      } else {
        pass("t14_non_cohort", "non-cohort user blocked from V5 UI");
      }
    } catch (err) {
      fail("t14_non_cohort", err.message);
    }
  } catch (fatal) {
    if (productionDetected) {
      blockedReason = "PRODUCTION TARGET DETECTED";
      console.error("\nSTOP — PRODUCTION TARGET DETECTED\n");
    }
    ensureArtifactsDir();
    fs.writeFileSync(
      path.join(artifactsDir, "network-summary.json"),
      JSON.stringify({ networkLog: networkLog.slice(-200), edgeCaptures: edgeCaptures.map(sanitizeCapture) }, null, 2),
    );
    fs.writeFileSync(path.join(artifactsDir, "console-errors.json"), JSON.stringify([], null, 2));
    if (page && context) {
      await saveArtifacts(page, context, { fatal: fatal?.message });
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  ensureArtifactsDir();
  fs.writeFileSync(
    path.join(artifactsDir, "network-summary.json"),
    JSON.stringify({ networkLog: networkLog.slice(-200), edgeCaptures: edgeCaptures.map(sanitizeCapture) }, null, 2),
  );
  fs.writeFileSync(
    path.join(artifactsDir, "test-results.json"),
    JSON.stringify({ runId, testResults, metrics, assessmentIdA, assessmentIdB }, null, 2),
  );

  const evidenceDir = path.join(rootDir, "docs/v5/rating-v5/qa-evidence/v5-b2-browser");
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, "LATEST_RUN.json"),
    JSON.stringify({ runId, artifactsDir, testResults, metrics, at: new Date().toISOString() }, null, 2),
  );

  printSummary();
  const failN = testResults.filter((t) => t.status === "FAIL").length;
  const blockedN = testResults.filter((t) => t.status === "BLOCKED").length;
  process.exit(blockedN > 0 ? 2 : failN > 0 ? 1 : 0);
}

function sanitizeCapture(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const clone = { ...entry };
  if (clone.json) {
    clone.json = "[redacted response shape only]";
  }
  return clone;
}

run().catch((err) => {
  console.error(err?.message || err);
  printSummary();
  process.exit(1);
});
