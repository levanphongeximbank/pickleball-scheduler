#!/usr/bin/env node
/**
 * Apply CC-10 Stage 1B SHADOW flags to Vercel Preview only.
 * Never logs secret values.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const BRANCH = null; // preview-wide — project has no git branch env target
const PROJECT = "pickleball-scheduler-tt6-realtime-sync";

const FLAG_VARS = {
  VITE_COMPETITION_CORE_ENABLED: "true",
  VITE_COMPETITION_CORE_RULES_V2_ENABLED: "true",
  VITE_COMPETITION_CORE_DRAW_V2_ENABLED: "true",
  VITE_COMPETITION_CORE_FORMATION_V2_ENABLED: "true",
  VITE_COMPETITION_CORE_MATCHMAKING_V2_ENABLED: "true",
  VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED: "true",
  VITE_COMPETITION_CORE_SCHEDULING_V2_ENABLED: "true",
  VITE_COMPETITION_CORE_RATING_V2_ENABLED: "true",
  VITE_TEAM_TOURNAMENT_DATA_MODE: "shadow",
  VITE_TEAM_TOURNAMENT_TT1B_RPC_GUARDS: "deployed",
};

function runVercel(args) {
  const proc = spawnSync("npx", ["vercel", ...args], {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return {
    ok: proc.status === 0,
    stdout: String(proc.stdout || ""),
    stderr: String(proc.stderr || ""),
    status: proc.status,
  };
}

function addEnv(name, value, { sensitive = false } = {}) {
  const args = [
    "env",
    "add",
    name,
    "preview",
    "--yes",
    "--force",
    "--value",
    value,
  ];
  if (BRANCH) {
    args.splice(5, 0, BRANCH);
  }
  if (sensitive) {
    args.push("--sensitive");
  }
  const result = runVercel(args);
  return { name, ok: result.ok, detail: result.stderr.trim() || result.stdout.trim() };
}

loadProjectEnv();
const staging = getStagingSupabaseEnv();
if (!staging.url.includes(STAGING_REF)) {
  console.error(`BLOCKED: staging URL ref mismatch (expected ${STAGING_REF})`);
  process.exit(1);
}
if (!staging.anonKey) {
  console.error("BLOCKED: missing STAGING_SUPABASE_ANON_KEY");
  process.exit(1);
}

const before = runVercel(["env", "ls", "preview"]);
const results = [];

results.push(addEnv("VITE_SUPABASE_URL", staging.url, { sensitive: false }));
results.push(addEnv("VITE_SUPABASE_ANON_KEY", staging.anonKey, { sensitive: true }));

for (const [key, value] of Object.entries(FLAG_VARS)) {
  results.push(addEnv(key, value, { sensitive: false }));
}

const report = {
  generatedAt: new Date().toISOString(),
  project: PROJECT,
  team: "pickleball-scheduler",
  environment: "preview",
  gitBranch: BRANCH,
  stagingRef: STAGING_REF,
  beforeEnvListExcerpt: before.stdout.split("\n").slice(0, 20),
  flagSnapshot: {
    ...Object.fromEntries(Object.entries(FLAG_VARS).map(([k, v]) => [k, v])),
    VITE_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: "[REDACTED]",
  },
  applyResults: results.map((r) => ({ name: r.name, ok: r.ok, detail: r.detail.slice(0, 200) })),
  allOk: results.every((r) => r.ok),
};

const outDir = path.join(rootDir, "docs/competition-core/qa-evidence/phase-cc10-stage1-live");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "PREVIEW_FLAG_APPLY.json"), JSON.stringify(report, null, 2));

console.log(`Preview flag apply: ${results.filter((r) => r.ok).length}/${results.length} ok`);
process.exit(report.allOk ? 0 : 1);
