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
  return Array.isArray(ids)
    ? [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))].length
    : 0;
}

function sidePlayerIds(input = {}, side) {
  if (side === "A") {
    return (
      (Array.isArray(input.participantIdsA) && input.participantIdsA) ||
      (Array.isArray(input.teamAPlayerIds) && input.teamAPlayerIds) ||
      (Array.isArray(input.lineupA) && input.lineupA) ||
      (Array.isArray(input.sides?.[0]?.participantIds) &&
        input.sides[0].participantIds) ||
      []
    );
  }
  return (
    (Array.isArray(input.participantIdsB) && input.participantIdsB) ||
    (Array.isArray(input.teamBPlayerIds) && input.teamBPlayerIds) ||
    (Array.isArray(input.lineupB) && input.lineupB) ||
    (Array.isArray(input.sides?.[1]?.participantIds) &&
      input.sides[1].participantIds) ||
    []
  );
}

function rosterEvidencePlayersPerSide(input = {}) {
  const a = countPlayers(sidePlayerIds(input, "A"));
  const b = countPlayers(sidePlayerIds(input, "B"));
  if (a === 1 && (b === 1 || b === 0)) return 1;
  if (a >= 2 || b >= 2) return 2;
  if (a === 1 || b === 1) return 1;
  return null;
}

function formatFamilyFromMatchType(matchType) {
  const key = trim(matchType).toLowerCase();
  if (!key) return null;
  if (DAILY_SINGLES_TYPES.has(key) || key === "singles" || key === "single") {
    return "SINGLES";
  }
  if (DAILY_DOUBLES_TYPES.has(key) || key === "doubles" || key === "double") {
    return "DOUBLES";
  }
  return null;
}

function formatFamilyFromEventType(code) {
  if (!code) return null;
  if (SINGLES_EVENT_TYPES.has(code)) return "SINGLES";
  if (DOUBLES_EVENT_TYPES.has(code)) return "DOUBLES";
  return null;
}

/**
 * Resolve durable event type when payload may expose both `eventType` and legacy `type`.
 * Content controls format — roster never picks the code, but when durable fields conflict,
 * prefer the candidate that agrees with match.matchType family (singles/doubles).
 * @param {object} input
 */
export function resolveDurableEventTypeCode(input = {}) {
  const candidates = [
    normalizeEventTypeCode(input.eventType),
    normalizeEventTypeCode(input.type),
    normalizeEventTypeCode(input.matchEventType),
    normalizeEventTypeCode(input.contentCode),
    normalizeEventTypeCode(input.competitionContentCode),
  ].filter((code) => code && labelForEventType(code));

  if (!candidates.length) return null;
  const unique = [...new Set(candidates)];
  if (unique.length === 1) return unique[0];

  const familyHint =
    formatFamilyFromMatchType(input.matchType) ||
    formatFamilyFromMatchType(input.match?.matchType);
  if (familyHint) {
    const agreeing = unique.filter((code) => formatFamilyFromEventType(code) === familyHint);
    if (agreeing.length === 1) return agreeing[0];
    if (agreeing.length > 1) {
      // Prefer explicit eventType among agreeing candidates when present.
      const preferred = normalizeEventTypeCode(input.eventType);
      if (agreeing.includes(preferred)) return preferred;
      return agreeing[0];
    }
  }

  // Conflicting singles/doubles codes with no matchType hint: prefer legacy `type`
  // when it is a known event code (CORE13 fixtures store truthful type + stale eventType).
  const fromType = normalizeEventTypeCode(input.type);
  if (fromType && labelForEventType(fromType)) return fromType;
  const fromEventType = normalizeEventTypeCode(input.eventType);
  if (fromEventType && labelForEventType(fromEventType)) return fromEventType;
  return unique[0];
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

  const eventType = resolveDurableEventTypeCode(input);
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
 * Content / discipline controls format. Roster NEVER silently downgrades
 * a canonical doubles content code into SINGLES.
 * Roster is only a secondary signal when no durable content code exists.
 * @param {object} input
 */
export function resolveRefereeMatchFormat(input = {}) {
  if (isDreambreakerSignal(input)) {
    return Object.freeze({
      matchFormat: REFEREE_MATCH_FORMAT.DREAMBREAKER,
      expectedPlayersPerSide: 1,
    });
  }

  const eventType = resolveDurableEventTypeCode({
    ...input,
    eventType: input.eventType || input.competitionContentCode || input.contentCode,
  });
  const roster = rosterEvidencePlayersPerSide(input);
  const explicit =
    Number(input.expectedPlayersPerSide) > 0
      ? Number(input.expectedPlayersPerSide)
      : null;

  let playersPerSide = explicit;
  // Content precedence: known singles/doubles event codes always win over roster length.
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

export const ROSTER_VALIDATION_CODE = Object.freeze({
  OK: "OK",
  INVALID_ROSTER: "INVALID_ROSTER",
  DATA_INCONSISTENCY: "DATA_INCONSISTENCY",
});

/**
 * Fail-closed content↔roster consistency. Does not invent athletes or downgrade format.
 * DreamBreaker allows 1 active athlete per side by explicit discipline.
 * @param {object} input
 */
export function validateContentRosterConsistency(input = {}) {
  const content = projectCompetitionMatchFormat(input);
  if (content.matchFormat === REFEREE_MATCH_FORMAT.DREAMBREAKER) {
    return Object.freeze({
      ok: true,
      code: ROSTER_VALIDATION_CODE.OK,
      message: null,
      matchFormat: content.matchFormat,
      expectedPlayersPerSide: 1,
      sideACount: countPlayers(sidePlayerIds(input, "A")),
      sideBCount: countPlayers(sidePlayerIds(input, "B")),
      offendingSides: Object.freeze([]),
      competitionContentCode: content.competitionContentCode,
      competitionContentLabel: content.competitionContentLabel,
    });
  }

  const expected = Number(content.expectedPlayersPerSide);
  const sideACount = countPlayers(sidePlayerIds(input, "A"));
  const sideBCount = countPlayers(sidePlayerIds(input, "B"));

  // Team parent matchup projection often exposes team sides without athlete
  // participantIds (lineups live on submatches). Do not invent INVALID_ROSTER there.
  if (
    content.matchFormat === REFEREE_MATCH_FORMAT.TEAM_SUBMATCH &&
    sideACount === 0 &&
    sideBCount === 0
  ) {
    return Object.freeze({
      ok: true,
      code: ROSTER_VALIDATION_CODE.OK,
      message: null,
      matchFormat: content.matchFormat,
      expectedPlayersPerSide: expected,
      sideACount,
      sideBCount,
      offendingSides: Object.freeze([]),
      competitionContentCode: content.competitionContentCode,
      competitionContentLabel: content.competitionContentLabel,
      deferredToSubmatch: true,
    });
  }

  const offending = [];
  if (Number.isFinite(expected) && expected > 0) {
    if (sideACount !== expected) offending.push({ side: "A", count: sideACount, expected });
    if (sideBCount !== expected) offending.push({ side: "B", count: sideBCount, expected });
  }

  if (!offending.length) {
    return Object.freeze({
      ok: true,
      code: ROSTER_VALIDATION_CODE.OK,
      message: null,
      matchFormat: content.matchFormat,
      expectedPlayersPerSide: expected,
      sideACount,
      sideBCount,
      offendingSides: Object.freeze([]),
      competitionContentCode: content.competitionContentCode,
      competitionContentLabel: content.competitionContentLabel,
    });
  }

  const contentLabel =
    content.competitionContentLabel ||
    (expected === 2 ? "Đôi" : expected === 1 ? "Đơn" : "nội dung");
  const detail = offending
    .map((row) => `Side ${row.side}: ${row.count}/${row.expected}`)
    .join("; ");
  const message =
    expected === 2
      ? `Dữ liệu đội hình không hợp lệ: Nội dung ${contentLabel} yêu cầu 2 VĐV mỗi bên. (${detail})`
      : `Dữ liệu đội hình không hợp lệ: Nội dung ${contentLabel} yêu cầu ${expected} VĐV mỗi bên. (${detail})`;

  return Object.freeze({
    ok: false,
    code: ROSTER_VALIDATION_CODE.INVALID_ROSTER,
    message,
    matchFormat: content.matchFormat,
    expectedPlayersPerSide: expected,
    sideACount,
    sideBCount,
    offendingSides: Object.freeze(offending),
    competitionContentCode: content.competitionContentCode,
    competitionContentLabel: content.competitionContentLabel,
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
    eventType: content.competitionContentCode || input.eventType,
    type: input.type,
    matchType: input.matchType,
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
