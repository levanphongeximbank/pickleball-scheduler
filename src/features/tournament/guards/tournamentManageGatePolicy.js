/**
 * Keep a loaded tournament shell mounted during same-scope background reload.
 * Only block when RBAC is on and this tournament has not been loaded yet.
 */
export function shouldBlockTournamentManageGate({
  rbacEnabled = false,
  isAuthenticated = false,
  tournamentId = null,
  loading = false,
  tournament = null,
} = {}) {
  if (!rbacEnabled || !isAuthenticated) return false;
  if (!tournamentId) return false;
  if (!loading) return false;
  const loadedId = tournament?.id || tournament?.tournamentId || null;
  if (loadedId && String(loadedId) === String(tournamentId)) return false;
  return true;
}
