/**
 * Phase 3G — SeedingResolver
 *
 * resolve → map candidates → normalize/validate → order → assign seeds
 * → identity lookup → optional stub persistence
 *
 * Owns candidate ordering and seed assignment only.
 * Does not own draw / snake / bracket / bye / matchup.
 * Ranking and rating are immutable external inputs (snapshots on candidates).
 * Legacy remains Production primary. No Production wiring.
 * No Math.random in Core.
 */

import { createSeedingResolveRequest } from "./contracts/seedingRequest.js";
import {
  seedingResolveOk,
  seedingResolveFail,
} from "./contracts/seedingResult.js";
import { isSeedingAdapter } from "./contracts/adapterContract.js";
import { isSeedingPolicy } from "./contracts/seedingPolicy.js";
import {
  createSeedingIdentity,
  buildSeedingIdentityKey,
} from "./contracts/seedingIdentity.js";
import { createLegacySeedingAdapter } from "./adapters/LegacySeedingAdapter.js";
import { SEEDING_RUNTIME_ERROR_CODE } from "./errors/runtimeErrorCodes.js";
import {
  isSeedingRuntimeError,
  SeedingRuntimeError,
} from "./errors/SeedingRuntimeError.js";
import {
  createSeedingIdentityLookup,
  requireSeedingIdentity,
} from "./services/seedingIdentityLookup.js";
import { normalizeCandidates } from "./services/normalizeCandidates.js";
import { validateCandidates } from "./services/validateCandidates.js";
import { assignSeeds } from "./services/assignSeeds.js";
import { createDeterministicRandomFromSeed } from "./services/deterministicRandom.js";
import {
  matchesSeedingPersistencePort,
  createNoopSeedingPersistencePort,
} from "./ports/seedingPersistencePort.js";
import { createNoopSeedingPolicy } from "./policies/noopSeedingPolicy.js";
import { isNonEmptyString } from "../participants/contracts/shared.js";

/**
 * @typedef {Object} SeedingResolverOptions
 * @property {import('./contracts/adapterContract.js').SeedingAdapter[]} [adapters]
 * @property {ReturnType<typeof createSeedingIdentityLookup>} [identityLookup]
 * @property {import('./ports/seedingPersistencePort.js').SeedingPersistencePort} [persistence]
 * @property {boolean} [enablePersistence]
 * @property {import('./contracts/seedingPolicy.js').SeedingPolicy} [seedingPolicy]
 * @property {Function} [rankingResolver]
 * @property {Function} [ratingResolver]
 * @property {Function} [registrationResolver]
 * @property {Function} [participantResolver]
 * @property {Function} [teamResolver]
 * @property {(seed: unknown) => () => number} [deterministicRandom]
 * @property {() => string|Date} [clock]
 */

/**
 * @param {import('./contracts/adapterContract.js').SeedingAdapter[]} adapters
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
  if (isSeedingRuntimeError(err)) {
    return { code: err.code, message: err.message, details: err.details || {} };
  }
  return {
    code: SEEDING_RUNTIME_ERROR_CODE.SEEDING_DEPENDENCY_FAILED,
    message: err instanceof Error ? err.message : "Dependency failed",
    details: {},
  };
}

/**
 * Enrich candidates with optional injected ranking/rating snapshots.
 * Values are treated as immutable inputs — Core never recalculates them.
 *
 * @param {import('./contracts/seedingCandidate.js').SeedingCandidate[]} candidates
 * @param {Record<string, unknown>} context
 * @param {SeedingResolverOptions} deps
 */
async function enrichExternalInputs(candidates, context, deps) {
  const out = [];
  for (const candidate of candidates) {
    let next = { ...candidate };
    try {
      if (
        typeof deps.rankingResolver === "function" &&
        next.rankingPosition == null
      ) {
        const ranking = await deps.rankingResolver(next, context);
        if (ranking && typeof ranking === "object") {
          if (ranking.position != null) next.rankingPosition = Number(ranking.position);
          if (ranking.reference != null) {
            next.rankingReference = String(ranking.reference);
          }
        } else if (ranking != null && Number.isFinite(Number(ranking))) {
          next.rankingPosition = Number(ranking);
        }
      }
      if (
        typeof deps.ratingResolver === "function" &&
        next.ratingValue == null
      ) {
        const rating = await deps.ratingResolver(next, context);
        if (rating && typeof rating === "object") {
          if (rating.value != null) next.ratingValue = Number(rating.value);
          if (rating.reference != null) {
            next.ratingReference = String(rating.reference);
          }
        } else if (rating != null && Number.isFinite(Number(rating))) {
          next.ratingValue = Number(rating);
        }
      }
    } catch (err) {
      if (isSeedingRuntimeError(err)) throw err;
      const mapped = mapDependencyError(err);
      throw new SeedingRuntimeError(mapped.code, mapped.message, mapped.details);
    }
    out.push(next);
  }
  return out;
}

/**
 * @param {SeedingResolverOptions} [options]
 */
export function createSeedingResolver(options = {}) {
  const adapters =
    Array.isArray(options.adapters) && options.adapters.length
      ? options.adapters.filter(isSeedingAdapter)
      : [createLegacySeedingAdapter()];

  if (adapters.length === 0) {
    throw new TypeError("createSeedingResolver requires at least one SeedingAdapter");
  }

  const identityLookup =
    options.identityLookup || createSeedingIdentityLookup();
  const enablePersistence = options.enablePersistence === true;
  const persistence =
    options.persistence && matchesSeedingPersistencePort(options.persistence)
      ? options.persistence
      : createNoopSeedingPersistencePort();

  const seedingPolicy = isSeedingPolicy(options.seedingPolicy)
    ? options.seedingPolicy
    : createNoopSeedingPolicy();

  const deterministicRandomFactory =
    typeof options.deterministicRandom === "function"
      ? options.deterministicRandom
      : createDeterministicRandomFromSeed;

  const clock =
    typeof options.clock === "function"
      ? options.clock
      : () => "1970-01-01T00:00:00.000Z";

  /**
   * @param {Partial<import('./contracts/seedingRequest.js').SeedingResolveRequest>} rawRequest
   */
  async function resolve(rawRequest = {}) {
    const request = createSeedingResolveRequest(rawRequest);
    /** @type {Record<string, unknown>} */
    const diagnostics = {
      persistenceEnabled: enablePersistence,
      usedMathRandom: false,
      drawImplemented: false,
      matchupImplemented: false,
      rankingCalculated: false,
      ratingCalculated: false,
    };

    try {
      if (!isNonEmptyString(request.competitionId)) {
        return seedingResolveFail(
          SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT,
          "competitionId is required",
          {},
          diagnostics
        );
      }
      if (!isNonEmptyString(request.contextId)) {
        return seedingResolveFail(
          SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT,
          "contextId is required",
          { competitionId: request.competitionId },
          diagnostics
        );
      }

      const identity = createSeedingIdentity({
        competitionId: request.competitionId,
        contextId: request.contextId,
      });
      const seedingIdentityKey = identity.key;

      const mapContext = {
        ...request.context,
        competitionId: request.competitionId,
        contextId: request.contextId,
        seedingIdentityKey,
        sourceType: request.sourceType,
        formatKey: request.formatKey,
      };

      /** @type {import('./contracts/seedingCandidate.js').SeedingCandidate[]} */
      let candidates = [];
      /** @type {string|null} */
      let adapterId = null;
      /** @type {string|null} */
      let sourceType = request.sourceType;

      if (Array.isArray(request.candidates) && request.candidates.length > 0) {
        candidates = normalizeCandidates(request.candidates, {
          competitionId: request.competitionId,
          contextId: request.contextId,
          seedingIdentityKey,
        });
        adapterId = null;
        sourceType = sourceType || "DIRECT";
      } else if (request.source != null) {
        const adapter = selectAdapter(adapters, request.source, mapContext);
        if (!adapter) {
          return seedingResolveFail(
            SEEDING_RUNTIME_ERROR_CODE.SEEDING_UNSUPPORTED_SOURCE,
            "No seeding adapter supports this source",
            {},
            diagnostics
          );
        }
        try {
          candidates = adapter.map(request.source, mapContext);
        } catch (err) {
          if (isSeedingRuntimeError(err)) {
            return seedingResolveFail(
              err.code,
              err.message,
              err.details,
              diagnostics
            );
          }
          return seedingResolveFail(
            SEEDING_RUNTIME_ERROR_CODE.SEEDING_ADAPTER_FAILED,
            err instanceof Error ? err.message : "Adapter failed",
            { adapterId: adapter.id },
            diagnostics
          );
        }
        adapterId = adapter.id;
        sourceType = adapter.sourceType;
      } else {
        return seedingResolveFail(
          SEEDING_RUNTIME_ERROR_CODE.SEEDING_CANDIDATE_REQUIRED,
          "candidates[] or source is required",
          {},
          diagnostics
        );
      }

      candidates = await enrichExternalInputs(candidates, mapContext, options);

      validateCandidates(candidates);

      const policyResult = seedingPolicy.validateCandidates(candidates, mapContext);
      if (!policyResult.ok) {
        return seedingResolveFail(
          SEEDING_RUNTIME_ERROR_CODE.SEEDING_POLICY_REJECTED,
          "Seeding policy rejected candidates",
          { reasons: policyResult.reasons, details: policyResult.details },
          diagnostics
        );
      }

      /** @type {import('./contracts/seedingCandidate.js').SeedingCandidate[]} */
      const excludedCandidates = [];
      /** @type {import('./contracts/seedingCandidate.js').SeedingCandidate[]} */
      const eligible = [];
      for (const candidate of candidates) {
        if (!seedingPolicy.isEligible(candidate, mapContext)) {
          excludedCandidates.push(candidate);
        } else {
          eligible.push(candidate);
        }
      }

      if (eligible.length === 0) {
        return seedingResolveFail(
          SEEDING_RUNTIME_ERROR_CODE.SEEDING_CANDIDATE_REQUIRED,
          "No eligible candidates after policy filter",
          { excludedCount: excludedCandidates.length },
          diagnostics
        );
      }

      // Touch deterministic RNG factory when seed present (repeatability / injection surface)
      if (
        request.deterministicSeed !== undefined &&
        request.deterministicSeed !== null
      ) {
        const rng = deterministicRandomFactory(request.deterministicSeed);
        if (typeof rng !== "function") {
          return seedingResolveFail(
            SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT,
            "deterministicRandom must return a function",
            {},
            diagnostics
          );
        }
        diagnostics.deterministicRngReady = true;
        diagnostics.rngSample = rng();
      } else {
        diagnostics.deterministicRngReady = false;
        diagnostics.defaultOrdering = "identity";
      }

      const policyCompare =
        typeof seedingPolicy.compareCandidates === "function"
          ? (a, b) => seedingPolicy.compareCandidates(a, b, mapContext)
          : null;

      const { assignments, decisionTrace } = assignSeeds(eligible, {
        seedingIdentityKey,
        competitionId: request.competitionId,
        contextId: request.contextId,
        deterministicSeed: request.deterministicSeed,
        policyCompare,
      });

      requireSeedingIdentity({
        competitionId: request.competitionId,
        contextId: request.contextId,
        identityKey: seedingIdentityKey,
      });

      identityLookup.register({
        competitionId: request.competitionId,
        contextId: request.contextId,
        identityKey: seedingIdentityKey,
        assignmentCount: assignments.length,
      });

      const snapshot = {
        id: seedingIdentityKey,
        identityKey: seedingIdentityKey,
        competitionId: request.competitionId,
        contextId: request.contextId,
        assignments,
        excludedCandidates,
        recordedAt: String(clock()),
      };

      if (enablePersistence) {
        try {
          if (typeof persistence.saveSnapshot === "function") {
            await persistence.saveSnapshot(snapshot);
          } else {
            await persistence.save(snapshot);
          }
          diagnostics.persisted = true;
        } catch (err) {
          return seedingResolveFail(
            SEEDING_RUNTIME_ERROR_CODE.SEEDING_PERSISTENCE_DISABLED,
            err instanceof Error ? err.message : "Persistence failed",
            {},
            diagnostics
          );
        }
      } else {
        diagnostics.persisted = false;
      }

      diagnostics.decisionTrace = decisionTrace;
      diagnostics.assignmentCount = assignments.length;
      diagnostics.excludedCount = excludedCandidates.length;
      diagnostics.identityKey = seedingIdentityKey;
      diagnostics.expectedIdentityKey = buildSeedingIdentityKey({
        competitionId: request.competitionId,
        contextId: request.contextId,
      });

      return seedingResolveOk({
        assignments,
        candidates: eligible,
        unresolvedCandidates: [],
        excludedCandidates,
        identity,
        adapterId,
        sourceType,
        warnings: [],
        diagnostics,
        snapshot: enablePersistence ? snapshot : null,
      });
    } catch (err) {
      if (isSeedingRuntimeError(err)) {
        return seedingResolveFail(err.code, err.message, err.details, diagnostics);
      }
      const mapped = mapDependencyError(err);
      return seedingResolveFail(
        mapped.code,
        mapped.message,
        mapped.details,
        diagnostics
      );
    }
  }

  return {
    resolve,
    assign: resolve,
    adapters,
    identityLookup,
    enablePersistence,
    seedingPolicy,
  };
}

export const SeedingResolver = {
  create: createSeedingResolver,
};
