/**
 * Phase 3F — MatchResolver
 *
 * resolve → map → normalize/validate → identity lookup → optional stub persistence
 * Legacy remains Production primary. No Production wiring.
 * No Participant/Registration/Team/Lineup Runtime deep imports — DI callbacks only.
 * Does not calculate winners or scores.
 */

import { createMatchResolveRequest } from "./contracts/resolveRequest.js";
import { matchResolveOk, matchResolveFail } from "./contracts/resolveResult.js";
import { isMatchAdapter } from "./contracts/adapterContract.js";
import { isMatchPolicy } from "./contracts/matchPolicy.js";
import { createLegacyMatchAdapter } from "./adapters/LegacyMatchAdapter.js";
import { MATCH_RUNTIME_ERROR_CODE } from "./errors/runtimeErrorCodes.js";
import { isMatchRuntimeError } from "./errors/MatchRuntimeError.js";
import {
  createMatchIdentityLookup,
  requireMatchIdentity,
} from "./services/matchIdentityLookup.js";
import { normalizeAndValidateMatch } from "./services/normalizeMatch.js";
import {
  matchesMatchPersistencePort,
  createNoopMatchPersistencePort,
} from "./ports/matchPersistencePort.js";
import { createNoopMatchPolicy } from "./policies/noopMatchPolicy.js";

/**
 * @typedef {Object} MatchResolverOptions
 * @property {import('./contracts/adapterContract.js').MatchAdapter[]} [adapters]
 * @property {ReturnType<typeof createMatchIdentityLookup>} [identityLookup]
 * @property {import('./ports/matchPersistencePort.js').MatchPersistencePort} [persistence]
 * @property {boolean} [enablePersistence]
 * @property {import('./contracts/matchPolicy.js').MatchPolicy} [matchPolicy]
 * @property {Function} [resolveFixture]
 * @property {Function} [resolveTeam]
 * @property {Function} [resolveRoster]
 * @property {Function} [resolveLineup]
 * @property {Function} [resolveParticipantReference]
 * @property {Function} [resolveRegistration]
 * @property {Function} [getMatchContext]
 * @property {Function} [getCourtAssignment]
 * @property {Function} [getRefereeAssignment]
 * @property {Function} [getResultReference]
 * @property {() => string|Date} [clock]
 */

/**
 * @param {import('./contracts/adapterContract.js').MatchAdapter[]} adapters
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
  if (isMatchRuntimeError(err)) {
    return { code: err.code, message: err.message, details: err.details || {} };
  }
  return {
    code: MATCH_RUNTIME_ERROR_CODE.MATCH_DEPENDENCY_FAILED,
    message: err instanceof Error ? err.message : "Dependency failed",
    details: {},
  };
}

/**
 * @param {MatchResolverOptions} [options]
 */
export function createMatchResolver(options = {}) {
  const adapters =
    Array.isArray(options.adapters) && options.adapters.length
      ? options.adapters.filter(isMatchAdapter)
      : [createLegacyMatchAdapter()];

  if (adapters.length === 0) {
    throw new TypeError("createMatchResolver requires at least one MatchAdapter");
  }

  const identityLookup =
    options.identityLookup || createMatchIdentityLookup();
  const enablePersistence = options.enablePersistence === true;
  const persistence =
    options.persistence && matchesMatchPersistencePort(options.persistence)
      ? options.persistence
      : createNoopMatchPersistencePort();

  const matchPolicy = isMatchPolicy(options.matchPolicy)
    ? options.matchPolicy
    : createNoopMatchPolicy();

  const resolveFixture =
    typeof options.resolveFixture === "function"
      ? options.resolveFixture
      : null;
  const resolveTeam =
    typeof options.resolveTeam === "function" ? options.resolveTeam : null;
  const resolveRoster =
    typeof options.resolveRoster === "function" ? options.resolveRoster : null;
  const resolveLineup =
    typeof options.resolveLineup === "function" ? options.resolveLineup : null;
  const resolveParticipantReference =
    typeof options.resolveParticipantReference === "function"
      ? options.resolveParticipantReference
      : null;
  const resolveRegistration =
    typeof options.resolveRegistration === "function"
      ? options.resolveRegistration
      : null;
  const getMatchContext =
    typeof options.getMatchContext === "function"
      ? options.getMatchContext
      : null;
  const getCourtAssignment =
    typeof options.getCourtAssignment === "function"
      ? options.getCourtAssignment
      : null;
  const getRefereeAssignment =
    typeof options.getRefereeAssignment === "function"
      ? options.getRefereeAssignment
      : null;
  const getResultReference =
    typeof options.getResultReference === "function"
      ? options.getResultReference
      : null;
  const clock = typeof options.clock === "function" ? options.clock : null;

  /**
   * @param {import('./contracts/resolveRequest.js').MatchResolveRequest|Record<string, unknown>} rawRequest
   */
  async function resolve(rawRequest) {
    const request = createMatchResolveRequest(rawRequest);

    if (!request.competitionId || !String(request.competitionId).trim()) {
      return matchResolveFail(
        MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
        "competitionId is required",
        {}
      );
    }

    if (request.source == null) {
      return matchResolveFail(
        MATCH_RUNTIME_ERROR_CODE.MATCH_NOT_FOUND,
        "Match source is missing",
        { competitionId: request.competitionId }
      );
    }

    /** @type {Record<string, unknown>} */
    const context = {
      ...request.context,
      competitionId: request.competitionId,
      formatKey: request.formatKey,
      sourceType: request.sourceType || request.context?.sourceType,
      resolveParticipantReference,
    };

    async function runDep(name, fn, args) {
      if (!fn) return;
      try {
        const result = await fn(args);
        if (result && result.ok === false) {
          return matchResolveFail(
            MATCH_RUNTIME_ERROR_CODE.MATCH_DEPENDENCY_FAILED,
            result.error?.message || `${name} failed`,
            {
              dependency: name,
              code: result.error?.code || null,
            }
          );
        }
        return { ok: true, value: result };
      } catch (err) {
        const mapped = mapDependencyError(err);
        return matchResolveFail(mapped.code, mapped.message, {
          ...mapped.details,
          dependency: name,
        });
      }
    }

    if (resolveFixture) {
      const dep = await runDep("resolveFixture", resolveFixture, {
        competitionId: request.competitionId,
        source: request.source,
        context,
      });
      if (dep && dep.ok === false) return dep;
      if (dep?.value?.fixture) context.fixture = dep.value.fixture;
      else if (dep?.value && dep.value.ok !== true && dep.value.fixture == null) {
        context.fixture = dep.value;
      }
    }

    if (getMatchContext) {
      const dep = await runDep("getMatchContext", getMatchContext, {
        competitionId: request.competitionId,
        source: request.source,
        context,
      });
      if (dep && dep.ok === false) return dep;
      if (dep?.value !== undefined) context.matchContext = dep.value;
    }

    if (resolveTeam) {
      const dep = await runDep("resolveTeam", resolveTeam, {
        competitionId: request.competitionId,
        source: request.source,
        context,
      });
      if (dep && dep.ok === false) return dep;
      if (dep?.value?.team) context.team = dep.value.team;
    }

    if (resolveRoster) {
      const dep = await runDep("resolveRoster", resolveRoster, {
        competitionId: request.competitionId,
        source: request.source,
        context,
      });
      if (dep && dep.ok === false) return dep;
      if (dep?.value?.roster) context.roster = dep.value.roster;
    }

    if (resolveLineup) {
      const dep = await runDep("resolveLineup", resolveLineup, {
        competitionId: request.competitionId,
        source: request.source,
        context,
      });
      if (dep && dep.ok === false) return dep;
      if (dep?.value?.lineup) context.lineup = dep.value.lineup;
      if (dep?.value?.lineupReferenceA) {
        context.lineupReferenceA = dep.value.lineupReferenceA;
      }
      if (dep?.value?.lineupReferenceB) {
        context.lineupReferenceB = dep.value.lineupReferenceB;
      }
    }

    if (resolveRegistration) {
      const dep = await runDep("resolveRegistration", resolveRegistration, {
        competitionId: request.competitionId,
        source: request.source,
        context,
      });
      if (dep && dep.ok === false) return dep;
      if (dep?.value?.registration) {
        context.registration = dep.value.registration;
      }
    }

    if (getCourtAssignment) {
      const dep = await runDep("getCourtAssignment", getCourtAssignment, {
        competitionId: request.competitionId,
        source: request.source,
        context,
      });
      if (dep && dep.ok === false) return dep;
      if (dep?.value !== undefined) context.courtAssignment = dep.value;
    }

    if (getRefereeAssignment) {
      const dep = await runDep("getRefereeAssignment", getRefereeAssignment, {
        competitionId: request.competitionId,
        source: request.source,
        context,
      });
      if (dep && dep.ok === false) return dep;
      if (dep?.value !== undefined) context.refereeAssignment = dep.value;
    }

    if (getResultReference) {
      const dep = await runDep("getResultReference", getResultReference, {
        competitionId: request.competitionId,
        source: request.source,
        context,
      });
      if (dep && dep.ok === false) return dep;
      if (dep?.value !== undefined) context.resultReference = dep.value;
    }

    const adapter = selectAdapter(adapters, request.source, context);
    if (!adapter) {
      return matchResolveFail(
        MATCH_RUNTIME_ERROR_CODE.MATCH_UNSUPPORTED_SOURCE,
        "No MatchAdapter supports this source",
        {
          competitionId: request.competitionId,
          sourceType: request.sourceType,
        }
      );
    }

    let mapped;
    try {
      mapped = adapter.map(request.source, context);
    } catch (err) {
      if (isMatchRuntimeError(err)) {
        return matchResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return matchResolveFail(
        MATCH_RUNTIME_ERROR_CODE.MATCH_ADAPTER_FAILED,
        err instanceof Error ? err.message : "Mapping failed",
        { adapterId: adapter.id }
      );
    }

    if (
      context.courtAssignment != null &&
      mapped.courtAssignmentRef == null
    ) {
      mapped = {
        ...mapped,
        courtAssignmentRef:
          typeof context.courtAssignment === "object" &&
          context.courtAssignment &&
          /** @type {{ id?: string }} */ (context.courtAssignment).id != null
            ? String(
                /** @type {{ id?: string }} */ (context.courtAssignment).id
              )
            : String(context.courtAssignment),
      };
    }
    if (
      context.refereeAssignment != null &&
      mapped.refereeAssignmentRef == null
    ) {
      mapped = {
        ...mapped,
        refereeAssignmentRef:
          typeof context.refereeAssignment === "object" &&
          context.refereeAssignment &&
          /** @type {{ id?: string }} */ (context.refereeAssignment).id != null
            ? String(
                /** @type {{ id?: string }} */ (context.refereeAssignment).id
              )
            : String(context.refereeAssignment),
      };
    }
    if (context.resultReference != null && mapped.resultReference == null) {
      mapped = {
        ...mapped,
        resultReference:
          typeof context.resultReference === "object"
            ? context.resultReference
            : { resultId: String(context.resultReference) },
      };
    }

    let match;
    try {
      match = normalizeAndValidateMatch(mapped, {
        allowSingleSide: request.context?.allowSingleSide === true,
        requireLineupReferences:
          request.context?.requireLineupReferences === true,
      });
    } catch (err) {
      if (isMatchRuntimeError(err)) {
        return matchResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return matchResolveFail(
        MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
        err instanceof Error ? err.message : "Validation failed",
        { adapterId: adapter.id }
      );
    }

    if (match.competitionId !== request.competitionId) {
      return matchResolveFail(
        MATCH_RUNTIME_ERROR_CODE.MATCH_COMPETITION_MISMATCH,
        "Mapped competitionId does not match request",
        {
          expected: request.competitionId,
          actual: match.competitionId,
        }
      );
    }

    if (
      request.context?.expectedContextId &&
      String(match.contextId) !== String(request.context.expectedContextId)
    ) {
      return matchResolveFail(
        MATCH_RUNTIME_ERROR_CODE.MATCH_CONTEXT_MISMATCH,
        "Mapped contextId does not match expectedContextId",
        {
          expected: request.context.expectedContextId,
          actual: match.contextId,
        }
      );
    }

    let identity;
    try {
      identity = requireMatchIdentity(match);
      identityLookup.register(match);
    } catch (err) {
      if (isMatchRuntimeError(err)) {
        return matchResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return matchResolveFail(
        MATCH_RUNTIME_ERROR_CODE.MATCH_IDENTITY_COLLISION,
        err instanceof Error ? err.message : "Identity lookup failed",
        { adapterId: adapter.id }
      );
    }

    if (typeof matchPolicy.validateComposition === "function") {
      try {
        const policyResult = await matchPolicy.validateComposition({
          match,
          identity,
          fixture: context.fixture,
          lineup: context.lineup,
          now: clock ? clock() : null,
          extras: context,
        });
        if (policyResult && policyResult.ok === false) {
          return matchResolveFail(
            policyResult.code ||
              MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
            policyResult.message || "Match policy rejected composition",
            {
              ...(policyResult.details || {}),
              policyId: matchPolicy.id,
            },
            { adapterId: adapter.id }
          );
        }
      } catch (err) {
        const mappedErr = mapDependencyError(err);
        return matchResolveFail(mappedErr.code, mappedErr.message, {
          ...mappedErr.details,
          dependency: "matchPolicy.validateComposition",
        });
      }
    }

    if (!enablePersistence) {
      // Persistence remains OFF by default — noop port is never written.
    } else {
      try {
        await persistence.save({
          ...match,
          identityKey: identity.key,
        });
      } catch (err) {
        return matchResolveFail(
          MATCH_RUNTIME_ERROR_CODE.MATCH_PERSISTENCE_DISABLED,
          "Persistence stub failed",
          {
            adapterId: adapter.id,
            message: err instanceof Error ? err.message : String(err),
          }
        );
      }
    }

    return matchResolveOk({
      match,
      identity,
      adapterId: adapter.id,
      sourceType: adapter.sourceType,
      diagnostics: {
        persistenceEnabled: enablePersistence,
        identityKey: identity.key,
        policyId: matchPolicy.id,
        // Explicit safety marker for architecture tests / consumers
        winnerCalculated: false,
        scoringImplemented: false,
      },
    });
  }

  /**
   * @param {Array<import('./contracts/resolveRequest.js').MatchResolveRequest|Record<string, unknown>>} requests
   */
  async function resolveBatch(requests) {
    const list = Array.isArray(requests) ? requests : [];
    /** @type {import('./contracts/resolveResult.js').MatchResolveResult[]} */
    const results = [];
    for (const req of list) {
      results.push(await resolve(req));
    }
    return results;
  }

  return {
    resolve,
    resolveBatch,
    getAdapters() {
      return [...adapters];
    },
    getIdentityLookup() {
      return identityLookup;
    },
    getMatchPolicy() {
      return matchPolicy;
    },
  };
}

/**
 * @param {MatchResolverOptions} [options]
 */
export function MatchResolver(options) {
  return createMatchResolver(options);
}
