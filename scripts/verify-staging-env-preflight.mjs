/**
 * Phase 21 — Staging env preflight (Supabase URL + anon key alignment)
 *
 * Usage:
 *   node scripts/verify-staging-env-preflight.mjs
 *   npm run test:verify-staging-env
 *
 * Requires in .env.local (staging — KHÔNG commit file này):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *
 * Khuyến nghị (cho test:verify-billing-tenant-mapping — profiles alignment):
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Script không in secret / key value.
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

const PLACEHOLDER_PATTERNS = [
  /^YOUR_/i,
  /^your_/i,
  /^<.*>$/,
  /^placeholder$/i,
  /^changeme$/i,
  /^xxx+$/i,
  /^test-key$/i,
  /^sb_publishable_/i,
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

function extractProjectRef(url) {
  const match = String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : "";
}

function isPlaceholder(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  if (trimmed.length < 20) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function validateUrl(url) {
  if (!url) {
    fail("Thiếu VITE_SUPABASE_URL trong .env.local");
  }

  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(url)) {
    fail(
      "Sai VITE_SUPABASE_URL — phải dạng https://<project-ref>.supabase.co (không có path thừa)"
    );
  }

  const ref = extractProjectRef(url);
  if (!ref) {
    fail("Sai VITE_SUPABASE_URL — không trích xuất được project ref");
  }

  return ref;
}

function validateServiceRoleKey(serviceKey) {
  if (!serviceKey) {
    warn(
      "Thiếu SUPABASE_SERVICE_ROLE_KEY — script này vẫn PASS nếu anon key hợp lệ. Key này khuyến nghị cho npm run test:verify-billing-tenant-mapping (kiểm tra profiles.venue_id)."
    );
    info("Lấy service_role key: Supabase Dashboard → staging qyewbxjsiiyufanzcjcq → Settings → API.");
    return;
  }

  if (isPlaceholder(serviceKey)) {
    warn(
      "SUPABASE_SERVICE_ROLE_KEY có vẻ placeholder/quá ngắn — billing tenant mapping sẽ thiếu profiles alignment."
    );
    return;
  }

  const payload = decodeJwtPayload(serviceKey);
  if (payload?.role === "service_role") {
    ok("SUPABASE_SERVICE_ROLE_KEY có mặt (role service_role)");
  } else {
    warn("SUPABASE_SERVICE_ROLE_KEY không decode được hoặc không phải service_role — kiểm tra lại Dashboard.");
  }
}

function validateAnonKey(anonKey) {
  if (!anonKey) {
    fail(
      "Thiếu VITE_SUPABASE_ANON_KEY trong .env.local — vào Supabase Dashboard → project staging qyewbxjsiiyufanzcjcq → Settings → API → copy anon/public key."
    );
  }

  if (isPlaceholder(anonKey)) {
    fail(
      "Key placeholder/chưa đăng ký — VITE_SUPABASE_ANON_KEY vẫn là giá trị mẫu hoặc quá ngắn (< 20 ký tự). Vào Supabase Dashboard → project staging qyewbxjsiiyufanzcjcq → Settings → API → copy anon/public key mới (không dùng key Production)."
    );
  }

  const payload = decodeJwtPayload(anonKey);
  if (!payload) {
    warn("Không decode được JWT anon key — sẽ kiểm tra bằng API probe");
    return null;
  }

  if (payload.role !== "anon") {
    warn("VITE_SUPABASE_ANON_KEY không có role anon — có thể dùng nhầm service role key");
  }

  return payload;
}

function validateUrlKeyAlignment(urlRef, jwtPayload) {
  if (!jwtPayload?.ref) return;

  if (jwtPayload.ref !== urlRef) {
    fail(
      `URL và anon key không cùng project — URL ref \`${urlRef}\` ≠ key ref \`${jwtPayload.ref}\`. Kiểm tra cặp URL/key từ cùng một Supabase project.`
    );
  }
}

function validateEnvironment(urlRef) {
  if (urlRef === PRODUCTION_REF) {
    fail(
      "Dùng nhầm Production key cho Staging URL — VITE_SUPABASE_URL trỏ project Production (`expuvcohlcjzvrrauvud`). Pilot staging cần staging `qyewbxjsiiyufanzcjcq`."
    );
  }

  if (urlRef !== STAGING_REF) {
    warn(
      `URL ref \`${urlRef}\` khác staging chuẩn \`${STAGING_REF}\` — pilot staging cần project qyewbxjsiiyufanzcjcq. Nếu đây là Production hoặc project khác, sửa VITE_SUPABASE_URL trong .env.local.`
    );
  } else {
    ok(`URL trỏ staging chuẩn (${STAGING_REF})`);
  }
}

async function probeSupabase(url, anonKey) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.from("venues").select("id").limit(1);

  if (!error) {
    ok("API probe venues — anon key hợp lệ (RLS cho phép hoặc 0 rows)");
    return;
  }

  const message = String(error.message || "").toLowerCase();

  if (message.includes("unregistered") || message.includes("invalid api key")) {
    fail(
      "Key placeholder/chưa đăng ký — Supabase trả lỗi Unregistered/Invalid API key. Copy anon key mới từ Dashboard staging, không dùng key cũ hoặc Production."
    );
  }

  if (
    error.code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied")
  ) {
    ok("API probe — key hợp lệ (RLS chặn anon read venues — bình thường)");
    return;
  }

  if (message.includes("jwt") || message.includes("malformed")) {
    fail("Sai VITE_SUPABASE_ANON_KEY — JWT malformed hoặc không hợp lệ");
  }

  warn(`API probe venues: ${error.message} — key có thể hợp lệ nhưng cần owner xác nhận thêm`);
}

async function main() {
  console.log("=== Phase 21 — Staging Env Preflight ===\n");

  loadProjectEnv();
  const { url, anonKey } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  info("Kiểm tra .env.local — không in giá trị secret");

  const urlRef = validateUrl(url);
  const jwtPayload = validateAnonKey(anonKey);

  validateUrlKeyAlignment(urlRef, jwtPayload);
  validateEnvironment(urlRef);
  validateServiceRoleKey(serviceKey);

  ok("VITE_SUPABASE_URL format hợp lệ");
  ok("VITE_SUPABASE_ANON_KEY có mặt và không phải placeholder");

  console.log("\n--- API probe ---\n");
  await probeSupabase(url, anonKey);

  console.log("\n--- Kết luận ---\n");
  ok("Staging env preflight PASS — có thể chạy npm run test:verify-billing-tenant-mapping");
  info("Owner checklist: docs/v5/PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md");
  console.log("");
}

main().catch((error) => {
  fail(error?.message || String(error));
});
