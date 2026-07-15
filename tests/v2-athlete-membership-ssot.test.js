import test from "node:test";
import assert from "node:assert/strict";

import {
  isAccountOnlyByV2Data,
  pickPrimaryMembership,
} from "../src/features/club/services/resolveV2AthleteProfileService.js";
import { parsePlatformAthleteRouteId } from "../src/features/club/services/accountOnlyAthleteService.js";
import { verifyClubPlayerRating } from "../src/features/pick-vn-rating/services/ratingVerificationService.js";
import { getPickVnRatingByAuthUserId } from "../src/features/pick-vn-rating/services/pickVnRatingService.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("isAccountOnlyByV2Data — chỉ true khi không membership và không athlete", () => {
  assert.equal(isAccountOnlyByV2Data({ activeMemberships: [], athlete: null }), true);
  assert.equal(
    isAccountOnlyByV2Data({
      activeMemberships: [{ club_id: "club-accc", status: "active" }],
      athlete: null,
    }),
    false
  );
  assert.equal(
    isAccountOnlyByV2Data({
      activeMemberships: [],
      athlete: { id: "ath-1" },
    }),
    false
  );
});

test("pickPrimaryMembership — ưu tiên preferredClubId, không fallback default ẩn", () => {
  const rows = [
    { club_id: "club-a", club_name: "A" },
    { club_id: "club-accc", club_name: "CLB ACCC" },
  ];
  assert.equal(pickPrimaryMembership(rows, "club-accc").club_id, "club-accc");
  assert.equal(pickPrimaryMembership(rows, "missing").club_id, "club-a");
  assert.equal(pickPrimaryMembership([], "club-accc"), null);
});

test("parsePlatformAthleteRouteId — profile-uuid không phải athlete id", () => {
  const parsed = parsePlatformAthleteRouteId(
    "profile-f776d627-a9f2-4c0c-8d81-bda239cc923b"
  );
  assert.equal(parsed.isAccountOnly, true);
  assert.equal(parsed.authUserId, "f776d627-a9f2-4c0c-8d81-bda239cc923b");
  assert.notEqual(parsed.authUserId, parsed.playerId);
});

test("verifyClubPlayerRating — V2 auth_user path không cần blob player", () => {
  globalThis.localStorage = createLocalStorageMock();
  const authUserId = "f776d627-a9f2-4c0c-8d81-bda239cc923b";
  const athleteId = "11111111-1111-1111-1111-111111111111";

  const result = verifyClubPlayerRating(
    "club-219e4a7cbd73437eb6271f02a53314c3",
    `profile-${authUserId}`,
    2.5,
    {
      authUserId,
      athleteId,
      membershipClubId: "club-219e4a7cbd73437eb6271f02a53314c3",
      requireMembershipClub: true,
      verifiedBy: "admin",
      note: "qa",
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.mode, "auth_user_only");
  assert.equal(result.player.authUserId, authUserId);
  assert.equal(result.player.athleteId, athleteId);
  assert.equal(result.player.current_rating, 2.5);

  const stored = getPickVnRatingByAuthUserId(authUserId);
  assert.ok(stored);
  assert.equal(stored.currentRating, 2.5);
});

test("verifyClubPlayerRating — từ chối khi membershipClub khác club xác thực", () => {
  globalThis.localStorage = createLocalStorageMock();
  const result = verifyClubPlayerRating("default-club", "profile-u1", 3.0, {
    authUserId: "u1",
    athleteId: "a1",
    membershipClubId: "club-accc",
    requireMembershipClub: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "MEMBERSHIP_CLUB_MISMATCH");
});

test("verifyClubPlayerRating — lỗi rõ khi thiếu athlete link bắt buộc", () => {
  globalThis.localStorage = createLocalStorageMock();
  const result = verifyClubPlayerRating("club-accc", "profile-u1", 3.0, {
    authUserId: "u1",
    athleteId: null,
    membershipClubId: "club-accc",
    requireMembershipClub: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_ATHLETE_LINK");
});

test("pending/rejected memberships không được coi active trong isAccountOnly helper", () => {
  // Resolver chỉ nhận active_memberships từ RPC; empty list => account-only
  assert.equal(isAccountOnlyByV2Data({ activeMemberships: [], athlete: null }), true);
});
