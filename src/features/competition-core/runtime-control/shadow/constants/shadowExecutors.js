/**
 * Shadow plan executor / return-source tokens (Phase 3A.2).
 * Distinct from RUNTIME_EXECUTOR selection — plan labels only.
 * Canonical never becomes Production return source in this phase.
 */

export const SHADOW_PRIMARY_EXECUTION = Object.freeze({
  LEGACY: "LEGACY",
});

export const SHADOW_SECONDARY_EXECUTION = Object.freeze({
  CANONICAL: "CANONICAL",
  NONE: "NONE",
});

export const SHADOW_RETURN_SOURCE = Object.freeze({
  LEGACY: "LEGACY",
});

/** Contract version for shadow infrastructure (not a Production enablement). */
export const SHADOW_INFRASTRUCTURE_VERSION = "3a2.0";

/** Comparator contract version embedded in comparison results. */
export const SHADOW_COMPARATOR_VERSION = "3a2.0-generic";
