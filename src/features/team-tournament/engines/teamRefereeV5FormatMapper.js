/**
 * R2-2G — Team Tournament ↔ Referee V5 scoring format mapping.
 * Override order: sub-match → discipline → tournament default.
 */

import { DISCIPLINE_CATEGORY, SCORING_SYSTEM } from "../constants.js";
import {
  RULE_SET_ID,
  SCORING_SYSTEM as V5_SCORING_SYSTEM,
  SCORING_VARIANT,
} from "../../referee-v5/constants/scoringStrategy.js";
import { SCORING_FORMAT } from "../../referee-v5/constants/scoringFormats.js";
import { MATCH_TYPE } from "../../referee-v5/constants/matchTypes.js";

export const USAP_2026_RALLY_DOUBLES_PROFILE = Object.freeze({
  scoringSystem: SCORING_SYSTEM.RALLY,
  scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
  pointsToWin: 11,
  winBy: 2,
  bestOf: 1,
  freezeRule: "NONE",
  serverNumberRule: "NONE",
  matchType: MATCH_TYPE.DOUBLES,
});

/** Feature flag — default OFF outside controlled staging/dev. */
export function isTtRefereeV5RallyEnabled() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return (
      String(import.meta.env.VITE_TT5_REFEREE_V5_RALLY_ENABLED || "").toLowerCase() === "true"
    );
  }
  return String(globalThis.process?.env?.VITE_TT5_REFEREE_V5_RALLY_ENABLED || "").toLowerCase() === "true";
}

function parseMatchFormat(raw) {
  const value = String(raw || "best_of_1").toLowerCase();
  if (value === "best_of_3" || value === "bo3" || value === "3") {
    return { matchFormat: "best_of_3", bestOf: 3 };
  }
  if (value === "best_of_5" || value === "bo5" || value === "5") {
    return { matchFormat: "best_of_5", bestOf: 5 };
  }
  return { matchFormat: "best_of_1", bestOf: 1 };
}

function normalizeSystem(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "rally" || value === "r") {
    return SCORING_SYSTEM.RALLY;
  }
  if (value === "side_out" || value === "sideout" || value === "side-out" || value === "s") {
    return SCORING_SYSTEM.SIDE_OUT;
  }
  return null;
}

function scoringSourceLabel(subMatchOverride, disciplineFormat, tournamentDefault) {
  if (subMatchOverride.scoringSystem != null || subMatchOverride.scoringVariant != null) {
    return "sub_match";
  }
  if (disciplineFormat.scoringSystem != null || disciplineFormat.scoringVariant != null) {
    return "discipline";
  }
  if (tournamentDefault.scoringSystem != null || tournamentDefault.scoringVariant != null) {
    return "tournament";
  }
  return "default";
}

/** True when TT config is the approved USAP 2026 Provisional Rally Doubles profile. */
export function isUsap2026RallyDoublesConfig(merged = {}) {
  const system = normalizeSystem(merged.scoringSystem);
  if (system !== SCORING_SYSTEM.RALLY) {
    return false;
  }
  const variant = String(merged.scoringVariant || "").trim();
  if (variant && variant !== SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY) {
    return false;
  }
  if (/mlp|dream|freeze/i.test(String(merged.matchFormat || ""))) {
    return false;
  }
  if (merged.freezeAt != null && merged.freezeAt !== "") {
    return false;
  }
  const freezeRule = String(merged.freezeRule || "NONE").toUpperCase();
  if (freezeRule !== "NONE") {
    return false;
  }
  const points = Number(merged.pointsToWin ?? merged.targetScore);
  if (Number.isFinite(points) && points !== 11) {
    return false;
  }
  return true;
}

/**
 * Resolve official scoring config with override hierarchy.
 */
export function resolveOfficialScoringConfig({
  tournamentSettings = null,
  discipline = null,
  subMatch = null,
} = {}) {
  const tournamentDefault =
    tournamentSettings?.scoringFormat && typeof tournamentSettings.scoringFormat === "object"
      ? tournamentSettings.scoringFormat
      : {};
  const disciplineFormat =
    discipline?.scoringFormat && typeof discipline.scoringFormat === "object"
      ? discipline.scoringFormat
      : {};
  const subMatchOverride =
    subMatch?.scoringFormat && typeof subMatch.scoringFormat === "object"
      ? subMatch.scoringFormat
      : {};

  const merged = {
    scoringSystem: SCORING_SYSTEM.SIDE_OUT,
    targetScore: 21,
    winBy: 2,
    matchFormat: "best_of_1",
    freezeAt: null,
    ...tournamentDefault,
    ...disciplineFormat,
    ...subMatchOverride,
  };

  const system = normalizeSystem(merged.scoringSystem) || SCORING_SYSTEM.SIDE_OUT;
  const { matchFormat, bestOf } = parseMatchFormat(merged.matchFormat || merged.bestOf);
  const source = scoringSourceLabel(subMatchOverride, disciplineFormat, tournamentDefault);

  if (system === SCORING_SYSTEM.RALLY) {
    const usap = isUsap2026RallyDoublesConfig(merged);
    return {
      scoringSystem: SCORING_SYSTEM.RALLY,
      scoringVariant: usap
        ? SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY
        : String(merged.scoringVariant || "UNSUPPORTED_RALLY"),
      targetScore: Number(merged.targetScore ?? merged.pointsToWin) || 11,
      pointsToWin: Number(merged.pointsToWin ?? merged.targetScore) || 11,
      winBy: Number(merged.winBy) || 2,
      matchFormat,
      bestOf,
      freezeRule: String(merged.freezeRule || (merged.freezeAt != null ? "FREEZE" : "NONE")),
      serverNumberRule: String(merged.serverNumberRule || "NONE"),
      freezeAt: merged.freezeAt == null || merged.freezeAt === "" ? null : Number(merged.freezeAt),
      supported: usap,
      source,
    };
  }

  return {
    scoringSystem: SCORING_SYSTEM.SIDE_OUT,
    scoringVariant: null,
    targetScore: Number(merged.targetScore) || 21,
    pointsToWin: Number(merged.pointsToWin ?? merged.targetScore) || 21,
    winBy: Number(merged.winBy) || 2,
    matchFormat,
    bestOf,
    freezeRule: null,
    serverNumberRule: null,
    freezeAt: merged.freezeAt == null || merged.freezeAt === "" ? null : Number(merged.freezeAt),
    supported: true,
    source,
  };
}

/**
 * Validate config before V5 match creation.
 */
export function assertProvisionScoringAllowed(resolvedConfig, matchType) {
  const type = String(matchType || MATCH_TYPE.DOUBLES).toLowerCase();

  if (resolvedConfig.scoringSystem === SCORING_SYSTEM.RALLY) {
    if (!isTtRefereeV5RallyEnabled()) {
      return {
        ok: false,
        code: "RALLY_PROVISION_DISABLED",
        error: "Rally Scoring qua Referee V5 đang tắt (VITE_TT5_REFEREE_V5_RALLY_ENABLED).",
      };
    }
    if (type === DISCIPLINE_CATEGORY.SINGLES || type === MATCH_TYPE.SINGLES) {
      return {
        ok: false,
        code: "UNSUPPORTED_SCORING_VARIANT",
        error: "USAP 2026 Provisional Rally chỉ hỗ trợ doubles trong R2-2G.",
      };
    }
    if (!resolvedConfig.supported || !isUsap2026RallyDoublesConfig(resolvedConfig)) {
      return {
        ok: false,
        code: "UNSUPPORTED_SCORING_VARIANT",
        error:
          "Chỉ hỗ trợ USAP 2026 Provisional Rally Doubles (11, win-by-2, freeze NONE). MLP/Singles/Freeze bị từ chối.",
      };
    }
  }

  return { ok: true, config: resolvedConfig };
}

/**
 * Map resolved TT scoring → Referee V5 state shell fields (P0-06 fix).
 */
export function mapTtScoringToV5StateFields(resolvedConfig, matchType = MATCH_TYPE.DOUBLES) {
  const gate = assertProvisionScoringAllowed(resolvedConfig, matchType);
  if (!gate.ok) {
    return gate;
  }

  const type = String(matchType || MATCH_TYPE.DOUBLES).toLowerCase();
  const bestOf = Number(resolvedConfig.bestOf) || 1;

  if (resolvedConfig.scoringSystem === SCORING_SYSTEM.RALLY) {
    return {
      ok: true,
      scoringFormat: SCORING_FORMAT.RALLY,
      scoringSystem: V5_SCORING_SYSTEM.RALLY,
      scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
      ruleSetId: RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1,
      pointsToWin: 11,
      winBy: 2,
      bestOf,
      freezeRule: "NONE",
      serverNumberRule: "NONE",
      serverNumber: null,
      matchType: MATCH_TYPE.DOUBLES,
    };
  }

  return {
    ok: true,
    scoringFormat: SCORING_FORMAT.SIDE_OUT,
    scoringSystem: V5_SCORING_SYSTEM.SIDE_OUT,
    scoringVariant:
      type === MATCH_TYPE.SINGLES
        ? SCORING_VARIANT.SIDE_OUT_SINGLES_V1
        : SCORING_VARIANT.SIDE_OUT_DOUBLES_V1,
    ruleSetId:
      type === MATCH_TYPE.SINGLES
        ? RULE_SET_ID.SIDE_OUT_SINGLES_V1
        : RULE_SET_ID.SIDE_OUT_DOUBLES_V1,
    pointsToWin: Number(resolvedConfig.pointsToWin) || 21,
    winBy: Number(resolvedConfig.winBy) || 2,
    bestOf,
    freezeRule: null,
    serverNumberRule: null,
    serverNumber: type === MATCH_TYPE.SINGLES ? null : 1,
    matchType: type === MATCH_TYPE.SINGLES ? MATCH_TYPE.SINGLES : MATCH_TYPE.DOUBLES,
  };
}

/** Build provision config JSON that SQL `team_tournament_build_v5_state_shell` understands. */
export function buildProvisionScoringFormatPayload(resolvedConfig, matchType = MATCH_TYPE.DOUBLES) {
  const mapped = mapTtScoringToV5StateFields(resolvedConfig, matchType);
  if (!mapped.ok) {
    return mapped;
  }
  return {
    ok: true,
    scoringFormat: {
      scoringSystem: resolvedConfig.scoringSystem,
      scoringVariant: mapped.scoringVariant,
      scoringFormat: mapped.scoringFormat,
      pointsToWin: mapped.pointsToWin,
      targetScore: mapped.pointsToWin,
      winBy: mapped.winBy,
      bestOf: mapped.bestOf,
      matchFormat: resolvedConfig.matchFormat,
      freezeRule: mapped.freezeRule,
      serverNumberRule: mapped.serverNumberRule,
      freezeAt: resolvedConfig.freezeAt,
    },
    mapped,
  };
}

/** Build USAP Rally discipline scoringFormat for TT config UI / fixtures. */
export function buildUsap2026RallyDoublesScoringFormat(overrides = {}) {
  const { matchFormat, bestOf } = parseMatchFormat(
    overrides.matchFormat || overrides.bestOf || "best_of_1",
  );
  return {
    scoringSystem: SCORING_SYSTEM.RALLY,
    scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
    targetScore: Number(overrides.targetScore) || 11,
    pointsToWin: Number(overrides.pointsToWin || overrides.targetScore) || 11,
    winBy: Number(overrides.winBy) || 2,
    matchFormat,
    bestOf,
    freezeAt: null,
    freezeRule: "NONE",
    serverNumberRule: "NONE",
    winPoints: Number(overrides.winPoints) || 1,
  };
}

export function buildSideOutScoringFormat(overrides = {}) {
  const { matchFormat, bestOf } = parseMatchFormat(
    overrides.matchFormat || overrides.bestOf || "best_of_1",
  );
  return {
    scoringSystem: SCORING_SYSTEM.SIDE_OUT,
    scoringVariant: null,
    targetScore: Number(overrides.targetScore) || 21,
    winBy: Number(overrides.winBy) || 2,
    matchFormat,
    bestOf,
    freezeAt: overrides.freezeAt == null ? 20 : Number(overrides.freezeAt),
    sideSwitchAt: Number(overrides.sideSwitchAt) || 11,
    winPoints: Number(overrides.winPoints) || 1,
  };
}

/**
 * Format becomes immutable after Referee V5 match creation or match start.
 */
export function assertScoringFormatImmutable({
  previousFormat = null,
  nextFormat = null,
  refereeLinkStatus = null,
  matchStatus = null,
} = {}) {
  const linked = Boolean(refereeLinkStatus) &&
    !["none", "revoked", null, undefined, ""].includes(String(refereeLinkStatus).toLowerCase());
  const started = ["in_progress", "completed", "locked", "finalized"].includes(
    String(matchStatus || "").toLowerCase(),
  );

  if (!linked && !started) {
    return { ok: true, immutable: false };
  }

  const prev = JSON.stringify(previousFormat || {});
  const next = JSON.stringify(nextFormat || {});
  if (prev !== next) {
    return {
      ok: false,
      immutable: true,
      code: "SCORING_FORMAT_IMMUTABLE",
      error: "Không được đổi scoring format sau khi đã provision / bắt đầu trận Referee V5.",
    };
  }
  return { ok: true, immutable: true };
}

/**
 * Best-of match result from games list — does not force an unnecessary final game.
 */
export function resolveBestOfMatchOutcome(games = [], bestOf = 1) {
  const needed = Math.floor(Number(bestOf) / 2) + 1;
  let winsA = 0;
  let winsB = 0;
  const played = [];

  for (const game of games) {
    const a = Number(game.teamA) || 0;
    const b = Number(game.teamB) || 0;
    if (a === b) {
      continue;
    }
    if (a > b) {
      winsA += 1;
    } else {
      winsB += 1;
    }
    played.push({ teamA: a, teamB: b });
    if (winsA >= needed || winsB >= needed) {
      break;
    }
  }

  return {
    ok: true,
    complete: winsA >= needed || winsB >= needed,
    gamesPlayed: played.length,
    games: played,
    winsA,
    winsB,
    winnerSide: winsA > winsB ? "teamA" : winsB > winsA ? "teamB" : null,
    forcedThirdGame: false,
    unnecessaryThirdGame: bestOf >= 3 && played.length === 2 && (winsA >= needed || winsB >= needed),
  };
}

/** Apply correction: newer revision replaces prior official summary once. */
export function applyOfficialResultRevision({
  previousAppliedRevision = null,
  incomingRevision,
  previousEffect = null,
} = {}) {
  const incoming = Number(incomingRevision?.revision ?? incomingRevision?.revisionNumber);
  if (!Number.isFinite(incoming)) {
    return { ok: false, code: "INVALID_REVISION" };
  }
  if (previousAppliedRevision != null && incoming < Number(previousAppliedRevision)) {
    return { ok: false, code: "STALE_REVISION", appliedRevision: previousAppliedRevision };
  }
  if (previousAppliedRevision != null && incoming === Number(previousAppliedRevision)) {
    return {
      ok: true,
      duplicate: true,
      appliedRevision: previousAppliedRevision,
      effect: previousEffect,
    };
  }

  return {
    ok: true,
    duplicate: false,
    appliedRevision: incoming,
    reversedPrevious: previousEffect || null,
    effect: incomingRevision,
  };
}

/** Standings-agnostic summary from official result contract (Side-Out or Rally). */
export function summarizeOfficialResultForStandings({
  winnerTeamId = null,
  score = null,
  games = null,
  winPoints = 1,
} = {}) {
  const teamA = Number(score?.teamA ?? 0);
  const teamB = Number(score?.teamB ?? 0);
  const gameList = Array.isArray(games) ? games : score?.games || [];
  let gameWinsA = 0;
  let gameWinsB = 0;
  for (const game of gameList) {
    const a = Number(game.teamA) || 0;
    const b = Number(game.teamB) || 0;
    if (a > b) gameWinsA += 1;
    else if (b > a) gameWinsB += 1;
  }
  if (!gameList.length) {
    if (teamA > teamB) gameWinsA = 1;
    else if (teamB > teamA) gameWinsB = 1;
  }

  return {
    winnerTeamId: winnerTeamId || null,
    matchWin: Boolean(winnerTeamId),
    gameWinsA,
    gameWinsB,
    pointsScoredA: teamA,
    pointsScoredB: teamB,
    teamPointsAwarded: winnerTeamId ? Number(winPoints) || 1 : 0,
  };
}

/** Live / undo events must not touch Team Tournament standings. */
export function shouldUpdateStandingsFromRefereeEvent(eventType, isFinalized = false) {
  const type = String(eventType || "").toUpperCase();
  if (!isFinalized) {
    return false;
  }
  if (type.includes("LIVE") || type.includes("POINT") || type.includes("UNDO") || type.includes("REVERT")) {
    return false;
  }
  return (
    type === "REFEREE_MATCH_FINALIZED" ||
    type === "REFEREE_RESULT_REVISED" ||
    type === "MATCH_FINALIZED" ||
    type === "RESULT_REVISED"
  );
}
