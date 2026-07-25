/**
 * COACHING-03 — LF-normalized SHA-256 helpers (Customer-07 / Finance convention).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const COACHING_03_MANIFEST_HASH_ALGORITHM = "sha256-lf-normalized";

/**
 * @param {string|Buffer|Uint8Array} input
 * @returns {string}
 */
export function canonicalizeCoaching03MigrationText(input) {
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
  const canonical = canonicalizeCoaching03MigrationText(input);
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
 * Aggregate digest over ordered forward entries: `order|path|sha256\n` each line.
 * @param {Array<{ order: number, path: string, sha256: string }>} entries
 * @returns {string}
 */
export function aggregateSha256ForEntries(entries) {
  const lines = [...entries]
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map(
      (e) =>
        `${Number(e.order)}|${String(e.path).replace(/\\/g, "/")}|${String(e.sha256).toLowerCase()}`
    )
    .join("\n");
  return sha256CanonicalContent(`${lines}\n`);
}
