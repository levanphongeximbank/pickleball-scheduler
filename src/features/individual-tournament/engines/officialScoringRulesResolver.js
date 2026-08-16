/**
 * Official scoring rules resolver — single authority for Organizer + Referee UI.
 * Does not invent a second scoreboard engine.
 *
 * Side-out point-by-point is NOT operational on classic Official live path
 * (see SIDEOUT_OPERATIONAL in officialTournamentSettingsEngine).
 *
 * Match format BEST_OF_1 is the operable classic path (single game).
 * BEST_OF_3 is fail-closed until multi-game Official live/result exists.
 *
 * Win-by margin is NOT an Official authority today (matchEngine only rejects draws).
 * WIN_BY_POLICY_DEFERRED — do not copy Team/referee-v5 winBy=2.
 */

import { MATCH_STAGE } from "../../../models/tournament/constants.js";
import {
  getOfficialCompetitionSettings,
  OFFICIAL_ROUND_SCORE_KEY,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_SCORING_METHOD_LABELS,
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_MATCH_FORMAT_LABELS,
  OFFICIAL_ROUND_SCORE_LABELS,
  CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  SIDEOUT_OPERATIONAL,
  SIDEOUT_SELECTION_FAIL_CLOSED,
  SIDEOUT_BACKEND_REQUIREMENT,
  BEST_OF_3_OPERATIONAL,
  BEST_OF_3_SELECTION_FAIL_CLOSED,
  BEST_OF_3_SHARED_CAPABILITY_GAP,
  WIN_BY_POLICY_DEFERRED,
  deriveOfficialMatchFormatRules,
} from "./officialTournamentSettingsEngine.js";

/** @deprecated Use SIDEOUT_OPERATIONAL === false */
export const SIDEOUT_POINT_BY_POINT_RUNTIME_BLOCKED = !SIDEOUT_OPERATIONAL;

export {
  SIDEOUT_OPERATIONAL,
  SIDEOUT_SELECTION_FAIL_CLOSED,
  SIDEOUT_BACKEND_REQUIREMENT,
  BEST_OF_3_OPERATIONAL,
  BEST_OF_3_SELECTION_FAIL_CLOSED,
  BEST_OF_3_SHARED_CAPABILITY_GAP,
  WIN_BY_POLICY_DEFERRED,
};

const ROUND_NAME_HINTS = [
  { key: OFFICIAL_ROUND_SCORE_KEY.FINAL, patterns: [/chung\s*k[eế]t/i, /^final$/i] },
  { key: OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL, patterns: [/b[aá]n\s*k[eế]t/i, /semi/i] },
  { key: OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL, patterns: [/t[uứ]\s*k[eế]t/i, /quarter/i] },
  {
    key: OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16,
    patterns: [/v[oò]ng\s*16/i, /1\/16/i, /round.?of.?16/i, /round_of_16/i],
  },
];

export function mapMatchToOfficialRoundKey(match = {}, options = {}) {
  if (options.roundKey && Object.values(OFFICIAL_ROUND_SCORE_KEY).includes(options.roundKey)) {
    return options.roundKey;
  }
  const stage = String(match.stage || match.roundType || "").toLowerCase();
  if (stage === MATCH_STAGE.FINAL || stage === "final") return OFFICIAL_ROUND_SCORE_KEY.FINAL;
  if (stage === MATCH_STAGE.SEMIFINAL || stage === "semifinal") {
    return OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL;
  }
  if (stage === MATCH_STAGE.QUARTERFINAL || stage === "quarterfinal") {
    return OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL;
  }
  if (stage === MATCH_STAGE.ROUND_OF_16 || stage === "round_of_16") {
    return OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16;
  }
  if (stage === MATCH_STAGE.GROUP || stage === "group" || match.groupId) {
    return OFFICIAL_ROUND_SCORE_KEY.GROUP;
  }

  const label = String(
    match.roundName || match.stageLabel || match.bracketRound || options.roundName || ""
  );
  for (const hint of ROUND_NAME_HINTS) {
    if (hint.patterns.some((re) => re.test(label))) return hint.key;
  }

  if (match.bracketMatchId || match.bracketRound) {
    return OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL;
  }
  return OFFICIAL_ROUND_SCORE_KEY.GROUP;
}

/**
 * Single effective scoring-rules resolver for Organizer + Referee + validation.
 */
export function resolveOfficialMatchScoringRules(tournament, match = {}, options = {}) {
  const settings = getOfficialCompetitionSettings(tournament);
  const roundKey = mapMatchToOfficialRoundKey(match, options);
  const configured = Number(settings.roundTargets?.[roundKey]);
  const targetPoints =
    Number.isFinite(configured) && configured >= 1
      ? configured
      : CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT;
  // Fail-closed: never expose side_out as operable method.
  const scoringMethod = OFFICIAL_SCORING_METHOD.RALLY;
  const formatRules = deriveOfficialMatchFormatRules(settings.matchFormat);
  // Fail-closed: never expose BEST_OF_3 as operable classic format.
  const matchFormat = BEST_OF_3_OPERATIONAL
    ? formatRules.matchFormat
    : OFFICIAL_MATCH_FORMAT.BEST_OF_1;
  const derived = deriveOfficialMatchFormatRules(matchFormat);

  return {
    scoringMethod,
    scoringMethodLabel: OFFICIAL_SCORING_METHOD_LABELS[scoringMethod] || scoringMethod,
    matchFormat: derived.matchFormat,
    matchFormatLabel: OFFICIAL_MATCH_FORMAT_LABELS[derived.matchFormat] || derived.matchFormat,
    bestOf: derived.bestOf,
    gamesToWin: derived.gamesToWin,
    maximumGames: derived.maximumGames,
    matchFormatIsOperational: derived.matchFormatIsOperational,
    bestOf3Operational: BEST_OF_3_OPERATIONAL,
    roundKey,
    roundLabel: OFFICIAL_ROUND_SCORE_LABELS[roundKey] || roundKey,
    targetPoints,
    // No Official win-by authority — align with matchEngine (higher score wins; no margin rule).
    winBy: null,
    winByPolicyDeferred: WIN_BY_POLICY_DEFERRED,
    allowDraw: false,
    sideOutPointByPointEnforced: false,
    sideOutOperational: SIDEOUT_OPERATIONAL,
    sideOutRuntimeBlocked: !SIDEOUT_OPERATIONAL,
    summaryLabel: `${OFFICIAL_ROUND_SCORE_LABELS[roundKey] || roundKey} · Rally · ${OFFICIAL_MATCH_FORMAT_LABELS[derived.matchFormat]} · ${targetPoints} điểm`,
  };
}

/**
 * Validate finished score against configured round target.
 * Does NOT invent a win-by margin (WIN_BY_POLICY_DEFERRED).
 * Aligns with classic Official matchEngine: reject draws; winner is higher score.
 * Additionally enforces Organizer-configured targetPoints when present.
 */
export function validateOfficialFinishedScore(rules, scoreA, scoreB) {
  const a = Number(scoreA);
  const b = Number(scoreB);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
    return { ok: false, error: "Điểm không hợp lệ." };
  }
  if (a === b) {
    return { ok: false, error: "Trận không được hòa." };
  }
  const target = Number(rules?.targetPoints) || CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT;
  const winner = Math.max(a, b);
  if (winner < target) {
    return {
      ok: false,
      error: `Điểm thắng phải đạt ít nhất ${target}.`,
    };
  }
  return { ok: true };
}
