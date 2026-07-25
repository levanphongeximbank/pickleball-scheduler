/**
 * COACHING-03 — Staging env loader (fail-closed, secrets never logged).
 */

import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { COACHING_03_ENV_NAMES } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");

const STAGING_KEY_PREFIXES = Object.freeze([
  "STAGING_",
  "SUPABASE_ACCESS_TOKEN",
  "COACHING_03_",
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
export function listCoaching03StagingEnvCandidates(repoRoot = REPO_ROOT) {
  const home = os.homedir();
  const fromEnv = String(
    process.env[COACHING_03_ENV_NAMES.STAGING_ENV_FILE] || ""
  ).trim();
  return [
    fromEnv,
    path.join(repoRoot, ".env.staging-qa.local"),
    path.join(repoRoot, "../pickleball-scheduler/.env.staging-qa.local"),
    path.join(repoRoot, "../../pickleball-scheduler/.env.staging-qa.local"),
    path.join(home, "pickleball-scheduler/.env.staging-qa.local"),
  ].filter(Boolean);
}

/**
 * @param {{ repoRoot?: string, env?: NodeJS.ProcessEnv }} [options]
 * @returns {{ loadedFrom: string|null, keysLoaded: string[], secretsPrinted: false }}
 */
export function loadCoaching03StagingEnv(options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const env = options.env || process.env;
  const candidates = listCoaching03StagingEnvCandidates(repoRoot);
  /** @type {string[]} */
  const keysLoaded = [];
  let loadedFrom = null;

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const parsed = parseEnvFile(readFileSync(candidate, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (!isStagingScopedKey(key)) continue;
      if (env[key] == null || String(env[key]).trim() === "") {
        env[key] = value;
        keysLoaded.push(key);
      }
    }
    loadedFrom = path.basename(candidate);
    break;
  }

  return {
    loadedFrom,
    keysLoaded: keysLoaded.sort(),
    secretsPrinted: false,
  };
}

/**
 * @returns {string}
 */
export function getCoaching03RepoRoot() {
  return REPO_ROOT;
}
