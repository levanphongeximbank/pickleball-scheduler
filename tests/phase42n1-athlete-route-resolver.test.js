import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  buildAthleteRouteId,
  buildCanonicalProfileRouteId,
  parsePlatformAthleteRouteId,
} from "../src/features/club/services/accountOnlyAthleteService.js";
import {
  __resetResolveV2DepsForTests,
  __setResolveV2DepsForTests,
  resolveV2AthleteProfile,
} from "../src/features/club/services/resolveV2AthleteProfileService.js";

const HUONG_USER_ID = "f776d627-a9f2-4c0c-8d81-bda239cc923b";
const HUONG_ATHLETE_ID = "9c7155c5-4731-48d3-adac-bbae4564c66e";

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

function huongResolvedData() {
  return {
    auth_user_id: HUONG_USER_ID,
    profile: {
      id: HUONG_USER_ID,
      email: "huonganna120193@gmail.com",
      display_name: "Hương Nguyễn",
    },
    athlete: {
      id: HUONG_ATHLETE_ID,
      user_id: HUONG_USER_ID,
      display_name: "Hương Nguyễn",
      tenant_id: "tenant-accc",
    },
    active_memberships: [
      {
        membership_id: "m-accc",
        club_id: "club-accc",
        club_name: "CLB ACCC",
        tenant_id: "tenant-accc",
        athlete_id: HUONG_ATHLETE_ID,
        status: "active",
        membership_type: "regular",
        joined_at: null,
      },
    ],
  };
}

function withV2(overrides = {}) {
  __setResolveV2DepsForTests({
    isClubStorageV2Enabled: () => true,
    ...overrides,
  });
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
});

afterEach(() => {
  __resetResolveV2DepsForTests();
  delete globalThis.localStorage;
});

// --- Route parser (root cause) --------------------------------------------

test("parsePlatformAthleteRouteId — profile-{auth_user_id}", () => {
  const parsed = parsePlatformAthleteRouteId(`profile-${HUONG_USER_ID}`);
  assert.equal(parsed.authUserId, HUONG_USER_ID);
  assert.equal(parsed.athleteId, null);
  assert.equal(parsed.isAccountOnly, true);
});

test("parsePlatformAthleteRouteId — athlete-{athlete_id}", () => {
  const parsed = parsePlatformAthleteRouteId(`athlete-${HUONG_ATHLETE_ID}`);
  assert.equal(parsed.authUserId, null);
  assert.equal(parsed.athleteId, HUONG_ATHLETE_ID);
  assert.equal(parsed.isAccountOnly, false);
});

test("parsePlatformAthleteRouteId — legacy id (no prefix)", () => {
  const parsed = parsePlatformAthleteRouteId("p-legacy-123");
  assert.equal(parsed.playerId, "p-legacy-123");
  assert.equal(parsed.authUserId, null);
  assert.equal(parsed.athleteId, null);
  assert.equal(parsed.isAccountOnly, false);
});

test("buildCanonicalProfileRouteId / buildAthleteRouteId", () => {
  assert.equal(buildCanonicalProfileRouteId(HUONG_USER_ID), `profile-${HUONG_USER_ID}`);
  assert.equal(buildAthleteRouteId(HUONG_ATHLETE_ID), `athlete-${HUONG_ATHLETE_ID}`);
});

// --- Resolver: athlete-{id} route ------------------------------------------

test("resolveV2AthleteProfile — athlete-{id} maps to user and opens same profile", async () => {
  let byIdCalledWith = null;
  withV2({
    rpcResolveAthleteById: async (athleteId) => {
      byIdCalledWith = athleteId;
      return { ok: true, data: huongResolvedData() };
    },
    rpcResolveAthleteProfile: async () => {
      throw new Error("by-user RPC should not be called for athlete route");
    },
  });

  const result = await resolveV2AthleteProfile({
    routePlayerId: buildAthleteRouteId(HUONG_ATHLETE_ID),
  });

  assert.equal(byIdCalledWith, HUONG_ATHLETE_ID);
  assert.equal(result.ok, true);
  assert.equal(result.isAccountOnly, false);
  assert.equal(result.authUserId, HUONG_USER_ID);
  assert.equal(result.resolvedPlayerId, `profile-${HUONG_USER_ID}`);
  assert.equal(result.activeMemberships.length, 1);
  assert.equal(result.activeMemberships[0].club_name, "CLB ACCC");
});

test("resolveV2AthleteProfile — profile-{id} and athlete-{id} open the same profile", async () => {
  withV2({
    rpcResolveAthleteById: async () => ({ ok: true, data: huongResolvedData() }),
    rpcResolveAthleteProfile: async () => ({ ok: true, data: huongResolvedData() }),
  });

  const viaProfile = await resolveV2AthleteProfile({
    routePlayerId: buildCanonicalProfileRouteId(HUONG_USER_ID),
  });
  const viaAthlete = await resolveV2AthleteProfile({
    routePlayerId: buildAthleteRouteId(HUONG_ATHLETE_ID),
  });

  assert.equal(viaProfile.ok, true);
  assert.equal(viaAthlete.ok, true);
  assert.equal(viaProfile.authUserId, viaAthlete.authUserId);
  assert.equal(viaProfile.resolvedPlayerId, viaAthlete.resolvedPlayerId);
  assert.equal(viaProfile.isAccountOnly, false);
  assert.equal(viaAthlete.isAccountOnly, false);
});

test("resolveV2AthleteProfile — athlete route FORBIDDEN maps to friendly message", async () => {
  withV2({
    rpcResolveAthleteById: async () => ({
      ok: false,
      code: "FORBIDDEN",
      error: "Không có quyền xem hồ sơ VĐV này.",
    }),
  });

  const result = await resolveV2AthleteProfile({
    routePlayerId: buildAthleteRouteId(HUONG_ATHLETE_ID),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "FORBIDDEN");
  assert.equal(result.error, "Bạn không có quyền xem hồ sơ vận động viên này.");
});

test("resolveV2AthleteProfile — athlete not found → 404 friendly message", async () => {
  withV2({
    rpcResolveAthleteById: async () => ({ ok: false, code: "NOT_FOUND", error: "x" }),
  });

  const result = await resolveV2AthleteProfile({
    routePlayerId: buildAthleteRouteId("missing-athlete"),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "NOT_FOUND");
  assert.equal(result.error, "Không tìm thấy vận động viên.");
});

test("resolveV2AthleteProfile — athlete without user_id → missing-link friendly message", async () => {
  withV2({
    rpcResolveAthleteById: async () => ({ ok: false, code: "ATHLETE_NOT_LINKED", error: "x" }),
  });

  const result = await resolveV2AthleteProfile({
    routePlayerId: buildAthleteRouteId(HUONG_ATHLETE_ID),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "ATHLETE_NOT_LINKED");
  assert.equal(result.error, "Hồ sơ vận động viên chưa được liên kết đầy đủ.");
});

test("resolveV2AthleteProfile — RPC not deployed falls back to RLS-scoped client lookup", async () => {
  let byUserCalledWith = null;
  const fakeClient = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: { id: HUONG_ATHLETE_ID, user_id: HUONG_USER_ID }, error: null });
        },
      };
    },
  };

  withV2({
    rpcResolveAthleteById: async () => ({ ok: false, code: "RPC_NOT_DEPLOYED", error: "missing" }),
    getSupabaseAuthClient: () => fakeClient,
    rpcResolveAthleteProfile: async (userId) => {
      byUserCalledWith = userId;
      return { ok: true, data: huongResolvedData() };
    },
  });

  const result = await resolveV2AthleteProfile({
    routePlayerId: buildAthleteRouteId(HUONG_ATHLETE_ID),
  });

  assert.equal(byUserCalledWith, HUONG_USER_ID);
  assert.equal(result.ok, true);
  assert.equal(result.authUserId, HUONG_USER_ID);
  assert.equal(result.resolvedPlayerId, `profile-${HUONG_USER_ID}`);
});

test("resolveV2AthleteProfile — account-only user stays account-only", async () => {
  withV2({
    rpcResolveAthleteProfile: async () => ({
      ok: true,
      data: {
        auth_user_id: "user-account-only",
        profile: { id: "user-account-only", email: "solo@example.com", display_name: "Solo" },
        athlete: null,
        active_memberships: [],
      },
    }),
  });

  const result = await resolveV2AthleteProfile({
    routePlayerId: buildCanonicalProfileRouteId("user-account-only"),
  });

  assert.equal(result.ok, true);
  assert.equal(result.isAccountOnly, true);
  assert.equal(result.activeMemberships.length, 0);
});

test("resolveV2AthleteProfile — legacy athlete-* bookmark resolves (canonical redirect target)", async () => {
  withV2({
    rpcResolveAthleteById: async () => ({ ok: true, data: huongResolvedData() }),
  });

  const result = await resolveV2AthleteProfile({
    routePlayerId: buildAthleteRouteId(HUONG_ATHLETE_ID),
  });

  assert.equal(result.ok, true);
  // Canonical resolved id lets PlayerProfile redirect athlete-* → profile-*.
  assert.equal(result.resolvedPlayerId, `profile-${HUONG_USER_ID}`);
});
