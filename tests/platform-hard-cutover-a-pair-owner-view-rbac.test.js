import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageDir = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/sql/pairing-owner-view-rbac"
);

function read(name) {
  return fs.readFileSync(path.join(packageDir, name), "utf8");
}

test("pairing owner view RBAC package files exist", () => {
  const files = fs.readdirSync(packageDir);
  assert.ok(files.includes("10_OWNER_PAIRING_VIEW_RBAC.sql"));
  assert.ok(files.includes("90_ROLLBACK.sql"));
  assert.ok(files.includes("99_VERIFY.sql"));
  assert.ok(files.includes("README.md"));
});

test("SQL grants pairing.private_rules.view only to COURT_OWNER and VENUE_OWNER", () => {
  const sql = read("10_OWNER_PAIRING_VIEW_RBAC.sql");
  assert.match(sql, /pairing\.private_rules\.view/);
  assert.match(sql, /COURT_OWNER/);
  assert.match(sql, /VENUE_OWNER/);
  assert.match(sql, /on conflict do nothing/i);
  assert.doesNotMatch(sql, /pairing\.private_rules\.(edit|manage|admin)/i);
  assert.doesNotMatch(sql, /grant\s+.*to\s+authenticated/i);
  assert.doesNotMatch(sql, /SUPER_ADMIN/);
  assert.doesNotMatch(sql, /TRUNCATE|DROP TABLE|DELETE FROM public\.profiles/i);
  assert.doesNotMatch(sql, /expuvcohlcjzvrrauvud/);
});

test("rollback deletes only owner view mappings", () => {
  const sql = read("90_ROLLBACK.sql");
  const executable = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.match(sql, /delete from public\.role_permissions/i);
  assert.match(executable, /COURT_OWNER/);
  assert.match(executable, /VENUE_OWNER/);
  assert.match(executable, /pairing\.private_rules\.view/);
  assert.doesNotMatch(executable, /SUPER_ADMIN|PLATFORM_ADMIN/);
});
