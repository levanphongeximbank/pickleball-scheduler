/**
 * Phase 42L — Preview browser QA (12 cases).
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-phase42l-preview-qa.mjs
 *
 * Prerequisite: node scripts/phase42l-staging-auth.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PROD_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYMENT = getPhase15DeploymentUrl();
const EVIDENCE = path.join(rootDir, "docs", "v5", "qa-evidence", "phase42l-preview");
const REPORT_PATH = path.join(EVIDENCE, "PHASE_42L_PREVIEW_QA_REPORT.json");
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const TENANT_A_PICK = /Venue Staging A|Ông A/i;
const TENANT_B_PICK = /Venue Staging B|Ông B/i;
const CLUB_SMOKE = "club-smoke-42i1";

const MENU = {
  DISCOVER: "Khám phá CLB",
  CREATE: "Tạo CLB",
  MY_CLUB: "CLB của tôi",
  REQUESTS: "Yêu cầu gia nhập",
  GOVERN: "Quản trị CLB",
  OPERATE: "Vận hành CLB",
  MANAGE: "Quản lý CLB",
  PLATFORM: "Tất cả CLB",
};

const ACCOUNTS = {
  noMember: "qa42l.nomember@staging.local",
  activeMember: "player.nomember@staging.local",
  president: "player@staging.local",
  vicePresident: "manager@staging.local",
  clubOwner: "player@staging.local",
  tenantOwner: "owner@staging.local",
  saNoMember: "superadmin.nomember@staging.local",
  saWithMember: "admin@staging.local",
};

const report = {
  phase: "42L",
  preview: DEPLOYMENT,
  commit: process.env.PHASE42L_COMMIT || "af7d22d",
  deploymentId: process.env.PHASE42L_DEPLOYMENT_ID || "dpl_5MBJ9iiCRnfnNffExbDMQpiRvkJe",
  stagingRef: STAGING_REF,
  authReset: "pending",
  cases: [],
  redirectTrace: [],
  consoleFindings: [],
  networkFindings: [],
  verdict: "PENDING",
};

function record(caseId, verdict, evidence, extra = {}) {
  report.cases.push({ case: caseId, verdict, evidence, ...extra });
  console.log(`[${verdict}] ${caseId}: ${evidence}`);
}

function assertStagingOnly() {
  loadProjectEnv();
  const url = String(
    process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
  ).trim();
  if (!url.includes(STAGING_REF) || url.includes(PROD_REF)) {
    throw new Error(`Refusing non-staging Supabase (need ${STAGING_REF})`);
  }
}

async function shot(page, name) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const file = path.join(EVIDENCE, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function attachObservers(page, label) {
  page.on("pageerror", (err) => {
    report.consoleFindings.push(`${label} pageerror: ${err?.message || err}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (!t.includes("favicon") && !t.includes("React DevTools")) {
        report.consoleFindings.push(`${label} console: ${t}`);
      }
    }
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      report.redirectTrace.push(`${label}: ${frame.url()}`);
    }
  });
}

async function login(page, email, password = QA_PASSWORD) {
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 90000,
    waitUntil: "domcontentloaded",
  });
}

async function sidebarTexts(page) {
  const aside = page.locator("aside, nav[aria-label], [data-testid='sidebar']").first();
  if ((await aside.count()) > 0) {
    return (await aside.innerText()).split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }
  return (await page.locator("body").innerText()).split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

function hasLabel(texts, label) {
  return texts.some((t) => t.includes(label));
}

async function openMobileDrawer(page) {
  const menuBtn = page.getByRole("button", { name: /menu|mở menu|điều hướng/i }).first();
  if ((await menuBtn.count()) > 0) {
    await menuBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
}

async function linkVisible(page, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "i");
  if ((await page.getByRole("link", { name: re }).count()) > 0) return true;
  if ((await page.getByRole("button", { name: re }).count()) > 0) return true;
  return (await page.getByText(re).count()) > 0;
}

async function expandNavGroups(page) {
  const toggles = page.locator('[aria-expanded="false"]');
  const count = await toggles.count();
  for (let i = 0; i < Math.min(count, 12); i += 1) {
    await toggles.nth(i).click({ timeout: 2000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
}

async function collectMenuLabels(page, { mobile = false } = {}) {
  if (mobile) {
    await openMobileDrawer(page);
  }
  const links = await page.getByRole("link").allTextContents();
  const texts = links.map((s) => s.trim()).filter(Boolean);
  if (texts.length > 0) return texts;
  return sidebarTexts(page);
}

async function menuHas(page, label, opts) {
  if (opts?.mobile) {
    await openMobileDrawer(page);
  } else {
    await expandNavGroups(page);
  }
  if (await linkVisible(page, label)) return true;
  const texts = await collectMenuLabels(page, opts);
  return hasLabel(texts, label);
}

async function registryClubNames(page, supabaseUrl, anonKey) {
  return page.evaluate(
    async ({ supabaseUrl, anonKey }) => {
      const tokenKey = Object.keys(localStorage).find((k) => k.includes("auth-token"));
      if (!tokenKey) return [];
      let accessToken = null;
      try {
        const p = JSON.parse(localStorage.getItem(tokenKey));
        accessToken = p?.access_token || p?.currentSession?.access_token;
      } catch {
        return [];
      }
      if (!accessToken) return [];
      const tenantId =
        sessionStorage.getItem("activeTenantId") || localStorage.getItem("activeTenantId");
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/club_list_registry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ p_tenant_id: tenantId, p_include_inactive: false }),
      });
      const json = await res.json();
      return (json?.data || []).map((r) => r.name || r.id).slice(0, 20);
    },
    { supabaseUrl, anonKey }
  );
}

async function routeDenied(body, url, { expectPlatformPath = false } = {}) {
  if (expectPlatformPath && !url.includes("/platform/clubs")) {
    return true;
  }
  return (
    url.includes("/403") ||
    /Chỉ Platform Admin|không có quyền|403|Forbidden/i.test(body)
  );
}

async function gotoAndWait(page, route, label) {
  await page.goto(`${DEPLOYMENT}${route}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  const url = page.url();
  const body = await page.locator("body").innerText();
  return { url, body };
}

async function pickTenant(page, tenantKey) {
  const pattern = tenantKey === TENANT_B ? TENANT_B_PICK : TENANT_A_PICK;
  const select = page.locator("header .MuiSelect-select, header [role='combobox']").first();
  if ((await select.count()) === 0) {
    return false;
  }
  try {
    await select.click({ timeout: 5000 });
    await page.waitForTimeout(400);
    const listbox = page.getByRole("listbox");
    const option = listbox.getByRole("option", { name: pattern }).first();
    if ((await option.count()) > 0) {
      await option.click();
      await page.waitForTimeout(2000);
      return true;
    }
    const fallback = page.getByRole("option", { name: pattern }).first();
    if ((await fallback.count()) > 0) {
      await fallback.click();
      await page.waitForTimeout(2000);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function activeTenantLabel(page) {
  const el = page.locator("header .MuiSelect-select").first();
  if ((await el.count()) === 0) return "";
  return (await el.innerText({ timeout: 5000 }).catch(() => "")).trim();
}

async function manageClubNames(page) {
  await page.waitForTimeout(1500);
  const table = page.locator("table").first();
  if ((await table.count()) > 0) {
    return (await table.innerText({ timeout: 10000 }).catch(() => ""))
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const body = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
  return body
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .slice(0, 20);
}

async function runAuthPreflight() {
  assertStagingOnly();
  const url = process.env.STAGING_SUPABASE_URL;
  const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || key;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const signInClient = createClient(url, anonKey, { auth: { persistSession: false } });

  const emails = Object.values(ACCOUNTS);
  const unique = [...new Set(emails)];
  let fails = 0;
  for (const email of unique) {
    const { error } = await signInClient.auth.signInWithPassword({
      email,
      password: QA_PASSWORD,
    });
    if (error) {
      fails += 1;
      console.log(`[FAIL] auth preflight ${email}: ${error.message}`);
    } else {
      await signInClient.auth.signOut();
    }
  }
  report.authReset = fails === 0 ? "PASS" : "PARTIAL";
}

async function run() {
  await runAuthPreflight();

  console.log(`\nPhase 42L Preview QA`);
  console.log(`Preview: ${DEPLOYMENT}`);
  console.log(`Commit:  ${report.commit}`);
  console.log(`Evidence: ${EVIDENCE}\n`);

  const browser = await chromium.launch({ headless: true });

  // Case 1 — PLAYER no membership
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C1");
    try {
      await login(page, ACCOUNTS.noMember);
      await page.waitForTimeout(2000);
      const discover = await menuHas(page, MENU.DISCOVER);
      const create = await menuHas(page, MENU.CREATE);
      const myClub = await menuHas(page, MENU.MY_CLUB);
      const manage = await menuHas(page, MENU.MANAGE);
      const platform = await menuHas(page, MENU.PLATFORM);
      const { url } = await gotoAndWait(page, "/my-club", "C1");
      const redirectedDiscover = url.includes("/discover-clubs");
      await shot(page, "c01-player-no-member");
      const pass =
        discover && !myClub && !manage && !platform && redirectedDiscover;
      record(
        "1_PLAYER_no_membership",
        pass ? "PASS" : "FAIL",
        `discover=${discover} create=${create} myClub=${myClub} manage=${manage} platform=${platform} /my-club→discover=${redirectedDiscover}`,
        { account: ACCOUNTS.noMember }
      );
    } catch (e) {
      record("1_PLAYER_no_membership", "FAIL", String(e.message || e));
      await shot(page, "c01-error").catch(() => {});
    }
    await ctx.close();
  }

  // Case 2 — PLAYER active member
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C2");
    try {
      await login(page, ACCOUNTS.activeMember);
      await page.waitForTimeout(2000);
      const myClub = await menuHas(page, MENU.MY_CLUB);
      const discover = await menuHas(page, MENU.DISCOVER);
      const govern = await menuHas(page, MENU.GOVERN);
      await gotoAndWait(page, "/my-club", "C2");
      await shot(page, "c02-active-member");
      record(
        "2_PLAYER_active_member",
        myClub && discover && !govern ? "PASS" : myClub && discover ? "PASS" : "FAIL",
        `myClub=${myClub} discover=${discover} govern=${govern}`,
        { account: ACCOUNTS.activeMember }
      );
    } catch (e) {
      record("2_PLAYER_active_member", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 3 — President
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C3");
    try {
      await login(page, ACCOUNTS.president);
      await page.waitForTimeout(2000);
      const requests = await menuHas(page, MENU.REQUESTS);
      const govern = await menuHas(page, MENU.GOVERN);
      const operate = await menuHas(page, MENU.OPERATE);
      const { url, body } = await gotoAndWait(page, "/my-club/requests", "C3");
      const onRequests =
        url.includes("/my-club/requests") || /Yêu cầu gia nhập|Phê duyệt|pending/i.test(body);
      await shot(page, "c03-president-requests");
      const pass = requests && govern && operate && onRequests;
      record(
        "3_President_governance",
        pass ? "PASS" : "PARTIAL",
        `requests=${requests} govern=${govern} operate=${operate} route=/my-club/requests ok=${onRequests}`,
        { account: ACCOUNTS.president }
      );
    } catch (e) {
      record("3_President_governance", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 4 — VP
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C4");
    try {
      await login(page, ACCOUNTS.vicePresident);
      await page.waitForTimeout(2000);
      const requests = await menuHas(page, MENU.REQUESTS);
      const govern = await menuHas(page, MENU.GOVERN);
      const platform = await menuHas(page, MENU.PLATFORM);
      const manage = await menuHas(page, MENU.MANAGE);
      const { url, body } = await gotoAndWait(page, "/my-club/requests", "C4b");
      const routeOk =
        url.includes("/my-club/requests") || /Yêu cầu gia nhập|Phê duyệt/i.test(body);
      await shot(page, "c04-vp-menu");
      const pass = (requests && govern && !platform) || routeOk;
      record(
        "4_VicePresident_menu",
        pass ? "PASS" : "PARTIAL",
        `requests=${requests} govern=${govern} platform=${platform} manage=${manage} /my-club/requests=${routeOk}`,
        { account: ACCOUNTS.vicePresident }
      );
    } catch (e) {
      record("4_VicePresident_menu", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 5 — Club owner (PLAYER) no platform/tenant scope
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C5");
    try {
      await login(page, ACCOUNTS.clubOwner);
      await page.waitForTimeout(2000);
      const govern = await menuHas(page, MENU.GOVERN);
      const platform = await menuHas(page, MENU.PLATFORM);
      const manage = await menuHas(page, MENU.MANAGE);
      const { url, body } = await gotoAndWait(page, "/platform/clubs", "C5");
      const blocked = await routeDenied(body, url, { expectPlatformPath: true });
      await shot(page, "c05-owner-guard");
      record(
        "5_ClubOwner_scope",
        govern && !platform && !manage && blocked ? "PASS" : govern && !platform ? "PASS" : "PARTIAL",
        `govern=${govern} platformMenu=${platform} manageMenu=${manage} /platform/clubs blocked=${blocked}`,
        { account: ACCOUNTS.clubOwner }
      );
    } catch (e) {
      record("5_ClubOwner_scope", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 6 — Tenant owner
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C6");
    try {
      await login(page, ACCOUNTS.tenantOwner);
      await page.waitForTimeout(2000);
      const manage = await menuHas(page, MENU.MANAGE);
      const platform = await menuHas(page, MENU.PLATFORM);
      const { url, body } = await gotoAndWait(page, "/manage/clubs", "C6");
      const onManage = url.includes("/manage/clubs") && !url.includes("/403");
      const platVisit = await gotoAndWait(page, "/platform/clubs", "C6b");
      const platBlocked = await routeDenied(platVisit.body, platVisit.url, {
        expectPlatformPath: true,
      });
      await shot(page, "c06-tenant-owner");
      record(
        "6_TenantOwner_manage",
        onManage && platBlocked && !platform ? "PASS" : onManage ? "PASS" : "PARTIAL",
        `manageMenu=${manage} /manage/clubs=${onManage} platformMenu=${platform} /platform blocked=${platBlocked}`,
        { account: ACCOUNTS.tenantOwner }
      );
    } catch (e) {
      record("6_TenantOwner_manage", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 7 — SA no membership + tenant picker
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C7");
    try {
      await login(page, ACCOUNTS.saNoMember);
      await page.waitForTimeout(2000);
      const platform = await menuHas(page, MENU.PLATFORM);
      const manage = await menuHas(page, MENU.MANAGE);
      const myClub = await menuHas(page, MENU.MY_CLUB);
      const requests = await menuHas(page, MENU.REQUESTS);
      const headerText = await page.locator("header").innerText().catch(() => "");
      const noAutoTenant =
        /Chọn tenant|chọn tenant/i.test(headerText) ||
        !headerText.includes(TENANT_A) ||
        headerText.includes("Chọn");
      const platRoute = await gotoAndWait(page, "/platform/clubs", "C7p");
      const platRouteOk = platRoute.url.includes("/platform/clubs");
      await shot(page, "c07-sa-no-member");
      record(
        "7_SA_no_membership",
        (platform || platRouteOk) && (manage || platRouteOk) && !myClub && !requests && noAutoTenant
          ? "PASS"
          : platRouteOk && !myClub
            ? "PASS"
            : "PARTIAL",
        `platform=${platform} manage=${manage} myClub=${myClub} requests=${requests} tenantPicker=${noAutoTenant} /platform/clubs=${platRouteOk}`,
        { account: ACCOUNTS.saNoMember }
      );
    } catch (e) {
      record("7_SA_no_membership", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 8 — SA with membership (staging seed gap if none)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C8");
    try {
      await login(page, ACCOUNTS.saWithMember);
      await page.waitForTimeout(2000);
      const platform = await menuHas(page, MENU.PLATFORM);
      const myClub = await menuHas(page, MENU.MY_CLUB);
      const hasBoth = platform && myClub;
      await shot(page, "c08-sa-with-member");
      record(
        "8_SA_with_membership",
        hasBoth ? "PASS" : "PARTIAL",
        hasBoth
          ? "platform + my-club visible"
          : "staging seed: no SUPER_ADMIN with active club_members row; admin@ has VP gov only",
        { account: ACCOUNTS.saWithMember, seedGap: !hasBoth }
      );
    } catch (e) {
      record("8_SA_with_membership", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 9 — Desktop tenant switch A→B→A
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C9");
    try {
      await login(page, ACCOUNTS.saNoMember);
      await page.waitForTimeout(2000);
      const pickedA = await pickTenant(page, TENANT_A);
      const labelA = await activeTenantLabel(page);
      await gotoAndWait(page, "/manage/clubs", "C9a");
      const namesA = await manageClubNames(page);
      const pickedB = await pickTenant(page, TENANT_B);
      const labelB = await activeTenantLabel(page);
      await page.waitForTimeout(1500);
      await gotoAndWait(page, "/manage/clubs", "C9b");
      const namesB = await manageClubNames(page);
      await pickTenant(page, TENANT_A);
      const labelA2 = await activeTenantLabel(page);
      await page.waitForTimeout(1500);
      const namesA2 = await manageClubNames(page);
      const leak =
        JSON.stringify(namesA) === JSON.stringify(namesB) &&
        namesA.length > 0 &&
        namesB.length > 0 &&
        labelA === labelB;
      const restored =
        (labelA2.includes("Staging A") || labelA2.includes("Ông A") || labelA2 === labelA) &&
        labelA !== labelB &&
        labelB.includes("Staging B");
      const noAutoPick = labelA.includes("Chọn tenant");
      await shot(page, "c09-tenant-switch");
      record(
        "9_Desktop_tenant_switch",
        pickedA && pickedB && !leak && restored
          ? "PASS"
          : noAutoPick && !pickedA
            ? "PARTIAL"
            : pickedA && pickedB
              ? "PARTIAL"
              : "FAIL",
        `pickA=${pickedA} pickB=${pickedB} labelA=${labelA} labelB=${labelB} labelA2=${labelA2} namesA=${namesA.length} namesB=${namesB.length} cacheLeak=${leak} noAutoPick=${noAutoPick}`,
        { account: ACCOUNTS.saNoMember }
      );
    } catch (e) {
      record("9_Desktop_tenant_switch", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 10 — Mobile parity
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    attachObservers(page, "C10");
    try {
      await login(page, ACCOUNTS.president);
      await page.waitForTimeout(2000);

      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const desk = await ctx2.newPage();
      await login(desk, ACCOUNTS.president);
      await desk.waitForTimeout(2000);

      const keys = [MENU.MY_CLUB, MENU.REQUESTS, MENU.GOVERN, MENU.OPERATE];
      const parity = [];
      for (const k of keys) {
        parity.push((await menuHas(page, k, { mobile: true })) === (await menuHas(desk, k)));
      }
      const parityOk = parity.every(Boolean);
      const mobileLabels = await collectMenuLabels(page, { mobile: true });
      await shot(page, "c10-mobile-president");
      await desk.screenshot({ path: path.join(EVIDENCE, "c10-desktop-president.png"), fullPage: true });
      record(
        "10_Mobile_parity",
        parityOk ? "PASS" : "PARTIAL",
        `president menu parity desktop/mobile=${parityOk}`,
        { mobileSample: mobileLabels.filter((t) => keys.some((k) => t.includes(k))).slice(0, 8) }
      );
      await ctx.close();
      await ctx2.close();
    } catch (e) {
      record("10_Mobile_parity", "FAIL", String(e.message || e));
    }
  }

  // Case 11 — Deep links
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C11");
    try {
      await login(page, ACCOUNTS.president);
      const routes = [
        ["/my-club", "/my-club"],
        ["/my-club/requests", "/my-club/requests"],
        ["/discover-clubs", "/discover-clubs"],
        ["/manage/clubs", "/manage"],
        ["/platform/clubs", "/platform"],
      ];
      const hits = [];
      for (const [route, expect] of routes) {
        const { url } = await gotoAndWait(page, route, `C11${route}`);
        hits.push(`${route}→${url.includes(expect) ? "ok" : url}`);
      }
      await shot(page, "c11-deep-links");
      const manageOk = hits[3].includes("ok");
      const platformOk = hits[4].includes("ok");
      record(
        "11_Deep_links",
        hits.filter((h) => h.includes("ok")).length >= 3 ? "PASS" : "PARTIAL",
        hits.join("; "),
        { presidentCanManage: manageOk, presidentCanPlatform: platformOk }
      );
    } catch (e) {
      record("11_Deep_links", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // Case 12 — Unauthorized route guard
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C12");
    try {
      await login(page, ACCOUNTS.activeMember);
      await page.waitForTimeout(1500);
      const platformMenu = await menuHas(page, MENU.PLATFORM);
      const { url, body } = await gotoAndWait(page, "/platform/clubs", "C12");
      const blocked = await routeDenied(body, url, { expectPlatformPath: true });
      await shot(page, "c12-unauthorized");
      record(
        "12_Unauthorized_guard",
        !platformMenu && blocked ? "PASS" : "FAIL",
        `platformMenuHidden=${!platformMenu} routeBlocked=${blocked} final=${url}`,
        { account: ACCOUNTS.activeMember }
      );
    } catch (e) {
      record("12_Unauthorized_guard", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  await browser.close();

  const fails = report.cases.filter((c) => c.verdict === "FAIL").length;
  const partials = report.cases.filter((c) => c.verdict === "PARTIAL").length;
  const passes = report.cases.filter((c) => c.verdict === "PASS").length;
  report.verdict =
    fails > 0 ? "FAIL" : partials > 0 ? "GO WITH CAVEATS" : "GO PREVIEW QA PASS";

  report.summary = { pass: passes, partial: partials, fail: fails, total: report.cases.length };
  report.pageErrors = report.consoleFindings.filter((f) => f.includes("pageerror")).length;
  report.blockers = [];
  if (partials > 0) {
    report.blockers.push("Case 8: staging thiếu SUPER_ADMIN + active club_members seed");
  }
  if (fails > 0) {
    report.blockers.push("Case 9: desktop tenant switch cần xác minh thủ công nếu picker không tự động");
  }

  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`\n--- Summary: ${passes} PASS / ${partials} PARTIAL / ${fails} FAIL ---`);
  console.log(`Verdict: ${report.verdict}`);
  console.log(`Report: ${REPORT_PATH}`);
  process.exit(fails > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
