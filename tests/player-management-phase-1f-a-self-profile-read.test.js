/**
 * Phase 1F-A — Authenticated self profile read surface (canonical path).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  getAuthenticatedSelfPlayerProfile,
  SELF_PLAYER_PROFILE_READ_STATUS,
  getPlayerProfileByAuthUser,
  buildSelfFoundationFieldView,
  formatBirthDateDisplay,
  formatBirthYearDisplay,
  formatHandednessDisplay,
  formatActivityRegionDisplay,
  formatVerificationStatusDisplay,
  formatPrivacySettingsDisplay,
  UNKNOWN_LABEL,
  RESOLUTION_OUTCOME,
} from "../src/features/player/index.js";
import { buildDerivedAuthPlayerId } from "../src/features/club/repositories/canonicalRepositoryTypes.js";
import { DEFAULT_PRIVACY_SETTINGS } from "../src/features/player/constants/privacy.js";

const AUTH_ID = "auth-self-1f-a";
const PLAYER_ID = "player-self-1f-a";

function baseProfileRow(overrides = {}) {
  return {
    id: AUTH_ID,
    player_id: PLAYER_ID,
    display_name: "Lan",
    email: "lan@example.com",
    phone: "0900000000",
    gender: "female",
    birth_year: 1995,
    birth_date: "1995-04-12",
    handedness: "left",
    activity_region: {
      countryCode: "VN",
      provinceName: "Hà Nội",
      city: "Cầu Giấy",
      district: null,
      provinceCode: null,
    },
    privacy_settings: { ...DEFAULT_PRIVACY_SETTINGS, showGender: true },
    identity_verification_status: "verified",
    status: "active",
    ...overrides,
  };
}

test("1F-A public exports include authenticated self read helpers", async () => {
  const api = await import("../src/features/player/index.js");
  for (const key of [
    "getAuthenticatedSelfPlayerProfile",
    "SELF_PLAYER_PROFILE_READ_STATUS",
    "getPlayerProfileByAuthUser",
    "buildSelfFoundationFieldView",
    "formatVerificationStatusDisplay",
  ]) {
    assert.ok(key in api, `missing export ${key}`);
  }
});

test("1F-A unauthorized when auth user missing", async () => {
  const result = await getAuthenticatedSelfPlayerProfile({
    authUserId: "",
    loadProfileByUserId: async () => {
      throw new Error("should not load");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, SELF_PLAYER_PROFILE_READ_STATUS.UNAUTHORIZED);
  assert.equal(result.code, "UNAUTHORIZED");
});

test("1F-A profile not found", async () => {
  const result = await getAuthenticatedSelfPlayerProfile({
    authUserId: AUTH_ID,
    loadProfileByUserId: async () => ({
      ok: false,
      code: "PROFILE_NOT_FOUND",
      error: "Không tìm thấy profile.",
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, SELF_PLAYER_PROFILE_READ_STATUS.PROFILE_NOT_FOUND);
});

test("1F-A read error on fetch failure", async () => {
  const result = await getAuthenticatedSelfPlayerProfile({
    authUserId: AUTH_ID,
    loadProfileByUserId: async () => ({
      ok: false,
      code: "PROFILE_FETCH_FAILED",
      error: "network",
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, SELF_PLAYER_PROFILE_READ_STATUS.READ_ERROR);
  assert.match(result.message, /network/i);
});

test("1F-A loaded — all six foundation fields via canonical getPlayerProfileByAuthUser", async () => {
  const row = baseProfileRow();
  const result = await getAuthenticatedSelfPlayerProfile({
    authUserId: AUTH_ID,
    requirePlayerRow: false,
    loadProfileByUserId: async () => ({ ok: true, profile: row, user: { id: AUTH_ID } }),
    findPlayerById: () => undefined,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, SELF_PLAYER_PROFILE_READ_STATUS.LOADED);
  assert.equal(result.outcome, RESOLUTION_OUTCOME.MAPPED);
  assert.equal(result.playerId, PLAYER_ID);
  assert.equal(result.profile.birthYear, 1995);
  assert.equal(result.profile.birthDate, "1995-04-12");
  assert.equal(result.profile.handedness, "left");
  assert.equal(result.profile.activityRegion.provinceName, "Hà Nội");
  assert.ok(result.profile.privacySettings);
  assert.equal(result.profile.verificationStatus, "verified");

  // Same path as facade convenience
  const direct = getPlayerProfileByAuthUser(AUTH_ID, {
    profile: row,
    requirePlayerRow: false,
    findPlayerById: () => undefined,
  });
  assert.equal(direct.outcome, RESOLUTION_OUTCOME.MAPPED);
  assert.equal(direct.profile.verificationStatus, "verified");
});

test("1F-A null/unknown foundation values normalize safely", async () => {
  const result = await getAuthenticatedSelfPlayerProfile({
    authUserId: AUTH_ID,
    loadProfileByUserId: async () => ({
      ok: true,
      profile: baseProfileRow({
        birth_year: null,
        birth_date: null,
        handedness: null,
        activity_region: null,
        privacy_settings: null,
        identity_verification_status: "unverified",
      }),
      user: { id: AUTH_ID },
    }),
    findPlayerById: () => undefined,
  });

  assert.equal(result.ok, true);
  assert.equal(result.profile.birthYear, null);
  assert.equal(result.profile.birthDate, null);
  assert.equal(result.profile.handedness, null);
  assert.equal(result.profile.activityRegion, null);
  assert.equal(result.profile.privacySettings, null);
  assert.equal(result.profile.verificationStatus, "unverified");

  const view = buildSelfFoundationFieldView(result.profile);
  assert.equal(view.birthYear.label, UNKNOWN_LABEL);
  assert.equal(view.birthDate.label, UNKNOWN_LABEL);
  assert.equal(view.handedness.label, UNKNOWN_LABEL);
  assert.equal(view.activityRegion.label, UNKNOWN_LABEL);
  assert.equal(view.privacySettings.label, UNKNOWN_LABEL);
  assert.equal(view.identityVerificationStatus.label, "Chưa xác minh");
  assert.equal(view.identityVerificationStatus.readOnly, true);
});

test("1F-A derived cloud identity without blob still loads profile fields", async () => {
  const derived = buildDerivedAuthPlayerId(AUTH_ID);
  const result = await getAuthenticatedSelfPlayerProfile({
    authUserId: AUTH_ID,
    loadProfileByUserId: async () => ({
      ok: true,
      profile: baseProfileRow({
        player_id: null,
        birth_year: 2001,
        birth_date: null,
      }),
      user: { id: AUTH_ID },
    }),
    findPlayerById: () => undefined,
  });
  assert.equal(result.ok, true);
  assert.equal(result.outcome, RESOLUTION_OUTCOME.DERIVED);
  assert.equal(result.playerId, derived);
  assert.equal(result.profile.birthYear, 2001);
});

test("1F-A refuses foreign profile row id", async () => {
  const result = await getAuthenticatedSelfPlayerProfile({
    authUserId: AUTH_ID,
    loadProfileByUserId: async () => ({
      ok: true,
      profile: baseProfileRow({ id: "someone-else" }),
      user: { id: "someone-else" },
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, SELF_PLAYER_PROFILE_READ_STATUS.UNAUTHORIZED);
  assert.equal(result.code, "FORBIDDEN");
});

test("1F-A display labels never leak raw DB tokens for known enums", () => {
  assert.equal(formatBirthYearDisplay(1990), "1990");
  assert.equal(formatBirthDateDisplay("1990-01-02"), "02/01/1990");
  assert.equal(formatHandednessDisplay("right"), "Tay phải");
  assert.equal(formatHandednessDisplay("left"), "Tay trái");
  assert.equal(
    formatActivityRegionDisplay({ provinceName: "Đà Nẵng", city: null }),
    "Đà Nẵng"
  );
  assert.equal(formatVerificationStatusDisplay("pending"), "Đang chờ xác minh");
  assert.equal(formatVerificationStatusDisplay("verified"), "Đã xác minh");
  assert.doesNotMatch(formatVerificationStatusDisplay("verified"), /identity_verification/i);

  const privacy = formatPrivacySettingsDisplay({
    ...DEFAULT_PRIVACY_SETTINGS,
    publicProfileEnabled: false,
  });
  assert.match(privacy.summary, /tắt/i);
  assert.ok(privacy.flags.some((f) => f.key === "showPhone" && f.enabled === false));
});

test("1F-A verification field view is always read-only", () => {
  const view = buildSelfFoundationFieldView({
    verificationStatus: "pending",
    birthYear: 1999,
  });
  assert.equal(view.identityVerificationStatus.readOnly, true);
  assert.equal(view.identityVerificationStatus.label, "Đang chờ xác minh");
});
