#!/usr/bin/env node
/** Read-only Staging backup metadata probe (no secrets printed). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

function parseEnvFile(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
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

function loadToken() {
  const candidates = [
    path.join(rootDir, "..", "club-management", ".env.staging-qa.local"),
    path.join(rootDir, "..", "crm", ".env.staging-qa.local"),
    path.join(rootDir, ".env.staging-qa.local"),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const values = parseEnvFile(fs.readFileSync(filePath, "utf8"));
    const url = String(values.STAGING_SUPABASE_URL || values.VITE_SUPABASE_URL || "");
    if (url.includes(PRODUCTION_REF)) throw new Error("Production URL refused");
    if (values.SUPABASE_ACCESS_TOKEN) {
      return String(values.SUPABASE_ACCESS_TOKEN).trim();
    }
  }
  throw new Error("SUPABASE_ACCESS_TOKEN missing");
}

const token = loadToken();
const headers = { Authorization: `Bearer ${token}` };
const project = await (await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}`, { headers })).json();
const out = {
  ref: project.id || project.ref,
  name: project.name,
  region: project.region,
  status: project.status,
  database_host: project.database?.host || null,
  backupEndpoints: {},
};

for (const p of [
  `/v1/projects/${STAGING_REF}/database/backups`,
  `/v1/projects/${STAGING_REF}/backups`,
]) {
  const res = await fetch(`https://api.supabase.com${p}`, { headers });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  out.backupEndpoints[p] = {
    status: res.status,
    bodyKeys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
    message: parsed?.message || null,
    count: Array.isArray(parsed) ? parsed.length : Array.isArray(parsed?.backups) ? parsed.backups.length : null,
    pitr_enabled: parsed?.pitr_enabled ?? null,
    walg_enabled: parsed?.walg_enabled ?? null,
    region: parsed?.region ?? null,
  };
}

console.log(JSON.stringify(out, null, 2));
