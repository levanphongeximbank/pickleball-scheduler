/**
 * NEWS-03 — SQL package order + hashing (LF-normalized SHA-256).
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NEWS_03_PERMISSION_KEYS } from "./news03Constants.js";

export const NEWS_03_APPLY_SQL_ORDER = Object.freeze([
  "docs/news-public-content/news-02/10_NEWS_PHASE_02_TABLES.sql",
  "docs/news-public-content/news-02/20_NEWS_PHASE_02_INDEXES.sql",
  "docs/news-public-content/news-02/30_NEWS_PHASE_02_RLS.sql",
  "docs/news-public-content/news-02/40_NEWS_PHASE_02_SAVE_RPC.sql",
  "docs/news-public-content/news-02/50_NEWS_PHASE_02_GRANTS.sql",
  "docs/news-public-content/news-02/60_NEWS_PHASE_02_IMMUTABLE_REVISIONS.sql",
  "docs/news-public-content/news-03/10_NEWS_PHASE_03_PERMISSION_SEED.sql",
  "docs/news-public-content/news-02/99_NEWS_PHASE_02_VERIFICATION.sql",
  "docs/news-public-content/news-03/99_NEWS_PHASE_03_PERMISSION_SEED_VERIFICATION.sql",
]);

export const NEWS_03_ROLLBACK_SQL_ORDER = Object.freeze([
  "docs/news-public-content/news-03/90_NEWS_PHASE_03_PERMISSION_SEED_ROLLBACK.sql",
  "docs/news-public-content/news-02/90_NEWS_PHASE_02_ROLLBACK.sql",
]);

export const NEWS_03_VERIFY_SQL_ORDER = Object.freeze([
  "docs/news-public-content/news-02/99_NEWS_PHASE_02_VERIFICATION.sql",
  "docs/news-public-content/news-03/99_NEWS_PHASE_03_PERMISSION_SEED_VERIFICATION.sql",
]);

/**
 * @param {string|Buffer|Uint8Array} input
 * @returns {string}
 */
export function canonicalizeNews03Text(input) {
  let text;
  if (typeof input === "string") {
    text = input;
  } else if (input instanceof Uint8Array) {
    text = new TextDecoder("utf8").decode(input);
  } else {
    text = String(input ?? "");
  }
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * @param {string|Buffer|Uint8Array} input
 * @returns {string}
 */
export function sha256CanonicalContent(input) {
  const canonical = canonicalizeNews03Text(input);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * @param {string} absolutePath
 * @returns {string}
 */
export function sha256File(absolutePath) {
  return sha256CanonicalContent(readFileSync(absolutePath));
}

/**
 * @param {string} repoRoot
 * @param {readonly string[]} relativePaths
 */
export function inventoryNews03SqlFiles(repoRoot, relativePaths) {
  return relativePaths.map((rel, index) => {
    const abs = path.join(repoRoot, rel);
    const present = existsSync(abs);
    return Object.freeze({
      order: index + 1,
      path: rel,
      present,
      sha256: present ? sha256File(abs) : null,
    });
  });
}

/**
 * @param {string} repoRoot
 */
export function loadNews03ApplyPackage(repoRoot) {
  const files = inventoryNews03SqlFiles(repoRoot, NEWS_03_APPLY_SQL_ORDER);
  const missing = files.filter((f) => !f.present).map((f) => f.path);
  return Object.freeze({
    applyOrder: NEWS_03_APPLY_SQL_ORDER,
    rollbackOrder: NEWS_03_ROLLBACK_SQL_ORDER,
    verifyOrder: NEWS_03_VERIFY_SQL_ORDER,
    permissionKeys: NEWS_03_PERMISSION_KEYS,
    files,
    ok: missing.length === 0,
    missing,
  });
}
