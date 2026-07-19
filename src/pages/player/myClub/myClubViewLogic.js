import {
  CLUB_MEMBER_ROLE_LABELS,
  getClubMemberStatusLabel,
  isClubMemberStatusActive,
} from "../../../features/club/constants/clubMemberRoles.js";
import { mapV2MemberRowToUi } from "../../../features/club/services/clubMemberService.js";
import {
  GOVERNANCE_ROLE_LABELS,
  GOVERNANCE_UNASSIGNED_LABEL,
  mapGovernanceRoleCodesToLabel,
  resolveMemberGovernanceRoleLabel,
} from "../../../features/club/context/governanceCanonicalReadModel.js";

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
    return GOVERNANCE_UNASSIGNED_LABEL;
  }
  if (governanceLabels.presidentLabel) {
    return governanceLabels.presidentLabel;
  }
  if (governanceLabels.combinedOwnerPresident && governanceLabels.ownerLabel) {
    return governanceLabels.ownerLabel.replace(
      ` (${GOVERNANCE_ROLE_LABELS.owner_and_president})`,
      ""
    );
  }
  return GOVERNANCE_UNASSIGNED_LABEL;
}

export function resolveOwnerStatContent({ club, governanceLabels, canAssign }) {
  const hasOwner = Boolean(club?.governance?.ownerUserId);
  if (hasOwner) {
    return {
      mode: "assigned",
      label: governanceLabels?.ownerLabel || GOVERNANCE_UNASSIGNED_LABEL,
    };
  }
  if (canAssign) {
    return { mode: "assign" };
  }
  return { mode: "unassigned" };
}

/** @deprecated prefer resolveMemberGovernanceRoleLabel from governanceCanonicalReadModel */
export function resolveMemberGovernanceRole(userId, governance, getVicePresidentUserIds) {
  void getVicePresidentUserIds;
  return resolveMemberGovernanceRoleLabel(userId, governance, null);
}

/** Map Phase 42 governance role codes → VN label (canonical). */
export function mapV2GovernanceRoleCodes(roles) {
  return mapGovernanceRoleCodesToLabel(roles);
}

/**
 * Build member table rows from Phase 42 `club_list_members` RPC rows.
 * Governance badges use the Phase 2E canonical role-label resolver.
 */
export function buildMemberRowsFromV2Members(members, clubGovernance, getVicePresidentUserIds) {
  void getVicePresidentUserIds;
  return (Array.isArray(members) ? members : [])
    .map((rawMember) => {
      const member = mapV2MemberRowToUi(rawMember);
      const governanceRole = resolveMemberGovernanceRoleLabel(
        member.userId,
        clubGovernance,
        member.governanceRoles
      );
      const membershipType = String(member.membershipType || "regular").toLowerCase();
      const memberRole =
        CLUB_MEMBER_ROLE_LABELS[membershipType] || CLUB_MEMBER_ROLE_LABELS.member;
      // displayName → email → VĐV; never raw uuid fragment.
      const safeName =
        String(member.displayName || "").trim() ||
        String(member.email || "").trim() ||
        "VĐV";

      return {
        id: member.id,
        name: safeName,
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
