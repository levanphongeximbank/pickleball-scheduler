/**
 * Build a frozen group-reveal session from AI-paired teams (engine once).
 */

import { TEAM_GROUP_SEEDING } from "../constants.js";
import { generateShowcaseGroupDraw } from "./showcaseDrawSession.js";
import { buildAiPairingRevealSession } from "./buildAiPairingRevealSession.js";
import { listGroupDivisionOptions } from "../engines/teamGroupDivisionPolicy.js";

/**
 * @param {{
 *   teams?: Array,
 *   players?: Array,
 *   groupCount?: number,
 *   seedingMode?: string,
 *   rulesVersion?: string,
 *   randomFn?: Function,
 * }} params
 */
export function buildAiGroupRevealSession({
  teams = [],
  players = [],
  groupCount,
  seedingMode = TEAM_GROUP_SEEDING.AVG_LEVEL,
  rulesVersion = "",
  randomFn = Math.random,
} = {}) {
  const teamReveal = buildAiPairingRevealSession({ teams, players });
  if (!teamReveal.ok) {
    return { ok: false, error: teamReveal.error || "Chưa có đội để chia bảng." };
  }

  const options = listGroupDivisionOptions(teams.length);
  const resolvedCount =
    Number(groupCount) ||
    options.find((option) => Number(option.groupCount) === 2)?.groupCount ||
    options[0]?.groupCount ||
    2;

  if (resolvedCount < 2) {
    return { ok: false, error: "Cần ít nhất 2 bảng để chia." };
  }

  const baseSession = {
    ...teamReveal.session,
    teamData: {
      teams,
      groups: [],
      matchups: [],
    },
    players,
    rulesVersion: String(rulesVersion || ""),
  };

  const grouped = generateShowcaseGroupDraw(baseSession, {
    groupCount: resolvedCount,
    seedingMode,
    rulesVersion: String(rulesVersion || ""),
    randomFn,
  });

  if (!grouped.ok) {
    return { ok: false, error: grouped.error || "Không chia được bảng." };
  }

  return {
    ok: true,
    session: grouped.session,
    groupCount: resolvedCount,
    teamData: grouped.session.teamData,
  };
}
