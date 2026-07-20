/**
 * Phase 1C — Player Management-owned writable fields vs forbidden domains.
 */

/** Fields accepted by updatePlayerProfile (Player Management owned). */
export const PLAYER_WRITABLE_FIELDS = Object.freeze([
  "displayName",
  "fullName",
  "phone",
  "avatarUrl",
  "gender",
  "birthDate",
  "birthYear",
  "handedness",
  "activityRegion",
  "privacySettings",
  "profileStatus",
]);

/**
 * Privileged identity-verification fields — not writable via updatePlayerProfile.
 * Use updatePlayerVerificationStatus (Phase 1H-A) for authorized admin writes.
 * Do not re-add these as a generic patch escape hatch.
 */
export const PLAYER_PRIVILEGED_WRITE_FIELDS = Object.freeze([
  "verificationStatus",
  "identityVerificationStatus",
  "identity_verification_status",
]);

/** Explicitly forbidden on the Player write path. */
export const PLAYER_FORBIDDEN_WRITE_FIELDS = Object.freeze([
  "accountStatus",
  "authUserId",
  "playerId",
  "athleteId",
  "email",
  "ageGroup",
  "clubMembershipReferences",
  "ratingReferences",
  "rankingReferences",
  "sourceReferences",
  "createdAt",
  "updatedAt",
  // Privileged / admin-only (not normal facade)
  ...PLAYER_PRIVILEGED_WRITE_FIELDS,
  // Domain ownership
  "membershipStatus",
  "clubMembershipStatus",
  "rating",
  "ratingStatus",
  "ranking",
  "rankingPoints",
  "competitionParticipation",
  "roles",
  "role",
  "rbac",
  "permissions",
]);

export const WRITE_ERROR_CODES = Object.freeze({
  EMPTY_PATCH: "EMPTY_PATCH",
  INVALID_PATCH: "INVALID_PATCH",
  INVALID_IDENTITY: "INVALID_IDENTITY",
  UNMAPPED_IDENTITY: "UNMAPPED_IDENTITY",
  AMBIGUOUS_IDENTITY: "AMBIGUOUS_IDENTITY",
  FORBIDDEN_FIELD: "FORBIDDEN_FIELD",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  SELF_VERIFICATION_FORBIDDEN: "SELF_VERIFICATION_FORBIDDEN",
  SCHEMA_MIGRATION_REQUIRED: "SCHEMA_MIGRATION_REQUIRED",
  PERSISTENCE_NOT_CONFIGURED: "PERSISTENCE_NOT_CONFIGURED",
  PERSISTENCE_UNAVAILABLE: "PERSISTENCE_UNAVAILABLE",
  DUPLICATE_IDENTITY_FORBIDDEN: "DUPLICATE_IDENTITY_FORBIDDEN",
  PERSISTENCE_ERROR: "PERSISTENCE_ERROR",
  PLAYER_ID_REQUIRED: "PLAYER_ID_REQUIRED",
  PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  RLS_DENIED: "RLS_DENIED",
  CONSTRAINT_VIOLATION: "CONSTRAINT_VIOLATION",
  UNKNOWN_DATABASE_FAILURE: "UNKNOWN_DATABASE_FAILURE",
});
