/**
 * Explicit group-division policy for Team Tournament V6.
 * Schedule / matchup / publish flows must never silently create groups.
 * groupCount may be 1..N — no UI/policy floor of 2.
 */

import { GROUP_MODE } from "../constants.js";
import {
  deriveGroupSizes,
  recommendAutomaticGroupCount,
  resolveFormatVenueDefaults,
} from "./teamFormatVenueConfig.js";

export const GROUPS_REQUIRED = "GROUPS_REQUIRED";

export const GROUPS_REQUIRED_MESSAGE =
  "Vui lòng chia bảng trước khi tạo lịch thi đấu.";

export const GROUPS_REQUIRED_SCHEDULE_DIALOG_MESSAGE =
  "Giải chưa được chia bảng. Vui lòng quay lại bước Đội và thực hiện Chia bảng đấu trước khi tạo lịch.";

export const GROUP_REDRAW_DESTRUCTIVE_MESSAGE =
  "Chia lại bảng sẽ xóa các cặp đấu và lịch thi đấu hiện tại. Bạn có chắc chắn tiếp tục?";

/** Historical threshold used by legacy workflows (6–10 teams recommended multi-group). */
export const MIN_TEAMS_FOR_EXPLICIT_GROUPS = 6;

/** Default split sizes by team count (recommendation only — never auto-applied). */
const DEFAULT_GROUP_SIZE_BY_TEAM_COUNT = Object.freeze({
  4: [4],
  6: [3, 3],
  7: [3, 4],
  8: [4, 4],
  9: [4, 5],
  10: [5, 5],
});

/**
 * @param {number} teamCount
 * @param {object} [teamData] — when provided with explicit groupMode, organizer config is authoritative
 * @returns {boolean}
 */
export function tournamentRequiresExplicitGroups(teamCount, teamData = null) {
  const count = Number(teamCount) || 0;
  const rawSettings =
    teamData?.settings && typeof teamData.settings === "object" ? teamData.settings : null;
  const hasExplicitGroupMode =
    rawSettings &&
    Object.prototype.hasOwnProperty.call(rawSettings, "groupMode") &&
    Boolean(rawSettings.groupMode);

  if (hasExplicitGroupMode) {
    const config = resolveFormatVenueDefaults(teamData);
    if (
      config.groupMode === GROUP_MODE.NONE ||
      config.groupMode === GROUP_MODE.SINGLE_POOL
    ) {
      // Single pool may still persist one group; schedule can proceed without
      // forcing multi-group division when organizer chose 1 bảng.
      return config.groupCount > 1;
    }
    if (config.groupMode === GROUP_MODE.AUTOMATIC || config.groupMode === GROUP_MODE.MANUAL) {
      return config.groupCount >= 1 && count >= 2;
    }
  }

  // Legacy-compatible: 6–10 teams without explicit groupMode still require groups.
  return count >= MIN_TEAMS_FOR_EXPLICIT_GROUPS && count <= 10;
}

/**
 * @param {number} teamCount
 * @returns {number[]|null}
 */
export function recommendGroupSizes(teamCount) {
  const count = Number(teamCount) || 0;
  // Recommendation only for the legacy multi-group band (6–10).
  // Smaller fields use listGroupDivisionOptions (includes 1 bảng).
  if (count < MIN_TEAMS_FOR_EXPLICIT_GROUPS || count > 10) {
    return null;
  }
  if (DEFAULT_GROUP_SIZE_BY_TEAM_COUNT[count]) {
    return [...DEFAULT_GROUP_SIZE_BY_TEAM_COUNT[count]];
  }
  const groupCount = recommendAutomaticGroupCount(count);
  return deriveGroupSizes(count, groupCount);
}

/**
 * Supported explicit division options. Supports 1 group (single pool) through N.
 * @param {number} teamCount
 * @returns {Array<{ groupCount: number, sizes: number[], label: string }>}
 */
export function listGroupDivisionOptions(teamCount) {
  const count = Number(teamCount) || 0;
  if (count < 2) {
    return [];
  }

  const options = [];

  // Always offer single-group (all teams in one pool).
  options.push({
    groupCount: 1,
    sizes: [count],
    label: `1 bảng × ${count} đội`,
  });

  if (count >= 4) {
    options.push({
      groupCount: 2,
      sizes: deriveGroupSizes(count, 2),
      label:
        count === 8
          ? "2 bảng × 4 đội"
          : `2 bảng (${deriveGroupSizes(count, 2).join(" + ")})`,
    });
  }

  if (count === 8) {
    options.push({
      groupCount: 4,
      sizes: [2, 2, 2, 2],
      label: "4 bảng × 2 đội",
    });
  } else if (count >= 6 && count !== 8) {
    const auto = recommendAutomaticGroupCount(count);
    if (auto > 2) {
      options.push({
        groupCount: auto,
        sizes: deriveGroupSizes(count, auto),
        label: `${auto} bảng (tự động gợi ý)`,
      });
    }
  }

  // Deduplicate by groupCount
  const seen = new Set();
  return options.filter((option) => {
    if (seen.has(option.groupCount)) return false;
    seen.add(option.groupCount);
    return true;
  });
}

/**
 * @param {object} teamData
 * @returns {Array<object>}
 */
export function listValidGroups(teamData) {
  return (teamData?.groups || []).filter(
    (group) => Array.isArray(group.teamIds) && group.teamIds.length >= 2
  );
}

/**
 * @param {object} teamData
 * @returns {boolean}
 */
export function hasExplicitGroups(teamData) {
  return listValidGroups(teamData).length > 0;
}

/**
 * @param {object} teamData
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function assertGroupsReadyForSchedule(teamData) {
  const teamCount = teamData?.teams?.length || 0;
  if (!tournamentRequiresExplicitGroups(teamCount, teamData)) {
    return { ok: true };
  }
  if (hasExplicitGroups(teamData)) {
    return { ok: true };
  }
  return {
    ok: false,
    code: GROUPS_REQUIRED,
    error: GROUPS_REQUIRED_MESSAGE,
  };
}

/**
 * @param {object} teamData
 * @returns {boolean}
 */
export function hasDependentMatchupsOrSchedule(teamData) {
  const matchups = teamData?.matchups || [];
  if (matchups.length > 0) {
    return true;
  }
  const schedulePublish = teamData?.schedulePublish || teamData?.settings?.schedulePublish;
  return Boolean(schedulePublish?.status && schedulePublish.status !== "draft");
}

/**
 * Diagnostics for a proposed group division (no write).
 * @param {object} teamData
 * @param {Array<{ id?: string, name?: string, teamIds?: string[] }>} groups
 */
export function buildGroupDivisionDiagnostics(teamData, groups = []) {
  const teams = teamData?.teams || [];
  const teamIds = teams.map((team) => String(team.id));
  const assigned = [];
  const duplicates = [];
  const seen = new Set();

  (groups || []).forEach((group) => {
    (group.teamIds || []).forEach((teamId) => {
      const key = String(teamId);
      if (seen.has(key)) {
        duplicates.push(key);
      } else {
        seen.add(key);
        assigned.push(key);
      }
    });
  });

  const missing = teamIds.filter((id) => !seen.has(id));
  const unknown = assigned.filter((id) => !teamIds.includes(id));

  return {
    teamCount: teams.length,
    groupCount: (groups || []).length,
    assignedCount: assigned.length,
    missingTeamIds: missing,
    duplicateTeamIds: [...new Set(duplicates)],
    unknownTeamIds: unknown,
    complete: missing.length === 0 && duplicates.length === 0 && unknown.length === 0,
  };
}

/**
 * @param {object} teamData
 * @returns {boolean}
 */
export function isGroupDivisionEditable(teamData, options = {}) {
  if (options.canManage === false) {
    return false;
  }
  const publish = teamData?.schedulePublish || teamData?.settings?.schedulePublish || {};
  if (publish.status === "published" || publish.status === "locked") {
    return false;
  }
  return true;
}
