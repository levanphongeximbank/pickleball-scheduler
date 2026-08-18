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
  "tournament-experience-production-strict-port"
);

loadProjectEnv();

const BASE = (
  process.env.SCREEN02_BASE ||
  process.env.SCREEN01_BASE ||
  "https://pickleball-scheduler-git-feat-tourn-44b163-pickleball-scheduler.vercel.app"
).replace(/\/+$/, "");
const EMAIL = process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local";
const PASSWORD = process.env.STAGING_OWNER_A_PASSWORD || "";
const TOURNAMENT_ID =
  process.env.SCREEN02_TOURNAMENT_ID || "fc6da50a-b174-4187-af88-e38a025f22a5";

const SCREENS = [
  {
    id: "02",
    testId: "tournament-overview-page",
    path: `/tournament/${TOURNAMENT_ID}/overview`,
    viewports: [
      { file: "02_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "02_MOBILE_390.png", width: 390, height: 844 },
    ],
    reference: [
      ["docs/v5/qa-evidence/tournament-experience-phase2b/02_DESKTOP_1440.png", "REFERENCE_02_DESKTOP_1440.png"],
      ["docs/v5/qa-evidence/tournament-experience-phase2b/02_MOBILE_390.png", "REFERENCE_02_MOBILE_390.png"],
    ],
  },
  {
    id: "03",
    testId: "tournament-settings-page",
    path: `/tournament/${TOURNAMENT_ID}/settings`,
    viewports: [
      { file: "03_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "03_TABLET_768.png", width: 768, height: 1024 },
      { file: "03_MOBILE_390.png", width: 390, height: 844 },
    ],
    reference: [
      ["docs/v5/qa-evidence/tournament-experience-phase2b/03_DESKTOP_1440.png", "REFERENCE_03_DESKTOP_1440.png"],
      ["docs/v5/qa-evidence/tournament-experience-phase2b/03_MOBILE_390.png", "REFERENCE_03_MOBILE_390.png"],
      ["docs/v5/qa-evidence/tournament-experience-phase2b/03_TABLET_768.png", "REFERENCE_03_TABLET_768.png"],
    ],
  },
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

for (const screen of SCREENS) {
  for (const [src, dest] of screen.reference) {
    writeReference(src, dest);
  }
}

if (!PASSWORD) {
  throw new Error("STAGING_OWNER_A_PASSWORD is required to capture authenticated screens 02–03");
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
await page.waitForTimeout(1200);

const clubCombo = page.getByRole("combobox").filter({ hasText: /CLB|Chọn/ }).first();
if (await clubCombo.count()) {
  await clubCombo.click();
  const seed = page.getByRole("option").filter({ hasText: /HC Operator|Seed Club|Venue Staging A/ }).first();
  if (await seed.count()) {
    await seed.click();
    await page.waitForTimeout(800);
  } else {
    await page.keyboard.press("Escape");
  }
}

const results = [];
for (const screen of SCREENS) {
  await page.goto(`${BASE}${screen.path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`[data-testid="${screen.testId}"]`, { timeout: 45000 });
  await page.waitForTimeout(800);
  for (const shot of screen.viewports) {
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
    const hasDevCopy = /canonical_tournament|dữ liệu mẫu|Wave A1|updateTournamentCommand|official_open/.test(
      metrics.bodyText
    );
    results.push({
      file: shot.file,
      width: shot.width,
      overflow,
      hasDevCopy,
      titleHit: /Tổng quan giải đấu|Cài đặt Giải đấu/.test(metrics.bodyText),
    });
    console.log(`${shot.file} overflow=${overflow} title=${results.at(-1).titleHit} dev=${hasDevCopy}`);
  }
}

await browser.close();

const unexpectedErrors = pageErrors.filter((item) => !item.includes("node:crypto"));
const failedOverflow = results.filter((item) => item.overflow);
const failedDev = results.filter((item) => item.hasDevCopy);
const failedTitle = results.filter((item) => !item.titleHit);
if (failedOverflow.length || failedDev.length || failedTitle.length || unexpectedErrors.length) {
  console.error(JSON.stringify({ failedOverflow, failedDev, failedTitle, unexpectedErrors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ out: OUT, results }, null, 2));
