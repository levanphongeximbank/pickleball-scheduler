import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(rootDir, ".env.production-smoke.tmp");

const pull = spawnSync("npx", ["vercel", "env", "pull", envFile, "--environment=production", "--yes"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: true,
});
if (pull.status !== 0) {
  process.exit(pull.status ?? 1);
}

const env = { ...process.env };
for (const rawLine of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  const key = line.slice(0, i).trim();
  let value = line.slice(i + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

env.PRODUCTION_APP_URL = env.PRODUCTION_APP_URL || "https://pickleball-scheduler-eight.vercel.app";
env.PRODUCTION_DEPLOYMENT_ID = env.PRODUCTION_DEPLOYMENT_ID || "dpl_9XNP4G8cK7wVe7DcTLomJXjrfC2u";

const run = spawnSync("node", ["scripts/verify-phase42j-production-smoke.mjs"], {
  cwd: rootDir,
  env,
  stdio: "inherit",
});

try {
  fs.unlinkSync(envFile);
} catch {
  /* ignore */
}

process.exit(run.status ?? 1);
