/**
 * V5.2 — Read-only verify Production RBAC (service role).
 * URL phải trỏ expuvcohlcjzvrrauvud — không dùng staging ref.
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const V52_ROLES = ["SYSTEM_TECHNICIAN", "TEAM_CAPTAIN"];
const PROBE_EMAILS = ["kythuat@gmail.com", "doitruong@gmail.com"];

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function main() {
  loadProjectEnv();
  const { url } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url.includes(PRODUCTION_REF)) {
    fail(
      `VITE_SUPABASE_URL không trỏ Production (${PRODUCTION_REF}).\n` +
        `Hiện tại: ${url || "(empty)"}\n` +
        `Đổi .env.local hoặc dùng Supabase SQL Editor trên project Production.`
    );
  }
  if (!serviceKey) {
    fail("Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env.local (Production service role).");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("=== V5.2 Production Verify ===\n");
  console.log(`Project: ${PRODUCTION_REF}\n`);

  const { data: roles, error: rolesErr } = await admin
    .from("roles")
    .select("id, label")
    .in("id", V52_ROLES)
    .order("id");

  if (rolesErr) {
    console.log("V52-P1 roles: ❌", rolesErr.message);
  } else {
    console.log("V52-P1 roles catalog:");
    for (const id of V52_ROLES) {
      const row = roles?.find((r) => r.id === id);
      console.log(`  ${id}: ${row ? `✅ ${row.label}` : "❌ missing — chạy PHASE_V52_PRODUCTION_RBAC_ROLES.sql"}`);
    }
  }

  const { data: rolePerms, error: rpErr } = await admin
    .from("role_permissions")
    .select("role_id")
    .in("role_id", V52_ROLES);

  if (!rpErr) {
    const counts = Object.fromEntries(V52_ROLES.map((r) => [r, 0]));
    for (const row of rolePerms || []) counts[row.role_id]++;
    console.log("\nV52-P2 permissions:");
    console.log(`  SYSTEM_TECHNICIAN: ${counts.SYSTEM_TECHNICIAN} ${counts.SYSTEM_TECHNICIAN >= 10 ? "✅" : "⚠️"}`);
    console.log(`  TEAM_CAPTAIN: ${counts.TEAM_CAPTAIN} ${counts.TEAM_CAPTAIN >= 10 ? "✅" : "⚠️"}`);
  }

  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("email, role, venue_id, tournament_id, team_id, status")
    .in("email", [...PROBE_EMAILS, "lephong.eximbank@gmail.com"])
    .order("email");

  if (profErr) {
    console.log("\nV52-P3 profiles: ❌", profErr.message);
  } else {
    console.log("\nV52-P3 V5.2 accounts:");
    for (const email of PROBE_EMAILS) {
      const row = profiles?.find((p) => p.email === email);
      if (!row) console.log(`  ${email}: ❌ chưa có profile`);
      else if (email === "kythuat@gmail.com" && row.role !== "SYSTEM_TECHNICIAN")
        console.log(`  ${email}: ⚠️ role=${row.role} (kỳ vọng SYSTEM_TECHNICIAN)`);
      else if (email === "doitruong@gmail.com" && row.role !== "TEAM_CAPTAIN")
        console.log(`  ${email}: ⚠️ role=${row.role} (kỳ vọng TEAM_CAPTAIN)`);
      else console.log(`  ${email}: ✅ ${row.role}`);
    }
  }

  const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (!authErr) {
    const missing = PROBE_EMAILS.filter(
      (e) => !authUsers.users.some((u) => u.email === e)
    );
    console.log("\nV52-P4 missing auth:", missing.length ? missing.join(", ") : "(none) ✅");
  }

  console.log("\n---\n");
  console.log("Seed: docs/v5/PHASE_V52_PRODUCTION_RBAC_SEED.sql");
  console.log("Hướng dẫn: docs/v5/PHASE_V52_PRODUCTION_RBAC_OWNER_STEP_BY_STEP.md\n");
}

main();
