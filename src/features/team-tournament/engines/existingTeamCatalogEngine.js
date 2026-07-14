/**
 * S2-B — Existing team catalog + clone-into-tournament (no shared club registry).
 * Source of truth: teams already saved on team tournaments in the club blob.
 */

import { createTeamRecord } from "../models/index.js";
import { findPlayerTeam } from "./teamRosterEngine.js";

function uniqueTeamName(baseName, existingNames = []) {
  const base = String(baseName || "Đội").trim() || "Đội";
  const taken = new Set(
    (existingNames || []).map((name) => String(name || "").trim().toLowerCase())
  );
  if (!taken.has(base.toLowerCase())) {
    return base;
  }
  let index = 2;
  while (taken.has(`${base} (${index})`.toLowerCase())) {
    index += 1;
  }
  return `${base} (${index})`;
}

/**
 * Flatten teams across team tournaments into a selectable catalog.
 */
export function listExistingTeamCatalog(tournaments = [], options = {}) {
  const excludeTournamentId = options.excludeTournamentId
    ? String(options.excludeTournamentId)
    : "";
  const includeEmpty = options.includeEmpty === true;
  const entries = [];

  (tournaments || []).forEach((tournament) => {
    if (!tournament?.id) return;
    const tournamentId = String(tournament.id);
    if (excludeTournamentId && tournamentId === excludeTournamentId) {
      return;
    }
    const teams = tournament?.teamData?.teams || [];
    teams.forEach((team) => {
      if (!team?.id) return;
      const playerCount = (team.playerIds || []).length;
      if (!includeEmpty && playerCount === 0) return;
      entries.push({
        key: `${tournamentId}::${team.id}`,
        sourceTournamentId: tournamentId,
        sourceTournamentName: tournament.name || tournamentId,
        sourceTournamentStatus: tournament.status || "",
        sourceTeamId: String(team.id),
        name: team.name || team.id,
        playerCount,
        captainPlayerId: team.captainPlayerId || "",
        color: team.color || "",
        logoUrl: team.logoUrl || "",
        sourceTeam: team,
      });
    });
  });

  return entries.sort((a, b) => {
    const byName = String(a.name).localeCompare(String(b.name), "vi");
    if (byName !== 0) return byName;
    return String(a.sourceTournamentName).localeCompare(
      String(b.sourceTournamentName),
      "vi"
    );
  });
}

/**
 * Build a new team record for the target tournament (new id, copied roster).
 * Conflicting players already on a target team are skipped (with warnings).
 */
export function buildClonedTeamForTournament(sourceTeam, targetTeamData, options = {}) {
  if (!sourceTeam?.id) {
    return { ok: false, error: "Thiếu đội nguồn.", code: "SOURCE_TEAM_MISSING" };
  }

  const allowCrossTeam = targetTeamData?.settings?.allowPlayerCrossTeam === true;
  const existingNames = (targetTeamData?.teams || []).map((team) => team.name);
  const desiredName = options.name != null ? String(options.name) : sourceTeam.name;
  const name = uniqueTeamName(desiredName, existingNames);

  const skippedPlayerIds = [];
  const playerIds = [];

  (sourceTeam.playerIds || []).forEach((playerId) => {
    const id = String(playerId || "").trim();
    if (!id) return;
    if (!allowCrossTeam) {
      const existing = findPlayerTeam(targetTeamData, id);
      if (existing) {
        skippedPlayerIds.push(id);
        return;
      }
    }
    if (!playerIds.includes(id)) {
      playerIds.push(id);
    }
  });

  if (playerIds.length === 0 && (sourceTeam.playerIds || []).length > 0) {
    return {
      ok: false,
      error:
        "Không sao chép được: mọi VĐV của đội nguồn đã thuộc đội khác trong giải này.",
      code: "ALL_PLAYERS_CONFLICT",
      skippedPlayerIds,
    };
  }

  let captainPlayerId = sourceTeam.captainPlayerId
    ? String(sourceTeam.captainPlayerId).trim()
    : "";
  if (captainPlayerId && !playerIds.includes(captainPlayerId)) {
    captainPlayerId = playerIds[0] || "";
  }

  const deputyPlayerIds = (sourceTeam.deputyPlayerIds || [])
    .map((id) => String(id || "").trim())
    .filter((id) => id && playerIds.includes(id) && id !== captainPlayerId);

  const teamRecord = createTeamRecord({
    name,
    color: sourceTeam.color || "",
    logoUrl: sourceTeam.logoUrl || "",
    playerIds,
    captainPlayerId,
    deputyPlayerIds,
    seed: 0,
    avgLevel: sourceTeam.avgLevel,
    topPlayerRating: sourceTeam.topPlayerRating,
    totalRating: sourceTeam.totalRating,
  });

  teamRecord.clonedFrom = {
    tournamentId: options.sourceTournamentId
      ? String(options.sourceTournamentId)
      : "",
    teamId: String(sourceTeam.id),
    teamName: sourceTeam.name || sourceTeam.id,
    clonedAt: options.clonedAt || new Date().toISOString(),
  };

  const warnings = [];
  if (skippedPlayerIds.length > 0) {
    warnings.push(
      `Đã bỏ qua ${skippedPlayerIds.length} VĐV đã thuộc đội khác trong giải đích.`
    );
  }
  if (
    sourceTeam.captainPlayerId &&
    String(sourceTeam.captainPlayerId) !== String(captainPlayerId)
  ) {
    warnings.push("Đội trưởng nguồn bị bỏ qua — đã gán đội trưởng mới trong bản sao.");
  }

  return {
    ok: true,
    teamRecord,
    skippedPlayerIds,
    warnings,
  };
}

export function findCatalogEntry(catalog = [], sourceTournamentId, sourceTeamId) {
  const tid = String(sourceTournamentId || "");
  const teamId = String(sourceTeamId || "");
  return (
    (catalog || []).find(
      (entry) =>
        entry.sourceTournamentId === tid && entry.sourceTeamId === teamId
    ) || null
  );
}

export { uniqueTeamName };
