/**
 * WP6 staging live execution-path test helpers.
 * Local/disposable Postgres only — never Staging/Production.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSafeWp5DatabaseUrl,
  asRole,
  bootstrapWp5Database,
  createSafeWp5Client,
  execSqlFile,
  readSqlFile,
  resetSessionGuc,
  resolveWp5Database,
  sha256Hex,
} from "./operation-b1b-wp5-postgres.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SQL_DIR = path.join(
  ROOT,
  "docs/v5/operations/production-qa-identity-operation-b1b-remediation/sql"
);

export const WP6_CLAIM_FORWARD =
  "30_OPERATION_B1B_ONE_TIME_AUTHORITY_CLAIM_FORWARD.sql";
export const WP6_CLAIM_ROLLBACK =
  "70_OPERATION_B1B_ONE_TIME_AUTHORITY_CLAIM_ROLLBACK.sql";

export function readWp6ClaimSql(name = WP6_CLAIM_FORWARD) {
  return fs.readFileSync(path.join(SQL_DIR, name), "utf8");
}

export async function applyWp6ClaimForward(client) {
  await execSqlFile(client, readSqlFile(WP6_CLAIM_FORWARD));
}

export async function applyWp6ClaimRollback(client) {
  try {
    await execSqlFile(client, readSqlFile(WP6_CLAIM_ROLLBACK));
  } catch (err) {
    // SQL70 uses an explicit BEGIN; a mid-transaction RAISE skips COMMIT and
    // leaves the session in aborted-transaction state until ROLLBACK.
    try {
      await client.query("ROLLBACK");
    } catch {
      /* already idle / no transaction */
    }
    throw err;
  }
}

export async function bootstrapWp6ClaimDatabase(client) {
  await bootstrapWp5Database(client);
  await applyWp6ClaimForward(client);
}

export async function asServiceRole(client) {
  await asRole(client, { role: "service_role" });
}

export async function resolveWp6LocalDatabase() {
  // Same opt-in contract as WP5 — do not auto-enable in ordinary unit CI.
  return resolveWp5Database();
}

export {
  assertSafeWp5DatabaseUrl,
  createSafeWp5Client,
  resetSessionGuc,
  sha256Hex,
  ROOT,
};
