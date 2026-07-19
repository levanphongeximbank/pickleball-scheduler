/**
 * Phase 1C runtime bootstrap injection — focused unit tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDefaultPlayerProfileWriteRepository,
  createRuntimePlayerProfileWriteRepository,
} from "../src/features/player/bootstrap/playerProfileWriteBootstrap.js";
import { createSupabaseProfilesPlayerWriteRepository } from "../src/features/player/repositories/supabaseProfilesPlayerWriteRepository.js";
import { updatePlayerProfile } from "../src/features/player/index.js";
import { updateAuthenticatedSelfPlayerProfile } from "../src/features/player/services/updateAuthenticatedSelfPlayerProfile.js";
import { WRITE_ERROR_CODES } from "../src/features/player/constants/writableFields.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function directory(map) {
  const store = new Map(Object.entries(map));
  return (playerId) => {
    const id = String(playerId || "").trim();
    if (!id) return null;
    return store.has(id) ? store.get(id) : null;
  };
}

test("bootstrap injects createSupabaseProfilesPlayerWriteRepository when configured", () => {
  const fakeClient = { from() {} };
  const repo = createDefaultPlayerProfileWriteRepository({
    hasConfig: () => true,
    getClient: () => fakeClient,
    createDurableRepository: (deps) => {
      assert.equal(typeof deps.getClient, "function");
      assert.equal(deps.getClient(), fakeClient);
      assert.equal(deps.supabase, fakeClient);
      return createSupabaseProfilesPlayerWriteRepository(deps);
    },
  });
  assert.equal(repo.kind, "supabase_profiles");
  assert.equal(repo.durable, true);
});

test("bootstrap keeps unconfigured when Supabase is unavailable", () => {
  const repo = createDefaultPlayerProfileWriteRepository({
    hasConfig: () => false,
    getClient: () => null,
  });
  assert.equal(repo.kind, "unconfigured");
  assert.equal(repo.durable, false);
});

test("runtime helper passes authenticated client through", () => {
  const client = { id: "session-client" };
  const repo = createRuntimePlayerProfileWriteRepository({
    hasConfig: () => true,
    supabase: client,
  });
  assert.equal(repo.kind, "supabase_profiles");
});

test("updatePlayerProfile default path uses durable repository when bootstrapped", async () => {
  const calls = [];
  const durable = createSupabaseProfilesPlayerWriteRepository({
    hasConfig: () => true,
    getClient: () => ({
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "auth-1",
                      player_id: "player-1",
                      handedness: "right",
                      identity_verification_status: "unverified",
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    }),
    updateProfileRowById: async (userId, patch) => {
      calls.push({ userId, patch });
      return {
        ok: true,
        profile: {
          id: userId,
          player_id: "player-1",
          handedness: patch.handedness,
          identity_verification_status: "unverified",
        },
      };
    },
  });

  // Simulate canonical default selection
  const defaultRepo = createDefaultPlayerProfileWriteRepository({
    hasConfig: () => true,
    getClient: () => ({}),
    createDurableRepository: () => durable,
  });

  const result = await updatePlayerProfile(
    "player-1",
    { handedness: "left" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1", authUserId: "auth-1" } }),
      writeRepository: defaultRepo,
      authUserId: "auth-1",
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.durable, true);
  assert.equal(result.profile.handedness, "left");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].userId, "auth-1");
  assert.equal(calls[0].patch.handedness, "left");
});

test("unconfigured contexts still fail safely", async () => {
  const repo = createDefaultPlayerProfileWriteRepository({
    hasConfig: () => false,
  });
  const result = await updatePlayerProfile(
    "player-1",
    { handedness: "left" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.PERSISTENCE_NOT_CONFIGURED);
  assert.equal(result.durable, false);
});

test("forbidden verification fields remain blocked on runtime path", async () => {
  const durable = createSupabaseProfilesPlayerWriteRepository({
    hasConfig: () => true,
    getClient: () => ({
      from() {
        return {
          select() {
            return {
              eq() {
                return { maybeSingle: async () => ({ data: null, error: null }) };
              },
            };
          },
        };
      },
    }),
    updateProfileRowById: async () => {
      throw new Error("should not persist");
    },
  });
  const result = await updatePlayerProfile(
    "player-1",
    { verificationStatus: "verified" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: durable,
      existingProfile: { playerId: "player-1" },
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.FORBIDDEN_FIELD);
});

test("RLS/authorization errors propagate without false success", async () => {
  const durable = createSupabaseProfilesPlayerWriteRepository({
    hasConfig: () => true,
    getClient: () => ({
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { id: "auth-1", player_id: "player-1" },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    }),
    updateProfileRowById: async () => ({
      ok: false,
      code: "PROFILE_UPDATE_FAILED",
      error: 'new row violates row-level security policy for table "profiles"',
    }),
  });

  const result = await updatePlayerProfile(
    "player-1",
    { handedness: "right" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1", authUserId: "auth-1" } }),
      writeRepository: durable,
      authUserId: "auth-1",
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.RLS_DENIED);
  assert.equal(result.profile, null);
});

test("bootstrap + durable repo sources must not use service_role", () => {
  const paths = [
    "../src/features/player/bootstrap/playerProfileWriteBootstrap.js",
    "../src/features/player/services/updateAuthenticatedSelfPlayerProfile.js",
    "../src/features/player/repositories/supabaseProfilesPlayerWriteRepository.js",
    "../src/features/identity/services/selfProfileService.js",
  ];
  const src = paths.map((p) => readFileSync(join(__dirname, p), "utf8")).join("\n");
  assert.ok(!/SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|sb_secret_/i.test(src));
  assert.ok(src.includes("getSupabaseAuthClient") || src.includes("hasSupabaseConfig"));
});

test("selfProfileService supabase path delegates to Player Management (static)", () => {
  const src = readFileSync(
    join(__dirname, "../src/features/identity/services/selfProfileService.js"),
    "utf8"
  );
  assert.ok(src.includes("updateAuthenticatedSelfPlayerProfile"));
  assert.ok(!src.includes("updateProfileRowById"));
});

test("updateAuthenticatedSelfPlayerProfile module exports callable service", () => {
  assert.equal(typeof updateAuthenticatedSelfPlayerProfile, "function");
});
