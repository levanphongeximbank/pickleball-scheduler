/**
 * Phase 3B — ParticipantResolver
 *
 * resolve → normalize → validate → identity lookup → adapter selection
 * Legacy remains the only adapter. No Production wiring.
 */

import { createParticipantResolveRequest } from "./contracts/resolveRequest.js";
import { resolveOk, resolveFail } from "./contracts/resolveResult.js";
import { isParticipantAdapter } from "./contracts/participantAdapter.js";
import { createLegacyParticipantAdapter } from "./adapters/LegacyParticipantAdapter.js";
import {
  PARTICIPANT_RUNTIME_ERROR_CODE,
} from "./errors/runtimeErrorCodes.js";
import { isParticipantRuntimeError } from "./errors/ParticipantRuntimeError.js";
import {
  createIdentityLookup,
  requireParticipantIdentity,
} from "./services/identityLookup.js";
import { normalizeAndValidateParticipant } from "./services/normalizeParticipant.js";
import {
  matchesParticipantPersistencePort,
  createNoopParticipantPersistencePort,
} from "./ports/participantPersistencePort.js";
import { resolveShadow as runResolveShadow } from "./shadow/resolveShadow.js";

/**
 * @typedef {Object} ParticipantResolverOptions
 * @property {import('./contracts/participantAdapter.js').ParticipantAdapter[]} [adapters]
 * @property {ReturnType<typeof createIdentityLookup>} [identityLookup]
 * @property {import('./ports/participantPersistencePort.js').ParticipantPersistencePort} [persistence]
 * @property {boolean} [enablePersistence] — must stay false for Production paths
 */

/**
 * Select first supporting adapter.
 * @param {import('./contracts/participantAdapter.js').ParticipantAdapter[]} adapters
 * @param {unknown} source
 * @param {Record<string, unknown>} context
 * @returns {import('./contracts/participantAdapter.js').ParticipantAdapter|null}
 */
function selectAdapter(adapters, source, context) {
  for (const adapter of adapters) {
    if (adapter.supports(source, context)) return adapter;
  }
  return null;
}

/**
 * @param {ParticipantResolverOptions} [options]
 */
export function createParticipantResolver(options = {}) {
  const adapters = Array.isArray(options.adapters) && options.adapters.length
    ? options.adapters.filter(isParticipantAdapter)
    : [createLegacyParticipantAdapter()];

  if (adapters.length === 0) {
    throw new TypeError("createParticipantResolver requires at least one ParticipantAdapter");
  }

  const identityLookup = options.identityLookup || createIdentityLookup();
  const enablePersistence = options.enablePersistence === true;
  const persistence =
    options.persistence && matchesParticipantPersistencePort(options.persistence)
      ? options.persistence
      : createNoopParticipantPersistencePort();

  /**
   * @param {import('./contracts/resolveRequest.js').ParticipantResolveRequest|Record<string, unknown>} rawRequest
   * @returns {Promise<import('./contracts/resolveResult.js').ParticipantResolveResult>}
   */
  async function resolve(rawRequest) {
    const request = createParticipantResolveRequest(rawRequest);

    if (!request.competitionId || !String(request.competitionId).trim()) {
      return resolveFail(
        PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
        "competitionId is required",
        {}
      );
    }

    if (request.source == null) {
      return resolveFail(
        PARTICIPANT_RUNTIME_ERROR_CODE.PARTICIPANT_NOT_FOUND,
        "Participant source is missing",
        { competitionId: request.competitionId }
      );
    }

    const context = {
      ...request.context,
      competitionId: request.competitionId,
      formatKey: request.formatKey,
      sourceType: request.sourceType,
    };

    const adapter = selectAdapter(adapters, request.source, context);
    if (!adapter) {
      return resolveFail(
        PARTICIPANT_RUNTIME_ERROR_CODE.UNSUPPORTED_SOURCE,
        "No ParticipantAdapter supports this source",
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
      if (isParticipantRuntimeError(err)) {
        return resolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return resolveFail(
        PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_MAPPING,
        err instanceof Error ? err.message : "Mapping failed",
        { adapterId: adapter.id }
      );
    }

    let participant;
    try {
      participant = normalizeAndValidateParticipant(mapped);
    } catch (err) {
      if (isParticipantRuntimeError(err)) {
        return resolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return resolveFail(
        PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
        err instanceof Error ? err.message : "Validation failed",
        { adapterId: adapter.id }
      );
    }

    // Enforce request competition scope — refuse silent reassignment.
    if (participant.competitionId !== request.competitionId) {
      return resolveFail(
        PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
        "Mapped competitionId does not match request",
        {
          expected: request.competitionId,
          actual: participant.competitionId,
        }
      );
    }

    let identity;
    try {
      identity = requireParticipantIdentity(participant);
      identityLookup.register(participant);
    } catch (err) {
      if (isParticipantRuntimeError(err)) {
        return resolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return resolveFail(
        PARTICIPANT_RUNTIME_ERROR_CODE.IDENTITY_COLLISION,
        err instanceof Error ? err.message : "Identity lookup failed",
        { adapterId: adapter.id }
      );
    }

    if (enablePersistence) {
      try {
        await persistence.save({
          ...participant,
          identityKey: identity.key,
        });
      } catch (err) {
        return resolveFail(
          PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
          "Persistence stub failed",
          {
            adapterId: adapter.id,
            message: err instanceof Error ? err.message : String(err),
          }
        );
      }
    }

    return resolveOk({
      participant,
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
   * Shadow-only helper — must not be called from Production request paths.
   * @param {import('./contracts/resolveRequest.js').ParticipantResolveRequest|Record<string, unknown>} request
   * @param {{ legacyParticipant?: unknown, compareWith?: unknown }} [shadowOptions]
   */
  async function resolveShadow(request, shadowOptions = {}) {
    const req = createParticipantResolveRequest({
      ...request,
      allowShadow: true,
    });
    const result = await resolve(req);
    return runResolveShadow(result, shadowOptions);
  }

  return {
    resolve,
    resolveShadow,
    getAdapters() {
      return [...adapters];
    },
    getIdentityLookup() {
      return identityLookup;
    },
  };
}

/**
 * @param {ParticipantResolverOptions} [options]
 */
export function ParticipantResolver(options) {
  return createParticipantResolver(options);
}
