/**
 * Phase 1I-A — Public Player Directory application contract constants.
 *
 * Eligibility / masking remain RPC-owned (1I-B). This module only defines
 * application limits, DTO allow-lists, and canonical error codes.
 */

export const DIRECTORY_SEARCH_DEFAULT_LIMIT = 20;
export const DIRECTORY_SEARCH_MAX_LIMIT = 50;
export const DIRECTORY_SEARCH_MIN_QUERY_LENGTH = 2;

/** Opaque cursor format version (encode/decode). */
export const DIRECTORY_CURSOR_VERSION = 1;

/**
 * Canonical Directory DTO keys (camelCase).
 * activityRegion is string | null on the public application DTO (Owner remediation).
 */
export const DIRECTORY_DTO_FIELDS = Object.freeze([
  "playerId",
  "displayName",
  "isVerified",
  "avatarUrl",
  "activityRegion",
  "gender",
  "handedness",
]);

/** Fields that must never appear on Directory DTOs (defense in depth). */
export const DIRECTORY_DTO_EXCLUDED_FIELDS = Object.freeze([
  "authUserId",
  "auth_user_id",
  "id",
  "email",
  "phone",
  "birthDate",
  "birth_date",
  "birthYear",
  "birth_year",
  "age",
  "ageGroup",
  "verificationStatus",
  "identityVerificationStatus",
  "identity_verification_status",
  "privacySettings",
  "privacy_settings",
  "status",
  "accountStatus",
  "profileStatus",
  "clubId",
  "club_id",
  "clubName",
  "club_name",
  "venueId",
  "venue_id",
  "tenantId",
  "tenant_id",
  "roles",
  "role",
  "rating",
  "ratingType",
  "rating_type",
  "updatedAt",
  "updated_at",
  "createdAt",
  "created_at",
  "rejectionReason",
  "rejection_reason",
  "moderationNotes",
  "moderation_notes",
  "visible",
  "reason",
]);

/**
 * Canonical runtime error codes for the Public Player Directory surface.
 * Values are unique to this surface (DIRECTORY_ prefix) to avoid colliding
 * with WRITE_ERROR_CODES / VERIFICATION_QUEUE_ERROR_CODES.
 */
export const DIRECTORY_ERROR_CODES = Object.freeze({
  NOT_AUTHENTICATED: "DIRECTORY_NOT_AUTHENTICATED",
  INVALID_REQUEST: "DIRECTORY_INVALID_REQUEST",
  INVALID_CURSOR: "DIRECTORY_INVALID_CURSOR",
  BACKEND_UNAVAILABLE: "DIRECTORY_BACKEND_UNAVAILABLE",
  RESPONSE_INVALID: "DIRECTORY_RESPONSE_INVALID",
});
