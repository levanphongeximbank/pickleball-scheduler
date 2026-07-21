/**
 * Phase 1I-A — Public Player Directory application contract tests (remediated).
 */
import assert from "node:assert/strict";
import test from "node:test";

import * as playerPublicApi from "../src/features/player/index.js";
import {
  DIRECTORY_ERROR_CODES,
  getPublicDirectoryPlayer,
  searchPublicDirectoryPlayers,
} from "../src/features/player/index.js";
import {
  DIRECTORY_SEARCH_DEFAULT_LIMIT,
  DIRECTORY_SEARCH_MAX_LIMIT,
} from "../src/features/player/constants/directory.js";
import { normalizeDirectorySearchRequest } from "../src/features/player/contracts/directoryRequests.js";
import { projectDirectoryPlayerFromRpcRow } from "../src/features/player/projectors/projectDirectoryPlayer.js";
import { createPlayerDirectoryRepository } from "../src/features/player/repositories/playerDirectoryRepository.js";
import {
  PLAYER_DIRECTORY_RPC,
  createSupabasePlayerDirectoryRepository,
} from "../src/features/player/repositories/supabasePlayerDirectoryRepository.js";
import {
  decodeDirectoryCursor,
  encodeDirectoryCursor,
} from "../src/features/player/utils/directoryCursor.js";

function validRpcRow(overrides = {}) {
  return {
    player_id: "player-1",
    display_name: "Lan Nguyen",
    is_verified: true,
    avatar_url: null,
    activity_region: null,
    gender: null,
    handedness: null,
    ...overrides,
  };
}

function authDeps(extra = {}) {
  return {
    user: { id: "auth-user-1" },
    ...extra,
  };
}

// ─── Public export boundary ────────────────────────────────────────────────────

test("1I-A exports — facades + DIRECTORY_ERROR_CODES only (no internals)", () => {
  assert.equal(typeof playerPublicApi.searchPublicDirectoryPlayers, "function");
  assert.equal(typeof playerPublicApi.getPublicDirectoryPlayer, "function");
  assert.equal(typeof playerPublicApi.DIRECTORY_ERROR_CODES, "object");
  assert.equal(playerPublicApi.encodeDirectoryCursor, undefined);
  assert.equal(playerPublicApi.decodeDirectoryCursor, undefined);
  assert.equal(playerPublicApi.projectDirectoryPlayerFromRpcRow, undefined);
  assert.equal(playerPublicApi.createSupabasePlayerDirectoryRepository, undefined);
  assert.equal(playerPublicApi.createPlayerDirectoryRepository, undefined);
  assert.equal(playerPublicApi.resolveDirectorySession, undefined);
  assert.equal(playerPublicApi.DIRECTORY_DTO_FIELDS, undefined);
  assert.equal(playerPublicApi.DIRECTORY_SEARCH_DEFAULT_LIMIT, undefined);
});

// ─── DTO ───────────────────────────────────────────────────────────────────────

test("1I-A DTO — valid RPC row projects strict camelCase DTO", () => {
  const result = projectDirectoryPlayerFromRpcRow(
    validRpcRow({
      avatar_url: "https://cdn.example/a.png",
      activity_region: "Hà Nội",
      gender: "female",
      handedness: "right",
    })
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    playerId: "player-1",
    displayName: "Lan Nguyen",
    isVerified: true,
    avatarUrl: "https://cdn.example/a.png",
    activityRegion: "Hà Nội",
    gender: "female",
    handedness: "right",
  });
});

test("1I-A DTO — activity_region string accepted", () => {
  const result = projectDirectoryPlayerFromRpcRow(
    validRpcRow({ activity_region: "  Đà Nẵng  " })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.activityRegion, "Đà Nẵng");
});

test("1I-A DTO — activity_region null accepted", () => {
  const result = projectDirectoryPlayerFromRpcRow(
    validRpcRow({ activity_region: null })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.activityRegion, null);
});

test("1I-A DTO — activity_region object rejected", () => {
  const result = projectDirectoryPlayerFromRpcRow(
    validRpcRow({
      activity_region: { countryCode: "VN", provinceName: "Hà Nội" },
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.RESPONSE_INVALID);
});

test("1I-A DTO — activity_region array rejected", () => {
  const result = projectDirectoryPlayerFromRpcRow(
    validRpcRow({ activity_region: ["Hà Nội"] })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.RESPONSE_INVALID);
});

test("1I-A DTO — activity_region number rejected", () => {
  const result = projectDirectoryPlayerFromRpcRow(
    validRpcRow({ activity_region: 42 })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.RESPONSE_INVALID);
});

test("1I-A DTO — missing playerId fails closed", () => {
  const result = projectDirectoryPlayerFromRpcRow(
    validRpcRow({ player_id: "  ", playerId: undefined })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.RESPONSE_INVALID);
});

test("1I-A DTO — blank displayName fails closed", () => {
  const result = projectDirectoryPlayerFromRpcRow(
    validRpcRow({ display_name: "   " })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.RESPONSE_INVALID);
});

test("1I-A DTO — isVerified false fails closed", () => {
  const result = projectDirectoryPlayerFromRpcRow(
    validRpcRow({ is_verified: false })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.RESPONSE_INVALID);
});

test("1I-A DTO — unexpected raw privacy field is not exposed", () => {
  const result = projectDirectoryPlayerFromRpcRow(
    validRpcRow({
      privacy_settings: { publicProfileEnabled: true, showPhone: true },
      email: "secret@example.com",
      phone: "0901111222",
      auth_user_id: "auth-secret",
      venue_id: "venue-1",
      identity_verification_status: "verified",
    })
  );
  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, "email"), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result.value, "privacy_settings"),
    false
  );
  assert.equal(typeof result.value.activityRegion === "string" || result.value.activityRegion === null, true);
  assert.equal(Object.keys(result.value).sort().join(","), [
    "activityRegion",
    "avatarUrl",
    "displayName",
    "gender",
    "handedness",
    "isVerified",
    "playerId",
  ].join(","));
});

test("1I-A DTO — optional fields null", () => {
  const result = projectDirectoryPlayerFromRpcRow(validRpcRow());
  assert.equal(result.ok, true);
  assert.equal(result.value.avatarUrl, null);
  assert.equal(result.value.activityRegion, null);
  assert.equal(result.value.gender, null);
  assert.equal(result.value.handedness, null);
});

test("1I-A DTO — malformed field types fail closed", () => {
  assert.equal(
    projectDirectoryPlayerFromRpcRow(validRpcRow({ gender: { bad: true } })).ok,
    false
  );
  assert.equal(
    projectDirectoryPlayerFromRpcRow(validRpcRow({ avatar_url: ["x"] })).ok,
    false
  );
  assert.equal(projectDirectoryPlayerFromRpcRow(null).ok, false);
});

// ─── Cursor ────────────────────────────────────────────────────────────────────

test("1I-A cursor — encode/decode round trip", () => {
  const encoded = encodeDirectoryCursor({
    displayName: "  Lan Nguyen ",
    playerId: "player-1",
  });
  assert.equal(encoded.ok, true);
  const decoded = decodeDirectoryCursor(encoded.cursor);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.value.normalizedDisplayName, "lan nguyen");
  assert.equal(decoded.value.playerId, "player-1");
  assert.equal(decoded.value.version, 1);
});

test("1I-A cursor — invalid base64/token fails closed", () => {
  assert.equal(decodeDirectoryCursor("not-a-cursor").ok, false);
  assert.equal(decodeDirectoryCursor("pd1.!!!").ok, false);
  assert.equal(
    decodeDirectoryCursor(
      "pd1." + Buffer.from("{not-json", "utf8").toString("base64url")
    ).ok,
    false
  );
  assert.equal(decodeDirectoryCursor(null).code, DIRECTORY_ERROR_CODES.INVALID_CURSOR);
});

test("1I-A cursor — unsupported version fails closed", () => {
  const payload = Buffer.from(
    JSON.stringify({ v: 99, n: "lan", p: "player-1" }),
    "utf8"
  ).toString("base64url");
  const result = decodeDirectoryCursor(`pd1.${payload}`);
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.INVALID_CURSOR);
});

test("1I-A cursor — missing sort key fails closed", () => {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, n: "  ", p: "player-1" }),
    "utf8"
  ).toString("base64url");
  const result = decodeDirectoryCursor(`pd1.${payload}`);
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.INVALID_CURSOR);
});

test("1I-A cursor — invalid playerId fails closed", () => {
  assert.equal(
    encodeDirectoryCursor({ displayName: "Lan", playerId: "  " }).ok,
    false
  );
  const payload = Buffer.from(
    JSON.stringify({ v: 1, n: "lan", p: "" }),
    "utf8"
  ).toString("base64url");
  assert.equal(decodeDirectoryCursor(`pd1.${payload}`).ok, false);
});

test("1I-A cursor — URL-safe behavior", () => {
  const encoded = encodeDirectoryCursor({
    displayName: "Nguyễn Văn A",
    playerId: "player/with+special",
  });
  assert.equal(encoded.ok, true);
  assert.match(encoded.cursor, /^pd1\.[A-Za-z0-9_-]+$/);
  assert.equal(encoded.cursor.includes("+"), false);
  assert.equal(encoded.cursor.includes("/"), false);
  assert.equal(encoded.cursor.includes("="), false);
  const asQuery = new URLSearchParams({ cursor: encoded.cursor }).toString();
  assert.equal(new URLSearchParams(asQuery).get("cursor"), encoded.cursor);
});

// ─── Request ───────────────────────────────────────────────────────────────────

test("1I-A request — empty browse query allowed", () => {
  const result = normalizeDirectorySearchRequest({ query: "  " });
  assert.equal(result.ok, true);
  assert.equal(result.value.query, "");
  assert.equal(result.value.limit, DIRECTORY_SEARCH_DEFAULT_LIMIT);
});

test("1I-A request — one-character query rejected", () => {
  const result = normalizeDirectorySearchRequest({ query: "a" });
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.INVALID_REQUEST);
});

test("1I-A request — two-character query accepted", () => {
  const result = normalizeDirectorySearchRequest({ query: "la" });
  assert.equal(result.ok, true);
  assert.equal(result.value.query, "la");
});

test("1I-A request — default limit 20", () => {
  const result = normalizeDirectorySearchRequest({});
  assert.equal(result.value.limit, 20);
});

test("1I-A request — maximum limit 50", () => {
  const result = normalizeDirectorySearchRequest({ limit: 50 });
  assert.equal(result.value.limit, DIRECTORY_SEARCH_MAX_LIMIT);
});

test("1I-A request — limit >50 clamped safely", () => {
  const result = normalizeDirectorySearchRequest({ limit: 999 });
  assert.equal(result.value.limit, DIRECTORY_SEARCH_MAX_LIMIT);
});

test("1I-A request — normalized region string", () => {
  const result = normalizeDirectorySearchRequest({
    activityRegion: "  Hà Nội  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.activityRegion, "Hà Nội");
  assert.equal(typeof result.value.activityRegion, "string");
});

test("1I-A request — region object rejected", () => {
  const result = normalizeDirectorySearchRequest({
    activityRegion: { provinceName: "Hà Nội" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.INVALID_REQUEST);
});

test("1I-A request — malformed cursor rejected (no silent fallback)", () => {
  const result = normalizeDirectorySearchRequest({ cursor: "garbage" });
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.INVALID_CURSOR);
});

// ─── Repository adapter ────────────────────────────────────────────────────────

test("1I-A adapter — correct RPC names and argument mapping (SQL contract)", async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      return {
        data: {
          ok: true,
          data: [validRpcRow({ activity_region: "Hà Nội" })],
          meta: { nextCursor: null, limit: 20, count: 1 },
        },
        error: null,
      };
    },
  };

  const repo = createSupabasePlayerDirectoryRepository({ supabase: client });
  const encoded = encodeDirectoryCursor({
    displayName: "Lan Nguyen",
    playerId: "player-0",
  });

  await repo.directorySearch({
    query: "la",
    activityRegion: "Hà Nội",
    cursor: encoded.cursor,
    limit: 20,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, PLAYER_DIRECTORY_RPC.SEARCH);
  assert.equal(PLAYER_DIRECTORY_RPC.SEARCH, "player_directory_search");
  // Locked SQL args: p_query, p_region, p_cursor, p_limit — no invented cursor components.
  assert.deepEqual(Object.keys(calls[0].args).sort(), [
    "p_cursor",
    "p_limit",
    "p_query",
    "p_region",
  ]);
  assert.deepEqual(calls[0].args, {
    p_query: "la",
    p_region: "Hà Nội",
    p_cursor: encoded.cursor,
    p_limit: 20,
  });
  assert.equal(typeof calls[0].args.p_region === "string" || calls[0].args.p_region === null, true);

  calls.length = 0;
  await repo.directoryGetByPlayerId("player-1");
  assert.equal(calls[0].name, PLAYER_DIRECTORY_RPC.GET);
  assert.equal(PLAYER_DIRECTORY_RPC.GET, "player_directory_get");
  assert.deepEqual(calls[0].args, { p_player_id: "player-1" });
});

test("1I-A adapter — p_region null when no region filter", async () => {
  const calls = [];
  const repo = createSupabasePlayerDirectoryRepository({
    supabase: {
      async rpc(name, args) {
        calls.push(args);
        return {
          data: {
            ok: true,
            data: [],
            meta: { nextCursor: null, limit: 20, count: 0 },
          },
          error: null,
        };
      },
    },
  });
  await repo.directorySearch({ query: "", activityRegion: null, cursor: null, limit: 20 });
  assert.equal(calls[0].p_region, null);
  assert.equal(calls[0].p_cursor, null);
});

test("1I-A adapter — RPC error mapping", async () => {
  const repo = createSupabasePlayerDirectoryRepository({
    supabase: {
      async rpc() {
        return {
          data: null,
          error: { message: "permission denied for function", code: "42501" },
        };
      },
    },
  });
  const result = await repo.directorySearch({ query: "", limit: 20 });
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE);
  assert.equal(result.message.includes("42501"), false);
  assert.equal(result.message.toLowerCase().includes("permission denied"), false);
});

test("1I-A adapter — malformed row rejected", async () => {
  const repo = createSupabasePlayerDirectoryRepository({
    supabase: {
      async rpc() {
        return {
          data: {
            ok: true,
            data: [validRpcRow({ is_verified: false })],
            meta: { nextCursor: null },
          },
          error: null,
        };
      },
    },
  });
  const result = await repo.directorySearch({ query: "", limit: 20 });
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.RESPONSE_INVALID);
});

test("1I-A adapter — no raw field leakage", async () => {
  const repo = createSupabasePlayerDirectoryRepository({
    supabase: {
      async rpc() {
        return {
          data: {
            ok: true,
            data: [
              validRpcRow({
                privacy_settings: { publicProfileEnabled: true },
                email: "x@y.z",
                venue_id: "v1",
              }),
            ],
            meta: { nextCursor: null },
          },
          error: null,
        };
      },
    },
  });
  const result = await repo.directorySearch({ query: "", limit: 20 });
  assert.equal(result.ok, true);
  const item = result.items[0];
  assert.equal(Object.prototype.hasOwnProperty.call(item, "privacy_settings"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(item, "email"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(item, "venue_id"), false);
});

test("1I-A adapter — detail not found returns null", async () => {
  const repo = createSupabasePlayerDirectoryRepository({
    supabase: {
      async rpc() {
        return {
          data: { ok: true, data: null, code: null, message: null },
          error: null,
        };
      },
    },
  });
  const result = await repo.directoryGetByPlayerId("missing");
  assert.equal(result.ok, true);
  assert.equal(result.player, null);
});

test("1I-A adapter — search returns meta.nextCursor only (SQL envelope)", async () => {
  const next = encodeDirectoryCursor({
    displayName: "Lan Nguyen",
    playerId: "player-1",
  });
  const repo = createSupabasePlayerDirectoryRepository({
    supabase: {
      async rpc() {
        return {
          data: {
            ok: true,
            data: [validRpcRow()],
            meta: { nextCursor: next.cursor, limit: 20, count: 1 },
          },
          error: null,
        };
      },
    },
  });
  const result = await repo.directorySearch({ query: "", limit: 20 });
  assert.equal(result.ok, true);
  assert.equal(result.nextCursor, next.cursor);
});

test("1I-A adapter — does not invent nextCursor from hasMore", async () => {
  const repo = createSupabasePlayerDirectoryRepository({
    supabase: {
      async rpc() {
        return {
          data: {
            ok: true,
            data: [validRpcRow()],
            meta: { nextCursor: null, limit: 20, count: 1, hasMore: true },
          },
          error: null,
        };
      },
    },
  });
  const result = await repo.directorySearch({ query: "", limit: 20 });
  assert.equal(result.ok, true);
  assert.equal(result.nextCursor, null);
});

test("1I-A adapter — INVALID_CURSOR from envelope mapped", async () => {
  const repo = createSupabasePlayerDirectoryRepository({
    supabase: {
      async rpc() {
        return {
          data: {
            ok: false,
            data: [],
            code: "INVALID_CURSOR",
            message: "bad cursor",
            meta: { nextCursor: null },
          },
          error: null,
        };
      },
    },
  });
  const result = await repo.directorySearch({
    query: "",
    cursor: "pd1.aaaa",
    limit: 20,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.INVALID_CURSOR);
});

// ─── Facade ────────────────────────────────────────────────────────────────────

test("1I-A facade — unauthenticated search rejected", async () => {
  const result = await searchPublicDirectoryPlayers(
    { query: "la" },
    {
      user: null,
      directoryRepository: createPlayerDirectoryRepository({
        async directorySearch() {
          throw new Error("should not be called");
        },
      }),
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED);
  assert.deepEqual(result.items, []);
});

test("1I-A facade — authenticated search succeeds with string region", async () => {
  const next = encodeDirectoryCursor({
    displayName: "Lan",
    playerId: "player-1",
  });
  const result = await searchPublicDirectoryPlayers(
    { query: "la", activityRegion: "  Hà Nội ", limit: 10 },
    authDeps({
      directoryRepository: createPlayerDirectoryRepository({
        async directorySearch(request) {
          assert.equal(request.query, "la");
          assert.equal(request.activityRegion, "Hà Nội");
          assert.equal(typeof request.activityRegion, "string");
          assert.equal(request.limit, 10);
          return {
            ok: true,
            items: [
              {
                playerId: "player-1",
                displayName: "Lan",
                isVerified: true,
                avatarUrl: null,
                activityRegion: "Hà Nội",
                gender: null,
                handedness: null,
              },
            ],
            nextCursor: next.cursor,
          };
        },
      }),
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].activityRegion, "Hà Nội");
  assert.equal(typeof result.items[0].activityRegion, "string");
  assert.equal(result.nextCursor, next.cursor);
});

test("1I-A facade — authenticated detail succeeds", async () => {
  const result = await getPublicDirectoryPlayer(
    "player-1",
    authDeps({
      directoryRepository: createPlayerDirectoryRepository({
        async directoryGetByPlayerId(playerId) {
          assert.equal(playerId, "player-1");
          return {
            ok: true,
            player: {
              playerId: "player-1",
              displayName: "Lan",
              isVerified: true,
              avatarUrl: null,
              activityRegion: null,
              gender: "female",
              handedness: null,
            },
          };
        },
      }),
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.player.displayName, "Lan");
  assert.equal(result.player.isVerified, true);
});

test("1I-A facade — backend error normalized", async () => {
  const result = await searchPublicDirectoryPlayers(
    {},
    authDeps({
      directoryRepository: createPlayerDirectoryRepository({
        async directorySearch() {
          return {
            ok: false,
            code: DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
            message: "postgres://user:pass@host/db permission denied RLS policy xyz",
            items: [],
            nextCursor: null,
          };
        },
      }),
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE);
  assert.equal(result.message.includes("postgres"), false);
  assert.equal(result.message.toLowerCase().includes("rls"), false);
});

test("1I-A facade — hidden/not-found remains generic", async () => {
  const result = await getPublicDirectoryPlayer(
    "hidden-or-missing",
    authDeps({
      directoryRepository: createPlayerDirectoryRepository({
        async directoryGetByPlayerId() {
          return { ok: true, player: null };
        },
      }),
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.player, null);
  assert.equal(result.message, null);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "reason"), false);
});

test("1I-A facade — invalid cursor produces DIRECTORY_INVALID_CURSOR", async () => {
  const result = await searchPublicDirectoryPlayers(
    { cursor: "not-opaque" },
    authDeps({
      directoryRepository: createPlayerDirectoryRepository({
        async directorySearch() {
          throw new Error("should not be called");
        },
      }),
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.INVALID_CURSOR);
  assert.deepEqual(result.items, []);
  assert.equal(result.nextCursor, null);
});

test("1I-A facade — injected session via getSession", async () => {
  const result = await getPublicDirectoryPlayer(
    { playerId: "player-1" },
    {
      getSession: () => ({ user: { id: "auth-2" } }),
      directoryRepository: createPlayerDirectoryRepository({
        async directoryGetByPlayerId() {
          return {
            ok: true,
            player: {
              playerId: "player-1",
              displayName: "A",
              isVerified: true,
              avatarUrl: null,
              activityRegion: null,
              gender: null,
              handedness: null,
            },
          };
        },
      }),
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.player.playerId, "player-1");
});
