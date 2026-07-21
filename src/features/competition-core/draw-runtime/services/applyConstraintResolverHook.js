/**
 * CORE-08 Phase 1C — invoke generic constraint resolver once and revalidate.
 */

import { createDrawPlacement } from "../contracts/drawPlacement.js";
import {
  attachPlacementsToGroups,
  buildGroups,
} from "./buildGroups.js";
import { validateConstraintResolutionOutput } from "./validateConstraintResolution.js";
import {
  DRAW_RUNTIME_ERROR_CODE,
  isDrawRuntimeErrorCode,
} from "../errors/runtimeErrorCodes.js";
import {
  DrawRuntimeError,
  isDrawRuntimeError,
} from "../errors/DrawRuntimeError.js";
import { LAYOUT_TYPE } from "../enums/layoutTypes.js";
import {
  freezeConstraintResolveInput,
  normalizeConstraintResolver,
} from "../ports/constraintResolverPort.js";

/**
 * @param {unknown} raw
 * @returns {import('../contracts/drawPlacement.js').DrawPlacement}
 */
function normalizeReturnedPlacement(raw) {
  if (!raw || typeof raw !== "object") {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
      "Constraint resolver placement must be an object",
      {}
    );
  }
  return createDrawPlacement(/** @type {Partial<import('../contracts/drawPlacement.js').DrawPlacement>} */ (raw));
}

/**
 * @param {{
 *   constraintResolver: unknown,
 *   placements: import('../contracts/drawPlacement.js').DrawPlacement[],
 *   groups: import('../contracts/drawGroup.js').DrawGroup[],
 *   brackets: import('../contracts/drawGroup.js').DrawBracket[],
 *   byes: import('../contracts/drawGroup.js').DrawBye[],
 *   unresolvedCandidates: import('../contracts/drawCandidate.js').DrawCandidate[],
 *   eligible: import('../contracts/drawCandidate.js').DrawCandidate[],
 *   decisionTrace: string[],
 *   request: import('../contracts/drawRequest.js').DrawResolveRequest,
 *   drawIdentityKey: string,
 *   diagnostics: Record<string, unknown>,
 * }} args
 */
export async function applyConstraintResolverHook(args) {
  const {
    constraintResolver,
    placements: proposalPlacements,
    groups: proposalGroups,
    brackets: proposalBrackets,
    byes: proposalByes,
    unresolvedCandidates: proposalUnresolved,
    eligible,
    decisionTrace: proposalTrace,
    request,
    drawIdentityKey,
    diagnostics,
  } = args;

  const invoke = normalizeConstraintResolver(constraintResolver);
  if (!invoke) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_RESOLVER_INVALID,
      "constraintResolver must be a function or port with resolveConstraints",
      {}
    );
  }

  const input = freezeConstraintResolveInput({
    placements: proposalPlacements,
    candidates: eligible,
    groups: proposalGroups,
    brackets: proposalBrackets,
    byes: proposalByes,
    unresolvedCandidates: proposalUnresolved,
    decisionTrace: proposalTrace,
    drawMode: request.drawMode,
    layoutType: request.layoutType,
    groupCount: request.groupCount,
    groupCapacity: request.groupCapacity,
    bracketSize: request.bracketSize,
    drawIdentityKey,
    competitionId: request.competitionId,
    contextId: request.contextId,
    deterministicSeed: request.deterministicSeed,
    context: request.context || {},
    metadata: request.metadata || {},
    manualPlacements: request.manualPlacements || [],
    protectedPlacements: request.protectedPlacements || [],
  });

  diagnostics.constraintResolverInvoked = true;
  diagnostics.constraintResolverCallCount =
    (Number(diagnostics.constraintResolverCallCount) || 0) + 1;

  /** @type {import('../ports/constraintResolverPort.js').ConstraintResolveResult} */
  let result;
  try {
    result = await invoke(input);
  } catch (err) {
    if (isDrawRuntimeError(err)) {
      throw err;
    }
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_RESOLUTION_FAILED,
      err instanceof Error ? err.message : "Constraint resolver threw",
      {
        name: err instanceof Error ? err.name : "unknown",
      }
    );
  }

  if (!result || typeof result !== "object") {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
      "Constraint resolver must return an object result",
      {}
    );
  }

  if (result.ok === false) {
    const code = isDrawRuntimeErrorCode(result.code)
      ? result.code
      : DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_RESOLUTION_FAILED;
    throw new DrawRuntimeError(
      code,
      typeof result.message === "string" && result.message
        ? result.message
        : "Constraint resolution failed",
      result.details && typeof result.details === "object"
        ? { ...result.details }
        : {}
    );
  }

  const constraintDiagnostics = Array.isArray(result.diagnostics)
    ? result.diagnostics.map((d) => String(d))
    : [];
  diagnostics.constraintDiagnostics = constraintDiagnostics;

  /** @type {string[]} */
  let nextTrace = [
    ...proposalTrace,
    "CONSTRAINT_RESOLVER",
  ];

  if (result.accepted === true) {
    nextTrace = [...nextTrace, "CONSTRAINT_ACCEPTED"];
    diagnostics.constraintOutcome = "ACCEPTED";
    return {
      placements: proposalPlacements,
      groups: proposalGroups,
      brackets: proposalBrackets,
      byes: proposalByes,
      unresolvedCandidates: proposalUnresolved,
      decisionTrace: nextTrace,
    };
  }

  if (!Array.isArray(result.placements)) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID,
      "Adjusted constraint result requires placements[] (or accepted:true)",
      {}
    );
  }

  const adjustedPlacements = result.placements.map(normalizeReturnedPlacement);
  const adjustedByes = Array.isArray(result.byes)
    ? result.byes.map((b) =>
        b && typeof b === "object" ? { ...b } : b
      )
    : proposalByes;
  const adjustedBrackets = Array.isArray(result.brackets)
    ? result.brackets.map((b) =>
        b && typeof b === "object" ? { ...b } : b
      )
    : proposalBrackets;
  const adjustedUnresolved = Array.isArray(result.unresolvedCandidates)
    ? result.unresolvedCandidates
    : proposalUnresolved;

  validateConstraintResolutionOutput(
    proposalPlacements,
    adjustedPlacements,
    eligible,
    {
      drawIdentityKey,
      groupCount: request.groupCount,
      groupCapacity: request.groupCapacity,
      bracketSize: request.bracketSize,
      layoutType: request.layoutType,
      byes: adjustedByes,
      proposalByes: proposalByes,
    }
  );

  let adjustedGroups = proposalGroups;
  if (
    request.layoutType === LAYOUT_TYPE.GROUPS ||
    (request.groupCount != null && request.groupCount > 0)
  ) {
    if (Array.isArray(result.groups) && result.groups.length > 0) {
      if (
        request.groupCount != null &&
        result.groups.length !== request.groupCount
      ) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION,
          "Constraint resolver changed canonical group count",
          {
            expected: request.groupCount,
            actual: result.groups.length,
          }
        );
      }
      adjustedGroups = result.groups.map((g) =>
        g && typeof g === "object" ? { ...g } : g
      );
    } else if (request.groupCount != null) {
      adjustedGroups = attachPlacementsToGroups(
        buildGroups({
          drawIdentityKey,
          competitionId: request.competitionId,
          contextId: request.contextId,
          groupCount: request.groupCount,
          groupCapacity: request.groupCapacity,
        }),
        adjustedPlacements
      );
    }
  }

  if (Array.isArray(result.decisionTrace) && result.decisionTrace.length > 0) {
    nextTrace = [
      ...nextTrace,
      "CONSTRAINT_ADJUSTED",
      ...result.decisionTrace.map((s) => String(s)),
    ];
  } else {
    nextTrace = [...nextTrace, "CONSTRAINT_ADJUSTED"];
  }

  diagnostics.constraintOutcome = "ADJUSTED";

  return {
    placements: adjustedPlacements,
    groups: adjustedGroups,
    brackets: adjustedBrackets,
    byes: adjustedByes,
    unresolvedCandidates: adjustedUnresolved,
    decisionTrace: nextTrace,
  };
}
