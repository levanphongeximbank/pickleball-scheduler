/**
 * Referee portal competition-scoped athlete directory projection.
 *
 * Mirrors captainPortalRosterProjection: the referee never resolves athlete
 * identity from CLUB membership (club_list_members / profiles RLS). Names and
 * genders come from the competition directory RPC — or, as a last resort, from
 * rosterAthletes already embedded in the canonical setup payload.
 */

export const REFEREE_COMPETITION_SCOPED = "REFEREE_COMPETITION_SCOPED";

/** teamData carrier key for the competition-scoped athlete directory. */
export const REFEREE_COMPETITION_ATHLETES_KEY = "__refereeCompetitionAthletes";

/**
 * Accept array or JSON-string rows (PostgREST/json nesting).
 * @param {unknown} raw
 * @returns {object[]}
 */
export function parseRefereeCompetitionAthletes(raw) {
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

function normalizeGender(raw) {
  if (raw == null || !String(raw).trim()) {
    return null;
  }
  const value = String(raw).trim().toLowerCase();
  if (value === "male" || value === "m" || value === "nam") return "male";
  if (value === "female" || value === "f" || value === "nu" || value === "nữ") {
    return "female";
  }
  return value;
}

/**
 * @param {unknown} raw
 * @returns {{ athleteId: string, displayName: string, gender: string|null }[]}
 */
export function normalizeRefereeCompetitionAthletes(raw = []) {
  const rows = parseRefereeCompetitionAthletes(raw);
  const out = [];
  const seen = new Set();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const athleteId = String(
      row.athleteId || row.athlete_id || row.pairingIdentityId || row.id || ""
    ).trim();
    if (!athleteId || seen.has(athleteId)) continue;
    seen.add(athleteId);

    const displayName =
      String(
        row.displayName || row.display_name || row.name || athleteId
      ).trim() || athleteId;

    out.push({
      athleteId,
      displayName,
      gender: normalizeGender(row.gender),
    });
  }

  return out;
}

/**
 * Project directory rows into athlete-pool rows consumed by
 * hydrateTeamRoster / listRefereeMatchupSummaries / buildRefereeMatchupView.
 * @param {unknown} raw
 * @returns {object[]}
 */
export function projectRefereeCompetitionAthletePlayers(raw = []) {
  return normalizeRefereeCompetitionAthletes(raw).map((row) => ({
    id: row.athleteId,
    athleteId: row.athleteId,
    name: row.displayName,
    displayName: row.displayName,
    gender: row.gender,
    genderSource: REFEREE_COMPETITION_SCOPED,
  }));
}

/**
 * Fallback directory: rosterAthletes already present on canonical teams.
 * Used when the competition directory RPC is not deployed — never club members.
 * @param {object|null|undefined} teamData
 * @returns {{ athleteId: string, displayName: string, gender: string|null }[]}
 */
export function collectRefereeCompetitionAthletesFromTeamData(teamData) {
  const carried = normalizeRefereeCompetitionAthletes(
    teamData?.[REFEREE_COMPETITION_ATHLETES_KEY]
  );
  const merged = new Map(carried.map((row) => [row.athleteId, row]));

  for (const team of teamData?.teams || []) {
    const rows = normalizeRefereeCompetitionAthletes(
      team?.rosterAthletes || team?.roster_athletes
    );
    for (const row of rows) {
      const existing = merged.get(row.athleteId);
      if (!existing || (!existing.gender && row.gender)) {
        merged.set(row.athleteId, row);
      }
    }
  }

  return [...merged.values()];
}

/**
 * @param {object|null|undefined} teamData
 * @returns {{ athleteId: string, displayName: string, gender: string|null }[]}
 */
export function readRefereeCompetitionAthletes(teamData) {
  return normalizeRefereeCompetitionAthletes(
    teamData?.[REFEREE_COMPETITION_ATHLETES_KEY]
  );
}

/**
 * @param {object|null|undefined} teamData
 * @param {unknown} athletes
 * @returns {object|null|undefined}
 */
export function attachRefereeCompetitionAthletes(teamData, athletes) {
  if (!teamData || typeof teamData !== "object") {
    return teamData;
  }
  const rows = normalizeRefereeCompetitionAthletes(athletes);
  if (rows.length === 0) {
    return teamData;
  }
  return {
    ...teamData,
    [REFEREE_COMPETITION_ATHLETES_KEY]: rows,
  };
}

/**
 * Keep the previously resolved competition directory (and team rosterAthletes)
 * when a later poll / get_setup / mutation readback drops those fields.
 * @param {object|null|undefined} previousTeamData
 * @param {object|null|undefined} nextTeamData
 * @returns {object|null|undefined}
 */
export function preserveRefereeCompetitionAthletes(previousTeamData, nextTeamData) {
  if (!nextTeamData || typeof nextTeamData !== "object") {
    return nextTeamData;
  }

  let changed = false;
  let next = nextTeamData;

  const incomingDirectory = readRefereeCompetitionAthletes(nextTeamData);
  if (incomingDirectory.length === 0) {
    const preservedDirectory = readRefereeCompetitionAthletes(previousTeamData);
    if (preservedDirectory.length > 0) {
      next = { ...next, [REFEREE_COMPETITION_ATHLETES_KEY]: preservedDirectory };
      changed = true;
    }
  }

  const nextTeams = Array.isArray(nextTeamData.teams) ? nextTeamData.teams : [];
  if (nextTeams.length > 0) {
    const prevById = new Map(
      (previousTeamData?.teams || []).map((row) => [String(row?.id || ""), row])
    );
    let teamsChanged = false;
    const teams = nextTeams.map((team) => {
      const incoming = normalizeRefereeCompetitionAthletes(
        team?.rosterAthletes || team?.roster_athletes
      );
      if (incoming.length > 0) {
        return team;
      }
      const prev = prevById.get(String(team?.id || ""));
      const preserved = normalizeRefereeCompetitionAthletes(
        prev?.rosterAthletes || prev?.roster_athletes
      );
      if (preserved.length === 0) {
        return team;
      }
      teamsChanged = true;
      return { ...team, rosterAthletes: preserved };
    });
    if (teamsChanged) {
      next = { ...next, teams };
      changed = true;
    }
  }

  return changed ? next : nextTeamData;
}
