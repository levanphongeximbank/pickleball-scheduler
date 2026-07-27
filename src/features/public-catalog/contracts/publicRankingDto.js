/**
 * Canonical Public Ranking DTO allowlist (PUBLIC-CATALOG-02).
 * Ranking authority projection — not Player Rating.
 */

export const PUBLIC_RANKING_DTO_KEYS = Object.freeze([
  "id",
  "displayName",
  "clubName",
  "region",
  "category",
  "gender",
  "rank",
  "totalPoints",
  "tournamentsCount",
  "bestPlacement",
  "publicationState",
  "updatedAt",
]);

export const PUBLIC_RANKING_FORBIDDEN_KEYS = Object.freeze([
  "phone",
  "email",
  "memberId",
  "customerId",
  "playerId",
  "profile",
  "adjustmentHistory",
  "verificationNotes",
  "confidence",
  "tenantId",
  "writer",
  "audit",
  "secrets",
  "_raw",
]);
