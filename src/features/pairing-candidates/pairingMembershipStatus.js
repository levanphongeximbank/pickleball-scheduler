/**
 * Membership status normalization for pairing eligibility.
 * public.club_members.status = 'active' is authoritative; tolerate aliases.
 */

const ACTIVE_MEMBERSHIP_STATUSES = new Set([
  "active",
  "member",
  "approved",
  "joined",
  "true",
  "1",
]);

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeMembershipStatus(raw) {
  if (raw === true || raw === 1) {
    return "active";
  }
  return String(raw || "")
    .trim()
    .toLowerCase();
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isActiveMembershipStatus(raw) {
  return ACTIVE_MEMBERSHIP_STATUSES.has(normalizeMembershipStatus(raw));
}

/**
 * Read membership status from common field names (RPC / blob / join variants).
 *
 * @param {object} [member]
 * @returns {string|null}
 */
export function readMembershipStatus(member = {}) {
  const raw =
    member.status ??
    member.membershipStatus ??
    member.membership_status ??
    member.memberStatus ??
    member.member_status ??
    null;
  if (raw == null || raw === "") {
    return null;
  }
  return String(raw);
}
