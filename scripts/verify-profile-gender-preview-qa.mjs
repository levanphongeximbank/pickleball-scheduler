/**
 * Preview QA — profile gender persistence (fix/profile-gender-persist).
 * Staging Supabase only. Never prints secrets/tokens.
 *
 * Usage:
 *   node scripts/verify-profile-gender-preview-qa.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";

import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import {
  resolveVercelAutomationBypass,
  getVercelBypassHeaders,
} from "./vercel-automation-bypass.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PROD_REF = "expuvcohlcjzvrrauvud";
const FIX_COMMIT = "3ca133132f7661825e353cdbc64b3ee432d619bf";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(rootDir, "docs", "v5", "qa-evidence", "phase-profile-gender");
const SCREEN = path.join(OUT, "screenshots");

const PREVIEW =
  process.env.PROFILE_GENDER_PREVIEW_URL ||
  "https://pickleball-scheduler-git-fix-profil-f85a48-pickleball-scheduler.vercel.app";

const QA_EMAIL =
  process.env.PROFILE_GENDER_QA_EMAIL ||
  process.env.STAGING_PLAYER_EMAIL ||
  "player@staging.local";

const report = {
  phase: "profile-gender-preview-qa",
  generatedAt: new Date().toISOString(),
  previewUrl: PREVIEW.replace(/\/+$/, ""),
  deploymentId: null,
  commitExpected: FIX_COMMIT,
  commitDeployed: null,
  commitContainsFix: null,
  qaEmail: QA_EMAIL,
  stagingRef: STAGING_REF,
  productionDeployed: false,
  cases: [],
  network: [],
  pageErrors: [],
  consoleErrors: [],
  tests: { unit: null, build: null },
  verdict: "PENDING",
};

function record(id, verdict, evidence, extra = {}) {
  report.cases.push({ id, verdict, evidence, ...extra });
  console.log(`[${verdict}] ${id}: ${evidence}`);
}

function writeReport() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SCREEN, { recursive: true });
  fs.writeFileSync(path.join(OUT, "PREVIEW_QA_REPORT.json"), JSON.stringify(report, null, 2));
}

function assertStagingOnly() {
  loadProjectEnv();
  const { url } = getStagingSupabaseEnv();
  if (!url.includes(STAGING_REF) || url.includes(PROD_REF)) {
    throw new Error("Refusing non-staging Supabase");
  }
}

function resolvePassword(email) {
  loadProjectEnv();
  const map = {
    "owner@staging.local": "STAGING_OWNER_A_PASSWORD",
    "owner-b@staging.local": "STAGING_OWNER_B_PASSWORD",
    "player@staging.local": "STAGING_CAPTAIN_A_PASSWORD",
    "manager@staging.local": "STAGING_MANAGER_PASSWORD",
    "club@staging.local": "STAGING_CLUB_PASSWORD",
    "qa42l.nomember@staging.local": "STAGING_PLAYER_NOMEMBER_PASSWORD",
    "player.nomember@staging.local": "STAGING_PLAYER_NOMEMBER_PASSWORD",
  };
  const key = map[String(email).toLowerCase()];
  const fromEnv = key ? String(process.env[key] || "").trim() : "";
  if (fromEnv) return fromEnv;
  const playerPw = String(
    process.env.STAGING_PLAYER_PASSWORD || process.env.STAGING_PLAYER_NEW_PASSWORD || ""
  ).trim();
  if (playerPw && String(email).includes("player")) return playerPw;
  return String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();
}

function inspectDeployment(previewUrl) {
  const host = previewUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const proc = spawnSync("npx", ["vercel", "inspect", host], {
    cwd: rootDir,
    encoding: "utf8",
    shell: true,
  });
  const text = `${proc.stdout || ""}\n${proc.stderr || ""}`;
  const id = (text.match(/\bid\s+(dpl_[A-Za-z0-9]+)/) || [])[1] || null;
  return { id, text: text.slice(0, 2500) };
}

function gitContainsFix() {
  const proc = spawnSync("git", ["merge-base", "--is-ancestor", FIX_COMMIT, "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  return proc.status === 0;
}

async function getAdmin() {
  const { url, serviceKey } = getStagingSupabaseEnv();
  if (!serviceKey) throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readProfileGender(admin, userId) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, display_name, phone, avatar_url, gender, birth_year, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loginViaPassword(page, email, password) {
  await page.goto(`${report.previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/mật khẩu|password/i).fill(password);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 90000 });
}

async function loginViaMagicLink(page, email) {
  const { url, anonKey, serviceKey } = getStagingSupabaseEnv();
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${report.previewUrl}/` },
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(error?.message || "generateLink failed");
  }
  const { data: sessionData, error: verifyError } = await client.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError || !sessionData?.session) {
    throw new Error(verifyError?.message || "verifyOtp failed");
  }
  const projectRef = new URL(url).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  await page.goto(`${report.previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
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
  await page.goto(`${report.previewUrl}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(1500);
  if (page.url().includes("/login")) {
    throw new Error("Magic-link session injection failed");
  }
  return sessionData.user.id;
}

function attachNetworkTap(page) {
  page.on("request", async (req) => {
    const u = req.url();
    if (!/\/rest\/v1\/profiles/i.test(u)) return;
    if (!["POST", "PATCH", "PUT"].includes(req.method())) return;
    let body = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    const sanitized = body && typeof body === "object"
      ? {
          keys: Object.keys(body),
          gender: body.gender ?? null,
          birth_year: body.birth_year ?? null,
          display_name: body.display_name != null ? "[set]" : null,
          phone: body.phone != null ? "[set]" : null,
          avatar_url: body.avatar_url != null ? "[set]" : null,
          hasRole: body.role != null,
        }
      : { rawType: typeof body };
    report.network.push({
      at: new Date().toISOString(),
      method: req.method(),
      url: u.replace(/\?.*/, ""),
      payload: sanitized,
    });
  });
  page.on("response", async (res) => {
    const u = res.url();
    if (!/\/rest\/v1\/profiles/i.test(u)) return;
    if (!["POST", "PATCH", "PUT"].includes(res.request().method())) return;
    let gender = null;
    let birth_year = null;
    try {
      const json = await res.json();
      const row = Array.isArray(json) ? json[0] : json;
      gender = row?.gender ?? null;
      birth_year = row?.birth_year ?? null;
    } catch {
      // ignore
    }
    report.network.push({
      at: new Date().toISOString(),
      type: "response",
      status: res.status(),
      url: u.replace(/\?.*/, ""),
      canonicalGender: gender,
      canonicalBirthYear: birth_year,
    });
  });
  page.on("pageerror", (err) => {
    report.pageErrors.push(String(err?.message || err));
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      report.consoleErrors.push(msg.text());
    }
  });
}

const GENDER_BY_LABEL = Object.freeze({
  Nam: "male",
  Nữ: "female",
  Khác: "other",
});

async function openProfile(page, { expectGender } = {}) {
  // Force athlete profile surface (has gender radios), not staff MyProfile.
  await page.goto(`${report.previewUrl}/player/profile`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByRole("heading", { name: /hồ sơ của tôi/i }).waitFor({ timeout: 60000 });
  await page.getByText(/^Giới tính$/i).waitFor({ timeout: 30000 });
  await page.locator('input[type="radio"][value="male"]').waitFor({ state: "attached", timeout: 20000 });
  if (expectGender) {
    await page.waitForFunction(
      (value) => {
        const el = document.querySelector(`input[type="radio"][value="${value}"]`);
        return Boolean(el && el.checked);
      },
      expectGender,
      { timeout: 30000 }
    );
  } else {
    // Allow fetchSelfProfile to hydrate controlled RadioGroup before asserts/edits.
    await page.waitForTimeout(2000);
  }
}

async function selectGender(page, label) {
  const value = GENDER_BY_LABEL[label];
  if (!value) throw new Error(`Unknown gender label ${label}`);
  const native = page.locator(`input[type="radio"][value="${value}"]`);
  await native.waitFor({ state: "attached", timeout: 20000 });
  // MUI Radio: click the accessible radio role (label), not .check() on native input.
  await page.getByRole("radio", { name: label }).first().click({ force: true });
  await page.waitForTimeout(400);
  let checked = await native.isChecked();
  if (!checked) {
    await page.locator("label").filter({ hasText: new RegExp(`^${label}$`) }).first().click();
    await page.waitForTimeout(400);
    checked = await native.isChecked();
  }
  if (!checked) {
    const dump = await page.evaluate(() =>
      [...document.querySelectorAll('input[type=radio]')].map((r) => ({
        value: r.value,
        checked: r.checked,
      }))
    );
    throw new Error(`Radio value=${value} not checked after select ${label}: ${JSON.stringify(dump)}`);
  }
}

async function clickSave(page) {
  const before = report.network.length;
  await page.getByRole("button", { name: /lưu hồ sơ/i }).click();
  await page.getByText(/đã cập nhật hồ sơ/i).waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  return report.network.slice(before);
}

async function genderSelected(page, label) {
  const value = GENDER_BY_LABEL[label];
  return page.locator(`input[type="radio"][value="${value}"]`).isChecked();
}

async function screenshot(page, name) {
  const file = path.join(SCREEN, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function mutationCount(entries) {
  return entries.filter((e) => e.method && ["POST", "PATCH", "PUT"].includes(e.method)).length;
}

async function main() {
  assertStagingOnly();
  fs.mkdirSync(SCREEN, { recursive: true });

  report.commitContainsFix = gitContainsFix();
  const inspect = inspectDeployment(report.previewUrl);
  report.deploymentId = inspect.id;

  const unit = spawnSync("node", ["--test", "tests/self-profile-gender.test.js"], {
    cwd: rootDir,
    encoding: "utf8",
    shell: true,
  });
  report.tests.unit = {
    ok: unit.status === 0,
    summary: (unit.stdout || "").split("\n").filter((l) => l.includes("ℹ") || l.includes("✔") || l.includes("✖")).slice(-8),
  };

  const bypass = await resolveVercelAutomationBypass({
    team: "pickleball-scheduler",
    project: "pickleball-scheduler",
  });
  if (!bypass.configured) {
    throw new Error("Vercel bypass not configured");
  }

  const admin = await getAdmin();
  const password = resolvePassword(QA_EMAIL);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      extraHTTPHeaders: getVercelBypassHeaders(bypass.secret),
    });
    const page = await context.newPage();
    attachNetworkTap(page);

    let userId = null;
    try {
      await loginViaPassword(page, QA_EMAIL, password);
      // resolve id after login via service lookup
      const { data: byEmail } = await admin
        .from("profiles")
        .select("id")
        .eq("email", QA_EMAIL)
        .maybeSingle();
      userId = byEmail?.id || null;
      record("LOGIN", "PASS", `password login ok (${QA_EMAIL})`);
    } catch (err) {
      userId = await loginViaMagicLink(page, QA_EMAIL);
      record("LOGIN", "PASS", `magic-link login fallback (${QA_EMAIL})`);
    }

    if (!userId) {
      const { data } = await admin.from("profiles").select("id").eq("email", QA_EMAIL).maybeSingle();
      userId = data?.id;
    }
    if (!userId) throw new Error("Could not resolve QA user id");

    const beforeAll = await readProfileGender(admin, userId);
    report.dbBefore = {
      gender: beforeAll.gender,
      birth_year: beforeAll.birth_year,
      display_name: beforeAll.display_name,
      phone: beforeAll.phone ? "[set]" : "",
      avatar_url: beforeAll.avatar_url ? "[set]" : "",
    };

    // ---- Case A: Nam ----
    await openProfile(page);
    await selectGender(page, "Nam");
    const netA = await clickSave(page);
    const dbA = await readProfileGender(admin, userId);
    await openProfile(page, { expectGender: "male" });
    const checkedA = await genderSelected(page, "Nam");
    await screenshot(page, "case-a-nam-after-reload");
    const aPass =
      dbA.gender === "male" &&
      checkedA &&
      netA.some((n) => n.payload?.gender === "male" || n.canonicalGender === "male");
    record("CASE_A", aPass ? "PASS" : "FAIL", `db=${dbA.gender} uiNam=${checkedA} mutations=${mutationCount(netA)}`, {
      db: dbA.gender,
      networkGender: netA.map((n) => n.payload?.gender || n.canonicalGender).filter(Boolean),
      mutations: mutationCount(netA),
    });

    // ---- Case B: Nữ + logout/login ----
    await openProfile(page, { expectGender: "male" });
    await selectGender(page, "Nữ");
    const netB = await clickSave(page);
    const dbB = await readProfileGender(admin, userId);
    await page.evaluate(() => localStorage.clear());
    try {
      await loginViaPassword(page, QA_EMAIL, password);
    } catch {
      await loginViaMagicLink(page, QA_EMAIL);
    }
    await openProfile(page, { expectGender: "female" });
    const checkedB = await genderSelected(page, "Nữ");
    await screenshot(page, "case-b-nu-after-relogin");
    const bPass = dbB.gender === "female" && checkedB;
    record("CASE_B", bPass ? "PASS" : "FAIL", `db=${dbB.gender} uiNu=${checkedB} mutations=${mutationCount(netB)}`, {
      db: dbB.gender,
      mutations: mutationCount(netB),
    });

    // ---- Case C: Khác + second context ----
    await openProfile(page, { expectGender: "female" });
    await selectGender(page, "Khác");
    const netC = await clickSave(page);
    const dbC = await readProfileGender(admin, userId);
    const storage = await context.storageState();
    const context2 = await browser.newContext({
      extraHTTPHeaders: getVercelBypassHeaders(bypass.secret),
      storageState: storage,
    });
    const otherTab = await context2.newPage();
    attachNetworkTap(otherTab);
    await openProfile(otherTab, { expectGender: "other" });
    const checkedC = await genderSelected(otherTab, "Khác");
    await screenshot(otherTab, "case-c-khac-other-tab");
    await context2.close();
    const cPass = dbC.gender === "other" && checkedC;
    record("CASE_C", cPass ? "PASS" : "FAIL", `db=${dbC.gender} otherTabKhac=${checkedC} mutations=${mutationCount(netC)}`, {
      db: dbC.gender,
      mutations: mutationCount(netC),
    });

    // ---- Case D: change phone/name, keep gender ----
    await openProfile(page, { expectGender: "other" });
    const keepGender = "other";
    const nameField = page.getByLabel(/họ tên/i);
    const phoneField = page.getByLabel(/số điện thoại/i);
    const prevName = await nameField.inputValue();
    const nextName = `${prevName.replace(/\s+QA-G\d+$/, "")} QA-G${Date.now().toString().slice(-4)}`.trim();
    const nextPhone = `09${String(Date.now()).slice(-8)}`;
    await nameField.fill(nextName);
    await phoneField.fill(nextPhone);
    // Ensure gender still selected in controlled form before save.
    if (!(await genderSelected(page, "Khác"))) {
      await selectGender(page, "Khác");
    }
    const netD = await clickSave(page);
    const dbD = await readProfileGender(admin, userId);
    await openProfile(page, { expectGender: "other" });
    const stillKhac = await genderSelected(page, "Khác");
    await screenshot(page, "case-d-preserve-gender");
    const dPass =
      dbD.gender === keepGender &&
      stillKhac &&
      dbD.display_name === nextName &&
      String(dbD.phone || "") === nextPhone &&
      netD.some((n) => n.payload?.gender === "other");
    record("CASE_D", dPass ? "PASS" : "FAIL", `gender=${dbD.gender} uiKhac=${stillKhac} nameOk=${dbD.display_name === nextName} phoneOk=${String(dbD.phone||'')===nextPhone}`, {
      dbGender: dbD.gender,
      mutations: mutationCount(netD),
      payloadGender: netD.map((n) => n.payload?.gender).filter((v) => v !== undefined),
    });

    // ---- Case E: change gender only, other fields unchanged ----
    const snapBefore = await readProfileGender(admin, userId);
    await openProfile(page, { expectGender: "other" });
    await selectGender(page, "Nam");
    const netE = await clickSave(page);
    const dbE = await readProfileGender(admin, userId);
    await screenshot(page, "case-e-gender-only");
    const ePass =
      dbE.gender === "male" &&
      dbE.display_name === snapBefore.display_name &&
      String(dbE.phone || "") === String(snapBefore.phone || "") &&
      String(dbE.avatar_url || "") === String(snapBefore.avatar_url || "") &&
      String(dbE.birth_year ?? "") === String(snapBefore.birth_year ?? "");
    record("CASE_E", ePass ? "PASS" : "FAIL", `gender=${dbE.gender} nameKept=${dbE.display_name===snapBefore.display_name} phoneKept=${String(dbE.phone||'')===String(snapBefore.phone||'')} avatarKept=${String(dbE.avatar_url||'')===String(snapBefore.avatar_url||'')} birthKept=${String(dbE.birth_year??'')===String(snapBefore.birth_year??'')}`, {
      before: {
        display_name: snapBefore.display_name,
        phone: snapBefore.phone ? "[set]" : "",
        avatar_url: snapBefore.avatar_url ? "[set]" : "",
        birth_year: snapBefore.birth_year,
        gender: snapBefore.gender,
      },
      after: {
        display_name: dbE.display_name,
        phone: dbE.phone ? "[set]" : "",
        avatar_url: dbE.avatar_url ? "[set]" : "",
        birth_year: dbE.birth_year,
        gender: dbE.gender,
      },
      mutations: mutationCount(netE),
    });

    report.dbAfter = {
      gender: dbE.gender,
      birth_year: dbE.birth_year,
      display_name: dbE.display_name,
      phone: dbE.phone ? "[set]" : "",
      avatar_url: dbE.avatar_url ? "[set]" : "",
    };

    const profileMutations = report.network.filter(
      (n) => n.method && ["POST", "PATCH", "PUT"].includes(n.method)
    );
    const dualWrite = report.cases.some((c) => (c.mutations || 0) > 1);
    record(
      "NETWORK",
      !dualWrite && profileMutations.every((m) => m.payload?.gender != null || (m.payload?.keys || []).includes("gender"))
        ? "PASS"
        : "PARTIAL",
      `mutations=${profileMutations.length} dualWriteSuspect=${dualWrite}`,
      { sample: profileMutations.slice(-6) }
    );

    record(
      "PAGEERROR",
      report.pageErrors.length === 0 ? "PASS" : "FAIL",
      `pageErrors=${report.pageErrors.length}`,
      { pageErrors: report.pageErrors.slice(0, 10) }
    );

    record(
      "UNIT_TESTS",
      report.tests.unit.ok ? "PASS" : "FAIL",
      report.tests.unit.ok ? "self-profile-gender tests pass" : "unit tests failed"
    );

    const fails = report.cases.filter((c) => c.verdict === "FAIL").length;
    const partials = report.cases.filter((c) => c.verdict === "PARTIAL").length;
    report.verdict = fails ? "FAIL" : partials ? "PARTIAL" : "PASS";
  } finally {
    if (browser) await browser.close();
    writeReport();
  }

  console.log(`\nVERDICT=${report.verdict}`);
  console.log(`REPORT=${path.join(OUT, "PREVIEW_QA_REPORT.json")}`);
  if (report.verdict === "FAIL") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  report.verdict = "FAIL";
  report.fatal = String(err?.message || err);
  writeReport();
  process.exit(1);
});
