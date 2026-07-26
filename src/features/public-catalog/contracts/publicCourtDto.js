/**
 * Canonical Public Court DTO allowlist (PUBLIC-CATALOG-01).
 * Deny-by-default — only these keys may appear on projected DTOs.
 */

export const PUBLIC_COURT_DTO_KEYS = Object.freeze([
  "id",
  "clubId",
  "venueId",
  "displayName",
  "courtType",
  "surface",
  "availabilityDescriptor",
  "publicationState",
  "operationalState",
]);

/**
 * Sensitive / private keys that must never appear on public court DTOs.
 */
export const PUBLIC_COURT_FORBIDDEN_KEYS = Object.freeze([
  "defaultHourlyRate",
  "peakHourlyRate",
  "note",
  "pricing",
  "bookings",
  "customer",
  "customerPhone",
  "player",
  "staff",
  "assignment",
  "maintenanceNotes",
  "capacity",
  "priority",
  "subscriptionId",
  "ownerId",
  "ownerUserId",
  "secrets",
  "_raw",
]);
