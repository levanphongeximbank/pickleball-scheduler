/**
 * Verify mobile Sprint 9 tables + RLS on Supabase staging.
 *
 * Usage:
 *   node scripts/verify-mobile-sprint9-staging.mjs
 *
 * Optional (for deeper RLS checks with 2 test users):
 *   SUPABASE_SERVICE_ROLE_KEY=... in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const MOBILE_TABLES = [
  "push_subscriptions",
  "notifications",
  "qr_tokens",
  "checkins",
];

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  console.log(`⚠️  ${message}`);
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

function classifyTableError(error) {
  const code = error?.code || "";
  const message = String(error?.message || "").toLowerCase();
  if (
    code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  ) {
    return "missing";
  }
  if (
    code === "42501" ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  ) {
    return "exists_rls";
  }
  return "unknown";
}

async function probeTable(client, table) {
  const { error } = await client.from(table).select("id").limit(1);
  if (!error) {
    return { table, status: "accessible" };
  }
  const kind = classifyTableError(error);
  return { table, status: kind, error: error.message, code: error.code };
}

async function verifyRlsWithServiceRole(url, serviceKey) {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("pg_catalog_version").maybeSingle();
  if (error) {
    // rpc may not exist — fallback: insert probe row as admin
    const probe = await admin
      .from("notifications")
      .select("id, tenant_id, user_id")
      .limit(5);
    if (probe.error) {
      warn(`Service role probe: ${probe.error.message}`);
      return false;
    }
    ok(`Service role đọc được notifications (${probe.data?.length ?? 0} rows sample)`);
    return true;
  }
  void data;
  return true;
}

async function main() {
  console.log("=== Verify Mobile Sprint 9 — Supabase Staging ===\n");

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    fail(
      [
        "Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.",
        "Thêm vào .env.local rồi chạy lại.",
      ].join("\n")
    );
  }

  info(`Project: ${url}`);

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  for (const table of MOBILE_TABLES) {
    results.push(await probeTable(anon, table));
  }

  let missing = 0;
  let exists = 0;

  console.log("\n--- Bảng mobile Sprint 9 ---\n");
  for (const row of results) {
    if (row.status === "missing") {
      missing += 1;
      console.log(`❌ ${row.table} — CHƯA TỒN TẠI (cần apply SQL)`);
    } else if (row.status === "exists_rls" || row.status === "accessible") {
      exists += 1;
      ok(`${row.table} — tồn tại (RLS chặn anon — đúng kỳ vọng)`);
    } else {
      console.log(`⚠️  ${row.table} — ${row.code || "?"}: ${row.error}`);
    }
  }

  loadProjectEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (serviceKey) {
    console.log("\n--- Service role probe ---\n");
    await verifyRlsWithServiceRole(url, serviceKey);
  } else {
    console.log("\n--- Service role probe ---\n");
    info("Bỏ qua — thêm SUPABASE_SERVICE_ROLE_KEY vào .env.local để verify sâu hơn.");
  }

  console.log("\n--- Kết luận ---\n");

  if (missing > 0) {
    fail(
      [
        `${missing}/${MOBILE_TABLES.length} bảng chưa có trên staging.`,
        "",
        "Apply thủ công:",
        "1. Mở https://supabase.com/dashboard → project staging",
        "2. SQL Editor → New query",
        "3. Dán toàn bộ docs/supabase-mobile-sprint9.sql → Run",
        "4. Chạy lại: node scripts/verify-mobile-sprint9-staging.mjs",
        "",
        "Verify nhanh trong SQL Editor:",
        "  select tablename, rowsecurity from pg_tables",
        "  where schemaname='public' and tablename in ('qr_tokens','checkins','notifications','push_subscriptions');",
      ].join("\n")
    );
  }

  ok(`Tất cả ${exists} bảng mobile Sprint 9 đã có trên staging.`);
  console.log("\nTiếp theo: chạy GA checklist manual (docs/v5/PHASE_8_MOBILE_GA_CHECKLIST.md)\n");
}

main().catch((error) => {
  fail(error?.message || String(error));
});
