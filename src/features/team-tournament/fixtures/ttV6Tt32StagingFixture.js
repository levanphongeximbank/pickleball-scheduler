/**
 * STAGING-ONLY Team Tournament V6 TT32 QA fixture (32 athletes → 8 MLP teams).
 * Deterministic IDs / emails / keys. Never apply to Production.
 */

export const TT_V6_TT32_STAGING_REF = "qyewbxjsiiyufanzcjcq";
export const TT_V6_TT32_PRODUCTION_REF = "expuvcohlcjzvrrauvud";

export const TT_V6_TT32_FIXTURE = Object.freeze({
  clubId: "club-test-tt32-qa",
  clubName: "CLB TEST TT32",
  clubCode: "TESTTT32",
  tenantId: "venue-staging-a",
  marker: "QA|TT-V6|TT32",
  description:
    "STAGING QA FIXTURE — QA|TT-V6|TT32 — Team Tournament V6 32-athlete group-draw pool (not customer data).",
  teamNamePrefix: "TT32-ĐỘI-",
  teamCount: 8,
  athletesPerTeam: 4,
});

/** Deterministic UUID helpers (fixed hex; version=4, variant=8). */
function uuid(prefix, n) {
  const suffix = String(n).padStart(12, "0");
  return `${prefix}-7e57-4000-8000-${suffix}`;
}

export function ttV6Tt32UserId(n) {
  return uuid("b0000000", n);
}
export function ttV6Tt32AthleteId(n) {
  return uuid("b1000000", n);
}
export function ttV6Tt32MemberId(n) {
  return uuid("b2000000", n);
}

/** Balanced Pick_VN rating ladder used for both genders. */
export const TT_V6_TT32_RATINGS = Object.freeze([
  4.5, 4.4, 4.3, 4.2, 4.1, 4.0, 3.9, 3.8, 3.7, 3.6, 3.5, 3.4, 3.3, 3.2, 3.1, 3.0,
]);

/**
 * @param {'male'|'female'} gender
 * @param {number} index1Based 1..16
 */
function buildAthlete(gender, index1Based) {
  const isMale = gender === "male";
  const n = isMale ? index1Based : 16 + index1Based;
  const label = String(index1Based).padStart(2, "0");
  const key = isMale ? `TT32-NAM-${label}` : `TT32-NU-${label}`;
  const emailLocal = isMale ? `tt32.nam${label}` : `tt32.nu${label}`;
  return Object.freeze({
    n,
    key,
    displayName: key,
    gender,
    rating: TT_V6_TT32_RATINGS[index1Based - 1],
    email: `${emailLocal}@staging.local`,
    playerId: `qa-tt32-${isMale ? "nam" : "nu"}-${label}`,
    bucket: "tt32",
  });
}

export const TT_V6_TT32_MALE_ATHLETES = Object.freeze(
  Array.from({ length: 16 }, (_, i) => buildAthlete("male", i + 1))
);

export const TT_V6_TT32_FEMALE_ATHLETES = Object.freeze(
  Array.from({ length: 16 }, (_, i) => buildAthlete("female", i + 1))
);

export const TT_V6_TT32_ATHLETES = Object.freeze([
  ...TT_V6_TT32_MALE_ATHLETES,
  ...TT_V6_TT32_FEMALE_ATHLETES,
]);

export function ttV6Tt32PhoneMarker(row) {
  return `${TT_V6_TT32_FIXTURE.marker}|${row.key}|CORE|`;
}
