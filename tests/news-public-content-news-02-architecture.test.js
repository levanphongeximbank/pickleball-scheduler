/**
 * NEWS-02 architecture / ownership / apply refusal.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as news from "../src/features/news-public-content/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(ROOT, "src", "features", "news-public-content");

test("NEWS-02 durable foundations remain; portal wiring belongs to NEWS-04+", () => {
  assert.ok(
    ["NEWS-02", "NEWS-03", "NEWS-04"].includes(news.NEWS_PUBLIC_CONTENT_PHASE.id)
  );
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasPersistence, true);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasSql, true);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasProduction, false);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.productionBlocked, true);
  // NEWS-04 adopts portal live path; production apply still blocked.
  if (news.NEWS_PUBLIC_CONTENT_PHASE.id === "NEWS-04") {
    assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.wiredToPublicPortal, true);
    assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasStaging, true);
  }
});

test("NEWS-02 public barrel exports adapter and auth surfaces", () => {
  assert.equal(typeof news.createSupabaseContentRepository, "function");
  assert.equal(typeof news.getNews02CapabilityMatrix, "function");
  assert.equal(typeof news.authorizeNewsEditorialCapability, "function");
  assert.equal(typeof news.loadNews02SqlPackageManifest, "function");
  assert.ok(news.NEWS_PUBLIC_CONTENT_PUBLIC_EXPORTS.includes("createSupabaseContentRepository"));
  assert.ok(news.NEWS_PUBLIC_CONTENT_PUBLIC_EXPORTS.includes("getNews02CapabilityMatrix"));
});

test("NEWS-02 SQL apply is refused and docs exist", () => {
  const refuse = news.assertNews02SqlApplyRefused({ environment: "staging" });
  assert.equal(refuse.allowed, false);
  assert.ok(
    fs.existsSync(
      path.join(ROOT, "docs/news-public-content/news-02/00_NEWS_02_ARCHITECTURE_DECISION.md")
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(ROOT, "docs/news-public-content/news-02/01_DURABLE_PERSISTENCE_AND_RLS.md")
    )
  );
});

test("NEWS-02 persistence sources do not createClient or touch portal/mock", () => {
  const persistenceDir = path.join(MODULE_ROOT, "persistence");
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) files.push(full);
    }
  }
  walk(persistenceDir);
  assert.ok(files.length >= 5);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(text.includes("createClient("), false, file);
    assert.equal(text.includes("process.env"), false, file);
    assert.equal(text.includes("MOCK_NEWS"), false, file);
    assert.equal(text.includes("getPublicNews"), false, file);
  }
});
