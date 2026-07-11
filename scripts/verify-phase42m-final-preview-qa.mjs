/**
 * Phase 42M — Final Preview QA (A/E/H/loading + full regression).
 * Prerequisite: node scripts/phase42l-staging-auth.mjs
 *               node scripts/phase42m-staging-qa-seed.mjs
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-phase42m-final-preview-qa.mjs
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
  leaveMember: "player.nomember@staging.local",
  president: "player@staging.local",
  tenantOwner: "owner@staging.local",
  noMember: "qa42l.nomember@staging.local",
};

const report = {
  phase: "42M-final",
  preview: DEPLOYMENT,
  commit: process.env.PHASE42M_COMMIT || "13955f9",
  deploymentId: process.env.PHASE42M_DEPLOYMENT_ID || "dpl_Ev83SXFLFwQsCxonbfETyMSL92ZT",
  cases: {},
  groups: {},
  consoleFindings: [],
  networkFindings: [],
  screenshots: [],
  verdict: "PENDING",
};

function setCase(key, verdict, evidence, extra = {}) {
  report.cases[key] = { verdict, evidence, ...extra };
  console.log(`[${verdict}] ${key}: ${evidence}`);
}

function groupVerdict(prefix) {
  const entries = Object.entries(report.cases).filter(([k]) => k.startsWith(prefix));
  if (!entries.length) return "FAIL";
  if (entries.every(([, v]) => v.verdict === "PASS")) return "PASS";
  if (entries.some(([, v]) => v.verdict === "PASS")) return "PARTIAL";
  return "FAIL";
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
    if (res.status() >= 400 && url.includes("club_list_registry")) {
      report.networkFindings.push(`${label} registry ${res.status()} ${url.slice(0, 100)}`);
    }
  });
}

async function login(page, email) {
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(QA_PASSWORD);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 90000,
    waitUntil: "domcontentloaded",
  });
}

async function bodyText(page) {
  return page.locator("body").innerText({ timeout: 15000 }).catch(() => "");
}

async function runCaseA(browser) {
  // Desktop leave confirm — cancel only
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  attachObservers(page, "A-desktop");
  let registryCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("club_list_registry")) registryCalls += 1;
  });
  try {
    await login(page, ACCOUNTS.leaveMember);
    await page.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3000);
    const leaveBtn = page.getByRole("button", { name: /Rời câu lạc bộ/i }).first();
    const visible = (await leaveBtn.count()) > 0;
    if (!visible) {
      setCase("A.leave_button", "FAIL", "Rời CLB not visible");
      await shot(page, "a-my-club-leave-missing");
      await ctx.close();
      return;
    }
    setCase("A.leave_button", "PASS", "Rời CLB visible");
    await leaveBtn.click();
    await page.waitForTimeout(800);
    const dialog = page.getByRole("dialog");
    const dialogVisible = (await dialog.count()) > 0;
    const title = dialogVisible ? await dialog.innerText().catch(() => "") : "";
    const hasCancel = (await page.getByRole("button", { name: /^Huỷ$|^Hủy$/i }).count()) > 0;
    const hasConfirm = (await page.getByRole("button", { name: /^Rời CLB$/i }).count()) > 0;
    await shot(page, "a-confirm-leave-dialog");
    setCase(
      "A.leave_dialog",
      dialogVisible && hasCancel && hasConfirm ? "PASS" : "PARTIAL",
      `dialog=${dialogVisible} cancel=${hasCancel} confirm=${hasConfirm} title=${title.slice(0, 60)}`
    );
    await page.getByRole("button", { name: /^Huỷ$|^Hủy$/i }).click({ timeout: 5000 });
    await page.waitForTimeout(500);
    const stillMember = (await page.getByRole("button", { name: /Rời câu lạc bộ/i }).count()) > 0;
    setCase("A.leave_cancel", stillMember ? "PASS" : "FAIL", `stillOnMyClub=${stillMember}`);
  } catch (e) {
    setCase("A.desktop", "FAIL", String(e.message || e));
  }
  await ctx.close();

  // Mobile
  const mCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });
  const mPage = await mCtx.newPage();
  attachObservers(mPage, "A-mobile");
  try {
    await login(mPage, ACCOUNTS.leaveMember);
    await mPage.goto(`${DEPLOYMENT}/my-club`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await mPage.waitForTimeout(2500);
    const leaveBtn = mPage.getByRole("button", { name: /Rời câu lạc bộ/i }).first();
    if ((await leaveBtn.count()) > 0) {
      await leaveBtn.click();
      await mPage.waitForTimeout(800);
      await shot(mPage, "a-confirm-leave-mobile");
      await mPage.getByRole("button", { name: /^Huỷ$|^Hủy$/i }).click({ timeout: 5000 }).catch(() => {});
      setCase("A.leave_mobile", "PASS", "Mobile dialog captured");
    } else {
      setCase("A.leave_mobile", "FAIL", "No leave button on mobile");
    }
  } catch (e) {
    setCase("A.leave_mobile", "FAIL", String(e.message || e));
  }
  await mCtx.close();
}

async function runCaseE(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  attachObservers(page, "E");
  try {
    await login(page, ACCOUNTS.president);
    await page.goto(`${DEPLOYMENT}/my-club/requests`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(3500);
    const body = await bodyText(page);
    const hasPending = /Phase 42M QA pending|qa42l\.nomember|pending/i.test(body);
    const rejectBtn = page.getByRole("button", { name: /^Từ chối$/i }).first();
    if ((await rejectBtn.count()) === 0) {
      setCase("E.pending_row", "FAIL", "No reject button / pending row");
      await shot(page, "e-requests-panel");
      await ctx.close();
      return;
    }
    setCase("E.pending_row", "PASS", "Pending row visible");
    await rejectBtn.click();
    await page.waitForTimeout(800);
    const dialogVisible = (await page.getByRole("dialog").count()) > 0;
    await shot(page, "e-confirm-reject-dialog");
    setCase("E.reject_dialog", dialogVisible ? "PASS" : "FAIL", `dialog=${dialogVisible}`);

    // Cancel first
    await page.getByRole("button", { name: /^Huỷ$|^Hủy$/i }).click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const stillPending = (await page.getByRole("button", { name: /^Từ chối$/i }).count()) > 0;
    setCase("E.reject_cancel", stillPending ? "PASS" : "FAIL", `stillPending=${stillPending}`);

    // Confirm reject (dialog button)
    await page.getByRole("button", { name: /^Từ chối$/i }).first().click({ timeout: 5000 });
    await page.waitForTimeout(600);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /^Từ chối$/i }).click({ timeout: 5000 });
    await page.waitForTimeout(2500);
    const afterBody = await bodyText(page);
    const emptyAfter = /Không có yêu cầu đang chờ|Không có yêu cầu/i.test(afterBody);
    const feedback =
      /Đã từ chối yêu cầu tham gia/i.test(afterBody) ||
      (await page.getByRole("alert").count()) > 0 ||
      emptyAfter;
    setCase(
      "E.reject_success",
      feedback ? "PASS" : "PARTIAL",
      `feedback=${feedback} emptyAfter=${emptyAfter}`
    );
    await shot(page, "e-reject-success");
  } catch (e) {
    setCase("E", "FAIL", String(e.message || e));
  }
  await ctx.close();
}

async function runCaseH(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  attachObservers(page, "H");
  let registryRpc = 0;
  page.on("request", (req) => {
    if (req.url().includes("club_list_registry")) registryRpc += 1;
  });
  try {
    await login(page, ACCOUNTS.noMember);
    await page.waitForTimeout(2000);
    const manageVisible = (await page.getByRole("link", { name: /Quản lý CLB/i }).count()) > 0;
    setCase("H.sidebar_manage_hidden", manageVisible ? "FAIL" : "PASS", `manageLink=${manageVisible}`);

    await page.goto(`${DEPLOYMENT}/manage/clubs`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3000);
    const url = page.url();
    const body = await bodyText(page);
    const heading = (await page.locator("h1, h5").first().innerText().catch(() => "")).trim();
    const guarded =
      url.includes("/403") ||
      /không có quyền|Forbidden|403|Chỉ Platform|Chọn tenant/i.test(body) ||
      url.includes("/discover-clubs") ||
      url.includes("/login");
    const showsRegistryTable =
      (await page.locator("table tbody tr").count()) > 0 && /Quản lý CLB|Sổ đăng ký/i.test(body);
    await shot(page, "h-manage-guard-player");
    setCase(
      "H.manage_guard",
      guarded && !showsRegistryTable ? "PASS" : showsRegistryTable ? "FAIL" : "PARTIAL",
      `url=${url} heading=${heading.slice(0, 40)} registryRpc=${registryRpc} guarded=${guarded} table=${showsRegistryTable}`
    );
  } catch (e) {
    setCase("H", "FAIL", String(e.message || e));
  }
  await ctx.close();
}

async function runLoadingSkeleton(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  attachObservers(page, "loading");
  try {
    await login(page, ACCOUNTS.tenantOwner);
    await page.route("**/rpc/club_list_registry**", async (route) => {
      await new Promise((r) => setTimeout(r, 5000));
      await route.continue();
    });
    const navigation = page.goto(`${DEPLOYMENT}/manage/clubs`, {
      waitUntil: "commit",
      timeout: 120000,
    });
    await page.waitForTimeout(900);
    const hasSkeleton =
      (await page.locator('[aria-label="Đang tải sổ đăng ký CLB"]').count()) > 0 ||
      (await page.locator(".MuiSkeleton-root").count()) > 0;
    await shot(page, "loading-skeleton");
    await navigation;
    await page.waitForTimeout(1000);
    const bodyLen = (await bodyText(page)).length;
    const blank = bodyLen < 40;
    setCase(
      "loading.skeleton",
      hasSkeleton && !blank ? "PASS" : hasSkeleton ? "PARTIAL" : "FAIL",
      `skeleton=${hasSkeleton} bodyLen=${bodyLen} blank=${blank}`
    );
  } catch (e) {
    setCase("loading.skeleton", "FAIL", String(e.message || e));
  }
  await ctx.close();
}

async function runRegressionQuick(browser) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  attachObservers(page, "regression");
  try {
    await login(page, ACCOUNTS.noMember);
    await page.goto(`${DEPLOYMENT}/discover-clubs`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2000);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    setCase("regression.mobile_overflow", scrollW <= clientW + 8 ? "PASS" : "FAIL", `${scrollW}/${clientW}`);
  } catch (e) {
    setCase("regression.mobile_overflow", "FAIL", String(e.message || e));
  }
  await ctx.close();
}

async function run() {
  loadProjectEnv();
  fs.mkdirSync(EVIDENCE, { recursive: true });
  console.log(`Phase 42M Final QA — ${DEPLOYMENT}\n`);

  const browser = await chromium.launch({ headless: true });
  await runCaseA(browser);
  await runCaseE(browser);
  await runCaseH(browser);
  await runLoadingSkeleton(browser);
  await runRegressionQuick(browser);
  await browser.close();

  report.groups = {
    A: groupVerdict("A."),
    E: groupVerdict("E."),
    H: groupVerdict("H."),
    loading: report.cases["loading.skeleton"]?.verdict || "FAIL",
    regression: groupVerdict("regression."),
  };

  const pageErrors = report.consoleFindings.filter((f) => f.includes("pageerror")).length;
  const hardFails = Object.values(report.cases).filter((c) => c.verdict === "FAIL").length;
  const allGroups = [report.groups.A, report.groups.E, report.groups.H, report.groups.loading];
  report.verdict =
    hardFails === 0 && pageErrors === 0 && allGroups.every((g) => g === "PASS")
      ? "PASS"
      : hardFails === 0 && pageErrors === 0
        ? "PARTIAL"
        : "FAIL";

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`Overall: ${report.verdict}`);
  console.log(`Groups: ${JSON.stringify(report.groups)}`);
  process.exit(report.verdict === "FAIL" ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
