export function stripQuery(path = "") {
  return String(path).split("?")[0];
}

export function isNavItemActive(currentPath, item, resolvedPath) {
  const itemPath = stripQuery(resolvedPath || item.path);

  if (item.match === "exact" || itemPath === "/") {
    return currentPath === "/";
  }

  if (item.match === "live-courts") {
    return (
      currentPath === "/court-management" ||
      (currentPath.startsWith("/court-management/") &&
        !currentPath.startsWith("/court-management/courts") &&
        !currentPath.startsWith("/court-management/calendar") &&
        !currentPath.startsWith("/court-management/bookings") &&
        !currentPath.startsWith("/court-management/revenue") &&
        !currentPath.startsWith("/court-management/customers"))
    );
  }

  if (item.match === "court-calendar") {
    return currentPath.startsWith("/court-management/calendar");
  }

  if (item.match === "court-bookings") {
    return currentPath.startsWith("/court-management/bookings");
  }

  if (item.match === "court-revenue" || item.match === "court-revenue-debt" || item.match === "court-revenue-peak") {
    return currentPath.startsWith("/court-management/revenue");
  }

  if (item.match === "court-customers" || item.match === "court-customers-groups") {
    return currentPath.startsWith("/court-management/customers");
  }

  if (item.match === "court-courts") {
    return currentPath.startsWith("/court-management/courts");
  }

  if (item.match === "club-settings") {
    return currentPath === "/club" || currentPath.startsWith("/club/");
  }

  if (item.match === "seasons-only") {
    return currentPath === "/club";
  }

  if (item.match === "bracket") {
    return currentPath.includes("/bracket");
  }

  if (item.match === "tournament-home") {
    return currentPath === "/tournament";
  }

  if (item.match === "tournament-create" || item.match === "tournament-register") {
    return currentPath === "/tournament";
  }

  if (item.match === "tournament-schedule" || item.match === "court-engine") {
    return currentPath.startsWith("/court-engine");
  }

  if (item.match === "daily-play") {
    return currentPath === "/daily-play" || currentPath.startsWith("/tournament/daily/");
  }

  if (item.match === "clubs" || item.match === "clubs-create") {
    return currentPath === "/clubs" || currentPath.startsWith("/clubs/");
  }

  if (item.match === "club-members") {
    return currentPath === "/players" || currentPath.startsWith("/players/");
  }

  if (item.match === "statistics-skill" || item.match === "statistics-history") {
    return currentPath === "/statistics" || currentPath.startsWith("/statistics/");
  }

  if (item.match === "users-roles") {
    return currentPath === "/users";
  }

  if (item.match === "referee-hub") {
    return currentPath === "/referee" || currentPath.startsWith("/referee/");
  }

  if (currentPath.startsWith("/coming-soon/") && itemPath.startsWith("/coming-soon/")) {
    return currentPath === itemPath;
  }

  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

export function groupHasActiveItem(currentPath, group, user, resolvePath) {
  return group.items.some((item) => {
    const path = resolvePath(item, user);
    if (!path) return false;
    return isNavItemActive(currentPath, item, path);
  });
}
