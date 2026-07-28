import { ROLES, normalizeRole } from "../../../auth/roles.js";
import {
  isClubPresident,
  isClubVicePresident,
  resolveClubGovernanceTitle,
} from "../../club/services/clubGovernanceService.js";

export const SELF_PROFILE_VARIANT = Object.freeze({
  ATHLETE: "athlete",
  STAFF: "staff",
});

/**
 * Chủ tịch / Phó chủ tịch CLB là VĐV có chức danh → dùng hồ sơ VĐV.
 */
function resolveCanonicalMembershipClub(membership) {
  if (!membership?.ok || !membership?.hasActiveMembership || !membership?.clubId) {
    return null;
  }
  return membership.club?.id === membership.clubId ? membership.club : null;
}

export function resolveSelfProfileVariant(user, membership = null) {
  if (!user?.id) {
    return SELF_PROFILE_VARIANT.STAFF;
  }

  const role = normalizeRole(user.role);
  if (role === ROLES.PLAYER || role === ROLES.TEAM_CAPTAIN) {
    return SELF_PROFILE_VARIANT.ATHLETE;
  }

  const club = resolveCanonicalMembershipClub(membership);
  if (club && (isClubPresident(user, club) || isClubVicePresident(user, club))) {
    return SELF_PROFILE_VARIANT.ATHLETE;
  }

  return SELF_PROFILE_VARIANT.STAFF;
}

export function resolveSelfProfileRoleLabel(user, membership = null) {
  const club = resolveCanonicalMembershipClub(membership);
  if (!club) {
    return null;
  }

  return resolveClubGovernanceTitle(user, club);
}
