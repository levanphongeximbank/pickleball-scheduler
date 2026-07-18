/**
 * Phase 1C — identity verification status (not rating verification).
 */
export const IDENTITY_VERIFICATION_STATUS = Object.freeze({
  UNVERIFIED: "unverified",
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
});

export const IDENTITY_VERIFICATION_VALUES = Object.freeze(
  Object.values(IDENTITY_VERIFICATION_STATUS)
);

/** Rating verification statuses that must never be accepted as identity verification. */
export const RATING_VERIFICATION_STATUS_EXAMPLES = Object.freeze([
  "provisional",
  "self_declared",
  "club_verified",
  "admin_verified",
  "system_verified",
  "under_review",
  "court_assessed",
  "match_calibrated",
]);
