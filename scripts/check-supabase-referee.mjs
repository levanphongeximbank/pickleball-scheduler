import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./load-env.mjs";

const TABLE = "tournament_match_live";
const TEST_ID = "e2e-smoke::referee::ping";
const TEST_TOKEN = "e2e-smoke-token";

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

async function waitForRealtime(client, filterValue, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      channel.unsubscribe();
      reject(new Error(`Realtime không nhận event trong ${timeoutMs}ms`));
    }, timeoutMs);

    const channel = client
      .channel(`referee-smoke-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: TABLE,
          filter: `id=eq.${filterValue}`,
        },
        (payload) => {
          clearTimeout(timer);
          channel.unsubscribe();
          resolve(payload);
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          clearTimeout(timer);
          channel.unsubscribe();
          reject(new Error("Không kết nối được Realtime channel"));
        }
      });
  });
}

async function main() {
  console.log("=== Kiểm tra Supabase cho chế độ Trọng tài ===\n");

  const { url, anonKey } = getSupabaseEnv();

  if (!url || !anonKey) {
    fail(
      [
        "Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.",
        "",
        "Làm theo docs/REFEREE-E2E.md:",
        "1. Mở file .env.development trong thư mục dự án",
        "2. Dán URL + anon key từ Supabase → Project Settings → API",
        "3. Chạy lại: npm run test:supabase-referee",
      ].join("\n")
    );
  }

  info(`URL: ${url}`);

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const probe = await client.from(TABLE).select("id").limit(1);
  if (probe.error) {
    const message = probe.error.message || "unknown error";
    if (/relation .* does not exist/i.test(message)) {
      fail(
        [
          `Bảng ${TABLE} chưa tồn tại.`,
          "Mở Supabase SQL Editor → dán docs/supabase-match-live.sql → Run.",
        ].join("\n")
      );
    }

    fail(`Không đọc được bảng ${TABLE}: ${message}`);
  }

  ok(`Bảng ${TABLE} tồn tại`);

  const columnProbe = await client
    .from(TABLE)
    .select("id, stage_label, audit_log")
    .limit(1);

  if (columnProbe.error) {
    fail(
      [
        `Thiếu cột stage_label hoặc audit_log: ${columnProbe.error.message}`,
        "Chạy thêm docs/supabase-match-live-v2.sql trong SQL Editor.",
      ].join("\n")
    );
  }

  ok("Cột stage_label + audit_log OK");

  const insertPayload = {
    id: TEST_ID,
    club_id: "e2e-club",
    tournament_id: "e2e-tournament",
    event_id: "e2e-event",
    match_id: "e2e-match",
    referee_token: TEST_TOKEN,
    referee_name: "Smoke Test",
    tournament_name: "E2E Referee",
    stage_label: "Smoke",
    entry_a_label: "Đội A",
    entry_b_label: "Đội B",
    court_label: "Sân 1",
    score_a: 0,
    score_b: 0,
    status: "playing",
    is_daily: false,
    audit_log: [],
    updated_at: new Date().toISOString(),
  };

  const realtimePromise = waitForRealtime(client, TEST_ID);

  const upsertResult = await client.from(TABLE).upsert(insertPayload, { onConflict: "id" });
  if (upsertResult.error) {
    fail(`Không ghi được dữ liệu test: ${upsertResult.error.message}`);
  }

  ok("Ghi (upsert) dữ liệu test OK");

  const updateResult = await client
    .from(TABLE)
    .update({ score_a: 1, updated_at: new Date().toISOString() })
    .eq("id", TEST_ID)
    .select()
    .single();

  if (updateResult.error) {
    fail(`Không cập nhật điểm test: ${updateResult.error.message}`);
  }

  ok("Cập nhật điểm test OK");

  try {
    await realtimePromise;
    ok("Realtime nhận event UPDATE");
  } catch (error) {
    fail(
      [
        error.message,
        "",
        "Bật Replication cho bảng tournament_match_live:",
        "Supabase Dashboard → Database → Publications → supabase_realtime → bật bảng",
        "Hoặc SQL: alter publication supabase_realtime add table tournament_match_live;",
      ].join("\n")
    );
  }

  await client.from(TABLE).delete().eq("id", TEST_ID);
  ok("Đã xóa dữ liệu test");

  console.log("\n🎉 Supabase sẵn sàng cho test E2E trọng tài.");
  console.log("Tiếp theo: npm run dev:lan → mở Director → gán trọng tài → quét QR trên điện thoại.");
}

main().catch((error) => {
  fail(error?.message || String(error));
});
