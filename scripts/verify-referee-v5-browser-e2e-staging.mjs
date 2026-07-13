#!/usr/bin/env node
/**
 * V5-D.4 — Remote UI browser E2E (doubles + singles) on staging DB.
 *
 * Usage:
 *   node scripts/verify-referee-v5-browser-e2e-staging.mjs
 *
 * Env (.env.staging-qa.local):
 *   STAGING_PREVIEW_URL=https://<preview>.vercel.app  (preferred)
 *   STAGING_OWNER_A_PASSWORD or PHASE42L_QA_PASSWORD
 *   VITE_SUPABASE_URL / STAGING_SUPABASE_URL (staging ref)
 *
 * Fallback: spawns local Vite dev on :5174 with remote flags when preview URL missing.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import {
  assertStagingOnly,
  createStagingService,
  FIXTURE,
  resetMatchFromSeed,
  snapshotMatch,
  writeReport,
} from "./referee-v5-staging-harness.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const results = [];
let devServer = null;
let baseUrl = "";

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

async function waitForDevServer(url) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok || res.status === 404) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`dev server not reachable at ${url}`);
}

async function loginViaForm(page, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90000 });
}

async function waitForRemoteReady(page) {
  await page.goto(page.url(), { waitUntil: "networkidle" }).catch(() => {});
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (bodyText.includes("Feature flag đang tắt")) {
    throw new Error("VITE_REFEREE_V5_ENABLED not active in preview build");
  }
  if (page.url().includes("/403")) {
    throw new Error("route blocked by SuperAdminRouteGuard");
  }
  await page.waitForSelector('[data-testid="referee-v5-workspace"]', { timeout: 90000 });
  await page.waitForSelector('[data-testid="remote-mode-badge"]', { timeout: 30000 });
  const status = await page.getByTestId("referee-connection-status").textContent();
  if (status?.includes("Lỗi kết nối")) {
    throw new Error(`remote-error: ${status}`);
  }
  await page.waitForSelector('[data-testid="btn-start-match"]:not([disabled])', { timeout: 30000 });
}

async function clickCommand(page, testId) {
  await page.getByTestId(testId).click();
  await page.waitForTimeout(800);
}

async function confirmDialogIfPresent(page) {
  const dialog = page.getByTestId("referee-confirmation-dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByTestId("referee-confirm-action").click();
    await page.waitForTimeout(500);
  }
}

async function readScore(page) {
  const a = await page.getByTestId("score-team-a").textContent();
  const b = await page.getByTestId("score-team-b").textContent();
  return { teamA: Number.parseInt(a, 10) || 0, teamB: Number.parseInt(b, 10) || 0 };
}

async function runDoublesFlow(page, service) {
  await resetMatchFromSeed(service, FIXTURE.MATCH_DOUBLES);
  await page.goto(`${baseUrl}/dev/referee-v5?fixture=staging-doubles`, { waitUntil: "domcontentloaded" });
  await waitForRemoteReady(page);

  const players = await page.locator('[data-testid^="player-slot-"]').count();
  record("doubles_four_players", players === 4, `count=${players}`);

  await clickCommand(page, "btn-start-match");
  let score = await readScore(page);
  record("doubles_start_match", score.teamA === 0 && score.teamB === 0, JSON.stringify(score));

  const serverBefore = await page.getByTestId("serve-context-server").textContent();
  await clickCommand(page, "btn-team-a-won-rally");
  score = await readScore(page);
  record("doubles_serving_team_wins", score.teamA === 1, JSON.stringify(score));

  await clickCommand(page, "btn-team-b-won-rally");
  const serverAfterB1 = await page.getByTestId("serve-context-server").textContent();
  record("doubles_server1_lost_no_score", (await readScore(page)).teamA === 1, `server ${serverBefore} -> ${serverAfterB1}`);

  await clickCommand(page, "btn-team-b-won-rally");
  record("doubles_server2_lost_sideout", (await readScore(page)).teamA === 1, "score unchanged on side-out");

  await clickCommand(page, "btn-team-b-won-rally");
  record("doubles_new_serving_team_point", (await readScore(page)).teamB === 1, "team B scored");

  await clickCommand(page, "btn-switch-ends");
  await confirmDialogIfPresent(page);
  record("doubles_switch_ends", true, "switch ends confirmed");

  await clickCommand(page, "btn-undo");
  const afterUndo = await readScore(page);
  record("doubles_undo", afterUndo.teamB === 0, JSON.stringify(afterUndo));

  const snapBeforeReload = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForRemoteReady(page);
  const scoreAfterReload = await readScore(page);
  const snapAfterReload = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  record(
    "doubles_reload_persistence",
    snapAfterReload.version === snapBeforeReload.version && scoreAfterReload.teamA === afterUndo.teamA,
    JSON.stringify({ scoreAfterReload, snap: snapAfterReload }),
  );
}

async function runSinglesFlow(page, service) {
  await resetMatchFromSeed(service, FIXTURE.MATCH_SINGLES);
  await page.goto(`${baseUrl}/dev/referee-v5?fixture=staging-singles`, { waitUntil: "domcontentloaded" });
  await waitForRemoteReady(page);

  const players = await page.locator('[data-testid^="player-slot-"]').count();
  record("singles_two_players", players === 2, `count=${players}`);

  const serverNumber = page.getByTestId("serve-context-server-number");
  record("singles_no_server_number", (await serverNumber.count()) === 0 || !(await serverNumber.isVisible()), "no S1/S2 UI");

  await clickCommand(page, "btn-start-match");
  await clickCommand(page, "btn-team-a-won-rally");
  record("singles_rally", (await readScore(page)).teamA === 1, "team A point");

  await clickCommand(page, "btn-switch-ends");
  await confirmDialogIfPresent(page);
  const serverAfterSwitch = await page.getByTestId("serve-context-server").textContent();
  record("singles_switch_ends_server_unchanged", Boolean(serverAfterSwitch), serverAfterSwitch || "");

  await clickCommand(page, "btn-undo");
  record("singles_undo", (await readScore(page)).teamA === 0, "undo restored");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForRemoteReady(page);
  record("singles_reload", (await readScore(page)).teamA === 0, "persisted after reload");
}

function startLocalDev(stagingUrl, anonKey) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      VITE_REFEREE_V5_ENABLED: "true",
      VITE_REFEREE_V5_DATA_MODE: "remote",
      VITE_RBAC_ENABLED: "false",
      VITE_SUPABASE_URL: stagingUrl,
      VITE_SUPABASE_ANON_KEY: anonKey,
    };
    const viteBin = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
    devServer = spawn(process.execPath, [viteBin, "--port", "5174", "--strictPort"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let resolved = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      if (!resolved && /ready in|Local:\s+http/i.test(text)) {
        resolved = true;
        resolve("http://localhost:5174");
      }
    };
    devServer.stdout.on("data", onData);
    devServer.stderr.on("data", onData);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve("http://localhost:5174");
      }
    }, 60000);
    devServer.on("error", reject);
  });
}

async function main() {
  loadProjectEnv();
  assertStagingOnly();
  const { url, anonKey } = getStagingSupabaseEnv();
  if (String(url).includes(PRODUCTION_REF)) {
    throw new Error("STOP — production");
  }

  const preview = String(process.env.STAGING_PREVIEW_URL || "").trim().replace(/\/+$/, "");
  if (preview) {
    baseUrl = preview;
    console.log(`Using STAGING_PREVIEW_URL: ${baseUrl}`);
  } else {
    console.log("STAGING_PREVIEW_URL missing — starting local Vite dev with remote flags");
    baseUrl = await startLocalDev(url, anonKey);
    await waitForDevServer(baseUrl);
    console.log(`Local dev: ${baseUrl}`);
  }

  const password =
    String(process.env.STAGING_OWNER_A_PASSWORD || process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();
  const service = createStagingService();
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginViaForm(page, "owner@staging.local", password);
    await runDoublesFlow(page, service);
    await runSinglesFlow(page, service);
  } catch (err) {
    const diag = {
      error: String(err.message || err),
      url: page.url(),
      bodySnippet: (await page.locator("body").innerText().catch(() => "")).slice(0, 500),
    };
    record("browser_e2e_blocked", false, JSON.stringify(diag));
    writeReport("REMOTE_UI_DOUBLES_REPORT.json", { pass: false, blocked: true, diag, results });
    writeReport("REMOTE_UI_SINGLES_REPORT.json", { pass: false, blocked: true, diag, results });
    throw err;
  } finally {
    await browser.close();
    if (devServer) {
      devServer.kill("SIGTERM");
    }
  }

  const doublesResults = results.filter((r) => r.id.startsWith("doubles_"));
  const singlesResults = results.filter((r) => r.id.startsWith("singles_"));
  writeReport("REMOTE_UI_DOUBLES_REPORT.json", {
    pass: doublesResults.every((r) => r.pass),
    results: doublesResults,
    baseUrl,
  });
  writeReport("REMOTE_UI_SINGLES_REPORT.json", {
    pass: singlesResults.every((r) => r.pass),
    results: singlesResults,
    baseUrl,
  });

  const allPass = results.every((r) => r.pass);
  console.log(`\nBrowser E2E: ${results.filter((r) => r.pass).length}/${results.length} PASS`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  if (devServer) {
    devServer.kill("SIGTERM");
  }
  console.error(err.message || err);
  process.exit(1);
});
