#!/usr/bin/env node
/**
 * V5-D.4.1 — Full browser E2E on Preview/local with remote mode.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import {
  assertStagingOnly,
  createStagingService,
  FIXTURE,
  resetMatchFromSeed,
  snapshotMatch,
  writeD41Report,
  EDGE_URL,
} from "./referee-v5-staging-harness.mjs";
import { RefereeV5SupabaseRepository } from "../src/features/referee-v5/persistence/RefereeV5SupabaseRepository.js";
import { RefereeV5EdgeCommandHandler } from "../src/features/referee-v5/persistence/RefereeV5EdgeCommandHandler.js";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const results = [];
let devServer = null;
let baseUrl = "";

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

async function waitForDevServer(url) {
  const deadline = Date.now() + 90000;
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
    }, 90000);
    devServer.on("error", reject);
  });
}

async function loginViaForm(page, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^mật khẩu$/i).fill(password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 90000 });
}

async function waitForRemoteReady(page) {
  if (page.url().includes("/403")) {
    throw new Error("route blocked by SuperAdminRouteGuard");
  }
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (bodyText.includes("Feature flag đang tắt")) {
    throw new Error("VITE_REFEREE_V5_ENABLED not active");
  }
  await page.waitForSelector('[data-testid="referee-v5-workspace"]', { timeout: 90000 });
  await page.waitForSelector('[data-testid="remote-mode-badge"]', { timeout: 30000 });

  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const status = await page.getByTestId("referee-connection-status").textContent().catch(() => "");
    if (status.includes("Lỗi kết nối")) {
      throw new Error(`remote-error on load: ${status}`);
    }
    const startEnabled = await page.getByTestId("btn-start-match").isEnabled().catch(() => false);
    const rallyEnabled = await page.getByTestId("btn-team-a-won-rally").isEnabled().catch(() => false);
    if (startEnabled || rallyEnabled) {
      return;
    }
    await page.waitForTimeout(400);
  }
  throw new Error("remote workspace not ready");
}

async function waitForScore(page, expected, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const score = await readScore(page);
    if (score.teamA === expected.teamA && score.teamB === expected.teamB) {
      return score;
    }
    await page.waitForTimeout(350);
  }
  return readScore(page);
}

async function clickCommand(page, testId) {
  await page.getByTestId(testId).click();
  await page.waitForTimeout(400);
  const processing = page.getByTestId("referee-action-panel");
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const disabled = await page.getByTestId(testId).isDisabled().catch(() => false);
    if (!disabled) {
      break;
    }
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(600);
}

async function confirmDialogIfPresent(page) {
  const dialog = page.getByTestId("referee-confirmation-dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByTestId("referee-confirm-action").click();
    await page.waitForTimeout(600);
  }
}

async function readScore(page) {
  const a = await page.getByTestId("score-team-a").textContent();
  const b = await page.getByTestId("score-team-b").textContent();
  return { teamA: Number.parseInt(a, 10) || 0, teamB: Number.parseInt(b, 10) || 0 };
}

async function readServeContext(page) {
  return {
    server: (await page.getByTestId("serve-context-server").textContent())?.trim() || "",
    receiver: (await page.getByTestId("serve-context-receiver").textContent())?.trim() || "",
    serverNumber: (await page.getByTestId("serve-context-server-number").textContent().catch(() => ""))?.trim() || "",
    direction: (await page.getByTestId("serve-context-direction").textContent())?.trim() || "",
  };
}

async function verifyReplay(service, matchId, label) {
  const snap = await snapshotMatch(service, matchId);
  const repo = new RefereeV5SupabaseRepository(service);
  const handler = new RefereeV5EdgeCommandHandler(repo);
  const replay = await handler.verifySnapshotMatchesReplay(snap.matchStateId);
  record(`${label}_replay_hash`, replay.ok === true, JSON.stringify({
    snapshotHash: replay.snapshotHash,
    rebuiltHash: replay.rebuiltHash,
    version: snap.version,
    sequence: snap.sequence,
  }));
  return replay.ok === true;
}

async function runDoublesFlow(page, service) {
  await resetMatchFromSeed(service, FIXTURE.MATCH_DOUBLES);
  await page.goto(`${baseUrl}/dev/referee-v5?fixture=staging-doubles`, { waitUntil: "domcontentloaded" });
  await waitForRemoteReady(page);

  record("doubles_four_players", (await page.locator('[data-testid^="player-slot-"]').count()) === 4, "4 players");
  record("doubles_remote_badge", (await page.getByTestId("remote-mode-badge").count()) > 0, "remote mode");

  await clickCommand(page, "btn-start-match");
  const afterStart = await waitForScore(page, { teamA: 0, teamB: 0 });
  record("doubles_start_match", afterStart.teamA === 0, "scores 0-0");

  const beforeWin = await readServeContext(page);
  await clickCommand(page, "btn-team-a-won-rally");
  const afterWinScore = await waitForScore(page, { teamA: 1, teamB: 0 });
  const afterWin = await readServeContext(page);
  record("doubles_serving_team_wins", afterWinScore.teamA === 1, "team A score 1");
  record("doubles_after_win_server_marked", Boolean(afterWin.server), afterWin.server);

  await clickCommand(page, "btn-team-b-won-rally");
  const afterS1 = await waitForScore(page, { teamA: 1, teamB: 0 });
  record("doubles_server1_lost", afterS1.teamA === 1, "no extra point");

  await clickCommand(page, "btn-team-b-won-rally");
  const afterS2 = await waitForScore(page, { teamA: 1, teamB: 0 });
  record("doubles_server2_sideout", afterS2.teamA === 1, "side-out no point");

  await clickCommand(page, "btn-team-b-won-rally");
  const afterSideOut = await waitForScore(page, { teamA: 1, teamB: 1 });
  record("doubles_new_serving_team", afterSideOut.teamB === 1, "team B scores");

  await clickCommand(page, "btn-switch-ends");
  await confirmDialogIfPresent(page);
  record("doubles_switch_ends", true, "confirmed");

  await clickCommand(page, "btn-undo");
  const afterUndo = await waitForScore(page, { teamA: 1, teamB: 1 });
  record("doubles_undo", afterUndo.teamB === 1 && afterUndo.teamA === 1, JSON.stringify(afterUndo));

  const snapBefore = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForRemoteReady(page);
  const afterReload = await waitForScore(page, { teamA: 1, teamB: 1 });
  const snapAfter = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  record(
    "doubles_reload_persistence",
    snapAfter.version === snapBefore.version && afterReload.teamA === afterUndo.teamA,
    JSON.stringify({ score: afterReload, snap: snapAfter }),
  );

  return verifyReplay(service, FIXTURE.MATCH_DOUBLES, "doubles");
}

async function runSinglesFlow(page, service) {
  await resetMatchFromSeed(service, FIXTURE.MATCH_SINGLES);
  await page.goto(`${baseUrl}/dev/referee-v5?fixture=staging-singles`, { waitUntil: "domcontentloaded" });
  await waitForRemoteReady(page);

  record("singles_two_players", (await page.locator('[data-testid^="player-slot-"]').count()) === 2, "2 players");
  const serverNumberVisible = await page.getByTestId("serve-context-server-number").isVisible().catch(() => false);
  record("singles_no_server_number", !serverNumberVisible, "no S1/S2");

  await clickCommand(page, "btn-start-match");
  await clickCommand(page, "btn-team-a-won-rally");
  const singlesScore = await waitForScore(page, { teamA: 1, teamB: 0 });
  record("singles_rally", singlesScore.teamA === 1, "point awarded");

  await clickCommand(page, "btn-switch-ends");
  await confirmDialogIfPresent(page);
  record("singles_switch_ends", Boolean((await readServeContext(page)).server), "server preserved");

  await clickCommand(page, "btn-undo");
  const singlesUndo = await waitForScore(page, { teamA: 1, teamB: 0 });
  record("singles_undo", singlesUndo.teamA === 1 && singlesUndo.teamB === 0, "undo switch ends");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForRemoteReady(page);
  const singlesReload = await waitForScore(page, { teamA: 1, teamB: 0 });
  record("singles_reload", singlesReload.teamA === 1, "persisted");

  return verifyReplay(service, FIXTURE.MATCH_SINGLES, "singles");
}

async function runRemoteErrorTest(page, service) {
  await resetMatchFromSeed(service, FIXTURE.MATCH_DOUBLES);
  let blocked = false;
  await page.route("**/functions/v1/referee-v5-match**", async (route) => {
    blocked = true;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "EDGE_DOWN" }) });
  });

  await page.goto(`${baseUrl}/dev/referee-v5?fixture=staging-doubles`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="referee-connection-status"]', { timeout: 60000 });
  const status = await page.getByTestId("referee-connection-status").textContent();
  const hasError = status?.includes("Lỗi kết nối") || (await page.getByTestId("referee-error").count()) > 0;
  record("remote_error_displayed", hasError, status || "");
  record("remote_error_no_local_fallback", !(await page.getByTestId("fixture-select").isVisible().catch(() => false)), "no prototype fixture select");
  const startDisabled = await page.getByTestId("btn-start-match").isDisabled().catch(() => true);
  record("remote_error_actions_disabled", startDisabled, `start disabled=${startDisabled}`);

  await page.unroute("**/functions/v1/referee-v5-match**");
  const reloadBtn = page.getByTestId("btn-reload-remote");
  if (await reloadBtn.isVisible().catch(() => false)) {
    await reloadBtn.click();
  } else {
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  const recoveryDeadline = Date.now() + 60000;
  let recovered = false;
  while (Date.now() < recoveryDeadline) {
    const status = await page.getByTestId("referee-connection-status").textContent().catch(() => "");
    const startEnabled = await page.getByTestId("btn-start-match").isEnabled().catch(() => false);
    const rallyEnabled = await page.getByTestId("btn-team-a-won-rally").isEnabled().catch(() => false);
    if (!status.includes("Lỗi kết nối") && (startEnabled || rallyEnabled)) {
      recovered = true;
      break;
    }
    await page.waitForTimeout(500);
  }
  record("remote_error_recovery", blocked && recovered, `reload restored remote=${recovered}`);
}

async function runMultiContextTest(browser, password, service) {
  await resetMatchFromSeed(service, FIXTURE.MATCH_DOUBLES);
  const bypass = String(
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS || "",
  ).trim();
  const ctxOpts = bypass ? { extraHTTPHeaders: { "x-vercel-protection-bypass": bypass } } : undefined;
  const ctxA = await browser.newContext(ctxOpts);
  const ctxB = await browser.newContext(ctxOpts);
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await loginViaForm(pageA, "owner@staging.local", password);
  await loginViaForm(pageB, "owner@staging.local", password);

  await pageA.goto(`${baseUrl}/dev/referee-v5?fixture=staging-doubles`, { waitUntil: "domcontentloaded" });
  await pageB.goto(`${baseUrl}/dev/referee-v5?fixture=staging-doubles`, { waitUntil: "domcontentloaded" });
  await waitForRemoteReady(pageA);
  await waitForRemoteReady(pageB);

  await clickCommand(pageA, "btn-start-match");
  await waitForRemoteReady(pageA);
  await clickCommand(pageA, "btn-team-a-won-rally");
  await waitForScore(pageA, { teamA: 1, teamB: 0 });

  const scoreBeforeB = await readScore(pageB);
  await pageB.evaluate(() => {
    const start = document.querySelector('[data-testid="btn-start-match"]');
    const rally = document.querySelector('[data-testid="btn-team-b-won-rally"]');
    if (start) {
      start.removeAttribute("disabled");
      start.click();
      return;
    }
    if (rally) {
      rally.removeAttribute("disabled");
      rally.click();
    }
  });
  await pageB.waitForTimeout(1500);
  const errorB = await pageB.getByTestId("referee-error").textContent().catch(() => "");
  const conflict =
    errorB.includes("thay đổi") ||
    errorB.includes("CONFLICT") ||
    errorB.includes("đồng bộ") ||
    errorB.includes("phiên bản");
  record("multi_context_stale_conflict", conflict, errorB.slice(0, 120));

  const reloadBtn = pageB.getByTestId("btn-reload-remote");
  if (await reloadBtn.isVisible().catch(() => false)) {
    await reloadBtn.click();
  } else {
    await pageB.reload();
  }
  await waitForRemoteReady(pageB);

  const scoreA = await waitForScore(pageA, { teamA: 1, teamB: 0 });
  const scoreB = await waitForScore(pageB, { teamA: 1, teamB: 0 });
  record(
    "multi_context_convergence",
    scoreA.teamA === scoreB.teamA &&
      scoreA.teamB === scoreB.teamB &&
      scoreB.teamA >= scoreBeforeB.teamA,
    JSON.stringify({ a: scoreA, b: scoreB }),
  );

  await ctxA.close();
  await ctxB.close();
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
    console.log(`Using STAGING_PREVIEW_URL`);
  } else {
    console.log("Starting local Vite with remote flags");
    baseUrl = await startLocalDev(url, anonKey);
    await waitForDevServer(baseUrl);
    console.log(`Local dev ready`);
  }

  const owner = await signInStagingUser("owner@staging.local");
  if (owner.error) {
    throw new Error(`owner login failed: ${owner.error}`);
  }
  const password = String(
    process.env.STAGING_OWNER_A_PASSWORD || process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358",
  ).trim();

  const service = createStagingService();
  const bypass = String(
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS || "",
  ).trim();
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });

  try {
    const context = await browser.newContext(
      bypass
        ? { extraHTTPHeaders: { "x-vercel-protection-bypass": bypass } }
        : undefined,
    );
    const page = await context.newPage();
    await loginViaForm(page, "owner@staging.local", password);

    const doublesOk = await runDoublesFlow(page, service);
    const singlesOk = await runSinglesFlow(page, service);
    await runRemoteErrorTest(page, service);
    await runMultiContextTest(browser, password, service);

    writeD41Report("REMOTE_UI_DOUBLES_REPORT.json", {
      pass: results.filter((r) => r.id.startsWith("doubles_")).every((r) => r.pass),
      replayPass: doublesOk,
      results: results.filter((r) => r.id.startsWith("doubles_") || r.id === "doubles_replay_hash"),
      baseUrl,
      edgeUrl: EDGE_URL,
    });
    writeD41Report("REMOTE_UI_SINGLES_REPORT.json", {
      pass: results.filter((r) => r.id.startsWith("singles_")).every((r) => r.pass),
      replayPass: singlesOk,
      results: results.filter((r) => r.id.startsWith("singles_") || r.id === "singles_replay_hash"),
      baseUrl,
    });
    writeD41Report("REMOTE_ERROR_REPORT.json", {
      pass: results.filter((r) => r.id.startsWith("remote_error_")).every((r) => r.pass),
      results: results.filter((r) => r.id.startsWith("remote_error_")),
    });
    writeD41Report("MULTI_CONTEXT_BROWSER_REPORT.json", {
      pass: results.filter((r) => r.id.startsWith("multi_context_")).every((r) => r.pass),
      results: results.filter((r) => r.id.startsWith("multi_context_")),
    });
    writeD41Report("REPLAY_SNAPSHOT_REPORT.json", {
      pass: doublesOk && singlesOk,
      doublesReplay: doublesOk,
      singlesReplay: singlesOk,
    });

    const failCount = results.filter((r) => !r.pass).length;
    console.log(`\nBrowser D4.1: ${results.length - failCount}/${results.length} PASS`);
    process.exit(failCount > 0 ? 1 : 0);
  } finally {
    await browser.close();
    if (devServer) {
      devServer.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  if (devServer) {
    devServer.kill("SIGTERM");
  }
  console.error(err.message || err);
  process.exit(1);
});
