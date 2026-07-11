import { CLUB_MEMBERSHIP_REQUEST_STATUSES } from "../constants/clubMembershipRequestStatuses.js";

/**
 * Pure CTA rules for Discover ClubCard — Phase 42M / 42L contract.
 * No join CTA when: your-club, pending, rejected, or disabled.
 */
export function resolveClubCardCta({ variant, requestStatus, disabled = false }) {
  if (disabled || variant === "your-club") {
    return { showJoin: false, showCancel: false };
  }

  const isPending =
    variant === "pending" || requestStatus === CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING;
  const isRejected =
    variant === "rejected" || requestStatus === CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED;

  if (isRejected) {
    return { showJoin: false, showCancel: false };
  }

  if (isPending) {
    return { showJoin: false, showCancel: true };
  }

  if (variant === "joinable" && !requestStatus) {
    return { showJoin: true, showCancel: false };
  }

  return { showJoin: false, showCancel: false };
}
