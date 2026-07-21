/**
 * CORE-08 Phase 1B — Target D: Constraint grouping adapter.
 * Does not fake constraint repair parity.
 * Empty constraints → snake via Phase 3H.
 * Non-empty avoid_same_group (or any constraints) → typed failure HARDENING_REQUIRED.
 */

import { DRAW_MODE } from "../enums/drawModes.js";
import {
  DRAW_CERTIFICATION_ERROR_CODE,
  createDrawCertificationError,
} from "./certificationErrors.js";
import { runCertificationResolve } from "./runCertificationResolve.js";

export const CONSTRAINT_GROUPING_ADAPTER_ID = "CORE08_CONSTRAINT_GROUPING_CERT";

/**
 * @param {object} input
 * @param {Array} [input.constraints]
 * @param {boolean} [input.allowPostValidateOnly] reserved — still does not repair
 */
export async function runConstraintGroupingAdapter(
  input = {},
  resolverOptions = {}
) {
  const constraints = Array.isArray(input.constraints) ? input.constraints : [];
  const separation = constraints.filter(
    (c) =>
      c &&
      (c.type === "avoid_same_group" ||
        c.kind === "avoid_same_group" ||
        c.category === "separation")
  );

  if (constraints.length > 0) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_CONSTRAINTS_UNSUPPORTED,
      "Separation constraints cannot be represented by Phase 3H placement without constraintResolver hardening",
      {
        hardening: "HARDENING_REQUIRED",
        constraintCount: constraints.length,
        separationCount: separation.length,
        supportedToday:
          "Snake-only path when constraints:[]. Post-placement validation may be added later; repair remains format/CORE-01 owned.",
        phase3hNote:
          "DrawResolver accepts constraintResolver DI but does not invoke it.",
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

  return runCertificationResolve(
    {
      ...input,
      entries,
      legacyMode: "official_ai_balance",
      drawMode: DRAW_MODE.SNAKE_GROUPS,
      allowConditionalMode: true,
    },
    {
      target: "D_CONSTRAINT_GROUPING",
      parity: "PARTIAL_PARITY",
      resolverOptions,
      entriesById,
      namePrefix: input.namePrefix || "Bảng ",
      acceptedDifferences: [
        "Parity certified only for constraint-empty snake placement via Phase 3H.",
        "assignGroupsWithConstraints repair/swap loop is not executed.",
      ],
      unsupportedBehavior: [
        "avoid_same_group hard repair",
        "Constraint evaluation swap passes",
        "Private pairing overlay",
      ],
    }
  );
}
