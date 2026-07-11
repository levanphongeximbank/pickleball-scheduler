/**
 * One-shot: set staging nomember QA passwords (PickleStaging!358).
 * Requires SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL in .env.staging-qa.local
 */
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-env.mjs";

const PASSWORD = "PickleStaging!358";
const USERS = [
  { email: "player.nomember@staging.local", id: "54f5ee47-3d78-4b50-b286-2ebfdf948b2e" },
  { email: "superadmin.nomember@staging.local", id: "d6f8f458-2595-44ec-956a-8d1ca5f3dae7" },
];

loadProjectEnv();
const url = String(process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url || !serviceKey) {
  console.error("Missing Supabase URL or service role key");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

for (const user of USERS) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: PASSWORD });
  if (error) {
    console.error(`FAIL ${user.email}: ${error.message}`);
    process.exit(1);
  }
  console.log(`OK ${user.email}`);
}
