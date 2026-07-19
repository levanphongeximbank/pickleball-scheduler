/**
 * Phase 3D — TeamResolver
 *
 * resolve → map → normalize/validate → identity lookup → optional stub persistence
 * Legacy remains Production primary. No Production wiring. No Participant Runtime import.
 */

import { createTeamResolveRequest } from "./contracts/resolveRequest.js";
import { teamResolveOk, teamResolveFail } from "./contracts/resolveResult.js";
import { isTeamAdapter } from "./contracts/adapterContract.js";
import { createLegacyTeamAdapter } from "./adapters/LegacyTeamAdapter.js";
import { TEAM_RUNTIME_ERROR_CODE } from "./errors/runtimeErrorCodes.js";
import { isTeamRuntimeError } from "./errors/TeamRuntimeError.js";
import {
  createTeamIdentityLookup,
  requireTeamIdentity,
} from "./services/teamIdentityLookup.js";
import { normalizeAndValidateTeam } from "./services/normalizeTeam.js";
import {
  matchesTeamPersistencePort,
  createNoopTeamPersistencePort,
} from "./ports/teamPersistencePort.js";
import { resolveMemberRefsWithDependency } from "./mappers/memberRefs.js";

/**
 * @typedef {Object} TeamResolverOptions
 * @property {import('./contracts/adapterContract.js').TeamAdapter[]} [adapters]
 * @property {ReturnType<typeof createTeamIdentityLookup>} [identityLookup]
 * @property {import('./ports/teamPersistencePort.js').TeamPersistencePort} [persistence]
 * @property {boolean} [enablePersistence]
 * @property {Function} [resolveParticipant] — optional Participant Runtime DI callback
 */

/**
 * @param {import('./contracts/adapterContract.js').TeamAdapter[]} adapters
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
 * @param {TeamResolverOptions} [options]
 */
export function createTeamResolver(options = {}) {
  const adapters =
    Array.isArray(options.adapters) && options.adapters.length
      ? options.adapters.filter(isTeamAdapter)
      : [createLegacyTeamAdapter()];

  if (adapters.length === 0) {
    throw new TypeError("createTeamResolver requires at least one TeamAdapter");
  }

  const identityLookup = options.identityLookup || createTeamIdentityLookup();
  const enablePersistence = options.enablePersistence === true;
  const persistence =
    options.persistence && matchesTeamPersistencePort(options.persistence)
      ? options.persistence
      : createNoopTeamPersistencePort();

  const resolveParticipant =
    typeof options.resolveParticipant === "function"
      ? options.resolveParticipant
      : null;

  /**
   * @param {import('./contracts/resolveRequest.js').TeamResolveRequest|Record<string, unknown>} rawRequest
   */
  async function resolve(rawRequest) {
    const request = createTeamResolveRequest(rawRequest);

    if (!request.competitionId || !String(request.competitionId).trim()) {
      return teamResolveFail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
        "competitionId is required",
        {}
      );
    }

    if (request.source == null) {
      return teamResolveFail(
        TEAM_RUNTIME_ERROR_CODE.TEAM_NOT_FOUND,
        "Team source is missing",
        { competitionId: request.competitionId }
      );
    }

    const context = {
      ...request.context,
      competitionId: request.competitionId,
      formatKey: request.formatKey,
      sourceType: request.sourceType || request.context?.sourceType,
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
        const captainId = request.source.captainPlayerId
          ? String(request.source.captainPlayerId).trim()
          : "";
        if (captainId) {
          const captain = context.memberRefs.find(
            (r) => String(r.id) === captainId
          );
          if (captain) context.captainRef = captain;
        }
      } catch (err) {
        if (isTeamRuntimeError(err)) {
          return teamResolveFail(err.code, err.message, err.details);
        }
        return teamResolveFail(
          TEAM_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
          err instanceof Error ? err.message : "Participant dependency failed",
          {}
        );
      }
    }

    const adapter = selectAdapter(adapters, request.source, context);
    if (!adapter) {
      return teamResolveFail(
        TEAM_RUNTIME_ERROR_CODE.UNSUPPORTED_TEAM_SOURCE,
        "No TeamAdapter supports this source",
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
        return teamResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return teamResolveFail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM_MAPPING,
        err instanceof Error ? err.message : "Mapping failed",
        { adapterId: adapter.id }
      );
    }

    let team;
    try {
      team = normalizeAndValidateTeam(mapped);
    } catch (err) {
      if (isTeamRuntimeError(err)) {
        return teamResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return teamResolveFail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
        err instanceof Error ? err.message : "Validation failed",
        { adapterId: adapter.id }
      );
    }

    if (team.competitionId !== request.competitionId) {
      return teamResolveFail(
        TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
        "Mapped competitionId does not match request",
        {
          expected: request.competitionId,
          actual: team.competitionId,
        }
      );
    }

    let identity;
    try {
      identity = requireTeamIdentity(team);
      identityLookup.register(team);
    } catch (err) {
      if (isTeamRuntimeError(err)) {
        return teamResolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return teamResolveFail(
        TEAM_RUNTIME_ERROR_CODE.TEAM_IDENTITY_COLLISION,
        err instanceof Error ? err.message : "Identity lookup failed",
        { adapterId: adapter.id }
      );
    }

    if (enablePersistence) {
      try {
        await persistence.save({
          ...team,
          identityKey: identity.key,
        });
      } catch (err) {
        return teamResolveFail(
          TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
          "Persistence stub failed",
          {
            adapterId: adapter.id,
            message: err instanceof Error ? err.message : String(err),
          }
        );
      }
    }

    return teamResolveOk({
      team,
      identity,
      adapterId: adapter.id,
      sourceType: adapter.sourceType,
      diagnostics: {
        persistenceEnabled: enablePersistence,
        identityKey: identity.key,
      },
    });
  }

  /**
   * @param {Array<import('./contracts/resolveRequest.js').TeamResolveRequest|Record<string, unknown>>} requests
   */
  async function resolveBatch(requests) {
    const list = Array.isArray(requests) ? requests : [];
    /** @type {import('./contracts/resolveResult.js').TeamResolveResult[]} */
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
 * @param {TeamResolverOptions} [options]
 */
export function TeamResolver(options) {
  return createTeamResolver(options);
}
