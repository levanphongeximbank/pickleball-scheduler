/**
 * Phase 3D — RosterResolver
 *
 * resolve → map → normalize/validate → identity lookup → optional stub persistence
 * Legacy remains Production primary. No Production wiring. No Participant Runtime import.
 * Substitution workflow is NOT implemented (amendments stay empty from mapper).
 */

import { createRosterResolveRequest } from "./contracts/resolveRequest.js";
import { rosterResolveOk, rosterResolveFail } from "./contracts/resolveResult.js";
import { isRosterAdapter } from "./contracts/adapterContract.js";
import { createLegacyRosterAdapter } from "./adapters/LegacyRosterAdapter.js";
import { TEAM_RUNTIME_ERROR_CODE } from "./errors/runtimeErrorCodes.js";
import { isTeamRuntimeError } from "./errors/TeamRuntimeError.js";
import {
  createRosterIdentityLookup,
  requireRosterIdentity,
} from "./services/rosterIdentityLookup.js";
import { normalizeAndValidateRoster } from "./services/normalizeRoster.js";
import {
  matchesRosterPersistencePort,
  createNoopRosterPersistencePort,
} from "./ports/teamPersistencePort.js";
import { resolveMemberRefsWithDependency } from "./mappers/memberRefs.js";

/**
 * @typedef {Object} RosterResolverOptions
 * @property {import('./contracts/adapterContract.js').RosterAdapter[]} [adapters]
 * @property {ReturnType<typeof createRosterIdentityLookup>} [identityLookup]
 * @property {import('./ports/teamPersistencePort.js').RosterPersistencePort} [persistence]
 * @property {boolean} [enablePersistence]
 * @property {Function} [resolveParticipant] — optional Participant Runtime DI callback
 */

/**
 * @param {import('./contracts/adapterContract.js').RosterAdapter[]} adapters
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
 * @param {RosterResolverOptions} [options]
 */
export function createRosterResolver(options = {}) {
  const adapters =
    Array.isArray(options.adapters) && options.adapters.length
      ? options.adapters.filter(isRosterAdapter)
      : [createLegacyRosterAdapter()];

  if (adapters.length === 0) {
    throw new TypeError("createRosterResolver requires at least one RosterAdapter");
  }

  const identityLookup = options.identityLookup || createRosterIdentityLookup();
  const enablePersistence = options.enablePersistence === true;
  const persistence =
    options.persistence && matchesRosterPersistencePort(options.persistence)
      ? options.persistence
      : createNoopRosterPersistencePort();

  const resolveParticipant =
    typeof options.resolveParticipant === "function"
      ? options.resolveParticipant
      : null;

  /**
   * @param {import('./contracts/resolveRequest.js').RosterResolveRequest|Record<string, unknown>} rawRequest
   */
  async function resolve(rawRequest) {
    const request = createRosterResolveRequest(rawRequest);

    if (!request.competitionId || !String(request.competitionId).trim()) {
      return rosterResolveFail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
        "competitionId is required",
        {}
      );
    }

    if (request.source == null) {
      return rosterResolveFail(
        TEAM_RUNTIME_ERROR_CODE.ROSTER_NOT_FOUND,
        "Roster source is missing",
        { competitionId: request.competitionId }
      );
    }

    const context = {
      ...request.context,
      competitionId: request.competitionId,
      formatKey: request.formatKey,
      sourceType: request.sourceType || request.context?.sourceType,
      preferRoster: true,
      resolveParticipant,
    };

    if (
      resolveParticipant &&
      request.source &&
      typeof request.source === "object" &&
      Array.isArray(request.source.playerIds) &&
      !context.memberRefs
    ) {
      try {
        context.memberRefs = await resolveMemberRefsWithDependency(
          request.source,
          context,
          resolveParticipant
        );
      } catch (err) {
        if (isTeamRuntimeError(err)) {
          return rosterResolveFail(err.code, err.message, err.details);
        }
        return rosterResolveFail(
          TEAM_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
          err instanceof Error ? err.message : "Participant dependency failed",
          {}
        );
      }
    }

    const adapter = selectAdapter(adapters, request.source, context);
    if (!adapter) {
      return rosterResolveFail(
        TEAM_RUNTIME_ERROR_CODE.UNSUPPORTED_ROSTER_SOURCE,
        "No RosterAdapter supports this source",
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
      if (isTeamRuntimeError(err)) {
        return rosterResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return rosterResolveFail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER_MAPPING,
        err instanceof Error ? err.message : "Mapping failed",
        { adapterId: adapter.id }
      );
    }

    let roster;
    try {
      roster = normalizeAndValidateRoster(mapped);
    } catch (err) {
      if (isTeamRuntimeError(err)) {
        return rosterResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return rosterResolveFail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
        err instanceof Error ? err.message : "Validation failed",
        { adapterId: adapter.id }
      );
    }

    if (roster.competitionId !== request.competitionId) {
      return rosterResolveFail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
        "Mapped competitionId does not match request",
        {
          expected: request.competitionId,
          actual: roster.competitionId,
        }
      );
    }

    let identity;
    try {
      identity = requireRosterIdentity(roster);
      identityLookup.register(roster);
    } catch (err) {
      if (isTeamRuntimeError(err)) {
        return rosterResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return rosterResolveFail(
        TEAM_RUNTIME_ERROR_CODE.ROSTER_IDENTITY_COLLISION,
        err instanceof Error ? err.message : "Identity lookup failed",
        { adapterId: adapter.id }
      );
    }

    if (enablePersistence) {
      try {
        await persistence.save({
          ...roster,
          identityKey: identity.key,
        });
      } catch (err) {
        return rosterResolveFail(
          TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
          "Persistence stub failed",
          {
            adapterId: adapter.id,
            message: err instanceof Error ? err.message : String(err),
          }
        );
      }
    }

    return rosterResolveOk({
      roster,
      identity,
      adapterId: adapter.id,
      sourceType: adapter.sourceType,
      diagnostics: {
        persistenceEnabled: enablePersistence,
        identityKey: identity.key,
        memberCount: roster.members.length,
      },
    });
  }

  /**
   * @param {Array<import('./contracts/resolveRequest.js').RosterResolveRequest|Record<string, unknown>>} requests
   */
  async function resolveBatch(requests) {
    const list = Array.isArray(requests) ? requests : [];
    /** @type {import('./contracts/resolveResult.js').RosterResolveResult[]} */
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
  };
}

/**
 * @param {RosterResolverOptions} [options]
 */
export function RosterResolver(options) {
  return createRosterResolver(options);
}
