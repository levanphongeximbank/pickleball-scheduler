/**
 * Explicit group-division policy for Team Tournament V6.
 * Schedule / matchup / publish flows must never silently create groups.
 */

export const GROUPS_REQUIRED = "GROUPS_REQUIRED";

export const GROUPS_REQUIRED_MESSAGE =
  "Vui lòng chia bảng trước khi tạo lịch thi đấu.";

export const GROUPS_REQUIRED_SCHEDULE_DIALOG_MESSAGE =
  "Giải chưa được chia bảng. Vui lòng quay lại bước Đội và thực hiện Chia bảng đấu trước khi tạo lịch.";

export const GROUP_REDRAW_DESTRUCTIVE_MESSAGE =
  "Chia lại bảng sẽ xóa các cặp đấu và lịch thi đấu hiện tại. Bạn có chắc chắn tiếp tục?";

export const MIN_TEAMS_FOR_EXPLICIT_GROUPS = 6;

/** Default split sizes by team count (recommendation only — never auto-applied). */
const DEFAULT_GROUP_SIZE_BY_TEAM_COUNT = Object.freeze({
  6: [3, 3],
  7: [3, 4],
  8: [4, 4],
  9: [4, 5],
  10: [5, 5],
});

/**
 * @param {number} teamCount
 * @returns {boolean}
 */
export function tournamentRequiresExplicitGroups(teamCount) {
  const count = Number(teamCount) || 0;
  return count >= MIN_TEAMS_FOR_EXPLICIT_GROUPS && count <= 10;
}

/**
 * @param {number} teamCount
 * @returns {number[]|null}
 */
export function recommendGroupSizes(teamCount) {
  const count = Number(teamCount) || 0;
  if (!tournamentRequiresExplicitGroups(count)) {
    return null;
  }
  return DEFAULT_GROUP_SIZE_BY_TEAM_COUNT[count] || null;
}

/**
 * Supported explicit division options. For 8 teams: 2×4 and 4×2.
 * @param {number} teamCount
 * @returns {Array<{ groupCount: number, sizes: number[], label: string }>}
 */
export function listGroupDivisionOptions(teamCount) {
  const count = Number(teamCount) || 0;
  if (count < MIN_TEAMS_FOR_EXPLICIT_GROUPS) {
    return [];
  }

  if (count === 8) {
    return [
      {
        groupCount: 2,
        sizes: [4, 4],
        label: "2 bảng × 4 đội",
      },
      {
        groupCount: 4,
        sizes: [2, 2],
        label: "4 bảng × 2 đội",
      },
    ];
  }

  const defaultSizes = recommendGroupSizes(count);
  if (!defaultSizes) {
    const groupCount = Math.min(2, Math.floor(count / 2));
    if (groupCount < 2) {
      return [];
    }
    const base = Math.floor(count / groupCount);
    const remainder = count % groupCount;
    const sizes = Array.from({ length: groupCount }, (_, index) =>
      index < remainder ? base + 1 : base
    );
    return [
      {
        groupCount,
        sizes,
        label: `${groupCount} bảng`,
      },
    ];
  }

  return [
    {
      groupCount: defaultSizes.length,
      sizes: [...defaultSizes],
      label: defaultSizes
        .map((size, index) => `Bảng ${String.fromCharCode(65 + index)} (${size})`)
        .join(" + "),
    },
  ];
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
  if (!tournamentRequiresExplicitGroups(teamCount)) {
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
