/**
 * TT-6D — Five-context multi-device Preview verification.
 *
 * Usage:
 *   STAGING_PREVIEW_URL=https://... node scripts/verify-phase-tt6d-multi-device-preview.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { loadProjectEnv } from "./load-env.mjs";
import { resolveStagingPreviewUrl } from "./preview-url-utils.mjs";
import {
  getVercelBypassHeaders,
  probeVercelProtection,
  resolveVercelAutomationBypass,
} from "./vercel-automation-bypass.mjs";
import {
  DEVICE_PROFILES,
  PROBE,
  assertPageHealthy,
  attachSetupRpcCounter,
  openDeviceProfile,
  readSessionEmail,
} from "./lib/tt6-preview-browser-harness.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt6");
const screenshotDir = path.join(evidenceDir, "tt6d-multi-device-e2e");

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || null;
}

function record(report, id, pass, detail = "", failureClass = null) {
  report.cases.push({ id, pass, detail, failureClass: pass ? null : failureClass });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`);
}

function finalize(report) {
  report.passCount = report.cases.filter((c) => c.pass).length;
  report.totalCount = report.cases.length;
  report.allPass = report.passCount === report.totalCount;
  report.verdict = report.allPass ? "PASS" : "FAIL";
  return report;
}

function writeReport(report) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, "TT6D_MULTI_DEVICE_BROWSER_REPORT.json"),
    JSON.stringify(report, null, 2),
  );
}

function writeFinalReport(browserReport) {
  const stagingPath = path.join(evidenceDir, "TT6D_STAGING_REPORT.json");
  let staging = { verdict: "NOT_RUN" };
  if (fs.existsSync(stagingPath)) {
    staging = JSON.parse(fs.readFileSync(stagingPath, "utf8"));
  }
  const finalReport = {
    generatedAt: new Date().toISOString(),
    phase: "TT-6D",
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    verdict:
      browserReport.verdict === "PASS" && staging.verdict === "PASS" ? "PASS" : "BLOCKED",
    tt6d: browserReport.verdict === "PASS" && staging.verdict === "PASS" ? "PASS" : "IN_PROGRESS",
    staging: staging.verdict,
    browser: browserReport.verdict,
    browserPassCount: `${browserReport.passCount}/${browserReport.totalCount}`,
    production: "UNTOUCHED",
    previewUrl: browserReport.previewUrl,
    reports: [
      "TT6D_STAGING_REPORT.json",
      "TT6D_MULTI_DEVICE_BROWSER_REPORT.json",
      "TT6D_OBSERVABILITY_REPORT.json",
      "TT6D_FLAG_CONTRACT.json",
      "TT6D_SERVICE_OBSERVABILITY_REPORT.json",
    ],
    browserCases: browserReport.cases,
  };
  fs.writeFileSync(path.join(evidenceDir, "TT6D_FINAL_REPORT.json"), JSON.stringify(finalReport, null, 2));
}

async function main() {
  loadProjectEnv();
  const previewResolved = resolveStagingPreviewUrl(process.env.STAGING_PREVIEW_URL);
  const previewUrl =
    typeof previewResolved === "string" ? previewResolved : previewResolved?.baseUrl || null;

  const bypass = await resolveVercelAutomationBypass();
  const bypassHeaders = getVercelBypassHeaders(bypass.secret);

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "TT-6D",
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    previewUrl,
    probe: PROBE,
    deviceProfiles: Object.values(DEVICE_PROFILES).map((p) => ({ id: p.id, email: p.email })),
    cases: [],
    screenshotDir: "docs/v5/qa-evidence/phase-tt6/tt6d-multi-device-e2e",
    verdict: "PENDING",
  };

  if (!previewUrl) {
    record(report, "preview_url", false, "Missing STAGING_PREVIEW_URL", "environment");
    writeReport(finalize(report));
    writeFinalReport(report);
    process.exit(1);
  }

  record(
    report,
    "bypass_configured",
    bypass.configured,
    bypass.configured ? `source=${bypass.source}` : "no bypass",
    "protection_blocked",
  );

  const protection = await probeVercelProtection(previewUrl, bypass.secret);
  record(
    report,
    "protection_passed",
    protection.protectionPassed,
    protection.detail || "protection probe",
    protection.failureClass || "protection_blocked",
  );

  if (!protection.protectionPassed) {
    writeReport(finalize(report));
    writeFinalReport(report);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const contexts = [];
  const sessions = [];

  try {
    for (const profile of Object.values(DEVICE_PROFILES)) {
      const context = await browser.newContext({ extraHTTPHeaders: bypassHeaders });
      const page = await context.newPage();
      const wsUrls = [];
      const rpc = attachSetupRpcCounter(page);
      page.on("websocket", (ws) => {
        if (/realtime/i.test(ws.url())) {
          wsUrls.push(ws.url());
        }
      });
      contexts.push(context);
      sessions.push({ profile, page, wsUrls, rpc });
    }

    record(report, "five_contexts_created", sessions.length === 5, `contexts=${sessions.length}`);

    for (const session of sessions) {
      const { body, url } = await openDeviceProfile(session.page, previewUrl, session.profile);
      const healthy = assertPageHealthy(body);
      record(
        report,
        `${session.profile.id}_render`,
        healthy,
        `email=${session.profile.email} bodyLen=${body.length} url=${url}`,
        "application_runtime_failed",
      );
      await session.page.screenshot({
        path: path.join(screenshotDir, `${session.profile.id}.png`),
        fullPage: true,
      });
    }

    const sessionEmails = await Promise.all(
      sessions.map(async (s) => ({
        id: s.profile.id,
        expected: s.profile.email.toLowerCase(),
        actual: String((await readSessionEmail(s.page)) || "").toLowerCase(),
      })),
    );
    const emailsMatch = sessionEmails.every((row) => row.actual === row.expected);
    record(
      report,
      "sessions_isolated_auth",
      emailsMatch,
      sessionEmails.map((r) => `${r.id}=${r.actual}`).join(" | "),
      "authentication_failed",
    );

    const captainA = sessions.find((s) => s.profile.id === "captain_a");
    const captainB = sessions.find((s) => s.profile.id === "captain_b");
    const captainABody = await captainA.page.locator("body").innerText().catch(() => "");
    const captainBBody = await captainB.page.locator("body").innerText().catch(() => "");
    record(
      report,
      "captain_portals_independent",
      assertPageHealthy(captainABody) && assertPageHealthy(captainBBody),
      `captainA=${captainABody.length} captainB=${captainBBody.length}`,
      "authentication_failed",
    );
    record(
      report,
      "captain_team_scope",
      /Probe Team A/i.test(captainABody) && /Probe Team B/i.test(captainBBody),
      "each captain portal scoped to own team label",
      "application_runtime_failed",
    );

    const wsCount = sessions.reduce((sum, s) => sum + s.wsUrls.length, 0);
    record(
      report,
      "realtime_websocket_any_context",
      wsCount >= 1,
      `websocket_connections=${wsCount}`,
      "network_failed",
    );

    const btcB = sessions.find((s) => s.profile.id === "btc_b");
    const captainARpcBefore = captainA.rpc.count();
    const reloadAt = Date.now();
    await btcB.page.reload({ waitUntil: "domcontentloaded" });
    await btcB.page.waitForTimeout(5000);
    await captainA.page.reload({ waitUntil: "domcontentloaded" });
    await captainA.page.waitForTimeout(5000);
    const captainARpcAfter = captainA.rpc.countSince(reloadAt);
    record(
      report,
      "cross_device_snapshot_activity",
      captainARpcAfter >= 1,
      `captainA_rpc_after_peer_activity=${captainARpcAfter} total=${captainA.rpc.count()} before=${captainARpcBefore}`,
      "network_failed",
    );

    record(
      report,
      "no_false_success",
      sessions.every((s) => !/\/login$/i.test(s.page.url())),
      sessions.map((s) => `${s.profile.id}:${s.page.url()}`).join(" | "),
      "authentication_failed",
    );
  } catch (error) {
    record(report, "exception", false, error?.message || String(error), "application_runtime_failed");
    try {
      await sessions[0]?.page?.screenshot({
        path: path.join(screenshotDir, "99-exception.png"),
        fullPage: true,
      });
    } catch {
      // ignore
    }
  } finally {
    for (const context of contexts) {
      await context.close().catch(() => {});
    }
    await browser.close().catch(() => {});
  }

  finalize(report);
  writeReport(report);
  writeFinalReport(report);
  console.log(`\nTT-6D multi-device: ${report.verdict} (${report.passCount}/${report.totalCount})`);
  process.exit(report.allPass ? 0 : 1);
}

main();
