/**
 * STAGING-ONLY — Player Management Phase 1J-A directory fixture pack.
 * Deterministic IDs / player_ids / emails. Never apply to Production.
 */

export const PM_1J_A_STAGING_REF = "qyewbxjsiiyufanzcjcq";
export const PM_1J_A_PRODUCTION_REF = "expuvcohlcjzvrrauvud";

export const PM_1J_A_FIXTURE = Object.freeze({
  marker: "QA|PM-1J-A|DIR-FIXTURE",
  namespace: "pm1ja",
  tenantId: "venue-staging-a",
  playerIdPrefix: "qa-pm1ja-",
  verifierEmail: "player@staging.local",
  evidenceDir: "docs/player-management/phase-1j/evidence",
});

export const PM_1J_A_ROLES = Object.freeze({
  ELIGIBLE: "eligible",
  HIDDEN: "hidden",
  SUSPENDED: "suspended",
  UNVERIFIED: "unverified",
  MASKED: "masked",
});

/** Deterministic UUID helpers (fixed hex; version=4, variant=8). */
function uuid(prefix, n) {
  const suffix = String(n).padStart(12, "0");
  return `${prefix}-7e57-4000-8000-${suffix}`;
}

export function pm1jAUserId(n) {
  return uuid("c7000000", n);
}

export function assertStagingProjectRef(url) {
  const ref = new URL(url).hostname.split(".")[0];
  if (ref === PM_1J_A_PRODUCTION_REF) {
    throw new Error("REFUSING Production — Phase 1J-A fixtures are Staging-only.");
  }
  if (ref !== PM_1J_A_STAGING_REF) {
    throw new Error(`Refusing unexpected ref ${ref}; expected ${PM_1J_A_STAGING_REF}`);
  }
  return ref;
}

function privacyBase(overrides = {}) {
  return {
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
    ...overrides,
  };
}

/**
 * @param {string} role
 * @param {number} n
 */
function buildFixtureRow(role, n) {
  const key = `PM1JA-${role.toUpperCase()}`;
  const playerId = `${PM_1J_A_FIXTURE.playerIdPrefix}${role}`;
  const email = `pm1ja.${role}@staging.local`;
  const displayNameByRole = {
    eligible: "PM1JA Eligible Public Athlete",
    hidden: "PM1JA Hidden Athlete",
    suspended: "PM1JA Suspended Athlete",
    unverified: "PM1JA Unverified Athlete",
    masked: "PM1JA Masked Privacy Athlete",
  };

  const commonProfile = {
    gender: "female",
    handedness: "right",
    activity_region: {
      provinceName: "Hà Nội",
      city: "Cầu Giấy",
      countryCode: "VN",
    },
    avatar_url: "https://cdn.example/pm1ja-avatar.png",
  };

  const byRole = {
    eligible: {
      status: "active",
      identity_verification_status: "verified",
      privacy_settings: privacyBase({
        publicProfileEnabled: true,
        showActivityRegion: true,
        showGender: true,
        showHandedness: true,
      }),
      directoryExpectation: "visible",
    },
    hidden: {
      status: "active",
      identity_verification_status: "verified",
      privacy_settings: privacyBase({ publicProfileEnabled: false }),
      directoryExpectation: "excluded",
    },
    suspended: {
      status: "suspended",
      identity_verification_status: "verified",
      privacy_settings: privacyBase({
        publicProfileEnabled: true,
        showActivityRegion: true,
        showGender: true,
        showHandedness: true,
      }),
      directoryExpectation: "excluded",
    },
    unverified: {
      status: "active",
      identity_verification_status: "unverified",
      privacy_settings: privacyBase({
        publicProfileEnabled: true,
        showActivityRegion: true,
        showGender: true,
        showHandedness: true,
      }),
      directoryExpectation: "excluded",
    },
    masked: {
      status: "active",
      identity_verification_status: "verified",
      privacy_settings: privacyBase({
        publicProfileEnabled: true,
        showActivityRegion: false,
        showGender: false,
        showHandedness: false,
      }),
      directoryExpectation: "visible_masked",
    },
  };

  const roleConfig = byRole[role];
  if (!roleConfig) {
    throw new Error(`Unknown fixture role: ${role}`);
  }

  return Object.freeze({
    n,
    role,
    key,
    userId: pm1jAUserId(n),
    email,
    playerId,
    displayName: displayNameByRole[role],
    roleLabel: "PLAYER",
    fixtureMarker: PM_1J_A_FIXTURE.marker,
    directoryExpectation: roleConfig.directoryExpectation,
    profile: {
      ...commonProfile,
      status: roleConfig.status,
      identity_verification_status: roleConfig.identity_verification_status,
      privacy_settings: roleConfig.privacy_settings,
    },
  });
}

export const PM_1J_A_FIXTURE_ROWS = Object.freeze([
  buildFixtureRow(PM_1J_A_ROLES.ELIGIBLE, 1),
  buildFixtureRow(PM_1J_A_ROLES.HIDDEN, 2),
  buildFixtureRow(PM_1J_A_ROLES.SUSPENDED, 3),
  buildFixtureRow(PM_1J_A_ROLES.UNVERIFIED, 4),
  buildFixtureRow(PM_1J_A_ROLES.MASKED, 5),
]);

export const PM_1J_A_ELIGIBLE_ROW = PM_1J_A_FIXTURE_ROWS.find(
  (row) => row.role === PM_1J_A_ROLES.ELIGIBLE
);
export const PM_1J_A_HIDDEN_ROW = PM_1J_A_FIXTURE_ROWS.find(
  (row) => row.role === PM_1J_A_ROLES.HIDDEN
);
export const PM_1J_A_SUSPENDED_ROW = PM_1J_A_FIXTURE_ROWS.find(
  (row) => row.role === PM_1J_A_ROLES.SUSPENDED
);
export const PM_1J_A_UNVERIFIED_ROW = PM_1J_A_FIXTURE_ROWS.find(
  (row) => row.role === PM_1J_A_ROLES.UNVERIFIED
);
export const PM_1J_A_MASKED_ROW = PM_1J_A_FIXTURE_ROWS.find(
  (row) => row.role === PM_1J_A_ROLES.MASKED
);

export const PM_1J_A_ALL_USER_IDS = PM_1J_A_FIXTURE_ROWS.map((row) => row.userId);
export const PM_1J_A_ALL_PLAYER_IDS = PM_1J_A_FIXTURE_ROWS.map((row) => row.playerId);

/**
 * Build profiles upsert payload for a fixture row.
 * @param {ReturnType<typeof buildFixtureRow>} row
 */
export function buildFixtureProfilePayload(row) {
  return {
    id: row.userId,
    email: row.email,
    display_name: row.displayName,
    player_id: row.playerId,
    role: row.roleLabel,
    venue_id: PM_1J_A_FIXTURE.tenantId,
    status: row.profile.status,
    identity_verification_status: row.profile.identity_verification_status,
    privacy_settings: row.profile.privacy_settings,
    gender: row.profile.gender,
    handedness: row.profile.handedness,
    activity_region: row.profile.activity_region,
    avatar_url: row.profile.avatar_url,
    updated_at: new Date().toISOString(),
  };
}

export function isFixturePlayerId(playerId) {
  return String(playerId || "").startsWith(PM_1J_A_FIXTURE.playerIdPrefix);
}

export function getFixtureRowByPlayerId(playerId) {
  return PM_1J_A_FIXTURE_ROWS.find((row) => row.playerId === playerId) || null;
}

export function getFixtureRowByRole(role) {
  return PM_1J_A_FIXTURE_ROWS.find((row) => row.role === role) || null;
}
