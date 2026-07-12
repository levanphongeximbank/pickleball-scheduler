#!/usr/bin/env node
/**
 * Deploy referee-v5-match Edge Function to STAGING ONLY.
 * Usage: node scripts/deploy-referee-v5-edge-staging.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, posix, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const FUNCTION_SLUG = "referee-v5-match";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const outDir = join(projectRoot, "docs/v5/qa-evidence/phase-v5d3");

function assertStagingTarget() {
  loadProjectEnv();
  const url = String(process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
  if (url.includes(PRODUCTION_REF)) {
    console.error("STOP — DO NOT DEPLOY: production ref detected in Supabase URL");
    process.exit(1);
  }
}

function secretStatus() {
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const serviceKey = String(process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  console.log(`SUPABASE_ACCESS_TOKEN: ${token ? "PRESENT" : "MISSING"}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? "CONFIGURED" : "MISSING"}`);
  return { token, serviceKey };
}

function walkFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function toPosix(p) {
  return p.split(sep).join(posix.sep);
}

async function deployViaManagementApi(token) {
  execSync("node scripts/bundle-referee-v5-edge-shared.mjs", { cwd: projectRoot, stdio: "inherit" });

  // Upload each source file as an individual multipart `file` part. The zip
  // upload path of the Management API is affected by an upstream bug
  // (supabase/supabase#41290) that reports "Entrypoint path does not exist"
  // for otherwise-valid archives. Per-file multipart matches the CLI behavior.
  const functionsRoot = join(projectRoot, "supabase/functions");
  const sources = [
    ...walkFiles(join(functionsRoot, FUNCTION_SLUG)),
    ...walkFiles(join(functionsRoot, "_shared")),
  ];

  const entrypointPath = `${FUNCTION_SLUG}/index.ts`;
  const form = new FormData();
  form.append(
    "metadata",
    JSON.stringify({
      entrypoint_path: entrypointPath,
      name: FUNCTION_SLUG,
      verify_jwt: true,
    }),
  );
  for (const file of sources) {
    const relPath = toPosix(relative(functionsRoot, file));
    form.append("file", new Blob([readFileSync(file)]), relPath);
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${STAGING_REF}/functions/deploy?slug=${FUNCTION_SLUG}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || body?.error || res.statusText);
  }
  return body;
}

async function verifyDeployedFunction(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/functions/${FUNCTION_SLUG}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Deploy verification failed: ${res.status}`);
  }
  return res.json();
}

async function main() {
  assertStagingTarget();
  console.log(`=== Referee V5 Edge Deploy — staging ${STAGING_REF} ===`);
  console.log(`Production ref (must NOT match): ${PRODUCTION_REF}\n`);

  const { token } = secretStatus();
  if (!token) {
    console.error("\nFAIL — SUPABASE_ACCESS_TOKEN required for deploy");
    process.exit(2);
  }

  const bundleChecksum = createHash("sha256")
    .update(readFileSync(join(projectRoot, "src/features/referee-v5/server/edgeEntry.js"), "utf8"))
    .digest("hex");

  const deployBody = await deployViaManagementApi(token);
  const verifyBody = await verifyDeployedFunction(token).catch(() => null);

  const record = {
    stagingProjectRef: STAGING_REF,
    productionProjectRef: PRODUCTION_REF,
    functionName: FUNCTION_SLUG,
    architecture: "single-function-action-router",
    actions: ["get-state", "apply-command", "finalize"],
    deployedAt: new Date().toISOString(),
    functionUrl: `https://${STAGING_REF}.supabase.co/functions/v1/${FUNCTION_SLUG}`,
    bundleChecksum,
    deploymentId: deployBody?.id ?? deployBody?.version ?? null,
    verified: Boolean(verifyBody),
    secrets: {
      SUPABASE_ACCESS_TOKEN: "PRESENT",
      SUPABASE_SERVICE_ROLE_KEY: String(process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "").trim()
        ? "CONFIGURED"
        : "MISSING",
    },
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "EDGE_DEPLOY_REPORT.json"), JSON.stringify(record, null, 2));
  console.log("\nPASS — deployed to staging");
  console.log(`FUNCTION URL: ${record.functionUrl}`);
}

main().catch((err) => {
  console.error(`FAIL — ${err.message}`);
  process.exit(1);
});
