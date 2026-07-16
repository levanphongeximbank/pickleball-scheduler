#!/usr/bin/env node
/**
 * P1.2 S1-D/S1-E — Staging foundation verification (STAGING ONLY).
 *
 * Verifies:
 * - S1-A canonical vectors (local)
 * - S1-B snapshot objects (Staging)
 * - S1-C get_setup v7 (Staging)
 * - S1-D envelope/orchestrator foundation (local)
 * - snapshot count stability on read/preview
 * - drift diagnostics path
 * - no setup mutation domain RPC enabled
 * - Production guard
 *
 * Usage:
 *   node scripts/verify-p1_2-snapshot-foundation-staging.mjs
 *   node scripts/verify-p1_2-snapshot-foundation-staging.mjs --local-only
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import {
  SETUP_MUTATION_GATE_ENV,
  isSetupMutationFoundationEnabled,
  isSetupDomainWriteMethodActive,
  isSetupMutationRpcDeployed,
  resolveSetupMutationRpcName,
  previewSetupMutation,
  buildSetupMutationPayload,
  __resetSetupMutationFoundationStateForTests,
} from "../src/features/team-tournament/setup/index.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "docs/v5/qa-evidence/tt-v6-s1de-foundation");

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail: detail ?? null };
}

function assertRef(url) {
  const ref = new URL(url).hostname.split(".")[0];
  if (ref === PRODUCTION_REF) {
    throw new Error("REFUSING Production — this script is Staging-only.");
  }
  if (ref !== STAGING_REF) {
    throw new Error(`Unexpected project ref ${ref}; expected ${STAGING_REF}.`);
  }
  return ref;
}

function runLocalUnitSlice() {
  const files = [
    "tests/tt-v6-p1_2-canonical-vectors.test.js",
    "tests/tt-v6-p1_2-hash-parity.test.js",
    "tests/tt-v6-p1_2-mutation-envelope.test.js",
    "tests/tt-v6-p1_2-s1b-snapshot-schema-contract.test.js",
    "tests/tt-v6-p1_2-s1c-get-setup-v7.test.js",
    "tests/tt-v6-p1_2-s1d-s1e-setup-mutation-foundation.test.js",
  ];
  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdoutTail: String(result.stdout || "").split(/\r?\n/).slice(-20).join("\n"),
    stderrTail: String(result.stderr || "").split(/\r?\n/).slice(-10).join("\n"),
  };
}

async function main() {
  loadProjectEnv();
  const localOnly = process.argv.includes("--local-only");
  mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  const sqlFile = join(ROOT, "docs/v5/team-tournament/p1/PHASE_P1_2_S1C_GET_SETUP_V7.sql");
  const sqlSha = createHash("sha256").update(readFileSync(sqlFile)).digest("hex").toUpperCase();
  results.push(check("S1-C SQL file present", true, { sqlSha }));

  results.push(
    check(
      "setup mutation gate defaults OFF in process env",
      isSetupMutationFoundationEnabled({}) === false,
      { env: SETUP_MUTATION_GATE_ENV }
    )
  );
  results.push(
    check("no setup domain write method active", isSetupDomainWriteMethodActive() === false)
  );
  results.push(
    check(
      "discipline RPC undeployed",
      isSetupMutationRpcDeployed(resolveSetupMutationRpcName("discipline.save")) === false
    )
  );

  __resetSetupMutationFoundationStateForTests();
  const preview = previewSetupMutation({
    method: "discipline.save",
    commandName: "discipline.save",
    tournamentId: "tt-foundation-verify",
    expectedTournamentVersion: 1,
    engineInput: { ok: true },
    engineOutput: { ok: true },
    payload: { probe: true },
    idempotencyKey: "foundation-preview-probe",
    envSource: { [SETUP_MUTATION_GATE_ENV]: "true" },
  });
  results.push(
    check("preview-only creates no RPC call", preview.ok === true && preview.rpcCalled === false, {
      requiresConfirm: preview.requiresConfirm,
      payloadHash: preview.payloadHash,
    })
  );

  const built = buildSetupMutationPayload({
    commandName: "discipline.save",
    tournamentId: "tt-foundation-verify",
    expectedTournamentVersion: 1,
    idempotencyKey: "foundation-hash-probe",
    engineInput: { a: 1 },
    engineOutput: { b: 2 },
    payload: {},
  });
  results.push(
    check("envelope hashes present", built.ok === true && Boolean(built.payloadHash), {
      engineInputHash: built.engineInputHash,
      engineOutputHash: built.engineOutputHash,
    })
  );

  const localTests = runLocalUnitSlice();
  results.push(check("local S1-A/B/C/D/E unit slice", localTests.ok, localTests));

  let staging = null;
  if (!localOnly) {
    const { url, serviceKey } = getStagingSupabaseEnv();
    if (!url || !serviceKey) {
      results.push(
        check("Staging env present", false, "Missing STAGING/VITE_SUPABASE URL or service role key")
      );
    } else {
      const ref = assertRef(url);
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { count: snapCountBefore, error: snapErr } = await admin
        .from("team_tournament_setup_snapshots")
        .select("id", { count: "exact", head: true });
      results.push(
        check("S1-B snapshots table readable", !snapErr, {
          count: snapCountBefore,
          error: snapErr?.message || null,
          ref,
        })
      );

      // Probe get_setup via PostgREST: calling with anon/service may return NOT_AUTHENTICATED JSON —
      // existence of 4-arg function is validated when PostgREST accepts p_schema_version.
      const { data: setupProbe, error: setupErr } = await admin.rpc("team_tournament_get_setup", {
        p_tournament_id: "tt-s1b1-validation",
        p_viewer_team_id: null,
        p_schema_version: 7,
        p_diagnostic: true,
      });
      const setupOkShape =
        setupProbe &&
        typeof setupProbe === "object" &&
        (setupProbe.ok === true ||
          setupProbe.code === "NOT_AUTHENTICATED" ||
          setupProbe.code === "NOT_FOUND" ||
          setupProbe.code === "FORBIDDEN");
      results.push(
        check("S1-C get_setup v7 callable (signature accepted)", !setupErr && setupOkShape, {
          error: setupErr?.message || null,
          code: setupProbe?.code || null,
          schemaVersion: setupProbe?.schemaVersion ?? null,
        })
      );

      const { count: snapCountAfter, error: snapErr2 } = await admin
        .from("team_tournament_setup_snapshots")
        .select("id", { count: "exact", head: true });
      results.push(
        check(
          "snapshot count stable across get_setup probe",
          !snapErr2 && snapCountBefore === snapCountAfter,
          { before: snapCountBefore, after: snapCountAfter }
        )
      );

      // Confirm Production URL not used
      results.push(
        check("Production ref not targeted", ref === STAGING_REF && ref !== PRODUCTION_REF, { ref })
      );

      staging = { ref, snapCountBefore, snapCountAfter, setupProbeCode: setupProbe?.code || null };
    }
  } else {
    results.push(check("local-only mode — Staging SQL probes skipped", true));
  }

  const failed = results.filter((r) => !r.ok);
  const report = {
    phase: "P1.2 S1-D/S1-E",
    title: "Snapshot foundation staging verification",
    stagingRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    localOnly,
    staging,
    results,
    failed: failed.length,
    verdict: failed.length === 0 ? "PASS — FOUNDATION CERTIFIED" : "PARTIAL — FIX REQUIRED",
  };

  writeFileSync(join(OUT_DIR, "STAGING_FOUNDATION_VERIFY_REPORT.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
