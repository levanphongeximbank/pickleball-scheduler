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
  "batch-f"
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

const OPERATOR_SCREENS = [
  {
    id: "19",
    testId: "tournament-communications-page",
    suffix: "/communications",
    titleRe: /Trung tâm truyền thông/,
    viewports: [
      { file: "19_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "19_TABLET_768.png", width: 768, height: 1024 },
      { file: "19_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
  {
    id: "20",
    testId: "tournament-media-page",
    suffix: "/media",
    titleRe: /truyền thông & trình chiếu|Trình chiếu/i,
    viewports: [
      { file: "20_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "20_TABLET_768.png", width: 768, height: 1024 },
      { file: "20_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
  {
    id: "21",
    testId: "tournament-awards-page",
    suffix: "/awards",
    titleRe: /Giải thưởng/,
    viewports: [
      { file: "21_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "21_TABLET_768.png", width: 768, height: 1024 },
      { file: "21_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
  {
    id: "22",
    testId: "tournament-complete-page",
    suffix: "/complete",
    titleRe: /Hoàn tất giải đấu/,
    viewports: [
      { file: "22_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "22_TABLET_768.png", width: 768, height: 1024 },
      { file: "22_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
];

const PUBLIC_SCREEN = {
  id: "23",
  testId: "public-tournament-page",
  suffix: "/public",
  titleRe: /PICK_VN|Trang giải đấu công khai/,
  viewports: [
    { file: "23_DESKTOP_1440.png", width: 1440, height: 900 },
    { file: "23_TABLET_768.png", width: 768, height: 1024 },
    { file: "23_MOBILE_390.png", width: 390, height: 844 },
  ],
};

mkdirSync(OUT, { recursive: true });

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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const locators = [
      page.locator("#header-club-label"),
      page.locator("[aria-labelledby='header-club-label']"),
      page.getByRole("combobox").filter({ hasText: /CLB|Chọn/ }),
    ];
    for (const locator of locators) {
      if (!(await locator.count())) continue;
      try {
        await locator.first().click({ force: true, timeout: 4000 });
        const seed = page.getByRole("option").filter({ hasText: /HC Operator Seed Club venue-staging-a/ });
        if (await seed.count()) {
          await seed.first().click({ force: true });
          await page.waitForTimeout(1200);
        } else {
          await page.keyboard.press("Escape");
        }
      } catch {
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
    const active = await page.evaluate(() => localStorage.getItem("pickleball-active-club-v1") || "");
    if (active && active !== "default-club") return true;
    await page.waitForTimeout(800);
  }
  return false;
}

async function seedTournamentContext() {
  if (!PASSWORD) return "";
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    localStorage.setItem("pickleball-active-club-v1", "club-ecebf64c78f948ccb2b59842441eb26c");
    localStorage.setItem("pickleball-active-cluster-v1", "venue-staging-a-main");
  });
  await page.goto(`${BASE}/tournament`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  await selectSeedClub();
  return "";
}

const results = [];
const eventId = PASSWORD ? await seedTournamentContext() : "";
const eventQuery = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";

const selectedScreens = process.env.BATCH_F_ONLY
  ? OPERATOR_SCREENS.filter((screen) => screen.id === process.env.BATCH_F_ONLY)
  : OPERATOR_SCREENS;

for (const screen of selectedScreens) {
  if (!PASSWORD || process.env.BATCH_F_PUBLIC_ONLY) break;
  const target = `${BASE}/tournament/${TOURNAMENT_ID}${screen.suffix}${eventQuery}`;
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`[data-testid="${screen.testId}"]`, { timeout: 45000 });
  await page.evaluate(() => {
    localStorage.setItem("pickleball-active-club-v1", "club-ecebf64c78f948ccb2b59842441eb26c");
    localStorage.setItem("pickleball-active-cluster-v1", "venue-staging-a-main");
  });
  await selectSeedClub();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`[data-testid="${screen.testId}"]`, { timeout: 45000 });
  await selectSeedClub();
  await page.waitForTimeout(2000);
  try {
    await page.waitForFunction(
      () => !document.body.innerText.includes("Không tìm thấy giải"),
      null,
      { timeout: 30000 }
    );
  } catch {
    await page.evaluate(() => {
      localStorage.setItem("pickleball-active-club-v1", "club-ecebf64c78f948ccb2b59842441eb26c");
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector(`[data-testid="${screen.testId}"]`, { timeout: 45000 });
    await selectSeedClub();
    await page.waitForTimeout(2500);
  }
  for (const shot of screen.viewports) {
    await page.setViewportSize({ width: shot.width, height: shot.height });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, shot.file), fullPage: true });
    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      bodyText: document.body.innerText,
    }));
    results.push({
      file: shot.file,
      overflow: metrics.scrollWidth > metrics.innerWidth + 2,
      titleHit: screen.titleRe.test(metrics.bodyText),
    });
  }
}


if (!process.env.BATCH_F_ONLY) {
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.evaluate(() => {
  localStorage.setItem("pickleball-active-club-v1", "club-ecebf64c78f948ccb2b59842441eb26c");
  localStorage.setItem("pickleball-active-cluster-v1", "venue-staging-a-main");
});
const publicTarget = `${BASE}/tournament/${TOURNAMENT_ID}${PUBLIC_SCREEN.suffix}`;
await page.goto(publicTarget, { waitUntil: "domcontentloaded", timeout: 90000 });
try {
  await page.waitForSelector(`[data-testid="${PUBLIC_SCREEN.testId}"]`, { timeout: 90000 });
  await page.waitForFunction(
    () => {
      const text = document.body.innerText || "";
      return text.includes("PICK_VN") && !text.includes("Không tìm thấy trang công khai");
    },
    null,
    { timeout: 90000 }
  );
} catch (err) {
  await page.screenshot({ path: path.join(OUT, "DEBUG_PUBLIC_FAIL.png"), fullPage: true });
  throw err;
}
for (const shot of PUBLIC_SCREEN.viewports) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, shot.file), fullPage: true });
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    bodyText: document.body.innerText,
    hasSidebar: Boolean(document.querySelector('[data-testid="app-sidebar"]') || document.querySelector("nav.MuiDrawer-root")),
  }));
  results.push({
    file: shot.file,
    overflow: metrics.scrollWidth > metrics.innerWidth + 2,
    titleHit: PUBLIC_SCREEN.titleRe.test(metrics.bodyText),
    adminSidebar: metrics.hasSidebar,
  });
}
}

await browser.close();

const unexpectedErrors = pageErrors.filter((item) => !item.includes("node:crypto"));
const failed = results.filter((item) => item.overflow || item.adminSidebar === true || item.titleHit === false);
if (failed.length || unexpectedErrors.length) {
  console.error(JSON.stringify({ failed, unexpectedErrors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ out: OUT, results }, null, 2));
