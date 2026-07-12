#!/usr/bin/env node
/** Merge MCP chunk JSON outputs into REPORT.json — no DB credentials needed */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt1b5-staging");
const REPORT_PATH = path.join(evidenceDir, "REPORT.json");
const RESULTS_PATH = path.join(evidenceDir, "VERIFICATION_QUERY_RESULTS.json");

const chunkFiles = process.argv.slice(2);
if (!chunkFiles.length) {
  console.error("Usage: node merge-phase-tt1b-verification-results.mjs chunk1.json [chunk2.json ...]");
  process.exit(1);
}

const rows = [];
for (const file of chunkFiles) {
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const data = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (Array.isArray(data)) rows.push(...data);
  else if (Array.isArray(data.checks)) rows.push(...data.checks);
  else throw new Error(`Unexpected chunk shape in ${abs}`);
}

rows.sort((a, b) => String(a.check_id).localeCompare(String(b.check_id)));

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
  if (!bySection[section]) bySection[section] = { pass: 0, fail: 0, checks: [] };
  bySection[section].checks.push(c);
  if (c.status === "PASS") bySection[section].pass += 1;
  else bySection[section].fail += 1;
}

const results = {
  generatedAt: new Date().toISOString(),
  environment: { ref: "qyewbxjsiiyufanzcjcq", source: "PHASE_TT1B_VERIFICATION_QUERIES.sql", via: "MCP execute_sql" },
  summary: { total: checks.length, pass, fail, overall: fail === 0 ? "PASS" : "FAIL" },
  bySection,
  checks,
  failedChecks: checks.filter((c) => c.status === "FAIL"),
};

fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");

let report = fs.existsSync(REPORT_PATH) ? JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")) : {};
report.structuredVerificationQueries = results;
report.verificationQueries = checks.map((c) => ({
  id: c.check_id,
  expected: c.expected,
  actual: c.actual,
  result: c.status,
  detail: "",
}));
report.generatedAt = new Date().toISOString();
try {
  report.commitSha = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
} catch { /* ignore */ }

if (fail > 0) {
  report.knownConditions = [
    ...(report.knownConditions || []).filter((k) => !String(k).startsWith("structuredVerificationQueries:")),
    `structuredVerificationQueries: ${fail} FAIL — see failedChecks`,
  ];
  report.verdict = "BLOCKED — structured verification FAIL";
} else if (!report.knownConditions?.length) {
  report.verdict = report.verdict || "READY FOR TT-1C";
}

fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Merged ${checks.length} checks → ${pass} PASS, ${fail} FAIL`);
console.log(`Updated ${REPORT_PATH}`);
process.exit(fail > 0 ? 1 : 0);
