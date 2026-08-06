#!/usr/bin/env node
/**
 * Operation B1 — postcheck (SELECT/read adapters only in future live use).
 */
import {
  evaluateAuthorization,
  loadAndValidateAllowlistFile,
  QUARANTINE_PROFILE_STATUS,
  EXPECTED_B1_COUNT,
  maskId,
} from "./lib/index.js";

function envInput() {
  return {
    DRY_RUN: process.env.DRY_RUN ?? "true",
    PRODUCTION_PROJECT_REF: process.env.PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: process.env.OPERATION_B1_BATCH_ID,
    ALLOWLIST_PATH: process.env.ALLOWLIST_PATH,
    ALLOWLIST_SHA256: process.env.ALLOWLIST_SHA256,
  };
}

export async function runPostcheck(input = envInput(), adapters = {}) {
  const auth = evaluateAuthorization(input);
  const report = {
    operation: "OPERATION_B1_POSTCHECK",
    ok: false,
    reasons: auth.reasons,
    checked: 0,
    failures: [],
    mutationCalls: 0,
  };
  if (!auth.ok) return report;

  const loaded = loadAndValidateAllowlistFile(
    auth.allowlistPath,
    auth.allowlistSha,
    { repoRoots: adapters.repoRoots || [process.cwd()] }
  );
  if (!loaded.ok) {
    report.reasons = loaded.errors;
    return report;
  }

  if (typeof adapters.fetchProfile !== "function") {
    report.mode = "allowlist_only";
    report.checked = loaded.identities.length;
    report.ok = loaded.identities.length === EXPECTED_B1_COUNT;
    return report;
  }

  for (const row of loaded.identities) {
    report.checked += 1;
    const profile = await adapters.fetchProfile(row.profile_id);
    if (!profile) {
      report.failures.push({ id: maskId(row.profile_id), reason: "profile_missing" });
      continue;
    }
    if (String(profile.status || "").toLowerCase() !== QUARANTINE_PROFILE_STATUS) {
      report.failures.push({
        id: maskId(row.profile_id),
        reason: "profile_not_quarantined",
      });
    }
    if (typeof adapters.fetchAuthBanState === "function") {
      const banned = await adapters.fetchAuthBanState(row.auth_user_id);
      if (banned !== true) {
        report.failures.push({
          id: maskId(row.auth_user_id),
          reason: "auth_not_banned",
        });
      }
    }
    if (typeof adapters.fetchReferenceCounts === "function") {
      const refs = await adapters.fetchReferenceCounts(row.profile_id);
      const nonzero = Object.entries(refs || {}).filter(([, v]) => Number(v) !== 0);
      if (nonzero.length) {
        report.failures.push({
          id: maskId(row.profile_id),
          reason: "unexpected_business_reference",
        });
      }
    }
  }

  report.ok = report.failures.length === 0 && report.checked === EXPECTED_B1_COUNT;
  return report;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith(
  "postcheck.mjs"
);
if (isMain) {
  runPostcheck()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.ok ? 0 : 2);
    })
    .catch((err) => {
      console.error(String(err?.message || err));
      process.exit(1);
    });
}
