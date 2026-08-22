/**
 * Canonical production referee workspace routes inside MainLayout.
 * Legacy `/referee/:token` scoreboard is outside the app shell.
 */
export function isRefereeWorkspaceRoute(pathname = "") {
  const path = String(pathname || "").split("?")[0];
  if (path === "/referee") return true;
  if (path.startsWith("/referee/match/")) return true;
  return false;
}
