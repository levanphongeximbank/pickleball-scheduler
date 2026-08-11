/**
 * Map team_tournament_get_captain_portal envelope → get_setup-compatible shape.
 * Remaps lineup keys to matchupId::teamId (client lineupKey contract).
 */

import { lineupKey } from "../models/index.js";
import { normalizeV7TournamentForAggregate } from "./mapGetSetupV7.js";
import { applyCanonicalMlpDisciplineMetadata } from "../engines/mlpDisciplineSlotContract.js";
import { enrichTeamWithCaptainPortalRoster } from "../engines/captainPortalRosterProjection.js";
import { projectCaptainPortalMatchupsDreambreaker } from "../engines/captainDreambreakerPortalContract.js";

/**
 * @param {object|null|undefined} lineups
 * @returns {object}
 */
export function remapCaptainPortalLineups(lineups = {}) {
  if (!lineups || typeof lineups !== "object" || Array.isArray(lineups)) {
    return {};
  }

  const next = {};
  for (const value of Object.values(lineups)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const matchupId = value.matchupId || value.matchup_id;
    const teamId = value.teamId || value.team_id;
    if (!matchupId || !teamId) {
      continue;
    }
    next[lineupKey(matchupId, teamId)] = {
      ...value,
      matchupId: String(matchupId),
      teamId: String(teamId),
    };
  }
  return next;
}

/**
 * Build team list: own team first, then opponent stubs (id/name only).
 * @param {object} tournament
 * @returns {object[]}
 */
export function buildCaptainPortalTeams(tournament = {}) {
  const myTeam = enrichTeamWithCaptainPortalRoster(tournament.myTeam || null);
  const opponents = Array.isArray(tournament.opponentTeams)
    ? tournament.opponentTeams
    : [];
  const fromTeams = Array.isArray(tournament.teams) ? tournament.teams : [];

  const byId = new Map();
  if (myTeam?.id) {
    byId.set(String(myTeam.id), myTeam);
  }
  for (const team of fromTeams) {
    if (team?.id && !byId.has(String(team.id))) {
      const enriched =
        String(team.id) === String(myTeam?.id || "")
          ? enrichTeamWithCaptainPortalRoster(team)
          : {
              ...team,
              // Opponent / non-viewer teams must not carry teammate PII.
              rosterAthletes: [],
              playerIds: Array.isArray(team.playerIds) ? [] : team.playerIds,
            };
      byId.set(String(team.id), enriched);
    }
  }
  for (const team of opponents) {
    if (team?.id && !byId.has(String(team.id))) {
      byId.set(String(team.id), {
        id: String(team.id),
        name: team.name || String(team.id),
        playerIds: [],
        rosterAthletes: [],
        captainPlayerId: "",
        deputyPlayerIds: [],
      });
    }
  }
  return [...byId.values()];
}

/**
 * @param {object} payload — RPC result from team_tournament_get_captain_portal
 * @returns {{ ok: true, tournament: object, meta: object } | { ok: false, code?: string, error?: string }}
 */
export function mapCaptainPortalResponse(payload = {}) {
  if (!payload || payload.ok === false) {
    return {
      ok: false,
      code: payload?.code || "CAPTAIN_PORTAL_DENIED",
      error: payload?.error || "Không tải được Portal đội trưởng.",
      captainAccessEnabled: payload?.captainAccessEnabled === true,
    };
  }

  const rawTournament = payload.tournament && typeof payload.tournament === "object"
    ? payload.tournament
    : {};

  const settings = {
    ...(rawTournament.settings || {}),
    captainAccessEnabled:
      payload.captainAccessEnabled === true ||
      rawTournament.settings?.captainAccessEnabled === true,
    dreambreakerEnabled: rawTournament.settings?.dreambreakerEnabled !== false,
    ...(rawTournament.settings?.stageTieBreakPolicy
      ? { stageTieBreakPolicy: rawTournament.settings.stageTieBreakPolicy }
      : {}),
  };

  const viewerTeamId = payload.viewerTeamId || payload.viewer?.viewerTeamId || null;
  const teams = buildCaptainPortalTeams(rawTournament);
  const matchups = projectCaptainPortalMatchupsDreambreaker(
    Array.isArray(rawTournament.matchups) ? rawTournament.matchups : [],
    viewerTeamId
  );
  const lineups = remapCaptainPortalLineups(rawTournament.lineups);
  const disciplines = Array.isArray(rawTournament.disciplines)
    ? rawTournament.disciplines
    : [];

  const settingsWithPreset = {
    ...settings,
    formatPreset: settings.formatPreset || rawTournament.settings?.formatPreset || null,
  };

  const repairedTeamSlice = applyCanonicalMlpDisciplineMetadata({
    disciplines,
    settings: settingsWithPreset,
  });
  const repairedDisciplines = repairedTeamSlice?.disciplines || disciplines;
  const repairedSettings = {
    ...settingsWithPreset,
    ...(repairedTeamSlice?.settings || {}),
    captainAccessEnabled: settings.captainAccessEnabled === true,
  };

  const tournamentForAggregate = normalizeV7TournamentForAggregate({
    ...rawTournament,
    id: rawTournament.id,
    clubId: rawTournament.clubId,
    tenantId: rawTournament.tenantId,
    name: rawTournament.name,
    status: rawTournament.status || "draft",
    version: rawTournament.version || 1,
    settings: repairedSettings,
    schedulePublish: repairedSettings.schedulePublish || rawTournament.schedulePublish || null,
    teams,
    matchups,
    lineups,
    disciplines: repairedDisciplines,
    groups: rawTournament.groups || [],
    standings: rawTournament.standings || [],
    teamData: {
      teams,
      matchups,
      lineups,
      disciplines: repairedDisciplines,
      groups: rawTournament.groups || [],
      standings: rawTournament.standings || [],
      settings: repairedSettings,
    },
  });

  return {
    ok: true,
    tournament: tournamentForAggregate,
    meta: {
      schemaVersion: Number(payload.schemaVersion) || 7,
      serverTime: payload.serverTime ?? null,
      viewerTeamId: payload.viewerTeamId || payload.viewer?.viewerTeamId || null,
      captainAccessEnabled: settings.captainAccessEnabled === true,
      viewer: payload.viewer || null,
      permissions: payload.permissions || null,
      canSaveDraft: payload.canSaveDraft ?? payload.operations?.lineupOps?.canSaveDraft ?? null,
      canSubmit: payload.canSubmit ?? payload.operations?.lineupOps?.canSubmit ?? null,
      lineupDeadline: payload.lineupDeadline ?? null,
      deadlineStatus: payload.deadlineStatus ?? null,
    },
  };
}

/**
 * Count unsafe full-setup assumptions: unrelated teams/matchups beyond viewer team.
 * @param {object|null} teamData
 * @param {string|null} viewerTeamId
 * @returns {{ unrelatedTeams: number, unrelatedMatchups: number, total: number }}
 */
export function countUnrelatedCaptainPortalExposure(teamData, viewerTeamId) {
  const viewer = String(viewerTeamId || "").trim();
  const teams = Array.isArray(teamData?.teams) ? teamData.teams : [];
  const matchups = Array.isArray(teamData?.matchups) ? teamData.matchups : [];

  const unrelatedTeams = viewer
    ? teams.filter((team) => {
        const id = String(team?.id || "").trim();
        if (!id || id === viewer) return false;
        // Opponent stubs that appear in own matchups are allowed.
        const involved = matchups.some(
          (m) =>
            (m.teamAId === viewer || m.teamBId === viewer) &&
            (m.teamAId === id || m.teamBId === id)
        );
        return !involved;
      }).length
    : teams.length;

  const unrelatedMatchups = viewer
    ? matchups.filter(
        (m) => m.teamAId !== viewer && m.teamBId !== viewer
      ).length
    : matchups.length;

  return {
    unrelatedTeams,
    unrelatedMatchups,
    total: unrelatedTeams + unrelatedMatchups,
  };
}
