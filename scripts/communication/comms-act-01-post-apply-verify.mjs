#!/usr/bin/env node
/**
 * COMMS-ACT-01 — Post-apply verification package (fail-closed).
 *
 * Default --offline: emits expected inventory + verification SQL checklist.
 * Does NOT apply SQL.
 * Does NOT run remote queries in COMMS-ACT-01 (live deferred to COMMS-ACT-02).
 *
 * Usage:
 *   node scripts/communication/comms-act-01-post-apply-verify.mjs
 *   node scripts/communication/comms-act-01-post-apply-verify.mjs --offline --json
 *   node scripts/communication/comms-act-01-post-apply-verify.mjs --live
 */

import { loadProjectEnv } from "../load-env.mjs";
import { COMMUNICATION_TABLE_NAME_VALUES } from "../../src/features/communication/persistence/schema.js";
import {
  COMMS_ACT_01_ENV_NAMES,
  COMMS_ACT_01_EXPECTED_RPC,
  COMMS_ACT_01_EXPECTED_TRIGGERS,
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
  evaluateCommsAct01Preflight,
  evaluateCommsStagingTargetIdentity,
  loadCommsAct01SqlPackageManifest,
} from "../../src/features/communication/activation/index.js";

function parseArgs(argv) {
  const args = {
    mode: "offline",
    environment: "staging",
    applyRequested: false,
    json: false,
  };
  for (const raw of argv) {
    if (raw === "--offline") args.mode = "offline";
    else if (raw === "--live") args.mode = "live";
    else if (raw === "--apply" || raw === "--apply-staging") args.applyRequested = true;
    else if (raw === "--json") args.json = true;
    else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    } else if (raw === "--help" || raw === "-h") args.help = true;
  }
  return args;
}

function buildVerificationChecklist(manifest) {
  const tables = [...COMMUNICATION_TABLE_NAME_VALUES];
  return {
    objectInventory: {
      tables,
      expectedTableCount: manifest.expectedTableCount,
      rpcs: [...COMMS_ACT_01_EXPECTED_RPC],
      triggers: [...COMMS_ACT_01_EXPECTED_TRIGGERS],
    },
    checks: [
      "rls_enabled_on_all_communication_tables",
      "deny_all_policies_present",
      "anon_authenticated_revoked",
      "service_role_trusted_path_smoke",
      "direct_pair_uniqueness",
      "club_general_channel_uniqueness",
      "community_lobby_uniqueness",
      "reply_same_conversation_trigger",
      "read_cursor_monotonic_rpc",
      "message_position_rpc",
      "idempotency_pk",
      "report_moderation_integrity",
      "realtime_publication_still_absent",
    ],
    verificationSql: [
      `select c.relname as table_name, c.relrowsecurity as rls_enabled
 from pg_class c
 join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname like 'communication_%'
 order by 1;`,
      `select schemaname, tablename, policyname, qual, with_check
 from pg_policies
 where schemaname = 'public' and tablename like 'communication_%'
 order by 1,2,3;`,
      `select p.proname
 from pg_proc p
 join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'communication_%'
 order by 1;`,
      `select pubname, schemaname, tablename
 from pg_publication_tables
 where tablename like 'communication_%';`,
    ],
    negativeRlsPackage: [
      "anon SELECT/INSERT/UPDATE/DELETE denied on all communication_*",
      "authenticated non-participant denied on Direct",
      "wrong-club member denied on Club channel",
      "wrong-tenant denied on Community",
      "suspended/removed club member denied",
      "banned/suspended community participant denied",
      "UI-supplied actorId cannot override auth actor",
    ],
    forwardSha256: manifest.forwardSha256,
    stagingRefRequired: COMMS_STAGING_PROJECT_REF,
    productionRefForbidden: COMMS_PRODUCTION_PROJECT_REF,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`COMMS-ACT-01 post-apply verification (no apply)

  --offline (default)  emit inventory + SQL checklist
  --live               evaluates gates; remote queries deferred to COMMS-ACT-02
`);
    process.exit(0);
  }

  loadProjectEnv();

  if (args.applyRequested) {
    console.error(
      JSON.stringify({
        verdict: "COMMS_ACT_01_BLOCKED_APPLY_REFUSED",
        message: "Post-apply verify refuses --apply.",
        secretsPrinted: false,
      })
    );
    process.exit(1);
  }

  const manifest = loadCommsAct01SqlPackageManifest();
  const checklist = buildVerificationChecklist(manifest);

  if (args.mode === "offline") {
    const payload = {
      phase: "COMMS-ACT-01",
      mode: "offline",
      verdict:
        manifest.status === "PASS"
          ? "COMMS_ACT_01_VERIFY_PACKAGE_READY"
          : "COMMS_ACT_01_BLOCKED_SQL_PACKAGE",
      remoteQueryExecuted: false,
      sqlApplyExecuted: false,
      realtimeEnabled: false,
      checklist,
      sqlPackageStatus: manifest.status,
      findings: manifest.findings,
      secretsPrinted: false,
    };
    if (args.json) console.log(JSON.stringify(payload, null, 2));
    else {
      console.log("=== COMMS-ACT-01 Post-Apply Verify (offline package) ===");
      console.log(`verdict: ${payload.verdict}`);
      console.log(`sqlPackage: ${manifest.status}`);
      console.log(`expected tables: ${manifest.expectedTableCount}`);
      console.log(`sha256: ${manifest.forwardSha256}`);
      console.log("remoteQueryExecuted: false");
      console.log("Checks:", checklist.checks.join(", "));
    }
    process.exit(manifest.status === "PASS" ? 0 : 1);
  }

  const preflight = evaluateCommsAct01Preflight({
    mode: "live-gates",
    environment: args.environment,
    applyRequested: false,
    env: process.env,
  });

  const target = evaluateCommsStagingTargetIdentity({
    environment: args.environment,
    url:
      process.env[COMMS_ACT_01_ENV_NAMES.STAGING_SUPABASE_URL] ||
      process.env[COMMS_ACT_01_ENV_NAMES.SUPABASE_URL],
    dbUrl: process.env[COMMS_ACT_01_ENV_NAMES.STAGING_DB_URL],
    targetConfirm: process.env[COMMS_ACT_01_ENV_NAMES.TARGET_CONFIRM],
  });

  const payload = {
    phase: "COMMS-ACT-01",
    mode: "live",
    verdict: "COMMS_ACT_01_LIVE_VERIFY_DEFERRED_TO_ACT_02",
    message:
      "COMMS-ACT-01 does not execute remote verification queries. Gates evaluated; live verify belongs to COMMS-ACT-02 after Owner GO.",
    preflightVerdict: preflight.verdict,
    targetStatus: target.status,
    backupStatus: preflight.backup.status,
    ownerGoStatus: preflight.ownerGo.status,
    remoteQueryExecuted: false,
    sqlApplyExecuted: false,
    checklist,
    secretsPrinted: false,
  };

  if (args.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log("=== COMMS-ACT-01 Post-Apply Verify (live deferred) ===");
    console.log(`verdict: ${payload.verdict}`);
    console.log(`preflight: ${preflight.verdict}`);
    console.log(`target: ${target.status}`);
    console.log("remoteQueryExecuted: false (ACT-01 policy)");
  }

  process.exit(1);
}

main();
