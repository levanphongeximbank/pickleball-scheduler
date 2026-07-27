/**
 * PROD-SEC-G3-B12-01 — club_ai_data anonymous write lockdown + legacy client cutover.
 * Run: node --test tests/prod-sec-g3-b12-01-club-ai-data-lockdown.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  LEGACY_CLUB_AI_TABLE,
  mergeLegacyClubAiToV3,
} from "../src/ai/cloudSync.js";
import { setActiveClubId } from "../src/data/club.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_DIR = "docs/production-security/prod-sec-g3-b12-01";
const LOCKDOWN_SQL = `${SQL_DIR}/10_CLUB_AI_DATA_ANON_WRITE_LOCKDOWN.sql`;

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("SQL package files exist (source-controlled, not applied)", () => {
  for (const file of [
    LOCKDOWN_SQL,
    `${SQL_DIR}/11_VERIFY.sql`,
    `${SQL_DIR}/90_ROLLBACK.sql`,
    `${SQL_DIR}/README.md`,
    `${SQL_DIR}/PRODUCTION_APPLY_PLAN.md`,
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), file);
  }
});

test("SQL: drops anon true policies and revokes anon/authenticated", () => {
  const sql = stripSqlComments(read(LOCKDOWN_SQL));
  assert.match(sql, /drop\s+policy\s+if\s+exists\s+club_ai_data_anon_insert/i);
  assert.match(sql, /drop\s+policy\s+if\s+exists\s+club_ai_data_anon_update/i);
  assert.match(sql, /drop\s+policy\s+if\s+exists\s+club_ai_data_anon_select/i);
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.club_ai_data\s+from\s+anon/i);
  assert.match(
    sql,
    /revoke\s+all\s+on\s+table\s+public\.club_ai_data\s+from\s+authenticated/i
  );
  assert.match(sql, /force\s+row\s+level\s+security/i);
  assert.match(sql, /using\s*\(\s*false\s*\)/i);
  assert.match(sql, /with\s+check\s*\(\s*false\s*\)/i);
  assert.doesNotMatch(
    sql,
    /create\s+policy\s+club_ai_data_anon_(insert|update|select)/i
  );
  assert.doesNotMatch(sql, /grant\s+[^;]*\s+to\s+anon\b/i);
  assert.doesNotMatch(sql, /grant\s+[^;]*\s+to\s+authenticated\b/i);
  assert.match(sql, /grant\s+[^;]*\s+to\s+service_role\b/i);
});

test("SQL: does not touch Public Catalog or club_data_v3", () => {
  const sql = stripSqlComments(read(LOCKDOWN_SQL));
  assert.doesNotMatch(sql, /public_catalog_/i);
  assert.doesNotMatch(sql, /club_data_v3/i);
  assert.doesNotMatch(sql, /drop\s+table/i);
});

test("SQL: service_role retain break-glass; rollback does not auto-reopen write", () => {
  const lockdown = stripSqlComments(read(LOCKDOWN_SQL));
  assert.match(
    lockdown,
    /grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table\s+public\.club_ai_data\s+to\s+service_role/i
  );
  const rollback = read(`${SQL_DIR}/90_ROLLBACK.sql`);
  assert.match(rollback, /do not re-apply unless Owner forces/i);
  assert.ok(
    rollback.includes("-- CREATE POLICY club_ai_data_anon_insert"),
    "insecure restore must stay commented"
  );
});

test("Client: cloudSync has no PostgREST URL to club_ai_data", () => {
  const src = read("src/ai/cloudSync.js");
  assert.equal(LEGACY_CLUB_AI_TABLE, "club_ai_data");
  assert.match(src, /LEGACY_TABLE_LOCKED/);
  assert.match(src, /club_data_v3/);
  assert.doesNotMatch(src, /\/rest\/v1\/\$\{LEGACY_CLUB_AI_TABLE\}/);
  assert.doesNotMatch(src, /\/rest\/v1\/club_ai_data/);
  assert.doesNotMatch(src, /\/rest\/v1\/\$\{SUPABASE_TABLE\}/);
  // Canonical writes stay on club_data_v3
  assert.match(src, /\/rest\/v1\/\$\{SUPABASE_CLUB_TABLE\}/);
});

test("Client: mergeLegacyClubAiToV3 fail-closed without network", async () => {
  globalThis.localStorage = createLocalStorageMock({
    "pickleball-clubs-v1": JSON.stringify([
      { id: "default-club", name: "CLB Mac dinh" },
    ]),
    "pickleball-active-club-v1": "default-club",
  });
  setActiveClubId("default-club");

  let fetchCalled = false;
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("unexpected fetch");
  };

  try {
    const result = await mergeLegacyClubAiToV3({ clubId: "default-club" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "LEGACY_TABLE_LOCKED");
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("Public Catalog SQL package still independent of club_ai_data lockdown", () => {
  const catalogSql = read(
    "docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql"
  );
  assert.match(catalogSql, /public_catalog_list_clubs/i);
  assert.doesNotMatch(catalogSql, /club_ai_data/);
  const lockdown = read(LOCKDOWN_SQL);
  assert.doesNotMatch(lockdown, /public_catalog_list_/);
});
