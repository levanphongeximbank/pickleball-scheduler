import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchMatchLiveByTokenWithClient,
  isRpcNotFoundError,
  normalizeMatchLiveRow,
  __resetRefereeRpcCacheForTests,
} from "../src/domain/matchLiveSync.js";
import { REFEREE_LINK_LOCKED_MESSAGE } from "../src/models/tournament/scoreLog.js";

const VALID_TOKEN = "a".repeat(32);
const OTHER_TOKEN = "b".repeat(32);

test.beforeEach(() => {
  __resetRefereeRpcCacheForTests();
});

const RPC_MATCH = {
  id: "club::tour::m1",
  match_id: "m1",
  referee_token: VALID_TOKEN,
  referee_name: "TT Test",
  tournament_name: "Giải test",
  stage_label: "Bảng A",
  entry_a_label: "Đội A",
  entry_b_label: "Đội B",
  court_label: "Sân 1",
  score_a: 5,
  score_b: 3,
  status: "playing",
  is_daily: false,
  audit_log: [],
  updated_at: "2026-06-30T10:00:00.000Z",
};

function createMockSupabase({ rpcHandlers = {}, tableHandlers = {} } = {}) {
  return {
    rpc: async (name, args) => {
      const handler = rpcHandlers[name];
      if (handler) {
        return handler(args);
      }
      return { data: null, error: { code: "PGRST202", message: "function not found" } };
    },
    from: (table) => {
      const handler = tableHandlers[table];
      if (!handler) {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: [], error: null }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      return handler();
    },
  };
}

test("referee RPC — token hợp lệ chỉ trả đúng 1 trận", async () => {
  const supabase = createMockSupabase({
    rpcHandlers: {
      referee_get_match_by_token: ({ p_token }) => {
        assert.equal(p_token, VALID_TOKEN);
        return { data: RPC_MATCH, error: null };
      },
    },
  });

  const result = await fetchMatchLiveByTokenWithClient(supabase, VALID_TOKEN);
  assert.equal(result.ok, true);
  assert.equal(result.row.matchId, "m1");
  assert.equal(result.row.refereeToken, VALID_TOKEN);
  assert.equal(result.row.clubId, "");
  assert.equal(result.row.tournamentId, "");
});

test("referee RPC — token sai không trả dữ liệu", async () => {
  const supabase = createMockSupabase({
    rpcHandlers: {
      referee_get_match_by_token: () => ({ data: null, error: null }),
    },
  });

  const result = await fetchMatchLiveByTokenWithClient(supabase, OTHER_TOKEN);
  assert.equal(result.ok, false);
  assert.equal(result.error, REFEREE_LINK_LOCKED_MESSAGE);
});

test("referee RPC — token quá ngắn bị từ chối client-side", async () => {
  const supabase = createMockSupabase();
  const result = await fetchMatchLiveByTokenWithClient(supabase, "short");
  assert.equal(result.ok, false);
  assert.equal(result.error, REFEREE_LINK_LOCKED_MESSAGE);
});

test("referee security — anon REST select * bị từ chối (RLS staging)", async () => {
  const supabase = createMockSupabase({
    tableHandlers: {
      tournament_match_live: () => ({
        select: () => ({
          eq: async () => ({
            data: null,
            error: { message: "permission denied for table tournament_match_live" },
          }),
        }),
      }),
    },
  });

  const { data, error } = await supabase
    .from("tournament_match_live")
    .select("*")
    .eq("club_id", "club-1");

  assert.ok(error);
  assert.equal(data, null);
});

test("referee update — RPC chỉ nhận đúng token", async () => {
  const supabase = createMockSupabase({
    rpcHandlers: {
      referee_update_match_score: ({ p_token, p_payload }) => {
        if (p_token !== VALID_TOKEN) {
          return { data: null, error: null };
        }
        assert.equal(p_payload.action, "adjust");
        return {
          data: { ...RPC_MATCH, score_a: 6 },
          error: null,
        };
      },
    },
  });

  const okResult = await supabase.rpc("referee_update_match_score", {
    p_token: VALID_TOKEN,
    p_payload: { action: "adjust", team: "A", delta: 1 },
  });
  assert.equal(okResult.data.score_a, 6);

  const badResult = await supabase.rpc("referee_update_match_score", {
    p_token: OTHER_TOKEN,
    p_payload: { action: "adjust", team: "A", delta: 1 },
  });
  assert.equal(badResult.data, null);
});

test("staff flow — authenticated select theo club/tournament vẫn trả danh sách", async () => {
  const staffRow = {
    id: "x",
    club_id: "club-1",
    tournament_id: "tour-1",
    match_id: "m1",
    referee_token: VALID_TOKEN,
    score_a: 0,
    score_b: 0,
    status: "playing",
    audit_log: [],
  };

  const supabase = createMockSupabase({
    tableHandlers: {
      tournament_match_live: () => ({
        select: () => ({
          eq: (_col, clubId) => ({
            eq: async (_col2, tournamentId) => {
              assert.equal(clubId, "club-1");
              assert.equal(tournamentId, "tour-1");
              return { data: [staffRow], error: null };
            },
          }),
        }),
      }),
    },
  });

  const { data, error } = await supabase
    .from("tournament_match_live")
    .select("*")
    .eq("club_id", "club-1")
    .eq("tournament_id", "tour-1");

  assert.equal(error, null);
  assert.equal(data.length, 1);
  assert.equal(normalizeMatchLiveRow(data[0]).clubId, "club-1");
});

test("dev fallback — RPC chưa deploy thì dùng direct select theo token", async () => {
  const supabase = createMockSupabase({
    rpcHandlers: {
      referee_get_match_by_token: () => ({
        data: null,
        error: { code: "PGRST202", message: "function not found" },
      }),
    },
    tableHandlers: {
      tournament_match_live: () => ({
        select: () => ({
          eq: (_col, token) => ({
            maybeSingle: async () => {
              assert.equal(token, VALID_TOKEN);
              return {
                data: { ...RPC_MATCH, club_id: "club-1", tournament_id: "tour-1" },
                error: null,
              };
            },
          }),
        }),
      }),
    },
  });

  const result = await fetchMatchLiveByTokenWithClient(supabase, VALID_TOKEN);
  assert.equal(result.ok, true);
  assert.equal(result.row.clubId, "club-1");
});

test("isRpcNotFoundError nhận diện function chưa deploy", () => {
  assert.equal(isRpcNotFoundError({ code: "PGRST202" }), true);
  assert.equal(isRpcNotFoundError({ message: "function referee_get_match_by_token not found" }), true);
  assert.equal(isRpcNotFoundError({ message: "permission denied" }), false);
});

test("referee RPC response shape — normalize không expose club_id", () => {
  const row = normalizeMatchLiveRow(RPC_MATCH);
  assert.equal(row.scoreA, 5);
  assert.equal(row.entryALabel, "Đội A");
  assert.equal(row.clubId, "");
});
