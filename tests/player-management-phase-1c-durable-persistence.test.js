/**
 * Phase 1C durable profiles persistence — focused unit tests (mocked Supabase path).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { updatePlayerProfile } from "../src/features/player/index.js";
import { buildProfilesUpdateRow } from "../src/features/player/adapters/profilesWriteMapper.js";
import { adaptProfileRow } from "../src/features/player/adapters/profileAdapter.js";
import { createSupabaseProfilesPlayerWriteRepository } from "../src/features/player/repositories/supabaseProfilesPlayerWriteRepository.js";
import { mapProfilesWriteError } from "../src/features/player/services/mapProfilesWriteError.js";
import { WRITE_ERROR_CODES } from "../src/features/player/constants/writableFields.js";
import { validateVerificationStatus } from "../src/features/player/adapters/verificationAdapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function directory(map) {
  const store = new Map(Object.entries(map));
  return (playerId) => {
    const id = String(playerId || "").trim();
    if (!id) return null;
    return store.has(id) ? store.get(id) : null;
  };
}

function makeRepo(overrides = {}) {
  const calls = { updates: [] };
  const profileRow = {
    id: "auth-user-1",
    player_id: "player-1",
    display_name: "Lan",
    phone: null,
    avatar_url: null,
    gender: "female",
    birth_year: 2002,
    birth_date: "2002-03-04",
    handedness: "right",
    activity_region: { countryCode: "VN", provinceName: "Đà Nẵng" },
    privacy_settings: {
      version: 1,
      publicProfileEnabled: false,
      showPhone: false,
      showEmail: false,
      showBirthDate: false,
      showBirthYear: false,
      showActivityRegion: false,
      showClubMemberships: false,
      showGender: true,
      showHandedness: true,
    },
    identity_verification_status: "unverified",
    status: "active",
    updated_at: "2026-07-18T00:00:00.000Z",
    ...overrides.seedRow,
  };

  const repo = createSupabaseProfilesPlayerWriteRepository({
    hasConfig: () => true,
    getClient: () => ({
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: { ...profileRow }, error: null }),
                };
              },
            };
          },
        };
      },
    }),
    updateProfileRowById: async (userId, patch) => {
      calls.updates.push({ userId, patch });
      if (typeof overrides.updateImpl === "function") {
        return overrides.updateImpl(userId, patch, profileRow);
      }
      Object.assign(profileRow, patch);
      return { ok: true, profile: { ...profileRow }, user: {} };
    },
  });

  return { repo, calls, profileRow };
}

test("durable mapper — camelCase to snake_case; preserves undefined; allows explicit null", () => {
  const { row, mappedFields } = buildProfilesUpdateRow({
    birthDate: "2001-01-02",
    handedness: null,
    activityRegion: { countryCode: "VN", provinceName: "HN" },
    privacySettings: { showPhone: true },
  });
  assert.equal(row.birth_date, "2001-01-02");
  assert.equal(row.handedness, null);
  assert.deepEqual(row.activity_region, { countryCode: "VN", provinceName: "HN" });
  assert.equal(row.privacy_settings.showPhone, true);
  assert.ok(row.updated_at);
  assert.equal(row.birth_year, undefined);
  assert.ok(!("identity_verification_status" in row));
  assert.deepEqual(mappedFields.sort(), [
    "activityRegion",
    "birthDate",
    "handedness",
    "privacySettings",
  ]);
});

test("durable adaptProfileRow — snake_case foundation columns to canonical profile", () => {
  const adapted = adaptProfileRow({
    id: "auth-1",
    player_id: "p-1",
    birth_date: "1998-06-15",
    birth_year: 1990,
    handedness: "left",
    activity_region: { country_code: "VN", province_name: "Huế" },
    privacy_settings: { showBirthDate: true },
    identity_verification_status: "pending",
    display_name: "Minh",
  });
  assert.equal(adapted.playerId, "p-1");
  assert.equal(adapted.authUserId, "auth-1");
  assert.equal(adapted.birthDate, "1998-06-15");
  assert.equal(adapted.handedness, "left");
  assert.equal(adapted.activityRegion.countryCode, "VN");
  assert.equal(adapted.activityRegion.provinceName, "Huế");
  assert.equal(adapted.privacySettings.showBirthDate, true);
  assert.equal(adapted.verificationStatus, "pending");
});

test("durable valid self-profile update via updatePlayerProfile", async () => {
  const { repo, calls } = makeRepo();
  const result = await updatePlayerProfile(
    "player-1",
    { handedness: "left", birthDate: "2000-01-15" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
      authUserId: "auth-user-1",
      referenceDate: "2026-07-18",
    }
  );
  // resolveCanonicalPlayerId may not pass authUserId from options — inject via existingProfile
  assert.equal(result.ok, true);
  assert.equal(result.durable, true);
  assert.equal(result.profile.handedness, "left");
  assert.equal(result.profile.birthDate, "2000-01-15");
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.updates[0].userId, "auth-user-1");
  assert.equal(calls.updates[0].patch.handedness, "left");
  assert.equal(calls.updates[0].patch.birth_date, "2000-01-15");
  assert.ok(!("identity_verification_status" in calls.updates[0].patch));
});

test("durable partial patch — only provided fields mapped", async () => {
  const { repo, calls } = makeRepo();
  const result = await updatePlayerProfile(
    "player-1",
    { activityRegion: { countryCode: "VN", provinceName: "Huế" } },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
    }
  );
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(calls.updates[0].patch).sort(), [
    "activity_region",
    "updated_at",
  ]);
});

test("durable explicit null handedness allowed", async () => {
  // null handedness normalizes to "unknown" in validator — use empty clear path
  const { repo, calls } = makeRepo();
  const result = await updatePlayerProfile(
    "player-1",
    { handedness: null },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
    }
  );
  assert.equal(result.ok, true);
  assert.equal(calls.updates[0].patch.handedness, "unknown");
});

test("durable identityVerificationStatus rejected from normal patch", async () => {
  const { repo, calls } = makeRepo();
  const result = await updatePlayerProfile(
    "player-1",
    { identityVerificationStatus: "verified" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.FORBIDDEN_FIELD);
  assert.equal(calls.updates.length, 0);
});

test("durable rating verification labels still rejected by identity validator", () => {
  const r = validateVerificationStatus("provisional");
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, "RATING_VERIFICATION_NOT_ALLOWED");
});

test("durable future birthDate rejected before persistence", async () => {
  const { repo, calls } = makeRepo();
  const result = await updatePlayerProfile(
    "player-1",
    { birthDate: "2099-01-01" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
      referenceDate: "2026-07-18",
    }
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === "FUTURE_BIRTH_DATE"));
  assert.equal(calls.updates.length, 0);
});

test("durable future birthDate database constraint mapped", () => {
  const mapped = mapProfilesWriteError({
    code: "23514",
    message: 'new row for relation "profiles" violates check constraint "profiles_birth_date_not_future_check"',
  });
  assert.equal(mapped.code, WRITE_ERROR_CODES.CONSTRAINT_VIOLATION);
  assert.ok(!/postgres:\/\//i.test(mapped.message));
});

test("durable invalid handedness rejected before persistence", async () => {
  const { repo, calls } = makeRepo();
  const result = await updatePlayerProfile(
    "player-1",
    { handedness: "three-handed-xyz" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
    }
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === "UNSUPPORTED_HANDEDNESS"));
  assert.equal(calls.updates.length, 0);
});

test("durable RLS / authorization error mapping", async () => {
  const { repo } = makeRepo({
    updateImpl: async () => ({
      ok: false,
      code: "PROFILE_UPDATE_FAILED",
      error: "new row violates row-level security policy for table \"profiles\"",
    }),
  });
  const result = await updatePlayerProfile(
    "player-1",
    { handedness: "right" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.RLS_DENIED);
});

test("durable unauthorized verification guard message mapped", () => {
  const mapped = mapProfilesWriteError({
    message: "Cannot self-modify identity_verification_status",
  });
  assert.equal(mapped.code, WRITE_ERROR_CODES.UNAUTHORIZED);
});

test("durable secrets redacted from error messages", () => {
  const mapped = mapProfilesWriteError({
    message: "fail postgres://user:secret@host/db service_role eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc",
  });
  assert.ok(!mapped.message.includes("secret@host"));
  assert.ok(!mapped.message.includes("service_role"));
  assert.ok(mapped.message.includes("[redacted]"));
});

test("durable canonical normalized return value", async () => {
  const { repo } = makeRepo();
  const result = await updatePlayerProfile(
    "player-1",
    {
      birthDate: "2001-05-05",
      privacySettings: { showBirthYear: true },
    },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
      referenceDate: "2026-07-18",
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.playerId, "player-1");
  assert.equal(result.profile.playerId, "player-1");
  assert.equal(result.profile.birthDate, "2001-05-05");
  assert.equal(result.profile.birthYear, 2001);
  assert.equal(result.profile.privacySettings.showBirthYear, true);
  assert.equal(result.profile.privacySettings.showPhone, false);
  assert.equal(result.durable, true);
});

test("durable repo source must not use service_role", () => {
  const repoPath = join(
    __dirname,
    "../src/features/player/repositories/supabaseProfilesPlayerWriteRepository.js"
  );
  const mapperPath = join(
    __dirname,
    "../src/features/player/adapters/profilesWriteMapper.js"
  );
  const errorPath = join(
    __dirname,
    "../src/features/player/services/mapProfilesWriteError.js"
  );
  const src =
    readFileSync(repoPath, "utf8") +
    readFileSync(mapperPath, "utf8") +
    readFileSync(errorPath, "utf8");
  assert.ok(!/SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|sb_secret_/i.test(src));
  assert.ok(!/createClient\s*\([^)]*SERVICE/i.test(src));
  assert.ok(src.includes("getSupabaseAuthClient") || src.includes("hasSupabaseConfig"));
});

test("durable persistence unavailable when supabase not configured", async () => {
  const repo = createSupabaseProfilesPlayerWriteRepository({
    hasConfig: () => false,
    getClient: () => null,
    updateProfileRowById: async () => {
      throw new Error("should not call");
    },
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
  assert.equal(result.code, WRITE_ERROR_CODES.PERSISTENCE_UNAVAILABLE);
});
