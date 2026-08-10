/**
 * Project SECURITY DEFINER captain-portal own-team rosterAthletes into
 * lineup athlete pool rows. Gender/displayName come from the portal contract —
 * not from profiles RLS (PLAYER self-only).
 */

export const CAPTAIN_PORTAL_SCOPED_ROSTER = "CAPTAIN_PORTAL_SCOPED_ROSTER";

/**
 * @param {unknown} raw
 * @returns {{ athleteId: string, displayName: string, gender: string|null }[]}
 */
export function normalizeCaptainPortalRosterAthletes(raw = []) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const athleteId = String(
      row.athleteId || row.athlete_id || row.id || ""
    ).trim();
    if (!athleteId) continue;

    const displayName = String(
      row.displayName || row.display_name || athleteId
    ).trim() || athleteId;

    const genderRaw = row.gender;
    let gender = null;
    if (genderRaw != null && String(genderRaw).trim()) {
      const g = String(genderRaw).trim().toLowerCase();
      if (g === "male" || g === "m" || g === "nam") gender = "male";
      else if (g === "female" || g === "f" || g === "nu" || g === "nữ") {
        gender = "female";
      } else {
        gender = g;
      }
    }

    out.push({ athleteId, displayName, gender });
  }
  return out;
}

/**
 * @param {unknown} rosterAthletes
 * @returns {object[]}
 */
export function projectCaptainPortalRosterPlayers(rosterAthletes = []) {
  return normalizeCaptainPortalRosterAthletes(rosterAthletes).map((row) => ({
    id: row.athleteId,
    athleteId: row.athleteId,
    name: row.displayName,
    displayName: row.displayName,
    gender: row.gender,
    genderSource: CAPTAIN_PORTAL_SCOPED_ROSTER,
  }));
}

/**
 * Prefer portal scoped roster when present; never call profiles to repair gender.
 * @param {{ team?: object|null, clubPlayers?: object[] }} args
 * @returns {object[]}
 */
export function resolveCaptainLineupAthletePool({ team = null, clubPlayers = [] } = {}) {
  const portal = projectCaptainPortalRosterPlayers(team?.rosterAthletes);
  if (portal.length > 0) {
    return portal;
  }
  return Array.isArray(clubPlayers) ? clubPlayers : [];
}

/**
 * Enrich myTeam / team row with normalized rosterAthletes + playerIds.
 * @param {object|null|undefined} team
 * @returns {object|null|undefined}
 */
export function enrichTeamWithCaptainPortalRoster(team) {
  if (!team || typeof team !== "object") {
    return team;
  }
  const rosterAthletes = normalizeCaptainPortalRosterAthletes(
    team.rosterAthletes || team.roster_athletes
  );
  const existingIds = Array.isArray(team.playerIds)
    ? team.playerIds.map(String).filter(Boolean)
    : [];
  const playerIds =
    existingIds.length > 0
      ? existingIds
      : rosterAthletes.map((row) => row.athleteId);

  return {
    ...team,
    playerIds,
    rosterAthletes,
  };
}
