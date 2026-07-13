#!/usr/bin/env node
/**
 * V5-P1-B — Deploy rating-v5-complete-assessment Edge Function to PRODUCTION.
 *
 * Usage:
 *   node scripts/deploy-v5p1b-edge-production.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, posix, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "./load-env.mjs";
import { PRODUCTION_REF } from "./lib/rating-v5-wave1-manifest.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const FUNCTION_SLUG = "rating-v5-complete-assessment";
const PRODUCTION_ORIGIN = "https://pickleball-scheduler-eight.vercel.app";
const CORS_ENV = `RATING_V5_CORS_ORIGINS=${PRODUCTION_ORIGIN}`;

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const evidenceDir = join(projectRoot, "docs/v5/rating-v5/qa-evidence/v5-p1b-edge");

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

async function setProjectSecret(token, name, value) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ name, value }]),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `secret ${name}: ${res.statusText}`);
  }
  return body;
}

async function deployViaManagementApi(token) {
  execSync("node scripts/bundle-rating-v5-edge-shared.mjs", { cwd: projectRoot, stdio: "inherit" });

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
    `https://api.supabase.com/v1/projects/${PRODUCTION_REF}/functions/deploy?slug=${FUNCTION_SLUG}`,
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
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/functions/${FUNCTION_SLUG}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Deploy verification failed: ${res.status}`);
  }
  return res.json();
}

async function main() {
  loadProjectEnv();
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("FAIL — SUPABASE_ACCESS_TOKEN required");
    process.exit(2);
  }

  console.log(`=== V5-P1-B Edge Deploy — PRODUCTION ${PRODUCTION_REF} ===`);
  console.log(`Staging ref (must NOT deploy): ${STAGING_REF}`);
  console.log(`CORS: ${CORS_ENV}\n`);

  const bundleChecksum = createHash("sha256")
    .update(readFileSync(join(projectRoot, "src/features/pick-vn-rating-v5/server/edgeEntry.js"), "utf8"))
    .digest("hex");

  await setProjectSecret(token, "RATING_V5_CORS_ORIGINS", PRODUCTION_ORIGIN);
  console.log("✅ RATING_V5_CORS_ORIGINS secret set");

  const deployBody = await deployViaManagementApi(token);
  const verifyBody = await verifyDeployedFunction(token).catch(() => null);

  const record = {
    productionProjectRef: PRODUCTION_REF,
    stagingProjectRef: STAGING_REF,
    functionName: FUNCTION_SLUG,
    deployedAt: new Date().toISOString(),
    functionUrl: `https://${PRODUCTION_REF}.supabase.co/functions/v1/${FUNCTION_SLUG}`,
    corsOrigins: PRODUCTION_ORIGIN,
    bundleChecksum,
    deploymentId: deployBody?.id ?? deployBody?.version ?? null,
    verified: Boolean(verifyBody),
    deployOutput: deployBody,
  };

  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, "DEPLOY_RECORD.json"), JSON.stringify(record, null, 2));
  console.log("\nPASS — deployed to production");
  console.log(`FUNCTION URL: ${record.functionUrl}`);
}

main().catch((err) => {
  console.error(`FAIL — ${err.message}`);
  process.exit(1);
});
