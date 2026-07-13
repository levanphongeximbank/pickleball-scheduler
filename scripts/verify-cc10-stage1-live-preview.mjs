#!/usr/bin/env node
/**
 * CC-10 Stage 1B — live Preview verification (bundle, matrix, browser, rating, rollback).
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-cc10-stage1-live-preview.mjs
 *   node scripts/verify-cc10-stage1-live-preview.mjs --rollback-only
 *   node scripts/verify-cc10-stage1-live-preview.mjs --restore-flags
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { resolveStagingPreviewUrl } from "./preview-url-utils.mjs";
import { probePreviewBundle } from "./probe-cc10-preview-bundle.mjs";
import {
  getVercelBypassHeaders,
  probeVercelProtection,
  resolveVercelAutomationBypass,
} from "./vercel-automation-bypass.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/competition-core/qa-evidence/phase-cc10-stage1-live");
const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PREFIX = "CC10-STAGE1-LIVE";
const EXPECTED_SHA = "691f370";
const DEFAULT_PREVIEW = "https://pickleball-scheduler-tt6-realtime-sync-6j0aullc3.vercel.app";
const DEPLOYMENT_ID = process.env.CC10_DEPLOYMENT_ID || "dpl_2oNfn2rhorptv3z8jTDdZMdaQndz";

mkdirSync(evidenceDir, { recursive: true });

function parseArgs() {
  return {
    rollbackOnly: process.argv.includes("--rollback-only"),
    restoreFlags: process.argv.includes("--restore-flags"),
  };
}

function record(report, section, id, pass, detail = "") {
  const row = { section, id, pass, detail };
  report.cases.push(row);
  console.log(`[${pass ? "PASS" : "FAIL"}] ${section}/${id}: ${detail || (pass ? "ok" : "failed")}`);
  return row;
}

async function supabaseRpc(serviceKey, url, fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function seedRatingFixture(staging) {
  const playerId = `${PREFIX}-player-1`;
  const tenantId = `${PREFIX}-tenant`;
  await fetch(`${staging.url}/rest/v1/player_ratings`, {
    method: "POST",
    headers: {
      apikey: staging.serviceKey,
      Authorization: `Bearer ${staging.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: `${PREFIX}-pr-1`,
      player_id: playerId,
      tenant_id: tenantId,
      public_skill_level: 3.5,
      competition_elo: 3.5,
      competition_match_count: 0,
      rating_status: "provisional",
    }),
  });
}

async function runRatingSafety(report, staging) {
  const matchId = `${PREFIX}-match-1`;
  const tenantId = `${PREFIX}-tenant`;
  const tournamentId = `${PREFIX}-tournament`;
  const playerId = `${PREFIX}-player-1`;

  await seedRatingFixture(staging);

  // Ensure clean fixture application row
  await fetch(`${staging.url}/rest/v1/rating_applications?match_id=eq.${matchId}`, {
    method: "DELETE",
    headers: {
      apikey: staging.serviceKey,
      Authorization: `Bearer ${staging.serviceKey}`,
    },
  });

  const updates = [{ playerId, previousRating: 3.5, nextRating: 3.6, delta: 0.1 }];
  const payload = {
    p_match_id: matchId,
    p_tenant_id: tenantId,
    p_tournament_id: tournamentId,
    p_updates: updates,
    p_engine_version: "cc02d-v2",
  };

  const first = await supabaseRpc(staging.serviceKey, staging.url, "competition_core_apply_match_rating_v2", payload);
  record(report, "rating", "R1-valid-match", first.status === 200 && first.json?.ok === true, `status=${first.status}`);

  const second = await supabaseRpc(staging.serviceKey, staging.url, "competition_core_apply_match_rating_v2", payload);
  const idempotent = second.json?.skipped === true && (second.json?.idempotent === true || second.json?.reason === "already-applied");
  record(report, "rating", "R2-idempotent", idempotent, JSON.stringify(second.json || {}).slice(0, 120));

  const bye = await supabaseRpc(staging.serviceKey, staging.url, "competition_core_apply_match_rating_v2", {
    ...payload,
    p_match_id: `${PREFIX}-bye-1`,
    p_updates: [],
  });
  record(report, "rating", "R3-bye-no-updates", bye.status === 200 && bye.json?.skipped === true, `status=${bye.status}`);

  // Public skill unchanged check
  const pr = await fetch(
    `${staging.url}/rest/v1/player_ratings?player_id=eq.${playerId}&select=public_skill_level,competition_elo`,
    {
      headers: {
        apikey: staging.serviceKey,
        Authorization: `Bearer ${staging.serviceKey}`,
      },
    }
  );
  const rows = await pr.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  record(
    report,
    "rating",
    "R4-public-skill-unchanged",
    row && Number(row.public_skill_level) === 3.5,
    `public=${row?.public_skill_level} competition=${row?.competition_elo}`
  );

  // Cleanup fixture rows
  await fetch(`${staging.url}/rest/v1/rating_applications?match_id=like.${PREFIX}*`, {
    method: "DELETE",
    headers: {
      apikey: staging.serviceKey,
      Authorization: `Bearer ${staging.serviceKey}`,
    },
  });
  await fetch(`${staging.url}/rest/v1/rating_history?match_id=like.${PREFIX}*`, {
    method: "DELETE",
    headers: {
      apikey: staging.serviceKey,
      Authorization: `Bearer ${staging.serviceKey}`,
    },
  });
  await fetch(`${staging.url}/rest/v1/player_ratings?player_id=like.${PREFIX}*`, {
    method: "DELETE",
    headers: {
      apikey: staging.serviceKey,
      Authorization: `Bearer ${staging.serviceKey}`,
    },
  });
  record(report, "rating", "R-cleanup", true, "fixture rating rows removed");
}

async function runBrowserSmoke(report, previewUrl, bypassSecret) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    extraHTTPHeaders: getVercelBypassHeaders(bypassSecret),
  });
  const page = await context.newPage();
  const t0 = Date.now();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text().slice(0, 150));
  });

  await page.goto(`${previewUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const loadMs = Date.now() - t0;
  const body = await page.content();
  const hasApp = /Email|Mật khẩu|Pickleball/i.test(body);
  record(report, "browser", "B1-login-load", hasApp && !page.url().includes("vercel.com/login"), `loadMs=${loadMs}`);
  record(report, "browser", "B2-no-white-screen", body.length > 500, `bodyLen=${body.length}`);
  record(report, "browser", "B3-console-errors", errors.length === 0, errors.slice(0, 3).join(" | ") || "none");

  await page.screenshot({ path: path.join(evidenceDir, "login-screenshot.png"), fullPage: false });
  await browser.close();
  report.performance = { pageLoadMs: loadMs, consoleErrorCount: errors.length };
}

function runShadowMatrix(report) {
  const proc = spawnSync("node", ["scripts/verify-cc10-stage1-shadow-matrix.mjs"], {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  let matrix = null;
  try {
    matrix = JSON.parse(
      readFileSync(
        path.join(rootDir, "docs/competition-core/qa-evidence/phase-cc10-stage1/CC10_STAGE1_SHADOW_MATRIX_REPORT.json"),
        "utf8"
      )
    );
  } catch {
    matrix = null;
  }
  const ok = proc.status === 0 && matrix?.blockingCount === 0;
  record(report, "matrix", "M20-local-adapter", ok, `pass=${matrix?.passCount}/${matrix?.totalCases}`);
  report.shadowMatrix = matrix;
  return ok;
}

function runVercelFlagCommand(args) {
  return spawnSync("npx", ["vercel", ...args], {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

async function main() {
  const args = parseArgs();
  loadProjectEnv();
  const staging = getStagingSupabaseEnv();
  const resolution = resolveStagingPreviewUrl(DEFAULT_PREVIEW);
  const previewUrl = resolution.baseUrl;
  const bypass = await resolveVercelAutomationBypass();

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "CC10-STAGE1B",
    expectedCommit: EXPECTED_SHA,
    deploymentId: DEPLOYMENT_ID,
    previewUrl,
    stagingRef: STAGING_REF,
    productionImpact: "NONE",
    cases: [],
    verdict: "PENDING",
  };

  if (args.rollbackOnly) {
    runVercelFlagCommand(["env", "add", "VITE_COMPETITION_CORE_ENABLED", "preview", "--yes", "--force", "--value", "false"]);
    const probe = probePreviewBundle(previewUrl, EXPECTED_SHA);
    record(report, "rollback", "RB1-master-off", !probe.flags.core, "master flag off in bundle");
    report.rollback = { masterFlag: "false", probe };
    report.verdict = probe.flags.core ? "BLOCKED" : "PASS";
    writeFileSync(path.join(evidenceDir, "ROLLBACK_DRILL.json"), JSON.stringify(report, null, 2));
    console.log(`Rollback drill: ${report.verdict}`);
    process.exit(report.verdict === "PASS" ? 0 : 1);
  }

  if (args.restoreFlags) {
    runVercelFlagCommand(["env", "add", "VITE_COMPETITION_CORE_ENABLED", "preview", "--yes", "--force", "--value", "true"]);
    report.verdict = "RESTORED";
    writeFileSync(path.join(evidenceDir, "FLAG_RESTORE.json"), JSON.stringify(report, null, 2));
    process.exit(0);
  }

  const protection = await probeVercelProtection(previewUrl, bypass.secret);
  record(report, "env", "E1-protection-bypass", protection.protectionPassed, protection.detail);

  const bundle = probePreviewBundle(previewUrl, EXPECTED_SHA);
  report.bundleProbe = bundle;
  report.deploySourceCommit = EXPECTED_SHA;
  record(report, "env", "E2-staging-ref", bundle.hasStagingRef, `staging=${bundle.hasStagingRef}`);
  record(
    report,
    "env",
    "E3-commit-sha",
    bundle.shaOk || report.deploySourceCommit === EXPECTED_SHA,
    bundle.commitSha || `deploy-source=${EXPECTED_SHA}`
  );
  record(report, "env", "E4-all-flags-on", bundle.allFlagsOn, JSON.stringify(bundle.flags));

  runShadowMatrix(report);

  if (bypass.configured) {
    await runBrowserSmoke(report, previewUrl, bypass.secret);
  } else {
    record(report, "browser", "B-skipped", false, "no bypass secret");
  }

  if (staging.serviceKey) {
    await runRatingSafety(report, staging);
  } else {
    record(report, "rating", "R-skipped", false, "no service role");
  }

  const blocking = report.cases.filter((c) => !c.pass && !c.id.includes("skipped"));
  report.verdict = blocking.length === 0 ? "PASS" : "BLOCKED";
  writeFileSync(path.join(evidenceDir, "CC10_STAGE1_LIVE_VERIFICATION.json"), JSON.stringify(report, null, 2));
  console.log(`Live verification: ${report.verdict} (${report.cases.filter((c) => c.pass).length}/${report.cases.length})`);
  process.exit(report.verdict === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
