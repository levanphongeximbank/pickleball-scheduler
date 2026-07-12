#!/usr/bin/env node
/**
 * V5-B.2E — Preview pre-flight before full browser E2E.
 * Verifies login page, staging target, V5 route + menu with cohort user.
 *
 * Exit 0 = ready
 * Exit 1 = V5 PREVIEW OR FEATURE FLAG NOT READY
 */
import { chromium } from "playwright";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

function fail(message) {
  console.error(`V5 PREVIEW OR FEATURE FLAG NOT READY — ${message}`);
  process.exit(1);
}

async function probeLogin(url, headers) {
  const res = await fetch(`${url}/login`, { headers, redirect: "follow" });
  if (!res.ok) {
    fail(`/login HTTP ${res.status}`);
  }
  const text = await res.text();
  if (text.includes("Authentication Required") && text.includes("Vercel")) {
    fail("Deployment Protection — set VERCEL_AUTOMATION_BYPASS_SECRET");
  }
  console.log(`PREVIEW_PROBE: /login HTTP ${res.status}`);
}

async function main() {
  loadProjectEnv();

  const previewUrl = String(process.env.STAGING_PREVIEW_URL || "").trim().replace(/\/+$/, "");
  const playerEmail = String(process.env.STAGING_PLAYER_EMAIL || "player@staging.local").trim();
  const playerPassword = String(process.env.STAGING_PLAYER_PASSWORD || "").trim();
  const bypass = String(
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS || "",
  ).trim();

  if (!previewUrl) {
    fail("STAGING_PREVIEW_URL missing");
  }
  if (!previewUrl.startsWith("https://")) {
    fail("STAGING_PREVIEW_URL must use https");
  }
  if (previewUrl.includes(PRODUCTION_REF)) {
    fail("production ref in preview URL");
  }
  if (!playerPassword) {
    fail("STAGING_PLAYER_PASSWORD missing");
  }

  const headers = {};
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
  }

  let productionHits = 0;
  const browser = await chromium.launch({
    headless: String(process.env.HEADLESS ?? "true").toLowerCase() !== "false",
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : {},
  });
  const page = await context.newPage();

  page.on("request", (req) => {
    if (req.url().includes(PRODUCTION_REF)) {
      productionHits += 1;
    }
  });

  try {
    await probeLogin(previewUrl, headers);

    await page.goto(`${previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.getByLabel(/^email$/i).fill(playerEmail);
    await page.getByLabel(/^mật khẩu$/i).fill(playerPassword);
    await page.getByRole("button", { name: /^đăng nhập$/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90_000 });

    await page.goto(`${previewUrl}/player/skill-assessment-v5`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });

    const onRoute = page.url().includes("/player/skill-assessment-v5");
    const menuDomCount = await page.getByText(/đánh giá v5 \(shadow\)/i).count();
    let menuOk =
      menuDomCount > 0 ||
      (await page
        .getByText(/đánh giá v5 \(shadow\)/i)
        .first()
        .isVisible({ timeout: 10_000 })
        .catch(() => false));
    const pageReady = await page
      .getByTestId("skill-assessment-v5-page")
      .isVisible({ timeout: 30_000 })
      .catch(() => false);
    const startVisible = await page
      .getByTestId("v5-start-assessment")
      .isVisible({ timeout: 30_000 })
      .catch(() => false);
    const workspaceVisible = await page
      .getByTestId("v5-assessment-workspace")
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
    const shadowNoticeVisible = await page
      .getByTestId("v5-shadow-notice")
      .isVisible({ timeout: 30_000 })
      .catch(() => false);
    const blockedCopyVisible = await page
      .getByText(/đánh giá trình độ v5/i)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (productionHits > 0) {
      fail(`production Supabase requests detected (${productionHits})`);
    }
    if (!menuOk) {
      fail('menu "Đánh giá V5 (shadow)" not visible — check VITE_PICK_VN_RATING_V5_ENABLED');
    }
    if (!onRoute) {
      fail("route /player/skill-assessment-v5 not reachable");
    }
    if (!pageReady && !startVisible && !workspaceVisible && !shadowNoticeVisible && !blockedCopyVisible) {
      fail("V5 assessment page elements not found on Preview");
    }

    console.log("PREVIEW_PREFLIGHT: PASS");
    console.log(`  feature_flag_preview: PASS`);
    console.log(`  menu_v5: ${menuOk}`);
    console.log(`  route_v5: ${onRoute}`);
    console.log(`  page_ready: ${pageReady || startVisible || workspaceVisible || shadowNoticeVisible}`);
    console.log(`  production_requests: ${productionHits}`);
  } catch (err) {
    fail(err?.message || String(err));
  } finally {
    await browser.close().catch(() => {});
  }
}

main();
