/**
 * Build gitignored .env.production.local from Supabase Management API.
 * Never prints secret values — only presence/length metadata.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";

const PROD_REF = "expuvcohlcjzvrrauvud";
const PROD_URL = `https://${PROD_REF}.supabase.co`;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(rootDir, ".env.production.local");

loadProjectEnv({ production: true });
const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
if (!token) {
  throw new Error("SUPABASE_ACCESS_TOKEN missing (needed to fetch Production API keys)");
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROD_REF}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  throw new Error(`Management API ${res.status}`);
}
const keys = await res.json();
const anon = keys.find((k) => k.name === "anon" || k.tags?.includes("anon"));
const service = keys.find((k) => k.name === "service_role" || k.tags?.includes("service_role"));
const anonKey = anon?.api_key || anon?.key || "";
const serviceKey = service?.api_key || service?.key || "";
if (!anonKey || !serviceKey) {
  throw new Error("Could not resolve anon/service_role from Management API");
}

const body = [
  `# Generated for Production smoke — DO NOT COMMIT`,
  `VITE_SUPABASE_URL=${PROD_URL}`,
  `SUPABASE_URL=${PROD_URL}`,
  `VITE_SUPABASE_ANON_KEY=${anonKey}`,
  `SUPABASE_ANON_KEY=${anonKey}`,
  `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
  `PRODUCTION_APP_URL=https://pickleball-scheduler-eight.vercel.app`,
  `PRODUCTION_PLAYER_EMAIL=player@gmail.com`,
  "",
].join("\n");

fs.writeFileSync(outFile, body, "utf8");
console.log(
  JSON.stringify(
    {
      wrote: ".env.production.local",
      urlHost: new URL(PROD_URL).host,
      isProd: PROD_URL.includes(PROD_REF),
      anonLen: anonKey.length,
      serviceLen: serviceKey.length,
    },
    null,
    2
  )
);
