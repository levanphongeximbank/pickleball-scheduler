/** Phase 1B — privacy classification helpers (no public API surface yet). */

export const PRIVACY_CLASS = Object.freeze({
  PUBLIC: "public",
  INTERNAL: "internal",
  RESTRICTED: "restricted",
  SYSTEM: "system",
});

/** Default fail-closed privacy settings (contract from Phase 1A). */
export const DEFAULT_PRIVACY_SETTINGS = Object.freeze({
  version: 1,
  showPhonePublic: false,
  showEmailPublic: false,
  showBirthYearPublic: false,
  showBirthDatePublic: false,
  showGenderPublic: true,
  showHandednessPublic: true,
  showActivityRegionPublic: true,
  showClubMembershipPublic: false,
  showRatingSummaryPublic: true,
  showRankingSummaryPublic: true,
});
