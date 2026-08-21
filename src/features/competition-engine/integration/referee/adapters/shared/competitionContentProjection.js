/**
 * Competition content + match-format projection for Referee UI / Adapter B.
 * Translation / presentation only — not a new domain authority.
 */

import {
  EVENT_TYPE,
  EVENT_TYPE_ALIASES,
  EVENT_TYPE_LABELS,
} from "../../../../../../models/tournament/constants.js";

export const REFEREE_MATCH_FORMAT = Object.freeze({
  SINGLES: "SINGLES",
  DOUBLES: "DOUBLES",
  TEAM_SUBMATCH: "TEAM_SUBMATCH",
  DREAMBREAKER: "DREAMBREAKER",
});

export const LOGICAL_COURT_POSITION = Object.freeze({
  RIGHT: "RIGHT",
  LEFT: "LEFT",
});

const SINGLES_EVENT_TYPES = new Set([
  EVENT_TYPE.MEN_SINGLE,
  EVENT_TYPE.WOMEN_SINGLE,
]);

const DOUBLES_EVENT_TYPES = new Set([
  EVENT_TYPE.MEN_DOUBLE,
  EVENT_TYPE.WOMEN_DOUBLE,
  EVENT_TYPE.MIXED_DOUBLE,
  EVENT_TYPE.OPEN_DOUBLE,
]);

const DAILY_SINGLES_TYPES = new Set([
  "single",
  "singles",
  "men_single",
  "women_single",
  "mens_singles",
  "womens_singles",
]);

const DAILY_DOUBLES_TYPES = new Set([
  "double",
  "doubles",
  "mixed_double",
  "mixed_doubles",
  "men_double",
  "women_double",
  "open_double",
]);

function trim(value) {
  return String(value || "").trim();
}

function upper(value) {
  return trim(value).toUpperCase();
}

function normalizeEventTypeCode(raw) {
  const key = trim(raw).toLowerCase().replace(/-/g, "_");
  if (!key) return null;
  if (EVENT_TYPE_ALIASES[key]) return EVENT_TYPE_ALIASES[key];
  const values = Object.values(EVENT_TYPE);
  if (values.includes(key)) return key;
  // Accept SCREAMING_SNAKE from some fixtures
  const asSnake = key.toLowerCase();
  if (values.includes(asSnake)) return asSnake;
  return key;
}

function labelForEventType(code) {
  if (!code) return null;
  return EVENT_TYPE_LABELS[code] || EVENT_TYPE_LABELS[String(code).toLowerCase()] || null;
}

function countPlayers(ids) {
  return Array.isArray(ids) ? ids.map(String).filter(Boolean).length : 0;
}

function rosterEvidencePlayersPerSide(input = {}) {
  const a =
    countPlayers(input.participantIdsA) ||
    countPlayers(input.teamAPlayerIds) ||
    countPlayers(input.lineupA) ||
    countPlayers(input.sides?.[0]?.participantIds);
  const b =
    countPlayers(input.participantIdsB) ||
    countPlayers(input.teamBPlayerIds) ||
    countPlayers(input.lineupB) ||
    countPlayers(input.sides?.[1]?.participantIds);
  if (a === 1 && (b === 1 || b === 0)) return 1;
  if (a >= 2 || b >= 2) return 2;
  if (a === 1 || b === 1) return 1;
  return null;
}

function isDreambreakerSignal(input = {}) {
  if (input.isDreambreaker === true) return true;
  const discipline = trim(input.discipline || input.disciplineId || input.disciplineExternalId);
  if (discipline.toLowerCase() === "dreambreaker") return true;
  const matchId = trim(input.matchId || input.subMatchId || input.id);
  if (matchId.toLowerCase().startsWith("db-")) return true;
  const format = upper(input.matchFormat);
  return format === REFEREE_MATCH_FORMAT.DREAMBREAKER;
}

function isTeamSubmatchSignal(input = {}) {
  if (input.isTeamSubmatch === true) return true;
  if (upper(input.competitionMode) === "TEAM") return true;
  if (trim(input.discipline || input.disciplineId || input.disciplineName)) return true;
  if (trim(input.matchupId) && trim(input.subMatchId || input.parentMatchId)) return true;
  return upper(input.matchFormat) === REFEREE_MATCH_FORMAT.TEAM_SUBMATCH;
}

/**
 * Resolve competition content code/label from durable event / discipline / daily matchType.
 * @param {object} input
 */
export function resolveCompetitionContent(input = {}) {
  if (isDreambreakerSignal(input)) {
    return Object.freeze({
      competitionContentCode: "DREAMBREAKER",
      competitionContentLabel: "DreamBreaker",
    });
  }

  const eventType = normalizeEventTypeCode(
    input.eventType || input.competitionContentCode || input.contentCode
  );
  if (eventType && labelForEventType(eventType)) {
    return Object.freeze({
      competitionContentCode: eventType,
      competitionContentLabel: labelForEventType(eventType),
    });
  }

  const disciplineName = trim(
    input.disciplineName || input.disciplineLabel || input.contentLabel
  );
  const disciplineId = trim(input.discipline || input.disciplineId || input.disciplineExternalId);
  if (disciplineName) {
    return Object.freeze({
      competitionContentCode: disciplineId || disciplineName,
      competitionContentLabel: disciplineName,
    });
  }
  if (disciplineId && disciplineId.toLowerCase() !== "dreambreaker") {
    return Object.freeze({
      competitionContentCode: disciplineId,
      competitionContentLabel: disciplineId,
    });
  }

  const matchType = normalizeEventTypeCode(input.matchType);
  if (matchType && labelForEventType(matchType)) {
    return Object.freeze({
      competitionContentCode: matchType,
      competitionContentLabel: labelForEventType(matchType),
    });
  }

  // Daily Play friendly fallbacks from matchType tokens
  const dailyType = trim(input.matchType).toLowerCase();
  if (DAILY_SINGLES_TYPES.has(dailyType)) {
    return Object.freeze({
      competitionContentCode: dailyType,
      competitionContentLabel: "Đơn",
    });
  }
  if (DAILY_DOUBLES_TYPES.has(dailyType)) {
    const mixed = dailyType.includes("mixed");
    return Object.freeze({
      competitionContentCode: dailyType,
      competitionContentLabel: mixed ? "Đôi nam nữ" : "Đôi",
    });
  }

  return Object.freeze({
    competitionContentCode: null,
    competitionContentLabel: null,
  });
}

/**
 * Derive presentation match format + expectedPlayersPerSide.
 * Prefer durable content codes; use roster evidence as secondary signal.
 * Never infer solely from display names like "Đội".
 * @param {object} input
 */
export function resolveRefereeMatchFormat(input = {}) {
  if (isDreambreakerSignal(input)) {
    return Object.freeze({
      matchFormat: REFEREE_MATCH_FORMAT.DREAMBREAKER,
      expectedPlayersPerSide: 1,
    });
  }

  const eventType = normalizeEventTypeCode(
    input.eventType || input.competitionContentCode || input.contentCode
  );
  const roster = rosterEvidencePlayersPerSide(input);
  const explicit =
    Number(input.expectedPlayersPerSide) > 0
      ? Number(input.expectedPlayersPerSide)
      : null;

  let playersPerSide = explicit;
  if (playersPerSide == null && eventType && SINGLES_EVENT_TYPES.has(eventType)) {
    playersPerSide = 1;
  } else if (playersPerSide == null && eventType && DOUBLES_EVENT_TYPES.has(eventType)) {
    playersPerSide = 2;
  } else if (playersPerSide == null) {
    const matchType = trim(input.matchType).toLowerCase();
    if (DAILY_SINGLES_TYPES.has(matchType)) playersPerSide = 1;
    else if (DAILY_DOUBLES_TYPES.has(matchType)) playersPerSide = 2;
    else if (roster != null) playersPerSide = roster;
  }

  if (isTeamSubmatchSignal(input)) {
    return Object.freeze({
      matchFormat: REFEREE_MATCH_FORMAT.TEAM_SUBMATCH,
      expectedPlayersPerSide: playersPerSide === 1 ? 1 : 2,
    });
  }

  if (playersPerSide === 1) {
    return Object.freeze({
      matchFormat: REFEREE_MATCH_FORMAT.SINGLES,
      expectedPlayersPerSide: 1,
    });
  }

  return Object.freeze({
    matchFormat: REFEREE_MATCH_FORMAT.DOUBLES,
    expectedPlayersPerSide: 2,
  });
}

/**
 * Full projection fields for modeState / matchContext / Home+Match cards.
 * @param {object} input
 */
export function projectCompetitionMatchFormat(input = {}) {
  const content = resolveCompetitionContent(input);
  const format = resolveRefereeMatchFormat({
    ...input,
    eventType: input.eventType || content.competitionContentCode,
    competitionContentCode: content.competitionContentCode,
  });
  return Object.freeze({
    competitionContentCode: content.competitionContentCode,
    competitionContentLabel: content.competitionContentLabel,
    matchFormat: format.matchFormat,
    expectedPlayersPerSide: format.expectedPlayersPerSide,
  });
}

/**
 * Side-Out doubles opening policy for CORE-16 format metadata (wiring only).
 * @param {{ scoringSystem?: string, matchFormat?: string, expectedPlayersPerSide?: number, serversPerSide?: number, metadata?: object }} rules
 * @param {{ matchFormat?: string, expectedPlayersPerSide?: number }} [formatHint]
 */
export function applySideOutDoublesOpeningPolicy(rules, formatHint = {}) {
  if (!rules || typeof rules !== "object") return rules;
  const scoringSystem = upper(rules.scoringSystem);
  if (scoringSystem !== "SIDE_OUT") return rules;

  const expected =
    Number(formatHint.expectedPlayersPerSide) > 0
      ? Number(formatHint.expectedPlayersPerSide)
      : Number(rules.expectedPlayersPerSide) > 0
        ? Number(rules.expectedPlayersPerSide)
        : null;
  const matchFormat = upper(formatHint.matchFormat || rules.matchFormat);
  const isDoublesShaped =
    expected === 2 ||
    matchFormat === REFEREE_MATCH_FORMAT.DOUBLES ||
    (matchFormat === REFEREE_MATCH_FORMAT.TEAM_SUBMATCH && expected !== 1);

  if (!isDoublesShaped) {
    // Singles Side-Out: one server per side; do not force opening turn 2.
    const next = { ...rules };
    if (next.serversPerSide == null) next.serversPerSide = 1;
    return next;
  }

  const metadata =
    rules.metadata && typeof rules.metadata === "object" && !Array.isArray(rules.metadata)
      ? { ...rules.metadata }
      : {};
  if (metadata.openingServiceTurn == null || metadata.openingServiceTurn === "") {
    metadata.openingServiceTurn = 2;
  }
  return {
    ...rules,
    serversPerSide: rules.serversPerSide == null ? 2 : rules.serversPerSide,
    metadata,
  };
}

/**
 * Map screen court slot → logical RIGHT/LEFT for operator language.
 * Left (far) end: top=RIGHT, bottom=LEFT.
 * Right (near) end: bottom=RIGHT, top=LEFT (diagonal convention).
 * @param {string} slot
 */
export function logicalPositionForCourtSlot(slot) {
  const key = trim(slot);
  if (key === "leftTop" || key === "rightBottom") return LOGICAL_COURT_POSITION.RIGHT;
  if (key === "leftBottom" || key === "rightTop") return LOGICAL_COURT_POSITION.LEFT;
  return null;
}

export function formatLogicalCourtPositionLabel(position) {
  const key = upper(position);
  if (key === LOGICAL_COURT_POSITION.RIGHT) return "Phải";
  if (key === LOGICAL_COURT_POSITION.LEFT) return "Trái";
  return null;
}

/**
 * Pickleball service-court from serving-side points (even → RIGHT, odd → LEFT).
 * @param {number} servingSidePoints
 */
export function serviceCourtFromScore(servingSidePoints) {
  const n = Number(servingSidePoints);
  if (!Number.isFinite(n) || n < 0) return LOGICAL_COURT_POSITION.RIGHT;
  return n % 2 === 0 ? LOGICAL_COURT_POSITION.RIGHT : LOGICAL_COURT_POSITION.LEFT;
}

export function oppositeCourtPosition(position) {
  const key = upper(position);
  if (key === LOGICAL_COURT_POSITION.RIGHT) return LOGICAL_COURT_POSITION.LEFT;
  if (key === LOGICAL_COURT_POSITION.LEFT) return LOGICAL_COURT_POSITION.RIGHT;
  return null;
}
