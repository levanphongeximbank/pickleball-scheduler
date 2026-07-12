import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

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

export function loadProjectEnv({ production = false } = {}) {
  const files = [".env", ".env.development", ".env.local", ".env.development.local", ".env.staging-qa.local"];
  if (production) {
    files.push(".env.production.local");
  }
  const merged = {};

  for (const fileName of files) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    Object.assign(merged, parseEnvFile(content));
  }

  for (const [key, value] of Object.entries(merged)) {
    if (!(key in process.env) || !String(process.env[key] || "").trim()) {
      process.env[key] = value;
    }
  }

  return merged;
}

export function getSupabaseEnv() {
  loadProjectEnv();

  return {
    url: String(process.env.VITE_SUPABASE_URL || "").trim(),
    anonKey: String(process.env.VITE_SUPABASE_ANON_KEY || "").trim(),
  };
}

const STAGING_REF = "qyewbxjsiiyufanzcjcq";

export function getStagingSupabaseEnv() {
  loadProjectEnv();

  const url = String(
    process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
  ).trim();
  const anonKey = String(
    process.env.STAGING_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
  ).trim();
  const serviceKey = String(process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (url && !url.includes(STAGING_REF)) {
    throw new Error(`Refusing non-staging Supabase URL (expected ref ${STAGING_REF})`);
  }

  return { url, anonKey, serviceKey, stagingRef: STAGING_REF };
}
