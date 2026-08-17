/**
 * Auth-owned Tournament Access port (Wave 2 public capability contract).
 *
 * Route gates consume only this neutral contract.
 * Competition/Club bind the implementation at the composition root.
 * Unbound → fail-closed (NOT_CONFIGURED), never pretend configured.
 */

const FAIL_CLOSED_ACCESS = Object.freeze({
  ok: false,
  code: "TOURNAMENT_ACCESS_NOT_CONFIGURED",
  error: "Tournament access capability is not bound.",
  tournament: null,
});

/** @type {{
 *   assertTournamentAccess: Function,
 *   resolveTournamentClubId: Function,
 * } | null} */
let bound = null;

/**
 * @param {{
 *   assertTournamentAccess: (clubId: string, tournamentId: string, options?: object) => object,
 *   resolveTournamentClubId: (preferredClubId: string|null, tournamentId: string) => string|null,
 * }} impl
 */
export function bindTournamentAccessPort(impl) {
  if (
    !impl ||
    typeof impl.assertTournamentAccess !== "function" ||
    typeof impl.resolveTournamentClubId !== "function"
  ) {
    throw new Error("bindTournamentAccessPort requires assertTournamentAccess and resolveTournamentClubId");
  }
  bound = {
    assertTournamentAccess: impl.assertTournamentAccess,
    resolveTournamentClubId: impl.resolveTournamentClubId,
  };
}

export function isTournamentAccessPortBound() {
  return bound != null;
}

export function assertTournamentAccessViaPort(clubId, tournamentId, options = {}) {
  if (!bound) {
    return { ...FAIL_CLOSED_ACCESS };
  }
  return bound.assertTournamentAccess(clubId, tournamentId, options);
}

export function resolveTournamentClubIdViaPort(preferredClubId, tournamentId) {
  if (!bound) {
    return null;
  }
  return bound.resolveTournamentClubId(preferredClubId, tournamentId);
}

/** Test helper */
export function __resetTournamentAccessPortForTests() {
  bound = null;
}
