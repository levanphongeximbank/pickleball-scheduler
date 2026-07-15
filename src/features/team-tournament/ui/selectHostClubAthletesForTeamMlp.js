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
    // Require explicit canonical athlete id — do not treat bare blob player.id as athleteId.
    const athleteId = String(player.athleteId || "").trim();
    if (!athleteId) return false;
    if (player.active === false) return false;
    if (clubKey) {
      const playerClub = String(player.clubId || "").trim();
      if (playerClub && playerClub !== clubKey) return false;
    }
    return true;
  });
}
