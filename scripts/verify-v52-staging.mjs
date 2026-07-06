/**
 * V5.2 — Read-only verify staging RBAC qua Supabase API (service role).
 * Không cần SUPABASE_DB_URL — dùng VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const V52_ROLES = ["SYSTEM_TECHNICIAN", "TEAM_CAPTAIN"];
const PROBE_EMAILS = ["tech@staging.local", "player@staging.local"];

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function main() {
  loadProjectEnv();
  const { url } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url.includes(STAGING_REF)) {
    fail(`VITE_SUPABASE_URL không trỏ staging (${STAGING_REF}). Hiện tại: ${url || "(empty)"}`);
  }
  if (!serviceKey) {
    fail("Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env.local");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("=== V5.2 Staging Verify (API) ===\n");
  console.log(`Project: ${STAGING_REF}\n`);

  const { data: roles, error: rolesErr } = await admin
    .from("roles")
    .select("id, label")
    .in("id", V52_ROLES)
    .order("id");

  if (rolesErr) {
    console.log("V52-S2 roles catalog: ❌", rolesErr.message);
  } else {
    console.log("V52-S2 roles catalog:");
    for (const id of V52_ROLES) {
      const row = roles?.find((r) => r.id === id);
      console.log(`  ${id}: ${row ? `✅ ${row.label}` : "❌ missing"}`);
    }
  }

  const { data: rolePerms, error: rpErr } = await admin
    .from("role_permissions")
    .select("role_id")
    .in("role_id", V52_ROLES);

  if (rpErr) {
    console.log("\nV52-S3 permissions: ❌", rpErr.message);
  } else {
    const counts = Object.fromEntries(V52_ROLES.map((r) => [r, 0]));
    for (const row of rolePerms || []) {
      counts[row.role_id] = (counts[row.role_id] || 0) + 1;
    }
    console.log("\nV52-S3 permission counts:");
    console.log(`  SYSTEM_TECHNICIAN: ${counts.SYSTEM_TECHNICIAN} ${counts.SYSTEM_TECHNICIAN >= 10 ? "✅" : "⚠️"}`);
    console.log(`  TEAM_CAPTAIN: ${counts.TEAM_CAPTAIN} ${counts.TEAM_CAPTAIN >= 10 ? "✅" : "⚠️"}`);
  }

  const { data: stagingProfiles, error: profErr } = await admin
    .from("profiles")
    .select("email, role, venue_id, player_id, status")
    .like("email", "%@staging.local")
    .order("email");

  if (profErr) {
    console.log("\nV52-S4 profiles: ❌", profErr.message);
  } else {
    console.log(`\nV52-S4 @staging.local profiles (${stagingProfiles?.length ?? 0}):`);
    for (const row of stagingProfiles || []) {
      console.log(`  ${row.email}: ${row.role} (venue=${row.venue_id || "—"})`);
    }

    console.log("\nV52-S4 V5.2 probe accounts:");
    for (const email of PROBE_EMAILS) {
      const row = stagingProfiles?.find((p) => p.email === email);
      if (!row) {
        console.log(`  ${email}: ❌ chưa có profile`);
      } else if (email === "tech@staging.local" && row.role !== "SYSTEM_TECHNICIAN") {
        console.log(`  ${email}: ⚠️ role=${row.role} (kỳ vọng SYSTEM_TECHNICIAN)`);
      } else if (email === "player@staging.local" && row.role !== "TEAM_CAPTAIN") {
        console.log(`  ${email}: ⚠️ role=${row.role} (kỳ vọng TEAM_CAPTAIN sau seed)`);
      } else {
        console.log(`  ${email}: ✅ ${row.role}`);
      }
    }
  }

  const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (authErr) {
    console.log("\nV52-S5 auth check: ❌", authErr.message);
  } else {
    const missing = PROBE_EMAILS.filter(
      (email) => !authUsers.users.some((u) => u.email === email)
    );
    console.log("\nV52-S5 missing auth users:", missing.length ? missing.join(", ") : "(none) ✅");
  }

  console.log("\n---\n");
  console.log("Apply SQL (cần SUPABASE_DB_URL staging): npm run apply:v52-staging-sql");
  console.log("Hoặc MCP: reload Supabase MCP sau khi .cursor/mcp.json trỏ qyewbxjsiiyufanzcjcq\n");
}

main();
