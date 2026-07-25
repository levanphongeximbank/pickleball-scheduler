/**
 * NEWS-04 — Public backend boundary: RPC must be LIVE-only (no PREVIEW leak).
 * Run: node --test tests/news-public-content-news-04-public-rpc-boundary.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as news from "../src/features/news-public-content/index.js";
import { createFakeSupabaseNewsClient } from "../src/features/news-public-content/persistence/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSql(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

test("NEWS-04 canonical query_public SQL requires provenance = LIVE", () => {
  const rpc = stripSqlComments(
    readSql("docs/news-public-content/news-02/40_NEWS_PHASE_02_SAVE_RPC.sql")
  );
  const fn = rpc.match(
    /create\s+or\s+replace\s+function\s+public\.news_public_content_query_public[\s\S]*?\$\$;/i
  );
  assert.ok(fn, "query_public function present");
  assert.match(fn[0], /provenance\s*=\s*'LIVE'/i);
  assert.doesNotMatch(fn[0], /provenance\s*<>\s*'MOCK'/i);
  assert.match(fn[0], /editorial_status\s*=\s*'PUBLISHED'/i);
  assert.match(fn[0], /public_visibility\s*=\s*'PUBLIC'/i);
  assert.match(fn[0], /archived_at\s+is\s+null/i);
});

test("NEWS-04 remediation package mirrors LIVE-only contract", () => {
  const rem = stripSqlComments(
    readSql(
      "docs/news-public-content/news-04/10_NEWS_PHASE_04_PUBLIC_RPC_LIVE_ONLY.sql"
    )
  );
  assert.match(rem, /provenance\s*=\s*'LIVE'/i);
  assert.doesNotMatch(rem, /provenance\s*<>\s*'MOCK'/i);
  assert.match(rem, /drop\s+index\s+if\s+exists\s+public\.news_public_content_items_public_window_idx/i);
  assert.match(
    rem,
    /create\s+index\s+if\s+not\s+exists\s+news_public_content_items_public_window_idx[\s\S]*provenance\s*=\s*'LIVE'/i
  );
});

test("NEWS-04 public index partial predicate is LIVE-only", () => {
  const indexes = stripSqlComments(
    readSql("docs/news-public-content/news-02/20_NEWS_PHASE_02_INDEXES.sql")
  );
  assert.match(
    indexes,
    /news_public_content_items_public_window_idx[\s\S]*provenance\s*=\s*'LIVE'/i
  );
  assert.doesNotMatch(
    indexes,
    /news_public_content_items_public_window_idx[\s\S]*provenance\s*<>\s*'MOCK'/i
  );
});

test("NEWS-04 repository table path queries LIVE provenance only", () => {
  const src = fs.readFileSync(
    path.join(
      ROOT,
      "src/features/news-public-content/persistence/supabase/createSupabaseContentRepository.js"
    ),
    "utf8"
  );
  assert.match(src, /\.eq\(\s*"provenance"\s*,\s*"LIVE"\s*\)/);
  assert.doesNotMatch(src, /\.neq\(\s*"provenance"\s*,\s*"MOCK"\s*\)/);
  assert.match(src, /assertPublicCandidatesAreLive/);
});

test("NEWS-04 adapter rejects MOCK from public RPC path", async () => {
  const client = createFakeSupabaseNewsClient({
    rpcResults: {
      news_public_content_query_public: [
        {
          content_id: "cnt_mock",
          content_type: "NEWS",
          content_scope: "TENANT",
          title: "Mock",
          summary: "S",
          slug: "mock",
          locale: "vi-VN",
          category_references: [],
          tag_references: [],
          media_references: [],
          seo_metadata: {},
          published_at: "2026-07-25T00:00:00.000Z",
          publish_at: null,
          unpublish_at: null,
          publication_timezone: null,
          revision_id: "rev_m",
          version: 1,
          provenance: "MOCK",
          tenant_id: "tenant-1",
          venue_id: null,
          club_id: null,
          competition_id: null,
          banner: null,
          sponsor: null,
        },
      ],
    },
  });
  const repo = news.createSupabaseContentRepository({
    client,
    preferRpc: true,
  });
  await assert.rejects(
    () => repo.queryPublicCandidates({ now: "2026-07-25T12:00:00.000Z" }),
    (err) =>
      err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.PROVENANCE_MISMATCH
  );
});

test("NEWS-04 remediation docs refuse silent Staging apply without Owner GO", () => {
  const doc = readSql(
    "docs/news-public-content/news-04/03_PUBLIC_RPC_LIVE_ONLY_REMEDIATION.md"
  );
  assert.match(doc, /PUBLIC_BOUNDARY_DEFECT/);
  assert.match(doc, /Owner GO/i);
  assert.match(doc, /NOT applied/i);
  assert.match(doc, /Production/i);
});
