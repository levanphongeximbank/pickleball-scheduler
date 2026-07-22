/**
 * Phase 1J-C — Controlled directory auth + repository remediation tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DIRECTORY_DTO_EXCLUDED_FIELDS,
  DIRECTORY_DTO_FIELDS,
  DIRECTORY_ERROR_CODES,
} from "../src/features/player/constants/directory.js";
import {
  getPublicDirectoryPlayer,
  searchPublicDirectoryPlayers,
} from "../src/features/player/index.js";
import { createPlayerDirectoryRepository } from "../src/features/player/repositories/playerDirectoryRepository.js";
import {
  PLAYER_DIRECTORY_RPC,
  createSupabasePlayerDirectoryRepository,
} from "../src/features/player/repositories/supabasePlayerDirectoryRepository.js";
import { resolveDirectorySession } from "../src/features/player/services/directorySession.js";
import { encodeDirectoryCursor } from "../src/features/player/utils/directoryCursor.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

function validRpcRow(overrides = {}) {
  return {
    player_id: "player-1jc",
    display_name: "Lan QA",
    is_verified: true,
    avatar_url: null,
    activity_region: "Hà Nội",
    gender: null,
    handedness: null,
    ...overrides,
  };
}

function mockSearchClient(calls, rowOverrides = {}) {
  return {
    async rpc(name, args) {
      calls.push({ name, args });
      return {
        data: {
          ok: true,
          data: [validRpcRow(rowOverrides)],
          meta: { nextCursor: null, limit: 20, count: 1 },
        },
        error: null,
      };
    },
  };
}

function mockDetailClient(calls, player = validRpcRow()) {
  return {
    async rpc(name, args) {
      calls.push({ name, args });
      return {
        data: {
          ok: true,
          data: player,
          meta: {},
        },
        error: null,
      };
    },
  };
}

// ─── A. Authenticated default session ─────────────────────────────────────────

test("1J-C auth — getCurrentUser default allows search without user/session", async () => {
  const calls = [];
  const result = await searchPublicDirectoryPlayers(
    { query: "la" },
    {
      getCurrentUser: () => ({ id: "auth-1jc" }),
      getSupabaseClient: () => mockSearchClient(calls),
      hasSupabaseConfig: () => true,
    }
  );
  assert.equal(result.ok, true);
  assert.notEqual(result.code, DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].displayName, "Lan QA");
  assert.equal(calls[0].name, PLAYER_DIRECTORY_RPC.SEARCH);
});

test("1J-C auth — getCurrentUser default allows detail without user/session", async () => {
  const calls = [];
  const result = await getPublicDirectoryPlayer("player-1jc", {
    getCurrentUser: () => ({ id: "auth-1jc" }),
    getSupabaseClient: () => mockDetailClient(calls),
    hasSupabaseConfig: () => true,
  });
  assert.equal(result.ok, true);
  assert.notEqual(result.code, DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED);
  assert.equal(result.player.playerId, "player-1jc");
  assert.equal(calls[0].name, PLAYER_DIRECTORY_RPC.GET);
});

test("1J-C auth — resolveDirectorySession falls back to authService when no deps", () => {
  const result = resolveDirectorySession({});
  // Test env typically has no session → controlled NOT_AUTHENTICATED (proves default path ran).
  if (result.ok) {
    assert.ok(result.authUserId);
  } else {
    assert.equal(result.code, DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED);
  }
});

// ─── B. Unauthenticated default session ───────────────────────────────────────

test("1J-C auth — null getCurrentUser keeps controlled unauthenticated search", async () => {
  const result = await searchPublicDirectoryPlayers(
    { query: "la" },
    {
      getCurrentUser: () => null,
      directoryRepository: createPlayerDirectoryRepository({
        async directorySearch() {
          throw new Error("repository must not be called");
        },
      }),
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED);
  assert.deepEqual(result.items, []);
});

test("1J-C auth — null getCurrentUser keeps controlled unauthenticated detail", async () => {
  const result = await getPublicDirectoryPlayer("player-1jc", {
    getCurrentUser: () => null,
    directoryRepository: createPlayerDirectoryRepository({
      async directoryGetByPlayerId() {
        throw new Error("repository must not be called");
      },
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED);
  assert.equal(result.player, null);
});

// ─── C. Injected dependency compatibility ─────────────────────────────────────

test("1J-C DI — explicit user + stub repository still work", async () => {
  const result = await searchPublicDirectoryPlayers(
    { query: "la" },
    {
      user: { id: "injected-user" },
      directoryRepository: createPlayerDirectoryRepository({
        async directorySearch() {
          return {
            ok: true,
            items: [
              {
                playerId: "player-di",
                displayName: "Injected",
                isVerified: true,
                avatarUrl: null,
                activityRegion: null,
                gender: null,
                handedness: null,
              },
            ],
            nextCursor: null,
          };
        },
      }),
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.items[0].playerId, "player-di");
});

test("1J-C DI — explicit session via getSession still works for detail", async () => {
  const result = await getPublicDirectoryPlayer(
    { playerId: "player-di" },
    {
      getSession: () => ({ user: { id: "session-user" } }),
      directoryRepository: createPlayerDirectoryRepository({
        async directoryGetByPlayerId() {
          return {
            ok: true,
            player: {
              playerId: "player-di",
              displayName: "Session",
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
  assert.equal(result.player.displayName, "Session");
});

// ─── D. Default repository wiring ─────────────────────────────────────────────

test("1J-C repo — without injected repository, Supabase adapter RPC is invoked", async () => {
  const calls = [];
  const result = await searchPublicDirectoryPlayers(
    { query: "la", activityRegion: "Hà Nội", limit: 10 },
    {
      getCurrentUser: () => ({ id: "auth-1jc" }),
      getSupabaseClient: () => mockSearchClient(calls),
      hasSupabaseConfig: () => true,
    }
  );
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "player_directory_search");
  assert.deepEqual(calls[0].args, {
    p_query: "la",
    p_region: "Hà Nội",
    p_cursor: null,
    p_limit: 10,
  });
  assert.notEqual(result.code, DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE);
});

test("1J-C repo — stub port remains available when explicitly injected", async () => {
  const stub = createPlayerDirectoryRepository();
  const result = await searchPublicDirectoryPlayers(
    { query: "la" },
    {
      user: { id: "auth-1jc" },
      directoryRepository: stub,
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE);
});

test("1J-C repo — createSupabasePlayerDirectoryRepository defaults to shared client helpers", () => {
  const adapterSrc = readSrc(
    "src/features/player/repositories/supabasePlayerDirectoryRepository.js"
  );
  assert.match(adapterSrc, /getSupabaseAuthClient/);
  assert.match(adapterSrc, /hasSupabaseConfig/);
  const searchSrc = readSrc(
    "src/features/player/services/searchPublicDirectoryPlayers.js"
  );
  const detailSrc = readSrc(
    "src/features/player/services/getPublicDirectoryPlayer.js"
  );
  assert.match(searchSrc, /createSupabasePlayerDirectoryRepository/);
  assert.match(detailSrc, /createSupabasePlayerDirectoryRepository/);
  assert.equal(searchSrc.includes("createPlayerDirectoryRepository()"), false);
  assert.equal(detailSrc.includes("createPlayerDirectoryRepository()"), false);
  assert.equal(typeof createSupabasePlayerDirectoryRepository, "function");
});

// ─── E. Privacy / contract regression ─────────────────────────────────────────

test("1J-C privacy — allow-list and exclusions unchanged", () => {
  assert.deepEqual([...DIRECTORY_DTO_FIELDS], [
    "playerId",
    "displayName",
    "isVerified",
    "avatarUrl",
    "activityRegion",
    "gender",
    "handedness",
  ]);
  for (const field of [
    "email",
    "phone",
    "birthDate",
    "birthYear",
    "privacySettings",
    "verificationStatus",
    "authUserId",
    "status",
    "clubId",
    "tenantId",
  ]) {
    assert.ok(DIRECTORY_DTO_EXCLUDED_FIELDS.includes(field), field);
  }
});

test("1J-C privacy — default search path strips prohibited RPC fields", async () => {
  const calls = [];
  const result = await searchPublicDirectoryPlayers(
    { query: "la" },
    {
      getCurrentUser: () => ({ id: "auth-1jc" }),
      getSupabaseClient: () =>
        mockSearchClient(calls, {
          email: "secret@example.com",
          phone: "0900000000",
          privacy_settings: { publicProfileEnabled: true },
        }),
      hasSupabaseConfig: () => true,
    }
  );
  // Malformed / extra columns: projector keeps only allow-list; unknown keys ignored
  // if row still has required allow-list fields. Ensure no prohibited keys on DTO.
  assert.equal(result.ok, true);
  const item = result.items[0];
  for (const key of Object.keys(item)) {
    assert.ok(DIRECTORY_DTO_FIELDS.includes(key), `unexpected DTO key ${key}`);
  }
  assert.equal(Object.prototype.hasOwnProperty.call(item, "email"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(item, "phone"), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(item, "privacySettings"),
    false
  );
});

test("1J-C privacy — hidden/not-found remains generic null player", async () => {
  const result = await getPublicDirectoryPlayer("hidden-id", {
    getCurrentUser: () => ({ id: "auth-1jc" }),
    getSupabaseClient: () => ({
      async rpc() {
        return {
          data: { ok: true, data: null, meta: {} },
          error: null,
        };
      },
    }),
    hasSupabaseConfig: () => true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.player, null);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "reason"), false);
});

test("1J-C cursor — invalid opaque cursor still DIRECTORY_INVALID_CURSOR", async () => {
  const result = await searchPublicDirectoryPlayers(
    { cursor: "not-a-cursor" },
    {
      getCurrentUser: () => ({ id: "auth-1jc" }),
      getSupabaseClient: () => ({
        async rpc() {
          throw new Error("RPC must not run for invalid cursor");
        },
      }),
      hasSupabaseConfig: () => true,
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DIRECTORY_ERROR_CODES.INVALID_CURSOR);
  assert.equal(result.nextCursor, null);
});

test("1J-C cursor — valid opaque cursor passes through to RPC", async () => {
  const encoded = encodeDirectoryCursor({
    displayName: "Lan QA",
    playerId: "player-0",
  });
  const calls = [];
  const result = await searchPublicDirectoryPlayers(
    { query: "", cursor: encoded.cursor, limit: 20 },
    {
      getCurrentUser: () => ({ id: "auth-1jc" }),
      getSupabaseClient: () => mockSearchClient(calls),
      hasSupabaseConfig: () => true,
    }
  );
  assert.equal(result.ok, true);
  assert.equal(calls[0].args.p_cursor, encoded.cursor);
});
