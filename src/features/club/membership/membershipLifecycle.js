/**
 * Phase 2C — Canonical ClubMembership lifecycle + status (domain freeze §3.2).
 *
 * Status SoT: active | left | removed
 * Legacy UI may still show inactive → treated as non-active (not a Production write target under V2).
 */

import {
  CLUB_MEMBER_STATUSES,
  normalizeClubMemberStatus,
  isClubMemberStatusActive,
} from "../constants/clubMemberRoles.js";

export const CANONICAL_MEMBERSHIP_STATUSES = Object.freeze({
  ACTIVE: "active",
  LEFT: "left",
  REMOVED: "removed",
});

/** Allowed Production status transitions (V2). */
export const MEMBERSHIP_TRANSITIONS = Object.freeze({
  add: { from: [null, "left", "removed", "inactive"], to: "active" },
  leave: { from: ["active"], to: "left" },
  remove: { from: ["active"], to: "removed" },
  restore: { from: ["removed"], to: "active" },
});

/**
 * Map any raw/legacy status to canonical Production status.
 * inactive / pending / rejected / unknown → inactive (non-active), never invent active.
 */
export function toCanonicalMembershipStatus(rawStatus) {
  const normalized = normalizeClubMemberStatus(rawStatus);
  if (normalized === CLUB_MEMBER_STATUSES.ACTIVE) {
    return CANONICAL_MEMBERSHIP_STATUSES.ACTIVE;
  }
  if (normalized === CLUB_MEMBER_STATUSES.LEFT) {
    return CANONICAL_MEMBERSHIP_STATUSES.LEFT;
  }
  if (normalized === CLUB_MEMBER_STATUSES.REMOVED) {
    return CANONICAL_MEMBERSHIP_STATUSES.REMOVED;
  }
  return CLUB_MEMBER_STATUSES.INACTIVE;
}

export function isCanonicalMembershipActive(status) {
  return isClubMemberStatusActive(status);
}

/**
 * @param {string|null|undefined} fromStatus
 * @param {'add'|'leave'|'remove'|'restore'} command
 * @returns {{ ok: boolean, code?: string, error?: string, to?: string }}
 */
export function assertMembershipTransition(fromStatus, command) {
  const cmd = String(command || "").trim();
  const rule = MEMBERSHIP_TRANSITIONS[cmd];
  if (!rule) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: `Unknown membership command: ${cmd}`,
    };
  }

  const from = fromStatus == null || fromStatus === ""
    ? null
    : toCanonicalMembershipStatus(fromStatus);

  const allowedFrom = rule.from;
  const fromOk =
    from == null
      ? allowedFrom.includes(null)
      : allowedFrom.includes(from) ||
        (from === CLUB_MEMBER_STATUSES.INACTIVE && allowedFrom.includes("inactive"));

  if (!fromOk) {
    return {
      ok: false,
      code: "INVALID_STATE",
      error: `Illegal membership transition: ${from || "∅"} → ${cmd}`,
    };
  }

  return { ok: true, to: rule.to };
}

/**
 * Minimal PII roster DTO for peer modules (Competition eligibility, etc.).
 * @param {object} member
 */
export function toActiveRosterMemberDto(member = {}) {
  const userId = String(member.userId || member.user_id || "").trim() || null;
  const playerId = String(member.playerId || member.player_id || userId || "").trim() || null;
  return {
    userId,
    playerId,
    displayName: String(member.displayName || member.display_name || "").trim(),
    status: CANONICAL_MEMBERSHIP_STATUSES.ACTIVE,
    membershipType: member.membershipType || member.membership_type || "regular",
    version: member.version ?? null,
  };
}
