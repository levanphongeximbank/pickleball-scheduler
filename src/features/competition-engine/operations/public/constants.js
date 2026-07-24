/**
 * E2E-05 Public Competition Experience — constants and visibility enums.
 * Publication vocabulary reuses E2E-03 PUBLICATION_OPS_STATE (no parallel taxonomy).
 */

export const E2E05_PUBLIC_EXPERIENCE_VERSION = "e2e-05-public-experience-v1";
export const E2E05_PUBLIC_EXPERIENCE_PHASE = "E2E-05";

export const PUBLIC_QUERY = Object.freeze({
  OVERVIEW: "public.overview",
  PARTICIPANTS: "public.participants",
  SCHEDULE: "public.schedule",
  POOLS: "public.pools",
  STANDINGS: "public.standings",
  QUALIFICATION: "public.qualification",
  BRACKET: "public.bracket",
  MATCH_CENTER: "public.matchCenter",
  FINAL_RESULTS: "public.finalResults",
  ARCHIVE: "public.archive",
  FULL_EXPERIENCE: "public.fullExperience",
});

export const PUBLIC_QUERY_VALUES = Object.freeze(Object.values(PUBLIC_QUERY));

export const PUBLIC_AVAILABILITY = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
  BLOCKED: "BLOCKED",
  ARCHIVED: "ARCHIVED",
});

export const PUBLIC_AVAILABILITY_VALUES = Object.freeze(
  Object.values(PUBLIC_AVAILABILITY)
);

export const PUBLIC_MATCH_STATUS = Object.freeze({
  SCHEDULED: "SCHEDULED",
  DELAYED: "DELAYED",
  SUSPENDED: "SUSPENDED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  VOID: "VOID",
  PENDING: "PENDING",
});

export const PUBLIC_MATCH_STATUS_VALUES = Object.freeze(
  Object.values(PUBLIC_MATCH_STATUS)
);

export const PUBLIC_BLOCKER_CODE = Object.freeze({
  MISSING_TENANT: "MISSING_TENANT",
  MISSING_COMPETITION: "MISSING_COMPETITION",
  CROSS_TENANT: "CROSS_TENANT",
  COMPETITION_UNPUBLISHED: "COMPETITION_UNPUBLISHED",
  SCHEDULE_UNPUBLISHED: "SCHEDULE_UNPUBLISHED",
  PARTICIPANTS_HIDDEN: "PARTICIPANTS_HIDDEN",
  RESULTS_UNPUBLISHED: "RESULTS_UNPUBLISHED",
  BRACKET_UNPUBLISHED: "BRACKET_UNPUBLISHED",
  FINAL_RESULTS_UNPUBLISHED: "FINAL_RESULTS_UNPUBLISHED",
  ARCHIVE_HIDDEN: "ARCHIVE_HIDDEN",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
  INVALID_INPUT: "INVALID_INPUT",
});

export const PUBLIC_ERROR_CODE = Object.freeze({
  MISSING_TENANT: "E2E05_MISSING_TENANT",
  MISSING_COMPETITION: "E2E05_MISSING_COMPETITION",
  CROSS_TENANT_REJECTED: "E2E05_CROSS_TENANT_REJECTED",
  COMPETITION_UNPUBLISHED: "E2E05_COMPETITION_UNPUBLISHED",
  SCHEDULE_UNPUBLISHED: "E2E05_SCHEDULE_UNPUBLISHED",
  PARTICIPANTS_HIDDEN: "E2E05_PARTICIPANTS_HIDDEN",
  RESULTS_UNPUBLISHED: "E2E05_RESULTS_UNPUBLISHED",
  BRACKET_UNPUBLISHED: "E2E05_BRACKET_UNPUBLISHED",
  FINAL_RESULTS_UNPUBLISHED: "E2E05_FINAL_RESULTS_UNPUBLISHED",
  ARCHIVE_HIDDEN: "E2E05_ARCHIVE_HIDDEN",
  RECORD_NOT_FOUND: "E2E05_RECORD_NOT_FOUND",
  INVALID_INPUT: "E2E05_INVALID_INPUT",
  UNKNOWN: "E2E05_UNKNOWN",
});

export const PUBLIC_ERROR_CODE_VALUES = Object.freeze(
  Object.values(PUBLIC_ERROR_CODE)
);

/**
 * Default visibility derived from E2E-03 publication ops state.
 * Fail-closed: NONE → nothing public.
 */
export const PUBLICATION_VISIBILITY_DEFAULTS = Object.freeze({
  NONE: Object.freeze({
    competitionPublished: false,
    schedulePublished: false,
    participantsVisible: false,
    resultsPublished: false,
    bracketPublished: false,
    finalResultsPublished: false,
    archiveVisible: false,
  }),
  OPERATIONAL_PLAN_PUBLISHED: Object.freeze({
    competitionPublished: true,
    schedulePublished: true,
    participantsVisible: true,
    resultsPublished: false,
    bracketPublished: false,
    finalResultsPublished: false,
    archiveVisible: false,
  }),
  FINAL_RESULT_PUBLISHED: Object.freeze({
    competitionPublished: true,
    schedulePublished: true,
    participantsVisible: true,
    resultsPublished: true,
    bracketPublished: true,
    finalResultsPublished: true,
    archiveVisible: false,
  }),
});
