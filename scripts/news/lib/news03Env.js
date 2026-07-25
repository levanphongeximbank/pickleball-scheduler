/**
 * NEWS-03 — Staging env loader (Customer-07 pattern; secrets never logged).
 */

import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { NEWS_03_ENV_NAMES } from "./news03Constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const NEWS_03_REPO_ROOT = path.resolve(__dirname, "../../..");

const STAGING_KEY_PREFIXES = Object.freeze([
  "STAGING_",
  "SUPABASE_ACCESS_TOKEN",
  "NEWS_03_",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_APP_ENV",
]);

/**
 * @param {string} content
 * @returns {Record<string, string>}
 */
function parseEnvFile(content) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/**
 * @param {string} key
 */
function isStagingScopedKey(key) {
  return STAGING_KEY_PREFIXES.some(
    (prefix) => key === prefix || key.startsWith(prefix)
  );
}

/**
 * @param {string} [repoRoot]
 * @returns {string[]}
 */
export function listNews03StagingEnvCandidates(repoRoot = NEWS_03_REPO_ROOT) {
  const home = os.homedir();
  const fromEnv = String(
    process.env[NEWS_03_ENV_NAMES.STAGING_ENV_FILE] || ""
  ).trim();
  return [
    fromEnv,
    path.join(repoRoot, ".env.staging-qa.local"),
    path.join(repoRoot, "..", "pickleball-scheduler", ".env.staging-qa.local"),
    path.join(
      repoRoot,
      "..",
      "..",
      "pickleball-scheduler",
      ".env.staging-qa.local"
    ),
    path.join(home, "pickleball-scheduler", ".env.staging-qa.local"),
  ].filter(Boolean);
}

/**
 * @param {{ repoRoot?: string, env?: NodeJS.ProcessEnv }} [options]
 */
export function loadNews03StagingEnv(options = {}) {
  const repoRoot = options.repoRoot || NEWS_03_REPO_ROOT;
  const env = options.env || process.env;
  const candidates = listNews03StagingEnvCandidates(repoRoot);
  /** @type {string[]} */
  const keysLoaded = [];
  let loadedFrom = null;

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const parsed = parseEnvFile(readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (!isStagingScopedKey(key)) continue;
      if (!String(env[key] || "").trim()) {
        env[key] = value;
        keysLoaded.push(key);
      }
    }
    loadedFrom =
      path.basename(path.dirname(filePath)) + "/" + path.basename(filePath);
    break;
  }

  return Object.freeze({
    loadedFrom,
    keysLoaded: Object.freeze([...new Set(keysLoaded)].sort()),
    secretsPrinted: false,
  });
}

export function getNews03RepoRoot() {
  return NEWS_03_REPO_ROOT;
}
