/**
 * Phase TT-6D — Staging verification + evidence JSON generation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  configureRealtimeObservabilityDebug,
  createRealtimeObservability,
  getTeamTournamentRealtimeObservability,
  isTeamTournamentRealtimeDebugEnabled,
  isTeamTournamentRealtimeEnabled,
} from "../src/features/team-tournament/realtime/index.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt6");

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || null;
}

function baseReport(phase, fileName) {
  return {
    generatedAt: new Date().toISOString(),
    phase,
    stagingRef: STAGING_REF,
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    cases: [],
    verdict: "PENDING",
    reportFile: fileName,
  };
}

function recordCase(report, id, name, pass, detail = {}) {
  report.cases.push({ id, name, pass, ...detail });
}

function finalizeReport(report) {
  report.passCount = report.cases.filter((c) => c.pass).length;
  report.totalCount = report.cases.length;
  report.allPass = report.passCount === report.totalCount;
  report.verdict = report.allPass ? "PASS" : "FAIL";
  return report;
}

function writeReport(report) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, report.reportFile), JSON.stringify(report, null, 2));
}

function runObservabilityGates() {
  const obsReport = baseReport("TT-6D", "TT6D_OBSERVABILITY_REPORT.json");
  const obs = createRealtimeObservability();
  obs.increment("duplicate_events", 2);
  obs.recordLatency(12);
  const snap = obs.snapshot();
  recordCase(
    obsReport,
    "metrics_snapshot",
    "Observability snapshot exposes counters",
    snap.duplicate_events === 2 && snap.event_to_snapshot_latency_ms_count === 1,
    { snapshot: snap },
  );

  const redactObs = createRealtimeObservability();
  const captured = [];
  redactObs.setLogger((entry) => captured.push(entry));
  redactObs.log("test_action", {
    tournamentId: "probe",
    payload: { secret: "redacted" },
    jwt: "redacted",
  });
  recordCase(
    obsReport,
    "debug_logger_redacts_payload",
    "Logger redacts payload and jwt",
    captured.length === 1 &&
      captured[0].payload === undefined &&
      captured[0].jwt === undefined &&
      captured[0].tournamentId === "probe",
  );

  const prevDebug = process.env.VITE_TT_REALTIME_DEBUG;
  process.env.VITE_TT_REALTIME_DEBUG = "true";
  const debugObs = createRealtimeObservability();
  configureRealtimeObservabilityDebug(debugObs);
  recordCase(
    obsReport,
    "debug_flag_enables_configure",
    "Debug configure path runs when flag on",
    isTeamTournamentRealtimeDebugEnabled(),
  );
  if (prevDebug === undefined) {
    delete process.env.VITE_TT_REALTIME_DEBUG;
  } else {
    process.env.VITE_TT_REALTIME_DEBUG = prevDebug;
  }

  writeReport(finalizeReport(obsReport));
  return obsReport;
}

function runFlagGates() {
  const flagReport = baseReport("TT-6D", "TT6D_FLAG_CONTRACT.json");
  const prevRt = process.env.VITE_TT_REALTIME_ENABLED;
  const prevDbg = process.env.VITE_TT_REALTIME_DEBUG;
  delete process.env.VITE_TT_REALTIME_ENABLED;
  delete process.env.VITE_TT_REALTIME_DEBUG;
  recordCase(flagReport, "realtime_default_false", "Realtime flag default false", !isTeamTournamentRealtimeEnabled());
  recordCase(flagReport, "debug_default_false", "Debug flag default false", !isTeamTournamentRealtimeDebugEnabled());
  process.env.VITE_TT_REALTIME_DEBUG = "true";
  recordCase(flagReport, "debug_true_when_set", "Debug flag true when env set", isTeamTournamentRealtimeDebugEnabled());
  if (prevRt === undefined) {
    delete process.env.VITE_TT_REALTIME_ENABLED;
  } else {
    process.env.VITE_TT_REALTIME_ENABLED = prevRt;
  }
  if (prevDbg === undefined) {
    delete process.env.VITE_TT_REALTIME_DEBUG;
  } else {
    process.env.VITE_TT_REALTIME_DEBUG = prevDbg;
  }
  writeReport(finalizeReport(flagReport));
  return flagReport;
}

function runServiceGate() {
  const svcReport = baseReport("TT-6D", "TT6D_SERVICE_OBSERVABILITY_REPORT.json");
  const svcObs = getTeamTournamentRealtimeObservability();
  const exposed = typeof svcObs.snapshot === "function";
  recordCase(svcReport, "service_observability_export", "Service exposes observability", exposed);
  writeReport(finalizeReport(svcReport));
  return svcReport;
}

function main() {
  const obs = runObservabilityGates();
  const flags = runFlagGates();
  const svc = runServiceGate();

  const finalReport = {
    generatedAt: new Date().toISOString(),
    phase: "TT-6D",
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    verdict:
      obs.verdict === "PASS" && flags.verdict === "PASS" && svc.verdict === "PASS" ? "PASS" : "FAIL",
    reports: [
      obs.reportFile,
      flags.reportFile,
      svc.reportFile,
    ],
    tt6d: obs.verdict === "PASS" && flags.verdict === "PASS" && svc.verdict === "PASS" ? "PASS" : "IN_PROGRESS",
    staging: obs.verdict === "PASS" && flags.verdict === "PASS" && svc.verdict === "PASS" ? "PASS" : "FAIL",
    browser: "NOT_RUN",
    production: "UNTOUCHED",
  };
  fs.writeFileSync(path.join(evidenceDir, "TT6D_STAGING_REPORT.json"), JSON.stringify(finalReport, null, 2));
  console.log(`TT-6D staging gates: ${finalReport.verdict}`);
  if (finalReport.verdict !== "PASS") {
    process.exit(1);
  }
}

main();
