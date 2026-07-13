#!/usr/bin/env node
/**
 * Deploy Vercel Preview with Referee V5 remote mode (NOT production).
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { D41_OUT_DIR, STAGING_REF, PRODUCTION_REF } from "./referee-v5-staging-harness.mjs";

const OUT_DIR = join(process.cwd(), D41_OUT_DIR);

async function main() {
  loadProjectEnv();
  const { url, anonKey } = getStagingSupabaseEnv();
  if (String(url).includes(PRODUCTION_REF)) {
    throw new Error("STOP — production ref in env");
  }
  if (!String(url).includes(STAGING_REF)) {
    throw new Error("STOP — expected staging ref");
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const deployEnv = {
    ...process.env,
    VITE_REFEREE_V5_ENABLED: "true",
    VITE_REFEREE_V5_DATA_MODE: "remote",
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: anonKey,
    VITE_RBAC_ENABLED: "false",
  };

  console.log("Building + deploying Preview (NOT production)...");
  let previewUrl = "";
  let deployPass = false;
  let deployError = null;

  try {
    const buildOut = execSync("npm run build", {
      env: deployEnv,
      encoding: "utf8",
      stdio: "pipe",
    });
    deployPass = buildOut.includes("built in") || buildOut.includes("✓ built");
    const deployOut = execSync("npx vercel deploy --yes", {
      env: deployEnv,
      encoding: "utf8",
      stdio: "pipe",
    });
    const match = deployOut.match(/https:\/\/[^\s]+\.vercel\.app/g);
    previewUrl = match ? match[match.length - 1] : "";
    deployPass = Boolean(previewUrl);
    console.log(`Preview URL: ${previewUrl}`);
  } catch (err) {
    deployError = err.stderr || err.stdout || err.message;
    console.error("Deploy failed — use existing STAGING_PREVIEW_URL if configured");
  }

  const existingPreview = String(process.env.STAGING_PREVIEW_URL || "").trim();
  const report = {
    stagingRef: STAGING_REF,
    productionDeployment: "NOT_PERFORMED",
    remoteMode: "ENABLED_ON_PREVIEW_ONLY",
    viteRefereeV5Enabled: true,
    viteRefereeV5DataMode: "remote",
    deployAttempted: true,
    deployPass,
    previewUrl: previewUrl || existingPreview || null,
    error: deployError ? String(deployError).slice(0, 500) : null,
  };

  writeFileSync(join(OUT_DIR, "PREVIEW_DEPLOY_REPORT.json"), JSON.stringify(report, null, 2));
  process.exit(deployPass || existingPreview ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
