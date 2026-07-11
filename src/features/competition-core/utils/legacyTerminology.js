import { DRAW_MODE } from "../constants/drawMode.js";

/**
 * Reference-only mapping from legacy terminology to future DrawMode.
 * Does NOT mutate legacy values in CC-01.
 *
 * @typedef {Object} LegacyTerminologyEntry
 * @property {string} legacyValue
 * @property {string} context
 * @property {string} currentMeaning
 * @property {string|null} futureCanonicalValue
 * @property {string} migrationPhase
 */

/** @type {LegacyTerminologyEntry[]} */
export const LEGACY_OPEN_TERMINOLOGY = Object.freeze([
  {
    legacyValue: "open",
    context: "tournament.seeding.logic normalizeMode / seedMode UI",
    currentMeaning: "Pure random shuffle for team creation or group assignment",
    futureCanonicalValue: DRAW_MODE.PURE_RANDOM,
    migrationPhase: "CC-04",
  },
  {
    legacyValue: "official_open",
    context: "OFFICIAL_MODE.OPEN / buildOfficialOpenPlan",
    currentMeaning: "Open official tournament draw with club/unit separation heuristics",
    futureCanonicalValue: DRAW_MODE.CONSTRAINED_RANDOM,
    migrationPhase: "CC-04",
  },
  {
    legacyValue: "open_double",
    context: "EVENT_TYPE.OPEN_DOUBLE",
    currentMeaning: "Event type — mixed-gender-open doubles category",
    futureCanonicalValue: null,
    migrationPhase: "N/A (not DrawMode)",
  },
  {
    legacyValue: "open",
    context: "ai/competition.js DEFAULT_COMPETITION_TYPE",
    currentMeaning: "Court scheduling competition type without mixed-gender requirement",
    futureCanonicalValue: null,
    migrationPhase: "CC-06 (matchmaking format, not draw)",
  },
  {
    legacyValue: "open",
    context: "ClubManagement leagueCompetitionType",
    currentMeaning: "League competition classification in club UI",
    futureCanonicalValue: null,
    migrationPhase: "CC-08 (workflow config)",
  },
  {
    legacyValue: "open",
    context: "tournamentFlowAdapters animation variant",
    currentMeaning: "UI animation path for random draw visualization",
    futureCanonicalValue: null,
    migrationPhase: "CC-09 (UI only)",
  },
  {
    legacyValue: "open",
    context: "financeLedgerService debt status",
    currentMeaning: "Open finance ledger entry — unrelated to tournament draw",
    futureCanonicalValue: null,
    migrationPhase: "Out of scope",
  },
  {
    legacyValue: "skill_controlled",
    context: "tournament.seeding.logic / official AI balance",
    currentMeaning: "Snake seeding by skill with high-low team pairing",
    futureCanonicalValue: DRAW_MODE.SKILL_CONTROLLED,
    migrationPhase: "CC-04",
  },
]);

/**
 * @param {string} legacyValue
 * @param {string} context
 * @returns {LegacyTerminologyEntry|null}
 */
export function findLegacyTerminologyEntry(legacyValue, context) {
  return (
    LEGACY_OPEN_TERMINOLOGY.find(
      (entry) => entry.legacyValue === legacyValue && entry.context === context
    ) || null
  );
}

/**
 * Preview canonical DrawMode for a legacy seed/group mode string.
 * Returns null when no DrawMode mapping applies.
 *
 * @param {unknown} legacyMode
 * @param {'seeding'|'official'} [contextHint]
 * @returns {string|null}
 */
export function previewCanonicalDrawModeFromLegacy(legacyMode, contextHint = "seeding") {
  const value = String(legacyMode || "").trim().toLowerCase();

  if (value === "open" && contextHint === "seeding") {
    return DRAW_MODE.PURE_RANDOM;
  }

  if (value === "skill_controlled") {
    return DRAW_MODE.SKILL_CONTROLLED;
  }

  if (value === "official_open") {
    return DRAW_MODE.CONSTRAINED_RANDOM;
  }

  return null;
}
