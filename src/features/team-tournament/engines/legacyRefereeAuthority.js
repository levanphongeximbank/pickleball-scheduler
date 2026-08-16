/**
 * Legacy settings.referees / settings.refereeAssignments are display-only.
 * Canonical Team referee assignment authority is parent/child lifecycle + CORE-13.
 * This module must not be treated as scoring or result authority.
 */

export const LEGACY_REFEREE_AUTHORITY = Object.freeze({
  ASSIGNMENT: false,
  SCORING: false,
  RESULT: false,
  DISPLAY_ONLY: true,
  CANONICAL_AUTHORITY: "teamRefereeCanonicalLifecycle + competition.referee.adapter.v1",
});

export function isLegacyRefereeAuthorityDeprecated() {
  return true;
}
