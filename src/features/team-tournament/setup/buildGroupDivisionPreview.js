/**
 * Group-division preview package (no DB write).
 * Hashing stays inside setup/ canonical gateway.
 */

import {
  hashEngineInputAsync,
  hashEngineOutputAsync,
} from "../canonical/teamTournamentCanonical.js";
import { DEFAULT_ENGINE_VERSION } from "../canonical/teamTournamentMutationEnvelope.js";
import { buildGroupDivisionDiagnostics } from "../engines/teamGroupDivisionPolicy.js";

function averageTeamRating(team) {
  const avg = Number(team?.avgLevel);
  if (Number.isFinite(avg) && avg > 0) {
    return avg;
  }
  const total = Number(team?.totalRating);
  const count = (team?.playerIds || []).length || 1;
  if (Number.isFinite(total) && total > 0) {
    return Math.round((total / count) * 100) / 100;
  }
  return 0;
}

export function buildGroupPreviewRows(groups, teams) {
  const teamById = new Map((teams || []).map((team) => [String(team.id), team]));
  return (groups || []).map((group) => {
    const groupTeams = (group.teamIds || [])
      .map((id) => teamById.get(String(id)))
      .filter(Boolean);
    const ratings = groupTeams.map(averageTeamRating).filter((value) => value > 0);
    const avgRating =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 100
          ) / 100
        : 0;
    return {
      id: group.id,
      name: group.name,
      teamCount: groupTeams.length,
      teamNames: groupTeams.map((team) => team.name || team.id),
      avgRating,
    };
  });
}

/**
 * @param {object} params
 * @param {object} params.nextTeamData
 * @param {object|null} params.nextBalance
 * @param {string} params.seedingMode
 * @param {string} params.modeLabel
 */
export async function buildGroupDivisionPreviewPackage({
  nextTeamData,
  nextBalance = null,
  seedingMode = "",
  modeLabel = "preview",
  rulesVersion = "",
} = {}) {
  const diagnostics = buildGroupDivisionDiagnostics(
    nextTeamData,
    nextTeamData?.groups || []
  );
  const engineInput = {
    commandName: "groups.replace",
    teamIds: (nextTeamData?.teams || []).map((team) => team.id),
    groupCount: (nextTeamData?.groups || []).length,
    seedingMode,
    mode: modeLabel,
  };
  const engineOutput = {
    groups: nextTeamData?.groups || [],
    balance: nextBalance,
    diagnostics,
  };
  const [engineInputHash, engineOutputHash] = await Promise.all([
    hashEngineInputAsync(engineInput),
    hashEngineOutputAsync(engineOutput),
  ]);

  return {
    nextTeamData,
    nextBalance,
    diagnostics,
    rows: buildGroupPreviewRows(nextTeamData?.groups || [], nextTeamData?.teams || []),
    balancingExplanation: nextBalance?.balanced
      ? "Phân bố hạt giống / trình độ giữa các bảng cân bằng."
      : `Phân bố lệch nhẹ (spread ${nextBalance?.spread ?? "—"}). Có thể chia lại nếu cần.`,
    engineVersion: DEFAULT_ENGINE_VERSION,
    engineInputHash,
    engineOutputHash,
    rulesVersion,
    modeLabel,
    written: false,
  };
}
