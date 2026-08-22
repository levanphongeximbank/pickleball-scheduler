/**
 * Stable authorization principal fingerprint for PICK_VN.
 *
 * Distinguishes harmless same-principal TOKEN_REFRESHED (new object / new JWT)
 * from authorization-relevant profile/scope changes that must rehydrate.
 *
 * Fields are only those the app already uses for access (see models/user.js + rbac).
 * Does not include displayName, email, avatar, or access-token value.
 */

function part(value) {
  return String(value || "").trim();
}

function clusterPart(user) {
  if (!Array.isArray(user?.assignedClusterIds) || user.assignedClusterIds.length === 0) {
    return "";
  }
  return user.assignedClusterIds.map((id) => part(id)).filter(Boolean).sort().join(",");
}

export function buildAuthorizationPrincipalFingerprint(user, extras = {}) {
  if (!user?.id) {
    return "";
  }
  return [
    part(user.id),
    part(user.role),
    part(user.status),
    part(user.tenantId),
    part(user.venueId),
    part(user.clubId),
    part(user.tournamentId),
    part(user.teamId),
    part(user.playerId),
    clusterPart(user),
    extras.rbacEnabled === true ? "rbac1" : "rbac0",
    part(extras.currentTenantId),
  ].join("|");
}

export function authorizationPrincipalChanged(previousFingerprint, nextFingerprint) {
  const prev = part(previousFingerprint);
  const next = part(nextFingerprint);
  return prev !== next;
}

/**
 * TOKEN_REFRESHED may skip expensive React user/profile rehydration only when
 * the synced principal/authz fingerprint is unchanged.
 * The Supabase client session/token is updated by onAuthStateChange independently.
 */
export function shouldSkipAuthUiRefreshOnTokenEvent({
  event,
  previousFingerprint,
  nextUser,
  rbacEnabled = false,
  currentTenantId = "",
} = {}) {
  if (event !== "TOKEN_REFRESHED") {
    return false;
  }
  if (!nextUser?.id) {
    return false;
  }
  const nextFingerprint = buildAuthorizationPrincipalFingerprint(nextUser, {
    rbacEnabled,
    currentTenantId,
  });
  if (!previousFingerprint || !nextFingerprint) {
    return false;
  }
  return previousFingerprint === nextFingerprint;
}
