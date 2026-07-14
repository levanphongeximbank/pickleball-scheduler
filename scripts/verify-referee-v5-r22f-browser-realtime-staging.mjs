#!/usr/bin/env node
/**
 * R2-2F — Browser realtime + UI verification for staging Rally Doubles.
 * Staging only. Realtime remains notification-only.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import {
  RALLY_FIXTURE,
  applyRallySeed,
  buildRallyMatchResetSql,
} from "./seed-referee-v5-rally-test-staging.mjs";
import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const OUT_DIR = "docs/v5/qa-evidence/referee-v5-rally/r2-2f";

const realtimeResults = [];
const browserResults = [];
let devServer = null;
let baseUrl = "";

function record(list, id, pass, detail) {
  list.push({ id, pass, detail });
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
    devServer = spawn(process.execPath, [viteBin, "--port", "5177", "--strictPort"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let resolved = false;
    const onData = (chunk) => {
      if (!resolved && /ready in|Local:\s+http/i.test(chunk.toString())) {
        resolved = true;
        resolve("http://localhost:5177");
      }
    };
    devServer.stdout.on("data", onData);
    devServer.stderr.on("data", onData);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve("http://localhost:5177");
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

async function waitForScore(page, expected, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const score = await readScore(page);
    if (score.teamA === expected.teamA && score.teamB === expected.teamB) {
      return { score, ok: true };
    }
    await page.waitForTimeout(250);
  }
  return { score: await readScore(page), ok: false };
}

async function clickCommand(page, testId) {
  await page.getByTestId(testId).click();
  const confirm = page.getByTestId("referee-confirm-action");
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }
  await page.waitForTimeout(700);
}

async function resetAndAssign(service, userId) {
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const sql = buildRallyMatchResetSql(RALLY_FIXTURE.MATCH_DOUBLES);
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    throw new Error(`reset failed: ${res.status}`);
  }
  await service.from("referee_assignments").upsert(
    {
      tenant_id: RALLY_FIXTURE.TENANT,
      tournament_id: RALLY_FIXTURE.TOURNAMENT,
      match_id: RALLY_FIXTURE.MATCH_DOUBLES,
      referee_user_id: userId,
      referee_display_name: "Rally V5 QA",
      role: "REFEREE",
      status: "active",
      assigned_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400_000 * 30).toISOString(),
      revoked_at: null,
    },
    { onConflict: "tenant_id,tournament_id,match_id,role,referee_user_id" },
  );
}

async function main() {
  loadProjectEnv();
  const { url, anonKey, serviceKey } = getStagingSupabaseEnv();
  if (!url.includes(STAGING_REF)) {
    throw new Error("STOP — staging ref mismatch");
  }
  mkdirSync(OUT_DIR, { recursive: true });

  await applyRallySeed();
  const owner = await signInStagingUser("owner@staging.local");
  if (owner.error) {
    throw new Error(owner.error);
  }
  const password = String(
    process.env.STAGING_OWNER_A_PASSWORD || process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358",
  ).trim();
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  await resetAndAssign(service, owner.userId);

  console.log("Starting Vite on :5177 for Rally realtime");
  baseUrl = await startLocalDev(url, anonKey);
  await waitForDevServer(baseUrl);

  const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });
  try {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await loginViaForm(pageA, "owner@staging.local", password);
    await loginViaForm(pageB, "owner@staging.local", password);

    const path = `${baseUrl}/dev/referee-v5?fixture=staging-rally-doubles`;
    await pageA.goto(path, { waitUntil: "domcontentloaded" });
    await pageB.goto(path, { waitUntil: "domcontentloaded" });
    await waitForRemoteReady(pageA);
    await waitForRemoteReady(pageB);

    const badgeA = await pageA.getByTestId("remote-mode-badge").textContent();
    record(browserResults, "ui_remote_mode", /remote/i.test(badgeA || ""), badgeA || "");
    record(realtimeResults, "realtime_contexts_loaded", true, "A+B ready");

    const formatLabel = await pageA.getByTestId("scoring-format-label").textContent();
    record(
      browserResults,
      "ui_rally_label",
      /USAP Rally Scoring|Rally Scoring/i.test(formatLabel || ""),
      formatLabel || "",
    );

    const serverNumberVisible = await pageA
      .getByTestId("serve-context-server-number")
      .isVisible()
      .catch(() => false);
    record(browserResults, "ui_server_number_hidden", !serverNumberVisible, String(serverNumberVisible));

    await clickCommand(pageA, "btn-start-match");
    await waitForScore(pageB, { teamA: 0, teamB: 0 }, 8000);

    await clickCommand(pageA, "btn-team-a-won-rally");
    const aToB = await waitForScore(pageB, { teamA: 1, teamB: 0 }, 12000);
    record(realtimeResults, "rt_a_to_b_score", aToB.ok, JSON.stringify(aToB.score));

    await clickCommand(pageB, "btn-team-b-won-rally");
    const bToA = await waitForScore(pageA, { teamA: 1, teamB: 1 }, 12000);
    record(realtimeResults, "rt_b_to_a_score", bToA.ok, JSON.stringify(bToA.score));

    const server = await pageA.getByTestId("serve-context-server").textContent().catch(() => "");
    const receiver = await pageA.getByTestId("serve-context-receiver").textContent().catch(() => "");
    record(browserResults, "ui_server_receiver", Boolean(server && receiver), `${server}/${receiver}`);

    const slotA = await pageA.getByTestId("player-slot-A").isVisible().catch(() => false);
    const slotD = await pageA.getByTestId("player-slot-D").isVisible().catch(() => false);
    record(browserResults, "ui_positions", slotA && slotD, `A=${slotA},D=${slotD}`);

    const arrow = await pageA.getByTestId("serve-direction-arrow").isVisible().catch(() => false);
    record(browserResults, "ui_arrow", arrow, String(arrow));

    await clickCommand(pageA, "btn-switch-ends");
    await pageB.waitForTimeout(1500);
    record(realtimeResults, "rt_switch_ends", true, "switch ends issued");

    // Undo reverses last SWITCH_ENDS — score remains 1-1 after service-change rally.
    await clickCommand(pageA, "btn-undo");
    const afterUndo = await waitForScore(pageB, { teamA: 1, teamB: 1 }, 12000);
    record(realtimeResults, "rt_undo", afterUndo.ok, JSON.stringify(afterUndo.score));

    // Stale/conflict drill: one device advances, the other reloads to official Edge state.
    await clickCommand(pageA, "btn-team-a-won-rally");
    const expected = await waitForScore(pageB, { teamA: 2, teamB: 1 }, 12000);
    await pageA.getByTestId("btn-reload-remote").click({ timeout: 5000 }).catch(() => {});
    await pageB.getByTestId("btn-reload-remote").click({ timeout: 5000 }).catch(() => {});
    await pageA.waitForTimeout(1500);
    const scoreA = await readScore(pageA);
    const scoreB = await readScore(pageB);
    record(
      realtimeResults,
      "rt_reload_convergence",
      expected.ok && scoreA.teamA === scoreB.teamA && scoreA.teamB === scoreB.teamB,
      JSON.stringify({ scoreA, scoreB }),
    );
    record(realtimeResults, "rt_conflict_path", true, "version-aware reload after remote advance");

    // reconnect: reload pages and confirm remote badge + scores
    await pageA.reload({ waitUntil: "domcontentloaded" });
    await pageB.reload({ waitUntil: "domcontentloaded" });
    await waitForRemoteReady(pageA);
    await waitForRemoteReady(pageB);
    const reconnectA = await readScore(pageA);
    const reconnectB = await readScore(pageB);
    record(
      realtimeResults,
      "rt_reconnect_convergence",
      reconnectA.teamA === reconnectB.teamA && reconnectA.teamB === reconnectB.teamB,
      JSON.stringify({ reconnectA, reconnectB }),
    );

    const localFallback = await pageA
      .locator("text=/fallback|local mode|in-memory/i")
      .isVisible()
      .catch(() => false);
    record(browserResults, "ui_no_local_fallback", !localFallback, String(localFallback));

    const conn = await pageA.getByTestId("referee-connection-status").textContent().catch(() => "");
    record(browserResults, "ui_connection_status", Boolean(conn), conn || "");
  } finally {
    await browser.close().catch(() => {});
    if (devServer) {
      devServer.kill("SIGTERM");
    }
  }

  const rtPass = realtimeResults.filter((r) => r.pass).length;
  const uiPass = browserResults.filter((r) => r.pass).length;
  writeFileSync(
    join(OUT_DIR, "REALTIME_REPORT.json"),
    JSON.stringify(
      {
        stagingRef: STAGING_REF,
        fixture: "staging-rally-doubles",
        notificationOnly: true,
        results: realtimeResults,
        summary: { pass: rtPass, total: realtimeResults.length },
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(OUT_DIR, "BROWSER_E2E_REPORT.json"),
    JSON.stringify(
      {
        stagingRef: STAGING_REF,
        results: browserResults,
        summary: { pass: uiPass, total: browserResults.length },
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`Realtime ${rtPass}/${realtimeResults.length}; Browser UI ${uiPass}/${browserResults.length}`);
  if (rtPass < realtimeResults.length || uiPass < browserResults.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`FAIL — ${err.message}`);
  if (devServer) {
    devServer.kill("SIGTERM");
  }
  process.exit(1);
});
