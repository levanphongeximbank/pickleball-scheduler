import { CLUB_MEMBER_ROLE_LABELS } from "../../../features/club/constants/clubMemberRoles.js";

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
 * Governance is derived from the club record first (owner/president stored on
 * clubs), then falls back to per-member governance assignment codes.
 */
export function buildMemberRowsFromV2Members(members, clubGovernance, getVicePresidentUserIds) {
  return (Array.isArray(members) ? members : [])
    .map((member) => {
      const govFromClub = resolveMemberGovernanceRole(
        member.user_id,
        clubGovernance,
        getVicePresidentUserIds
      );
      const governanceRole =
        govFromClub || mapV2GovernanceRoleCodes(member.governance_roles);
      const membershipType = String(member.membership_type || "regular").toLowerCase();
      const memberRole =
        CLUB_MEMBER_ROLE_LABELS[membershipType] || CLUB_MEMBER_ROLE_LABELS.member;
      const name =
        member.display_name || member.email || String(member.user_id || "").trim() || "VĐV";

      return {
        id: member.id,
        name,
        governanceRole,
        memberRole,
        status: member.status,
        isActive: String(member.status || "").toLowerCase() === "active",
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
