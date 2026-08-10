#!/usr/bin/env node
/**
 * OPERATION B1B — WP6 staging live execution-path focused runner.
 * Local/disposable Postgres only. Never Staging/Production.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const testFile = path.join(
  root,
  "tests/operation-b1b-wp6-staging-live-execution-path.test.js"
);

if (
  !process.env.OPERATION_B1B_WP5_DATABASE_URL &&
  process.env.OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES !== "1" &&
  process.env.OPERATION_B1B_WP5_AUTO_PROVISION !== "1"
) {
  process.env.OPERATION_B1B_WP6_AUTO_PROVISION = "1";
  process.env.OPERATION_B1B_WP5_AUTO_PROVISION = "1";
  process.env.OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES = "1";
}

const result = spawnSync(process.execPath, ["--test", testFile], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
