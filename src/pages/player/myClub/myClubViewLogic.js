import {
  CLUB_MEMBER_ROLE_LABELS,
  getClubMemberStatusLabel,
  isClubMemberStatusActive,
} from "../../../features/club/constants/clubMemberRoles.js";
import { mapV2MemberRowToUi } from "../../../features/club/services/clubMemberService.js";

export const MY_CLUB_VIEWS = ["home", "schedule", "members"];

/** @deprecated use MY_CLUB_MEMBER_VIEWS from clubMembershipRouteLogic */
export const MY_CLUB_MEMBER_VIEWS = MY_CLUB_VIEWS;

export function resolveInitialView(_hasClub, searchParams) {
  const viewParam = String(searchParams?.get?.("view") || "").trim().toLowerCase();
  if (viewParam === "schedule" || viewParam === "members" || viewParam === "home") {
    return viewParam;
  }
  return "home";
}

export function resolvePresidentDisplayLabel(governanceLabels) {
  if (!governanceLabels) {
    return "Chưa gán";
  }
  if (governanceLabels.presidentLabel) {
    return governanceLabels.presidentLabel;
  }
  if (governanceLabels.combinedOwnerPresident && governanceLabels.ownerLabel) {
    return governanceLabels.ownerLabel.replace(" (Chủ sở hữu & Chủ tịch)", "");
  }
  return "Chưa gán";
}

export function resolveOwnerStatContent({ club, governanceLabels, canAssign }) {
  const hasOwner = Boolean(club?.governance?.ownerUserId);
  if (hasOwner) {
    return {
      mode: "assigned",
      label: governanceLabels?.ownerLabel || "—",
    };
  }
  if (canAssign) {
    return { mode: "assign" };
  }
  return { mode: "unassigned" };
}

export function resolveMemberGovernanceRole(userId, governance, getVicePresidentUserIds) {
  if (!userId || !governance) {
    return null;
  }

  const same = (a, b) => Boolean(a && b && String(a).trim() === String(b).trim());
  const viceIds = getVicePresidentUserIds(governance);
  const isPresident = same(userId, governance.presidentUserId);
  const isOwner = same(userId, governance.ownerUserId);
  const isVice = viceIds.some((id) => same(userId, id));

  if (isPresident && isOwner) {
    return "Chủ sở hữu & Chủ tịch";
  }
  if (isPresident) {
    return "Chủ tịch";
  }
  if (isVice) {
    return "Phó chủ tịch";
  }
  if (isOwner) {
    return "Chủ sở hữu";
  }
  return null;
}

/** Map Phase 42 governance role codes (club_governance_assignments) → VN label. */
export function mapV2GovernanceRoleCodes(roles) {
  const list = (Array.isArray(roles) ? roles : []).map((role) =>
    String(role || "").trim().toLowerCase()
  );
  const has = (role) => list.includes(role);
  const isPresident = has("president") || has("club_president");
  const isOwner = has("club_owner") || has("owner");
  const isVice = has("vice_president") || has("club_vice_president");

  if (isPresident && isOwner) {
    return "Chủ sở hữu & Chủ tịch";
  }
  if (isPresident) {
    return "Chủ tịch";
  }
  if (isVice) {
    return "Phó chủ tịch";
  }
  if (isOwner) {
    return "Chủ sở hữu";
  }
  return null;
}

/**
 * Build member table rows from Phase 42 `club_list_members` RPC rows.
 *
 * Row normalization (status, displayName, membershipType, governance codes) is
 * delegated to the canonical row mapper `mapV2MemberRowToUi`. This function is
 * the display-row builder on top of it: it resolves the VN governance role
 * (club record first, then per-member codes), the member-role label and the
 * name fallback. Status normalization / active rule stay single-sourced in
 * `clubMemberRoles.js`.
 */
export function buildMemberRowsFromV2Members(members, clubGovernance, getVicePresidentUserIds) {
  return (Array.isArray(members) ? members : [])
    .map((rawMember) => {
      const member = mapV2MemberRowToUi(rawMember);
      const govFromClub = resolveMemberGovernanceRole(
        member.userId,
        clubGovernance,
        getVicePresidentUserIds
      );
      const governanceRole =
        govFromClub || mapV2GovernanceRoleCodes(member.governanceRoles);
      const membershipType = String(member.membershipType || "regular").toLowerCase();
      const memberRole =
        CLUB_MEMBER_ROLE_LABELS[membershipType] || CLUB_MEMBER_ROLE_LABELS.member;
      const name =
        member.displayName || member.email || String(member.userId || "").trim() || "VĐV";

      return {
        id: member.id,
        name,
        governanceRole,
        memberRole,
        status: member.status,
        statusLabel: getClubMemberStatusLabel(member.status),
        isActive: isClubMemberStatusActive(member.status),
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "vi"));
}

export function getTodayActivityDayOfWeek(now = new Date()) {
  const jsDay = now.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export const WEEK_GRID_DAYS = [1, 2, 3, 4, 5, 6, 7];

export const WEEK_DAY_SHORT_LABELS = Object.freeze({
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
  7: "CN",
});
