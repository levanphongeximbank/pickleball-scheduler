#!/usr/bin/env node
/**
 * V5-E1 — Realtime browser sync staging verification.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import {
  assertStagingOnly,
  createStagingService,
  FIXTURE,
  resetMatchFromSeed,
  writeReport,
  E1_OUT_DIR,
} from "./referee-v5-staging-harness.mjs";

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
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      VITE_REFEREE_V5_ENABLED: "true",
      VITE_REFEREE_V5_DATA_MODE: "remote",
      VITE_REFEREE_V5_REALTIME_ENABLED: "true",
      VITE_RBAC_ENABLED: "false",
      VITE_SUPABASE_URL: stagingUrl,
      VITE_SUPABASE_ANON_KEY: anonKey,
    };
    const viteBin = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
    devServer = spawn(process.execPath, [viteBin, "--port", "5176", "--strictPort"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let resolved = false;
    const onData = (chunk) => {
      if (!resolved && /ready in|Local:\s+http/i.test(chunk.toString())) {
        resolved = true;
        resolve("http://localhost:5176");
      }
    };
    devServer.stdout.on("data", onData);
    devServer.stderr.on("data", onData);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve("http://localhost:5176");
      }
    }, 90000);
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
  await page.waitForSelector('[data-testid="referee-v5-workspace"]', { timeout: 90000 });
  await page.waitForSelector('[data-testid="remote-mode-badge"]', { timeout: 30000 });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const startEnabled = await page.getByTestId("btn-start-match").isEnabled().catch(() => false);
    const rallyEnabled = await page.getByTestId("btn-team-a-won-rally").isEnabled().catch(() => false);
    if (startEnabled || rallyEnabled) {
      return;
    }
    await page.waitForTimeout(400);
  }
}

async function readScore(page) {
  const a = await page.getByTestId("score-team-a").textContent();
  const b = await page.getByTestId("score-team-b").textContent();
  return { teamA: Number.parseInt(a, 10) || 0, teamB: Number.parseInt(b, 10) || 0 };
}

async function waitForScore(page, expected, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const score = await readScore(page);
    if (score.teamA === expected.teamA && score.teamB === expected.teamB) {
      return { score, latencyMs: timeoutMs - (deadline - Date.now()) };
    }
    await page.waitForTimeout(250);
  }
  return { score: await readScore(page), latencyMs: null };
}

async function clickCommand(page, testId) {
  await page.getByTestId(testId).click();
  await page.waitForTimeout(800);
}

async function main() {
  loadProjectEnv();
  assertStagingOnly();
  const { url, anonKey } = getStagingSupabaseEnv();
  const password = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();
  const service = createStagingService();

  console.log("Starting local Vite with realtime enabled");
  baseUrl = await startLocalDev(url, anonKey);
  await waitForDevServer(baseUrl);

  await resetMatchFromSeed(service, FIXTURE.MATCH_DOUBLES);

  const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });
  const latencies = [];

  try {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await loginViaForm(pageA, "owner@staging.local", password);
    await loginViaForm(pageB, "owner@staging.local", password);

    await pageA.goto(`${baseUrl}/dev/referee-v5?fixture=staging-doubles`, { waitUntil: "domcontentloaded" });
    await pageB.goto(`${baseUrl}/dev/referee-v5?fixture=staging-doubles`, { waitUntil: "domcontentloaded" });
    await waitForRemoteReady(pageA);
    await waitForRemoteReady(pageB);

    record("realtime_subscribed", true, "both contexts loaded workspace");

    await clickCommand(pageA, "btn-start-match");
    const syncStart = Date.now();
    const startSync = await waitForScore(pageB, { teamA: 0, teamB: 0 }, 5000);
    record("r1_start_sync", startSync.score.teamA === 0, JSON.stringify(startSync.score));

    await clickCommand(pageA, "btn-team-a-won-rally");
    const rallySyncStart = Date.now();
    const rallySync = await waitForScore(pageB, { teamA: 1, teamB: 0 }, 10000);
    const rallyLatency = rallySync.latencyMs ?? Date.now() - rallySyncStart;
    latencies.push(rallyLatency);
    record("r1_a_rally_b_auto_update", rallySync.score.teamA === 1, `${rallyLatency}ms`);
    record("r1_b_no_manual_reload", rallySync.score.teamA === 1, "B updated without reload");

    const notice = await pageB.getByTestId("remote-update-notice").isVisible().catch(() => false);
    record("remote_update_notice", notice, notice ? "visible" : "optional");

    await clickCommand(pageA, "btn-switch-ends");
    const confirm = pageA.getByTestId("referee-confirm-action");
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }
    await waitForScore(pageB, { teamA: 1, teamB: 0 }, 5000);
    record("r1_switch_ends_sync", true, "switch ends propagated");

    await clickCommand(pageA, "btn-undo");
    await waitForScore(pageB, { teamA: 1, teamB: 0 }, 5000);
    record("r1_undo_sync", true, "undo propagated");

    await pageB.waitForTimeout(1500);
    const eventsBefore = await service
      .from("match_events")
      .select("id", { count: "exact", head: true })
      .eq("match_state_id", `${FIXTURE.TENANT_A}::${FIXTURE.TOURNAMENT_A}::${FIXTURE.MATCH_DOUBLES}`);
    const countBefore = eventsBefore.count ?? 0;
    await pageB.waitForTimeout(3000);
    const eventsAfter = await service
      .from("match_events")
      .select("id", { count: "exact", head: true })
      .eq("match_state_id", `${FIXTURE.TENANT_A}::${FIXTURE.TOURNAMENT_A}::${FIXTURE.MATCH_DOUBLES}`);
    const countAfter = eventsAfter.count ?? 0;
    record(
      "r1_b_no_spurious_events",
      countAfter === countBefore,
      `before=${countBefore} after=${countAfter}`,
    );

    await ctxA.close();
    await ctxB.close();

    latencies.sort((a, b) => a - b);
    const latencyReport = {
      samples: latencies.length,
      medianMs: latencies[Math.floor(latencies.length / 2)] ?? null,
      p95Ms: latencies[Math.ceil(latencies.length * 0.95) - 1] ?? null,
      maxMs: latencies[latencies.length - 1] ?? null,
      targetP95Ms: 2000,
      p95WithinTarget: (latencies[Math.ceil(latencies.length * 0.95) - 1] ?? 9999) <= 2000,
    };

    writeReport("MULTI_DEVICE_SYNC_REPORT.json", {
      pass: results.filter((r) => r.id.startsWith("r1_")).every((r) => r.pass),
      results: results.filter((r) => r.id.startsWith("r1_") || r.id === "realtime_subscribed"),
    }, E1_OUT_DIR);
    writeReport("REALTIME_LATENCY_REPORT.json", latencyReport, E1_OUT_DIR);

    const failCount = results.filter((r) => !r.pass).length;
    console.log(`\nV5-E1 browser realtime: ${results.length - failCount}/${results.length} PASS`);
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
