/**
 * Wave O1 — Official Tournament Experience authority lock.
 * No authority migration. Adapter is translation / projection only.
 */

export const OFFICIAL_EXPERIENCE_AUTHORITY = Object.freeze({
  OFFICIAL_SETTINGS: "official-open-settings-domain",
  OFFICIAL_EVENT: "official-open-event-domain",
  OFFICIAL_REGISTRATION: "official-open-registration-domain",
  OFFICIAL_REGISTRATION_SETTINGS: "official-open-registration-settings",
  OFFICIAL_ELIGIBILITY: "official-open-eligibility-engine",
  OFFICIAL_PARTICIPANT: "official-open-participant-domain",
  OFFICIAL_PAIRING: "official-open-pairing-engines",
  OFFICIAL_GROUP_DRAW: "official-open-group-draw-engines",
  OFFICIAL_SCHEDULE: "official-open-schedule-engines",
  OFFICIAL_MATCH: "official-open-match-runtime",
  OFFICIAL_STANDINGS: "official-open-standings-engines",
  OFFICIAL_KNOCKOUT: "official-open-knockout-engines",
  OFFICIAL_AWARDS: "official-open-awards-domain",
  OFFICIAL_SCORING_RULE: "official-open-scoring-rules-settings",
  REFEREE_ASSIGNMENT: "CORE-13",
  MATCH_LIFECYCLE: "CORE-15",
  SCORING: "CORE-16",
  OFFICIAL_RESULT: "CORE-17",
  COURT: "canonical-court-authority",
});

export const OFFICIAL_EXPERIENCE_AUTHORITY_MIGRATION = Object.freeze({
  wave: "O2",
  migrated: false,
  note: "Authorities remain on existing Official/Open domain/runtime and CORE-* modules.",
});
