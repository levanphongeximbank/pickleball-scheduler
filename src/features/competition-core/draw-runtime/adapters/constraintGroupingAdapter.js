/**
 * CORE-08 Phase 1B/1C — Target D: Constraint grouping adapter.
 * Does not fake constraint repair parity.
 * Empty constraints → snake via Phase 3H.
 * Non-empty constraints without injected constraintResolver → fail closed.
 * Non-empty constraints with injected generic resolver → Phase 3H + hook.
 * Adapter never implements repair and never imports the legacy constraint engine.
 */

import { DRAW_MODE } from "../enums/drawModes.js";
import { matchesConstraintResolver } from "../ports/constraintResolverPort.js";
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
 * @param {object} [resolverOptions]
 * @param {unknown} [resolverOptions.constraintResolver]
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

  const hasResolver = matchesConstraintResolver(
    resolverOptions && resolverOptions.constraintResolver
  );

  if (constraints.length > 0 && !hasResolver) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_CONSTRAINTS_UNSUPPORTED,
      "Separation constraints cannot be represented by Phase 3H placement without an injected constraintResolver",
      {
        hardening: "HARDENING_REQUIRED",
        constraintCount: constraints.length,
        separationCount: separation.length,
        supportedToday:
          "Snake-only path when constraints:[]. Non-empty constraints require injected generic constraintResolver (Phase 1C).",
        phase3hNote:
          "DrawResolver invokes constraintResolver once after canonical placement when supplied.",
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

  const acceptedDifferences = [
    "Parity certified for constraint-empty snake placement via Phase 3H.",
    "assignGroupsWithConstraints repair/swap loop is not executed by this adapter.",
  ];
  const unsupportedBehavior = [
    "avoid_same_group hard repair inside CORE-08",
    "Constraint evaluation swap passes inside CORE-08",
    "Private pairing overlay",
  ];

  if (constraints.length > 0 && hasResolver) {
    acceptedDifferences.push(
      "Non-empty constraints delegated to injected generic constraintResolver after Phase 3H placement."
    );
    unsupportedBehavior.push(
      "Format-specific club/unit/host rule definitions remain outside CORE-08"
    );
  }

  return runCertificationResolve(
    {
      ...input,
      entries,
      legacyMode: "official_ai_balance",
      drawMode: DRAW_MODE.SNAKE_GROUPS,
      allowConditionalMode: true,
      context: {
        ...(input.context && typeof input.context === "object"
          ? input.context
          : {}),
        constraints,
        separationCount: separation.length,
      },
    },
    {
      target: "D_CONSTRAINT_GROUPING",
      parity:
        constraints.length > 0
          ? "PARTIAL_PARITY_WITH_INJECTED_RESOLVER"
          : "PARTIAL_PARITY",
      resolverOptions,
      entriesById,
      namePrefix: input.namePrefix || "Bảng ",
      acceptedDifferences,
      unsupportedBehavior,
    }
  );
}
