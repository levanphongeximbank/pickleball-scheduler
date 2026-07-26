/**
 * PUBLIC-CATALOG-01 — SQL boundary + architecture locks.
 * Run: node --test tests/public-catalog-01-sql-boundary.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as catalog from "../src/features/public-catalog/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

test("SQL: public club RPC is SECURITY DEFINER with allowlisted columns", () => {
  const sql = stripSqlComments(
    read("docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql")
  );
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.public_catalog_list_clubs/i);
  assert.match(sql, /security\s+definer/i);
  assert.match(sql, /is_publicly_listed\s*=\s*true/i);
  assert.match(sql, /status\s*=\s*'active'/i);
  assert.match(sql, /deleted_at\s+is\s+null/i);
  assert.match(sql, /grant\s+execute[\s\S]*to\s+anon/i);
  assert.doesNotMatch(sql, /owner_user_id|president_user_id|created_by_user_id/i);
  assert.doesNotMatch(sql, /from\s+public\.club_data_v3/i);
});

test("SQL: public court RPC reads projection table only", () => {
  const sql = stripSqlComments(
    read("docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql")
  );
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.public_catalog_courts/i);
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.public_catalog_list_courts/i);
  assert.match(sql, /from\s+public\.public_catalog_courts/i);
  assert.doesNotMatch(sql, /default_hourly_rate|peak_hourly_rate/i);
  assert.doesNotMatch(sql, /from\s+public\.club_data_v3/i);
  assert.match(sql, /enable\s+row\s+level\s+security/i);
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.public_catalog_courts\s+from\s+anon/i);
});

test("SQL: pagination hard limit 50 enforced in RPC", () => {
  const sql = stripSqlComments(
    read("docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql")
  );
  assert.match(sql, /p_limit\s*>\s*50/i);
});

test("SQL: package marked not applied", () => {
  assert.equal(catalog.PUBLIC_CATALOG_SQL_MANIFEST.applyStatus, "AUTHORED_NOT_APPLIED");
  assert.equal(catalog.PUBLIC_CATALOG_SQL_MANIFEST.stagingApply, false);
  assert.equal(catalog.PUBLIC_CATALOG_SQL_MANIFEST.productionApply, false);
  for (const file of catalog.PUBLIC_CATALOG_SQL_MANIFEST.files) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), file);
  }
});

test("Architecture: public-catalog does not import UI / portal cutover", () => {
  const files = [
    "src/features/public-catalog/index.js",
    "src/features/public-catalog/application/createPublicCatalogFacade.js",
    "src/features/public-catalog/remote/index.js",
    "src/features/public-catalog/persistence/supabase/createSupabasePublicCatalogRepository.js",
  ];
  for (const rel of files) {
    const src = read(rel);
    assert.doesNotMatch(src, /from\s+["'].*pages\//);
    assert.doesNotMatch(src, /publicClubsCourtsDataSource/);
    assert.doesNotMatch(src, /liveCutoverCertificationMatrix/);
    assert.doesNotMatch(src, /competition-engine/);
  }
});

test("Architecture: Public Portal clubs/courts source unchanged (no cutover)", () => {
  const portal = read(
    "src/features/public-portal/services/publicClubsCourtsDataSource.js"
  );
  assert.match(portal, /allowMockFallback:\s*true/);
  assert.doesNotMatch(portal, /public-catalog/);
  assert.doesNotMatch(portal, /listPublicClubsRemote/);
});

test("Architecture: barrel exports facade + remote entrypoints", () => {
  assert.equal(typeof catalog.createPublicCatalogFacade, "function");
  assert.equal(typeof catalog.listPublicClubsRemote, "function");
  assert.equal(typeof catalog.listPublicCourtsRemote, "function");
  assert.equal(typeof catalog.projectPublicClub, "function");
  assert.equal(typeof catalog.projectPublicCourt, "function");
  assert.ok(catalog.PUBLIC_CATALOG_PUBLIC_EXPORTS.includes("createPublicCatalogFacade"));
});
