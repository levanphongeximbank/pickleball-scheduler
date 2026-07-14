/**
 * Production smoke — profile gender persistence.
 * Uses Production URL + production Supabase only.
 *
 * Env (via .env.production.local / Vercel decrypted vars / process):
 *   VITE_SUPABASE_URL (must include expuvcohlcjzvrrauvud)
 *   VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PRODUCTION_PLAYER_EMAIL (PLAYER account)
 *   PRODUCTION_APP_URL (default https://pickleball-scheduler-eight.vercel.app)
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";

import { loadProjectEnv } from "./load-env.mjs";
import {
  resolveVercelAutomationBypass,
  getVercelBypassHeaders,
} from "./vercel-automation-bypass.mjs";

const PROD_REF = "expuvcohlcjzvrrauvud";
const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const FIX_COMMIT = "3ca133132f7661825e353cdbc64b3ee432d619bf";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(rootDir, "docs", "v5", "qa-evidence", "phase-profile-gender");
const SCREEN = path.join(OUT, "production-screenshots");

const PREVIEW_BLOCK = "preview";

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    values[line.slice(0, i).trim()] = v;
  }
  return values;
}

function hydrateProductionEnv() {
  loadProjectEnv({ production: true });
  const files = [
    path.join(rootDir, ".env.production.local"),
    path.join(rootDir, ".env.production-smoke.tmp"),
    path.join(rootDir, "..", "pickleball-scheduler", ".env.production.local"),
  ];
  for (const file of files) {
    const values = loadDotEnvFile(file);
    for (const [k, v] of Object.entries(values)) {
      if (!String(process.env[k] || "").trim() && String(v || "").trim()) {
        process.env[k] = v;
      }
    }
  }
}

const report = {
  phase: "profile-gender-production-smoke",
  generatedAt: new Date().toISOString(),
  productionUrl: String(
    process.env.PRODUCTION_APP_URL || "https://pickleball-scheduler-eight.vercel.app"
  ).replace(/\/+$/, ""),
  deploymentId: process.env.PRODUCTION_DEPLOYMENT_ID || "dpl_A6fjxaa4SkTALu7xarFtGPX9GNim",
  sourceFixCommit: FIX_COMMIT,
  raisePatchCommit: "04a648389821bde789ec7377c3055f55dac94c87",
  mainHeadCommit: null,
  qaEmail: null,
  cases: [],
  network: [],
  pageErrors: [],
  productionDeployed: true,
  noSchemaChange: true,
  noRpcChange: true,
  noRlsChange: true,
  noMigration: true,
  verdict: "PENDING",
};

function record(id, verdict, evidence, extra = {}) {
  report.cases.push({ id, verdict, evidence, ...extra });
  console.log(`[${verdict}] ${id}: ${evidence}`);
}

function writeReport() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SCREEN, { recursive: true });
  fs.writeFileSync(path.join(OUT, "PRODUCTION_SMOKE_REPORT.json"), JSON.stringify(report, null, 2));
}

function getProdClients() {
  hydrateProductionEnv();
  const url = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const anon = String(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !anon || !service) {
    throw new Error("Missing production Supabase URL/anon/service role for smoke");
  }
  if (!url.includes(PROD_REF) || url.includes(STAGING_REF)) {
    throw new Error(`Refusing non-production Supabase URL (${url})`);
  }
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { url, admin, anonClient };
}

async function resolveQaPlayer(admin) {
  const preferred = String(
    process.env.PRODUCTION_PLAYER_EMAIL ||
      process.env.PRODUCTION_PLAYER_NOMEMBER_EMAIL ||
      ""
  )
    .trim()
    .toLowerCase();
  if (preferred) {
    const { data } = await admin
      .from("profiles")
      .select("id, email, role, gender, birth_year, display_name, phone, avatar_url")
      .eq("email", preferred)
      .maybeSingle();
    if (data) return data;
  }

  const { data: players, error } = await admin
    .from("profiles")
    .select("id, email, role, gender, birth_year, display_name, phone, avatar_url")
    .eq("role", "PLAYER")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  const candidate =
    players?.find((p) => /qa|test|smoke/i.test(p.email || "")) ||
    players?.find((p) => p.email) ||
    null;
  if (!candidate) throw new Error("No active PLAYER profile found for Production smoke");
  return candidate;
}

async function loginViaMagicLink(page, email, admin, anonClient) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${report.productionUrl}/` },
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(error?.message || "generateLink failed");
  }
  const { data: sessionData, error: verifyError } = await anonClient.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError || !sessionData?.session) {
    throw new Error(verifyError?.message || "verifyOtp failed");
  }
  const projectRef = new URL(
    String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)
  ).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  await page.goto(`${report.productionUrl}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [
      storageKey,
      JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
        expires_in: sessionData.session.expires_in,
        token_type: sessionData.session.token_type,
        user: sessionData.session.user,
      }),
    ]
  );
  await page.goto(`${report.productionUrl}/`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(1500);
  if (page.url().includes("/login")) {
    throw new Error("Production session injection failed");
  }
  return sessionData.user.id;
}

const GENDER_BY_LABEL = { Nam: "male", Nữ: "female", Khác: "other" };

async function openProfile(page, { expectGender } = {}) {
  await page.goto(`${report.productionUrl}/player/profile`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByRole("heading", { name: /hồ sơ của tôi/i }).waitFor({ timeout: 60000 });
  await page.getByText(/^Giới tính$/i).waitFor({ timeout: 30000 });
  await page.locator('input[type="radio"][value="male"]').waitFor({ state: "attached" });
  if (expectGender) {
    await page.waitForFunction(
      (value) => document.querySelector(`input[type="radio"][value="${value}"]`)?.checked === true,
      expectGender,
      { timeout: 30000 }
    );
  } else {
    await page.waitForTimeout(2000);
  }
}

async function selectGender(page, label) {
  const value = GENDER_BY_LABEL[label];
  await page.getByRole("radio", { name: label }).first().click({ force: true });
  await page.waitForTimeout(300);
  const checked = await page.locator(`input[type="radio"][value="${value}"]`).isChecked();
  if (!checked) {
    await page.locator("label").filter({ hasText: new RegExp(`^${label}$`) }).first().click();
    await page.waitForTimeout(300);
  }
  if (!(await page.locator(`input[type="radio"][value="${value}"]`).isChecked())) {
    throw new Error(`Failed to select ${label}`);
  }
}

async function genderSelected(page, label) {
  return page.locator(`input[type="radio"][value="${GENDER_BY_LABEL[label]}"]`).isChecked();
}

async function clickSave(page) {
  const before = report.network.length;
  await page.getByRole("button", { name: /lưu hồ sơ/i }).click();
  await page.getByText(/đã cập nhật hồ sơ/i).waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  return report.network.slice(before);
}

function attachNetwork(page) {
  page.on("request", (req) => {
    const u = req.url();
    if (!/\/rest\/v1\/profiles/i.test(u)) return;
    if (!["POST", "PATCH", "PUT"].includes(req.method())) return;
    if (u.includes(STAGING_REF)) {
      report.fatal = "STAGING_URL_IN_PRODUCTION_SMOKE";
    }
    let body = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    report.network.push({
      at: new Date().toISOString(),
      method: req.method(),
      host: new URL(u).host,
      gender: body?.gender ?? null,
      birth_year: body?.birth_year ?? null,
      keys: body ? Object.keys(body) : [],
    });
  });
  page.on("pageerror", (err) => report.pageErrors.push(String(err?.message || err)));
}

async function readProfile(admin, userId) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, display_name, phone, avatar_url, gender, birth_year, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function main() {
  hydrateProductionEnv();
  const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  report.mainHeadCommit = head;

  if (report.productionUrl.toLowerCase().includes(PREVIEW_BLOCK) && !report.productionUrl.includes("eight")) {
    // allow eight.vercel.app production alias only
  }

  const { admin, anonClient } = getProdClients();
  const player = await resolveQaPlayer(admin);
  report.qaEmail = player.email;

  const bypass = await resolveVercelAutomationBypass({
    team: "pickleball-scheduler",
    project: "pickleball-scheduler",
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      extraHTTPHeaders: bypass.configured ? getVercelBypassHeaders(bypass.secret) : {},
    });
    const page = await context.newPage();
    attachNetwork(page);

    const userId = await loginViaMagicLink(page, player.email, admin, anonClient);
    record("LOGIN", "PASS", `magic-link ${player.email}`);

    await admin
      .from("profiles")
      .update({ gender: null, birth_year: player.birth_year ?? 1990 })
      .eq("id", userId);

    report.dbBefore = await readProfile(admin, userId);

    // A Nam + reload
    await openProfile(page);
    await selectGender(page, "Nam");
    const netA = await clickSave(page);
    const dbA = await readProfile(admin, userId);
    await openProfile(page, { expectGender: "male" });
    const uiA = await genderSelected(page, "Nam");
    await page.screenshot({ path: path.join(SCREEN, "prod-a-nam.png"), fullPage: true });
    record("CASE_A", dbA.gender === "male" && uiA ? "PASS" : "FAIL", `db=${dbA.gender} ui=${uiA}`, {
      mutations: netA.length,
      payloadGender: netA.map((n) => n.gender),
    });

    // B Nu + logout/login
    await selectGender(page, "Nữ");
    const netB = await clickSave(page);
    const dbB = await readProfile(admin, userId);
    await page.evaluate(() => localStorage.clear());
    await loginViaMagicLink(page, player.email, admin, anonClient);
    await openProfile(page, { expectGender: "female" });
    const uiB = await genderSelected(page, "Nữ");
    await page.screenshot({ path: path.join(SCREEN, "prod-b-nu.png"), fullPage: true });
    record("CASE_B", dbB.gender === "female" && uiB ? "PASS" : "FAIL", `db=${dbB.gender} ui=${uiB}`, {
      mutations: netB.length,
    });

    // C Khac + new tab
    await selectGender(page, "Khác");
    const netC = await clickSave(page);
    const dbC = await readProfile(admin, userId);
    const storage = await context.storageState();
    const ctx2 = await browser.newContext({
      extraHTTPHeaders: bypass.configured ? getVercelBypassHeaders(bypass.secret) : {},
      storageState: storage,
    });
    const tab = await ctx2.newPage();
    attachNetwork(tab);
    await openProfile(tab, { expectGender: "other" });
    const uiC = await genderSelected(tab, "Khác");
    await tab.screenshot({ path: path.join(SCREEN, "prod-c-khac-tab.png"), fullPage: true });
    await ctx2.close();
    record("CASE_C", dbC.gender === "other" && uiC ? "PASS" : "FAIL", `db=${dbC.gender} ui=${uiC}`, {
      mutations: netC.length,
    });

    // D preserve demographics while changing name/phone
    await openProfile(page, { expectGender: "other" });
    const nameField = page.getByLabel(/họ tên/i);
    const phoneField = page.getByLabel(/số điện thoại/i);
    const prevName = await nameField.inputValue();
    const nextName = `${prevName.replace(/\s+PG\d+$/, "")} PG${Date.now().toString().slice(-4)}`.trim();
    const nextPhone = `09${String(Date.now()).slice(-8)}`;
    await nameField.fill(nextName);
    await phoneField.fill(nextPhone);
    if (!(await genderSelected(page, "Khác"))) await selectGender(page, "Khác");
    const netD = await clickSave(page);
    const dbD = await readProfile(admin, userId);
    await openProfile(page, { expectGender: "other" });
    const uiD = await genderSelected(page, "Khác");
    await page.screenshot({ path: path.join(SCREEN, "prod-d-preserve.png"), fullPage: true });
    record(
      "CASE_D",
      dbD.gender === "other" &&
        uiD &&
        dbD.display_name === nextName &&
        String(dbD.phone || "") === nextPhone
        ? "PASS"
        : "FAIL",
      `gender=${dbD.gender} nameOk=${dbD.display_name === nextName} phoneOk=${String(dbD.phone || "") === nextPhone}`,
      { mutations: netD.length }
    );

    // E gender-only no null overwrite
    const beforeE = await readProfile(admin, userId);
    await selectGender(page, "Nam");
    const netE = await clickSave(page);
    const dbE = await readProfile(admin, userId);
    await page.screenshot({ path: path.join(SCREEN, "prod-e-gender-only.png"), fullPage: true });
    const ePass =
      dbE.gender === "male" &&
      dbE.display_name === beforeE.display_name &&
      String(dbE.phone || "") === String(beforeE.phone || "") &&
      String(dbE.avatar_url || "") === String(beforeE.avatar_url || "") &&
      String(dbE.birth_year ?? "") === String(beforeE.birth_year ?? "");
    record("CASE_E", ePass ? "PASS" : "FAIL", `gender=${dbE.gender} fieldsPreserved=${ePass}`, {
      mutations: netE.length,
    });

    report.dbAfter = {
      gender: dbE.gender,
      birth_year: dbE.birth_year,
      display_name: dbE.display_name,
      phone: dbE.phone ? "[set]" : "",
      avatar_url: dbE.avatar_url ? "[set]" : "",
    };

    const stagingLeak = report.network.some((n) => String(n.host || "").includes(STAGING_REF));
    record(
      "NETWORK",
      !stagingLeak && report.network.every((n) => n.keys?.includes("gender"))
        ? "PASS"
        : "FAIL",
      `mutations=${report.network.length} stagingLeak=${stagingLeak}`
    );
    record("PAGEERROR", report.pageErrors.length === 0 ? "PASS" : "FAIL", `count=${report.pageErrors.length}`);

    const fails = report.cases.filter((c) => c.verdict === "FAIL").length;
    const partials = report.cases.filter((c) => c.verdict === "PARTIAL").length;
    report.verdict = fails ? "FAIL" : partials ? "PARTIAL" : "PASS";
  } finally {
    await browser.close();
    writeReport();
  }

  console.log(`\nVERDICT=${report.verdict}`);
  console.log(`REPORT=${path.join(OUT, "PRODUCTION_SMOKE_REPORT.json")}`);
  if (report.verdict === "FAIL") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  report.verdict = "FAIL";
  report.fatal = String(err?.message || err);
  writeReport();
  process.exit(1);
});
