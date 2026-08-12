/**
 * Project SECURITY DEFINER captain-portal own-team rosterAthletes into
 * lineup athlete pool rows. Gender/displayName come from the portal contract —
 * not from profiles RLS (PLAYER self-only).
 */

import { getPlayerGenderKey } from "../../../models/player.js";

export const CAPTAIN_PORTAL_SCOPED_ROSTER = "CAPTAIN_PORTAL_SCOPED_ROSTER";

function hasCanonicalBinaryGender(value) {
  const key = getPlayerGenderKey(value);
  return key === "male" || key === "female";
}

/**
 * Accept array or JSON-string rosterAthletes (PostgREST/json nesting).
 * @param {unknown} raw
 * @returns {object[]}
 */
export function parseCaptainPortalRosterAthletes(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * @param {unknown} raw
 * @returns {{ athleteId: string, displayName: string, gender: string|null }[]}
 */
export function normalizeCaptainPortalRosterAthletes(raw = []) {
  const rows = parseCaptainPortalRosterAthletes(raw);
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const out = [];
  for (const row of rows) {
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

function rosterRowsOf(team) {
  return normalizeCaptainPortalRosterAthletes(
    team?.rosterAthletes || team?.roster_athletes
  );
}

function pickRosterTeam(team, dataTeam) {
  if (rosterRowsOf(team).length > 0) return team;
  if (rosterRowsOf(dataTeam).length > 0) return dataTeam;
  return team || dataTeam || null;
}

/**
 * Prefer portal scoped roster when present; never call profiles to repair gender.
 * Looks at card `team` AND `teamData.teams[teamId]` so options and validator
 * cannot diverge after poll/get_setup/applyCanonical copies.
 * @param {{
 *   team?: object|null,
 *   teamData?: object|null,
 *   teamId?: string|null,
 *   clubPlayers?: object[],
 * }} args
 * @returns {object[]}
 */
export function resolveCaptainLineupAthletePool({
  team = null,
  teamData = null,
  teamId = null,
  clubPlayers = [],
} = {}) {
  const id = String(teamId || team?.id || "").trim();
  const dataTeam =
    teamData && id
      ? (teamData.teams || []).find((row) => String(row?.id || "") === id) || null
      : null;
  const rosterTeam = pickRosterTeam(team, dataTeam);
  const portal = projectCaptainPortalRosterPlayers(
    rosterTeam?.rosterAthletes || rosterTeam?.roster_athletes
  );
  if (portal.length > 0) {
    return overlayCaptainPortalRosterOnPool(
      rosterTeam,
      Array.isArray(clubPlayers) && clubPlayers.length > 0 ? clubPlayers : portal
    );
  }
  return Array.isArray(clubPlayers) ? clubPlayers : [];
}

/**
 * Keep previously loaded captain-scoped rosterAthletes when a later get_setup /
 * poll / mutation readback returns the same teams without that field.
 * @param {object|null|undefined} previousTeamData
 * @param {object|null|undefined} nextTeamData
 * @returns {object|null|undefined}
 */
export function preserveCaptainPortalRosterAthletes(previousTeamData, nextTeamData) {
  if (!nextTeamData || typeof nextTeamData !== "object") {
    return nextTeamData;
  }
  const nextTeams = Array.isArray(nextTeamData.teams) ? nextTeamData.teams : [];
  if (nextTeams.length === 0) {
    return nextTeamData;
  }
  const prevById = new Map(
    (previousTeamData?.teams || []).map((row) => [String(row?.id || ""), row])
  );
  let changed = false;
  const teams = nextTeams.map((team) => {
    const incoming = rosterRowsOf(team);
    if (incoming.length > 0) {
      return team.rosterAthletes === incoming ? team : { ...team, rosterAthletes: incoming };
    }
    const prev = prevById.get(String(team?.id || ""));
    const preserved = rosterRowsOf(prev);
    if (preserved.length === 0) {
      return team;
    }
    changed = true;
    const playerIds =
      Array.isArray(team.playerIds) && team.playerIds.length > 0
        ? team.playerIds
        : Array.isArray(prev?.playerIds)
          ? prev.playerIds
          : preserved.map((row) => row.athleteId);
    return {
      ...team,
      playerIds,
      rosterAthletes: preserved,
    };
  });
  if (!changed) {
    return nextTeamData;
  }
  return {
    ...nextTeamData,
    teams,
  };
}

/**
 * Overlay scoped portal gender/name onto a club athlete pool.
 * Portal fields win. Used by hydrateTeamRoster so options/validation
 * stay fail-closed on unknown gender without profiles RLS repair.
 * @param {object|null|undefined} team
 * @param {object[]} athletePool
 * @returns {object[]}
 */
export function overlayCaptainPortalRosterOnPool(team = null, athletePool = []) {
  const portal = projectCaptainPortalRosterPlayers(
    team?.rosterAthletes || team?.roster_athletes
  );
  if (portal.length === 0) {
    return Array.isArray(athletePool) ? athletePool : [];
  }

  const byAthleteId = new Map();
  const rememberClubRow = (row) => {
    if (!row || typeof row !== "object") return;
    const athleteId = String(
      row.athleteId || row.pairingIdentityId || row.id || ""
    ).trim();
    if (!athleteId) return;
    const existing = byAthleteId.get(athleteId);
    if (!existing) {
      byAthleteId.set(athleteId, row);
      return;
    }
    if (hasCanonicalBinaryGender(row) && !hasCanonicalBinaryGender(existing)) {
      byAthleteId.set(athleteId, row);
    }
  };

  for (const row of athletePool || []) rememberClubRow(row);

  for (const row of portal) {
    const existing = byAthleteId.get(row.athleteId) || {};
    byAthleteId.set(row.athleteId, {
      ...existing,
      ...row,
      id: row.athleteId,
      athleteId: row.athleteId,
      name: row.name || existing.name || existing.displayName || row.displayName,
      displayName:
        row.displayName || existing.displayName || existing.name || row.name,
      gender: row.gender,
      genderSource: row.genderSource || CAPTAIN_PORTAL_SCOPED_ROSTER,
    });
  }
  return [...byAthleteId.values()];
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
