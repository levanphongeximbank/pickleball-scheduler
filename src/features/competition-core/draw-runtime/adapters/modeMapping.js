/**
 * CORE-08 Phase 1B — legacy / CC-01 / CC-04 mode → Phase 3H DRAW_MODE mapping.
 * Does not rename either vocabulary. Fail closed on ambiguous/unsupported.
 */

import { DRAW_MODE } from "../enums/drawModes.js";
import {
  DRAW_CERTIFICATION_ERROR_CODE,
  createDrawCertificationError,
} from "./certificationErrors.js";

/** Mapping status values (Owner-locked for Phase 1B). */
export const MODE_MAPPING_STATUS = Object.freeze({
  EXACT: "EXACT",
  CONDITIONAL: "CONDITIONAL",
  FORMAT_SPECIFIC: "FORMAT_SPECIFIC",
  AMBIGUOUS: "AMBIGUOUS",
  UNSUPPORTED: "UNSUPPORTED",
});

/**
 * @typedef {Object} ModeMappingRow
 * @property {string} legacyMode
 * @property {string|null} phase3hMode
 * @property {string} status
 * @property {string} vocabulary
 * @property {string} conditions
 * @property {string|null} typedError
 */

/**
 * Contract-level inventory. Source of truth for certification adapters.
 * @type {ReadonlyArray<ModeMappingRow>}
 */
export const LEGACY_TO_PHASE3H_MODE_MATRIX = Object.freeze([
  {
    legacyMode: "skill_controlled",
    phase3hMode: DRAW_MODE.SNAKE_GROUPS,
    status: MODE_MAPPING_STATUS.EXACT,
    vocabulary: "legacy_seeding_logic",
    conditions:
      "Caller must supply immutable seedNumber ranking (highest skill = seed 1). Adapter must not recalculate seeds.",
    typedError: null,
  },
  {
    legacyMode: "snake",
    phase3hMode: DRAW_MODE.SNAKE_GROUPS,
    status: MODE_MAPPING_STATUS.EXACT,
    vocabulary: "legacy_runtime",
    conditions: "Pre-ranked candidates with seedNumber ascending = placement order.",
    typedError: null,
  },
  {
    legacyMode: "serpentine",
    phase3hMode: DRAW_MODE.SERPENTINE_GROUPS,
    status: MODE_MAPPING_STATUS.EXACT,
    vocabulary: "phase3h_alias",
    conditions: "Explicit serpentine request only.",
    typedError: null,
  },
  {
    legacyMode: "seeded",
    phase3hMode: DRAW_MODE.SEEDED_GROUPS,
    status: MODE_MAPPING_STATUS.CONDITIONAL,
    vocabulary: "cc04_canonical",
    conditions:
      "SEEDED_GROUPS is round-robin by seed, not snake. Use skill_controlled/snake when snake is required.",
    typedError: null,
  },
  {
    legacyMode: "open",
    phase3hMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    status: MODE_MAPPING_STATUS.CONDITIONAL,
    vocabulary: "legacy_seeding_logic",
    conditions:
      "Legacy open uses shuffle then index%groups (round-robin). Matches OPEN_RANDOM_GROUPS when deterministicSeed supplied. Does not include club/unit penalty search.",
    typedError: null,
  },
  {
    legacyMode: "random",
    phase3hMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    status: MODE_MAPPING_STATUS.CONDITIONAL,
    vocabulary: "legacy_runtime",
    conditions: "Requires deterministicSeed for certified determinism.",
    typedError: null,
  },
  {
    legacyMode: "pure_random",
    phase3hMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    status: MODE_MAPPING_STATUS.CONDITIONAL,
    vocabulary: "cc01_draw_mode",
    conditions: "Requires deterministicSeed for certified determinism.",
    typedError: null,
  },
  {
    legacyMode: "official_open",
    phase3hMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    status: MODE_MAPPING_STATUS.CONDITIONAL,
    vocabulary: "official_engine",
    conditions:
      "Structural open placement only. Club/unit/host/visitor penalty multi-attempt search remains FORMAT outside CORE-08.",
    typedError: null,
  },
  {
    legacyMode: "constrained_random",
    phase3hMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    status: MODE_MAPPING_STATUS.CONDITIONAL,
    vocabulary: "cc01_draw_mode",
    conditions:
      "Open placement without separation constraints. Constraints → ADAPTER_CONSTRAINTS_UNSUPPORTED.",
    typedError: null,
  },
  {
    legacyMode: "official_ai_balance",
    phase3hMode: DRAW_MODE.SNAKE_GROUPS,
    status: MODE_MAPPING_STATUS.CONDITIONAL,
    vocabulary: "official_engine",
    conditions:
      "Snake placement only when avoid_same_group constraints are empty. Non-empty constraints unsupported without hardening.",
    typedError: null,
  },
  {
    legacyMode: "manual",
    phase3hMode: DRAW_MODE.MANUAL_PLACEMENT,
    status: MODE_MAPPING_STATUS.EXACT,
    vocabulary: "cc01_draw_mode",
    conditions: "Requires manualPlacements on candidates / request.",
    typedError: null,
  },
  {
    legacyMode: "seeded_bracket",
    phase3hMode: DRAW_MODE.SEEDED_BRACKET,
    status: MODE_MAPPING_STATUS.EXACT,
    vocabulary: "phase3h_alias",
    conditions: "Bracket placement + first-class byes.",
    typedError: null,
  },
  {
    legacyMode: "open_random_bracket",
    phase3hMode: DRAW_MODE.OPEN_RANDOM_BRACKET,
    status: MODE_MAPPING_STATUS.EXACT,
    vocabulary: "phase3h_alias",
    conditions: "Requires deterministicSeed for certified determinism.",
    typedError: null,
  },
  {
    legacyMode: "team",
    phase3hMode: null,
    status: MODE_MAPPING_STATUS.FORMAT_SPECIFIC,
    vocabulary: "cc04_canonical",
    conditions:
      "Use team-tournament grouping adapter with explicit SNAKE_GROUPS or OPEN_RANDOM_GROUPS.",
    typedError: DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_FORMAT_SPECIFIC,
  },
  {
    legacyMode: "heuristic",
    phase3hMode: null,
    status: MODE_MAPPING_STATUS.UNSUPPORTED,
    vocabulary: "cc04_canonical",
    conditions: "AI heuristic drawEngine is not Phase 3H placement.",
    typedError: DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_UNSUPPORTED,
  },
  {
    legacyMode: "custom",
    phase3hMode: null,
    status: MODE_MAPPING_STATUS.AMBIGUOUS,
    vocabulary: "cc04_canonical",
    conditions: "No unambiguous Phase 3H mode.",
    typedError: DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_AMBIGUOUS,
  },
  {
    legacyMode: "unknown",
    phase3hMode: null,
    status: MODE_MAPPING_STATUS.UNSUPPORTED,
    vocabulary: "cc04_canonical",
    conditions: "Unknown legacy mode.",
    typedError: DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_UNSUPPORTED,
  },
  {
    legacyMode: "hybrid",
    phase3hMode: DRAW_MODE.HYBRID,
    status: MODE_MAPPING_STATUS.UNSUPPORTED,
    vocabulary: "phase3h",
    conditions: "HYBRID enum retained but not executable in Draw Runtime Core.",
    typedError: DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_UNSUPPORTED,
  },
  {
    legacyMode: "tt_open_shuffle_snake",
    phase3hMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
    status: MODE_MAPPING_STATUS.CONDITIONAL,
    vocabulary: "team_tournament",
    conditions:
      "TT OFF seeding uses shuffle-then-snake; Phase 3H OPEN_RANDOM uses shuffle-then-round-robin. Documented semantic difference.",
    typedError: null,
  },
  {
    legacyMode: "tt_avg_level_snake",
    phase3hMode: DRAW_MODE.SNAKE_GROUPS,
    status: MODE_MAPPING_STATUS.EXACT,
    vocabulary: "team_tournament",
    conditions: "Caller supplies seedNumber from format seeding (CORE-07 / format). Adapter does not compute ratings.",
    typedError: null,
  },
]);

/**
 * @param {unknown} legacyMode
 * @returns {ModeMappingRow|null}
 */
export function findModeMappingRow(legacyMode) {
  const key = String(legacyMode || "")
    .trim()
    .toLowerCase();
  if (!key) return null;
  return (
    LEGACY_TO_PHASE3H_MODE_MATRIX.find(
      (row) => String(row.legacyMode).toLowerCase() === key
    ) || null
  );
}

/**
 * Resolve legacy mode → Phase 3H mode. Fail closed for ambiguous/unsupported/format-specific
 * unless options.allowFormatSpecificTarget provides an explicit Phase 3H mode.
 *
 * @param {unknown} legacyMode
 * @param {{
 *   allowConditional?: boolean,
 *   explicitPhase3hMode?: string|null,
 * }} [options]
 */
export function mapLegacyModeToPhase3h(legacyMode, options = {}) {
  const allowConditional = options.allowConditional !== false;
  const explicit =
    typeof options.explicitPhase3hMode === "string" && options.explicitPhase3hMode
      ? options.explicitPhase3hMode
      : null;

  if (explicit) {
    if (!Object.values(DRAW_MODE).includes(explicit)) {
      return createDrawCertificationError(
        DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_UNSUPPORTED,
        `Explicit Phase 3H mode is not recognized: ${explicit}`,
        { explicitPhase3hMode: explicit }
      );
    }
    if (explicit === DRAW_MODE.HYBRID) {
      return createDrawCertificationError(
        DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_UNSUPPORTED,
        "HYBRID is not executable in Draw Runtime Core",
        { phase3hMode: explicit }
      );
    }
    return {
      ok: true,
      legacyMode: String(legacyMode || ""),
      phase3hMode: explicit,
      status: MODE_MAPPING_STATUS.EXACT,
      conditions: "Caller supplied explicit Phase 3H mode",
      row: null,
    };
  }

  const row = findModeMappingRow(legacyMode);
  if (!row) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_UNSUPPORTED,
      `No mapping for legacy mode: ${String(legacyMode || "")}`,
      { legacyMode }
    );
  }

  if (
    row.status === MODE_MAPPING_STATUS.UNSUPPORTED ||
    row.status === MODE_MAPPING_STATUS.AMBIGUOUS ||
    row.status === MODE_MAPPING_STATUS.FORMAT_SPECIFIC
  ) {
    return createDrawCertificationError(
      row.typedError || DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_UNSUPPORTED,
      `Legacy mode '${row.legacyMode}' mapping status is ${row.status}`,
      {
        legacyMode: row.legacyMode,
        status: row.status,
        conditions: row.conditions,
      }
    );
  }

  if (row.status === MODE_MAPPING_STATUS.CONDITIONAL && !allowConditional) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_AMBIGUOUS,
      `Conditional mapping for '${row.legacyMode}' is not allowed without allowConditional`,
      { legacyMode: row.legacyMode, conditions: row.conditions }
    );
  }

  return {
    ok: true,
    legacyMode: row.legacyMode,
    phase3hMode: row.phase3hMode,
    status: row.status,
    conditions: row.conditions,
    row,
  };
}
