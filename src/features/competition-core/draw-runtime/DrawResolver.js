/**
 * Phase 3H — DrawResolver
 *
 * resolve → map/merge candidates+seeds → validate → place (groups/bracket/byes)
 * → identity lookup → optional stub persistence
 *
 * Owns placement only.
 * Does not create matchups / matches / fixtures / schedules / scores / standings.
 * Does not call Seeding Runtime by default.
 * Legacy remains Production primary. No Production wiring.
 * No Math.random in Core.
 */

import { createDrawResolveRequest } from "./contracts/drawRequest.js";
import { drawResolveOk, drawResolveFail } from "./contracts/drawResult.js";
import { createDrawSnapshot } from "./contracts/drawGroup.js";
import { isDrawAdapter } from "./contracts/adapterContract.js";
import { isDrawPolicy } from "./contracts/drawPolicy.js";
import {
  createDrawIdentity,
  buildDrawIdentityKey,
} from "./contracts/drawIdentity.js";
import { createLegacyDrawAdapter } from "./adapters/LegacyDrawAdapter.js";
import { DRAW_RUNTIME_ERROR_CODE } from "./errors/runtimeErrorCodes.js";
import { isDrawRuntimeError } from "./errors/DrawRuntimeError.js";
import {
  createDrawIdentityLookup,
  requireDrawIdentity,
} from "./services/drawIdentityLookup.js";
import { mergeCandidatesAndSeeds } from "./services/validateCandidates.js";
import {
  validateCandidates,
  validateGroupParams,
  validateBracketParams,
  validateManualAndProtected,
} from "./services/validateParams.js";
import {
  applyPlacementOverlays,
  assignSnakeGroups,
  assignSerpentineGroups,
  assignSeededGroups,
  assignPotGroups,
  assignOpenRandomGroups,
  assignOpenShuffledSnakeGroups,
  assignManualGroupsOnly,
} from "./services/assignGroups.js";
import { assignBracketSlots } from "./services/assignBracket.js";
import {
  buildGroups,
  attachPlacementsToGroups,
} from "./services/buildGroups.js";
import { createDeterministicRandomFromSeed } from "./services/deterministicRandom.js";
import {
  matchesDrawPersistencePort,
  createNoopDrawPersistencePort,
} from "./ports/drawPersistencePort.js";
import {
  matchesConstraintResolver,
  normalizeConstraintResolver,
} from "./ports/constraintResolverPort.js";
import { applyConstraintResolverHook } from "./services/applyConstraintResolverHook.js";
import { createNoopDrawPolicy } from "./policies/noopDrawPolicy.js";
import { DRAW_MODE, BRACKET_DRAW_MODES } from "./enums/drawModes.js";
import { LAYOUT_TYPE } from "./enums/layoutTypes.js";
import { isNonEmptyString } from "../participants/contracts/shared.js";

/**
 * @typedef {Object} DrawResolverOptions
 * @property {import('./contracts/adapterContract.js').DrawAdapter[]} [adapters]
 * @property {ReturnType<typeof createDrawIdentityLookup>} [identityLookup]
 * @property {import('./ports/drawPersistencePort.js').DrawPersistencePort} [persistence]
 * @property {boolean} [enablePersistence]
 * @property {import('./contracts/drawPolicy.js').DrawPolicy} [drawPolicy]
 * @property {Function} [seedingResolver]
 * @property {Function} [participantResolver]
 * @property {Function} [entryResolver]
 * @property {Function} [teamResolver]
 * @property {import('./ports/constraintResolverPort.js').ConstraintResolverFn|import('./ports/constraintResolverPort.js').ConstraintResolverPort} [constraintResolver]
 * @property {(seed: unknown) => () => number} [deterministicRandom]
 * @property {() => string|Date} [clock]
 */

/**
 * @param {import('./contracts/adapterContract.js').DrawAdapter[]} adapters
 * @param {unknown} source
 * @param {Record<string, unknown>} context
 */
function selectAdapter(adapters, source, context) {
  for (const adapter of adapters) {
    if (adapter.supports(source, context)) return adapter;
  }
  return null;
}

/**
 * @param {unknown} err
 * @returns {{ code: string, message: string, details: Record<string, unknown> }}
 */
function mapDependencyError(err) {
  if (isDrawRuntimeError(err)) {
    return { code: err.code, message: err.message, details: err.details || {} };
  }
  return {
    code: DRAW_RUNTIME_ERROR_CODE.DRAW_DEPENDENCY_FAILED,
    message: err instanceof Error ? err.message : "Dependency failed",
    details: {},
  };
}

/**
 * @param {DrawResolverOptions} [options]
 */
export function createDrawResolver(options = {}) {
  const adapters =
    Array.isArray(options.adapters) && options.adapters.length
      ? options.adapters.filter(isDrawAdapter)
      : [createLegacyDrawAdapter()];

  if (adapters.length === 0) {
    throw new TypeError("createDrawResolver requires at least one DrawAdapter");
  }

  // seedingResolver is accepted for DI shape but NEVER called by default.
  const seedingResolver =
    typeof options.seedingResolver === "function"
      ? options.seedingResolver
      : null;
  void seedingResolver;

  // constraintResolver is optional. When absent, Phase 3H placement is unchanged.
  // When present, it runs once after canonical placement and before identity/persist.
  let constraintResolver = null;
  if (options.constraintResolver != null) {
    if (!matchesConstraintResolver(options.constraintResolver)) {
      throw new TypeError(
        "createDrawResolver constraintResolver must be a function or { resolveConstraints }"
      );
    }
    constraintResolver = normalizeConstraintResolver(options.constraintResolver);
  }

  const identityLookup =
    options.identityLookup || createDrawIdentityLookup();
  const enablePersistence = options.enablePersistence === true;
  const persistence =
    options.persistence && matchesDrawPersistencePort(options.persistence)
      ? options.persistence
      : createNoopDrawPersistencePort();

  const drawPolicy = isDrawPolicy(options.drawPolicy)
    ? options.drawPolicy
    : createNoopDrawPolicy();

  const deterministicRandomFactory =
    typeof options.deterministicRandom === "function"
      ? options.deterministicRandom
      : createDeterministicRandomFromSeed;

  const clock =
    typeof options.clock === "function"
      ? options.clock
      : () => "1970-01-01T00:00:00.000Z";

  /**
   * @param {Partial<import('./contracts/drawRequest.js').DrawResolveRequest>} rawRequest
   */
  async function resolve(rawRequest = {}) {
    const request = createDrawResolveRequest(rawRequest);
    /** @type {Record<string, unknown>} */
    const diagnostics = {
      persistenceEnabled: enablePersistence,
      usedMathRandom: false,
      seedingResolverCalled: false,
      constraintResolverInvoked: false,
      constraintResolverCallCount: 0,
      matchupImplemented: false,
      matchCreated: false,
      scheduleCreated: false,
      scoreCalculated: false,
      standingsCalculated: false,
    };

    try {
      if (!isNonEmptyString(request.competitionId)) {
        return drawResolveFail(
          DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
          "competitionId is required",
          {},
          diagnostics
        );
      }
      if (!isNonEmptyString(request.contextId)) {
        return drawResolveFail(
          DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
          "contextId is required",
          { competitionId: request.competitionId },
          diagnostics
        );
      }

      const identity = createDrawIdentity({
        competitionId: request.competitionId,
        contextId: request.contextId,
      });
      const drawIdentityKey = identity.key;

      const mapContext = {
        ...request.context,
        competitionId: request.competitionId,
        contextId: request.contextId,
        drawIdentityKey,
        formatType: request.formatType,
      };

      /** @type {import('./contracts/drawCandidate.js').DrawCandidate[]} */
      let candidates = [];
      /** @type {string|null} */
      let adapterId = null;

      const hasCandidates =
        Array.isArray(request.candidates) && request.candidates.length > 0;
      const hasSeeds =
        Array.isArray(request.seedAssignments) &&
        request.seedAssignments.length > 0;

      if (hasCandidates || hasSeeds) {
        candidates = mergeCandidatesAndSeeds({
          candidates: request.candidates,
          seedAssignments: request.seedAssignments,
          competitionId: request.competitionId,
          contextId: request.contextId,
          drawIdentityKey,
        });
      } else if (request.source != null) {
        const adapter = selectAdapter(adapters, request.source, mapContext);
        if (!adapter) {
          return drawResolveFail(
            DRAW_RUNTIME_ERROR_CODE.DRAW_UNSUPPORTED_SOURCE,
            "No draw adapter supports this source",
            {},
            diagnostics
          );
        }
        try {
          candidates = adapter.map(request.source, mapContext);
        } catch (err) {
          if (isDrawRuntimeError(err)) {
            return drawResolveFail(
              err.code,
              err.message,
              err.details,
              diagnostics
            );
          }
          return drawResolveFail(
            DRAW_RUNTIME_ERROR_CODE.DRAW_ADAPTER_FAILED,
            err instanceof Error ? err.message : "Adapter failed",
            { adapterId: adapter.id },
            diagnostics
          );
        }
        adapterId = adapter.id;
      } else {
        return drawResolveFail(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_REQUIRED,
          "candidates[], seedAssignments[], or source is required",
          {},
          diagnostics
        );
      }

      candidates = applyPlacementOverlays(
        candidates,
        request.manualPlacements,
        request.protectedPlacements
      );

      validateCandidates(candidates);

      const policyResult = drawPolicy.validateCandidates(candidates, mapContext);
      if (!policyResult.ok) {
        return drawResolveFail(
          DRAW_RUNTIME_ERROR_CODE.DRAW_POLICY_REJECTED,
          "Draw policy rejected candidates",
          { reasons: policyResult.reasons, details: policyResult.details },
          diagnostics
        );
      }

      /** @type {import('./contracts/drawCandidate.js').DrawCandidate[]} */
      const excludedCandidates = [];
      /** @type {import('./contracts/drawCandidate.js').DrawCandidate[]} */
      const eligible = [];
      for (const candidate of candidates) {
        if (!drawPolicy.isEligible(candidate, mapContext)) {
          excludedCandidates.push(candidate);
        } else {
          eligible.push(candidate);
        }
      }

      if (eligible.length === 0 && request.drawMode !== DRAW_MODE.NOOP) {
        return drawResolveFail(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_REQUIRED,
          "No eligible candidates after policy filter",
          { excludedCount: excludedCandidates.length },
          diagnostics
        );
      }

      /** @type {(() => number)|null} */
      let randomFn = null;
      if (
        request.deterministicSeed !== undefined &&
        request.deterministicSeed !== null
      ) {
        randomFn = deterministicRandomFactory(request.deterministicSeed);
        if (typeof randomFn !== "function") {
          return drawResolveFail(
            DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
            "deterministicRandom must return a function",
            {},
            diagnostics
          );
        }
        diagnostics.deterministicRngReady = true;
        diagnostics.rngSample = randomFn();
        // Rebuild RNG so placement shuffle starts fresh (sample consumed one value)
        randomFn = deterministicRandomFactory(request.deterministicSeed);
      } else {
        diagnostics.deterministicRngReady = false;
        diagnostics.defaultOrdering = "identity";
      }

      const placeOptions = {
        drawIdentityKey,
        competitionId: request.competitionId,
        contextId: request.contextId,
        groupCount: request.groupCount,
        groupCapacity: request.groupCapacity,
        deterministicSeed: request.deterministicSeed,
        randomFn,
      };

      /** @type {import('./contracts/drawPlacement.js').DrawPlacement[]} */
      let placements = [];
      /** @type {import('./contracts/drawGroup.js').DrawGroup[]} */
      let groups = [];
      /** @type {import('./contracts/drawGroup.js').DrawBracket[]} */
      let brackets = [];
      /** @type {import('./contracts/drawGroup.js').DrawBye[]} */
      let byes = [];
      /** @type {import('./contracts/drawCandidate.js').DrawCandidate[]} */
      let unresolvedCandidates = [];
      /** @type {string[]} */
      let decisionTrace = [];

      const mode = request.drawMode;
      const isBracketMode =
        BRACKET_DRAW_MODES.includes(mode) ||
        request.layoutType === LAYOUT_TYPE.BRACKET;

      if (mode === DRAW_MODE.NOOP) {
        decisionTrace = ["NOOP"];
      } else if (isBracketMode) {
        const allowNonPowerOfTwo =
          request.allowNonPowerOfTwo === true ||
          (typeof drawPolicy.allowNonPowerOfTwo === "function" &&
            drawPolicy.allowNonPowerOfTwo(mapContext) === true);

        let bracketSize = request.bracketSize;
        if (bracketSize == null) {
          // next power of two >= eligible.length
          let size = 2;
          while (size < eligible.length) size *= 2;
          if (eligible.length <= 1) size = 2;
          bracketSize = size;
        }

        validateBracketParams(bracketSize, eligible.length, {
          allowNonPowerOfTwo,
        });
        validateManualAndProtected(eligible, "bracket", { bracketSize });

        const result = assignBracketSlots(eligible, {
          ...placeOptions,
          bracketSize,
          allowNonPowerOfTwo,
          open: mode === DRAW_MODE.OPEN_RANDOM_BRACKET,
        });
        placements = result.placements;
        byes = result.byes;
        brackets = result.brackets;
        decisionTrace = result.decisionTrace;
      } else if (mode === DRAW_MODE.MANUAL_PLACEMENT) {
        if (request.groupCount == null) {
          return drawResolveFail(
            DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_COUNT_INVALID,
            "groupCount required for MANUAL_PLACEMENT",
            {},
            diagnostics
          );
        }
        validateGroupParams(
          request.groupCount,
          eligible.length,
          request.groupCapacity
        );
        validateManualAndProtected(eligible, "group", {
          groupCount: request.groupCount,
        });
        const result = assignManualGroupsOnly(eligible, {
          ...placeOptions,
          groupCount: request.groupCount,
        });
        placements = result.placements;
        decisionTrace = result.decisionTrace;
        unresolvedCandidates = result.unresolved || [];
        groups = attachPlacementsToGroups(
          buildGroups({
            drawIdentityKey,
            competitionId: request.competitionId,
            contextId: request.contextId,
            groupCount: request.groupCount,
            groupCapacity: request.groupCapacity,
          }),
          placements
        );
      } else {
        // Group modes (HYBRID is Integrator-owned — not executed here)
        if (request.groupCount == null) {
          return drawResolveFail(
            DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_COUNT_INVALID,
            "groupCount is required for group draw modes",
            { drawMode: mode },
            diagnostics
          );
        }
        validateGroupParams(
          request.groupCount,
          eligible.length,
          request.groupCapacity
        );
        validateManualAndProtected(eligible, "group", {
          groupCount: request.groupCount,
        });

        const groupOpts = {
          ...placeOptions,
          groupCount: request.groupCount,
        };

        let result;
        switch (mode) {
          case DRAW_MODE.SNAKE_GROUPS:
            result = assignSnakeGroups(eligible, groupOpts);
            break;
          case DRAW_MODE.SERPENTINE_GROUPS:
            result = assignSerpentineGroups(eligible, groupOpts);
            break;
          case DRAW_MODE.SEEDED_GROUPS:
            result = assignSeededGroups(eligible, groupOpts);
            break;
          case DRAW_MODE.POT_GROUPS:
            result = assignPotGroups(eligible, groupOpts);
            break;
          case DRAW_MODE.OPEN_RANDOM_GROUPS:
            result = assignOpenRandomGroups(eligible, groupOpts);
            break;
          case DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS:
            result = assignOpenShuffledSnakeGroups(eligible, groupOpts);
            break;
          case DRAW_MODE.HYBRID:
            // HYBRID remains in the enum for Integrator-owned composition.
            // Capability Core does not execute HYBRID.
            return drawResolveFail(
              DRAW_RUNTIME_ERROR_CODE.DRAW_UNSUPPORTED_MODE,
              "HYBRID draw mode is Integrator-owned and not executable in Draw Runtime Core",
              { drawMode: mode },
              diagnostics
            );
          default:
            return drawResolveFail(
              DRAW_RUNTIME_ERROR_CODE.DRAW_UNSUPPORTED_MODE,
              `Unsupported draw mode: ${mode}`,
              { drawMode: mode },
              diagnostics
            );
        }
        placements = result.placements;
        decisionTrace = result.decisionTrace;
        groups = attachPlacementsToGroups(
          buildGroups({
            drawIdentityKey,
            competitionId: request.competitionId,
            contextId: request.contextId,
            groupCount: request.groupCount,
            groupCapacity: request.groupCapacity,
          }),
          placements
        );
      }

      // Phase 1C: optional generic constraint hook AFTER canonical Phase 3H placement.
      // Fail-closed. Never silently fall back to unconstrained placement on failure.
      if (constraintResolver) {
        const constrained = await applyConstraintResolverHook({
          constraintResolver,
          placements,
          groups,
          brackets,
          byes,
          unresolvedCandidates,
          eligible,
          decisionTrace,
          request,
          drawIdentityKey,
          diagnostics,
        });
        placements = constrained.placements;
        groups = constrained.groups;
        brackets = constrained.brackets;
        byes = constrained.byes;
        unresolvedCandidates = constrained.unresolvedCandidates;
        decisionTrace = constrained.decisionTrace;
      }

      requireDrawIdentity({
        competitionId: request.competitionId,
        contextId: request.contextId,
        identityKey: drawIdentityKey,
      });

      identityLookup.register({
        competitionId: request.competitionId,
        contextId: request.contextId,
        identityKey: drawIdentityKey,
        placementCount: placements.length,
      });

      const snapshot = createDrawSnapshot({
        id: drawIdentityKey,
        identityKey: drawIdentityKey,
        competitionId: request.competitionId,
        contextId: request.contextId,
        placements,
        groups,
        brackets,
        byes,
        recordedAt: String(clock()),
      });

      if (enablePersistence) {
        try {
          if (typeof persistence.saveSnapshot === "function") {
            await persistence.saveSnapshot(snapshot);
          } else {
            await persistence.save(snapshot);
          }
          diagnostics.persisted = true;
        } catch (err) {
          return drawResolveFail(
            DRAW_RUNTIME_ERROR_CODE.DRAW_PERSISTENCE_DISABLED,
            err instanceof Error ? err.message : "Persistence failed",
            {},
            diagnostics
          );
        }
      } else {
        diagnostics.persisted = false;
      }

      diagnostics.decisionTrace = decisionTrace;
      diagnostics.placementCount = placements.length;
      diagnostics.groupCount = groups.length;
      diagnostics.bracketCount = brackets.length;
      diagnostics.byeCount = byes.length;
      diagnostics.excludedCount = excludedCandidates.length;
      diagnostics.unresolvedCount = unresolvedCandidates.length;
      diagnostics.identityKey = drawIdentityKey;
      diagnostics.expectedIdentityKey = buildDrawIdentityKey({
        competitionId: request.competitionId,
        contextId: request.contextId,
      });
      diagnostics.drawMode = mode;

      return drawResolveOk({
        placements,
        groups,
        brackets,
        byes,
        candidates: eligible,
        unresolvedCandidates,
        excludedCandidates,
        identity,
        adapterId,
        drawMode: mode,
        warnings: [],
        decisionTrace,
        diagnostics,
        snapshot: enablePersistence ? snapshot : null,
      });
    } catch (err) {
      if (isDrawRuntimeError(err)) {
        return drawResolveFail(err.code, err.message, err.details, diagnostics);
      }
      const mapped = mapDependencyError(err);
      return drawResolveFail(
        mapped.code,
        mapped.message,
        mapped.details,
        diagnostics
      );
    }
  }

  return {
    resolve,
    place: resolve,
    adapters,
    identityLookup,
    enablePersistence,
    drawPolicy,
  };
}

export const DrawResolver = {
  create: createDrawResolver,
};
