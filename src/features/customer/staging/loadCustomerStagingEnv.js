/**
 * CUSTOMER-07 — Staging env loader (fail-closed, secrets never logged).
 *
 * Loads Staging-only keys from:
 * 1. CUSTOMER_07_STAGING_ENV_FILE (if set)
 * 2. worktree `.env.staging-qa.local`
 * 3. worktree-relative `../pickleball-scheduler/.env.staging-qa.local`
 * 4. workstreams-parent `../../pickleball-scheduler/.env.staging-qa.local`
 * 5. `$HOME/pickleball-scheduler/.env.staging-qa.local`
 *
 * Does not mutate Production env files. Does not print secret values.
 */

import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { CUSTOMER_07_ENV_NAMES } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");

const STAGING_KEY_PREFIXES = Object.freeze([
  "STAGING_",
  "SUPABASE_ACCESS_TOKEN",
  "CUSTOMER_07_",
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
 * @returns {boolean}
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
export function listCustomer07StagingEnvCandidates(repoRoot = REPO_ROOT) {
  const home = os.homedir();
  const fromEnv = String(
    process.env[CUSTOMER_07_ENV_NAMES.STAGING_ENV_FILE] || ""
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
 * Load Staging credentials into process.env without printing values.
 * @param {{ repoRoot?: string, env?: NodeJS.ProcessEnv }} [options]
 * @returns {{ loadedFrom: string|null, keysLoaded: string[], secretsPrinted: false }}
 */
export function loadCustomer07StagingEnv(options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const env = options.env || process.env;
  const candidates = listCustomer07StagingEnvCandidates(repoRoot);
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
    loadedFrom = path.basename(path.dirname(filePath)) + "/" + path.basename(filePath);
    break;
  }

  return Object.freeze({
    loadedFrom,
    keysLoaded: Object.freeze([...new Set(keysLoaded)].sort()),
    secretsPrinted: false,
  });
}

export function getCustomer07RepoRoot() {
  return REPO_ROOT;
}
