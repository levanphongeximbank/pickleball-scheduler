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
  "batch-e"
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
    id: "15",
    testId: "tournament-director-ops-page",
    suffix: "/director",
    titleRe: /Điều hành giải/,
    viewports: [
      { file: "15_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "15_TABLET_768.png", width: 768, height: 1024 },
      { file: "15_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
  {
    id: "16",
    testId: "tournament-court-board-page",
    suffix: "/courts",
    titleRe: /Bảng điều hành sân/,
    viewports: [
      { file: "16_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "16_TABLET_768.png", width: 768, height: 1024 },
      { file: "16_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
  {
    id: "17",
    testId: "tournament-referee-board-page",
    suffix: "/referees",
    titleRe: /Bảng trọng tài/,
    viewports: [
      { file: "17_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "17_TABLET_768.png", width: 768, height: 1024 },
      { file: "17_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
  {
    id: "18",
    testId: "tournament-exceptions-page",
    suffix: "/exceptions",
    titleRe: /Trung tâm xử lý sự cố/,
    viewports: [
      { file: "18_DESKTOP_1440.png", width: 1440, height: 900 },
      { file: "18_TABLET_768.png", width: 768, height: 1024 },
      { file: "18_MOBILE_390.png", width: 390, height: 844 },
    ],
  },
];

mkdirSync(OUT, { recursive: true });

if (!PASSWORD) {
  throw new Error("STAGING_OWNER_A_PASSWORD is required to capture authenticated Batch E screens");
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
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
          await page.waitForTimeout(1200);
        } else {
          const fallback = page.getByRole("option").filter({ hasText: /CLB Venue Staging A|venue-staging-a/ });
          if (await fallback.count()) {
            await fallback.first().click({ force: true });
            await page.waitForTimeout(1200);
          } else {
            await page.keyboard.press("Escape");
          }
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

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector('input[type="email"], label:has-text("Email")', { timeout: 30000 });
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.getByRole("button", { name: "Đăng nhập" }).click();
await page.waitForTimeout(2500);
await page.waitForFunction(() => !location.pathname.includes("/login"), null, { timeout: 30000 }).catch(() => {});
await page.evaluate(() => {
  localStorage.setItem("pickleball-active-club-v1", "club-ecebf64c78f948ccb2b59842441eb26c");
  localStorage.setItem("pickleball-active-cluster-v1", "venue-staging-a-main");
});
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
const selectedScreens = process.env.BATCH_E_ONLY
  ? SCREENS.filter((screen) => screen.id === process.env.BATCH_E_ONLY)
  : SCREENS;

async function snapshotShell(label) {
  return page.evaluate((tag) => {
    const club = document.querySelector("#header-club-label")?.textContent || "";
    const body = document.body.innerText || "";
    return {
      tag,
      href: location.href,
      club,
      missing: body.includes("Không tìm thấy giải"),
      hasDirector: body.includes("Điều hành giải"),
      hasCourts: body.includes("Bảng điều hành sân"),
      hasReferees: body.includes("Bảng trọng tài"),
      hasExceptions: body.includes("Trung tâm xử lý sự cố"),
    };
  }, label);
}

async function seedTournamentContext() {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/tournament`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
  await selectSeedClub();
  await page.goto(`${BASE}/tournament/${TOURNAMENT_ID}/group-draw`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="tournament-group-draw-page"]', { timeout: 45000 });
  await selectSeedClub();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/tournament/${TOURNAMENT_ID}/group-draw`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="tournament-group-draw-page"]', { timeout: 45000 });
  try {
    await page.waitForFunction(() => !document.body.innerText.includes("Không tìm thấy giải"), null, { timeout: 45000 });
  } catch (err) {
    console.log("SEED_FAIL", JSON.stringify(await snapshotShell("group-draw-still-missing")));
    await page.screenshot({ path: path.join(OUT, "DEBUG_SEED_FAIL.png"), fullPage: true });
    throw err;
  }
  const doiNam = page.getByRole("button", { name: /Đôi nam/ }).or(page.getByText("Đôi nam", { exact: false }));
  if (await doiNam.count()) {
    await doiNam.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }
  const seeded = await snapshotShell("group-draw-seeded");
  console.log("SEED", JSON.stringify(seeded));
  const href = seeded.href || "";
  const eventId = new URL(href).searchParams.get("eventId") || "";
  return eventId;
}

const eventId = await seedTournamentContext();
const eventQuery = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
console.log("EVENT_ID", eventId || "(none — single-event default)");

for (const screen of selectedScreens) {
  await page.setViewportSize({ width: 1440, height: 900 });
  const target = `${BASE}/tournament/${TOURNAMENT_ID}${screen.suffix}${eventQuery}`;
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`[data-testid="${screen.testId}"]`, { timeout: 45000 });
  console.log("NAV", JSON.stringify(await snapshotShell(`${screen.id}-before-club`)));
  await selectSeedClub();
  await page.waitForTimeout(1500);
  try {
    await page.waitForFunction(
      () => !document.body.innerText.includes("Không tìm thấy giải"),
      null,
      { timeout: 20000 }
    );
  } catch {
    console.log("MISSING_AFTER_GOTO", JSON.stringify(await snapshotShell(`${screen.id}-missing`)));
    await page.goto(`${BASE}/tournament/${TOURNAMENT_ID}/group-draw${eventQuery}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForSelector('[data-testid="tournament-group-draw-page"]', { timeout: 45000 });
    await selectSeedClub();
    await page.waitForFunction(() => !document.body.innerText.includes("Không tìm thấy giải"), null, {
      timeout: 45000,
    });
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector(`[data-testid="${screen.testId}"]`, { timeout: 45000 });
    await selectSeedClub();
    await page.waitForTimeout(2000);
    await page.waitForFunction(() => !document.body.innerText.includes("Không tìm thấy giải"), null, {
      timeout: 45000,
    });
  }
  console.log("READY", JSON.stringify(await snapshotShell(`${screen.id}-ready`)));
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
      /canonical_tournament|dữ liệu mẫu|Wave E|updateTournamentCommand|events\[0\]|SSOT|court-engine/.test(
        metrics.bodyText
      );
    results.push({
      file: shot.file,
      width: shot.width,
      overflow,
      hasDevCopy,
      titleHit: screen.titleRe.test(metrics.bodyText),
      bound: /Giải đấu 17\/8\/2026|Đôi nam|Điều hành giải|Bảng điều hành sân|Bảng trọng tài|Trung tâm xử lý sự cố/.test(
        metrics.bodyText
      ),
    });
    console.log(
      `${shot.file} overflow=${overflow} title=${results.at(-1).titleHit} bound=${results.at(-1).bound} dev=${hasDevCopy}`
    );
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
