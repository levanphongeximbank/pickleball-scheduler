/**
 * Tenant Isolation QA — staging orchestrator
 *
 * Chạy:
 *   npm run test:verify-tenant-isolation
 *
 * Yêu cầu .env.staging-qa.local (gitignored):
 *   STAGING_SUPABASE_URL=https://qyewbxjsiiyufanzcjcq.supabase.co
 *   STAGING_SUPABASE_ANON_KEY=<staging anon key>
 *   STAGING_OWNER_A_PASSWORD=...
 *   STAGING_OWNER_B_PASSWORD=...
 *
 * Hoặc set VITE_SUPABASE_URL trỏ staging ref qyewbxjsiiyufanzcjcq trong .env.local
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadStagingQaEnv() {
  const filePath = path.join(rootDir, ".env.staging-qa.local");
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function applyStagingSupabaseEnv() {
  loadStagingQaEnv();

  const stagingPath = path.join(rootDir, ".env.staging.local");
  if (fs.existsSync(stagingPath)) {
    const content = fs.readFileSync(stagingPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line.startsWith("VITE_SUPABASE_URL=") && !process.env.STAGING_SUPABASE_URL) {
        process.env.STAGING_SUPABASE_URL = line.slice("VITE_SUPABASE_URL=".length).trim();
      }
      if (line.startsWith("VITE_SUPABASE_ANON_KEY=") && !process.env.STAGING_SUPABASE_ANON_KEY) {
        process.env.STAGING_SUPABASE_ANON_KEY = line.slice("VITE_SUPABASE_ANON_KEY=".length).trim();
      }
      if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
        process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY = line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
      }
    }
  }

  const stagingUrl = String(process.env.STAGING_SUPABASE_URL || "").trim();
  const stagingAnon = String(process.env.STAGING_SUPABASE_ANON_KEY || "").trim();
  const stagingService = String(process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (stagingUrl && stagingUrl.includes(STAGING_REF)) {
    process.env.VITE_SUPABASE_URL = stagingUrl;
  }
  if (stagingAnon) {
    process.env.VITE_SUPABASE_ANON_KEY = stagingAnon;
  }
  if (stagingService) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = stagingService;
  }
}

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

function runStep(label, command, args) {
  info(`\n=== ${label} ===\n`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    fail(`${label} — exit ${result.status ?? "unknown"}`);
  }

  ok(`${label} — PASS`);
}

function main() {
  console.log("=== Tenant Isolation QA — Staging Orchestrator ===\n");

  applyStagingSupabaseEnv();

  const url = String(process.env.VITE_SUPABASE_URL || "");
  if (!url.includes(STAGING_REF)) {
    fail(
      `VITE_SUPABASE_URL không trỏ staging ${STAGING_REF}.\n` +
        "Thêm vào .env.staging-qa.local:\n" +
        "  STAGING_SUPABASE_URL=https://qyewbxjsiiyufanzcjcq.supabase.co\n" +
        "  STAGING_SUPABASE_ANON_KEY=<staging anon key>"
    );
  }

  ok(`Supabase URL → staging ${STAGING_REF}`);

  runStep("Unit — tenant-isolation-qa", "node", [
    "--test",
    "tests/tenant-isolation-qa.test.js",
  ]);

  runStep("Unit — court-service tenant scope", "node", [
    "--test",
    "tests/court-service.test.js",
  ]);

  runStep("RLS — cross-tenant JWT probe", "node", [
    "scripts/verify-cross-tenant-rls-staging.mjs",
  ]);

  runStep("Billing — tenant mapping", "node", [
    "scripts/verify-billing-tenant-mapping-staging.mjs",
  ]);

  runStep("UI probe — court count + club_data JWT", "node", [
    "scripts/probe-tenant-isolation-ui-staging.mjs",
  ]);

  console.log("\n=== Tenant Isolation QA — Automated gates PASS ===\n");
  info("Tiếp theo: browser QA theo docs/v5/PHASE_TENANT_ISOLATION_BROWSER_QA.md");
}

main();
