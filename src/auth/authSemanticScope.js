/**
 * Semantic application-auth fingerprints.
 * Token refresh / new object identity must not look like a user or scope change.
 * Real id/role/tenant/venue/club/status/RBAC changes must still rehydrate fail-closed.
 */

function norm(value) {
  if (value == null || value === "") return "";
  return String(value).trim();
}

function clusterKey(user) {
  if (!Array.isArray(user?.assignedClusterIds)) return "";
  return user.assignedClusterIds.map((id) => String(id).trim()).filter(Boolean).sort().join(",");
}

/**
 * Full semantic auth fingerprint — used to keep React auth state stable across
 * TOKEN_REFRESHED / repeated SIGNED_IN object identity churn.
 */
export function buildUserSecurityScopeKey(user) {
  if (!user?.id) return "";
  return [
    buildClubRehydrateScopeKey(user),
    norm(user.tournamentId),
    norm(user.teamId),
    norm(user.playerId),
    clusterKey(user),
  ].join("|");
}

/**
 * Club/tenant rehydrate key — id/role/tenant/venue/club/status/email only.
 * Async profile enrichment (clusters, playerId, tournamentId, teamId) after
 * TOKEN_REFRESHED must not clear clubs or remount a loaded Daily Play shell.
 * Real user/tenant/role/club/status change still fail-closed.
 */
export function buildClubRehydrateScopeKey(user) {
  if (!user?.id) return "";
  return [
    norm(user.id),
    norm(user.role),
    norm(user.tenantId),
    norm(user.venueId),
    norm(user.clubId),
    norm(user.status || "active"),
    user.mustChangePassword ? "1" : "0",
    String(user.email || "").trim().toLowerCase(),
  ].join("|");
}

export function buildAuthStateSecurityKey(state) {
  if (!state) return "anon";
  return [
    state.isAuthenticated ? "1" : "0",
    state.rbacEnabled ? "1" : "0",
    state.authProductionEnabled ? "1" : "0",
    String(state.authProvider || ""),
    buildUserSecurityScopeKey(state.user),
  ].join("::");
}

export function areAuthStatesSemanticallyEqual(previous, next) {
  return buildAuthStateSecurityKey(previous) === buildAuthStateSecurityKey(next);
}

export function selectStableAuthState(previous, next) {
  if (previous && areAuthStatesSemanticallyEqual(previous, next)) {
    return previous;
  }
  return next;
}

export function shouldRehydrateClubScope(previousKey, nextKey) {
  return String(previousKey || "") !== String(nextKey || "");
}
