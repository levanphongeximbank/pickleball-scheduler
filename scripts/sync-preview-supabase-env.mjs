/**
 * Sync staging Supabase anon key to Vercel Preview (không in secret).
 * Usage: node scripts/sync-preview-supabase-env.mjs
 */
import { spawnSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();

const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();
if (!anonKey) {
  console.error("❌ Thiếu VITE_SUPABASE_ANON_KEY trong .env.local");
  process.exit(1);
}

const url = String(process.env.VITE_SUPABASE_URL || "").trim();
if (!url.includes("qyewbxjsiiyufanzcjcq")) {
  console.error("❌ .env.local phải trỏ staging qyewbxjsiiyufanzcjcq");
  process.exit(1);
}

console.log("▶ Thêm VITE_SUPABASE_ANON_KEY → Vercel Preview (--force)…");

const result = spawnSync(
  "npx",
  [
    "vercel",
    "env",
    "add",
    "VITE_SUPABASE_ANON_KEY",
    "preview",
    "--value",
    anonKey,
    "--yes",
    "--force",
  ],
  { stdio: "inherit", shell: true, env: process.env }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("✅ VITE_SUPABASE_ANON_KEY đã sync Preview (không in giá trị).");
