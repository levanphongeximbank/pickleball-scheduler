/**
 * Verify Production readiness for Super Admin → Tạo user (/api/identity/create-user).
 *
 * Usage:
 *   npm run verify:identity-admin-create-production
 *
 * Local .env.local cần:
 *   VITE_SUPABASE_URL → production ref expuvcohlcjzvrrauvud
 *   SUPABASE_SERVICE_ROLE_KEY → production service role (server only)
 *
 * Optional:
 *   PRODUCTION_APP_URL=https://pickleball-scheduler-eight.vercel.app
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const DEFAULT_APP_URL = "https://pickleball-scheduler-eight.vercel.app";

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`✅ ${msg}`);
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

async function probeCreateUserApi(appUrl) {
  const endpoint = `${appUrl.replace(/\/$/, "")}/api/identity/create-user`;
  let response;
  try {
    response = await fetch(endpoint, { method: "GET" });
  } catch (error) {
    fail(`Không gọi được ${endpoint}: ${error?.message || error}`);
  }

  const body = await response.json().catch(() => ({}));
  if (response.status !== 405 || body?.code !== "METHOD_NOT_ALLOWED") {
    fail(
      `API ${endpoint} không phản hồi đúng (HTTP ${response.status}). ` +
        `Kỳ vọng 405 METHOD_NOT_ALLOWED — kiểm tra deploy Vercel + file api/identity/create-user.js.`
    );
  }
  pass(`API route live: GET ${endpoint} → 405 METHOD_NOT_ALLOWED`);
}

async function main() {
  loadProjectEnv({ production: true });
  const { url, anonKey } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const appUrl = String(process.env.PRODUCTION_APP_URL || DEFAULT_APP_URL).trim();

  console.log("=== Identity Admin Create User — Production Verify ===\n");

  if (!url.includes(PRODUCTION_REF)) {
    fail(
      `VITE_SUPABASE_URL phải trỏ Production (${PRODUCTION_REF}).\nHiện tại: ${url || "(empty)"}`
    );
  }
  pass(`Supabase URL → ${PRODUCTION_REF}`);

  if (!anonKey) {
    warn("Thiếu VITE_SUPABASE_ANON_KEY local — API server cần anon key để kiểm tra JWT caller.");
  } else {
    pass("VITE_SUPABASE_ANON_KEY có trong local env");
  }

  if (!serviceKey) {
    fail(
      "Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env.local.\n" +
        "Vercel Production cũng cần biến này (server only, không prefix VITE_)."
    );
  }
  pass("SUPABASE_SERVICE_ROLE_KEY có trong local env");

  await probeCreateUserApi(appUrl);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (listError) {
    fail(`Supabase Admin API không hoạt động: ${listError.message}`);
  }
  pass("Supabase Admin API (service role) — listUsers OK");

  const { data: rpcCheck, error: rpcError } = await admin.rpc("user_has_permission", {
    p_permission: "user.manage",
  });
  if (rpcError) {
    const message = String(rpcError.message || "");
    if (message.includes("does not exist") || rpcError.code === "PGRST202") {
      fail("RPC user_has_permission chưa deploy trên Production.");
    }
    warn(`RPC user_has_permission (service role): ${message}`);
  } else {
    pass(`RPC user_has_permission deploy OK (service_role probe → ${rpcCheck})`);
  }

  const { data: superAdminPerm, error: permError } = await admin
    .from("role_permissions")
    .select("role_id")
    .eq("role_id", "SUPER_ADMIN")
    .eq("permission_id", "user.manage")
    .maybeSingle();

  if (permError) {
    fail(`Không đọc được role_permissions: ${permError.message}`);
  }
  if (!superAdminPerm) {
    fail("SUPER_ADMIN thiếu permission user.manage trong role_permissions.");
  }
  pass("SUPER_ADMIN có user.manage trong role_permissions");

  const { count: superAdminCount, error: profileError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "SUPER_ADMIN")
    .eq("status", "active");

  if (profileError) {
    warn(`Không đếm được SUPER_ADMIN profiles: ${profileError.message}`);
  } else if (!superAdminCount) {
    warn("Chưa có profile SUPER_ADMIN active — cần ít nhất 1 admin để tạo user qua UI.");
  } else {
    pass(`${superAdminCount} profile SUPER_ADMIN active`);
  }

  console.log("\n--- Vercel Production (owner tick thủ công) ---");
  console.log("| Biến | Scope | Ghi chú |");
  console.log("|------|-------|---------|");
  console.log("| SUPABASE_SERVICE_ROLE_KEY | Production server | Bắt buộc cho /api/identity/create-user |");
  console.log("| VITE_SUPABASE_URL | Production | Client + serverless |");
  console.log("| VITE_SUPABASE_ANON_KEY | Production | Client + serverless JWT check |");
  console.log("| SUPABASE_URL | Production (khuyến nghị) | Mirror URL, không prefix VITE_ |");
  console.log("| SUPABASE_ANON_KEY | Production (khuyến nghị) | Mirror anon key cho serverless |");
  console.log("\nSupabase Auth → URL Configuration:");
  console.log(`  Site URL: ${appUrl}`);
  console.log(`  Redirect URLs: ${appUrl}/login , ${appUrl}/reset-password`);
  console.log("\nSelf-signup có thể bật xác nhận email; Admin tạo user qua UI bỏ qua (email_confirm=true).");
  console.log("\n✅ Production verify PASS — deploy API + SQL sẵn sàng cho Super Admin tạo user.");
}

main().catch((error) => {
  fail(error?.message || String(error));
});
