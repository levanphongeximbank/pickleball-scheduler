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
  "verificationStatus",
  "profileStatus",
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
  INVALID_IDENTITY: "INVALID_IDENTITY",
  UNMAPPED_IDENTITY: "UNMAPPED_IDENTITY",
  AMBIGUOUS_IDENTITY: "AMBIGUOUS_IDENTITY",
  FORBIDDEN_FIELD: "FORBIDDEN_FIELD",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  SCHEMA_MIGRATION_REQUIRED: "SCHEMA_MIGRATION_REQUIRED",
  PERSISTENCE_NOT_CONFIGURED: "PERSISTENCE_NOT_CONFIGURED",
  DUPLICATE_IDENTITY_FORBIDDEN: "DUPLICATE_IDENTITY_FORBIDDEN",
  PERSISTENCE_ERROR: "PERSISTENCE_ERROR",
  PLAYER_ID_REQUIRED: "PLAYER_ID_REQUIRED",
});
