/**
 * Canonical Public Club DTO allowlist (PUBLIC-CATALOG-01).
 * Deny-by-default — only these keys may appear on projected DTOs.
 */

export const PUBLIC_CLUB_DTO_KEYS = Object.freeze([
  "id",
  "displayName",
  "slug",
  "description",
  "logoUrl",
  "imageUrl",
  "locationSummary",
  "publicationState",
  "publicContact",
]);

/**
 * Sensitive / private keys that must never appear on public club DTOs.
 */
export const PUBLIC_CLUB_FORBIDDEN_KEYS = Object.freeze([
  "note",
  "ownerEmail",
  "ownerPhone",
  "phone",
  "email",
  "createdByUserId",
  "governance",
  "ownerUserId",
  "presidentUserId",
  "vicePresidentUserId",
  "vicePresidentUserIds",
  "tenantId",
  "venueId",
  "financial",
  "staff",
  "permissions",
  "audit",
  "deletedAt",
  "isDefault",
  "version",
  "_raw",
  "players",
  "members",
  "bookings",
  "customers",
  "ai",
  "director",
]);
