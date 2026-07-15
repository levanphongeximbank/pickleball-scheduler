import { CLUB_MEMBERSHIP_REQUEST_STATUSES } from "../constants/clubMembershipRequestStatuses.js";

/**
 * Pure CTA rules for Discover ClubCard — Phase 42M / 42L contract.
 * Rejected applicants may re-apply (showJoin / Gửi lại).
 * No join CTA when: your-club, pending, or disabled.
 */
export function resolveClubCardCta({ variant, requestStatus, disabled = false }) {
  if (disabled || variant === "your-club") {
    return { showJoin: false, showCancel: false, joinLabel: null };
  }

  const isPending =
    variant === "pending" || requestStatus === CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING;
  const isRejected =
    variant === "rejected" || requestStatus === CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED;

  if (isRejected) {
    return { showJoin: true, showCancel: false, joinLabel: "Gửi lại" };
  }

  if (isPending) {
    return { showJoin: false, showCancel: true, joinLabel: null };
  }

  if (variant === "joinable" && !requestStatus) {
    return { showJoin: true, showCancel: false, joinLabel: "Xin tham gia" };
  }

  return { showJoin: false, showCancel: false, joinLabel: null };
}
