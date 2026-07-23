/**
 * CORE-20 — actor kind vocabulary for ActorReference.
 * Reference-only; never embeds profile/email/PII.
 */

export const ACTOR_KIND = Object.freeze({
  USER: "USER",
  SYSTEM: "SYSTEM",
  SERVICE: "SERVICE",
  SCHEDULER: "SCHEDULER",
  AUTOMATED_PROCESS: "AUTOMATED_PROCESS",
  MIGRATION: "MIGRATION",
  IMPORT: "IMPORT",
  UNKNOWN: "UNKNOWN",
});

/** @type {ReadonlySet<string>} */
export const ACTOR_KIND_VALUES = new Set(Object.values(ACTOR_KIND));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isActorKind(value) {
  return typeof value === "string" && ACTOR_KIND_VALUES.has(value);
}
