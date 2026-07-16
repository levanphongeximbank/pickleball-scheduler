/**
 * P1.5A Showcase — matchup preview (team-vs-team), separate from group division.
 */

import { buildRoundRobinMatchups } from "../engines/teamTournamentEngine.js";

/**
 * Generate round-robin matchups preview once. Does not persist.
 *
 * @param {object} session — frozen showcase session with teams + groups
 * @param {object} [options]
 * @returns {{ ok: boolean, matchupPreview?: object, error?: string }}
 */
export function generateShowcaseMatchupPreview(session, options = {}) {
  if (!session?.teamData?.teams?.length) {
    return { ok: false, error: "Chưa có đội để tạo cặp đấu." };
  }
  if (!session?.teamData?.groups?.length) {
    return { ok: false, error: "Chưa có bảng để tạo cặp đấu." };
  }

  const result = buildRoundRobinMatchups(session.teamData, {
    ...options,
    rulesVersion: options.rulesVersion || session.rulesVersion || "",
  });

  if (result?.ok === false || result?.privatePairingError) {
    return {
      ok: false,
      error:
        result?.privatePairingError?.message ||
        result?.error ||
        "Không tạo được cặp đấu vòng tròn.",
      privatePairingError: result?.privatePairingError || null,
    };
  }

  const matchups = result?.matchups || [];
  const groups = session.teamData.groups || [];

  return {
    ok: true,
    matchupPreview: {
      generatedAt: new Date().toISOString(),
      rulesVersion: options.rulesVersion || session.rulesVersion || "",
      engineVersion: session.engineVersion || "",
      matchups,
      summary: {
        totalMatchups: matchups.length,
        byGroup: groups.map((group) => ({
          groupId: group.id,
          groupName: group.name,
          matchupCount: matchups.filter((matchup) => matchup.groupId === group.id).length,
        })),
      },
    },
  };
}
