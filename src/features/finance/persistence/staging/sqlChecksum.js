/**
 * Content-semantic SHA-256 for Finance SQL evidence.
 *
 * Canonical form: UTF-8 text with LF line endings only (CRLF/CR → LF).
 * Matches Git blob bytes for these docs/*.sql files and is identical on
 * Windows (core.autocrlf checkout) and Linux CI.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";

export function normalizeSqlNewlines(text) {
  return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function sha256SqlText(text) {
  return createHash("sha256")
    .update(normalizeSqlNewlines(text), "utf8")
    .digest("hex");
}

export function sha256SqlFile(absPath) {
  return sha256SqlText(fs.readFileSync(absPath, "utf8"));
}
