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
  const configured = Number(groupCount);
  const resolvedCount =
    Number.isFinite(configured) && configured >= 1
      ? Math.floor(configured)
      : options.find((option) => Number(option.groupCount) === 1)?.groupCount ||
        options[0]?.groupCount ||
        1;

  if (resolvedCount < 1) {
    return { ok: false, error: "Cần ít nhất 1 bảng." };
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
