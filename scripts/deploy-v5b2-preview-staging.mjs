#!/usr/bin/env node
/**
 * Deploy Vercel Preview for V5-B.2 (NOT production).
 * Sets Preview env vars, builds with staging Supabase + V5 flag, deploys, updates STAGING_PREVIEW_URL.
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const BRANCH = "feature/competition-core-standardization";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocalPath = path.join(rootDir, ".env.staging-qa.local");

function run(cmd, options = {}) {
  return execSync(cmd, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: options.quiet ? "pipe" : "inherit",
    ...options,
  });
}

function setPreviewEnv(name, value) {
  try {
    spawnSync("npx", ["vercel", "env", "rm", name, "preview", "-y"], {
      cwd: rootDir,
      stdio: "pipe",
      shell: true,
    });
  } catch {
    // ignore missing
  }
  const result = spawnSync(
    "npx",
    ["vercel", "env", "add", name, "preview", "--force", "--yes", "--value", value],
    {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    },
  );
  if (result.status !== 0) {
    const err = [result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`vercel env add ${name} failed: ${err.slice(0, 300)}`);
  }
  console.log(`VERCEL_PREVIEW_ENV: ${name}=set (value hidden)`);
}

function upsertEnvLocalLine(key, value) {
  let content = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    content = content.replace(pattern, line);
  } else {
    content = `${content.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(envLocalPath, content, "utf8");
  console.log(`${key}: updated in .env.staging-qa.local`);
}

async function main() {
  loadProjectEnv();
  const { url, anonKey } = getStagingSupabaseEnv();
  if (!url.includes(STAGING_REF) || url.includes(PRODUCTION_REF)) {
    throw new Error("STOP — staging Supabase URL guard failed");
  }
  if (!anonKey) {
    throw new Error("STOP — STAGING_SUPABASE_ANON_KEY missing");
  }

  const branch = run("git branch --show-current", { quiet: true }).trim();
  if (branch !== BRANCH) {
    throw new Error(`STOP — expected branch ${BRANCH}, got ${branch}`);
  }

  console.log("Setting Vercel Preview environment variables (Preview only)...");
  setPreviewEnv("VITE_PICK_VN_RATING_V5_ENABLED", "true");
  setPreviewEnv("VITE_SUPABASE_URL", url);
  setPreviewEnv("VITE_SUPABASE_ANON_KEY", anonKey);

  const deployEnv = {
    ...process.env,
    VITE_PICK_VN_RATING_V5_ENABLED: "true",
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: anonKey,
  };

  console.log("Building Preview bundle (NOT production)...");
  run("npm run build", { env: deployEnv, quiet: false });

  console.log("Deploying Preview with build-time env (no --prod)...");
  const deployArgs = [
    "vercel",
    "deploy",
    "--yes",
    "--build-env",
    "VITE_PICK_VN_RATING_V5_ENABLED=true",
    "--build-env",
    `VITE_SUPABASE_URL=${url}`,
    "--build-env",
    `VITE_SUPABASE_ANON_KEY=${anonKey}`,
  ];
  const deployOut = spawnSync("npx", deployArgs, {
    cwd: rootDir,
    env: deployEnv,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
  });
  if (deployOut.status !== 0) {
    const err = [deployOut.stderr, deployOut.stdout].filter(Boolean).join("\n");
    throw new Error(`vercel deploy failed: ${err.slice(0, 500)}`);
  }
  const deployText = [deployOut.stdout, deployOut.stderr].filter(Boolean).join("\n");
  const matches = deployText.match(/https:\/\/[^\s]+\.vercel\.app/g) || [];
  const previewUrl = matches.length ? matches[matches.length - 1].replace(/\/+$/, "") : "";
  if (!previewUrl) {
    throw new Error("Deploy finished but Preview URL not found in CLI output");
  }

  console.log(`Preview deployment URL: ${previewUrl}`);
  upsertEnvLocalLine("STAGING_PREVIEW_URL", previewUrl);

  console.log("Waiting for deployment Ready...");
  run(`npx vercel inspect "${previewUrl}" --wait`, { quiet: false });

  console.log("DEPLOY_V5B2_PREVIEW: PASS");
  console.log(`PREVIEW_URL=${previewUrl}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
