/**
 * TT-6C Preview browser smoke — connection badge + page render on staging preview.
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-phase-tt6c-preview-smoke.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { loadProjectEnv } from "./load-env.mjs";
import { resolveStagingPreviewUrl } from "./preview-url-utils.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt6");

const PROBE = { tournamentId: "phase23d-probe-tournament" };
const BTC_EMAIL = process.env.STAGING_BTC_EMAIL || "admin@staging.local";
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || null;
}

function record(report, id, pass, detail = "") {
  report.cases.push({ id, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}`);
}

async function login(page, baseUrl) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(BTC_EMAIL);
  await page.getByLabel(/^mật khẩu$/i).fill(QA_PASSWORD);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90000 });
}

async function main() {
  loadProjectEnv();
  const previewResolved = resolveStagingPreviewUrl(process.env.STAGING_PREVIEW_URL);
  const previewUrl =
    typeof previewResolved === "string"
      ? previewResolved
      : previewResolved?.baseUrl || null;

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "TT-6C",
    stagingRef: STAGING_REF,
    productionImpact: "NONE",
    previewUrl: previewResolved,
    previewBaseUrl: previewUrl,
    localCommitSha: gitSha(),
    flagExpected: "VITE_TT_REALTIME_ENABLED=true",
    cases: [],
    verdict: "PENDING",
    reportFile: "TT6C_BROWSER_E2E_REPORT.json",
  };

  if (!previewUrl) {
    record(report, "preview_url", false, "Missing STAGING_PREVIEW_URL");
    report.verdict = "SKIP";
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, report.reportFile), JSON.stringify(report, null, 2));
    console.log("No preview URL — browser smoke skipped.");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page, previewUrl);

    await page.goto(`${previewUrl}/tournament/team/${PROBE.tournamentId}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    const body = await page.locator("body").innerText({ timeout: 30000 }).catch(() => "");
    record(report, "btc_setup_render", body.length > 80 && !/403/.test(body));

    const banner = page.locator('[data-testid="tt-realtime-connection-banner"]');
    const chip = page.locator('[data-testid="tt-realtime-connection-status"]');
    const hasStatus =
      (await banner.count()) > 0 ||
      (await chip.count()) > 0 ||
      /đồng bộ|kết nối/i.test(body);
    record(report, "connection_status_ui", hasStatus);

    await page.goto(`${previewUrl}/team-portal/${PROBE.tournamentId}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    const portalBody = await page.locator("body").innerText({ timeout: 30000 }).catch(() => "");
    record(
      report,
      "captain_portal_render",
      portalBody.length > 40 && !/Không có quyền truy cập/i.test(portalBody),
      "May require captain account in full E2E"
    );
  } catch (error) {
    record(report, "browser_exception", false, String(error.message || error).slice(0, 200));
  } finally {
    await browser.close();
  }

  report.passCount = report.cases.filter((c) => c.pass).length;
  report.totalCount = report.cases.length;
  report.allPass = report.passCount === report.totalCount;
  report.verdict = report.allPass ? "PASS" : "FAIL";

  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, report.reportFile), JSON.stringify(report, null, 2));
  console.log(`TT-6C browser smoke: ${report.verdict}`);
  if (!report.allPass) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
