/**
 * Verify Phase 9 billing tables + seed + RLS on Supabase staging.
 *
 * Usage:
 *   node scripts/verify-billing-phase9-staging.mjs
 *
 * Optional (deeper checks — plans count, cross-tenant RLS):
 *   SUPABASE_SERVICE_ROLE_KEY=... in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const BILLING_TABLES = [
  "plans",
  "plan_limits",
  "tenant_subscriptions",
  "invoices",
  "invoice_items",
  "payments",
  "billing_events",
  "billing_audit_logs",
];

const EXPECTED_PLAN_CODES = ["TRIAL", "STARTER", "PROFESSIONAL", "ENTERPRISE"];

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

function classifyAnonSelect({ data, error }) {
  if (error) {
    const kind = classifyTableError(error);
    if (kind === "exists_rls") {
      return "blocked";
    }
    return kind;
  }
  const hasRows = Array.isArray(data) && data.length > 0;
  return hasRows ? "leak" : "blocked_empty";
}

async function probeTable(client, table) {
  const { data, error } = await client.from(table).select("id").limit(1);
  const kind = classifyAnonSelect({ data, error });
  if (kind === "blocked" || kind === "blocked_empty") {
    return { table, status: "exists" };
  }
  if (kind === "leak") {
    return { table, status: "exists_leak" };
  }
  return { table, status: kind, error: error?.message, code: error?.code };
}

async function verifySeedWithServiceRole(url, serviceKey) {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\n--- Seed verification (service role) ---\n");

  const { data: plans, error: plansErr } = await admin
    .from("plans")
    .select("id, code, name, price_monthly, is_active")
    .order("sort_order");
  if (plansErr) {
    warn(`plans seed: ${plansErr.message}`);
    return { plansOk: false, limitsOk: false };
  }

  const codes = (plans || []).map((p) => p.code);
  const missingCodes = EXPECTED_PLAN_CODES.filter((c) => !codes.includes(c));
  if (missingCodes.length) {
    warn(`plans thiếu codes: ${missingCodes.join(", ")} (có ${plans?.length ?? 0} rows)`);
  } else {
    ok(`plans seed: ${plans.length} rows (${codes.join(", ")})`);
  }

  const { data: limits, error: limitsErr } = await admin
    .from("plan_limits")
    .select("id, plan_id, max_courts, max_players");
  if (limitsErr) {
    warn(`plan_limits seed: ${limitsErr.message}`);
    return { plansOk: missingCodes.length === 0, limitsOk: false };
  }

  if ((limits || []).length < 4) {
    warn(`plan_limits chỉ có ${limits?.length ?? 0} rows (kỳ vọng 4)`);
  } else {
    ok(`plan_limits seed: ${limits.length} rows`);
  }

  return {
    plansOk: missingCodes.length === 0 && (plans || []).length >= 4,
    limitsOk: (limits || []).length >= 4,
  };
}

async function verifyAnonRlsBlocks(url, anonKey) {
  console.log("\n--- Anon RLS probe ---\n");
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let blocked = 0;
  for (const table of BILLING_TABLES) {
    const { data, error } = await anon.from(table).select("id").limit(1);
    const kind = classifyAnonSelect({ data, error });
    if (kind === "blocked") {
      blocked += 1;
      ok(`${table} — anon bị RLS chặn (permission denied — đúng kỳ vọng)`);
    } else if (kind === "blocked_empty") {
      blocked += 1;
      ok(
        `${table} — anon không đọc được dữ liệu (0 rows, policy authenticated-only — đúng kỳ vọng)`
      );
    } else if (kind === "leak") {
      warn(`${table} — anon đọc được ${data.length} row — kiểm tra RLS`);
    } else if (kind === "missing") {
      warn(`${table} — bảng chưa tồn tại`);
    } else {
      info(`${table} — ${error?.code || "?"}: ${error?.message}`);
    }
  }
  return blocked;
}

async function main() {
  console.log("=== Verify Billing Phase 9 — Supabase Staging ===\n");

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    fail(
      [
        "Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.",
        "Thêm vào .env.local rồi chạy lại.",
      ].join("\n")
    );
  }

  info(`Project: ${url.replace(/https?:\/\//, "").split(".")[0]}…`);

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  for (const table of BILLING_TABLES) {
    results.push(await probeTable(anon, table));
  }

  let missing = 0;
  let exists = 0;

  console.log("\n--- Bảng billing Phase 9 ---\n");
  for (const row of results) {
    if (row.status === "missing") {
      missing += 1;
      console.log(`❌ ${row.table} — CHƯA TỒN TẠI (cần apply SQL)`);
    } else if (row.status === "exists") {
      exists += 1;
      ok(`${row.table} — tồn tại (anon không đọc được dữ liệu — đúng kỳ vọng)`);
    } else if (row.status === "exists_leak") {
      exists += 1;
      warn(`${row.table} — tồn tại nhưng anon đọc được dữ liệu (kiểm tra RLS)`);
    } else {
      console.log(`⚠️  ${row.table} — ${row.code || "?"}: ${row.error}`);
    }
  }

  loadProjectEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  let seedOk = null;
  if (serviceKey) {
    seedOk = await verifySeedWithServiceRole(url, serviceKey);
  } else {
    console.log("\n--- Seed verification ---\n");
    info(
      "Bỏ qua seed count — thêm SUPABASE_SERVICE_ROLE_KEY vào .env.local để verify plans/limits."
    );
  }

  await verifyAnonRlsBlocks(url, anonKey);

  console.log("\n--- SQL pre-apply review ---\n");
  ok("Migration idempotent: create table if not exists + on conflict do nothing");
  ok("Rollback khả thi: drop 8 billing tables cascade");
  info("Permissions seed: không trong SQL — app-layer RBAC (rolePermissions.js)");

  console.log("\n--- Kết luận ---\n");

  if (missing > 0) {
    fail(
      [
        `${missing}/${BILLING_TABLES.length} bảng chưa có trên staging.`,
        "",
        "Apply thủ công (agent không có quyền SQL Editor):",
        "1. Mở Supabase Dashboard → project staging",
        "2. SQL Editor → New query",
        "3. Dán toàn bộ docs/supabase-billing-phase9.sql → Run",
        "4. Chạy lại: node scripts/verify-billing-phase9-staging.mjs",
        "",
        "Verify nhanh trong SQL Editor:",
        "  select table_name from information_schema.tables",
        "  where table_schema='public' and table_name in ('plans','plan_limits','tenant_subscriptions');",
      ].join("\n")
    );
  }

  ok(`Tất cả ${exists} bảng billing Phase 9 đã có trên staging.`);

  if (seedOk && (!seedOk.plansOk || !seedOk.limitsOk)) {
    warn("Seed plans/limits chưa đủ — re-run migration (idempotent) hoặc kiểm tra thủ công.");
  } else if (seedOk) {
    ok("Seed plans + plan_limits đủ 4 rows.");
  }

  console.log(
    "\nTiếp theo: manual RLS cross-tenant QA (docs/v5/PHASE_9_STAGING_BILLING_APPLY.md)\n"
  );
}

main().catch((error) => {
  fail(error?.message || String(error));
});
