#!/usr/bin/env node
/**
 * Run the unit-test manifest without exceeding Windows command-line limits.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = path.join(root, "scripts", "ci", "unit-test-files.json");
const files = JSON.parse(readFileSync(manifestPath, "utf8"));

if (!Array.isArray(files) || files.length === 0) {
  console.error("unit-test-files.json is empty or invalid");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
