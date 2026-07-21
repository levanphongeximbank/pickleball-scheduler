/**
 * CORE-08 Phase 1B — Target B: Open Conditional Draw adapter.
 * Structural open placement via OPEN_RANDOM_GROUPS only.
 * Club/unit/host/visitor multi-attempt penalty search is NOT claimed as parity.
 */

import { DRAW_MODE } from "../enums/drawModes.js";
import {
  DRAW_CERTIFICATION_ERROR_CODE,
  createDrawCertificationError,
} from "./certificationErrors.js";
import { runCertificationResolve } from "./runCertificationResolve.js";

export const OPEN_CONDITIONAL_ADAPTER_ID = "CORE08_OPEN_CONDITIONAL_CERT";

/**
 * @param {object} input
 * @param {boolean} [input.requireNoFormatConditions] when true (default), reject if
 *   format condition flags are set (hostClubName, splitUnits search, attempts>1, etc.)
 */
export async function runOpenConditionalAdapter(input = {}, resolverOptions = {}) {
  const requireNoFormatConditions = input.requireNoFormatConditions !== false;

  const hasFormatConditions =
    Boolean(input.hostClubName) ||
    input.splitUnits === true ||
    input.enableClubSeparation === true ||
    input.enableUnitSeparation === true ||
    (Number(input.attempts) > 1) ||
    (Array.isArray(input.constraints) && input.constraints.length > 0) ||
    input.legacyAlgorithm === "assignEntriesOpenConditional";

  if (requireNoFormatConditions && hasFormatConditions) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_CONDITIONS_UNSUPPORTED,
      "Open conditional club/unit/host/visitor penalty search is outside CORE-08 Phase 3H",
      {
        hardening: "HARDENING_REQUIRED_OR_FORMAT_OWNED",
        hint:
          "Call with requireNoFormatConditions:false and legacyMode 'open' for structural OPEN_RANDOM_GROUPS only",
      }
    );
  }

  const entries = Array.isArray(input.entries) ? input.entries : [];
  const entriesById = new Map();
  for (const entry of entries) {
    if (entry && typeof entry === "object" && entry.id != null) {
      entriesById.set(String(entry.id), entry);
    }
  }

  if (input.deterministicSeed == null && input.seed == null) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_INVALID_INPUT,
      "deterministicSeed is required for certified open draw determinism",
      {}
    );
  }

  return runCertificationResolve(
    {
      ...input,
      entries,
      legacyMode: input.legacyMode || "open",
      drawMode: input.drawMode || DRAW_MODE.OPEN_RANDOM_GROUPS,
      allowConditionalMode: true,
      forbidImpliedSeeds: false,
    },
    {
      target: "B_OPEN_CONDITIONAL_DRAW",
      parity: hasFormatConditions
        ? "PARTIAL_PARITY"
        : "SEMANTIC_PARITY_WITH_DOCUMENTED_DIFFERENCES",
      resolverOptions,
      entriesById,
      namePrefix: input.namePrefix || "Bang ",
      acceptedDifferences: [
        "Certified path is Phase 3H OPEN_RANDOM_GROUPS (deterministic shuffle + round-robin).",
        "Legacy assignEntriesOpenConditional multi-attempt penalty minimizer is format-owned and not executed.",
        "Legacy group ids used wall-clock stamps; adapter uses identity keys.",
      ],
      unsupportedBehavior: [
        "Club/unit/host/visitor separation penalties",
        "Multi-attempt score search (attempts)",
        "analyzeOpenDrawWarnings production copy",
      ],
    }
  );
}
