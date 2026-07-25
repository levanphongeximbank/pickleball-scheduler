#!/usr/bin/env node
/**
 * COMMS-ACT-05 Staging smoke readiness / runner.
 *
 * Default: --read-only (no remote mutation).
 * Live writes require exact Owner GO token in COMMS_ACT_05_STAGING_OWNER_GO.
 *
 * Never targets Production ref expuvcohlcjzvrrauvud.
 */
import { evaluateCommsAct05Preflight } from "../../src/features/communication/activation/commsAct05Gates.js";
import {
  COMMUNICATION_TRUSTED_BACKEND_ENV,
  COMMUNICATION_SMOKE_FIXTURE_MARKER,
} from "../../src/features/communication/trustedBackend/constants.js";
import {
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
} from "../../src/features/communication/activation/stagingTarget.js";

const args = new Set(process.argv.slice(2));
const readOnly = !args.has("--mutate");
const requireBackup = args.has("--require-backup");

const env = process.env;
const preflight = evaluateCommsAct05Preflight({
  url: env.STAGING_SUPABASE_URL || env.VITE_SUPABASE_URL || "",
  dbUrl: env.STAGING_SUPABASE_DB_URL || "",
  targetConfirm: env.COMMS_STAGING_TARGET_CONFIRM || COMMS_STAGING_PROJECT_REF,
  environment: "staging",
  backupEvidence: env.COMMS_ACT_05_STAGING_BACKUP_EVIDENCE || "",
  backupEvidencePath: env.COMMS_ACT_05_STAGING_BACKUP_EVIDENCE_PATH || "",
  ownerGo: env.COMMS_ACT_05_STAGING_OWNER_GO || "",
  remoteMutateRequested: !readOnly,
  requireBackupEvidence: requireBackup || !readOnly,
});

const report = {
  mode: readOnly ? "READ_ONLY" : "MUTATE_REQUESTED",
  stagingRef: COMMS_STAGING_PROJECT_REF,
  productionRefBlocked: COMMS_PRODUCTION_PROJECT_REF,
  fixtureMarker: COMMUNICATION_SMOKE_FIXTURE_MARKER,
  ownerGoTokenExpected: COMMUNICATION_TRUSTED_BACKEND_ENV.OWNER_GO_TOKEN,
  preflight,
  mutationCount: 0,
  secretsPrinted: false,
};

console.log(JSON.stringify(report, null, 2));

if (!preflight.pass) {
  process.exitCode = 2;
  console.error(`COMMS-ACT-05 preflight FAIL: ${preflight.verdict}`);
  process.exit(process.exitCode);
}

if (!readOnly) {
  console.error(
    "COMMS-ACT-05: Owner GO accepted by gate, but this script stops before remote mutation in ACT-05 readiness package. Use a dedicated live runner only after Owner confirms backup + identities."
  );
  process.exitCode = 0;
  console.log(
    "COMMS_ACT_05_READY_FOR_STAGING_SMOKE_OWNER_GO — mutate path gated; no writes executed by this readiness script."
  );
  process.exit(0);
}

console.log(preflight.verdict);
