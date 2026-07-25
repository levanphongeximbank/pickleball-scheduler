/**
 * NEWS-01 architecture / module boundary / Platform Core adoption.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as news from "../src/features/news-public-content/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(ROOT, "src", "features", "news-public-content");

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["'].*core\/platform\/(?!index\.js)[^"']+["']/,
  /from\s+["'].*features\/public-portal\//,
  /from\s+["'].*features\/experience-channels\//,
  /from\s+["'].*features\/competition-engine\//,
  /from\s+["'].*features\/competition-core\//,
  /from\s+["'].*features\/competition-management\//,
  /from\s+["'].*features\/crm\//,
  /from\s+["'].*features\/customer\//,
  /from\s+["'].*features\/finance\//,
  /from\s+["'].*features\/notifications\//,
  /from\s+["'].*features\/club\//,
  /from\s+["'].*features\/venue-court\//,
  /from\s+["'].*data\/public\/mockPublicData/,
  /from\s+["'].*pages\/public\//,
];

const FORBIDDEN_SOURCE_TOKENS = [
  "process.env",
  "localStorage.",
  "indexedDB.",
  "createClient(",
  "fetch(",
];

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

test("NEWS-01 canonical module and docs exist", () => {
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "index.js")));
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "ARCHITECTURE.md")));
  assert.ok(
    fs.existsSync(
      path.join(
        ROOT,
        "docs",
        "news-public-content",
        "news-01",
        "01_DOMAIN_EDITORIAL_PUBLIC_READ_FOUNDATION.md"
      )
    )
  );
  // Must not create forbidden fake path from wave-2 guard
  assert.equal(fs.existsSync(path.join(ROOT, "src", "features", "news")), false);
});

test("NEWS-01 single public import path exposes facade", () => {
  assert.equal(typeof news.createNewsPublicContentFacade, "function");
  assert.equal(typeof news.newsPublicContentFacade, "function");
  assert.ok(news.NEWS_PUBLIC_CONTENT_FACADE_METHODS.includes("createDraft"));
  assert.ok(news.NEWS_PUBLIC_CONTENT_FACADE_METHODS.includes("projectPublicContent"));
});

test("NEWS-01 has no forbidden reverse dependencies or env/network/storage", () => {
  const files = listJsFiles(MODULE_ROOT);
  assert.ok(files.length >= 15);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      assert.equal(
        pattern.test(text),
        false,
        `${rel} must not match forbidden import ${pattern}`
      );
    }
    for (const token of FORBIDDEN_SOURCE_TOKENS) {
      assert.equal(
        text.includes(token),
        false,
        `${rel} must not contain ${token}`
      );
    }
  }
});

test("NEWS-01 Platform adoption imports only public Platform Core barrel", () => {
  const platformDir = path.join(MODULE_ROOT, "platform");
  const files = listJsFiles(platformDir);
  assert.ok(files.length >= 1);
  for (const file of files) {
    if (path.basename(file) === "index.js") continue;
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    assert.match(text, /core\/platform\/index\.js/, rel);
    assert.equal(
      /core\/platform\/(?!index\.js)/.test(text),
      false,
      `${rel} must not deep-import Platform Core internals`
    );
  }
  const surface = news.assertNewsPlatformSurface();
  assert.equal(surface.ready, true);
});

test("NEWS-01 unimplemented repository port fails closed", async () => {
  const port = news.createUnimplementedContentRepositoryPort();
  await assert.rejects(
    () => port.getByContentId("x"),
    (err) =>
      err.code === news.NEWS_PUBLIC_CONTENT_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
});

test("NEWS-01 does not claim production readiness", () => {
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.productionBlocked, true);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasPersistence, false);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.wiredToPublicPortal, false);
  assert.equal(news.NEWS_PUBLIC_CONTENT_PHASE.hasSql, false);
});
