#!/usr/bin/env node
/**
 * COMMS-ACT-01 — Staging activation preflight (fail-closed).
 *
 * Modes:
 *   --offline (default): static SQL/package checks; no DB connection
 *   --live-gates: also evaluate Owner GO / Staging identity / backup env gates
 *                 (still no SQL apply; values never printed)
 *
 * Does NOT apply SQL.
 * Does NOT connect to Production.
 * Does NOT enable realtime.
 * Refuses --apply.
 *
 * Usage:
 *   node scripts/communication/comms-act-01-staging-preflight.mjs
 *   node scripts/communication/comms-act-01-staging-preflight.mjs --live-gates
 */

import { loadProjectEnv } from "../load-env.mjs";
import {
  evaluateCommsAct01Preflight,
  COMMS_ACT_01_VERDICTS,
} from "../../src/features/communication/activation/index.js";

function parseArgs(argv) {
  const args = {
    mode: "offline",
    environment: "staging",
    applyRequested: false,
    json: false,
  };
  for (const raw of argv) {
    if (raw === "--offline" || raw === "--mode=offline") {
      args.mode = "offline";
    } else if (raw === "--live-gates" || raw === "--mode=live-gates") {
      args.mode = "live-gates";
    } else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    } else if (raw === "--apply" || raw === "--apply-staging") {
      args.applyRequested = true;
    } else if (raw === "--json") {
      args.json = true;
    } else if (raw === "--help" || raw === "-h") {
      args.help = true;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`COMMS-ACT-01 Staging preflight (no apply, no remote mutation)

Usage:
  node scripts/communication/comms-act-01-staging-preflight.mjs [--offline|--live-gates] [--json]

Refuse flags:
  --apply / --apply-staging  → always blocked in COMMS-ACT-01
`);
    process.exit(0);
  }

  loadProjectEnv();

  const result = evaluateCommsAct01Preflight({
    mode: args.mode,
    environment: args.environment,
    applyRequested: args.applyRequested,
    env: process.env,
  });

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          phase: result.phase,
          mode: result.mode,
          verdict: result.verdict,
          pass: result.pass,
          remoteApplyAllowed: result.remoteApplyAllowed,
          sqlStatus: result.sql.status,
          sqlSha256: result.sql.forwardSha256,
          tableCount: result.sql.tablesFound?.length ?? 0,
          targetStatus: result.target.status,
          ownerGoStatus: result.ownerGo.status,
          backupStatus: result.backup.status,
          findings: result.findings,
          secretsPrinted: false,
        },
        null,
        2
      )
    );
  } else {
    console.log("=== COMMS-ACT-01 Staging Preflight ===");
    console.log(`mode: ${result.mode}`);
    console.log(`verdict: ${result.verdict}`);
    console.log(`pass: ${result.pass}`);
    console.log(`remoteApplyAllowed: ${result.remoteApplyAllowed}`);
    console.log(`sql: ${result.sql.status} sha256=${result.sql.forwardSha256 || "n/a"}`);
    console.log(
      `tables: ${result.sql.tablesFound?.length ?? 0}/${result.sql.expectedTableCount}`
    );
    console.log(`target: ${result.target.status}`);
    console.log(`ownerGo: ${result.ownerGo.status}`);
    console.log(`backup: ${result.backup.status}`);
    console.log(`realtimeInPackage: ${result.sql.realtimeInPackage}`);
    if (result.findings.length) {
      console.log("--- findings ---");
      for (const f of result.findings) {
        console.log(`[${f.level}] ${f.code}: ${f.message}`);
      }
    }
    console.log(`next: ${result.nextWorkstream}`);
  }

  const hardFail =
    !result.pass ||
    result.verdict === COMMS_ACT_01_VERDICTS.BLOCKED_APPLY_REFUSED ||
    result.verdict === COMMS_ACT_01_VERDICTS.BLOCKED_SQL_PACKAGE ||
    (args.mode === "live-gates" &&
      (result.verdict === COMMS_ACT_01_VERDICTS.BLOCKED_TARGET_IDENTITY ||
        result.verdict === COMMS_ACT_01_VERDICTS.BLOCKED_BACKUP ||
        result.verdict === COMMS_ACT_01_VERDICTS.BLOCKED_OWNER_GO));

  process.exit(hardFail ? 1 : 0);
}

main();
