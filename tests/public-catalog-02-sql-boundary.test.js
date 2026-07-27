/**
 * PUBLIC-CATALOG-02 — SQL boundary + architecture locks.
 * Run: node --test tests/public-catalog-02-sql-boundary.test.js
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

test("SQL: tournament RPC is SECURITY DEFINER with projection-only allowlist", () => {
  const sql = stripSqlComments(
    read("docs/public-catalog/pc-02/10_PUBLIC_CATALOG_02_PUBLIC_READ_RPC.sql")
  );
  assert.match(
    sql,
    /create\s+or\s+replace\s+function\s+public\.public_catalog_list_tournaments/i
  );
  assert.match(sql, /security\s+definer/i);
  assert.match(sql, /from\s+public\.public_catalog_tournaments/i);
  assert.match(sql, /publication_state\s*=\s*'published'/i);
  assert.match(sql, /grant\s+execute[\s\S]*to\s+anon/i);
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.public_catalog_tournaments\s+from\s+anon/i);
  assert.doesNotMatch(sql, /from\s+public\.club_data_v3/i);
  assert.doesNotMatch(sql, /participants|seeding|referee|financial/i);
});

test("SQL: ranking RPC is SECURITY DEFINER; no Player Rating writer tables", () => {
  const sql = stripSqlComments(
    read("docs/public-catalog/pc-02/10_PUBLIC_CATALOG_02_PUBLIC_READ_RPC.sql")
  );
  assert.match(
    sql,
    /create\s+or\s+replace\s+function\s+public\.public_catalog_list_rankings/i
  );
  assert.match(sql, /from\s+public\.public_catalog_rankings/i);
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.public_catalog_rankings\s+from\s+anon/i);
  assert.doesNotMatch(sql, /from\s+public\.vpr_leaderboard/i);
  assert.doesNotMatch(sql, /player_rating|adjustment_history|phone|email/i);
});

test("SQL: pagination hard limit 50 + fail-closed sort", () => {
  const sql = stripSqlComments(
    read("docs/public-catalog/pc-02/10_PUBLIC_CATALOG_02_PUBLIC_READ_RPC.sql")
  );
  assert.match(sql, /p_limit\s*>\s*50/i);
  assert.match(sql, /INVALID_SORT/i);
  assert.match(sql, /name_asc/i);
  assert.match(sql, /rank_asc/i);
});

test("SQL: rollback drops PC-02 only; preserves Clubs/Courts", () => {
  const rb = stripSqlComments(
    read("docs/public-catalog/pc-02/90_PUBLIC_CATALOG_02_ROLLBACK.sql")
  );
  assert.match(rb, /drop\s+function\s+if\s+exists\s+public\.public_catalog_list_tournaments/i);
  assert.match(rb, /drop\s+function\s+if\s+exists\s+public\.public_catalog_list_rankings/i);
  assert.match(rb, /drop\s+table\s+if\s+exists\s+public\.public_catalog_tournaments/i);
  assert.match(rb, /drop\s+table\s+if\s+exists\s+public\.public_catalog_rankings/i);
  assert.doesNotMatch(rb, /public_catalog_clubs|public_catalog_courts|public_catalog_list_clubs|public_catalog_list_courts/i);
  assert.doesNotMatch(rb, /vpr_leaderboard|club_data_v3/i);
});

test("SQL: PC-02 package marked authored-not-applied", () => {
  assert.equal(catalog.PUBLIC_CATALOG_02_SQL_MANIFEST.applyStatus, "AUTHORED_NOT_APPLIED");
  assert.equal(catalog.PUBLIC_CATALOG_02_SQL_MANIFEST.stagingApply, false);
  assert.equal(catalog.PUBLIC_CATALOG_02_SQL_MANIFEST.productionApply, false);
  for (const file of catalog.PUBLIC_CATALOG_02_SQL_MANIFEST.files) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), file);
  }
});

test("Architecture: public-catalog does not import portal cutover or writers", () => {
  const files = [
    "src/features/public-catalog/index.js",
    "src/features/public-catalog/application/createPublicCatalogFacade.js",
    "src/features/public-catalog/remote/index.js",
    "src/features/public-catalog/persistence/supabase/createSupabasePublicCatalogRepository.js",
  ];
  for (const rel of files) {
    const src = read(rel);
    assert.doesNotMatch(src, /from\s+["'].*pages\//);
    assert.doesNotMatch(src, /publicTournamentsRankingsDataSource/);
    assert.doesNotMatch(src, /competition-engine/);
    assert.doesNotMatch(src, /vprLeaderboardService|player-rating/);
  }
});

test("Architecture: barrel exports tournament/ranking remote entrypoints", () => {
  assert.equal(typeof catalog.listPublicTournamentsRemote, "function");
  assert.equal(typeof catalog.listPublicRankingsRemote, "function");
  assert.equal(typeof catalog.projectPublicTournament, "function");
  assert.equal(typeof catalog.projectPublicRanking, "function");
  assert.ok(
    catalog.PUBLIC_CATALOG_PUBLIC_EXPORTS.includes("listPublicTournamentsRemote")
  );
  assert.ok(
    catalog.PUBLIC_CATALOG_PUBLIC_EXPORTS.includes("listPublicRankingsRemote")
  );
});
