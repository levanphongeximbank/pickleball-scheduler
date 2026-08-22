/**
 * Team Tournament Experience Adapter — READ projections + command delegation boundary.
 *
 * Does NOT own: standings, Dreambreaker, qualification, match results,
 * referee assignment, scoring, court assignment, lineup rules.
 * Those remain on existing Team Tournament domain / RPC authorities.
 */
import { TOURNAMENT_MODE } from "../../../../models/tournament/constants.js";
import { modeLabelVi, statusLabelVi } from "../../constants/tournamentLabels.js";
import { buildTeamExperienceContext } from "./teamExperienceRoutes.js";

export const TEAM_EXPERIENCE_ADAPTER_ID = "TeamTournamentExperienceAdapter";

export const TEAM_DOMAIN_AUTHORITIES = Object.freeze({
  roster: "team-tournament/engines + setup RPC",
  discipline: "team-tournament domain disciplines",
  matchup: "team-tournament matchup engines / setup",
  lineup: "lineupEngine + lineup RPC",
  dreambreaker: "dreambreakerEngine + dreambreaker RPC",
  standings: "teamStandingsEngine + standings RPC",
  qualification: "teamQualificationProgression",
  knockout: "teamKnockoutEngine",
  result: "teamResultEngine + submatch RPC",
  referee: "refereeAssignEngine + referee RPC / Referee V5",
  court: "canonicalClubCourtInventory + matchup court fields",
});

function countByStatus(matchups, status) {
  const wanted = String(status || "");
  return (matchups || []).filter((m) => String(m?.status || "") === wanted).length;
}

function classifyFromSchedule(schedule = {}) {
  const upcoming = Array.isArray(schedule.upcoming) ? schedule.upcoming : [];
  const live = Array.isArray(schedule.live) ? schedule.live : [];
  const completed = Array.isArray(schedule.completed) ? schedule.completed : [];
  const bracketPending = Array.isArray(schedule.bracketPending)
    ? schedule.bracketPending
    : [];
  return {
    upcoming,
    live,
    completed,
    bracketPending,
    total: upcoming.length + live.length + completed.length + bracketPending.length,
  };
}

function projectGroupStatus(groups) {
  if (!Array.isArray(groups)) {
    return { state: "unknown", label: "Chưa có dữ liệu bảng", count: null };
  }
  if (groups.length === 0) {
    return { state: "none", label: "Chưa chia bảng", count: 0 };
  }
  return { state: "configured", label: `${groups.length} bảng`, count: groups.length };
}

function projectKnockoutStatus(knockoutMatchups) {
  const list = Array.isArray(knockoutMatchups) ? knockoutMatchups : [];
  if (list.length === 0) {
    return { state: "none", label: "Chưa có nhánh knockout", count: 0 };
  }
  const done = countByStatus(list, "completed");
  return {
    state: done === list.length ? "complete" : "in_progress",
    label: `${done}/${list.length} trận knockout`,
    count: list.length,
  };
}

function projectRefereeReadiness(view) {
  const assignments = view?.referee?.assignments;
  if (Array.isArray(assignments)) {
    return {
      state: assignments.length > 0 ? "assigned" : "none",
      label:
        assignments.length > 0
          ? `${assignments.length} phân công trọng tài (của bạn)`
          : "Chưa có phân công trọng tài cho bạn",
      count: assignments.length,
    };
  }
  if (view?.capabilities?.isReferee === true) {
    return { state: "role", label: "Bạn là trọng tài trên giải này", count: null };
  }
  return { state: "unknown", label: "Độ sẵn sàng trọng tài theo RPC dashboard", count: null };
}

/**
 * Project overview KPIs from an already-authorized dashboard view
 * (+ optional teamData enrichment for disciplines/groups counts only).
 *
 * @param {object|null} view — buildTeamTournamentDashboardView / composeDashboardViewFromRpc result
 * @param {{ teamData?: object|null }} [options]
 */
export function projectTeamOverview(view, { teamData = null } = {}) {
  if (!view?.ok || !view.overview?.id) {
    return null;
  }

  const classified = classifyFromSchedule(view.schedule);
  const teams = Array.isArray(view.teams) ? view.teams : [];
  const disciplines = Array.isArray(teamData?.disciplines) ? teamData.disciplines : null;
  const groups = Array.isArray(teamData?.groups) ? teamData.groups : null;
  const knockout = Array.isArray(view.knockout) ? view.knockout : [];
  const context = buildTeamExperienceContext({
    tournamentId: view.overview.id,
    tenantId: view.overview.tenantId,
    clubId: view.overview.clubId,
  });

  const nextAction = view.organizer?.primaryAction || null;

  return {
    adapterId: TEAM_EXPERIENCE_ADAPTER_ID,
    context,
    identity: {
      id: String(view.overview.id),
      name: String(view.overview.name || "Giải đồng đội"),
      status: view.overview.status || "",
      statusLabel: statusLabelVi(view.overview.status),
      mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
      modeLabel: modeLabelVi(TOURNAMENT_MODE.TEAM_TOURNAMENT),
      clubId: view.overview.clubId || null,
      tenantId: view.overview.tenantId || null,
      formatPreset: view.overview.formatPreset || null,
      isDraft: view.overview.isDraft === true,
    },
    kpis: {
      teamCount: teams.length,
      disciplineCount: disciplines ? disciplines.length : null,
      matchupCount: classified.total,
      completedMatchupCount: classified.completed.length,
      liveMatchupCount: classified.live.length,
      groupCount: groups ? groups.length : null,
      knockoutMatchupCount: knockout.length,
    },
    groupStatus: projectGroupStatus(groups),
    knockoutStatus: projectKnockoutStatus(knockout),
    refereeReadiness: projectRefereeReadiness(view),
    nextAction: nextAction
      ? {
          id: nextAction.id || null,
          label: nextAction.label || nextAction.id || "Hành động tiếp theo",
        }
      : null,
    capabilities: view.capabilities || null,
    sections: view.sections || null,
    /** Pass-through only — UI must not recompute standings from this. */
    standingsProjection: Array.isArray(view.standings) ? view.standings : [],
    authority: {
      adapter: TEAM_EXPERIENCE_ADAPTER_ID,
      readSource: "team_tournament_get_dashboard",
      domain: TEAM_DOMAIN_AUTHORITIES,
      ownsDomainRules: false,
      ownsPersistence: false,
    },
  };
}

/**
 * Command delegation boundary — callers must pass existing Team command executors.
 * Adapter never implements domain mutations itself.
 */
export function createTeamExperienceCommandDelegate(executors = {}) {
  const registry = executors && typeof executors === "object" ? executors : {};
  return {
    adapterId: TEAM_EXPERIENCE_ADAPTER_ID,
    listCommands() {
      return Object.keys(registry);
    },
    async execute(commandName, payload) {
      const fn = registry[commandName];
      if (typeof fn !== "function") {
        return {
          ok: false,
          code: "COMMAND_NOT_DELEGATED",
          error: `Lệnh ${commandName} chưa được gắn vào Team domain executor.`,
        };
      }
      return fn(payload);
    },
  };
}

export const TeamTournamentExperienceAdapter = Object.freeze({
  id: TEAM_EXPERIENCE_ADAPTER_ID,
  mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
  projectOverview: projectTeamOverview,
  createCommandDelegate: createTeamExperienceCommandDelegate,
  authorities: TEAM_DOMAIN_AUTHORITIES,
});

export default TeamTournamentExperienceAdapter;
