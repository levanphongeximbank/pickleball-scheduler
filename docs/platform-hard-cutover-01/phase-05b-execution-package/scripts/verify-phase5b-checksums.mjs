/**
 * Phase 5B checksum verifier.
 * Reads only PHASE5B_CHECKSUM_MANIFEST.json (+ optional M0_M11_EXECUTION_MANIFEST.json presence).
 * No network. No database access.
 *
 * Usage:
 *   node docs/platform-hard-cutover-01/phase-05b-execution-package/scripts/verify-phase5b-checksums.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");
const ROOT = path.resolve(PKG, "../../..");
const MANIFEST_REL =
  "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5B_CHECKSUM_MANIFEST.json";

function sha256File(fp) {
  // Content-semantic LF checksum — identical on Windows CRLF checkout and Linux CI.
  const text = fs.readFileSync(fp);
  const normalized = Buffer.from(text.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  return crypto.createHash("sha256").update(normalized).digest("hex").toUpperCase();
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function main() {
  const manifestPath = path.join(ROOT, MANIFEST_REL);
  if (!fs.existsSync(manifestPath)) {
    fail(`missing checksum manifest: ${MANIFEST_REL}`);
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!manifest?.files?.length) {
    fail("checksum manifest has no files");
    return;
  }

  const expectedPaths = [];
  const errors = [];

  for (const entry of manifest.files) {
    if (!entry?.path || !entry?.sha256) {
      errors.push(`invalid entry: ${JSON.stringify(entry)}`);
      continue;
    }
    if (entry.sha256 === "SELF") continue;
    expectedPaths.push(entry.path);
    const abs = path.join(ROOT, entry.path);
    if (!fs.existsSync(abs)) {
      errors.push(`missing: ${entry.path}`);
      continue;
    }
    const got = sha256File(abs);
    if (got !== String(entry.sha256).toUpperCase()) {
      errors.push(`checksum mismatch: ${entry.path} expected=${entry.sha256} got=${got}`);
    }
  }

  // Reject extra execution SQL under package sql/* not listed in manifest
  const sqlRoot = path.join(PKG, "sql");
  const listed = new Set(expectedPaths.map((p) => p.replace(/\\/g, "/")));
  function walk(dir, relBase) {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const rel = `docs/platform-hard-cutover-01/phase-05b-execution-package/${relBase}/${name}`.replace(
        /\\/g,
        "/"
      );
      if (fs.statSync(abs).isDirectory()) {
        walk(abs, `${relBase}/${name}`);
        continue;
      }
      if (!listed.has(rel)) {
        errors.push(`extra unmanifested file: ${rel}`);
      }
    }
  }
  if (fs.existsSync(sqlRoot)) walk(sqlRoot, "sql");

  // Order checks for apply files
  const rules = manifest.orderedApplyRules || {};
  for (const [family, ordered] of Object.entries(rules)) {
    if (!Array.isArray(ordered) || !ordered.length) {
      errors.push(`orderedApplyRules.${family} empty`);
      continue;
    }
    const nums = ordered.map((n) => parseInt(n, 10));
    for (let i = 1; i < nums.length; i++) {
      if (!(nums[i] > nums[i - 1])) {
        errors.push(`apply order not strictly increasing for ${family}: ${ordered[i - 1]} -> ${ordered[i]}`);
      }
    }
    if (ordered.includes("90_ROLLBACK.sql") || ordered.includes("99_VERIFY.sql")) {
      errors.push(`${family} apply order must not include rollback/verify`);
    }
  }

  // Unified manifest must exist
  const unified = path.join(PKG, "M0_M11_EXECUTION_MANIFEST.json");
  if (!fs.existsSync(unified)) errors.push("missing M0_M11_EXECUTION_MANIFEST.json");

  if (errors.length) {
    for (const e of errors) fail(e);
    console.error(`Phase 5B checksum verifier: ${errors.length} error(s)`);
    return;
  }
  console.log(
    `PASS Phase 5B checksum verifier: ${expectedPaths.length} files, order rules ok, no extras`
  );
}

main();
