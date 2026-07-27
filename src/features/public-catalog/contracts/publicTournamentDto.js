/**
 * Canonical Public Tournament DTO allowlist (PUBLIC-CATALOG-02).
 */

export const PUBLIC_TOURNAMENT_DTO_KEYS = Object.freeze([
  "id",
  "displayName",
  "slug",
  "sport",
  "publicationState",
  "operationalStatus",
  "startDate",
  "endDate",
  "locationSummary",
  "formatSummary",
  "categorySummary",
  "imageUrl",
  "updatedAt",
]);

export const PUBLIC_TOURNAMENT_FORBIDDEN_KEYS = Object.freeze([
  "note",
  "notes",
  "staff",
  "referee",
  "referees",
  "participants",
  "players",
  "seeding",
  "bracket",
  "unpublished",
  "financial",
  "phone",
  "email",
  "contact",
  "audit",
  "tenantId",
  "secrets",
  "_raw",
]);
