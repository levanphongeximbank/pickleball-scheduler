import test from "node:test";
import assert from "node:assert/strict";

import * as playerPublicApi from "../src/features/player/index.js";
import {
  RESOLUTION_OUTCOME,
  resolveByAuthUser,
  resolveCanonicalPlayerId,
  getPlayerProfile,
  normalizePlayerProfile,
  searchPlayers,
  updatePlayerProfile,
} from "../src/features/player/index.js";

import { createMemoryPlayerProfileWriteRepository } from "../src/features/player/repositories/playerProfileWriteRepository.js";
import { DEFAULT_PRIVACY_SETTINGS } from "../src/features/player/constants/privacy.js";
import { deriveAgeGroup } from "../src/features/player/utils/birthDate.js";
import { buildDerivedAuthPlayerId } from "../src/features/club/repositories/index.js";

function directory(map) {
  const store = new Map(Object.entries(map));
  return (playerId) => {
    const id = String(playerId || "").trim();
    if (!id) return null;
    return store.has(id) ? store.get(id) : null;
  };
}

const APPROVED_EXPORTS = [
  "RESOLUTION_OUTCOME",
  "getPlayerProfile",
  "normalizePlayerProfile",
  "resolveByAuthUser",
  "resolveCanonicalPlayerId",
  "searchPlayers",
  "updatePlayerProfile",
];

test("1C public API — Phase 1B contracts + updatePlayerProfile only", () => {
  assert.deepEqual(Object.keys(playerPublicApi).sort(), [...APPROVED_EXPORTS].sort());
});

test("1C field normalization — handedness, region, privacy, verification", () => {
  const profile = normalizePlayerProfile(
    {
      playerId: "p1",
      gender: "Nam",
      handedness: "Tay phải",
      activityRegion: { countryCode: "VN", provinceName: "Hà Nội", city: "Cầu Giấy" },
      verificationStatus: "pending",
      privacySettings: { showPhone: true },
      birthDate: "2000-05-10",
    },
    { referenceDate: "2026-07-18" }
  );
  assert.equal(profile.gender, "male");
  assert.equal(profile.handedness, "right");
  assert.equal(profile.activityRegion.countryCode, "VN");
  assert.equal(profile.activityRegion.provinceName, "Hà Nội");
  assert.equal(profile.verificationStatus, "pending");
  assert.equal(profile.privacySettings.showPhone, true);
  assert.equal(profile.privacySettings.showEmail, false);
  assert.equal(profile.birthDate, "2000-05-10");
  assert.equal(profile.birthYear, 2000);
  assert.equal(profile.ageGroup, "Open");
});

test("1C valid birthDate", () => {
  const p = normalizePlayerProfile({ birthDate: "1999-02-28" });
  assert.equal(p.birthDate, "1999-02-28");
  assert.equal(p.birthYear, 1999);
});

test("1C invalid and future birthDate rejected on write", async () => {
  const repo = createMemoryPlayerProfileWriteRepository({
    "player-1": { playerId: "player-1", displayName: "A" },
  });
  const findPlayerById = directory({ "player-1": { id: "player-1", name: "A" } });

  const badFormat = await updatePlayerProfile(
    "player-1",
    { birthDate: "99-01-01" },
    { findPlayerById, writeRepository: repo }
  );
  assert.equal(badFormat.ok, false);
  assert.ok(badFormat.errors.some((e) => e.code === "INVALID_BIRTH_DATE_FORMAT"));

  const impossible = await updatePlayerProfile(
    "player-1",
    { birthDate: "2023-02-30" },
    { findPlayerById, writeRepository: repo }
  );
  assert.equal(impossible.ok, false);
  assert.ok(impossible.errors.some((e) => e.code === "IMPOSSIBLE_BIRTH_DATE"));

  const future = await updatePlayerProfile(
    "player-1",
    { birthDate: "2099-01-01" },
    { findPlayerById, writeRepository: repo, referenceDate: "2026-07-18" }
  );
  assert.equal(future.ok, false);
  assert.ok(future.errors.some((e) => e.code === "FUTURE_BIRTH_DATE"));
});

test("1C birthDate/birthYear conflict", async () => {
  const repo = createMemoryPlayerProfileWriteRepository({
    "player-1": { playerId: "player-1" },
  });
  const result = await updatePlayerProfile(
    "player-1",
    { birthDate: "2000-01-01", birthYear: 1999 },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
    }
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === "BIRTH_DATE_YEAR_CONFLICT"));
});

test("1C birthYear alone does not invent birthDate", () => {
  const p = normalizePlayerProfile({ birthYear: 2001 });
  assert.equal(p.birthYear, 2001);
  assert.equal(p.birthDate, null);
});

test("1C ageGroup derivation", () => {
  assert.equal(
    deriveAgeGroup({ birthDate: "2016-01-01", referenceDate: "2026-07-18" }),
    "U12"
  );
  assert.equal(
    deriveAgeGroup({ birthDate: "2010-01-01", referenceDate: "2026-07-18" }),
    "U18"
  );
  assert.equal(
    deriveAgeGroup({ birthYear: 2000, referenceDate: "2026-07-18" }),
    "Open"
  );
  assert.equal(deriveAgeGroup({}), null);
});

test("1C handedness normalization", () => {
  assert.equal(normalizePlayerProfile({ handedness: "left" }).handedness, "left");
  assert.equal(normalizePlayerProfile({ handedness: "RH" }).handedness, "right");
  assert.equal(normalizePlayerProfile({ handedness: "ambidextrous" }).handedness, "ambidextrous");
});

test("1C activityRegion normalization", () => {
  const p = normalizePlayerProfile({
    activityRegion: { country_code: "VN", province_code: "HN", city: "Hanoi" },
  });
  assert.equal(p.activityRegion.countryCode, "VN");
  assert.equal(p.activityRegion.provinceCode, "HN");
  assert.equal(p.activityRegion.city, "Hanoi");
});

test("1C privacy fail-closed defaults", () => {
  const p = normalizePlayerProfile({ privacySettings: {} });
  assert.equal(p.privacySettings.publicProfileEnabled, false);
  assert.equal(p.privacySettings.showPhone, false);
  assert.equal(p.privacySettings.showEmail, false);
  assert.equal(p.privacySettings.showBirthDate, false);
  assert.equal(p.privacySettings.showBirthYear, false);
  assert.equal(p.privacySettings.showActivityRegion, false);
  assert.equal(p.privacySettings.showClubMemberships, false);
  assert.equal(DEFAULT_PRIVACY_SETTINGS.showPhone, false);
});

test("1C identity verification is forbidden on normal updatePlayerProfile", async () => {
  const repo = createMemoryPlayerProfileWriteRepository({
    "player-1": { playerId: "player-1" },
  });
  const findPlayerById = directory({ "player-1": { id: "player-1" } });

  const forbidden = await updatePlayerProfile(
    "player-1",
    { verificationStatus: "verified" },
    { findPlayerById, writeRepository: repo }
  );
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.code, "FORBIDDEN_FIELD");
  assert.ok(forbidden.forbiddenFields.includes("verificationStatus"));

  const snakeAlias = await updatePlayerProfile(
    "player-1",
    { identity_verification_status: "pending" },
    { findPlayerById, writeRepository: repo }
  );
  assert.equal(snakeAlias.ok, false);
  assert.equal(snakeAlias.code, "FORBIDDEN_FIELD");

  const ratingStatus = await updatePlayerProfile(
    "player-1",
    { verificationStatus: "provisional" },
    { findPlayerById, writeRepository: repo }
  );
  assert.equal(ratingStatus.ok, false);
  assert.equal(ratingStatus.code, "FORBIDDEN_FIELD");
});

test("1C successful write through single write service", async () => {
  const repo = createMemoryPlayerProfileWriteRepository({
    "player-1": { playerId: "player-1", displayName: "Lan" },
  });
  const result = await updatePlayerProfile(
    "player-1",
    {
      handedness: "left",
      birthDate: "2002-03-04",
      activityRegion: { countryCode: "VN", provinceName: "Đà Nẵng" },
      privacySettings: { showBirthYear: true },
    },
    {
      findPlayerById: directory({ "player-1": { id: "player-1", name: "Lan" } }),
      writeRepository: repo,
      referenceDate: "2026-07-18",
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.durable, false);
  assert.equal(result.playerId, "player-1");
  assert.equal(result.profile.handedness, "left");
  assert.equal(result.profile.birthDate, "2002-03-04");
  assert.equal(result.profile.birthYear, 2002);
  assert.equal(result.profile.privacySettings.showBirthYear, true);
  assert.equal(result.profile.privacySettings.showPhone, false);
});

test("1C default write path is unconfigured when Supabase is not available", async () => {
  const { createDefaultPlayerProfileWriteRepository } = await import(
    "../src/features/player/bootstrap/playerProfileWriteBootstrap.js"
  );
  const defaultRepo = createDefaultPlayerProfileWriteRepository({
    hasConfig: () => false,
    getClient: () => null,
  });
  assert.equal(defaultRepo.kind, "unconfigured");

  const result = await updatePlayerProfile(
    "player-1",
    { handedness: "right" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: defaultRepo,
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "PERSISTENCE_NOT_CONFIGURED");
  assert.equal(result.durable, false);
  assert.equal(result.migrationRequired, true);
});

test("1C write rejects non-owned fields", async () => {
  const repo = createMemoryPlayerProfileWriteRepository({
    "player-1": { playerId: "player-1" },
  });
  const result = await updatePlayerProfile(
    "player-1",
    { accountStatus: "suspended", rating: 4.5, role: "ADMIN" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "FORBIDDEN_FIELD");
  assert.ok(result.forbiddenFields.includes("accountStatus"));
});

test("1C write rejects empty patch", async () => {
  const result = await updatePlayerProfile(
    "player-1",
    {},
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: createMemoryPlayerProfileWriteRepository({
        "player-1": { playerId: "player-1" },
      }),
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "EMPTY_PATCH");
});

test("1C INVALID resolution rejection", async () => {
  const result = await updatePlayerProfile("", { handedness: "right" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "PLAYER_ID_REQUIRED");
});

test("1C UNMAPPED resolution rejection", async () => {
  const result = await updatePlayerProfile(
    "missing-player",
    { handedness: "right" },
    {
      findPlayerById: directory({}),
      writeRepository: createMemoryPlayerProfileWriteRepository(),
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNMAPPED_IDENTITY");
});

test("1C AMBIGUOUS resolution rejection", async () => {
  const authUserId = "auth-amb";
  const derived = buildDerivedAuthPlayerId(authUserId);
  const result = await updatePlayerProfile(
    derived,
    { handedness: "right" },
    {
      profile: { id: authUserId, player_id: "other-player" },
      findPlayerById: directory({
        [derived]: { id: derived },
        "other-player": { id: "other-player" },
      }),
      candidatePlayerIds: [derived, "other-player"],
      writeRepository: createMemoryPlayerProfileWriteRepository(),
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "AMBIGUOUS_IDENTITY");
  assert.equal(result.profile, null);
});

test("1C no duplicate identity creation — write keeps resolved playerId", async () => {
  const repo = createMemoryPlayerProfileWriteRepository({
    "player-1": { playerId: "player-1", displayName: "A" },
  });
  const result = await updatePlayerProfile(
    "player-1",
    { displayName: "A2", playerId: "player-OTHER" },
    {
      findPlayerById: directory({ "player-1": { id: "player-1" } }),
      writeRepository: repo,
    }
  );
  // playerId in patch is forbidden
  assert.equal(result.ok, false);
  assert.equal(result.code, "FORBIDDEN_FIELD");
});

test("1C Phase 1B read compatibility still works", () => {
  assert.equal(resolveByAuthUser("").outcome, RESOLUTION_OUTCOME.INVALID);
  const mapped = resolveByAuthUser("u1", {
    profile: { id: "u1", player_id: "p1" },
    findPlayerById: directory({ p1: { id: "p1", name: "X" } }),
  });
  assert.equal(mapped.outcome, RESOLUTION_OUTCOME.MAPPED);
  assert.equal(typeof getPlayerProfile, "function");
  assert.equal(typeof searchPlayers, "function");
  assert.equal(typeof resolveCanonicalPlayerId, "function");
  assert.equal(typeof normalizePlayerProfile, "function");
});
