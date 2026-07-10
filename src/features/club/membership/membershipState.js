/** Phase 42J.2.1 — membership resolution state machine (SSOT). */

export const MEMBERSHIP_PHASE = Object.freeze({
  IDLE: "IDLE",
  LOADING: "LOADING",
  ACTIVE: "ACTIVE",
  NONE: "NONE",
  ERROR: "ERROR",
});

/**
 * Derive phase from hook state. Never treat unresolved fetch as NONE.
 * @param {{ loading?: boolean, ok?: boolean, hasActiveMembership?: boolean, clubId?: string|null, phase?: string }} membership
 */
export function resolveMembershipPhase(membership) {
  if (membership?.phase) {
    return membership.phase;
  }
  if (membership?.loading) {
    return MEMBERSHIP_PHASE.LOADING;
  }
  if (!membership?.ok) {
    return membership ? MEMBERSHIP_PHASE.ERROR : MEMBERSHIP_PHASE.IDLE;
  }
  if (membership.hasActiveMembership && membership.clubId) {
    return MEMBERSHIP_PHASE.ACTIVE;
  }
  if (membership.ok) {
    return MEMBERSHIP_PHASE.NONE;
  }
  return MEMBERSHIP_PHASE.IDLE;
}

export function isMembershipPhaseReady(phase) {
  return (
    phase === MEMBERSHIP_PHASE.ACTIVE ||
    phase === MEMBERSHIP_PHASE.NONE ||
    phase === MEMBERSHIP_PHASE.ERROR
  );
}

export function isMembershipPhasePending(phase) {
  return phase === MEMBERSHIP_PHASE.IDLE || phase === MEMBERSHIP_PHASE.LOADING;
}
