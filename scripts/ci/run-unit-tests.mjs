#!/usr/bin/env node
/**
 * Run the unit-test manifest without exceeding Windows command-line limits.
 * Spawns node --test in batches when the arg list would exceed ENAMETOOLONG.
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

/** Keep arg string comfortably under Windows ~32k limit. */
const MAX_ARG_CHARS = 24000;

function batchFiles(list) {
  const batches = [];
  let current = [];
  let len = 0;
  for (const file of list) {
    const add = file.length + 1;
    if (current.length > 0 && len + add > MAX_ARG_CHARS) {
      batches.push(current);
      current = [];
      len = 0;
    }
    current.push(file);
    len += add;
  }
  if (current.length) batches.push(current);
  return batches;
}

const batches = batchFiles(files);
let failed = 0;
let ran = 0;

for (let i = 0; i < batches.length; i += 1) {
  const batch = batches[i];
  ran += batch.length;
  console.error(
    `run-unit-tests: batch ${i + 1}/${batches.length} (${batch.length} files, cumulative ${ran}/${files.length})`
  );
  const result = spawnSync(process.execPath, ["--test", ...batch], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error("run-unit-tests: spawn failed:", result.error);
    process.exit(1);
  }
  if (result.status && result.status !== 0) {
    failed = result.status;
  }
}

process.exit(failed || 0);
