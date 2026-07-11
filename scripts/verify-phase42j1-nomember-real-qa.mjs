/**
 * Phase 42J.1 — Real-account browser QA (no RPC mock).
 * Case 1: player.nomember@staging.local
 * Case 2: superadmin.nomember@staging.local
 *
 * Env (.env.staging-qa.local):
 *   STAGING_PLAYER_NOMEMBER_EMAIL (default player.nomember@staging.local)
 *   STAGING_PLAYER_NOMEMBER_PASSWORD
 *   STAGING_SUPERADMIN_NOMEMBER_EMAIL (default superadmin.nomember@staging.local)
 *   STAGING_SUPERADMIN_NOMEMBER_PASSWORD
 *   STAGING_PREVIEW_URL
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYMENT = getPhase15DeploymentUrl();
const SCREEN_DIR = path.join(rootDir, "docs", "v5", "qa-evidence", "phase42j1-nomember-real");

const results = [];
const redirectTrace = [];
const consoleFindings = [];
const networkFindings = [];

function record(caseId, verdict, evidence) {
  results.push({ case: caseId, verdict, evidence });
  console.log(`[${verdict}] ${caseId}: ${evidence}`);
}

async function loginViaForm(page, email, password) {
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "commit", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90000 });
}

/** Staging-only: real Supabase session via admin link + verifyOtp (not RPC mock). */
async function loginViaAdminMagicLink(page, email) {
  loadProjectEnv();
  const url = String(process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const anonKey = String(process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Missing Supabase URL/anon/service role for session bootstrap");
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
  await page.waitForTimeout(1500);
  if (page.url().includes("/login")) {
    throw new Error("Session injection did not establish auth");
  }
}

function trackRedirects(page, label) {
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      redirectTrace.push(`${label}: ${frame.url()}`);
    }
  });
}

function attachObservers(page, label) {
  let rpcCount = 0;
  page.on("request", (req) => {
    if (req.url().includes("club_get_my_active_membership")) {
      rpcCount += 1;
      if (rpcCount > 5) {
        networkFindings.push(`${label}: club_get_my_active_membership called ${rpcCount} times`);
      }
    }
  });
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

async function shot(page, name) {
  fs.mkdirSync(SCREEN_DIR, { recursive: true });
  const file = path.join(SCREEN_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function countPathHits(navLog, segment) {
  return navLog.filter((u) => u.includes(segment)).length;
}

async function isNavHighlighted(page, label) {
  const html = await page.content();
  const ariaCurrent = await page.locator(`a[aria-current="page"]`).allTextContents();
  const combined = `${html}\n${ariaCurrent.join(" ")}`;
  return new RegExp(label, "i").test(combined);
}

async function run() {
  loadProjectEnv();

  const playerEmail = String(
    process.env.STAGING_PLAYER_NOMEMBER_EMAIL || "player.nomember@staging.local"
  ).trim();
  const playerPassword = String(process.env.STAGING_PLAYER_NOMEMBER_PASSWORD || "").trim();
  const adminEmail = String(
    process.env.STAGING_SUPERADMIN_NOMEMBER_EMAIL || "superadmin.nomember@staging.local"
  ).trim();
  const adminPassword = String(process.env.STAGING_SUPERADMIN_NOMEMBER_PASSWORD || "").trim();
  const useMagicLink = String(process.env.STAGING_QA_USE_MAGIC_LINK || "").toLowerCase() === "true";
  const loginMode =
    playerPassword && adminPassword
      ? "form"
      : useMagicLink || Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
        ? "magiclink"
        : "none";

  console.log("\nPhase 42J.1 — Real nomember QA (no RPC mock)");
  console.log(`Preview: ${DEPLOYMENT}`);
  console.log(`Player:  ${playerEmail} (password ${playerPassword ? "set" : "MISSING"})`);
  console.log(`SA:      ${adminEmail} (password ${adminPassword ? "set" : "MISSING"})`);
  console.log(`Login:   ${loginMode}\n`);

  if (loginMode === "none") {
    record(
      "SETUP",
      "FAIL",
      "Missing nomember passwords and no SUPABASE_SERVICE_ROLE_KEY for magic-link login"
    );
    process.exit(1);
  }

  async function login(page, email, password) {
    if (loginMode === "form") {
      await loginViaForm(page, email, password);
      return "form";
    }
    await loginViaAdminMagicLink(page, email);
    return "magiclink";
  }

  const browser = await chromium.launch({ headless: true });

  // ── Case 1: PLAYER no membership ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C1");
    trackRedirects(page, "C1");
    const navLog = [];
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) navLog.push(f.url());
    });

    try {
      const loginMethod = await login(page, playerEmail, playerPassword);
      navLog.length = 0;
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((u) => u.pathname.includes("/discover-clubs"), { timeout: 30000 });
      await page.waitForTimeout(1500);

      const final = page.url();
      const body = await page.locator("body").innerText();
      const myClubHits = countPathHits(navLog, "/my-club");
      const discoverHits = countPathHits(navLog, "/discover-clubs");
      const pingPong = myClubHits > 1 && discoverHits > 1;
      const blankShell = body.trim().length < 40;
      const hasDiscoverTitle = /Khám phá CLB/i.test(body);
      const leaveBtn = await page.getByRole("button", { name: /rời câu lạc bộ/i }).count();
      const discoverHighlight = await isNavHighlighted(page, "Khám phá CLB");

      await shot(page, "case1-discover-final");

      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const backUrl = page.url();
      const backStuckOnMyClub =
        backUrl.includes("/my-club") && !backUrl.includes("/discover-clubs");
      if (backStuckOnMyClub) {
        await page.waitForURL((u) => u.pathname.includes("/discover-clubs"), { timeout: 10000 }).catch(() => {});
      }
      const backFinal = page.url();
      await page.goForward({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const fwdUrl = page.url();
      const loopBack = backFinal.includes("/my-club") && !backFinal.includes("/discover-clubs");

      const pass =
        final.includes("/discover-clubs") &&
        hasDiscoverTitle &&
        myClubHits <= 1 &&
        !pingPong &&
        !blankShell &&
        leaveBtn === 0 &&
        discoverHighlight &&
        !loopBack &&
        fwdUrl.includes("/discover-clubs");

      if (pass) {
        record(
          "1",
          "PASS",
          `PLAYER (${loginMethod}) → ${final}; myClubHits=${myClubHits}; highlight=Khám phá CLB; back/fwd OK; leave=${leaveBtn}`
        );
      } else {
        record(
          "1",
          "FAIL",
          `final=${final} title=${hasDiscoverTitle} myClubHits=${myClubHits} pingPong=${pingPong} blank=${blankShell} leave=${leaveBtn} highlight=${discoverHighlight} back=${backUrl} fwd=${fwdUrl}`
        );
      }
    } catch (e) {
      record("1", "FAIL", String(e.message || e));
      await shot(page, "case1-error");
    }
    await ctx.close();
  }

  // ── Case 2: SUPER_ADMIN no membership ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C2");
    trackRedirects(page, "C2");
    const navLog = [];
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) navLog.push(f.url());
    });

    try {
      const loginMethod = await login(page, adminEmail, adminPassword);
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4000);

      const final = page.url();
      const body = await page.locator("body").innerText();
      const myClubHomeContent =
        (await page.getByRole("heading", { name: /lịch sinh hoạt|thành viên clb/i }).count()) > 0 ||
        (await page.getByText(/trang chủ clb/i).count()) > 0;
      const leaveBtn = await page.getByRole("button", { name: /rời câu lạc bộ/i }).count();
      const onDiscover = final.includes("/discover-clubs");
      const onDashboard = final.includes("/dashboard");
      const redirectedAway = onDiscover || onDashboard;
      const pageErrors = consoleFindings.filter((x) => x.startsWith("C2 pageerror"));
      const rpcSpam = networkFindings.filter((x) => x.startsWith("C2"));

      await shot(page, "case2-sa-final");

      const pass =
        redirectedAway &&
        !myClubHomeContent &&
        leaveBtn === 0 &&
        pageErrors.length === 0 &&
        rpcSpam.length === 0;

      if (pass) {
        record(
          "2",
          "PASS",
          `SA (${loginMethod}) → ${final}; no my-club content; leave=${leaveBtn}; no pageerror; rpc ok`
        );
      } else if (onDiscover && !myClubHomeContent && leaveBtn === 0) {
        record("2", "PARTIAL", `SA → ${final}; blueprint ok; pageErrors=${pageErrors.length} rpc=${rpcSpam.length}`);
      } else {
        record(
          "2",
          "FAIL",
          `final=${final} myClubHome=${myClubHomeContent} leave=${leaveBtn} pageErrors=${pageErrors.length}`
        );
      }
    } catch (e) {
      record("2", "FAIL", String(e.message || e));
      await shot(page, "case2-error");
    }
    await ctx.close();
  }

  await browser.close();

  const fails = results.filter((r) => r.verdict === "FAIL").length;
  const partials = results.filter((r) => r.verdict === "PARTIAL").length;
  const verdict =
    fails > 0 ? "NO-GO" : partials > 0 ? "GO WITH CAVEATS" : "GO DEPLOY 42J.1";

  const report = {
    phase: "42J.1-nomember-real",
    previewUrl: DEPLOYMENT,
    verdict,
    results,
    redirectTrace,
    consoleFindings,
    networkFindings,
    screenshotsDir: SCREEN_DIR,
    loginMode,
    credentialsInEnv: {
      playerPassword: Boolean(playerPassword),
      adminPassword: Boolean(adminPassword),
    },
    productionDeployed: false,
  };

  fs.mkdirSync(SCREEN_DIR, { recursive: true });
  fs.writeFileSync(path.join(SCREEN_DIR, "REPORT.json"), JSON.stringify(report, null, 2));

  console.log("\n── Summary ──");
  for (const r of results) {
    console.log(`  ${r.verdict.padEnd(8)} Case ${r.case}: ${r.evidence}`);
  }
  console.log(`\nVerdict: ${verdict}`);
  console.log(`Screenshots: ${SCREEN_DIR}`);
  console.log(`Report: ${path.join(SCREEN_DIR, "REPORT.json")}`);
  console.log("Production: NOT deployed.\n");

  process.exit(fails > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
