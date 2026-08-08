#!/usr/bin/env node
/**
 * OPERATION B1B — WP5 focused real PostgreSQL runner.
 *
 * Local/disposable only. Never targets Staging/Production.
 *
 * Usage:
 *   node scripts/operations/production-qa-identity-operation-b1b/wp5-run-real-postgres.mjs
 *
 * Opt-in env (one of):
 *   OPERATION_B1B_WP5_AUTO_PROVISION=1
 *   OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES=1
 *   OPERATION_B1B_WP5_DATABASE_URL=postgresql://...@127.0.0.1/.../b1b_wp5_...
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const testFile = path.join(root, "tests/operation-b1b-wp5-real-postgres.test.js");

if (
  !process.env.OPERATION_B1B_WP5_DATABASE_URL &&
  process.env.OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES !== "1" &&
  process.env.OPERATION_B1B_WP5_AUTO_PROVISION !== "1"
) {
  process.env.OPERATION_B1B_WP5_AUTO_PROVISION = "1";
  process.env.OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES = "1";
}

const result = spawnSync(process.execPath, ["--test", testFile], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
