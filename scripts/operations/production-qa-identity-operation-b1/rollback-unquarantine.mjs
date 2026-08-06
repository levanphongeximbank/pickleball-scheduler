#!/usr/bin/env node
/**
 * Operation B1 — rollback / unquarantine.
 * Requires protected original-state snapshot + exact batch ID.
 * Default dry-run. Mutation requires exact Owner GO.
 */
import fs from "node:fs";
import {
  evaluateAuthorization,
  mutationAllowed,
  sha256Hex,
  unquarantineOneIdentity,
  EXPECTED_PRODUCTION_PROJECT_REF,
} from "./lib/index.js";

function envInput() {
  return {
    DRY_RUN: process.env.DRY_RUN,
    PRODUCTION_PROJECT_REF: process.env.PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: process.env.OPERATION_B1_BATCH_ID,
    ALLOWLIST_PATH: process.env.ALLOWLIST_PATH || process.env.SNAPSHOT_PATH,
    ALLOWLIST_SHA256: process.env.ALLOWLIST_SHA256 || process.env.SNAPSHOT_SHA256,
    OWNER_PRODUCTION_GO: process.env.OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: process.env.EXPLICIT_EXECUTE_CONFIRMATION,
  };
}

export async function runRollback(input = envInput(), adapters = {}) {
  const auth = evaluateAuthorization({ ...input, mode: "rollback" });
  const report = {
    operation: "OPERATION_B1_ROLLBACK_UNQUARANTINE",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    dryRun: auth.dryRun,
    ok: false,
    reasons: auth.reasons,
    mutationCalls: 0,
    results: [],
    unresolved: [],
  };

  if (!auth.ok && auth.dryRun) return report;
  if (!auth.dryRun && !mutationAllowed(auth)) {
    report.failReason = "mutation_blocked_missing_authorization";
    return report;
  }

  if (!fs.existsSync(auth.allowlistPath)) {
    report.reasons.push("snapshot_missing");
    return report;
  }
  const bytes = fs.readFileSync(auth.allowlistPath);
  const actualSha = sha256Hex(bytes);
  if (actualSha !== auth.allowlistSha) {
    report.reasons.push("snapshot_sha256_mismatch");
    return report;
  }

  let doc;
  try {
    doc = JSON.parse(bytes.toString("utf8"));
  } catch {
    report.reasons.push("snapshot_json_parse_error");
    return report;
  }

  if (doc.production_project_ref !== EXPECTED_PRODUCTION_PROJECT_REF) {
    report.reasons.push("wrong_production_project_ref");
    return report;
  }
  if (
    doc.batch_id &&
    String(doc.batch_id) !== String(auth.batchId)
  ) {
    report.reasons.push("batch_id_mismatch");
    return report;
  }

  const rows = doc.identities || doc.rows || [];
  for (const row of rows) {
    const one = await unquarantineOneIdentity({
      snapshotRow: row,
      adapters,
      authResult: auth,
      dryRun: !mutationAllowed(auth),
    });
    report.results.push(one);
    report.mutationCalls += one.mutations || 0;
    if (!one.ok) {
      report.unresolved.push(one);
      if (mutationAllowed(auth)) break;
    }
  }

  report.ok =
    report.unresolved.length === 0 &&
    report.results.length === rows.length &&
    rows.length > 0;
  return report;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith(
  "rollback-unquarantine.mjs"
);
if (isMain) {
  runRollback()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.ok ? 0 : 2);
    })
    .catch((err) => {
      console.error(String(err?.message || err));
      process.exit(1);
    });
}
