/**
 * Run PHASE_TT1B_VERIFICATION_QUERIES.sql on staging and merge into REPORT.json
 * STAGING ONLY — read-only verification
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_PATH = path.join(rootDir, "docs/v5/PHASE_TT1B_VERIFICATION_QUERIES.sql");
const REPORT_PATH = path.join(rootDir, "docs/v5/qa-evidence/phase-tt1b5-staging/REPORT.json");
const RESULTS_PATH = path.join(rootDir, "docs/v5/qa-evidence/phase-tt1b5-staging/VERIFICATION_QUERY_RESULTS.json");

function resolveAccessToken() {
  loadProjectEnv();
  return String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
}

function assertStagingOnly() {
  loadProjectEnv();
  const url = String(process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
  if (url && !url.includes(STAGING_REF)) {
    console.error(`Refuse: URL does not contain staging ref ${STAGING_REF}`);
    process.exit(1);
  }
}

async function executeStagingSql(sql) {
  const token = resolveAccessToken();
  if (!token) {
    throw new Error("Missing SUPABASE_ACCESS_TOKEN for staging SQL execution");
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || res.statusText;
    throw new Error(`Staging SQL failed: ${msg}`);
  }
  return body;
}

function getCommitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function summarizeChecks(rows) {
  const checks = rows.map((row) => ({
    check_id: row.check_id,
    expected: row.expected,
    actual: row.actual,
    status: row.status,
  }));

  const pass = checks.filter((c) => c.status === "PASS").length;
  const fail = checks.filter((c) => c.status === "FAIL").length;
  const bySection = {};

  for (const c of checks) {
    const section = c.check_id.split(".")[0];
    if (!bySection[section]) {
      bySection[section] = { pass: 0, fail: 0, checks: [] };
    }
    bySection[section].checks.push(c);
    if (c.status === "PASS") bySection[section].pass += 1;
    else bySection[section].fail += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    environment: { ref: STAGING_REF, source: "PHASE_TT1B_VERIFICATION_QUERIES.sql" },
    summary: { total: checks.length, pass, fail, overall: fail === 0 ? "PASS" : "FAIL" },
    bySection,
    checks,
    failedChecks: checks.filter((c) => c.status === "FAIL"),
  };
}

async function main() {
  assertStagingOnly();

  const sql = fs.readFileSync(SQL_PATH, "utf8");
  console.log(`Running ${SQL_PATH} on staging ${STAGING_REF}...`);

  const rows = await executeStagingSql(sql);
  if (!Array.isArray(rows)) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(rows).slice(0, 500)}`);
  }

  const results = summarizeChecks(rows);
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  console.log(`Wrote ${RESULTS_PATH} (${results.summary.pass}/${results.summary.total} PASS)`);

  let report = {};
  if (fs.existsSync(REPORT_PATH)) {
    report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
  }

  report.structuredVerificationQueries = results;
  report.verificationQueries = results.checks.map((c) => ({
    id: c.check_id,
    expected: c.expected,
    actual: c.actual,
    result: c.status,
    detail: "",
  }));
  report.generatedAt = new Date().toISOString();
  report.commitSha = getCommitSha() || report.commitSha;

  if (results.summary.fail > 0) {
    report.knownConditions = [
      ...(report.knownConditions || []).filter((k) => !String(k).startsWith("structuredVerificationQueries:")),
      `structuredVerificationQueries: ${results.summary.fail} FAIL — see failedChecks`,
    ];
    report.verdict = "BLOCKED — structured verification FAIL";
  } else if (!report.knownConditions?.length) {
    report.verdict = report.verdict || "READY FOR TT-1C";
  }

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Updated ${REPORT_PATH}`);

  if (results.summary.fail > 0) {
    console.error("\nFailed checks:");
    for (const c of results.failedChecks) {
      console.error(`  ${c.check_id}: expected=${c.expected} actual=${c.actual}`);
    }
    process.exit(1);
  }

  console.log("\nAll structured verification checks PASS");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
