/**
 * ParticipantReference kinds (OD-01).
 * These are NOT interchangeable ID spaces.
 */

export const PARTICIPANT_REFERENCE_KIND = Object.freeze({
  PLATFORM_USER: "PLATFORM_USER",
  PLAYER_PROFILE: "PLAYER_PROFILE",
  ATHLETE: "ATHLETE",
  CLUB_MEMBER: "CLUB_MEMBER",
  GUEST: "GUEST",
  EXTERNAL: "EXTERNAL",
});

/** @type {ReadonlySet<string>} */
export const PARTICIPANT_REFERENCE_KIND_VALUES = new Set(
  Object.values(PARTICIPANT_REFERENCE_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isParticipantReferenceKind(value) {
  return typeof value === "string" && PARTICIPANT_REFERENCE_KIND_VALUES.has(value);
}
