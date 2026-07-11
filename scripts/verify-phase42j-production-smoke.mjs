/**
 * Phase 42J FINAL — Production smoke QA (browser).
 *
 * Usage:
 *   PRODUCTION_APP_URL=https://pickleball-scheduler-eight.vercel.app \
 *   npx vercel env run -e production -- node scripts/verify-phase42j-production-smoke.mjs
 *
 * Accounts (override via env):
 *   PRODUCTION_PLAYER_NOMEMBER_EMAIL (default player@gmail.com)
 *   PRODUCTION_ACTIVE_MEMBER_EMAIL (default huynhanh1970@gmail.com)
 *   PRODUCTION_SUPERADMIN_NOMEMBER_EMAIL (default lephong.eximbank@gmail.com)
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./load-env.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYMENT = String(
  process.env.PRODUCTION_APP_URL || "https://pickleball-scheduler-eight.vercel.app"
).replace(/\/+$/, "");
const SCREEN_DIR = path.join(rootDir, "docs", "v5", "qa-evidence", "phase42j-production");
const COMMIT = "2a887d4";

const results = [];
const redirectTrace = [];
const consoleFindings = [];
const networkFindings = [];

function record(caseId, verdict, evidence) {
  results.push({ case: caseId, verdict, evidence });
  console.log(`[${verdict}] ${caseId}: ${evidence}`);
}

function createRpcCounter(label) {
  let count = 0;
  const attach = (page) => {
    page.on("request", (req) => {
      if (req.url().includes("club_get_my_active_membership")) {
        count += 1;
        networkFindings.push(`${label}: rpc#${count} ${req.method()}`);
      }
    });
  };
  return { attach, get: () => count };
}

function attachConsole(page, label) {
  page.on("pageerror", (err) => {
    consoleFindings.push(`${label} pageerror: ${err?.message || err}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (!t.includes("favicon") && !t.includes("React DevTools")) {
        consoleFindings.push(`${label} console: ${t}`);
      }
    }
  });
}

async function isNavHighlighted(page, label) {
  const ariaCurrent = await page.locator(`a[aria-current="page"]`).allTextContents();
  const selected = await page.locator(`.Mui-selected`).allTextContents();
  const combined = [...ariaCurrent, ...selected].join(" ");
  return new RegExp(label, "i").test(combined);
}

async function loginViaMagicLink(page, email) {
  const url = String(process.env.VITE_SUPABASE_URL || "").trim();
  const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!url.includes("expuvcohlcjzvrrauvud")) {
    throw new Error("Refusing non-production Supabase URL for production smoke");
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${DEPLOYMENT}/` },
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
  const payload = {
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    expires_at: sessionData.session.expires_at,
    expires_in: sessionData.session.expires_in,
    token_type: sessionData.session.token_type,
    user: sessionData.session.user,
  };
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "commit", timeout: 120000 });
  await page.evaluate(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [storageKey, JSON.stringify(payload)]
  );
  await page.goto(`${DEPLOYMENT}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  if (page.url().includes("/login")) {
    throw new Error("Session injection did not establish auth");
  }
}

async function run() {
  const playerNomember = String(process.env.PRODUCTION_PLAYER_NOMEMBER_EMAIL || "player@gmail.com").trim();
  const activeMember = String(process.env.PRODUCTION_ACTIVE_MEMBER_EMAIL || "huynhanh1970@gmail.com").trim();
  const saNomember = String(
    process.env.PRODUCTION_SUPERADMIN_NOMEMBER_EMAIL || "lephong.eximbank@gmail.com"
  ).trim();

  console.log(`\nPhase 42J FINAL — Production smoke`);
  console.log(`URL: ${DEPLOYMENT}`);
  console.log(`Commit: ${COMMIT}\n`);

  const browser = await chromium.launch({ headless: true });

  // Case 5 — Legacy routes (no auth)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    attachConsole(page, "C5");
    try {
      await page.goto(`${DEPLOYMENT}/clubs/discover`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((u) => u.pathname.includes("/discover-clubs"), { timeout: 20000 });
      const u1 = page.url();
      await loginViaMagicLink(page, playerNomember);
      await page.goto(`${DEPLOYMENT}/my-club?view=discover`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((u) => u.pathname.includes("/discover-clubs"), { timeout: 20000 });
      const u2 = page.url();
      const pass = u1.includes("/discover-clubs") && u2.includes("/discover-clubs");
      record("5", pass ? "PASS" : "FAIL", `clubs/discover→${u1}; view=discover→${u2}`);
    } catch (e) {
      record("5", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 1 — PLAYER no membership
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const rpc = createRpcCounter("C1");
    rpc.attach(page);
    attachConsole(page, "C1");
    try {
      await loginViaMagicLink(page, playerNomember);
      await page.waitForTimeout(2500);
      const postLogin = page.url();
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((u) => u.pathname.includes("/discover-clubs"), { timeout: 30000 });
      await page.waitForTimeout(1500);
      const body = await page.locator("body").innerText();
      const blank = body.trim().length < 40;
      const leaveBtn = await page.getByRole("button", { name: /rời câu lạc bộ/i }).count();
      const highlight = await isNavHighlighted(page, "Khám phá CLB");
      const rpcBefore = rpc.get();
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await page.goForward({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const navDelta = rpc.get() - rpcBefore;
      const pass =
        postLogin.includes("/discover-clubs") &&
        page.url().includes("/discover-clubs") &&
        !blank &&
        leaveBtn === 0 &&
        highlight &&
        navDelta === 0;
      record(
        "1",
        pass ? "PASS" : postLogin.includes("/discover-clubs") ? "PARTIAL" : "FAIL",
        `login→${postLogin}; final→${page.url()}; blank=${blank}; leave=${leaveBtn}; highlight=${highlight}; rpcNavDelta=${navDelta}; rpcTotal=${rpc.get()}`
      );
    } catch (e) {
      record("1", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 2 — Active member
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachConsole(page, "C2");
    try {
      await loginViaMagicLink(page, activeMember);
      await page.waitForTimeout(2500);
      const postLogin = page.url();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const afterReload = page.url();
      const body = await page.locator("body").innerText();
      const joinOwn = /xin gia nhập|tham gia clb/i.test(body) && /accc/i.test(body);
      const homeOk = /lịch sinh hoạt|thành viên|trang chủ/i.test(body);
      const pass = postLogin.includes("/my-club") && afterReload.includes("/my-club") && homeOk && !joinOwn;
      record(
        "2",
        pass ? "PASS" : postLogin.includes("/my-club") ? "PARTIAL" : "FAIL",
        `login→${postLogin}; reload→${afterReload}; homeOk=${homeOk}; joinOwn=${joinOwn}`
      );
    } catch (e) {
      record("2", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 3 — President / requests
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachConsole(page, "C3");
    try {
      await loginViaMagicLink(page, activeMember);
      await page.goto(`${DEPLOYMENT}/my-club/requests`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      const url = page.url();
      const body = await page.locator("body").innerText();
      const onRequests = url.includes("/my-club/requests");
      const hasTable = /yêu cầu|pending|chờ duyệt|không có yêu cầu/i.test(body);
      const rejectBtn = await page.getByRole("button", { name: /từ chối|reject/i }).count();
      const pass = onRequests && hasTable;
      record(
        "3",
        pass ? "PASS" : onRequests ? "PARTIAL" : "FAIL",
        `url=${url}; hasTable=${hasTable}; rejectButtons=${rejectBtn}; note=pending may be 0 on prod`
      );
    } catch (e) {
      record("3", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 4 — SA no membership
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachConsole(page, "C4");
    try {
      await loginViaMagicLink(page, saNomember);
      await page.waitForTimeout(2500);
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      const url = page.url();
      const body = await page.locator("body").innerText();
      const myClubHome = /trang chủ clb|lịch sinh hoạt clb/i.test(body);
      const onDiscover = url.includes("/discover-clubs");
      const pass = onDiscover && !myClubHome;
      record("4", pass ? "PASS" : "FAIL", `url=${url}; myClubHome=${myClubHome}`);
    } catch (e) {
      record("4", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 6 — Nav highlight desktop/mobile (reuse case 1 pattern on discover)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    attachConsole(page, "C6");
    try {
      await loginViaMagicLink(page, playerNomember);
      await page.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: /menu/i }).first().click().catch(() => {});
      await page.waitForTimeout(800);
      const mobileHighlight = await isNavHighlighted(page, "Khám phá CLB");
      const pageErrors = consoleFindings.filter((x) => x.includes("pageerror"));
      record(
        "6",
        mobileHighlight && pageErrors.length === 0 ? "PASS" : mobileHighlight ? "PARTIAL" : "FAIL",
        `mobileHighlight=${mobileHighlight}; pageErrors=${pageErrors.length}`
      );
    } catch (e) {
      record("6", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  await browser.close();

  const fails = results.filter((r) => r.verdict === "FAIL").length;
  const partials = results.filter((r) => r.verdict === "PARTIAL").length;
  const verdict = fails > 0 ? "FAIL" : partials > 0 ? "PARTIAL" : "PASS";

  const report = {
    phase: "42J-FINAL-production",
    commit: COMMIT,
    productionUrl: DEPLOYMENT,
    deploymentId: process.env.PRODUCTION_DEPLOYMENT_ID || null,
    verdict,
    results,
    redirectTrace,
    consoleFindings,
    networkFindings,
    productionDeployed: true,
    phase42KStarted: false,
  };

  fs.mkdirSync(SCREEN_DIR, { recursive: true });
  fs.writeFileSync(path.join(SCREEN_DIR, "REPORT.json"), JSON.stringify(report, null, 2));

  console.log(`\nVerdict: ${verdict}`);
  console.log(`Report: ${path.join(SCREEN_DIR, "REPORT.json")}`);
  process.exit(fails > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
