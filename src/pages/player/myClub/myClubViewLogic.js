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
