/**
 * Phase 42K — Cloud club registry read model browser QA.
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-phase42k-staging-qa.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYMENT = getPhase15DeploymentUrl();
const SCREEN_DIR = path.join(rootDir, "docs", "v5", "qa-evidence", "phase42k-staging");
const COMMIT = "c2f1694";
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const CLUB_A = "club-smoke-42i1";
const CLUB_B = "club-staging-b";

const results = [];
const rpcFindings = [];
const consoleFindings = [];
const cacheFindings = [];

function record(caseId, verdict, evidence) {
  results.push({ case: caseId, verdict, evidence });
  console.log(`[${verdict}] ${caseId}: ${evidence}`);
}

function attachRpc(page, label) {
  const counts = { registry: 0, discover: 0, other: 0 };
  page.on("request", (req) => {
    const url = req.url();
    if (!url.includes("/rest/v1/rpc/")) return;
    if (url.includes("club_list_registry")) {
      counts.registry += 1;
      rpcFindings.push(`${label}: club_list_registry #${counts.registry}`);
    } else if (url.includes("club_list_discoverable")) {
      counts.discover += 1;
      rpcFindings.push(`${label}: club_list_discoverable #${counts.discover}`);
    }
  });
  return counts;
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
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 90000,
    waitUntil: "domcontentloaded",
  });
}

async function clearTenantSession(page) {
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => {
    localStorage.removeItem("pickleball-active-tenant-v1");
  });
}

async function selectTenant(page, tenantId) {
  await page.evaluate((tid) => {
    localStorage.setItem("pickleball-active-tenant-v1", String(tid));
  }, tenantId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
}

async function getSupabaseAccessToken(page) {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.includes("auth-token")) continue;
      try {
        const raw = localStorage.getItem(key);
        const parsed = JSON.parse(raw);
        const token = parsed?.access_token || parsed?.currentSession?.access_token;
        if (token) return token;
      } catch {
        /* next */
      }
    }
    return null;
  });
}

function bodyHasClub(body, clubName) {
  return new RegExp(clubName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(body);
}

async function readManageClubs(page) {
  await page.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  const hasSkeleton = (await page.locator(".MuiSkeleton-root").count()) > 0;
  const hasError = /không thể tải|lỗi|thử lại/i.test(body);
  const pickTenant = /chọn tenant/i.test(body);
  return { body, url: page.url(), hasSkeleton, hasError, pickTenant };
}

async function run() {
  loadProjectEnv();

  const saEmail = String(
    process.env.STAGING_SUPERADMIN_NOMEMBER_EMAIL || "superadmin.nomember@staging.local"
  ).trim();
  const tenantStaffAEmail = String(
    process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local"
  ).trim();
  const tenantStaffBEmail = String(process.env.STAGING_OWNER_B_EMAIL || "owner-b@staging.local").trim();
  const playerDiscoverEmail = String(
    process.env.STAGING_PLAYER_NOMEMBER_EMAIL || "player.nomember@staging.local"
  ).trim();
  const nomemberPassword = String(
    process.env.STAGING_PLAYER_NOMEMBER_PASSWORD || "PickleStaging!358"
  ).trim();
  const saPassword = String(
    process.env.STAGING_SUPERADMIN_NOMEMBER_PASSWORD || nomemberPassword
  ).trim();
  const ownerAPassword = String(process.env.STAGING_OWNER_A_PASSWORD || nomemberPassword).trim();
  const ownerBPassword = String(process.env.STAGING_OWNER_B_PASSWORD || nomemberPassword).trim();

  function passwordFor(email) {
    if (email === saEmail) return saPassword;
    if (email === playerDiscoverEmail) return nomemberPassword;
    if (email === tenantStaffAEmail && tenantStaffAEmail !== saEmail) return ownerAPassword;
    if (email === tenantStaffBEmail && tenantStaffBEmail !== saEmail) return ownerBPassword;
    return nomemberPassword;
  }

  console.log("\nPhase 42K — Cloud club registry QA");
  console.log(`Preview: ${DEPLOYMENT}`);
  console.log(`Commit:  ${COMMIT}`);
  console.log(`Tenant A: ${TENANT_A} | Tenant B: ${TENANT_B}\n`);

  const browser = await chromium.launch({ headless: true });

  // ── Case A: Tenant A registry scope ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const rpc = attachRpc(page, "A");
    attachConsole(page, "A");
    try {
      const usedSaProxy = tenantStaffAEmail === saEmail;
      await loginViaForm(page, tenantStaffAEmail, passwordFor(tenantStaffAEmail));
      if (usedSaProxy) {
        await selectTenant(page, TENANT_A);
      }
      let view = await readManageClubs(page);
      const hasA = bodyHasClub(view.body, "CLB Smoke 42I1");
      const hasB = bodyHasClub(view.body, "CLB Staging B");
      const bannerOk = view.body.includes(TENANT_A) || /Venue Staging A/i.test(view.body);

      await page.getByLabel(/tìm theo tên/i).fill("smoke");
      await page.waitForTimeout(600);
      const searchBody = await page.locator("body").innerText();
      const searchOk = /CLB Smoke 42I1/i.test(searchBody);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const reloadBody = await page.locator("body").innerText();
      const reloadOk = bodyHasClub(reloadBody, "CLB Smoke 42I1") && !bodyHasClub(reloadBody, "CLB Staging B");

      await shot(page, "case-a-manage-clubs");

      const pass = hasA && !hasB && bannerOk && searchOk && reloadOk && !view.hasError;
      record(
        "A",
        pass ? (usedSaProxy ? "PARTIAL" : "PASS") : hasA && !hasB ? "PARTIAL" : "FAIL",
        `saProxy=${usedSaProxy} hasA=${hasA} hasB=${hasB} banner=${bannerOk} search=${searchOk} reload=${reloadOk} rpcRegistry=${rpc.registry}`
      );
    } catch (e) {
      record("A", "FAIL", String(e.message || e));
      await shot(page, "case-a-error");
    }
    await ctx.close();
  }

  // ── Case B: Tenant B (owner-b; fallback SA + tenant B if login blocked) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachRpc(page, "B");
    attachConsole(page, "B");
    try {
      let usedFallback = tenantStaffBEmail === saEmail;
      try {
        await loginViaForm(page, tenantStaffBEmail, passwordFor(tenantStaffBEmail));
      } catch {
        usedFallback = true;
        await loginViaForm(page, saEmail, saPassword);
      }
      if (usedFallback || tenantStaffBEmail === saEmail) {
        await selectTenant(page, TENANT_B);
      }
      const view = await readManageClubs(page);
      const hasB = bodyHasClub(view.body, "CLB Staging B");
      const hasA = bodyHasClub(view.body, "CLB Smoke 42I1");
      const bannerOk = view.body.includes(TENANT_B) || /Venue Staging B/i.test(view.body);

      // Direct RPC probe with tenant A id (should not leak in UI)
      const token = await getSupabaseAccessToken(page);
      const probe = await page.evaluate(
        async ({ supabaseUrl, anonKey, tenantA, accessToken }) => {
          if (!supabaseUrl || !anonKey || !accessToken) {
            return { status: 0, json: { code: "NO_TOKEN" } };
          }
          const res = await fetch(`${supabaseUrl}/rest/v1/rpc/club_list_registry`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ p_tenant_id: tenantA, p_include_inactive: false }),
          });
          const json = await res.json().catch(() => ({}));
          return { status: res.status, json };
        },
        {
          supabaseUrl: process.env.VITE_SUPABASE_URL || "",
          anonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
          tenantA: TENANT_A,
          accessToken: token,
        }
      );

      await shot(page, "case-b-manage-clubs");

      const rpcBlocked =
        probe.json?.ok === false ||
        probe.json?.code === "FORBIDDEN" ||
        (Array.isArray(probe.json?.data) && probe.json.data.length === 0) ||
        probe.status === 401 ||
        probe.status === 403;

      const pass = hasB && !hasA && bannerOk && rpcBlocked;
      record(
        "B",
        pass ? (usedFallback ? "PARTIAL" : "PASS") : hasB && !hasA ? "PARTIAL" : "FAIL",
        `fallback=${usedFallback} hasB=${hasB} hasA=${hasA} banner=${bannerOk} crossTenantRpc=${JSON.stringify(probe.json?.code || probe.status)}`
      );
    } catch (e) {
      record("B", "FAIL", String(e.message || e));
      await shot(page, "case-b-error");
    }
    await ctx.close();
  }

  // ── Case C: Super Admin tenant picker + platform registry ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const rpc = attachRpc(page, "C");
    attachConsole(page, "C");
    try {
      await loginViaForm(page, saEmail, saPassword);
      await clearTenantSession(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      const pre = await readManageClubs(page);
      const noAutoPick = pre.pickTenant || /chọn tenant/i.test(pre.body);

      await selectTenant(page, TENANT_A);
      const viewA = await readManageClubs(page);
      const aOnly = bodyHasClub(viewA.body, "CLB Smoke 42I1") && !bodyHasClub(viewA.body, "CLB Staging B");
      const rpcAfterA = rpc.registry;

      await selectTenant(page, TENANT_B);
      const viewB = await readManageClubs(page);
      const bOnly = bodyHasClub(viewB.body, "CLB Staging B") && !bodyHasClub(viewB.body, "CLB Smoke 42I1");
      cacheFindings.push(`C: after switch B, tenant A club visible=${bodyHasClub(viewB.body, "CLB Smoke 42I1")}`);

      await page.goto(`${DEPLOYMENT}/platform/clubs`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const platBody = await page.locator("body").innerText();
      const crossTenant = bodyHasClub(platBody, "CLB Smoke 42I1") && bodyHasClub(platBody, "CLB Staging B");
      const platformTitle = /Sổ đăng ký CLB \(Platform\)/i.test(platBody);

      await page.getByLabel(/tenant/i).first().click().catch(() => {});
      await page.getByRole("option", { name: new RegExp(TENANT_A, "i") }).click().catch(() => {});
      await page.waitForTimeout(800);

      await shot(page, "case-c-platform-clubs");

      const pass = noAutoPick && aOnly && bOnly && crossTenant && platformTitle;
      record(
        "C",
        pass ? "PASS" : aOnly && bOnly && crossTenant ? "PARTIAL" : "FAIL",
        `noAutoPick=${noAutoPick} aOnly=${aOnly} bOnly=${bOnly} crossTenant=${crossTenant} rpcRegistry=${rpcAfterA}→${rpc.registry}`
      );
    } catch (e) {
      record("C", "FAIL", String(e.message || e));
      await shot(page, "case-c-error");
    }
    await ctx.close();
  }

  // ── Case D: Discover regression ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const rpc = attachRpc(page, "D");
    attachConsole(page, "D");
    try {
      await loginViaForm(page, playerDiscoverEmail, passwordFor(playerDiscoverEmail));
      await page.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const body = await page.locator("body").innerText();
      const discoverOk = /Khám phá CLB/i.test(body);
      const hasClub = /CLB Smoke 42I1|Smoke 42I1/i.test(body);
      const usedDiscoverRpc = rpc.discover >= 1;

      const joinBtn = page.getByRole("button", { name: /xin tham gia|gửi yêu cầu|tham gia/i }).first();
      const joinVisible = (await joinBtn.count()) > 0;

      await shot(page, "case-d-discover");

      const pass = discoverOk && hasClub && usedDiscoverRpc && joinVisible;
      record(
        "D",
        pass ? "PASS" : discoverOk && usedDiscoverRpc ? "PARTIAL" : "FAIL",
        `discover=${discoverOk} club=${hasClub} rpcDiscover=${rpc.discover} joinBtn=${joinVisible}`
      );
    } catch (e) {
      record("D", "FAIL", String(e.message || e));
      await shot(page, "case-d-error");
    }
    await ctx.close();
  }

  // ── Case E: Cache invalidation on tenant switch ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachRpc(page, "E");
    attachConsole(page, "E");
    try {
      await loginViaForm(page, saEmail, saPassword);
      await clearTenantSession(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await selectTenant(page, TENANT_A);
      await readManageClubs(page);
      await selectTenant(page, TENANT_B);
      const after = await readManageClubs(page);
      const isolated = bodyHasClub(after.body, "CLB Staging B") && !bodyHasClub(after.body, "CLB Smoke 42I1");

      record(
        "E",
        isolated ? "PARTIAL" : "FAIL",
        `tenantSwitchIsolation=${isolated} (create/approve/owner label not automated in staging QA)`
      );
    } catch (e) {
      record("E", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // ── Case F: Failure states ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachConsole(page, "F");
    try {
      await loginViaForm(page, saEmail, saPassword);
      await clearTenantSession(page);
      await page.reload({ waitUntil: "domcontentloaded" });

      const noTenant = await readManageClubs(page);
      const noRpcWrong = noTenant.pickTenant;

      await selectTenant(page, TENANT_A);
      await page.route("**/rest/v1/rpc/club_list_registry", (route) =>
        route.fulfill({ status: 500, body: JSON.stringify({ message: "simulated fail" }) })
      );
      await page.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const failBody = await page.locator("body").innerText();
      const hasRetry = /thử lại/i.test(failBody);
      const hasError = /lỗi|không thể/i.test(failBody);
      const blank = failBody.trim().length < 30;
      const pageErrors = consoleFindings.filter((x) => x.startsWith("F pageerror"));

      await shot(page, "case-f-rpc-fail");

      const pass = noRpcWrong && hasRetry && hasError && !blank && pageErrors.length === 0;
      record(
        "F",
        pass ? "PASS" : hasRetry && !blank ? "PARTIAL" : "FAIL",
        `noTenantGuard=${noRpcWrong} retry=${hasRetry} error=${hasError} blank=${blank} pageErrors=${pageErrors.length}`
      );
    } catch (e) {
      record("F", "FAIL", String(e.message || e));
      await shot(page, "case-f-error");
    }
    await ctx.close();
  }

  await browser.close();

  const report = {
    phase: "42K",
    commit: COMMIT,
    preview: DEPLOYMENT,
    tenants: { A: TENANT_A, B: TENANT_B },
    clubs: { A: CLUB_A, B: CLUB_B },
    viteClubStorageV2: true,
    productionDeployed: false,
    rollbackProduction: "dpl_9XNP4G8cK7wVe7DcTLomJXjrfC2u (v5.3.32)",
    rollbackPreview: "dpl_BudkjgWHknuPjuYSN4NVz5PpmCM6",
    results,
    rpcFindings: rpcFindings.slice(0, 40),
    cacheFindings,
    consoleFindings: consoleFindings.slice(0, 30),
    routes: {
      manageClubs: "club_list_registry (tenant scope)",
      platformClubs: "club_list_registry (platform scope)",
      discoverClubs: "club_list_discoverable",
    },
    verdict:
      results.every((r) => r.verdict === "PASS")
        ? "PASS"
        : results.some((r) => r.verdict === "FAIL")
          ? "FAIL"
          : "PARTIAL",
  };

  fs.mkdirSync(SCREEN_DIR, { recursive: true });
  fs.writeFileSync(path.join(SCREEN_DIR, "REPORT.json"), JSON.stringify(report, null, 2));

  console.log("\n── Summary ──");
  for (const r of results) console.log(`  Case ${r.case}: ${r.verdict}`);
  console.log(`\nVerdict: ${report.verdict}`);
  console.log(`Report: ${path.join(SCREEN_DIR, "REPORT.json")}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
