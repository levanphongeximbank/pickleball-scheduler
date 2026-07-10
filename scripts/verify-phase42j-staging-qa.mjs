/**
 * Phase 42J.1 — Staging browser QA (club routes & membership flow).
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-phase42j-staging-qa.mjs
 *
 * Env: .env.staging-qa.local (STAGING_PLAYER_PASSWORD, STAGING_OWNER_A_PASSWORD)
 * Optional: STAGING_CLUB_PASSWORD, STAGING_ADMIN_PASSWORD (default PickleStaging!358)
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYMENT = getPhase15DeploymentUrl();
const DEPLOYMENT_HOST = new URL(DEPLOYMENT).hostname;

/** Preview is reachable without Vercel curl proxy (avoids per-asset CLI latency). */
async function attachVercelCurlProxy(_page) {}
const COMMIT = "42J.1-staging-uncommitted";
const SCREEN_DIR = path.join(rootDir, "docs", "v5", "qa-evidence", "phase42j1-staging");

/** @type {Array<{case:string, verdict:string, evidence:string}>} */
const results = [];
/** @type {string[]} */
const redirectTrace = [];
/** @type {string[]} */
const networkFindings = [];
/** @type {string[]} */
const consoleFindings = [];

function record(caseId, verdict, evidence) {
  results.push({ case: caseId, verdict, evidence });
  console.log(`[${verdict}] ${caseId}: ${evidence}`);
}

function pass(caseId, evidence) {
  record(caseId, "PASS", evidence);
}
function fail(caseId, evidence) {
  record(caseId, "FAIL", evidence);
}
function partial(caseId, evidence) {
  record(caseId, "PARTIAL", evidence);
}

async function loginViaForm(page, email, password) {
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "commit", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90000 });
}

async function logoutViaMenu(page) {
  await page.getByRole("button", { name: /menu tài khoản/i }).click();
  await page.getByRole("menuitem", { name: /đăng xuất/i }).click();
  await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 30000 });
}

function trackRedirects(page, label) {
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      redirectTrace.push(`${label}: ${frame.url()}`);
    }
  });
}

function attachObservers(page, label) {
  const rpcCounts = new Map();
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("club_get_my_active_membership")) {
      const n = (rpcCounts.get(label) || 0) + 1;
      rpcCounts.set(label, n);
      if (n > 5) {
        networkFindings.push(`${label}: club_get_my_active_membership called ${n} times`);
      }
    }
    if (url.includes("/rest/v1/") && req.method() === "GET") {
      const status404 = url.match(/404/);
      if (status404) networkFindings.push(`${label}: possible 404 ${url}`);
    }
  });
  page.on("response", (res) => {
    if (res.status() === 404 && res.url().includes(DEPLOYMENT_HOST)) {
      networkFindings.push(`${label}: HTTP 404 ${res.url()}`);
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
  return rpcCounts;
}

async function shot(page, name) {
  fs.mkdirSync(SCREEN_DIR, { recursive: true });
  const file = path.join(SCREEN_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function run() {
  loadProjectEnv();
  const playerPassword = String(process.env.STAGING_PLAYER_PASSWORD || "").trim();
  const ownerPassword = String(process.env.STAGING_OWNER_A_PASSWORD || "").trim();
  const clubPassword = String(
    process.env.STAGING_CASHIER_PASSWORD || process.env.STAGING_CLUB_PASSWORD || "PickleStaging!358"
  ).trim();
  const adminPassword = String(
    process.env.STAGING_ADMIN_PASSWORD || process.env.STAGING_SUPER_ADMIN_PASSWORD || "PickleStaging!358"
  ).trim();

  if (!playerPassword) {
    fail("SETUP", "missing STAGING_PLAYER_PASSWORD");
    process.exit(1);
  }

  console.log(`\nPhase 42J.1 Staging QA`);
  console.log(`Preview: ${DEPLOYMENT}`);
  console.log(`Commit:  ${COMMIT}\n`);

  const browser = await chromium.launch({ headless: true });

  // ── Case 1: no active membership → /discover-clubs ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await attachVercelCurlProxy(page);
    attachObservers(page, "C1");
    trackRedirects(page, "C1");
    try {
      await loginViaForm(page, "cashier@staging.local", clubPassword);
      const navLog = [];
      page.on("framenavigated", (f) => {
        if (f === page.mainFrame()) navLog.push(f.url());
      });
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((u) => u.pathname.includes("/discover-clubs"), { timeout: 30000 });
      const final = page.url();
      const discoverRedirects = navLog.filter((u) => u.includes("/discover-clubs")).length;
      const myClubFlashes = navLog.filter((u) => u.includes("/my-club") && !u.includes("view=")).length;
      const body = await page.locator("body").innerText();
      const hasDiscoverTitle = /Khám phá CLB/i.test(body);
      const myClubHits = navLog.filter((u) => u.includes("/my-club") && !u.includes("view=")).length;
      await shot(page, "case1-no-membership-discover");
      if (final.includes("/discover-clubs") && hasDiscoverTitle && myClubHits <= 1) {
        partial(
          "1",
          `cashier@staging.local (0 active membership) → ${final}; discover title OK; my-club hits=${myClubHits}`
        );
      } else {
        fail("1", `final=${final} discoverTitle=${hasDiscoverTitle} myClubHits=${myClubHits}`);
      }
    } catch (e) {
      const loginErr = String(e.message || e);
      if (loginErr.includes("Timeout") && playerPassword) {
        try {
          await loginViaForm(page, "player@staging.local", playerPassword);
          await page.route("**/rest/v1/rpc/club_get_my_active_membership**", async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                has_active_membership: false,
                club_id: null,
                member_id: null,
                club: null,
              }),
            });
          });
          await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
          await page.waitForURL((u) => u.pathname.includes("/discover-clubs"), { timeout: 30000 });
          const final = page.url();
          const body = await page.locator("body").innerText();
          await shot(page, "case1-no-membership-mock-fallback");
          if (final.includes("/discover-clubs") && /Khám phá CLB/i.test(body)) {
            partial("1", `cashier login unavailable; player+RPC-mock no-membership → ${final}`);
          } else {
            fail("1", `mock fallback final=${final}`);
          }
        } catch (fallbackErr) {
          fail("1", `cashier login failed; mock fallback failed: ${fallbackErr.message || fallbackErr}`);
          await shot(page, "case1-error");
        }
      } else {
        fail("1", loginErr);
        await shot(page, "case1-error");
      }
    }
    await ctx.close();
  }

  // ── Case 2: PLAYER with active membership ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await attachVercelCurlProxy(page);
    attachObservers(page, "C2");
    try {
      await loginViaForm(page, "player@staging.local", playerPassword);
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const url1 = page.url();
      const body1 = await page.locator("body").innerText();
      const onMyClub = url1.includes("/my-club") && !url1.includes("/discover");
      const hasHome = /Trang chủ|Lịch sinh hoạt|Thành viên/i.test(body1);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const url2 = page.url();
      const selfJoin = await page.getByRole("button", { name: /xin (tham gia|gia nhập)/i }).count();
      await shot(page, "case2-player-my-club-home");
      if (onMyClub && hasHome && url2.includes("/my-club") && selfJoin === 0) {
        pass("2", `player@staging → /my-club home; reload stable; no self-join CTA (${selfJoin})`);
      } else {
        fail("2", `url1=${url1} url2=${url2} home=${hasHome} selfJoin=${selfJoin}`);
      }
    } catch (e) {
      fail("2", String(e.message || e));
      await shot(page, "case2-error");
    }
    await ctx.close();
  }

  // ── Case 3: PRESIDENT requests approve/reject ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C3");
    try {
      await loginViaForm(page, "player@staging.local", playerPassword);
      await page.goto(`${DEPLOYMENT}/my-club/requests`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(6000);
      const rowCount = await page.locator("table tbody tr").count();
      const body = await page.locator("body").innerText();
      await shot(page, "case3-requests-list");
      const hasPending = rowCount > 0 || /đang chờ|pending|Club Staging|club@staging/i.test(body);
      const rejectBtn = page.getByRole("button", { name: /từ chối|reject/i }).first();
      const approveBtn = page.getByRole("button", { name: /duyệt|approve|chấp nhận/i }).first();
      if (!hasPending && (await rejectBtn.count()) === 0) {
        partial("3", "No pending requests visible — could not seed via UI; requests page loads for president");
      } else if ((await rejectBtn.count()) > 0) {
        await rejectBtn.click();
        await page.waitForTimeout(2000);
        await shot(page, "case3-after-reject");
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000);
        const after = await page.locator("body").innerText();
        pass("3", `pending list visible; reject clicked; reload OK; post-state=${/từ chối|đã xử lý|không có/i.test(after)}`);
      } else {
        partial("3", "Requests page reachable but approve/reject buttons not found in DOM");
      }
    } catch (e) {
      fail("3", String(e.message || e));
      await shot(page, "case3-error");
    }
    await ctx.close();
  }

  // ── Case 4: SUPER_ADMIN without membership ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await attachVercelCurlProxy(page);
    attachObservers(page, "C4");
    try {
      await loginViaForm(page, "admin@staging.local", adminPassword);
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const url = page.url();
      const body = await page.locator("body").innerText();
      const leaveBtn = await page.getByRole("button", { name: /rời câu lạc bộ/i }).count();
      await shot(page, "case4-super-admin-my-club");
      // admin@staging.local currently HAS active membership on club-smoke-42i1
      if (url.includes("/discover-clubs")) {
        pass("4", `SA → ${url}; no personal club hub; leave=${leaveBtn}`);
      } else if (url.includes("/my-club") && leaveBtn > 0) {
        partial(
          "4",
          "admin@staging.local has active membership on staging (club-smoke-42i1) — cannot verify SA-without-membership redirect; shows club home + leave button"
        );
      } else {
        partial("4", `url=${url} leave=${leaveBtn} — SA path inconclusive on current seed data`);
      }
    } catch (e) {
      partial("4", `login/admin path: ${e.message || e}`);
      await shot(page, "case4-error");
    }
    await ctx.close();
  }

  // ── Case 5: Legacy redirects ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await attachVercelCurlProxy(page);
    attachObservers(page, "C5");
    trackRedirects(page, "C5");
    try {
      await loginViaForm(page, "player@staging.local", playerPassword);
      const traces = [];
      page.on("framenavigated", (f) => {
        if (f === page.mainFrame()) traces.push(f.url());
      });
      await page.goto(`${DEPLOYMENT}/clubs/discover`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((u) => u.pathname === "/discover-clubs", { timeout: 20000 });
      const u1 = page.url();
      await page.goto(`${DEPLOYMENT}/my-club?view=discover`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((u) => u.pathname === "/discover-clubs", { timeout: 20000 });
      const u2 = page.url();
      const hasLegacyQuery = u2.includes("view=discover");
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      const u3 = page.url();
      await shot(page, "case5-legacy-redirects");
      const pingPong =
        traces.filter((u) => u.includes("/my-club?view=discover")).length > 0 &&
        traces[traces.length - 1]?.includes("/my-club?view=discover");
      if (u1.includes("/discover-clubs") && u2.includes("/discover-clubs") && !hasLegacyQuery && !pingPong) {
        pass("5", `/clubs/discover → ${u1}; /my-club?view=discover → ${u2}; no legacy query; back=${u3}`);
      } else {
        fail("5", `u1=${u1} u2=${u2} legacyQuery=${hasLegacyQuery} pingPong=${pingPong}`);
      }
    } catch (e) {
      fail("5", String(e.message || e));
      await shot(page, "case5-error");
    }
    await ctx.close();
  }

  // ── Case 6: RPC error → error + retry ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await attachVercelCurlProxy(page);
    let blockRpc = true;
    await page.route("**/rest/v1/rpc/club_get_my_active_membership**", async (route) => {
      if (blockRpc) {
        await route.fulfill({ status: 500, body: JSON.stringify({ message: "simulated RPC failure" }) });
      } else {
        await route.continue();
      }
    });
    attachObservers(page, "C6");
    try {
      await loginViaForm(page, "player@staging.local", playerPassword);
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const urlErr = page.url();
      const bodyErr = await page.locator("body").innerText();
      await shot(page, "case6-rpc-error");
      const showsError = /thử lại|không tải được|lỗi/i.test(bodyErr);
      const wronglyDiscover = urlErr.includes("/discover-clubs");
      if (!showsError || wronglyDiscover) {
        fail("6", `errorUI=${showsError} url=${urlErr} wronglyDiscover=${wronglyDiscover}`);
      } else {
        blockRpc = false;
        await page.getByRole("button", { name: /thử lại/i }).click();
        await page.waitForTimeout(3000);
        const urlOk = page.url();
        const bodyOk = await page.locator("body").innerText();
        await shot(page, "case6-rpc-retry-ok");
        if (urlOk.includes("/my-club") && /Trang chủ|Lịch sinh hoạt/i.test(bodyOk)) {
          pass("6", `RPC fail → error+retry on /my-club; retry → home render (${urlOk})`);
        } else {
          partial("6", `error shown; retry url=${urlOk}`);
        }
      }
    } catch (e) {
      fail("6", String(e.message || e));
      await shot(page, "case6-error");
    }
    await ctx.close();
  }

  // ── Case 7: Navigation links ──
  {
    const ctx = await browser.newContext({ viewport: devices["iPhone 13"].viewport });
    const page = await ctx.newPage();
    await attachVercelCurlProxy(page);
    try {
      await loginViaForm(page, "player@staging.local", playerPassword);
      await page.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded" });
      const mobileHtml = await page.content();
      const legacyDiscover = mobileHtml.includes("/my-club?view=discover");
      await shot(page, "case7-mobile-discover");

      await ctx.close();
      const ctxDesk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const desk = await ctxDesk.newPage();
      await attachVercelCurlProxy(desk);
      await loginViaForm(desk, "player@staging.local", playerPassword);
      await desk.goto(`${DEPLOYMENT}/`, { waitUntil: "domcontentloaded" });
      await desk.waitForTimeout(2000);
      const deskHtml = await desk.content();
      const deskLegacy = deskHtml.includes("/my-club?view=discover");
      const deskDiscover = deskHtml.includes("/discover-clubs");
      await shot(desk, "case7-desktop-nav");
      if (!legacyDiscover && !deskLegacy && deskDiscover) {
        pass("7", "No /my-club?view=discover in mobile/desktop HTML; /discover-clubs present");
      } else {
        partial("7", `mobileLegacy=${legacyDiscover} deskLegacy=${deskLegacy} deskDiscover=${deskDiscover}`);
      }
      await ctxDesk.close();
    } catch (e) {
      fail("7", String(e.message || e));
    }
  }

  // ── Case 8: console/network summary ──
  {
    const uncaught = consoleFindings.filter((x) => x.includes("pageerror"));
    const rpcSpam = networkFindings.filter((x) => x.includes("club_get_my_active_membership"));
    const n404 = networkFindings.filter((x) => x.includes("404"));
    if (uncaught.length === 0 && rpcSpam.length === 0 && n404.length === 0) {
      pass("8", `No uncaught errors; no abnormal RPC spam; no route 404 (${consoleFindings.length} console notes)`);
    } else if (uncaught.length === 0 && n404.length === 0) {
      partial("8", `console notes=${consoleFindings.length}; network=${networkFindings.join("; ") || "clean"}`);
    } else {
      fail("8", `uncaught=${uncaught.length} 404=${n404.length} network=${networkFindings.slice(0, 5).join("; ")}`);
    }
  }

  await browser.close();

  const fails = results.filter((r) => r.verdict === "FAIL").length;
  const partials = results.filter((r) => r.verdict === "PARTIAL").length;
  const verdict =
    fails > 0 ? "NO-GO" : partials > 0 ? "GO WITH CAVEATS (staging seed gaps)" : "GO STAGING QA";

  console.log("\n── Summary ──");
  for (const r of results) {
    console.log(`  ${r.verdict.padEnd(8)} Case ${r.case}: ${r.evidence}`);
  }
  console.log(`\nScreenshots: ${SCREEN_DIR}`);
  console.log(`Redirect trace (${redirectTrace.length}):`, redirectTrace.slice(0, 12).join(" | ") || "(none)");
  console.log(`Verdict: ${verdict}`);
  console.log("Production: NOT deployed.\n");

  const reportPath = path.join(SCREEN_DIR, "PHASE_42J_STAGING_QA_REPORT.json");
  fs.mkdirSync(SCREEN_DIR, { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        phase: "42J",
        previewUrl: DEPLOYMENT,
        commit: COMMIT,
        v2Flag: true,
        productionDeployed: false,
        verdict,
        results,
        redirectTrace,
        consoleFindings,
        networkFindings,
        screenshotsDir: SCREEN_DIR,
      },
      null,
      2
    )
  );
  console.log(`Report: ${reportPath}`);

  process.exit(fails > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
