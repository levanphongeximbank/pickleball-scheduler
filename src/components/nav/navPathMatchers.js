export function stripQuery(path = "") {
  return String(path).split("?")[0];
}

function pathIncludesQueryParam(path, key, value) {
  const query = String(path).split("?")[1] || "";
  if (!query) return false;
  return new URLSearchParams(query).get(key) === value;
}

/** Phân biệt các mục lá cùng path base nhưng khác query (?type=member, ?tab=skill). */
function matchPathWithOptionalQuery(currentPath, item, resolvedPath) {
  const targetPath = resolvedPath || item.path || "";
  const wantsMember = pathIncludesQueryParam(targetPath, "type", "member");
  const hasMember = pathIncludesQueryParam(currentPath, "type", "member");
  if (wantsMember) return hasMember;
  if (hasMember) return false;

  const wantsSkill = pathIncludesQueryParam(targetPath, "tab", "skill");
  const hasSkill = pathIncludesQueryParam(currentPath, "tab", "skill");
  if (wantsSkill) return hasSkill;
  if (hasSkill) return false;

  return true;
}

export function isNavItemActive(currentPath, item, resolvedPath) {
  const pathOnly = stripQuery(currentPath);
  const itemPath = stripQuery(resolvedPath || item.path);

  if (item.match === "exact" || itemPath === "/dashboard") {
    return pathOnly === "/dashboard";
  }

  if (item.match === "live-courts") {
    return (
      pathOnly === "/court-management" ||
      (pathOnly.startsWith("/court-management/") &&
        !pathOnly.startsWith("/court-management/courts") &&
        !pathOnly.startsWith("/court-management/calendar") &&
        !pathOnly.startsWith("/court-management/bookings") &&
        !pathOnly.startsWith("/court-management/revenue") &&
        !pathOnly.startsWith("/court-management/customers") &&
        !pathOnly.startsWith("/court-management/members"))
    );
  }

  if (item.match === "court-calendar") {
    return pathOnly.startsWith("/court-management/calendar");
  }

  if (item.match === "court-bookings") {
    return pathOnly.startsWith("/court-management/bookings");
  }

  if (item.match === "court-revenue" || item.match === "court-revenue-debt" || item.match === "court-revenue-peak") {
    return pathOnly.startsWith("/court-management/revenue");
  }

  if (item.match === "finance-debt") {
    return pathOnly.startsWith("/finance/debt");
  }

  if (item.match === "finance-receipts") {
    return pathOnly.startsWith("/finance/receipts");
  }

  if (item.match === "finance-refunds") {
    return pathOnly.startsWith("/finance/refunds");
  }

  if (item.match === "crm-messages") {
    return pathOnly.startsWith("/crm/messages");
  }

  if (item.match === "crm-templates") {
    return pathOnly.startsWith("/crm/templates");
  }

  if (item.match === "crm-campaigns") {
    return pathOnly.startsWith("/crm/campaigns");
  }

  if (item.match === "crm-history") {
    return pathOnly.startsWith("/crm/history");
  }

  if (item.match === "crm-booking-reminders") {
    return pathOnly.startsWith("/crm/reminders/booking");
  }

  if (item.match === "court-members") {
    return pathOnly.startsWith("/court-management/members");
  }

  if (item.match === "court-customers" || item.match === "court-customers-groups") {
    return (
      pathOnly.startsWith("/court-management/customers") &&
      matchPathWithOptionalQuery(currentPath, item, resolvedPath)
    );
  }

  if (item.match === "court-courts") {
    return pathOnly.startsWith("/court-management/courts");
  }

  if (item.match === "club-settings") {
    return pathOnly === "/club" || pathOnly.startsWith("/club/");
  }

  if (item.match === "my-club") {
    return pathOnly === "/my-club" || pathOnly.startsWith("/my-club/");
  }

  if (item.match === "discover-clubs") {
    return pathOnly === "/discover-clubs";
  }

  if (item.match === "seasons-only") {
    return pathOnly === "/club";
  }

  if (item.match === "bracket") {
    return pathOnly.includes("/bracket");
  }

  if (item.match === "tournament-home") {
    return pathOnly === "/tournament";
  }

  if (item.match === "tournament-list") {
    return pathOnly === "/tournament/list";
  }

  if (item.match === "tournament-create") {
    return pathOnly === "/tournament/create";
  }

  if (item.match === "tournament-types-hub") {
    return pathOnly === "/tournament/types" || pathOnly.startsWith("/tournament/types/");
  }

  if (item.match === "tournament-roster-hub") {
    return (
      pathOnly === "/tournament/roster" ||
      pathOnly === "/tournament/register" ||
      pathOnly.startsWith("/tournament/teams")
    );
  }

  if (item.match === "tournament-organize-hub") {
    return (
      pathOnly === "/tournament/organize" ||
      pathOnly === "/tournament/schedule" ||
      pathOnly === "/tournament/bracket" ||
      pathOnly === "/select-players"
    );
  }

  if (item.match === "tournament-operations-hub") {
    return (
      pathOnly === "/tournament/operations" ||
      pathOnly === "/tournament/match-reports" ||
      pathOnly === "/referee" ||
      pathOnly.startsWith("/referee/")
    );
  }

  if (item.match === "tournament-results-hub") {
    return (
      pathOnly === "/tournament/results" ||
      (pathOnly === "/statistics" &&
        (currentPath.includes("view=scoreboard") ||
          currentPath.includes("view=rankings") ||
          currentPath.includes("view=players")))
    );
  }

  if (item.match === "tournament-config-hub") {
    return pathOnly === "/tournament/config" || pathOnly.startsWith("/tournament/config/");
  }

  if (item.match === "reports-hub") {
    return pathOnly === "/reports";
  }

  if (item.match === "ai-hub") {
    return pathOnly === "/ai";
  }

  if (item.match === "support-hub") {
    return pathOnly === "/support" || pathOnly.startsWith("/support/") || pathOnly.startsWith("/billing/support");
  }

  if (item.match === "billing-current-plan") {
    return pathOnly === "/billing" || pathOnly === "/billing/current-plan";
  }

  if (item.match === "billing-upgrade") {
    return pathOnly === "/billing/upgrade";
  }

  if (item.match === "coaching-coaches") {
    return pathOnly === "/coaching/coaches";
  }

  if (item.match === "coaching-coach-list") {
    return pathOnly === "/coaching/coach-list";
  }

  if (item.match === "coaching-register") {
    return pathOnly === "/coaching/register";
  }

  if (item.match === "coaching-students") {
    return pathOnly === "/coaching/students";
  }

  if (item.match === "coaching-classes") {
    return pathOnly === "/coaching/classes";
  }

  if (item.match === "coaching-schedule") {
    return pathOnly === "/coaching/schedule";
  }

  if (item.match === "coaching-packages") {
    return pathOnly === "/coaching/packages";
  }

  if (item.match === "coaching-attendance") {
    return pathOnly === "/coaching/attendance";
  }

  if (item.match === "coaching-evaluations") {
    return pathOnly === "/coaching/evaluations";
  }

  if (item.match === "admin-hours") {
    return pathOnly === "/admin/hours";
  }

  if (item.match === "admin-staff") {
    return pathOnly === "/admin/staff";
  }

  if (item.match === "tournament-register") {
    return pathOnly === "/tournament/register";
  }

  if (item.match === "tournament-type-individual") {
    return pathOnly === "/tournament/types/individual";
  }

  if (item.match === "tournament-type-team") {
    return pathOnly === "/tournament/types/team";
  }

  if (item.match === "tournament-teams") {
    return pathOnly === "/tournament/teams";
  }

  if (item.match === "tournament-team-presets") {
    return pathOnly === "/tournament/teams/presets";
  }

  if (item.match === "tournament-team-build") {
    return pathOnly.startsWith("/tournament/teams/build/");
  }

  if (item.match === "tournament-schedule") {
    return (
      pathOnly === "/tournament/schedule" ||
      (pathOnly.startsWith("/tournaments/") && pathOnly.includes("/schedule"))
    );
  }

  if (item.match === "tournament-match-reports") {
    return (
      pathOnly === "/tournament/match-reports" ||
      (pathOnly.startsWith("/tournaments/") && pathOnly.endsWith("/logs"))
    );
  }

  if (item.match === "tournament-config") {
    return pathOnly.startsWith("/tournament/config/");
  }

  if (item.match === "court-engine") {
    return pathOnly.startsWith("/court-engine");
  }

  if (item.match === "statistics-scoreboard") {
    return pathOnly === "/statistics" && currentPath.includes("view=scoreboard");
  }

  if (item.match === "statistics-rankings") {
    return pathOnly === "/statistics" && currentPath.includes("view=rankings");
  }

  if (item.match === "statistics-players") {
    return pathOnly === "/statistics" && currentPath.includes("view=players");
  }

  if (item.match === "settings") {
    return pathOnly === "/settings" || pathOnly.startsWith("/settings/");
  }

  if (item.match === "daily-play") {
    return pathOnly === "/daily-play" || pathOnly.startsWith("/tournament/daily/");
  }

  if (item.match === "manage-clubs" || item.match === "clubs-create") {
    return pathOnly === "/manage/clubs" || pathOnly.startsWith("/manage/clubs/");
  }

  if (item.match === "club-members") {
    return (
      (pathOnly === "/players" || pathOnly.startsWith("/players/")) &&
      matchPathWithOptionalQuery(currentPath, item, resolvedPath)
    );
  }

  if (item.match === "players-skill") {
    return pathOnly === "/players/skill";
  }

  if (item.match === "player-skill") {
    return pathOnly === "/player/skill";
  }

  if (item.match === "player-skill-assessment") {
    return pathOnly === "/player/skill-assessment";
  }

  if (item.match === "players-roster") {
    if (pathOnly === "/players/skill") {
      return false;
    }
    if (pathOnly === "/player/skill" || pathOnly === "/player/skill-assessment") {
      return false;
    }
    return pathOnly === "/players" || pathOnly.startsWith("/players/");
  }

  if (item.match === "statistics-skill" || item.match === "statistics-history") {
    return pathOnly === "/statistics" || pathOnly.startsWith("/statistics/");
  }

  if (item.match === "users-roles") {
    return pathOnly === "/users";
  }

  if (item.match === "admin-roles") {
    return pathOnly === "/admin/roles";
  }

  if (item.match === "referee-hub") {
    return pathOnly === "/referee" || pathOnly.startsWith("/referee/");
  }

  if (pathOnly.startsWith("/coming-soon/") && itemPath.startsWith("/coming-soon/")) {
    return pathOnly === itemPath;
  }

  return pathOnly === itemPath || pathOnly.startsWith(`${itemPath}/`);
}

export function groupHasActiveItem(currentPath, group, user, resolvePath) {
  return group.items.some((item) => treeHasActiveItem(currentPath, item, user, resolvePath));
}

export function treeHasActiveItem(currentPath, item, user, resolvePath) {
  if (item.children?.length) {
    return item.children.some((child) => treeHasActiveItem(currentPath, child, user, resolvePath));
  }

  const path = resolvePath(item, user);
  if (!path) return false;
  return isNavItemActive(currentPath, item, path);
}
