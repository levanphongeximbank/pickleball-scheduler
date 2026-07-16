#!/usr/bin/env node
/**
 * P1.3 Team Tournament domain persistence verification (STAGING ONLY).
 * Use --local-only to run contract tests without contacting Staging.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const RPCS = [
  "team_tournament_save_discipline",
  "team_tournament_remove_discipline",
  "team_tournament_reorder_disciplines",
  "team_tournament_replace_groups",
  "team_tournament_clear_groups",
  "team_tournament_replace_matchups",
  "team_tournament_update_matchup_schedule",
  "team_tournament_apply_schedule_batch",
  "team_tournament_publish_schedule",
  "team_tournament_lock_schedule",
];
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "docs/v5/qa-evidence/tt-v6-p1_3-staging");

function check(name, ok, detail = null) {
  return { name, ok: Boolean(ok), detail };
}

function assertStagingRef(url) {
  const ref = new URL(url).hostname.split(".")[0];
  if (ref === PRODUCTION_REF) {
    throw new Error("REFUSING Production — this verification is Staging-only.");
  }
  if (ref !== STAGING_REF) {
    throw new Error(`Unexpected project ref ${ref}; expected ${STAGING_REF}.`);
  }
  return ref;
}

function runLocalTests() {
  const result = spawnSync(
    process.execPath,
    ["--test", "tests/tt-v6-p1_3-domain-persistence.test.js", "tests/tt-v6-p1_3-hash-snapshot-reload.test.js"],
    { cwd: ROOT, encoding: "utf8" }
  );
  return {
    ok: result.status === 0,
    status: result.status,
    stdoutTail: String(result.stdout || "").split(/\r?\n/).slice(-20).join("\n"),
    stderrTail: String(result.stderr || "").split(/\r?\n/).slice(-10).join("\n"),
  };
}

async function main() {
  loadProjectEnv();
  mkdirSync(OUT_DIR, { recursive: true });
  const localOnly = process.argv.includes("--local-only");
  const localTests = runLocalTests();
  const results = [check("P1.3 local unit contract", localTests.ok, localTests)];
  let staging = null;

  if (!localOnly) {
    const { url, serviceKey } = getStagingSupabaseEnv();
    if (!url || !serviceKey) {
      results.push(check("Staging credentials present", false, "Missing Staging URL or service key."));
    } else {
      const ref = assertStagingRef(url);
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.rpc("team_tournament_get_setup", {
        p_tournament_id: "p1_3-rpc-probe",
        p_viewer_team_id: null,
        p_schema_version: 7,
        p_diagnostic: false,
      });
      const accepted = !error || !String(error.message || "").includes("Could not find");
      results.push(check("get_setup v7 signature available", accepted, error?.message || data?.code || null));

      for (const rpc of RPCS) {
        const { error: rpcError } = await admin.rpc(rpc, {
          p_tournament_id: "p1_3-rpc-probe",
          p_envelope: {},
          p_expected_version: 1,
          p_idempotency_key: "p1_3-rpc-probe",
        });
        results.push(
          check(
            `${rpc} exists`,
            !rpcError || !String(rpcError.message || "").includes("Could not find"),
            rpcError?.message || null
          )
        );
      }
      staging = { ref, fixtureWorkflow: "Skipped unless a fixture-aware authenticated workflow is supplied." };
    }
  } else {
    results.push(check("local-only mode", true, "Staging RPC probes skipped."));
  }

  const failed = results.filter((result) => !result.ok);
  const report = {
    phase: "P1.3",
    title: "Team Tournament domain persistence staging verification",
    stagingRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    localOnly,
    staging,
    results,
    failed: failed.length,
    verdict: failed.length === 0 ? "PASS" : "PARTIAL — FIX REQUIRED",
  };
  writeFileSync(join(OUT_DIR, "P1_3_DOMAIN_PERSISTENCE_VERIFY_REPORT.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
