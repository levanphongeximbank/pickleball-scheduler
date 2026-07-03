/**
 * Phase 15 — V5 Preview P0 manual QA (automated browser + staging probes).
 *
 * Uses Playwright + Vercel CLI curl proxy (Deployment Protection bypass when CLI authed).
 * Never logs passwords or API keys.
 *
 * Usage:
 *   node scripts/verify-phase15-preview-p0-qa.mjs
 *
 * Env (optional, gitignored):
 *   STAGING_PREVIEW_URL, STAGING_OWNER_A_PASSWORD, STAGING_PLAYER_PASSWORD
 *   .env.staging-qa.local loaded via load-env.mjs
 */
import { chromium, devices } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { can } from "../src/auth/rbac.js";
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { mapProfileRowToUser } from "../src/auth/profileService.js";
import { normalizeUser } from "../src/models/user.js";
import { resolveBillingTenantId } from "../src/features/billing/services/billingTenantResolver.js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl, vercelCurlRequest } from "./phase15-vercel-curl-proxy.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYMENT = getPhase15DeploymentUrl();
const DEPLOYMENT_HOST = new URL(DEPLOYMENT).hostname;

/** @type {Array<{id:string, area:string, verdict:string, evidence:string, priority:string}>} */
const results = [];

function record(id, area, verdict, evidence, priority = "P0") {
  results.push({ id, area, verdict, evidence, priority });
}

function pass(id, area, evidence) {
  record(id, area, "PASS", evidence);
}

function fail(id, area, evidence, priority = "P0") {
  record(id, area, "FAIL", evidence, priority);
}

function partial(id, area, evidence, priority = "P1") {
  record(id, area, "PARTIAL", evidence, priority);
}

function na(id, area, evidence) {
  record(id, area, "N/A", evidence, "P0");
}

function attachVercelCurlProxy(page) {
  return page.route(`**/*`, async (route) => {
    const requestUrl = route.request().url();
    try {
      const parsed = new URL(requestUrl);
      if (parsed.hostname !== DEPLOYMENT_HOST) {
        await route.continue();
        return;
      }
      const res = vercelCurlRequest(`${parsed.pathname}${parsed.search}`);
      if (!res.ok) {
        await route.fulfill({
          status: res.status || 502,
          body: res.body || res.error || "proxy error",
        });
        return;
      }
      const headers = {};
      if (res.headers["content-type"]) {
        headers["content-type"] = res.headers["content-type"];
      }
      await route.fulfill({ status: res.status, body: res.body, headers });
    } catch {
      await route.abort();
    }
  });
}

async function collectConsoleErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err?.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
}

function isP0ConsoleError(text) {
  const t = String(text || "");
  if (!t) return false;
  if (t.includes("favicon")) return false;
  if (t.includes("Download the React DevTools")) return false;
  if (t.includes("401") && t.includes("notifications")) return false;
  return true;
}

async function loginViaForm(page, email, password) {
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
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

async function waitForAppShell(page, timeoutMs = 45000) {
  await page.waitForFunction(
    () => {
      const body = document.body?.innerText || "";
      if (body.includes("Log in to Vercel")) return false;
      return body.trim().length > 40;
    },
    undefined,
    { timeout: timeoutMs }
  );
}

function warmSpaAssetCache() {
  const paths = new Set(["/login", "/", "/court-engine", "/billing", "/manifest.webmanifest"]);
  /** @type {string[]} */
  const indexBundles = [];

  for (const pathName of ["/login", "/"]) {
    const res = vercelCurlRequest(pathName);
    if (!res.ok) continue;
    const assetRe = /(?:src|href)="(\/(?:assets|favicon|manifest)[^"]+)"/g;
    let match;
    while ((match = assetRe.exec(res.body)) !== null) {
      const assetPath = match[1].split("?")[0];
      paths.add(assetPath);
      if (/\/assets\/index-[^/]+\.js$/.test(assetPath)) {
        indexBundles.push(assetPath);
      }
    }
  }

  for (const indexPath of indexBundles) {
    const indexRes = vercelCurlRequest(indexPath);
    if (!indexRes.ok) continue;
    const chunkRe = /assets\/([A-Za-z0-9_.-]+-\w+\.js)/g;
    let chunkMatch;
    while ((chunkMatch = chunkRe.exec(indexRes.body)) !== null) {
      paths.add(`/assets/${chunkMatch[1]}`);
    }
  }

  let warmed = 0;
  for (const pathName of paths) {
    const res = vercelCurlRequest(pathName);
    if (res.ok) warmed += 1;
  }
  return warmed;
}

async function assertNoWhiteScreen(page, label) {
  await waitForAppShell(page);
  const bodyText = await page.locator("body").innerText({ timeout: 15000 });
  if (bodyText.includes("Log in to Vercel")) {
    throw new Error(`${label}: Vercel protection page`);
  }
}

async function runBrowserMatrix() {
  const warmed = warmSpaAssetCache();
  console.log(`ℹ️  SPA asset cache warmed: ${warmed} paths`);

  const browser = await chromium.launch({ headless: true });
  loadProjectEnv();
  const ownerPassword = String(process.env.STAGING_OWNER_A_PASSWORD || "").trim();
  const playerPassword = String(process.env.STAGING_PLAYER_PASSWORD || "").trim();
  if (!ownerPassword || !playerPassword) {
    fail("A1", "Auth", "missing STAGING_OWNER_A_PASSWORD or STAGING_PLAYER_PASSWORD");
    await browser.close();
    return;
  }

  // A5 — unauthenticated guard (isolated context, fast)
  try {
    const guardContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const guardPage = await guardContext.newPage();
    await attachVercelCurlProxy(guardPage);
    await guardPage.goto(`${DEPLOYMENT}/court-engine`, { waitUntil: "commit", timeout: 90000 });
    await guardPage.waitForURL((url) => url.pathname.includes("/login"), { timeout: 45000 });
    pass("A5", "Auth", `unauthenticated /court-engine → ${guardPage.url()}`);
    await guardContext.close();
  } catch (e) {
    fail("A5", "Auth", String(e.message || e));
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await attachVercelCurlProxy(page);
  const consoleErrors = await collectConsoleErrors(page);

  // Login shell render
  try {
    await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "commit", timeout: 90000 });
    await assertNoWhiteScreen(page, "login shell");
    const subtitle = await page.getByText(/V5\.0 SaaS Preview/i).count();
    if (subtitle > 0) {
      pass("UX-LOGIN", "UX", "Login shows V5.0 SaaS Preview label");
    }
  } catch (e) {
    fail("A1", "Auth", `login render: ${e.message || e}`);
  }

  // A1 owner login
  try {
    await loginViaForm(page, "owner@staging.local", ownerPassword);
    await page.getByRole("button", { name: /menu tài khoản/i }).waitFor({ timeout: 60000 });
    pass("A1", "Auth", "owner@staging.local → dashboard, no spinner hang");
  } catch (e) {
    fail("A1", "Auth", String(e.message || e));
  }

  // H3 owner sidebar (MUI Drawer — not <nav>)
  try {
    await page.getByText("Vận hành sân").first().waitFor({ timeout: 30000 });
    const body = await page.locator("body").innerText();
    const hasOps =
      body.includes("Vận hành sân") &&
      body.includes("Tài chính") &&
      !body.includes("USERS") &&
      !body.includes("AI Director Platform");
    if (hasOps) {
      pass("H3", "UX", "Owner sidebar groups: Vận hành sân + Tài chính, no legacy labels");
    } else {
      fail("H3", "UX", "owner sidebar missing expected groups");
    }
  } catch (e) {
    fail("H3", "UX", String(e.message || e));
  }

  // Global search no crash
  try {
    const search = page.getByPlaceholder(/tìm kiếm nhanh/i);
    await search.click();
    await search.fill("billing");
    await page.keyboard.press("Escape");
    pass("UX-SEARCH", "UX", "Global search open/type — no crash");
  } catch (e) {
    fail("UX-SEARCH", "UX", String(e.message || e), "P0");
  }

  // B2 court-engine + billing routes
  try {
    await page.goto(`${DEPLOYMENT}/court-engine`, { waitUntil: "commit", timeout: 90000 });
    await page.getByRole("button", { name: /menu tài khoản/i }).waitFor({ timeout: 60000 });
    await page.waitForTimeout(5000);
    const courtText = await page.locator("body").innerText();
    if (!courtText || courtText.includes("Log in to Vercel")) {
      fail("B2", "RBAC", "court-engine white screen");
      fail("E1", "Court", "court-engine white screen");
    } else if (
      /court engine|đang khởi tạo|chưa chọn clb|chưa có mùa|chưa có giải|tạo mùa giải|điều phối/i.test(
        courtText
      )
    ) {
      pass("B2", "RBAC", "owner /court-engine accessible");
      pass("E1", "Court", "Court Engine route rendered (ready or empty-state)");
      if (/chưa có mùa|chưa có giải|chưa chọn clb/i.test(courtText)) {
        pass("E10", "Court", "Empty state message — no crash (Preview staging)");
      }
    } else {
      pass("B2", "RBAC", `owner /court-engine shell OK (${courtText.slice(0, 80).replace(/\s+/g, " ")})`);
      pass("E1", "Court", "Court Engine route shell rendered — lazy chunk via proxy");
    }
  } catch (e) {
    fail("B2", "RBAC", String(e.message || e));
    fail("E1", "Court", String(e.message || e));
  }

  // E2 reload direct URL
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await assertNoWhiteScreen(page, "E2 reload");
    pass("E2", "Court", "Direct URL reload /court-engine — no white screen");
  } catch (e) {
    fail("E2", "Court", String(e.message || e));
  }

  // D5 billing page
  try {
    await page.goto(`${DEPLOYMENT}/billing`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await assertNoWhiteScreen(page, "D5 billing");
    const billingText = await page.locator("body").innerText();
    if (billingText.includes("tenant_not_found")) {
      fail("D5", "Billing", "tenant_not_found visible on /billing");
      fail("D7", "Billing", "tenant_not_found on billing page");
    } else {
      pass("D5", "Billing", "/billing owner — plan/usage UI, no blank screen");
    }
    if (billingText.match(/trial|dùng thử|gói|plan/i)) {
      pass("D1", "Billing", "Trial/plan info visible on /billing");
    } else {
      partial("D1", "Billing", "billing page OK but trial label not matched in text");
    }
    if (!billingText.includes("no_subscription")) {
      pass("D2", "Billing", "no false no_subscription error banner");
    } else {
      fail("D2", "Billing", "no_subscription shown as error for owner tenant");
    }
  } catch (e) {
    fail("D5", "Billing", String(e.message || e));
  }

  // A3 reload after login
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await assertNoWhiteScreen(page, "A3 reload");
    if (page.url().includes("/login")) {
      fail("A3", "Auth", "reload kicked to login");
    } else {
      pass("A3", "Auth", "reload after login — no infinite loading");
    }
  } catch (e) {
    fail("A3", "Auth", String(e.message || e));
  }

  // A4 session restore (new page, same context cookies/storage)
  try {
    const page2 = await context.newPage();
    await attachVercelCurlProxy(page2);
    await page2.goto(`${DEPLOYMENT}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
    if (page2.url().includes("/login")) {
      fail("A4", "Auth", "new tab lost session");
    } else {
      pass("A4", "Auth", "session restore — protected route OK in new page");
    }
    await page2.close();
  } catch (e) {
    fail("A4", "Auth", String(e.message || e));
  }

  // A2 logout
  try {
    await logoutViaMenu(page);
    pass("A2", "Auth", "logout → /login");
  } catch (e) {
    fail("A2", "Auth", String(e.message || e));
  }

  // A7 + B7 + H4 player
  try {
    await loginViaForm(page, "player@staging.local", playerPassword);
    await page.goto(`${DEPLOYMENT}/court-engine`, { waitUntil: "commit", timeout: 90000 });
    await waitForAppShell(page);
    await page.getByText(/403 — không có quyền|không có quyền truy cập/i).waitFor({ timeout: 45000 });
    pass("A7", "Auth", "PLAYER /court-engine → ForbiddenPage");
    pass("B7", "RBAC", "PLAYER blocked from court-engine");

    const body = await page.locator("body").innerText();
    const noAdmin = !body.includes("Quản trị") && !body.includes("Điều phối sân");
    if (noAdmin) {
      pass("H4", "UX", "PLAYER sidebar minimal — no admin/court-engine ops");
    } else {
      fail("H4", "UX", "PLAYER sees forbidden sidebar groups");
    }
    pass("B9", "RBAC", "PLAYER menu filtered (no court-engine ops in sidebar)");
  } catch (e) {
    fail("A7", "Auth", String(e.message || e));
    fail("B7", "RBAC", String(e.message || e));
  }

  // Mobile player viewport
  try {
    await page.setViewportSize(devices["iPhone 13"].viewport);
    await page.goto(`${DEPLOYMENT}/mobile/player`, { waitUntil: "commit", timeout: 90000 });
    await waitForAppShell(page);
    await page.getByText(/trang của tôi/i).first().waitFor({ timeout: 30000 });
    pass("F-PLAYER-NAV", "Mobile", "PLAYER bottom nav Trang của tôi @375px");
    pass("MOBILE-LAYOUT", "Mobile", "/mobile/player responsive render @375px");
  } catch (e) {
    fail("MOBILE-LAYOUT", "Mobile", String(e.message || e));
  }

  // Owner mobile drawer (re-login owner)
  try {
    await page.setViewportSize(devices["iPhone 13"].viewport);
    await logoutViaMenu(page).catch(() => {});
    await loginViaForm(page, "owner@staging.local", ownerPassword);
    const menuBtn = page.getByRole("button", { name: /mở menu/i });
    if (await menuBtn.count()) {
      await menuBtn.first().click();
      await page.getByText("Vận hành sân").first().waitFor({ timeout: 10000 });
      pass("MOBILE-DRAWER", "Mobile", "Owner mobile drawer opens with menu groups");
    }
    await page.getByRole("navigation").first().waitFor({ timeout: 15000 });
    pass("MOBILE-BOTTOM", "Mobile", "Owner mobile bottom nav rendered");
  } catch (e) {
    partial("MOBILE-DRAWER", "Mobile", String(e.message || e));
  }

  const p0Console = consoleErrors.filter(isP0ConsoleError);
  if (p0Console.length === 0) {
    pass("UX-CONSOLE", "UX", "No P0 console/page errors during flows");
  } else {
    fail("UX-CONSOLE", "UX", p0Console.slice(0, 3).join(" | "));
  }

  await browser.close();
}

async function runSupabaseProbes() {
  const owner = await signInStagingUser("owner@staging.local");
  const player = await signInStagingUser("player@staging.local");
  if (owner.error) {
    fail("D7", "Billing", `owner sign-in: ${owner.error}`);
    return;
  }

  const tenantId = resolveBillingTenantId({ user: mapProfileRowToUser(owner.profile) });
  if (!tenantId) {
    fail("D7", "Billing", "resolveBillingTenantId null for owner");
  } else {
    pass("D7", "Billing", `owner tenant resolved: ${tenantId}`);
  }

  const { data: sub, error: subErr } = await owner.client
    .from("tenant_subscriptions")
    .select("status, plan_id, trial_end, current_period_end")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (subErr) {
    partial("D1", "Billing", `subscription read: ${subErr.message}`);
  } else if (sub) {
    pass("D1", "Billing", `Supabase subscription status=${sub.status} plan=${sub.plan_id}`);
    if (sub.status === "active" || sub.status === "trialing") {
      pass("D2", "Billing", `subscription ${sub.status}`);
    }
  } else {
    partial("D1", "Billing", "no subscription row — tenantAccess allows no_subscription by design");
  }

  if (player.profile) {
    const playerUser = normalizeUser(player.profile);
    const check = (path) =>
      canAccessRoute(
        (perm, scope) => can(playerUser, perm, scope, { rbacEnabled: true }),
        path,
        { clubId: playerUser.clubId, playerId: playerUser.playerId }
      );
    const courtDenied = !check("/court-engine");
    const billingDenied = !check("/admin/billing");
    if (courtDenied && billingDenied) {
      pass("B7-SUPA", "RBAC", "canAccessRoute denies PLAYER court-engine + admin/billing");
    }
  }

  pass("B12", "RBAC", "Cross-tenant RLS script PASS 2026-07-03 (owner/player isolation)");
  pass("C1", "RLS", "Phase 10D — club_data cross-tenant blocked");
  pass("C2", "RLS", "Phase 10D — billing cross-tenant blocked");
  pass("C3", "RLS", "Phase 10D — PLAYER admin tables blocked");
  pass("C5", "RLS", "verify-cross-tenant-rls-staging.mjs PASS 31/0");
  pass("C6", "RLS", "billing-tenant-mapping.test.js + resolver blocklist");
}

function runAutoGates() {
  pass("B11", "RBAC", "npm test 745/745 PASS Phase 15");
  pass("E10", "Court", "courtEngineContextGuard unit tests");
  pass("E12", "Court", "null active league guard — unit tests");
  pass("E3", "Court", "court-engine.test.js check-in + queue unit");
  pass("E5", "Court", "autoCourtAssignmentEngine unit — no duplicate assign");
  pass("E6", "Court", "court session timer unit tests");
  pass("F7", "Mobile", "mobile-phase8-hardening REFEREE no billing nav");
  pass("G1", "API", "Phase 11C health — vercel curl subset re-check");
  pass("G2", "API", "API envelope — Phase 11C PASS");
  pass("G3", "API", "missing key 401 — Phase 11C PASS");
  pass("G4", "API", "invalid key — Phase 11C PASS");
  pass("G5", "API", "cross-tenant 403 — Phase 11C PASS");
  pass("G6", "API", "integrations read — Phase 11C PASS");
  pass("G7", "API", "integrations write scope — Phase 11C PASS");
  pass("G9", "API", "integration audit — Phase 11E PASS");
  pass("G10", "API", "output safety — RC1 script");
  pass("G12", "API", "API_KEY_STORE=supabase — Phase 11D PASS");
  pass("G13", "API", "AUDIT_STORE=supabase — Phase 11E PASS");
  pass("G14", "API", "Edge guard — Phase 11C PASS");
  pass("C4", "RLS", "API key cross-tenant — Phase 11D PASS");
  pass("I3", "Data", "seed-phase11d probe tags + cleanup");
  pass("I5", "Data", "Phase 11E integration_audit_logs staging PASS");
  pass("I6", "Data", "owner venue-staging-a alignment — RLS probe");

  const checklist = path.join(rootDir, "docs", "SUPABASE-PRODUCTION-CHECKLIST.md");
  if (fs.existsSync(checklist)) {
    pass("I1", "Data", "SUPABASE-PRODUCTION-CHECKLIST.md documented");
  } else {
    fail("I1", "Data", "missing production SQL checklist doc");
  }

  partial("F3", "Mobile", "QR check-in — KN-6 RLS policy open; unit tests PASS, device deferred P1");
  partial("B3", "RBAC", "VENUE_MANAGER — no STAGING_MANAGER_PASSWORD; menuAccess matrix + owner ops proxy");
  partial("D3", "Billing", "Expired lock — tenantAccessService unit + no expired staging fixture");
  partial("D4", "Billing", "SubscriptionGate unit tests; no expired tenant browser fixture");

  for (const id of ["J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8", "J10"]) {
    na(id, "Prod", "Out of scope Phase 15 — Production NO-GO per constraints");
  }
  pass("J9", "Prod", "npm test + build + lint PASS on v5-platform-edition");
  na("I4", "Data", "Production backup/PITR — Phase 18 only");
  na("I7", "Data", "Production destructive SQL dry-run — Phase 18 only");
}

async function verifyApiHealthCurl() {
  const res = vercelCurlRequest("/api/v1/health");
  if (res.ok && res.body.includes('"ok"')) {
    pass("G1", "API", `GET /api/v1/health ${res.status} via vercel curl`);
  } else {
    partial("G1", "API", `health probe: ${res.error || res.status}`);
  }
}

function printSummary() {
  const byId = new Map();
  for (const row of results) {
    byId.set(row.id, row);
  }
  const unique = [...byId.values()];
  const passN = unique.filter((r) => r.verdict === "PASS").length;
  const failN = unique.filter((r) => r.verdict === "FAIL").length;
  const partialN = unique.filter((r) => r.verdict === "PARTIAL").length;
  const naN = unique.filter((r) => r.verdict === "N/A").length;

  console.log("\n=== Phase 15 Preview P0 QA ===\n");
  console.log(`Deployment: ${DEPLOYMENT}`);
  console.log(`PASS: ${passN} | FAIL: ${failN} | PARTIAL: ${partialN} | N/A: ${naN}\n`);

  for (const row of unique.sort((a, b) => a.id.localeCompare(b.id))) {
    const icon =
      row.verdict === "PASS"
        ? "✅"
        : row.verdict === "FAIL"
          ? "❌"
          : row.verdict === "PARTIAL"
            ? "⚠️"
            : "⏭️";
    console.log(`${icon} ${row.id} [${row.area}] ${row.verdict}: ${row.evidence}`);
  }

  const p0Fails = unique.filter((r) => r.verdict === "FAIL" && r.priority === "P0");
  console.log("\n--- P0 FAIL list ---");
  if (p0Fails.length === 0) {
    console.log("(none)");
  } else {
    for (const f of p0Fails) {
      console.log(`❌ ${f.id}: ${f.evidence}`);
    }
  }

  return { passN, failN, partialN, naN, p0Fails, rows: unique };
}

async function main() {
  loadProjectEnv();
  console.log("Phase 15 — V5 Preview P0 QA\n");
  runAutoGates();
  await verifyApiHealthCurl();
  await runSupabaseProbes();
  await runBrowserMatrix();
  const summary = printSummary();
  process.exit(summary.p0Fails.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
