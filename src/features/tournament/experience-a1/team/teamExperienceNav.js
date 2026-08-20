/**
 * Team Experience navigation foundation (Wave T2).
 * Adopted screens → canonical paths.
 * Not-yet-adopted → legacy compatibility link (truthful), never empty fake mounts.
 */
import {
  teamTournamentDashboardPath,
  teamTournamentPath,
  TEAM_TAB_QUERY,
} from "../../../../config/tournamentRoutes.js";
import {
  TEAM_EXPERIENCE_ADOPTED_SCREENS,
  teamExperiencePath,
  teamOverviewPath,
} from "./teamExperienceRoutes.js";

const LEGACY = Object.freeze({
  settings: TEAM_TAB_QUERY.format,
  participants: TEAM_TAB_QUERY.teams,
  formation: TEAM_TAB_QUERY.teams,
  draw: TEAM_TAB_QUERY.diagram,
  groups: TEAM_TAB_QUERY.matchups,
  schedule: TEAM_TAB_QUERY.matchups,
  matches: TEAM_TAB_QUERY.matchups,
  standings: TEAM_TAB_QUERY.standings,
  knockout: TEAM_TAB_QUERY.diagram,
  bracket: TEAM_TAB_QUERY.diagram,
  director: TEAM_TAB_QUERY.matchups,
  courts: TEAM_TAB_QUERY.matchups,
  referees: TEAM_TAB_QUERY.matchups,
  exceptions: TEAM_TAB_QUERY.matchups,
  communications: TEAM_TAB_QUERY.format,
  media: TEAM_TAB_QUERY.diagram,
  awards: TEAM_TAB_QUERY.awards,
  complete: TEAM_TAB_QUERY.awards,
});

/**
 * @param {string} tournamentId
 * @returns {Array<{ key: string, label: string, adopted: boolean, to: string, kind: 'canonical'|'legacy'|'operational' }>}
 */
export function buildTeamExperienceNav(tournamentId) {
  const id = String(tournamentId || "").trim();
  if (!id) return [];

  const items = [
    { key: "overview", label: "Tổng quan", adopted: true },
    { key: "settings", label: "Cài đặt / Nội dung", adopted: false },
    { key: "participants", label: "Đội tham dự", adopted: false },
    { key: "schedule", label: "Lịch / Trận đồng đội", adopted: false },
    { key: "standings", label: "Bảng xếp hạng", adopted: false },
    { key: "bracket", label: "Sơ đồ / Knockout", adopted: false },
    { key: "awards", label: "Giải thưởng", adopted: false },
  ];

  return items.map((item) => {
    if (item.key === "overview" || TEAM_EXPERIENCE_ADOPTED_SCREENS[item.key]) {
      return {
        ...item,
        adopted: true,
        kind: "canonical",
        to: item.key === "overview" ? teamOverviewPath(id) : teamExperiencePath(id, item.key),
      };
    }
    const tab = LEGACY[item.key] || TEAM_TAB_QUERY.teams;
    return {
      ...item,
      adopted: false,
      kind: "legacy",
      to: teamTournamentPath(id, tab),
      pendingLabel: "chưa chuyển sang giao diện mới — mở thiết lập hiện tại",
    };
  }).concat([
    {
      key: "operational-dashboard",
      label: "Bảng điều khiển vận hành",
      adopted: true,
      kind: "operational",
      to: teamTournamentDashboardPath(id),
    },
  ]);
}
