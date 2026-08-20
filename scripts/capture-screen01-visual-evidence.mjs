import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { loadProjectEnv } from "./load-env.mjs";
import {
  resolveVercelAutomationBypass,
  getVercelBypassHeaders,
} from "./vercel-automation-bypass.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(
  rootDir,
  "docs",
  "v5",
  "qa-evidence",
  "tournament-experience-cutover-a1-screen01"
);

loadProjectEnv();

const BASE = (process.env.SCREEN01_BASE || "http://localhost:5192").replace(/\/+$/, "");
const EMAIL = process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local";
const PASSWORD = process.env.STAGING_OWNER_A_PASSWORD || "";

const VIEWPORTS = [
  { file: "AFTER_01_MOBILE_360.png", width: 360, height: 800 },
  { file: "AFTER_01_MOBILE_390.png", width: 390, height: 844 },
  { file: "AFTER_01_MOBILE_430.png", width: 430, height: 932 },
  { file: "AFTER_01_TABLET_768.png", width: 768, height: 1024 },
  { file: "AFTER_01_TABLET_1024.png", width: 1024, height: 768 },
  { file: "AFTER_01_DESKTOP_1440.png", width: 1440, height: 900 },
  { file: "AFTER_01_DESKTOP_1920.png", width: 1920, height: 1080 },
];

mkdirSync(OUT, { recursive: true });

function writeReference(src, destName) {
  const spec = `origin/feat/tournament-experience-ui-system-01:${src}`;
  const result = spawnSync("git", ["show", spec], { encoding: "buffer", maxBuffer: 20e6 });
  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout));
  }
  writeFileSync(path.join(OUT, destName), result.stdout);
}

writeReference(
  "docs/v5/qa-evidence/tournament-experience-phase2b/01_DESKTOP_1440.png",
  "REFERENCE_01_DESKTOP_1440.png"
);
writeReference(
  "docs/v5/qa-evidence/tournament-experience-phase2b/01_MOBILE_390.png",
  "REFERENCE_01_MOBILE_390.png"
);

if (!PASSWORD) {
  throw new Error("STAGING_OWNER_A_PASSWORD is required to capture authenticated /tournament");
}

const extraHeaders = {};
if (/vercel\.app$/i.test(new URL(BASE).host) || BASE.includes("vercel.app")) {
  const bypass = await resolveVercelAutomationBypass();
  Object.assign(extraHeaders, getVercelBypassHeaders(bypass.secret));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  extraHTTPHeaders: extraHeaders,
});
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector('input[type="email"], label:has-text("Email")', { timeout: 30000 });
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.getByRole("button", { name: "Đăng nhập" }).click();
await page.waitForTimeout(2500);

await page.goto(`${BASE}/tournament`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector('[data-testid="tournament-center-page"]', { timeout: 45000 });
await page.waitForTimeout(800);

const results = [];
for (const shot of VIEWPORTS) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.waitForTimeout(400);
  const dest = path.join(OUT, shot.file);
  await page.screenshot({ path: dest, fullPage: true });
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    bodyText: document.body.innerText,
  }));
  const overflow = metrics.scrollWidth > metrics.innerWidth + 2;
  const hasCreate = /Tạo giải/.test(metrics.bodyText);
  const hasEmpty = /Chưa có giải đấu/.test(metrics.bodyText);
  const hasDevCopy = /canonical_tournament_list|dữ liệu mẫu|Phạm vi hiện tại|Giao diện cũ/.test(
    metrics.bodyText
  );
  results.push({
    file: shot.file,
    width: shot.width,
    overflow,
    hasCreate,
    hasEmpty,
    hasDevCopy,
  });
  console.log(`${shot.file} overflow=${overflow} create=${hasCreate} empty=${hasEmpty}`);
}

await browser.close();

const unexpectedErrors = pageErrors.filter((item) => !item.includes("node:crypto"));
const failedOverflow = results.filter((item) => item.overflow);
const failedCreate = results.filter((item) => !item.hasCreate);
const failedDev = results.filter((item) => item.hasDevCopy);
if (failedOverflow.length || failedCreate.length || failedDev.length || unexpectedErrors.length) {
  console.error(
    JSON.stringify({ failedOverflow, failedCreate, failedDev, unexpectedErrors }, null, 2)
  );
  process.exit(1);
}

console.log(JSON.stringify({ out: OUT, pageErrors: unexpectedErrors, results }, null, 2));
