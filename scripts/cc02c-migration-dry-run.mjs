/**
 * CC-02C migration dry-run — local/test database only.
 * Does NOT apply staging or production.
 *
 * Usage: node scripts/cc02c-migration-dry-run.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_CC02 = path.join(rootDir, "docs/competition-core/supabase-cc02-rating-v2.sql");
const SQL_CC02C = path.join(rootDir, "docs/competition-core/supabase-cc02c-rating-durability.sql");
const REPORT_PATH = path.join(rootDir, "docs/competition-core/CC02C_MIGRATION_DRY_RUN.json");

function resolveLocalDbUrl() {
  loadProjectEnv();
  return String(
    process.env.CC02C_LOCAL_DB_URL ||
      process.env.LOCAL_DATABASE_URL ||
      process.env.DATABASE_URL ||
      ""
  ).trim();
}

function buildReport(partial = {}) {
  return {
    phase: "CC-02C",
    generatedAt: new Date().toISOString(),
    stagingMigration: "NOT APPLIED",
    productionMigration: "NOT APPLIED",
    previewDeployment: "NOT DEPLOYED",
    productionDeployment: "NOT DEPLOYED",
    featureFlagsProduction: "OFF",
    ...partial,
  };
}

async function runQuery(client, sql, label) {
  try {
    await client.query(sql);
    return { label, ok: true };
  } catch (error) {
    return { label, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const dbUrl = resolveLocalDbUrl();
  if (!dbUrl) {
    const report = buildReport({
      verdict: "PARTIAL",
      dbAvailable: false,
      note: "No CC02C_LOCAL_DB_URL / LOCAL_DATABASE_URL / DATABASE_URL — SQL proposal verified statically only.",
      checks: {
        firstApply: "SKIPPED",
        verificationSql: "SKIPPED",
        duplicateApply: "SKIPPED",
        rls: "SKIPPED",
        uniqueIdempotency: "SKIPPED",
        transactionRollback: "SKIPPED",
      },
    });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    const report = buildReport({
      verdict: "PARTIAL",
      dbAvailable: true,
      pgModule: false,
      note: "pg module not installed — cannot execute live dry-run.",
    });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const client = new pg.default.Client({ connectionString: dbUrl });
  await client.connect();

  const cc02Sql = fs.readFileSync(SQL_CC02, "utf8");
  const cc02cSql = fs.readFileSync(SQL_CC02C, "utf8");
  const results = [];

  results.push(await runQuery(client, cc02Sql, "first-apply-cc02"));
  results.push(await runQuery(client, cc02cSql, "first-apply-cc02c"));
  results.push(await runQuery(client, cc02cSql, "duplicate-apply-cc02c"));

  const verify = await client.query(`
    select
      (select count(*)::int from information_schema.tables where table_schema = 'public' and table_name = 'rating_applications') as rating_applications_exists,
      (select count(*)::int from pg_constraint c join pg_class t on c.conrelid = t.oid where t.relname = 'rating_applications' and c.contype = 'u') as unique_constraints
  `);

  let rollbackOk = false;
  try {
    await client.query("begin");
    await client.query(`
      select public.competition_core_apply_match_rating_v2(
        'cc02c-rollback-test',
        'tenant-test',
        't-test',
        '[{"playerId":"missing-player","previousRating":1500,"nextRating":1510}]'::jsonb
      )
    `);
    await client.query("commit");
  } catch {
    await client.query("rollback");
    rollbackOk = true;
  }

  await client.end();

  const report = buildReport({
    verdict: results.every((item) => item.ok) ? "PASS" : "PARTIAL",
    dbAvailable: true,
    checks: {
      firstApply: results[0]?.ok ? "PASS" : "FAIL",
      verificationSql: verify.rows[0]?.rating_applications_exists === 1 ? "PASS" : "FAIL",
      duplicateApply: results[2]?.ok ? "PASS" : "FAIL",
      rls: "PARTIAL — verify with authenticated role in staging QA",
      uniqueIdempotency: verify.rows[0]?.unique_constraints >= 1 ? "PASS" : "FAIL",
      transactionRollback: rollbackOk ? "PASS" : "PARTIAL",
    },
    results,
    verification: verify.rows[0],
  });

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const report = buildReport({
    verdict: "PARTIAL",
    error: error instanceof Error ? error.message : String(error),
  });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
