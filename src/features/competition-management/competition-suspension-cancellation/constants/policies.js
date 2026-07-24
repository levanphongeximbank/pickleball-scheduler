/**
 * Explicit publication interaction policies for CM-07.
 * No hidden default — commands must supply the applicable policy.
 */

export const COMPETITION_SUSPENSION_PUBLICATION_POLICY = Object.freeze({
  KEEP_PUBLIC_WITH_SUSPENDED_NOTICE: "KEEP_PUBLIC_WITH_SUSPENDED_NOTICE",
  REQUEST_TEMPORARY_WITHDRAWAL: "REQUEST_TEMPORARY_WITHDRAWAL",
});

export const COMPETITION_SUSPENSION_PUBLICATION_POLICY_VALUES = Object.freeze(
  Object.values(COMPETITION_SUSPENSION_PUBLICATION_POLICY)
);

export const COMPETITION_CANCELLATION_PUBLICATION_POLICY = Object.freeze({
  REQUEST_PERMANENT_WITHDRAWAL: "REQUEST_PERMANENT_WITHDRAWAL",
});

export const COMPETITION_CANCELLATION_PUBLICATION_POLICY_VALUES = Object.freeze(
  Object.values(COMPETITION_CANCELLATION_PUBLICATION_POLICY)
);

export const COMPETITION_PUBLICATION_CONTEXT_PRESENCE = Object.freeze({
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
});

export const COMPETITION_PUBLICATION_CONTEXT_PRESENCE_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_CONTEXT_PRESENCE)
);

export const COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION = Object.freeze({
  ALLOWED: "ALLOWED",
  DENIED: "DENIED",
});

export const COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION_VALUES = Object.freeze(
  Object.values(COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION)
);

export const COMPETITION_LIFECYCLE_ACTOR_TYPE = Object.freeze({
  USER: "USER",
  SERVICE: "SERVICE",
  SYSTEM: "SYSTEM",
});

export const COMPETITION_LIFECYCLE_ACTOR_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_LIFECYCLE_ACTOR_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionSuspensionPublicationPolicy(value) {
  return (
    typeof value === "string" &&
    COMPETITION_SUSPENSION_PUBLICATION_POLICY_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionCancellationPublicationPolicy(value) {
  return (
    typeof value === "string" &&
    COMPETITION_CANCELLATION_PUBLICATION_POLICY_VALUES.includes(value)
  );
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
export function isCompetitionLifecycleAuthorizationDecision(value) {
  return (
    typeof value === "string" &&
    COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionLifecycleActorType(value) {
  return (
    typeof value === "string" &&
    COMPETITION_LIFECYCLE_ACTOR_TYPE_VALUES.includes(value)
  );
}
