/**
 * Build production bundle with staging Supabase client env from .env.staging-qa.local.
 * Does not print secrets.
 */
import { spawnSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();

if (process.env.STAGING_SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = process.env.STAGING_SUPABASE_URL;
}
if (process.env.STAGING_SUPABASE_ANON_KEY) {
  process.env.VITE_SUPABASE_ANON_KEY = process.env.STAGING_SUPABASE_ANON_KEY;
}

const hasUrl = Boolean(String(process.env.VITE_SUPABASE_URL || "").trim());
const hasAnon = Boolean(String(process.env.VITE_SUPABASE_ANON_KEY || "").trim());
if (!hasUrl || !hasAnon) {
  console.error("Missing staging Supabase client env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  process.exit(1);
}

console.log("Building preview bundle with staging Supabase client (secrets not logged).");
const result = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
