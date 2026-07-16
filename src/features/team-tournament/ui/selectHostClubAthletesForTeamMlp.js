/**
 * Keep only host-club canonical athletes for Team MLP AI pairing.
 * Primary id = athletes.id; blob/tenant merges are not used as authority.
 *
 * @param {Array<Record<string, unknown>>} [players]
 * @param {string} [hostClubId]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectHostClubAthletesForTeamMlp(players = [], hostClubId = "") {
  const clubKey = String(hostClubId || "").trim();
  return (players || []).filter((player) => {
    if (!player) return false;
    // athletes.id only — never promote bare blob player.id as pairing identity.
    const athleteId = String(player.athleteId || player.pairingIdentityId || "").trim();
    if (!athleteId) return false;
    if (player.active === false) return false;
    if (clubKey) {
      const playerClub = String(player.clubId || player.sourceClubId || "").trim();
      if (playerClub && playerClub !== clubKey) return false;
    }
    return true;
  });
}
