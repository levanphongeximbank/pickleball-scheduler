#!/usr/bin/env node
/**
 * P1-C.7 — Set Production Vercel env for Rating V5 Wave A (no key logging).
 *
 *   PRODUCTION_P1C_FRONTEND_GO=YES node scripts/set-v5p1c-production-frontend-env.mjs
 */
import { spawnSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";
import { PRODUCTION_REF, STAGING_REF } from "./lib/v5p1c-wave-a-manifest.mjs";

function setProdEnv(name, value) {
  spawnSync("npx", ["vercel", "env", "rm", name, "production", "-y"], {
    stdio: "pipe",
    shell: true,
  });
  const result = spawnSync(
    "npx",
    ["vercel", "env", "add", name, "production", "--force", "--yes", "--value", value],
    {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    }
  );
  if (result.status !== 0) {
    const err = [result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`vercel env add ${name} failed: ${err.slice(0, 400)}`);
  }
  console.log(`VERCEL_PRODUCTION_ENV: ${name}=set (value hidden)`);
}

async function main() {
  if (String(process.env.PRODUCTION_P1C_FRONTEND_GO || "").trim() !== "YES") {
    console.error("BLOCKED — requires PRODUCTION_P1C_FRONTEND_GO=YES");
    process.exit(2);
  }

  loadProjectEnv({ production: true });
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || "api-keys failed");
  const anonKey = body.find((k) => k.name === "anon")?.api_key;
  const url = `https://${PRODUCTION_REF}.supabase.co`;
  if (!anonKey) throw new Error("Missing production anon key");
  if (url.includes(STAGING_REF)) throw new Error("Refusing staging URL");

  setProdEnv("VITE_PICK_VN_RATING_V5_ENABLED", "true");
  setProdEnv("VITE_SUPABASE_URL", url);
  setProdEnv("VITE_SUPABASE_ANON_KEY", anonKey);

  console.log("Production env updated for Wave A frontend enablement.");
  console.log(`VITE_SUPABASE_URL ref check: contains ${PRODUCTION_REF}=true`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
