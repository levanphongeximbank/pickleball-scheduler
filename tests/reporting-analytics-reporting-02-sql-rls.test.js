import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlDir = path.join(root, "docs", "reporting-analytics", "reporting-02");
const files = Object.freeze({
  tables: "10_REPORTING_02_TABLES.sql",
  indexes: "20_REPORTING_02_INDEXES.sql",
  rls: "30_REPORTING_02_RLS.sql",
  permissionSeed: "40_REPORTING_02_PERMISSION_SEED.sql",
  grants: "50_REPORTING_02_GRANTS.sql",
  rollback: "90_REPORTING_02_ROLLBACK.sql",
  permissionSeedRollback: "91_REPORTING_02_PERMISSION_SEED_ROLLBACK.sql",
  verification: "99_REPORTING_02_VERIFICATION.sql",
  readme: "README.md",
  manifest: "05_STAGING_APPLY_MANIFEST.md",
  handoff: "04_IDENTITY_PERMISSION_HANDOFF.md",
});
const tableNames = Object.freeze([
  "reporting_report_definitions",
  "reporting_saved_reports",
  "reporting_saved_filters",
  "reporting_executions",
  "reporting_export_jobs",
]);
const text = (name) => readFileSync(path.join(sqlDir, files[name]), "utf8");

test("REPORTING-02 SQL package is complete and declares every owned table", () => {
  for (const name of Object.values(files)) {
    assert.ok(statSync(path.join(sqlDir, name)).isFile(), name);
  }
  const tables = text("tables");
  for (const table of tableNames) {
    assert.match(tables, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`));
  }
});

test("REPORTING-02 RLS is FORCE-enabled, scoped, and has no open policies", () => {
  const rls = text("rls");
  for (const table of tableNames) {
    assert.match(rls, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(rls, /reporting_02_scope_allows/);
  assert.doesNotMatch(rls, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(rls, /WITH\s+CHECK\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(rls, /\bFOR\s+(?:INSERT|UPDATE|DELETE)\b/i);
});

test("REPORTING-02 grants deny anon DML, authenticate reads, and reserve DML for service role", () => {
  const grants = text("grants");
  for (const table of tableNames) {
    assert.match(grants, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM anon`));
    assert.match(grants, new RegExp(`GRANT SELECT ON TABLE public\\.${table} TO authenticated`));
    assert.match(
      grants,
      new RegExp(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\\.${table} TO service_role`
      )
    );
  }
  assert.doesNotMatch(grants, /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[^;]*\bTO\s+authenticated/i);
  assert.doesNotMatch(grants, /GRANT[^;]*\bTO\s+anon/i);
});

test("REPORTING-02 rollback and verification preserve the documented security posture", () => {
  const rollback = text("rollback");
  const verification = text("verification");
  for (const table of tableNames) {
    assert.match(rollback, new RegExp(`DROP TABLE IF EXISTS public\\.${table}`));
  }
  assert.match(verification, /FORCE[- ]enabled|FORCE RLS/i);
  assert.match(verification, /relforcerowsecurity/);
});

test("REPORTING-02 package has no ownership seizure or staging apply command", () => {
  const sqlOnly = ["tables", "indexes", "rls", "permissionSeed", "grants", "rollback", "permissionSeedRollback", "verification"]
    .map(text)
    .join("\n");
  assert.doesNotMatch(sqlOnly, /communication_message_reports\s+(?:OWNER|OWNED|ALTER)/i);
  assert.doesNotMatch(sqlOnly, /\bpsql\s+\S*(?:staging|production)\S*/i);
  assert.doesNotMatch(sqlOnly, /\bsupabase\s+db\s+push\b/i);
});
