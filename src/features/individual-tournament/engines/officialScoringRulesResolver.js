/**
 * Official scoring rules resolver — single authority for Organizer + Referee UI.
 * Live point-by-point execution binds to CORE-16 via Official Adapter B.
 * Does not invent a second scoreboard engine.
 *
 * BEST_OF_3 remains fail-closed until multi-game Official live/result exists.
 *
 * Active rule source: Content competitionRules via Adapter B → Adapter A.
 * Tournament.settings.officialCompetition is NOT active authority when Content rules exist.
 */

import { MATCH_STAGE } from "../../../models/tournament/constants.js";
import {
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
import {
  resolveContentCompetitionRules,
  CONTENT_RULES_SOURCE,
} from "./officialContentCompetitionRules.js";
import {
  createOfficialOpenCompetitionRulesSurface,
  resolveOfficialEffectiveCapability,
} from "../../tournament/official-open-adapter-b/officialOpenCompetitionRules.js";
import {
  SCORING_SIDE,
  createScoringFormat,
  evaluateGameComplete,
} from "../../competition-core/scoring/index.js";

/** @deprecated Use SIDEOUT_OPERATIONAL */
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
 * Active source: Content competitionRules → Adapter B → Adapter A stage rules.
 * Fail closed when match lacks Content identity (eventId).
 */
export function resolveOfficialMatchScoringRules(tournament, match = {}, options = {}) {
  const roundKey = mapMatchToOfficialRoundKey(match, options);
  const eventId = String(options.eventId || match.eventId || "").trim();

  let targetPoints = CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT;
  let scoringMethodOperational = OFFICIAL_SCORING_METHOD.RALLY;
  let winByMargin = 2;
  let winByEnabled = true;
  let pointCapEnabled = false;
  let pointCap = null;
  let changeEndsEnabled = false;
  let rulesSource = "canonical.system.default";
  let contentRulesSource = null;
  let canonicalStage = null;

  if (!eventId) {
    return {
      ok: false,
      code: "EVENT_ID_REQUIRED",
      error: "Trận thiếu eventId/contentId — không suy đoán luật từ tournament blob.",
      roundKey,
      roundLabel: OFFICIAL_ROUND_SCORE_LABELS[roundKey] || roundKey,
      targetPoints,
      scoringMethod: scoringMethodOperational,
      scoringMethodLabel: OFFICIAL_SCORING_METHOD_LABELS[scoringMethodOperational],
      matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
      matchFormatLabel: OFFICIAL_MATCH_FORMAT_LABELS[OFFICIAL_MATCH_FORMAT.BEST_OF_1],
      bestOf: 1,
      gamesToWin: 1,
      maximumGames: 1,
      matchFormatIsOperational: true,
      winBy: null,
      winByPolicyDeferred: WIN_BY_POLICY_DEFERRED === true,
      allowDraw: false,
      changeEndsEnabled: false,
      sideOutOperational: SIDEOUT_OPERATIONAL,
      sideOutRuntimeBlocked: !SIDEOUT_OPERATIONAL,
      sideOutPointByPointEnforced: false,
      bestOf3Operational: BEST_OF_3_OPERATIONAL,
      rulesSource: "FAIL_CLOSED_MISSING_EVENT_ID",
      authority: "CORE-16_VIA_OFFICIAL_ADAPTER_B",
      summaryLabel: "Thiếu eventId — không giải được luật nội dung.",
    };
  }

  const content = resolveContentCompetitionRules(tournament, { eventId });
  if (content.ok) {
    const rules = content.rules;
    contentRulesSource = content.source;
    targetPoints =
      Number(rules.roundTargets?.[roundKey]) ||
      Number(rules.matchScoring.targetPoints) ||
      CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT;
    scoringMethodOperational =
      String(rules.matchScoring.scoringMethod || "").toLowerCase() ===
      OFFICIAL_SCORING_METHOD.SIDE_OUT
        ? OFFICIAL_SCORING_METHOD.SIDE_OUT
        : OFFICIAL_SCORING_METHOD.RALLY;
    winByEnabled = rules.matchScoring.winCondition.winByEnabled !== false;
    winByMargin = Number(rules.matchScoring.winCondition.winByMargin) || 2;
    pointCapEnabled = rules.matchScoring.winCondition.pointCapEnabled === true;
    pointCap = rules.matchScoring.winCondition.pointCap;
    changeEndsEnabled = rules.matchScoring.changeEnd.changeEndsEnabled === true;
    rulesSource =
      content.source === CONTENT_RULES_SOURCE.CONTENT_EXPLICIT
        ? "events[].competitionRules"
        : content.source === CONTENT_RULES_SOURCE.LEGACY_COMPATIBILITY_DRAFT
          ? "legacy.compatibility.draft"
          : "canonical.system.default";
  }

  if (tournament && eventId) {
    try {
      const surface = createOfficialOpenCompetitionRulesSurface({ tournament });
      const stageMap = {
        [OFFICIAL_ROUND_SCORE_KEY.GROUP]: "GROUP",
        [OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16]: "ROUND_OF_16",
        [OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL]: "QUARTERFINAL",
        [OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL]: "SEMIFINAL",
        [OFFICIAL_ROUND_SCORE_KEY.FINAL]: "FINAL",
      };
      canonicalStage = stageMap[roundKey] || "GROUP";
      const stageRes = surface.resolveStageMatchRules({
        eventId,
        stage: canonicalStage,
      });
      const stageTarget = Number(
        stageRes?.matchScoring?.targetPoints ??
          stageRes?.rules?.matchScoring?.targetPoints ??
          stageRes?.targetPoints
      );
      if (stageRes?.ok !== false && Number.isFinite(stageTarget) && stageTarget >= 1) {
        targetPoints = stageTarget;
        rulesSource = "competition.rules.policy.gateway.v1";
      }
      const stageScoring = stageRes?.matchScoring || stageRes?.rules?.matchScoring;
      if (stageScoring?.scoringMethod) {
        const method = String(stageScoring.scoringMethod).toUpperCase();
        scoringMethodOperational =
          method === "SIDE_OUT"
            ? OFFICIAL_SCORING_METHOD.SIDE_OUT
            : OFFICIAL_SCORING_METHOD.RALLY;
      }
      if (stageScoring?.winCondition) {
        winByEnabled = stageScoring.winCondition.winByEnabled !== false;
        winByMargin = Number(stageScoring.winCondition.winByMargin) || winByMargin;
        pointCapEnabled = stageScoring.winCondition.pointCapEnabled === true;
        pointCap = stageScoring.winCondition.pointCap;
      }
    } catch {
      // Keep Content / default targets if gateway unavailable.
    }
  }

  const sideOutCap = resolveOfficialEffectiveCapability(
    "SCORING_METHOD_SIDE_OUT"
  );
  const bo3Cap = resolveOfficialEffectiveCapability("MATCH_SERIES_BEST_OF_3");
  const winByCap = resolveOfficialEffectiveCapability("WIN_BY");
  const changeEndCap = resolveOfficialEffectiveCapability("CHANGE_END");

  if (
    scoringMethodOperational === OFFICIAL_SCORING_METHOD.SIDE_OUT &&
    sideOutCap.effectiveSelectable !== true
  ) {
    scoringMethodOperational = OFFICIAL_SCORING_METHOD.RALLY;
  }

  const matchFormatOperational = OFFICIAL_MATCH_FORMAT.BEST_OF_1;
  const formatRules = deriveOfficialMatchFormatRules(matchFormatOperational);
  const winBy =
    winByEnabled &&
    winByCap.effectiveSelectable === true &&
    WIN_BY_POLICY_DEFERRED !== true
      ? winByMargin
      : null;

  return {
    ok: true,
    roundKey,
    roundLabel: OFFICIAL_ROUND_SCORE_LABELS[roundKey] || roundKey,
    targetPoints,
    scoringMethod: scoringMethodOperational,
    scoringMethodLabel: OFFICIAL_SCORING_METHOD_LABELS[scoringMethodOperational],
    matchFormat: matchFormatOperational,
    matchFormatLabel: OFFICIAL_MATCH_FORMAT_LABELS[matchFormatOperational],
    bestOf: formatRules.bestOf,
    gamesToWin: formatRules.gamesToWin,
    maximumGames: formatRules.maximumGames,
    matchFormatIsOperational: true,
    winBy,
    winByEnabled,
    winByMargin,
    pointCapEnabled,
    pointCap,
    winByPolicyDeferred: WIN_BY_POLICY_DEFERRED === true,
    allowDraw: false,
    changeEndsEnabled:
      changeEndsEnabled && changeEndCap.effectiveSelectable === true,
    sideOutOperational: SIDEOUT_OPERATIONAL,
    sideOutRuntimeBlocked: !SIDEOUT_OPERATIONAL,
    sideOutPointByPointEnforced:
      scoringMethodOperational === OFFICIAL_SCORING_METHOD.SIDE_OUT,
    bestOf3Operational: BEST_OF_3_OPERATIONAL,
    sideOutSelectable: sideOutCap.effectiveSelectable === true,
    bestOf3Selectable: bo3Cap.effectiveSelectable === true,
    winBySelectable: winByCap.effectiveSelectable === true,
    changeEndSelectable: changeEndCap.effectiveSelectable === true,
    officialSideOutExecutionBindingGap: sideOutCap.bindingGap === true,
    officialBestOf3BindingGap: bo3Cap.bindingGap === true,
    officialWinByBindingGap: winByCap.bindingGap === true,
    officialChangeEndBindingGap: changeEndCap.bindingGap === true,
    rulesSource,
    contentRulesSource,
    canonicalStage,
    eventId,
    authority: "CORE-16_VIA_OFFICIAL_ADAPTER_B",
    summaryLabel: formatOfficialMatchRulesSummary({
      scoringMethodLabel: OFFICIAL_SCORING_METHOD_LABELS[scoringMethodOperational],
      matchFormatLabel: OFFICIAL_MATCH_FORMAT_LABELS[matchFormatOperational],
      targetPoints,
      roundLabel: OFFICIAL_ROUND_SCORE_LABELS[roundKey] || roundKey,
      winBy,
    }),
  };
}

/**
 * Deterministic Organizer/Referee rules summary — operable fields only.
 * Does not claim Side-out / Best of 3 / win-by / change-end when unavailable.
 */
export function formatOfficialMatchRulesSummary({
  scoringMethodLabel,
  matchFormatLabel,
  targetPoints,
  roundLabel,
  winBy,
} = {}) {
  const parts = [];
  if (roundLabel) parts.push(String(roundLabel));
  if (scoringMethodLabel) parts.push(String(scoringMethodLabel));
  if (matchFormatLabel) parts.push(String(matchFormatLabel));
  if (targetPoints != null) parts.push(`Đích ${targetPoints} điểm`);
  if (winBy != null) parts.push(`Thắng cách ${winBy}`);
  return parts.join(" · ");
}

/**
 * Operator-facing detail lines for Settings / Referee context.
 */
export function buildOfficialMatchRulesSummaryLines(tournament, match = {}, options = {}) {
  const rules = resolveOfficialMatchScoringRules(tournament, match, options);
  const lines = [
    { key: "scoring", label: "Cách tính điểm", value: rules.scoringMethodLabel },
    { key: "format", label: "Thể thức trận", value: rules.matchFormatLabel },
    {
      key: "target",
      label: `Điểm kết thúc (${rules.roundLabel})`,
      value: `${rules.targetPoints} điểm`,
    },
  ];
  if (!rules.sideOutOperational) {
    lines.push({
      key: "side_out",
      label: "Truyền thống (Side-out)",
      value: "Chưa sẵn sàng — dùng Rally",
      unavailable: true,
    });
  }
  if (!rules.bestOf3Operational) {
    lines.push({
      key: "best_of_3",
      label: "Best of 3",
      value: "Chưa sẵn sàng — dùng Best of 1",
      unavailable: true,
    });
  }
  if (rules.winBySelectable && rules.winBy != null) {
    lines.push({
      key: "win_by",
      label: "Thắng cách (win-by)",
      value: `CORE-16 · thắng cách ${rules.winBy}`,
    });
  } else if (rules.winByPolicyDeferred) {
    lines.push({
      key: "win_by",
      label: "Thắng cách (win-by)",
      value: "Đang deferred — không hardcode winBy",
      unavailable: true,
    });
  }
  lines.push({
    key: "change_end",
    label: "Đổi sân / change-end",
    value: rules.changeEndSelectable
      ? "CORE-16 / ops bound"
      : "PARTIAL — session ACK only; durable court orientation chưa bind",
    unavailable: !rules.changeEndSelectable,
  });
  return {
    summaryLabel: rules.summaryLabel,
    lines,
    rules,
  };
}

/**
 * Validate finished score against CORE-16 win conditions when winBy is bound.
 * Classic draw rejection preserved. Does not invent a second scoring engine.
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
  const winBy = rules?.winBy != null ? Number(rules.winBy) : null;
  if (winBy != null && Number.isFinite(winBy) && winBy >= 1) {
    try {
      const format = createScoringFormat({
        scoringSystem: "RALLY",
        pointsToWin: target,
        winBy,
        maximumScore: rules.pointCap != null ? Number(rules.pointCap) : null,
        bestOfGames: 1,
      });
      const result = evaluateGameComplete(
        { [SCORING_SIDE.SIDE_A]: a, [SCORING_SIDE.SIDE_B]: b },
        format
      );
      if (!result.complete) {
        return {
          ok: false,
          error: `CORE-16: chưa đủ điều kiện thắng (đích ${target}, thắng cách ${winBy}).`,
        };
      }
      return { ok: true, authority: "CORE-16" };
    } catch {
      // Fall through to classic target check
    }
  }
  const winner = Math.max(a, b);
  if (winner < target) {
    return {
      ok: false,
      error: `Điểm thắng phải đạt ít nhất ${target}.`,
    };
  }
  return { ok: true };
}
