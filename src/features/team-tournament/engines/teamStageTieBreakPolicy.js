/**
 * Canonical Team Tournament per-stage matchup tie-break policy.
 *
 * Storage: team_tournaments.settings.stageTieBreakPolicy
 * Stage identity: existing matchup.stage (group|knockout) + knockout
 * remaining-teams / nextMatchupId / bracketRoundLabel. Missing policy
 * keys default to DREAMBREAKER so legacy tournaments stay unchanged.
 */

import {
  COMPETITION_STAGE,
  DEFAULT_STAGE_TIE_BREAK_POLICY,
  DREAMBREAKER_STATUS,
  MATCHUP_STATUS,
  STAGE_TIE_BREAK_POLICY,
  STAGE_TIE_BREAK_POLICY_KEYS,
  SUB_MATCH_STATUS,
} from "../constants.js";

export const STAGE_TIEBREAK_POLICY_LOCKED_CODE = "STAGE_TIEBREAK_POLICY_LOCKED";
export const STAGE_TIEBREAK_POLICY_INVALID_CODE = "INVALID_STAGE_TIEBREAK_POLICY";
export const TOTAL_POINTS_SECONDARY_TIE_STATUS = "secondary_tie_unresolved";
export const TOTAL_POINTS_SECONDARY_TIE_CONTRACT = "UNDEFINED";

const POLICY_VALUES = new Set(Object.values(STAGE_TIE_BREAK_POLICY));
const STAGE_KEY_SET = new Set(STAGE_TIE_BREAK_POLICY_KEYS);

const LABEL_TO_STAGE = Object.freeze({
  "chung kết": COMPETITION_STAGE.FINAL,
  chungket: COMPETITION_STAGE.FINAL,
  final: COMPETITION_STAGE.FINAL,
  "bán kết": COMPETITION_STAGE.SEMIFINAL,
  banket: COMPETITION_STAGE.SEMIFINAL,
  semifinal: COMPETITION_STAGE.SEMIFINAL,
  "tứ kết": COMPETITION_STAGE.QUARTERFINAL,
  tuket: COMPETITION_STAGE.QUARTERFINAL,
  quarterfinal: COMPETITION_STAGE.QUARTERFINAL,
  "vòng 16": COMPETITION_STAGE.ROUND_OF_16,
  "vong 16": COMPETITION_STAGE.ROUND_OF_16,
  "round of 16": COMPETITION_STAGE.ROUND_OF_16,
  round_of_16: COMPETITION_STAGE.ROUND_OF_16,
  r16: COMPETITION_STAGE.ROUND_OF_16,
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSettings(teamData = {}, tournament = null) {
  return {
    ...(isPlainObject(tournament?.settings) ? tournament.settings : {}),
    ...(isPlainObject(teamData?.settings) ? teamData.settings : {}),
  };
}

export function isValidStageTieBreakPolicyValue(value) {
  return POLICY_VALUES.has(String(value || "").trim());
}

export function isKnockoutMatchupForPolicy(matchup) {
  const stage = String(matchup?.stage || matchup?.scheduleMeta?.stage || "").trim();
  return stage === "knockout";
}

export function competitionStageFromRemaining(remainingAfterRound) {
  const remaining = Number(remainingAfterRound);
  if (remaining === 1) return COMPETITION_STAGE.FINAL;
  if (remaining === 2) return COMPETITION_STAGE.SEMIFINAL;
  if (remaining === 4) return COMPETITION_STAGE.QUARTERFINAL;
  if (remaining === 8) return COMPETITION_STAGE.ROUND_OF_16;
  return "";
}

export function competitionStageFromHopCount(hopsToFinal) {
  const hops = Number(hopsToFinal);
  if (hops === 0) return COMPETITION_STAGE.FINAL;
  if (hops === 1) return COMPETITION_STAGE.SEMIFINAL;
  if (hops === 2) return COMPETITION_STAGE.QUARTERFINAL;
  if (hops === 3) return COMPETITION_STAGE.ROUND_OF_16;
  return "";
}

export function competitionStageFromLabel(label) {
  const raw = String(label || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, " ");
  if (LABEL_TO_STAGE[compact]) return LABEL_TO_STAGE[compact];
  if (LABEL_TO_STAGE[raw]) return LABEL_TO_STAGE[raw];
  if (compact.includes("chung ket") || compact === "final") {
    return COMPETITION_STAGE.FINAL;
  }
  if (compact.includes("ban ket") || compact === "semifinal") {
    return COMPETITION_STAGE.SEMIFINAL;
  }
  if (compact.includes("tu ket") || compact === "quarterfinal") {
    return COMPETITION_STAGE.QUARTERFINAL;
  }
  if (compact.includes("vong 16") || compact.includes("round of 16")) {
    return COMPETITION_STAGE.ROUND_OF_16;
  }
  return "";
}

export function readStoredCompetitionStage(matchup) {
  const raw = String(
    matchup?.competitionStage || matchup?.scheduleMeta?.competitionStage || ""
  ).trim();
  return STAGE_KEY_SET.has(raw) ? raw : "";
}

function matchupById(teamData, matchupId) {
  const id = String(matchupId || "").trim();
  if (!id) return null;
  return (teamData?.matchups || []).find((item) => String(item.id) === id) || null;
}

export function countHopsToFinal(teamData, matchup) {
  if (!matchup) return null;
  let hops = 0;
  let current = matchup;
  const seen = new Set();
  while (current) {
    const currentId = String(current.id || "");
    if (currentId) {
      if (seen.has(currentId)) return null;
      seen.add(currentId);
    }
    const nextId = String(
      current.nextMatchupId || current.scheduleMeta?.nextMatchupId || ""
    ).trim();
    if (!nextId) {
      return hops;
    }
    hops += 1;
    if (hops > 8) return null;
    current = matchupById(teamData, nextId);
    if (!current) {
      return hops;
    }
  }
  return hops;
}

export function resolveMatchupCompetitionStage(teamData, matchup) {
  if (!matchup) {
    return COMPETITION_STAGE.GROUP;
  }
  if (!isKnockoutMatchupForPolicy(matchup)) {
    return COMPETITION_STAGE.GROUP;
  }

  const stored = readStoredCompetitionStage(matchup);
  if (stored) {
    return stored;
  }

  const fromLabel = competitionStageFromLabel(matchup.bracketRoundLabel);
  if (fromLabel) {
    return fromLabel;
  }

  const bracketSize = Number(teamData?.knockout?.bracketSize);
  const roundNumber = Number(matchup.roundNumber || matchup.scheduleMeta?.roundNumber);
  if (Number.isFinite(bracketSize) && bracketSize > 0 && roundNumber > 0) {
    const remaining = bracketSize / 2 ** roundNumber;
    const fromRemaining = competitionStageFromRemaining(remaining);
    if (fromRemaining) {
      return fromRemaining;
    }
  }

  const hops = countHopsToFinal(teamData, matchup);
  if (hops != null) {
    const fromHops = competitionStageFromHopCount(hops);
    if (fromHops) {
      return fromHops;
    }
  }

  return "";
}

export function normalizeStageTieBreakPolicy(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const next = { ...DEFAULT_STAGE_TIE_BREAK_POLICY };
  for (const key of STAGE_TIE_BREAK_POLICY_KEYS) {
    const value = source[key];
    if (isValidStageTieBreakPolicyValue(value)) {
      next[key] = String(value).trim();
    }
  }
  return next;
}

export function validateStageTieBreakPolicyShape(raw) {
  if (raw == null) {
    return { ok: true, policy: normalizeStageTieBreakPolicy(null) };
  }
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      code: STAGE_TIEBREAK_POLICY_INVALID_CODE,
      error: "stageTieBreakPolicy phải là object theo vòng đấu.",
    };
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!STAGE_KEY_SET.has(key)) {
      return {
        ok: false,
        code: STAGE_TIEBREAK_POLICY_INVALID_CODE,
        error: `Vòng đấu không hợp lệ: ${key}`,
      };
    }
    if (!isValidStageTieBreakPolicyValue(value)) {
      return {
        ok: false,
        code: STAGE_TIEBREAK_POLICY_INVALID_CODE,
        error: `Luật hòa không hợp lệ cho ${key}.`,
      };
    }
  }
  return { ok: true, policy: normalizeStageTieBreakPolicy(raw) };
}

export function resolveStageTieBreakPolicyMap(teamData = {}, tournament = null) {
  const settings = readSettings(teamData, tournament);
  return normalizeStageTieBreakPolicy(settings.stageTieBreakPolicy);
}

export function resolveEffectiveStageTieBreakPolicy(teamData, matchup, tournament = null) {
  const map = resolveStageTieBreakPolicyMap(teamData, tournament);
  const stage = resolveMatchupCompetitionStage(teamData, matchup);
  if (stage && map[stage]) {
    return map[stage];
  }
  const fromResult = String(matchup?.result?.tieBreakPolicy || "").trim();
  if (isValidStageTieBreakPolicyValue(fromResult)) {
    return fromResult;
  }
  return STAGE_TIE_BREAK_POLICY.DREAMBREAKER;
}

export function isDreambreakerTieBreakPolicy(teamData, matchup, tournament = null) {
  return (
    resolveEffectiveStageTieBreakPolicy(teamData, matchup, tournament) ===
    STAGE_TIE_BREAK_POLICY.DREAMBREAKER
  );
}

export function isTotalSubmatchPointsPolicy(teamData, matchup, tournament = null) {
  return (
    resolveEffectiveStageTieBreakPolicy(teamData, matchup, tournament) ===
    STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS
  );
}

function hasStartedScoring(matchup) {
  const status = String(matchup?.status || "");
  if (status === MATCHUP_STATUS.IN_PROGRESS || status === MATCHUP_STATUS.COMPLETED) {
    return true;
  }
  const dreambreakerStatus = String(matchup?.dreambreaker?.status || "");
  if (
    dreambreakerStatus &&
    dreambreakerStatus !== DREAMBREAKER_STATUS.PENDING &&
    dreambreakerStatus !== ""
  ) {
    return true;
  }
  return (matchup?.subMatches || []).some((subMatch) => {
    const subStatus = String(subMatch?.status || "");
    return (
      subStatus === SUB_MATCH_STATUS.PLAYING ||
      subStatus === SUB_MATCH_STATUS.COMPLETED ||
      subStatus === SUB_MATCH_STATUS.FORFEIT
    );
  });
}

export function listLockedCompetitionStages(teamData = {}) {
  const locked = new Set();
  for (const matchup of teamData.matchups || []) {
    if (!hasStartedScoring(matchup)) {
      continue;
    }
    const stage = resolveMatchupCompetitionStage(teamData, matchup) || COMPETITION_STAGE.GROUP;
    if (STAGE_KEY_SET.has(stage)) {
      locked.add(stage);
    }
  }
  return locked;
}

export function assertStageTieBreakPolicyWritable(teamData, nextPolicy, tournament = null) {
  const shape = validateStageTieBreakPolicyShape(nextPolicy);
  if (!shape.ok) {
    return shape;
  }
  const current = resolveStageTieBreakPolicyMap(teamData, tournament);
  const locked = listLockedCompetitionStages(teamData);
  const blocked = STAGE_TIE_BREAK_POLICY_KEYS.filter(
    (key) => locked.has(key) && shape.policy[key] !== current[key]
  );
  if (blocked.length > 0) {
    return {
      ok: false,
      code: STAGE_TIEBREAK_POLICY_LOCKED_CODE,
      error:
        "Không thể đổi luật hòa của vòng đã bắt đầu thi đấu hoặc đã kích hoạt Dreambreaker.",
      lockedStages: blocked,
    };
  }
  return { ok: true, policy: shape.policy, lockedStages: [...locked] };
}

export function resolvePointsTieWinner(matchup, teamAPoints, teamBPoints) {
  const a = Number(teamAPoints) || 0;
  const b = Number(teamBPoints) || 0;
  if (a > b) {
    return {
      winnerTeamId: matchup.teamAId,
      tieBreakStatus: "points",
      secondaryTie: false,
    };
  }
  if (b > a) {
    return {
      winnerTeamId: matchup.teamBId,
      tieBreakStatus: "points",
      secondaryTie: false,
    };
  }
  return {
    winnerTeamId: "",
    tieBreakStatus: TOTAL_POINTS_SECONDARY_TIE_STATUS,
    secondaryTie: true,
  };
}
