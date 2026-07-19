/**
 * Phase 3E — LineupResolver
 *
 * resolve → map → normalize/validate → identity lookup → optional stub persistence
 * Legacy remains Production primary. No Production wiring.
 * No Participant/Registration/Team Runtime deep imports — DI callbacks only.
 */

import { createLineupResolveRequest } from "./contracts/resolveRequest.js";
import { lineupResolveOk, lineupResolveFail } from "./contracts/resolveResult.js";
import { isLineupAdapter } from "./contracts/adapterContract.js";
import { isLineupPolicy } from "./contracts/lineupPolicy.js";
import { createLegacyLineupAdapter } from "./adapters/LegacyLineupAdapter.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "./errors/runtimeErrorCodes.js";
import { isLineupRuntimeError } from "./errors/LineupRuntimeError.js";
import {
  createLineupIdentityLookup,
  requireLineupIdentity,
} from "./services/lineupIdentityLookup.js";
import { normalizeAndValidateLineup } from "./services/normalizeLineup.js";
import {
  matchesLineupPersistencePort,
  createNoopLineupPersistencePort,
} from "./ports/lineupPersistencePort.js";
import { createNoopLineupPolicy } from "./policies/noopLineupPolicy.js";

/**
 * @typedef {Object} LineupResolverOptions
 * @property {import('./contracts/adapterContract.js').LineupAdapter[]} [adapters]
 * @property {ReturnType<typeof createLineupIdentityLookup>} [identityLookup]
 * @property {import('./ports/lineupPersistencePort.js').LineupPersistencePort} [persistence]
 * @property {boolean} [enablePersistence]
 * @property {import('./contracts/lineupPolicy.js').LineupPolicy} [lineupPolicy]
 * @property {Function} [resolveTeam]
 * @property {Function} [resolveRoster]
 * @property {Function} [resolveParticipant]
 * @property {Function} [getMatchContext]
 * @property {() => string|Date} [clock]
 */

/**
 * @param {import('./contracts/adapterContract.js').LineupAdapter[]} adapters
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
  if (isLineupRuntimeError(err)) {
    return { code: err.code, message: err.message, details: err.details || {} };
  }
  return {
    code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_DEPENDENCY_FAILED,
    message: err instanceof Error ? err.message : "Dependency failed",
    details: {},
  };
}

/**
 * @param {LineupResolverOptions} [options]
 */
export function createLineupResolver(options = {}) {
  const adapters =
    Array.isArray(options.adapters) && options.adapters.length
      ? options.adapters.filter(isLineupAdapter)
      : [createLegacyLineupAdapter()];

  if (adapters.length === 0) {
    throw new TypeError("createLineupResolver requires at least one LineupAdapter");
  }

  const identityLookup =
    options.identityLookup || createLineupIdentityLookup();
  const enablePersistence = options.enablePersistence === true;
  const persistence =
    options.persistence && matchesLineupPersistencePort(options.persistence)
      ? options.persistence
      : createNoopLineupPersistencePort();

  const lineupPolicy = isLineupPolicy(options.lineupPolicy)
    ? options.lineupPolicy
    : createNoopLineupPolicy();

  const resolveTeam =
    typeof options.resolveTeam === "function" ? options.resolveTeam : null;
  const resolveRoster =
    typeof options.resolveRoster === "function" ? options.resolveRoster : null;
  const resolveParticipant =
    typeof options.resolveParticipant === "function"
      ? options.resolveParticipant
      : null;
  const getMatchContext =
    typeof options.getMatchContext === "function"
      ? options.getMatchContext
      : null;
  const clock = typeof options.clock === "function" ? options.clock : null;

  /**
   * @param {import('./contracts/resolveRequest.js').LineupResolveRequest|Record<string, unknown>} rawRequest
   */
  async function resolve(rawRequest) {
    const request = createLineupResolveRequest(rawRequest);

    if (!request.competitionId || !String(request.competitionId).trim()) {
      return lineupResolveFail(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
        "competitionId is required",
        {}
      );
    }

    if (request.source == null) {
      return lineupResolveFail(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_NOT_FOUND,
        "Lineup source is missing",
        { competitionId: request.competitionId }
      );
    }

    /** @type {Record<string, unknown>} */
    const context = {
      ...request.context,
      competitionId: request.competitionId,
      formatKey: request.formatKey,
      sourceType: request.sourceType || request.context?.sourceType,
      resolveParticipant,
    };

    if (resolveTeam) {
      try {
        const teamResult = await resolveTeam({
          competitionId: request.competitionId,
          source: request.context?.teamSource ?? request.source,
          context,
        });
        if (teamResult && teamResult.ok === false) {
          return lineupResolveFail(
            LINEUP_RUNTIME_ERROR_CODE.LINEUP_DEPENDENCY_FAILED,
            teamResult.error?.message || "resolveTeam failed",
            {
              dependency: "resolveTeam",
              code: teamResult.error?.code || null,
            }
          );
        }
        if (teamResult?.team) {
          context.team = teamResult.team;
          if (
            request.context?.expectedTeamId &&
            String(teamResult.team.id) !== String(request.context.expectedTeamId)
          ) {
            return lineupResolveFail(
              LINEUP_RUNTIME_ERROR_CODE.LINEUP_TEAM_MISMATCH,
              "Resolved team does not match expectedTeamId",
              {
                expected: request.context.expectedTeamId,
                actual: teamResult.team.id,
              }
            );
          }
        }
      } catch (err) {
        const mapped = mapDependencyError(err);
        return lineupResolveFail(mapped.code, mapped.message, {
          ...mapped.details,
          dependency: "resolveTeam",
        });
      }
    }

    if (resolveRoster) {
      try {
        const rosterResult = await resolveRoster({
          competitionId: request.competitionId,
          source: request.context?.rosterSource ?? request.context?.teamSource,
          context,
        });
        if (rosterResult && rosterResult.ok === false) {
          return lineupResolveFail(
            LINEUP_RUNTIME_ERROR_CODE.LINEUP_DEPENDENCY_FAILED,
            rosterResult.error?.message || "resolveRoster failed",
            {
              dependency: "resolveRoster",
              code: rosterResult.error?.code || null,
            }
          );
        }
        if (rosterResult?.roster) {
          context.roster = rosterResult.roster;
          context.rosterId = rosterResult.roster.id;
        }
      } catch (err) {
        const mapped = mapDependencyError(err);
        return lineupResolveFail(mapped.code, mapped.message, {
          ...mapped.details,
          dependency: "resolveRoster",
        });
      }
    }

    if (getMatchContext) {
      try {
        context.matchContext = await getMatchContext({
          competitionId: request.competitionId,
          source: request.source,
          context,
        });
      } catch (err) {
        const mapped = mapDependencyError(err);
        return lineupResolveFail(mapped.code, mapped.message, {
          ...mapped.details,
          dependency: "getMatchContext",
        });
      }
    }

    const adapter = selectAdapter(adapters, request.source, context);
    if (!adapter) {
      return lineupResolveFail(
        LINEUP_RUNTIME_ERROR_CODE.UNSUPPORTED_LINEUP_SOURCE,
        "No LineupAdapter supports this source",
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
      if (isLineupRuntimeError(err)) {
        return lineupResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return lineupResolveFail(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_ADAPTER_FAILED,
        err instanceof Error ? err.message : "Mapping failed",
        { adapterId: adapter.id }
      );
    }

    let lineup;
    try {
      lineup = normalizeAndValidateLineup(mapped, {
        roster: context.roster ?? request.context?.roster,
        allowDuplicateParticipants:
          request.context?.allowDuplicateParticipants === true,
        requireSlots: request.context?.requireSlots === true,
      });
    } catch (err) {
      if (isLineupRuntimeError(err)) {
        return lineupResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return lineupResolveFail(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
        err instanceof Error ? err.message : "Validation failed",
        { adapterId: adapter.id }
      );
    }

    if (lineup.competitionId !== request.competitionId) {
      return lineupResolveFail(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
        "Mapped competitionId does not match request",
        {
          expected: request.competitionId,
          actual: lineup.competitionId,
        }
      );
    }

    if (
      context.team &&
      typeof context.team === "object" &&
      /** @type {{ id?: string }} */ (context.team).id &&
      String(/** @type {{ id?: string }} */ (context.team).id) !==
        String(lineup.teamId)
    ) {
      return lineupResolveFail(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_TEAM_MISMATCH,
        "Lineup teamId does not match resolved team",
        {
          lineupTeamId: lineup.teamId,
          teamId: /** @type {{ id?: string }} */ (context.team).id,
        }
      );
    }

    let identity;
    try {
      identity = requireLineupIdentity(lineup);
      identityLookup.register(lineup);
    } catch (err) {
      if (isLineupRuntimeError(err)) {
        return lineupResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return lineupResolveFail(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDENTITY_COLLISION,
        err instanceof Error ? err.message : "Identity lookup failed",
        { adapterId: adapter.id }
      );
    }

    if (typeof lineupPolicy.validateSlots === "function") {
      try {
        const policyResult = await lineupPolicy.validateSlots({
          lineup,
          identity,
          roster: context.roster,
          team: context.team,
          matchContext: context.matchContext,
          now: clock ? clock() : null,
          extras: context,
        });
        if (policyResult && policyResult.ok === false) {
          return lineupResolveFail(
            policyResult.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_INELIGIBLE,
            policyResult.message || "Lineup policy rejected slots",
            {
              ...(policyResult.details || {}),
              policyId: lineupPolicy.id,
            },
            { adapterId: adapter.id }
          );
        }
      } catch (err) {
        const mappedErr = mapDependencyError(err);
        return lineupResolveFail(mappedErr.code, mappedErr.message, {
          ...mappedErr.details,
          dependency: "lineupPolicy.validateSlots",
        });
      }
    }

    if (!enablePersistence) {
      // Persistence remains OFF by default — noop port is never written.
    } else {
      try {
        await persistence.save({
          ...lineup,
          identityKey: identity.key,
        });
      } catch (err) {
        return lineupResolveFail(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_PERSISTENCE_DISABLED,
          "Persistence stub failed",
          {
            adapterId: adapter.id,
            message: err instanceof Error ? err.message : String(err),
          }
        );
      }
    }

    return lineupResolveOk({
      lineup,
      identity,
      adapterId: adapter.id,
      sourceType: adapter.sourceType,
      diagnostics: {
        persistenceEnabled: enablePersistence,
        identityKey: identity.key,
        policyId: lineupPolicy.id,
      },
    });
  }

  /**
   * @param {Array<import('./contracts/resolveRequest.js').LineupResolveRequest|Record<string, unknown>>} requests
   */
  async function resolveBatch(requests) {
    const list = Array.isArray(requests) ? requests : [];
    /** @type {import('./contracts/resolveResult.js').LineupResolveResult[]} */
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
    getLineupPolicy() {
      return lineupPolicy;
    },
  };
}

/**
 * @param {LineupResolverOptions} [options]
 */
export function LineupResolver(options) {
  return createLineupResolver(options);
}
