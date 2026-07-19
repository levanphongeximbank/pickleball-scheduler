/**
 * Phase 2B — Apply Notification Production SQL pack.
 *
 * DEFAULT: dry-run / verification only. Never applies unless --apply is set
 * AND NOTIFICATION_PHASE2B_PRODUCTION_GO=1 AND Owner confirm flags are present.
 *
 * Guards:
 *  - Exact Production project ref required (expuvcohlcjzvrrauvud)
 *  - Block Staging / QA project refs
 *  - Refuse missing project identity
 *  - Refuse environment other than production
 *  - Refuse worker / QA cleanup enablement in SQL pack
 *  - Never print secrets
 *  - Stop on first error
 *  - Produce evidence summary
 *
 * Usage:
 *   node scripts/apply-notification-phase2b-production-sql.mjs
 *   node scripts/apply-notification-phase2b-production-sql.mjs --dry-run
 *   NOTIFICATION_PHASE2B_PRODUCTION_GO=1 \\
 *     NOTIFICATION_PHASE2B_CONFIRM_PRODUCTION=I_UNDERSTAND_PRODUCTION \\
 *     NOTIFICATION_PHASE2B_EXPECTED_PROJECT_REF=expuvcohlcjzvrrauvud \\
 *     node scripts/apply-notification-phase2b-production-sql.mjs --apply
 *
 * Phase 2B does NOT execute apply mode in CI. Do not run --apply without Owner approval.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  BLOCKED_PROJECT_REFS,
  requireProductionProjectRef,
} from "../src/features/notifications/config/productionSafetyConfig.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SQL_FILES = Object.freeze([
  "docs/supabase-notification-phase2b-production-13-foundation.sql",
  "docs/supabase-notification-phase2b-production-13-rpc-hardening.sql",
  "docs/supabase-notification-phase2b-production-15-delivery-worker.sql",
  "docs/supabase-notification-phase2b-production-16-ops.sql",
  "docs/supabase-notification-phase2b-production-runtime-config.sql",
  "docs/supabase-notification-phase2b-production-security-hardening.sql",
]);

const FORBIDDEN_SQL_PATTERNS = [
  { re: /qyewbxjsiiyufanzcjcq/i, code: "staging_project_ref_in_sql" },
  { re: /allow_worker',\s*'true'/i, code: "worker_enabled_seed" },
  { re: /allow_qa_cleanup',\s*'true'/i, code: "qa_cleanup_enabled_seed" },
  { re: /environment',\s*'staging'/i, code: "staging_environment_seed" },
  { re: /live_delivery_enabled',\s*'true'/i, code: "live_delivery_enabled_seed" },
  { re: /phase13s-qa-profile-bootstrap/i, code: "qa_bootstrap_reference" },
];

function redactSecrets(text) {
  return String(text || "")
    .replace(/postgres:\/\/[^:\s]+:[^@\s]+@/gi, "postgres://***:***@")
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/service_role[^\s]{8,}/gi, "service_role[REDACTED]")
    .replace(/SUPABASE_(?:SERVICE_ROLE|DB)_URL=[^\s]+/gi, "SUPABASE_*=[REDACTED]");
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function parseArgs(argv) {
  const flags = { dryRun: true, apply: false };
  for (const a of argv) {
    if (a === "--apply") {
      flags.apply = true;
      flags.dryRun = false;
    }
    if (a === "--dry-run") {
      flags.dryRun = true;
      flags.apply = false;
    }
  }
  return flags;
}

function scanSqlFile(relPath) {
  const filePath = path.join(rootDir, relPath);
  const findings = [];
  if (!fs.existsSync(filePath)) {
    findings.push({ severity: "FAIL", code: "missing_sql_file", file: relPath });
    return { ok: false, findings, content: "", hash: null, bytes: 0 };
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const rule of FORBIDDEN_SQL_PATTERNS) {
    if (rule.re.test(content)) {
      findings.push({
        severity: "BLOCKED_UNSAFE",
        code: rule.code,
        file: relPath,
      });
    }
  }
  if (/TRUNCATE\s+TABLE/i.test(content) && !/rollback/i.test(relPath)) {
    findings.push({ severity: "BLOCKED_UNSAFE", code: "truncate_in_forward_sql", file: relPath });
  }
  return {
    ok: findings.every((f) => f.severity !== "BLOCKED_UNSAFE" && f.severity !== "FAIL"),
    findings,
    content,
    hash: sha256(content),
    bytes: content.length,
  };
}

function assertApplyGates(env) {
  const errors = [];
  if (String(env.NOTIFICATION_PHASE2B_PRODUCTION_GO || "").trim() !== "1") {
    errors.push("NOTIFICATION_PHASE2B_PRODUCTION_GO must be 1");
  }
  if (
    String(env.NOTIFICATION_PHASE2B_CONFIRM_PRODUCTION || "").trim() !==
    "I_UNDERSTAND_PRODUCTION"
  ) {
    errors.push(
      "NOTIFICATION_PHASE2B_CONFIRM_PRODUCTION must be I_UNDERSTAND_PRODUCTION"
    );
  }
  const expected = String(env.NOTIFICATION_PHASE2B_EXPECTED_PROJECT_REF || "").trim();
  const refCheck = requireProductionProjectRef(expected || env.NOTIFICATION_PROJECT_REF);
  if (!refCheck.ok) {
    errors.push(`project ref gate: ${refCheck.error}`);
  }
  if (expected && expected !== PRODUCTION_PROJECT_REF) {
    errors.push(`expected project ref must be exactly ${PRODUCTION_PROJECT_REF}`);
  }
  for (const blocked of BLOCKED_PROJECT_REFS) {
    const hay = [
      env.SUPABASE_DB_URL,
      env.DATABASE_URL,
      env.VITE_SUPABASE_URL,
      env.NOTIFICATION_PROJECT_REF,
    ]
      .map((v) => String(v || ""))
      .join(" ");
    if (hay.includes(blocked)) {
      errors.push(`blocked Staging/QA project ref present in env: ${blocked}`);
    }
  }
  const environment = String(
    env.NOTIFICATION_WORKER_ENV || env.NOTIFICATION_ENVIRONMENT || ""
  )
    .trim()
    .toLowerCase();
  if (environment && environment !== "production") {
    errors.push(`environment must be production (got ${environment})`);
  }
  return errors;
}

function printEvidence(summary) {
  console.log("\n=== Phase 2B Production Apply — Evidence Summary ===");
  console.log(`Verdict: ${summary.verdict}`);
  console.log(`Mode: ${summary.mode}`);
  console.log(`Timestamp: ${summary.timestamp}`);
  console.log(`Production ref: ${PRODUCTION_PROJECT_REF}`);
  console.log(`Staging ref (blocked): ${STAGING_PROJECT_REF}`);
  console.log(`SQL applied: ${summary.sqlApplied}`);
  console.log("Files:");
  for (const f of summary.files) {
    console.log(`  - ${f.file} sha256=${f.hash} bytes=${f.bytes} ok=${f.ok}`);
  }
  if (summary.findings.length) {
    console.log("Findings:");
    for (const f of summary.findings) {
      console.log(`  [${f.severity}] ${f.code}${f.file ? ` @ ${f.file}` : ""}`);
    }
  }
  if (summary.gateErrors?.length) {
    console.log("Gate errors:");
    for (const e of summary.gateErrors) {
      console.log(`  - ${redactSecrets(e)}`);
    }
  }
  console.log("====================================================\n");
}

export function runPhase2bProductionApplyDryRun(options = {}) {
  const findings = [];
  const files = [];
  for (const rel of SQL_FILES) {
    const scanned = scanSqlFile(rel);
    files.push({
      file: rel,
      hash: scanned.hash,
      bytes: scanned.bytes,
      ok: scanned.ok,
    });
    findings.push(...scanned.findings);
  }
  const unsafe = findings.some((f) => f.severity === "BLOCKED_UNSAFE");
  const failed = findings.some((f) => f.severity === "FAIL");
  return {
    ok: !unsafe && !failed,
    verdict: unsafe ? "BLOCKED_UNSAFE" : failed ? "FAIL" : "PASS",
    mode: "dry-run",
    sqlApplied: false,
    files,
    findings,
    sqlFiles: SQL_FILES,
  };
}

async function applyWithPg(connectionString, filesContent) {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    throw new Error("Missing package `pg`. Run: npm install pg --save-dev");
  }
  const client = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const item of filesContent) {
      console.log(`▶ Applying ${item.file} ...`);
      await client.query(item.content);
      console.log(`✅ ${item.file}`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  loadProjectEnv();
  const flags = parseArgs(process.argv.slice(2));
  const env = globalThis.process?.env || {};
  const timestamp = new Date().toISOString();

  console.log("=== Phase 2B — Production SQL Apply ===");
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Default mode: dry-run (safe)`);
  console.log(`Requested apply: ${flags.apply}`);

  const dry = runPhase2bProductionApplyDryRun();
  const summary = {
    ...dry,
    timestamp,
    mode: flags.apply ? "apply" : "dry-run",
    sqlApplied: false,
    gateErrors: [],
  };

  if (!dry.ok) {
    summary.verdict = dry.verdict;
    printEvidence(summary);
    process.exit(dry.verdict === "BLOCKED_UNSAFE" ? 3 : 1);
  }

  if (!flags.apply) {
    summary.verdict = "PASS";
    summary.mode = "dry-run";
    printEvidence(summary);
    console.log("Dry-run only. Pass --apply with GO gates to apply (Owner approval required).");
    process.exit(0);
  }

  const gateErrors = assertApplyGates(env);
  summary.gateErrors = gateErrors;
  if (gateErrors.length) {
    summary.verdict = "BLOCKED_UNSAFE";
    printEvidence(summary);
    process.exit(3);
  }

  const dbUrl = String(env.SUPABASE_DB_URL || env.DATABASE_URL || "").trim();
  if (!dbUrl) {
    summary.verdict = "FAIL";
    summary.gateErrors.push("SUPABASE_DB_URL missing for apply mode");
    printEvidence(summary);
    process.exit(1);
  }
  if (!dbUrl.includes(PRODUCTION_PROJECT_REF)) {
    summary.verdict = "BLOCKED_UNSAFE";
    summary.gateErrors.push("DB URL does not contain Production project ref");
    printEvidence(summary);
    process.exit(3);
  }
  if (dbUrl.includes(STAGING_PROJECT_REF)) {
    summary.verdict = "BLOCKED_UNSAFE";
    summary.gateErrors.push("DB URL contains Staging project ref");
    printEvidence(summary);
    process.exit(3);
  }

  // Refuse to actually apply during Phase 2B automation unless explicitly forced.
  // Owner must set NOTIFICATION_PHASE2B_ALLOW_LIVE_APPLY=1 in addition to GO gates.
  if (String(env.NOTIFICATION_PHASE2B_ALLOW_LIVE_APPLY || "").trim() !== "1") {
    summary.verdict = "BLOCKED_UNSAFE";
    summary.gateErrors.push(
      "Live apply blocked: set NOTIFICATION_PHASE2B_ALLOW_LIVE_APPLY=1 only with Owner approval (Phase 2C)"
    );
    printEvidence(summary);
    console.log(redactSecrets("Refusing live Production apply in Phase 2B remediation."));
    process.exit(3);
  }

  const filesContent = SQL_FILES.map((file) => ({
    file,
    content: fs.readFileSync(path.join(rootDir, file), "utf8"),
  }));

  try {
    await applyWithPg(dbUrl, filesContent);
    summary.sqlApplied = true;
    summary.verdict = "PASS";
    printEvidence(summary);
    process.exit(0);
  } catch (error) {
    summary.verdict = "FAIL";
    summary.gateErrors.push(redactSecrets(error?.message || String(error)));
    printEvidence(summary);
    process.exit(1);
  }
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main();
}
