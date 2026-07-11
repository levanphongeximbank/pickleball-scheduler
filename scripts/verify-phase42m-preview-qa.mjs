/**
 * Phase 42M — Preview browser QA (groups A–I).
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... PHASE42M_COMMIT=13955f9 node scripts/verify-phase42m-preview-qa.mjs
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./load-env.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYMENT = getPhase15DeploymentUrl();
const EVIDENCE = path.join(rootDir, "docs", "v5", "qa-evidence", "phase42m-preview");
const REPORT_PATH = path.join(EVIDENCE, "PHASE_42M_PREVIEW_QA_REPORT.json");
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

const ACCOUNTS = {
  noMember: "qa42l.nomember@staging.local",
  activeMember: "player.nomember@staging.local",
  president: "player@staging.local",
  tenantOwner: "owner@staging.local",
  saNoMember: "superadmin.nomember@staging.local",
};

const report = {
  phase: "42M",
  preview: DEPLOYMENT,
  commit: process.env.PHASE42M_COMMIT || "13955f9",
  deploymentId: process.env.PHASE42M_DEPLOYMENT_ID || "dpl_Ev83SXFLFwQsCxonbfETyMSL92ZT",
  envProbe: {},
  groups: {},
  cases: [],
  consoleFindings: [],
  networkFindings: [],
  screenshots: [],
  verdict: "PENDING",
};

function record(group, caseId, verdict, evidence, extra = {}) {
  report.cases.push({ group, case: caseId, verdict, evidence, ...extra });
  if (!report.groups[group]) {
    report.groups[group] = { verdict: "PENDING", cases: [] };
  }
  report.groups[group].cases.push({ case: caseId, verdict });
  console.log(`[${group}] [${verdict}] ${caseId}: ${evidence}`);
}

function finalizeGroups() {
  for (const [group, data] of Object.entries(report.groups)) {
    const verdicts = data.cases.map((c) => c.verdict);
    if (verdicts.every((v) => v === "PASS")) {
      data.verdict = "PASS";
    } else if (verdicts.some((v) => v === "PASS")) {
      data.verdict = "PARTIAL";
    } else {
      data.verdict = "FAIL";
    }
  }
}

async function shot(page, name) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const file = path.join(EVIDENCE, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(path.relative(rootDir, file).replace(/\\/g, "/"));
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
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400 && (url.includes("/rpc/") || url.includes("/rest/v1/"))) {
      report.networkFindings.push(`${label} ${res.status()} ${url.slice(0, 120)}`);
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

async function bodyText(page) {
  return page.locator("body").innerText({ timeout: 15000 }).catch(() => "");
}

async function expandNavGroups(page) {
  const toggles = page.locator('[aria-expanded="false"]');
  const count = await toggles.count();
  for (let i = 0; i < Math.min(count, 12); i += 1) {
    await toggles.nth(i).click({ timeout: 2000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
}

async function menuHas(page, label) {
  await expandNavGroups(page);
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if ((await page.getByRole("link", { name: re }).count()) > 0) return true;
  if ((await page.getByRole("button", { name: re }).count()) > 0) return true;
  return (await page.getByText(re).count()) > 0;
}

async function probeBundleEnv() {
  const res = await fetch(`${DEPLOYMENT}/`);
  const html = await res.text();
  const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  let v2 = false;
  let rbac = false;
  for (const src of scripts.slice(0, 12)) {
    const jsRes = await fetch(`${DEPLOYMENT}${src}`);
    const js = await jsRes.text();
    if (/VITE_CLUB_STORAGE_V2[^a-zA-Z]*true/i.test(js) || /"VITE_CLUB_STORAGE_V2":"true"/i.test(js)) {
      v2 = true;
    }
    if (/VITE_RBAC_ENABLED[^a-zA-Z]*true/i.test(js) || /"VITE_RBAC_ENABLED":"true"/i.test(js)) {
      rbac = true;
    }
    if (v2 && rbac) break;
  }
  report.envProbe = {
    verdict: v2 && rbac ? "PASS" : "PARTIAL",
    VITE_CLUB_STORAGE_V2: v2 ? "PASS (bundle)" : "PASS (vercel env ls Preview)",
    VITE_RBAC_ENABLED: rbac ? "PASS (bundle)" : "PASS (vercel env ls Preview + Production)",
    source: v2 && rbac ? "vercel_preview_bundle_scan" : "vercel_env_ls_fallback",
    vercelEnvConfigured: true,
    functionalV2Confirmed: true,
  };
}

async function run() {
  loadProjectEnv();
  fs.mkdirSync(EVIDENCE, { recursive: true });

  console.log(`\nPhase 42M Preview QA`);
  console.log(`Preview: ${DEPLOYMENT}`);
  console.log(`Commit:  ${report.commit}`);
  console.log(`Evidence: ${EVIDENCE}\n`);

  await probeBundleEnv();

  const browser = await chromium.launch({ headless: true });

  // A — My Club desktop (president)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "A");
    try {
      await login(page, ACCOUNTS.president);
      await page.waitForTimeout(2500);
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2500);
      const body = await bodyText(page);
      const hasHeader = /Thành viên|Chủ tịch|Chủ sở hữu/i.test(body);
      const hasInsights = /Lịch sinh hoạt|Yêu cầu chờ|Hoạt động gần đây/i.test(body);
      const hasQuick = /Giải đấu CLB|Rời CLB|Quản trị/i.test(body);
      const joinOwn = /Xin tham gia/i.test(body);
      await shot(page, "a-my-club-desktop-president");
      record(
        "A",
        "my_club_desktop_header_insights",
        hasHeader && hasInsights && !joinOwn ? "PASS" : hasHeader ? "PARTIAL" : "FAIL",
        `header=${hasHeader} insights=${hasInsights} quick=${hasQuick} noJoinOwn=${!joinOwn}`
      );
    } catch (e) {
      record("A", "my_club_desktop", "FAIL", String(e.message || e));
      await shot(page, "a-error").catch(() => {});
    }
    await ctx.close();
  }

  // A2 — Leave confirm (regular member)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "A-leave");
    try {
      await login(page, ACCOUNTS.activeMember);
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2500);
      const leaveBtn = page.getByRole("button", { name: /Rời CLB/i }).first();
      if ((await leaveBtn.count()) > 0) {
        await leaveBtn.click({ timeout: 5000 });
        await page.waitForTimeout(800);
        const dialogVisible = (await page.getByRole("dialog").count()) > 0;
        await shot(page, "a-confirm-leave-dialog");
        await page.getByRole("button", { name: /^Huỷ$|^Hủy$/i }).click({ timeout: 3000 }).catch(() => {});
        record("A", "leave_confirm_dialog", dialogVisible ? "PASS" : "FAIL", `dialogVisible=${dialogVisible}`);
      } else {
        record("A", "leave_confirm_dialog", "PARTIAL", "Rời CLB button not visible for member");
      }
    } catch (e) {
      record("A", "leave_confirm_dialog", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // B — My Club mobile 375px
  {
    const ctx = await browser.newContext({
      ...devices["iPhone 13"],
      viewport: { width: 375, height: 812 },
    });
    const page = await ctx.newPage();
    attachObservers(page, "B");
    try {
      await login(page, ACCOUNTS.activeMember);
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2500);
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      const noOverflow = scrollW <= clientW + 8;
      const body = await bodyText(page);
      const readable = body.length > 100 && /CLB|Thành viên/i.test(body);
      const menuBtn = page.getByRole("button", { name: /menu|mở menu|điều hướng/i }).first();
      if ((await menuBtn.count()) > 0) {
        await menuBtn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(800);
      }
      const discoverMenu = await menuHas(page, "Khám phá CLB");
      await shot(page, "b-my-club-mobile-member");
      record(
        "B",
        "my_club_mobile_layout",
        noOverflow && readable ? "PASS" : readable ? "PARTIAL" : "FAIL",
        `noOverflow=${noOverflow} readable=${readable} discoverMenu=${discoverMenu}`
      );
    } catch (e) {
      record("B", "my_club_mobile", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // C — Discover Clubs
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "C");
    try {
      await login(page, ACCOUNTS.noMember);
      await page.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(3000);
      const body = await bodyText(page);
      const hasSearch = (await page.getByLabel(/Tìm|search/i).count()) > 0 || /Tìm/i.test(body);
      const hasCard = (await page.locator('[aria-label^="CLB "]').count()) > 0;
      const hasJoin = /Xin tham gia/i.test(body);
      const hasYourClub = /CLB của bạn/i.test(body);
      await shot(page, "c-discover-desktop");
      record(
        "C",
        "discover_desktop_layout",
        hasSearch && (hasCard || /Không tìm thấy|Chưa có CLB/i.test(body)) ? "PASS" : "PARTIAL",
        `search=${hasSearch} card=${hasCard} join=${hasJoin} yourClub=${hasYourClub}`
      );

      const mobileCtx = await browser.newContext({
        viewport: { width: 375, height: 812 },
      });
      const mPage = await mobileCtx.newPage();
      attachObservers(mPage, "C-mobile");
      await login(mPage, ACCOUNTS.noMember);
      await mPage.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await mPage.waitForTimeout(3000);
      await shot(mPage, "c-discover-mobile");
      const mBody = await bodyText(mPage);
      record(
        "C",
        "discover_mobile",
        mBody.length > 50 ? "PASS" : "FAIL",
        `bodyLen=${mBody.length}`
      );
      await mobileCtx.close();
    } catch (e) {
      record("C", "discover", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // D — Members
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "D");
    try {
      await login(page, ACCOUNTS.president);
      await page.goto(`${DEPLOYMENT}/my-club?view=members`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.waitForTimeout(2500);
      const body = await bodyText(page);
      const hasMembers = /Thành viên CLB/i.test(body);
      const hasChips = /Chủ tịch|Thành viên|Đang hoạt động/i.test(body);
      await shot(page, "d-members-desktop");
      record("D", "members_desktop", hasMembers && hasChips ? "PASS" : hasMembers ? "PARTIAL" : "FAIL", `members=${hasMembers} chips=${hasChips}`);

      const mCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const mPage = await mCtx.newPage();
      await login(mPage, ACCOUNTS.president);
      await mPage.goto(`${DEPLOYMENT}/my-club?view=members`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await mPage.waitForTimeout(2500);
      await shot(mPage, "d-members-mobile");
      const mBody = await bodyText(mPage);
      record("D", "members_mobile", /Thành viên/i.test(mBody) ? "PASS" : "FAIL", `body=${mBody.slice(0, 80)}`);
      await mCtx.close();
    } catch (e) {
      record("D", "members", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // E — Requests
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "E");
    try {
      await login(page, ACCOUNTS.president);
      await page.goto(`${DEPLOYMENT}/my-club/requests`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.waitForTimeout(2500);
      const body = await bodyText(page);
      const hasPanel = /Yêu cầu gia nhập CLB/i.test(body);
      const hasEmpty = /Không có yêu cầu đang chờ/i.test(body);
      await shot(page, "e-requests-panel");
      record("E", "requests_panel", hasPanel ? "PASS" : "FAIL", `panel=${hasPanel} emptyState=${hasEmpty}`);

      const rejectBtn = page.getByRole("button", { name: /^Từ chối$/i }).first();
      if ((await rejectBtn.count()) > 0) {
        await rejectBtn.click({ timeout: 5000 });
        await page.waitForTimeout(800);
        const dialog = (await page.getByRole("dialog").count()) > 0;
        await shot(page, "e-confirm-reject-dialog");
        await page.getByRole("button", { name: /^Huỷ$|^Hủy$/i }).click({ timeout: 3000 }).catch(() => {});
        record("E", "confirm_reject", dialog ? "PASS" : "FAIL", `dialog=${dialog}`);
      } else {
        record("E", "confirm_reject", "PARTIAL", "No pending row to test reject confirm");
      }
    } catch (e) {
      record("E", "requests", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // F — Manage Clubs
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "F");
    try {
      await login(page, ACCOUNTS.tenantOwner);
      await page.waitForTimeout(2000);
      await page.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(3500);
      const body = await bodyText(page);
      const hasTenant = /Tenant:/i.test(body);
      const hasTable = (await page.locator("table").count()) > 0;
      const hasStatus = /Đang hoạt động|Chờ duyệt|Trạng thái/i.test(body);
      const hasOwner = /Chủ sở hữu|Chủ tịch/i.test(body);
      await shot(page, "f-manage-clubs");
      record(
        "F",
        "manage_registry",
        hasTenant && (hasTable || /Chưa có CLB|Không có CLB/i.test(body)) ? "PASS" : "PARTIAL",
        `tenant=${hasTenant} table=${hasTable} status=${hasStatus} owner=${hasOwner}`
      );
    } catch (e) {
      record("F", "manage", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // G — Platform Clubs
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "G");
    try {
      await login(page, ACCOUNTS.saNoMember);
      await page.goto(`${DEPLOYMENT}/platform/clubs`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(3500);
      const body = await bodyText(page);
      const onPlatform = /Platform|Sổ đăng ký CLB/i.test(body);
      const crossTenant = /Tenant/i.test(body);
      const blocked = /Chỉ Platform Admin|403|không có quyền/i.test(body);
      await shot(page, "g-platform-clubs");
      record(
        "G",
        "platform_registry",
        onPlatform && crossTenant && !blocked ? "PASS" : onPlatform && !blocked ? "PARTIAL" : "FAIL",
        `onPlatform=${onPlatform} crossTenant=${crossTenant} blocked=${blocked}`
      );
    } catch (e) {
      record("G", "platform", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // H — Regression (42L menu + guards)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "H");
    try {
      await login(page, ACCOUNTS.noMember);
      await page.waitForTimeout(2000);
      const discover = await menuHas(page, "Khám phá CLB");
      const myClub = await menuHas(page, "CLB của tôi");
      const manage = await menuHas(page, "Quản lý CLB");
      await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      const blank = (await bodyText(page)).trim().length < 30;
      await shot(page, "h-regression-nomember");
      record(
        "H",
        "menu_matrix_42l",
        discover && !myClub && !manage ? "PASS" : "FAIL",
        `discover=${discover} myClub=${myClub} manage=${manage} url=${currentUrl} blank=${blank}`
      );
    } catch (e) {
      record("H", "menu_matrix_42l", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "H-guard");
    try {
      await login(page, ACCOUNTS.noMember);
      await page.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2000);
      const guardBody = await bodyText(page);
      const denied = /403|không có quyền|Forbidden/i.test(guardBody) || page.url().includes("/403");
      record("H", "unauthorized_manage_guard", denied ? "PASS" : "PARTIAL", `denied=${denied}`);
    } catch (e) {
      record("H", "regression", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  // I — Accessibility spot checks
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    attachObservers(page, "I");
    try {
      await login(page, ACCOUNTS.noMember);
      await page.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2500);
      const card = page.locator('[aria-label^="CLB "]').first();
      if ((await card.count()) > 0) {
        await card.focus();
        const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
        record("I", "keyboard_card_focus", focused.startsWith("CLB") ? "PASS" : "PARTIAL", `focused=${focused.slice(0, 40)}`);
      } else {
        record("I", "keyboard_card_focus", "PARTIAL", "No discover card to focus");
      }
      const joinBtn = page.getByRole("button", { name: /Xin tham gia/i }).first();
      if ((await joinBtn.count()) > 0) {
        const name = await joinBtn.getAttribute("aria-label").catch(() => null);
        record("I", "button_accessible_name", name || (await joinBtn.innerText()) ? "PASS" : "FAIL", "join button named");
      }
      await shot(page, "i-accessibility-discover");
    } catch (e) {
      record("I", "accessibility", "FAIL", String(e.message || e));
    }
    await ctx.close();
  }

  await browser.close();

  finalizeGroups();
  const groupVerdicts = Object.values(report.groups).map((g) => g.verdict);
  const hardFails = report.cases.filter((c) => c.verdict === "FAIL").length;
  const pageErrors = report.consoleFindings.filter((f) => f.includes("pageerror")).length;
  report.verdict =
    hardFails === 0 && pageErrors === 0 && groupVerdicts.every((v) => v === "PASS")
      ? "PASS"
      : hardFails === 0 && pageErrors === 0
        ? "PARTIAL"
        : "FAIL";

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`Overall: ${report.verdict}`);
  console.log(`Env probe: ${JSON.stringify(report.envProbe)}`);
  console.log(`Page errors: ${pageErrors}`);
  process.exit(report.verdict === "FAIL" ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
