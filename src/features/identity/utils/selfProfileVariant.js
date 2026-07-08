import { ROLES, normalizeRole } from "../../../auth/roles.js";
import { getClubById } from "../../../domain/clubService.js";
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
export function resolveSelfProfileVariant(user) {
  if (!user?.id) {
    return SELF_PROFILE_VARIANT.STAFF;
  }

  const role = normalizeRole(user.role);
  if (role === ROLES.PLAYER || role === ROLES.TEAM_CAPTAIN) {
    return SELF_PROFILE_VARIANT.ATHLETE;
  }

  const clubId = user.clubId || user.club_id;
  if (clubId) {
    const club = getClubById(clubId);
    if (club && (isClubPresident(user, club) || isClubVicePresident(user, club))) {
      return SELF_PROFILE_VARIANT.ATHLETE;
    }
  }

  return SELF_PROFILE_VARIANT.STAFF;
}

export function resolveSelfProfileRoleLabel(user) {
  const clubId = user?.clubId || user?.club_id;
  if (!clubId) {
    return null;
  }

  const club = getClubById(clubId);
  return resolveClubGovernanceTitle(user, club);
}
