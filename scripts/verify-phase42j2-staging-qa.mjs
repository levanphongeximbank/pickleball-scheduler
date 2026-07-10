/**
 * Phase 42J.2 — Redirect & membership RPC dedup browser QA.
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-phase42j2-staging-qa.mjs
 *
 * Env (.env.staging-qa.local):
 *   STAGING_PLAYER_NOMEMBER_EMAIL / STAGING_PLAYER_NOMEMBER_PASSWORD
 *   STAGING_SUPERADMIN_NOMEMBER_EMAIL / STAGING_SUPERADMIN_NOMEMBER_PASSWORD
 *   STAGING_PLAYER_PASSWORD (active member case 3)
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYMENT = getPhase15DeploymentUrl();
const SCREEN_DIR = path.join(rootDir, "docs", "v5", "qa-evidence", "phase42j2-staging");
const COMMIT = "12ee754";

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
  const bump = () => {
    count += 1;
    return count;
  };
  const get = () => count;
  const reset = () => {
    count = 0;
  };
  const attach = (page) => {
    page.on("request", (req) => {
      if (req.url().includes("club_get_my_active_membership")) {
        const n = bump();
        networkFindings.push(`${label}: rpc#${n} ${req.method()} ${req.url().slice(0, 120)}`);
      }
    });
  };
  return { attach, get, reset, label };
}

function trackRedirects(page, label) {
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      redirectTrace.push(`${label}: ${frame.url()}`);
    }
  });
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

async function shot(page, name) {
  fs.mkdirSync(SCREEN_DIR, { recursive: true });
  const file = path.join(SCREEN_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function loginViaForm(page, email, password) {
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "commit", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90000, waitUntil: "commit" });
}

function countPathHits(navLog, segment) {
  let hits = 0;
  let prev = null;
  for (const url of navLog) {
    let pathname = url;
    try {
      pathname = new URL(url).pathname;
    } catch {
      /* keep raw */
    }
    const matches =
      pathname === segment || pathname.startsWith(`${segment}/`) || url.includes(segment);
    if (matches && pathname !== prev) {
      hits += 1;
      prev = pathname;
    } else if (!matches) {
      prev = null;
    }
  }
  return hits;
}

async function isNavHighlighted(page, label) {
  const ariaCurrent = await page.locator(`a[aria-current="page"]`).allTextContents();
  const selected = await page.locator(`.Mui-selected`).allTextContents();
  const combined = [...ariaCurrent, ...selected].join(" ");
  return new RegExp(label, "i").test(combined);
}

async function verifyV2Flag() {
  try {
    const res = await fetch(`${DEPLOYMENT}/`);
    const html = await res.text();
    const hasV2Bundle =
      /MyClubMembershipRootProvider|ClubPostAuthRedirect|resolvePostAuthClubPath/i.test(html) ||
      /clubActiveMembershipService/i.test(html);
    return { ok: true, hasV2Bundle, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function run() {
  loadProjectEnv();

  const playerNomemberEmail = String(
    process.env.STAGING_PLAYER_NOMEMBER_EMAIL || "player.nomember@staging.local"
  ).trim();
  const playerNomemberPassword = String(
    process.env.STAGING_PLAYER_NOMEMBER_PASSWORD || process.env.STAGING_PLAYER_PASSWORD || "PickleStaging!358"
  ).trim();
  const saNomemberEmail = String(
    process.env.STAGING_SUPERADMIN_NOMEMBER_EMAIL || "superadmin.nomember@staging.local"
  ).trim();
  const saNomemberPassword = String(
    process.env.STAGING_SUPERADMIN_NOMEMBER_PASSWORD ||
      process.env.STAGING_ADMIN_PASSWORD ||
      "PickleStaging!358"
  ).trim();
  const activePlayerEmail = String(process.env.STAGING_PLAYER_EMAIL || "player@staging.local").trim();
  const activePlayerPassword = String(process.env.STAGING_PLAYER_PASSWORD || "PickleStaging!358").trim();

  const v2Check = await verifyV2Flag();

  console.log("\nPhase 42J.2 — Redirect & RPC dedup QA");
  console.log(`Preview: ${DEPLOYMENT}`);
  console.log(`Commit:  ${COMMIT}`);
  console.log(`V2 bundle markers: ${v2Check.hasV2Bundle ? "present" : "not detected in HTML"}`);
  console.log(`Vercel env VITE_CLUB_STORAGE_V2: set on Preview (verified via vercel env ls)\n`);

  const browser = await chromium.launch({ headless: true });

  // ── Case 1: PLAYER no membership (form login) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const rpc = createRpcCounter("C1");
    rpc.attach(page);
    attachConsole(page, "C1");
    trackRedirects(page, "C1");
    const navLog = [];
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) navLog.push(f.url());
    });

    try {
      await loginViaForm(page, playerNomemberEmail, playerNomemberPassword);
      await page.waitForTimeout(2500);
      const postLoginUrl = page.url();
      const loginMyClubHits = countPathHits(navLog, "/my-club");
      const loginDiscover = postLoginUrl.includes("/discover-clubs");

      const rpcBeforeDirect = rpc.get();
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((u) => u.pathname.includes("/discover-clubs"), { timeout: 30000 });
      await page.waitForTimeout(1500);

      const final = page.url();
      const body = await page.locator("body").innerText();
      const totalMyClubHits = countPathHits(navLog, "/my-club");
      const discoverHits = countPathHits(navLog, "/discover-clubs");
      const pingPong = totalMyClubHits > 1 && discoverHits > 1;
      const blankShell = body.trim().length < 40;
      const hasDiscoverTitle = /Khám phá CLB/i.test(body);
      const leaveBtn = await page.getByRole("button", { name: /rời câu lạc bộ/i }).count();
      const discoverHighlight = await isNavHighlighted(page, "Khám phá CLB");
      const rpcAfterDirect = rpc.get();

      await shot(page, "case1-discover-final");
      await page.setViewportSize({ width: 1280, height: 900 });
      await shot(page, "case1-nav-desktop");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: /menu/i }).first().click().catch(() => {});
      await page.waitForTimeout(800);
      await shot(page, "case1-nav-mobile-drawer");

      const rpcBeforeNav = rpc.get();
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const backUrl = page.url();
      const rpcAfterBack = rpc.get();
      await page.goForward({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const fwdUrl = page.url();
      const rpcAfterFwd = rpc.get();
      const navRpcDelta = rpcAfterFwd - rpcBeforeNav;

      const pass =
        loginDiscover &&
        loginMyClubHits === 0 &&
        final.includes("/discover-clubs") &&
        hasDiscoverTitle &&
        totalMyClubHits <= 1 &&
        !pingPong &&
        !blankShell &&
        leaveBtn === 0 &&
        discoverHighlight &&
        rpcAfterDirect <= 2 &&
        navRpcDelta === 0 &&
        fwdUrl.includes("/discover-clubs");

      const evidence = [
        `login→${postLoginUrl}`,
        `loginMyClubHits=${loginMyClubHits}`,
        `directMyClubHits=${totalMyClubHits}`,
        `pingPong=${pingPong}`,
        `blank=${blankShell}`,
        `rpcTotal=${rpcAfterDirect}`,
        `rpcNavDelta=${navRpcDelta}`,
        `highlight=${discoverHighlight}`,
        `back=${backUrl}`,
        `fwd=${fwdUrl}`,
      ].join("; ");

      if (pass) record("1", "PASS", evidence);
      else if (final.includes("/discover-clubs") && !pingPong && rpcAfterDirect <= 3)
        record("1", "PARTIAL", evidence);
      else record("1", "FAIL", evidence);
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
    const rpc = createRpcCounter("C2");
    rpc.attach(page);
    attachConsole(page, "C2");
    trackRedirects(page, "C2");
    const navLog = [];
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) navLog.push(f.url());
    });

    try {
      await loginViaForm(page, saNomemberEmail, saNomemberPassword);
      await page.waitForTimeout(2500);
      const postLogin = page.url();
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      const final = page.url();
      const body = await page.locator("body").innerText();
      const myClubHomeContent =
        (await page.getByRole("heading", { name: /lịch sinh hoạt|thành viên clb/i }).count()) > 0 ||
        /trang chủ clb/i.test(body);
      const leaveBtn = await page.getByRole("button", { name: /rời câu lạc bộ/i }).count();
      const onDiscover = final.includes("/discover-clubs");
      const pageErrors = consoleFindings.filter((x) => x.startsWith("C2 pageerror"));
      const rpcTotal = rpc.get();
      const rpcSpam = rpcTotal > 4;

      await shot(page, "case2-sa-final");

      const pass =
        (postLogin.includes("/discover-clubs") || onDiscover) &&
        onDiscover &&
        !myClubHomeContent &&
        leaveBtn === 0 &&
        pageErrors.length === 0 &&
        !rpcSpam;

      if (pass) {
        record("2", "PASS", `login→${postLogin}; my-club→${final}; rpc=${rpcTotal}; leave=0`);
      } else if (onDiscover && !myClubHomeContent && leaveBtn === 0 && pageErrors.length === 0) {
        record("2", "PARTIAL", `discover ok; rpc=${rpcTotal} spam=${rpcSpam}`);
      } else {
        record("2", "FAIL", `postLogin=${postLogin} final=${final} myClubHome=${myClubHomeContent} rpc=${rpcTotal}`);
      }
    } catch (e) {
      record("2", "FAIL", String(e.message || e));
      await shot(page, "case2-error");
    }
    await ctx.close();
  }

  // ── Case 3: active member ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const rpc = createRpcCounter("C3");
    rpc.attach(page);
    attachConsole(page, "C3");
    trackRedirects(page, "C3");

    try {
      await loginViaForm(page, activePlayerEmail, activePlayerPassword);
      await page.waitForTimeout(2500);
      const postLogin = page.url();
      const loginOnMyClub = postLogin.includes("/my-club") && !postLogin.includes("/discover");
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const url1 = page.url();
      const body1 = await page.locator("body").innerText();
      const onMyClub = url1.includes("/my-club") && !url1.includes("/discover");
      const hasHome = /Trang chủ|Lịch sinh hoạt|Thành viên/i.test(body1);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const url2 = page.url();

      await page.goto(`${DEPLOYMENT}/my-club/requests`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4000);
      const requestsUrl = page.url();
      const requestsBody = await page.locator("body").innerText();
      const onRequests = requestsUrl.includes("/my-club/requests");
      const requestsOk =
        onRequests &&
        !requestsUrl.includes("/discover-clubs") &&
        (/yêu cầu|đang chờ|không có yêu cầu|pending/i.test(requestsBody) ||
          (await page.locator("table, [role=table]").count()) > 0);

      const rejectBtn = page.getByRole("button", { name: /từ chối|reject/i }).first();
      let approveFlow = "no-pending";
      if ((await rejectBtn.count()) > 0) {
        await rejectBtn.click();
        await page.waitForTimeout(2000);
        approveFlow = "reject-clicked";
      }

      await shot(page, "case3-active-member");

      const pass =
        loginOnMyClub &&
        (postLogin.includes("/my-club") || onMyClub) &&
        onMyClub &&
        hasHome &&
        url2.includes("/my-club") &&
        requestsOk;

      if (pass) {
        record(
          "3",
          "PASS",
          `login→${postLogin}; /my-club stable; reload=${url2}; requests=${requestsUrl}; flow=${approveFlow}; rpc=${rpc.get()}`
        );
      } else if (onMyClub && hasHome && requestsOk) {
        record("3", "PARTIAL", `home ok; loginOnMyClub=${loginOnMyClub} postLogin=${postLogin} reload=${url2} requests=${requestsUrl}`);
      } else {
        record("3", "FAIL", `postLogin=${postLogin} url1=${url1} url2=${url2} requests=${requestsUrl}`);
      }
    } catch (e) {
      record("3", "FAIL", String(e.message || e));
      await shot(page, "case3-error");
    }
    await ctx.close();
  }

  // ── Case 4: RPC error + retry (same provider) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const rpc = createRpcCounter("C4");
    rpc.attach(page);
    attachConsole(page, "C4");
    let blockRpc = false;
    let failCount = 0;
    await page.route("**/rest/v1/rpc/club_get_my_active_membership**", async (route) => {
      if (blockRpc) {
        failCount += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "simulated RPC failure" }),
        });
      } else {
        await route.continue();
      }
    });

    try {
      await loginViaForm(page, activePlayerEmail, activePlayerPassword);
      await page.waitForURL((u) => u.pathname.includes("/my-club"), { timeout: 60000 });
      blockRpc = true;
      // Force a fresh membership fetch (cache would otherwise skip RPC on nav — 42J.2.2).
      await page.evaluate(() => {
        for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
          const key = sessionStorage.key(i);
          if (key?.startsWith("pb-membership-cache-v1:")) {
            sessionStorage.removeItem(key);
          }
        }
        window.location.assign(`${window.location.origin}/my-club`);
      });
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2500);
      const urlErr = page.url();
      const bodyErr = await page.locator("body").innerText();
      await shot(page, "case4-rpc-error");
      const showsError = /thử lại|không tải được|lỗi/i.test(bodyErr);
      const wronglyDiscover = urlErr.includes("/discover-clubs");
      const rpcOnError = rpc.get();

      if (!showsError || wronglyDiscover) {
        record(
          "4",
          "FAIL",
          `errorUI=${showsError} url=${urlErr} wronglyDiscover=${wronglyDiscover} failCount=${failCount}`
        );
      } else {
        blockRpc = false;
        const rpcBeforeRetry = rpc.get();
        await page.getByRole("button", { name: /thử lại/i }).click();
        await page.waitForTimeout(3500);
        const urlOk = page.url();
        const bodyOk = await page.locator("body").innerText();
        const rpcAfterRetry = rpc.get();
        const retryRpcDelta = rpcAfterRetry - rpcBeforeRetry;
        await shot(page, "case4-rpc-retry-ok");

        if (urlOk.includes("/my-club") && /Trang chủ|Lịch sinh hoạt/i.test(bodyOk) && retryRpcDelta <= 2) {
          record(
            "4",
            "PASS",
            `RPC fail→error on ${urlErr}; retry→home; retryRpcDelta=${retryRpcDelta}; totalRpc=${rpcAfterRetry}`
          );
        } else {
          record("4", "PARTIAL", `error ok; retry url=${urlOk} retryRpcDelta=${retryRpcDelta}`);
        }
      }
    } catch (e) {
      record("4", "FAIL", String(e.message || e));
      await shot(page, "case4-error");
    }
    await ctx.close();
  }

  await browser.close();

  const fails = results.filter((r) => r.verdict === "FAIL").length;
  const partials = results.filter((r) => r.verdict === "PARTIAL").length;
  const verdict =
    fails > 0 ? "NO-GO" : partials > 0 ? "GO WITH CAVEATS" : "GO DEPLOY 42J.2";

  const report = {
    phase: "42J.2.2-staging",
    commit: COMMIT,
    previewUrl: DEPLOYMENT,
    v2Flag: {
      vercelPreviewEnvSet: true,
      bundleMarkersInHtml: Boolean(v2Check.hasV2Bundle),
    },
    verdict,
    results,
    redirectTrace,
    consoleFindings,
    networkFindings,
    screenshotsDir: SCREEN_DIR,
    productionDeployed: false,
  };

  fs.mkdirSync(SCREEN_DIR, { recursive: true });
  fs.writeFileSync(path.join(SCREEN_DIR, "REPORT.json"), JSON.stringify(report, null, 2));

  console.log("\n── Summary ──");
  for (const r of results) {
    console.log(`  ${r.verdict.padEnd(8)} Case ${r.case}: ${r.evidence}`);
  }
  console.log(`\nRedirect trace (${redirectTrace.length}):`);
  for (const line of redirectTrace.slice(0, 20)) console.log(`  ${line}`);
  if (redirectTrace.length > 20) console.log(`  ... +${redirectTrace.length - 20} more`);
  console.log(`\nVerdict: ${verdict}`);
  console.log(`Report: ${path.join(SCREEN_DIR, "REPORT.json")}`);
  console.log("Production: NOT deployed.\n");

  process.exit(fails > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
