/**
 * Canonical tournament load policy — Phase 2E no-flicker.
 *
 * Same tournament + same tenant + usable data → soft background revalidation.
 * Identity/tenant/tournament change → hard clear.
 * Transient empty clubId (token refresh / club hydrate flicker) → keep mounted data.
 */

export function resolveCanonicalTournamentLoadPolicy({
  clubId = "",
  tournamentId = "",
  tenantId = "",
  prevClubId = "",
  prevTournamentId = "",
  prevTenantId = "",
  hasUsableTournament = false,
  usableTournamentId = "",
  authzFingerprint = "",
  prevAuthzFingerprint = "",
} = {}) {
  const nextClubId = String(clubId || "").trim();
  const nextTournamentId = String(tournamentId || "").trim();
  const nextTenantId = String(tenantId || "").trim();
  const prevClub = String(prevClubId || "").trim();
  const prevTournament = String(prevTournamentId || "").trim();
  const prevTenant = String(prevTenantId || "").trim();
  const nextFp = String(authzFingerprint || "").trim();
  const prevFp = String(prevAuthzFingerprint || "").trim();
  const authzChanged = prevFp !== nextFp && (Boolean(prevFp) || Boolean(nextFp));

  if (authzChanged) {
    return {
      mode: "hard-clear",
      identityChanged: true,
      soft: false,
      clearTournament: true,
      showFullPageLoader: Boolean(nextClubId && nextTournamentId),
      updateIdentity: true,
    };
  }

  if (!nextClubId || !nextTournamentId) {
    const keepTransient =
      Boolean(nextTournamentId) &&
      hasUsableTournament &&
      String(usableTournamentId || "") === nextTournamentId &&
      !authzChanged &&
      Boolean(prevFp) &&
      prevFp === nextFp;
    if (keepTransient) {
      return {
        mode: "keep-transient",
        identityChanged: false,
        soft: true,
        clearTournament: false,
        showFullPageLoader: false,
        updateIdentity: false,
      };
    }
    return {
      mode: "hard-clear",
      identityChanged: true,
      soft: false,
      clearTournament: true,
      showFullPageLoader: false,
      updateIdentity: true,
    };
  }

  const clubChanged = Boolean(prevClub) && prevClub !== nextClubId;
  const tournamentChanged =
    Boolean(prevTournament) && prevTournament !== nextTournamentId;
  const tenantChanged = Boolean(prevTenant) && Boolean(nextTenantId) && prevTenant !== nextTenantId;
  const identityChanged = clubChanged || tournamentChanged || tenantChanged;

  if (identityChanged) {
    return {
      mode: "hard-clear",
      identityChanged: true,
      soft: false,
      clearTournament: true,
      showFullPageLoader: true,
      updateIdentity: true,
    };
  }

  if (hasUsableTournament) {
    return {
      mode: "soft-revalidate",
      identityChanged: false,
      soft: true,
      clearTournament: false,
      showFullPageLoader: false,
      updateIdentity: true,
    };
  }

  return {
    mode: "hard-load",
    identityChanged: false,
    soft: false,
    clearTournament: false,
    showFullPageLoader: true,
    updateIdentity: true,
  };
}
