/**
 * NEWS-03 — Permission seed SQL contract (static; no database).
 * Run: node --test tests/news-public-content-news-03-permission-seed.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { NEWS_PERMISSION } from "../src/features/news-public-content/authorization/capabilityMatrix.js";
import { NEWS_03_PERMISSION_KEYS } from "../scripts/news/lib/news03Constants.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "docs/news-public-content/news-03");

const SEED = "10_NEWS_PHASE_03_PERMISSION_SEED.sql";
const ROLLBACK = "90_NEWS_PHASE_03_PERMISSION_SEED_ROLLBACK.sql";
const VERIFY = "99_NEWS_PHASE_03_PERMISSION_SEED_VERIFICATION.sql";

const EXPECTED = Object.freeze([
  "news.view",
  "news.edit",
  "news.review",
  "news.approve",
  "news.publish",
  "news.admin",
]);

function read(name) {
  return fs.readFileSync(path.join(DIR, name), "utf8");
}

function stripComments(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

test("NEWS-03 permission package files exist", () => {
  for (const f of [SEED, ROLLBACK, VERIFY]) {
    assert.ok(fs.existsSync(path.join(DIR, f)), f);
  }
});

test("NEWS-03 exact six keys match capabilityMatrix source", () => {
  const fromSource = Object.values(NEWS_PERMISSION).sort();
  assert.deepEqual(fromSource, [...EXPECTED].sort());
  assert.deepEqual([...NEWS_03_PERMISSION_KEYS].sort(), [...EXPECTED].sort());
  assert.equal(EXPECTED.length, 6);
});

test("NEWS-03 seed uses canonical permissions columns and idempotent insert", () => {
  const body = stripComments(read(SEED));
  assert.match(body, /insert\s+into\s+public\.permissions/i);
  assert.match(body, /\(id,\s*module,\s*action,\s*description\)/i);
  assert.match(body, /where\s+not\s+exists/i);
  for (const key of EXPECTED) {
    assert.match(
      body,
      new RegExp(`'${key.replace(".", "\\.")}'`),
      key
    );
  }
  assert.equal(
    (body.match(/insert\s+into\s+public\.permissions/gi) || []).length,
    6
  );
});

test("NEWS-03 seed has no wildcard, no role mapping, no authenticated grant, no credentials", () => {
  const raw = read(SEED);
  const body = stripComments(raw);
  assert.doesNotMatch(body, /insert\s+into\s+public\.role_permissions/i);
  assert.doesNotMatch(body, /grant\s+.+\s+to\s+authenticated/i);
  assert.doesNotMatch(body, /news\.\*|'\*'|"\*"/i);
  assert.doesNotMatch(raw, /service_role\s*=|eyJ[a-zA-Z0-9_-]{20,}/);
  assert.doesNotMatch(raw, /password\s*=|supabase\.co\/[a-z]+\/[a-z0-9]{20}/i);
  assert.doesNotMatch(body, /news_public_content_/i);
});

test("NEWS-03 rollback is exact-key only and refuses role_permissions deps", () => {
  const body = stripComments(read(ROLLBACK));
  assert.match(body, /role_permissions/i);
  assert.match(body, /NEWS_03_PERMISSION_SEED_ROLLBACK_REFUSED/);
  assert.match(body, /delete\s+from\s+public\.permissions/i);
  assert.doesNotMatch(body, /like\s+'news\.%'/i);
  for (const key of EXPECTED) {
    assert.match(body, new RegExp(`'${key.replace(".", "\\.")}'`));
  }
});

test("NEWS-03 verification is read-only and deterministic", () => {
  const raw = read(VERIFY);
  const body = stripComments(raw);
  assert.doesNotMatch(body, /\b(insert|update|delete|drop|alter|truncate)\b/i);
  assert.match(body, /NEWS_03_PERMISSION_SEED_VERIFIED/);
  assert.match(body, /order\s+by\s+p\.id/i);
  for (const key of EXPECTED) {
    assert.match(body, new RegExp(`'${key.replace(".", "\\.")}'`));
  }
});
