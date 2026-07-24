/**
 * Explicit archive policy profiles + shared authorization / presence enums (CM-08).
 * No hidden default — commands must supply the applicable profileId.
 */

export const COMPETITION_ARCHIVE_POLICY_PROFILE = Object.freeze({
  CM08_STANDARD_FINALIZED_V1: "CM08_STANDARD_FINALIZED_V1",
  CM08_EXCEPTIONAL_ADMIN_V1: "CM08_EXCEPTIONAL_ADMIN_V1",
});

export const COMPETITION_ARCHIVE_POLICY_PROFILE_VALUES = Object.freeze(
  Object.values(COMPETITION_ARCHIVE_POLICY_PROFILE)
);

/**
 * Deterministic policy metadata. Not inferred from UI.
 */
export const COMPETITION_ARCHIVE_POLICY_BY_PROFILE = Object.freeze({
  [COMPETITION_ARCHIVE_POLICY_PROFILE.CM08_STANDARD_FINALIZED_V1]: Object.freeze({
    profileId: COMPETITION_ARCHIVE_POLICY_PROFILE.CM08_STANDARD_FINALIZED_V1,
    version: "1",
    allowedLifecycleStates: Object.freeze(["CANCELLED"]),
    allowCompletedWithExplicitEvidence: true,
    allowActive: false,
    allowSuspended: false,
    requireExplicitVersion: true,
    requirePublicationContext: true,
    requireRetentionAcknowledgement: true,
    unarchiveAllowed: true,
    unarchiveRequiresElevatedAuthority: true,
    elevatedAuthorityMarker: "ELEVATED_UNARCHIVE",
    purge: false,
    delete: false,
    autoArchive: false,
  }),
  [COMPETITION_ARCHIVE_POLICY_PROFILE.CM08_EXCEPTIONAL_ADMIN_V1]: Object.freeze({
    profileId: COMPETITION_ARCHIVE_POLICY_PROFILE.CM08_EXCEPTIONAL_ADMIN_V1,
    version: "1",
    allowedLifecycleStates: Object.freeze(["CANCELLED", "ACTIVE", "SUSPENDED"]),
    allowCompletedWithExplicitEvidence: true,
    allowActive: true,
    allowSuspended: true,
    requireExplicitVersion: true,
    requirePublicationContext: true,
    requireRetentionAcknowledgement: true,
    requireElevatedArchiveAuthority: true,
    elevatedAuthorityMarker: "ELEVATED_ARCHIVE",
    unarchiveAllowed: true,
    unarchiveRequiresElevatedAuthority: true,
    purge: false,
    delete: false,
    autoArchive: false,
  }),
});

export const COMPETITION_PUBLICATION_CONTEXT_PRESENCE = Object.freeze({
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
});

export const COMPETITION_PUBLICATION_CONTEXT_PRESENCE_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_CONTEXT_PRESENCE)
);

export const COMPETITION_OPTIONAL_CONTEXT_PRESENCE = Object.freeze({
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
});

export const COMPETITION_OPTIONAL_CONTEXT_PRESENCE_VALUES = Object.freeze(
  Object.values(COMPETITION_OPTIONAL_CONTEXT_PRESENCE)
);

export const COMPETITION_ARCHIVE_AUTHORIZATION_DECISION = Object.freeze({
  ALLOWED: "ALLOWED",
  DENIED: "DENIED",
});

export const COMPETITION_ARCHIVE_AUTHORIZATION_DECISION_VALUES = Object.freeze(
  Object.values(COMPETITION_ARCHIVE_AUTHORIZATION_DECISION)
);

export const COMPETITION_ARCHIVE_ACTOR_TYPE = Object.freeze({
  USER: "USER",
  SERVICE: "SERVICE",
  SYSTEM: "SYSTEM",
});

export const COMPETITION_ARCHIVE_ACTOR_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_ARCHIVE_ACTOR_TYPE)
);

export const COMPETITION_ARCHIVE_FINALIZATION_KIND = Object.freeze({
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
});

export const COMPETITION_ARCHIVE_FINALIZATION_KIND_VALUES = Object.freeze(
  Object.values(COMPETITION_ARCHIVE_FINALIZATION_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionArchivePolicyProfile(value) {
  return (
    typeof value === "string" &&
    COMPETITION_ARCHIVE_POLICY_PROFILE_VALUES.includes(value)
  );
}

/**
 * @param {unknown} profileId
 * @returns {Readonly<object>|null}
 */
export function resolveCompetitionArchivePolicy(profileId) {
  if (!isCompetitionArchivePolicyProfile(profileId)) return null;
  return COMPETITION_ARCHIVE_POLICY_BY_PROFILE[profileId] ?? null;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationContextPresence(value) {
  return (
    typeof value === "string" &&
    COMPETITION_PUBLICATION_CONTEXT_PRESENCE_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionOptionalContextPresence(value) {
  return (
    typeof value === "string" &&
    COMPETITION_OPTIONAL_CONTEXT_PRESENCE_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionArchiveAuthorizationDecision(value) {
  return (
    typeof value === "string" &&
    COMPETITION_ARCHIVE_AUTHORIZATION_DECISION_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionArchiveActorType(value) {
  return (
    typeof value === "string" &&
    COMPETITION_ARCHIVE_ACTOR_TYPE_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionArchiveFinalizationKind(value) {
  return (
    typeof value === "string" &&
    COMPETITION_ARCHIVE_FINALIZATION_KIND_VALUES.includes(value)
  );
}
