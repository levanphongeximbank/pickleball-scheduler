import { mkdirSync } from "node:fs";
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
  "tournament-experience-production-strict-port",
  "batch-d"
);

loadProjectEnv();

const BASE = (
  process.env.SCREEN07_BASE ||
  process.env.SCREEN04_BASE ||
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
    id: "10",
    testId: "tournament-schedule-page",
    nav: "Lịch & sân",
    titleRe: /Lịch thi đấu/,
    viewports: [
      { file: "10_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "10_TABLET_768.png", width: 768, height: 1024 },
      { file: "10_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
  {
    id: "11",
    testId: "tournament-matches-page",
    nav: "Trung tâm trận",
    titleRe: /Trung tâm trận/,
    viewports: [
      { file: "11_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "11_TABLET_768.png", width: 768, height: 1024 },
      { file: "11_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
  {
    id: "12",
    testId: "tournament-standings-page",
    nav: "Kết quả & BXH",
    titleRe: /Kết quả & Bảng xếp hạng/,
    viewports: [
      { file: "12_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "12_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
  {
    id: "13",
    testId: "tournament-knockout-page",
    nav: "Loại trực tiếp",
    titleRe: /Vòng loại trực tiếp/,
    viewports: [
      { file: "13_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "13_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
  {
    id: "14",
    testId: "tournament-bracket-page",
    nav: "Nhánh đấu",
    titleRe: /Sơ đồ nhánh đấu/,
    viewports: [
      { file: "14_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "14_TABLET_768.png", width: 768, height: 1024 },
      { file: "14_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
];

mkdirSync(OUT, { recursive: true });

if (!PASSWORD) {
  throw new Error("STAGING_OWNER_A_PASSWORD is required to capture authenticated Batch D screens");
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

async function selectSeedClub() {
  await page.setViewportSize({ width: 1440, height: 900 });
  const locators = [
    page.locator("#header-club-label"),
    page.locator("[aria-labelledby='header-club-label']"),
    page.getByRole("combobox").filter({ hasText: /CLB|Chọn/ }),
    page.getByText("Chọn CLB...", { exact: false }),
  ];
  for (const locator of locators) {
    if (!(await locator.count())) continue;
    try {
      await locator.first().click({ force: true, timeout: 4000 });
      const seed = page.getByRole("option").filter({ hasText: /HC Operator Seed Club venue-staging-a/ });
      if (await seed.count()) {
        await seed.first().click({ force: true });
        await page.waitForTimeout(1000);
        return true;
      }
      const fallback = page.getByRole("option").filter({ hasText: /CLB Venue Staging A|venue-staging-a/ });
      if (await fallback.count()) {
        await fallback.first().click({ force: true });
        await page.waitForTimeout(1000);
        return true;
      }
      await page.keyboard.press("Escape");
    } catch {
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
  return false;
}

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector('input[type="email"], label:has-text("Email")', { timeout: 30000 });
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.getByRole("button", { name: "Đăng nhập" }).click();
await page.waitForTimeout(2500);
await page.goto(`${BASE}/tournament`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(1500);
await selectSeedClub();

const EXTRA_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 430, height: 932 },
  { width: 1024, height: 768 },
  { width: 1920, height: 1080 },
];

const results = [];
const selectedScreens = process.env.BATCH_D_ONLY
  ? SCREENS.filter((screen) => screen.id === process.env.BATCH_D_ONLY)
  : SCREENS;

for (const screen of selectedScreens) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectSeedClub();
  await page.goto(`${BASE}/tournament/${TOURNAMENT_ID}/group-draw`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="tournament-group-draw-page"]', { timeout: 45000 });
  await selectSeedClub();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/tournament/${TOURNAMENT_ID}/group-draw`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="tournament-group-draw-page"]', { timeout: 45000 });
  await page.waitForFunction(() => !document.body.innerText.includes("Không tìm thấy giải"), null, { timeout: 45000 });
  const suffix =
    screen.id === "10"
      ? "/schedule"
      : screen.id === "11"
        ? "/matches"
        : screen.id === "12"
          ? "/standings"
          : screen.id === "13"
            ? "/knockout"
            : "/bracket";
  await page.goto(`${BASE}/tournament/${TOURNAMENT_ID}${suffix}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`[data-testid="${screen.testId}"]`, { timeout: 45000 });
  await selectSeedClub();
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => !document.body.innerText.includes("Không tìm thấy giải"), null, { timeout: 45000 });
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
    const hasDevCopy =
      /canonical_tournament|dữ liệu mẫu|Wave D|updateTournamentCommand|events\[0\]|SSOT/.test(metrics.bodyText);
    results.push({
      file: shot.file,
      width: shot.width,
      overflow,
      hasDevCopy,
      titleHit: screen.titleRe.test(metrics.bodyText),
      bound: /Giải đấu 17\/8\/2026|Đôi nam|Lịch thi đấu|Trung tâm trận|Kết quả|Loại trực tiếp|nhánh/.test(metrics.bodyText),
    });
    console.log(`${shot.file} overflow=${overflow} title=${results.at(-1).titleHit} bound=${results.at(-1).bound} dev=${hasDevCopy}`);
  }
  for (const extra of EXTRA_VIEWPORTS) {
    await page.setViewportSize({ width: extra.width, height: extra.height });
    await page.waitForTimeout(250);
    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    }));
    const overflow = metrics.scrollWidth > metrics.innerWidth + 2;
    results.push({ file: `${screen.id}_${extra.width}`, width: extra.width, overflow, extra: true });
    console.log(`${screen.id} extra ${extra.width} overflow=${overflow}`);
  }
}

await browser.close();

const unexpectedErrors = pageErrors.filter((item) => !item.includes("node:crypto"));
const shots = results.filter((item) => !item.extra);
const failedOverflow = results.filter((item) => item.overflow);
const failedDev = shots.filter((item) => item.hasDevCopy);
const failedTitle = shots.filter((item) => !item.titleHit);
const failedBound = shots.filter((item) => !item.bound);
if (failedOverflow.length || failedDev.length || failedTitle.length || failedBound.length || unexpectedErrors.length) {
  console.error(JSON.stringify({ failedOverflow, failedDev, failedTitle, failedBound, unexpectedErrors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ out: OUT, results }, null, 2));
