/**
 * NEWS-02 — Static SQL package contract tests (no database connection).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  NEWS_SQL_PACKAGE_DIR,
  NEWS_SQL_PACKAGE_FILES,
  NEWS_TABLE_NAME_VALUES,
  loadNews02SqlPackageManifest,
  assertNews02SqlApplyRefused,
} from "../src/features/news-public-content/persistence/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = path.join(ROOT, NEWS_SQL_PACKAGE_DIR);

function read(name) {
  return fs.readFileSync(path.join(PKG, name), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function combinedForward() {
  return NEWS_SQL_PACKAGE_FILES.filter((f) => !f.startsWith("90") && !f.startsWith("99"))
    .map((f) => stripSqlComments(read(f)))
    .join("\n");
}

test("NEWS-02 SQL package files exist in canonical order", () => {
  assert.ok(fs.existsSync(PKG));
  for (const file of NEWS_SQL_PACKAGE_FILES) {
    assert.ok(fs.existsSync(path.join(PKG, file)), file);
  }
  const manifest = loadNews02SqlPackageManifest();
  assert.equal(manifest.applied, false);
  assert.equal(manifest.applyAllowed, false);
  assert.equal(assertNews02SqlApplyRefused().allowed, false);
});

test("NEWS-02 defines required tables and revision uniqueness", () => {
  const body = combinedForward();
  for (const table of NEWS_TABLE_NAME_VALUES) {
    assert.match(
      body,
      new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, "i"),
      table
    );
  }
  assert.match(body, /news_public_content_revisions_content_version_uq/i);
  assert.match(body, /unique\s*\(\s*content_id\s*,\s*version\s*\)/i);
});

test("NEWS-02 enforces scope, publication window, provenance, OCC", () => {
  const tables = stripSqlComments(read("10_NEWS_PHASE_02_TABLES.sql"));
  assert.match(tables, /news_public_content_items_scope_platform/i);
  assert.match(tables, /news_public_content_items_scope_tenant/i);
  assert.match(tables, /news_public_content_items_scope_venue/i);
  assert.match(tables, /news_public_content_items_scope_club/i);
  assert.match(tables, /news_public_content_items_scope_competition/i);
  assert.match(tables, /news_public_content_items_window_order/i);
  assert.match(tables, /news_public_content_items_scheduled_requires_publish_at/i);
  assert.match(tables, /news_public_content_items_published_not_mock/i);
  assert.match(tables, /row_version\s+integer\s+not\s+null/i);
  assert.match(tables, /news_public_content_items_row_version_positive/i);
});

test("NEWS-02 partial unique slug indexes avoid NULL loopholes", () => {
  const indexes = stripSqlComments(read("20_NEWS_PHASE_02_INDEXES.sql"));
  assert.match(indexes, /news_public_content_slug_platform_uq/i);
  assert.match(indexes, /news_public_content_slug_tenant_uq/i);
  assert.match(indexes, /news_public_content_slug_venue_uq/i);
  assert.match(indexes, /news_public_content_slug_club_uq/i);
  assert.match(indexes, /news_public_content_slug_competition_uq/i);
  assert.match(indexes, /where\s+content_scope\s*=\s*'TENANT'\s+and\s+tenant_id\s+is\s+not\s+null/i);
});

test("NEWS-02 RLS force-enabled without USING true / broad grants", () => {
  const rls = stripSqlComments(read("30_NEWS_PHASE_02_RLS.sql"));
  const grants = stripSqlComments(read("50_NEWS_PHASE_02_GRANTS.sql"));
  for (const table of NEWS_TABLE_NAME_VALUES) {
    assert.match(
      rls,
      new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i")
    );
    assert.match(
      rls,
      new RegExp(`alter\\s+table\\s+public\\.${table}\\s+force\\s+row\\s+level\\s+security`, "i")
    );
  }
  assert.match(rls, /news_phase02_editorial_scope_allows/i);
  assert.match(rls, /user_venue_id\s*\(\s*\)/i);
  assert.match(rls, /user_has_permission\s*\(/i);
  assert.match(rls, /is_super_admin\s*\(\s*\)/i);
  assert.doesNotMatch(rls, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(rls, /with\s+check\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(rls, /create\s+policy[\s\S]{0,200}to\s+anon/i);
  assert.doesNotMatch(rls, /for\s+insert/i);
  assert.doesNotMatch(rls, /for\s+update/i);
  assert.doesNotMatch(rls, /for\s+delete/i);
  assert.match(grants, /revoke\s+all\s+on\s+table\s+public\.news_public_content_items\s+from\s+anon/i);
  assert.match(grants, /grant\s+select\s+on\s+table\s+public\.news_public_content_items\s+to\s+authenticated/i);
});

test("NEWS-02 save RPC OCC + public query contract + immutable revisions", () => {
  const rpc = stripSqlComments(read("40_NEWS_PHASE_02_SAVE_RPC.sql"));
  const imm = stripSqlComments(read("60_NEWS_PHASE_02_IMMUTABLE_REVISIONS.sql"));
  assert.match(rpc, /news_public_content_save_aggregate/i);
  assert.match(rpc, /NEWS_VERSION_CONFLICT/i);
  assert.match(rpc, /p_expected_row_version/i);
  assert.match(rpc, /security\s+definer/i);
  assert.match(rpc, /set\s+search_path\s*=\s*public\s*,\s*pg_temp/i);
  assert.match(rpc, /grant\s+execute[\s\S]*service_role/i);
  assert.match(rpc, /revoke\s+all[\s\S]*from\s+anon/i);
  assert.match(rpc, /news_public_content_query_public/i);
  assert.match(rpc, /editorial_status\s*=\s*'PUBLISHED'/i);
  assert.match(rpc, /provenance\s*<>\s*'MOCK'/i);
  assert.match(rpc, /grant\s+execute[\s\S]*to\s+anon/i);
  // Public query RETURNS TABLE must not expose reviewer/approver columns
  const publicReturns = rpc.match(
    /news_public_content_query_public\([\s\S]*?returns\s+table\s*\(([\s\S]*?)\)\s*language/i
  );
  assert.ok(publicReturns, "public query returns table");
  assert.doesNotMatch(publicReturns[1], /reviewer|approver|comment_text/i);
  assert.match(imm, /news_phase02_reject_revision_mutation/i);
  assert.match(imm, /NEWS_REVISION_IMMUTABLE/i);
});

test("NEWS-02 SQL headers mark authored-not-applied and contain no secrets", () => {
  for (const file of NEWS_SQL_PACKAGE_FILES) {
    const text = read(file);
    assert.match(text, /AUTHORED|NOT APPLIED|do not apply/i, file);
    assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\./);
    assert.doesNotMatch(text, /supabase\.co\/[a-z]+\/[a-z0-9-]+/i);
    assert.doesNotMatch(text, /SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/);
  }
});
