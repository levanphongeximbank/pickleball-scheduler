/**
 * Debug captain session + portal body on Preview (staging only).
 */
import { chromium } from "playwright";
import { loadProjectEnv } from "./load-env.mjs";
import { resolveStagingPreviewUrl } from "./preview-url-utils.mjs";
import { getPhase15DeploymentUrl } from "./phase15-vercel-curl-proxy.mjs";

loadProjectEnv();

const baseUrl = resolveStagingPreviewUrl(getPhase15DeploymentUrl()).baseUrl;
const email = process.env.STAGING_CAPTAIN_A_EMAIL || "player@staging.local";
const password = process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358";
const tour = "phase23d-probe-tournament";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const profileResponses = [];
page.on("response", async (res) => {
  const url = res.url();
  if (url.includes("/rest/v1/profiles") && res.request().method() === "GET") {
    try {
      profileResponses.push({
        status: res.status(),
        body: await res.text(),
      });
    } catch {
      profileResponses.push({ status: res.status(), body: "[unreadable]" });
    }
  }
});

await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
await page.getByLabel(/^email$/i).fill(email);
await page.getByLabel(/^mật khẩu$/i).fill(password);
await page.getByRole("button", { name: /^đăng nhập$/i }).click();
await page.waitForFunction(
  () => {
    try {
      const raw = localStorage.getItem("pickleball-auth-session-v1");
      return Boolean(raw && JSON.parse(raw)?.user?.id);
    } catch {
      return false;
    }
  },
  { timeout: 90000 }
);

const sessionAfterLogin = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem("pickleball-auth-session-v1") || "{}");
  } catch {
    return null;
  }
});

await page.goto(`${baseUrl}/team-portal/${tour}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);

const sessionAfterPortal = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem("pickleball-auth-session-v1") || "{}");
  } catch {
    return null;
  }
});

const profileFetch = await page.evaluate(async () => {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.includes("supabase") || k.includes("auth"));
    const mod = window.__SUPABASE__ || null;
    return { storageKeys: keys.slice(0, 8), hasSupabaseGlobal: Boolean(mod) };
  } catch (e) {
    return { error: String(e) };
  }
});

const body = await page.locator("body").innerText().catch(() => "");
const url = page.url();

console.log(
  JSON.stringify(
    {
      baseUrl,
      email,
      url,
      profileResponses: profileResponses.slice(0, 3),
      sessionAfterLogin: sessionAfterLogin?.user
        ? {
            id: sessionAfterLogin.user.id,
            role: sessionAfterLogin.user.role,
            playerId: sessionAfterLogin.user.playerId,
            clubId: sessionAfterLogin.user.clubId,
            venueId: sessionAfterLogin.user.venueId,
          }
        : null,
      sessionAfterPortal: sessionAfterPortal?.user
        ? {
            id: sessionAfterPortal.user.id,
            role: sessionAfterPortal.user.role,
            playerId: sessionAfterPortal.user.playerId,
            clubId: sessionAfterPortal.user.clubId,
            venueId: sessionAfterPortal.user.venueId,
          }
        : null,
      bodySnippet: body.slice(0, 500),
    },
    null,
    2
  )
);

await browser.close();
