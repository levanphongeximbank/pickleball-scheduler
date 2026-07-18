/**
 * Phase 3C — RegistrationResolver
 *
 * resolve → map → normalize/validate → identity lookup → optional stub persistence
 * Legacy remains Production primary. No Production wiring. No Participant app registry.
 */

import { createRegistrationResolveRequest } from "./contracts/resolveRequest.js";
import { resolveOk, resolveFail } from "./contracts/resolveResult.js";
import { isRegistrationAdapter } from "./contracts/registrationAdapter.js";
import { createLegacyRegistrationAdapter } from "./adapters/LegacyRegistrationAdapter.js";
import { REGISTRATION_RUNTIME_ERROR_CODE } from "./errors/runtimeErrorCodes.js";
import { isRegistrationRuntimeError } from "./errors/RegistrationRuntimeError.js";
import {
  createRegistrationIdentityLookup,
  requireRegistrationIdentity,
} from "./services/identityLookup.js";
import {
  normalizeAndValidateRegistration,
  assertGuestPreserved,
} from "./services/normalizeRegistration.js";
import {
  matchesRegistrationPersistencePort,
  createNoopRegistrationPersistencePort,
} from "./ports/registrationPersistencePort.js";
import { COMPETITION_REGISTRATION_STATUS } from "../participants/enums/statuses.js";
import { REGISTRATION_KIND } from "./enums/registrationKinds.js";
import { RegistrationRuntimeError } from "./errors/RegistrationRuntimeError.js";

const COUNTABLE_STATUSES = new Set([
  COMPETITION_REGISTRATION_STATUS.PENDING,
  COMPETITION_REGISTRATION_STATUS.SUBMITTED,
  COMPETITION_REGISTRATION_STATUS.APPROVED,
  COMPETITION_REGISTRATION_STATUS.WAITLISTED,
]);

/**
 * @typedef {Object} RegistrationResolverOptions
 * @property {import('./contracts/registrationAdapter.js').RegistrationAdapter[]} [adapters]
 * @property {ReturnType<typeof createRegistrationIdentityLookup>} [identityLookup]
 * @property {import('./ports/registrationPersistencePort.js').RegistrationPersistencePort} [persistence]
 * @property {boolean} [enablePersistence] — must stay false for Production paths
 * @property {Function} [resolveParticipant] — optional Participant Runtime DI callback
 */

/**
 * @param {import('./contracts/registrationAdapter.js').RegistrationAdapter[]} adapters
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
 * @param {import('../participants/contracts/entryRegistration.js').CompetitionRegistration} registration
 * @param {Set<string>} seenPlayerKeys
 */
function detectDuplicatePlayers(registration, seenPlayerKeys) {
  if (registration.registrationKind !== REGISTRATION_KIND.INDIVIDUAL) return;
  if (!COUNTABLE_STATUSES.has(registration.status)) return;
  for (const ref of registration.memberRefs || []) {
    const key = `${registration.competitionId}::${ref.kind}::${ref.id}`;
    if (seenPlayerKeys.has(key)) {
      throw new RegistrationRuntimeError(
        REGISTRATION_RUNTIME_ERROR_CODE.DUPLICATE_REGISTRATION,
        "Duplicate participant registration in competition scope",
        {
          competitionId: registration.competitionId,
          participantKind: ref.kind,
          participantId: ref.id,
          registrationId: registration.id,
        }
      );
    }
    seenPlayerKeys.add(key);
  }
}

/**
 * @param {RegistrationResolverOptions} [options]
 */
export function createRegistrationResolver(options = {}) {
  const adapters =
    Array.isArray(options.adapters) && options.adapters.length
      ? options.adapters.filter(isRegistrationAdapter)
      : [createLegacyRegistrationAdapter()];

  if (adapters.length === 0) {
    throw new TypeError("createRegistrationResolver requires at least one RegistrationAdapter");
  }

  const identityLookup =
    options.identityLookup || createRegistrationIdentityLookup();
  const enablePersistence = options.enablePersistence === true;
  const persistence =
    options.persistence && matchesRegistrationPersistencePort(options.persistence)
      ? options.persistence
      : createNoopRegistrationPersistencePort();

  const resolveParticipant =
    typeof options.resolveParticipant === "function"
      ? options.resolveParticipant
      : null;

  /**
   * @param {import('./contracts/resolveRequest.js').RegistrationResolveRequest|Record<string, unknown>} rawRequest
   * @param {{ seenPlayerKeys?: Set<string> }} [batchState]
   */
  async function resolve(rawRequest, batchState = {}) {
    const request = createRegistrationResolveRequest(rawRequest);

    if (!request.competitionId || !String(request.competitionId).trim()) {
      return resolveFail(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
        "competitionId is required",
        {}
      );
    }

    if (request.source == null) {
      return resolveFail(
        REGISTRATION_RUNTIME_ERROR_CODE.REGISTRATION_NOT_FOUND,
        "Registration source is missing",
        { competitionId: request.competitionId }
      );
    }

    const context = {
      ...request.context,
      competitionId: request.competitionId,
      formatKey: request.formatKey,
      sourceType: request.sourceType || request.context?.sourceType,
      registrationKind: request.registrationKind || request.context?.registrationKind,
      resolveParticipant,
    };

    // Optional DI: pre-resolve member refs via Participant Runtime callback
    if (
      resolveParticipant &&
      request.source &&
      typeof request.source === "object" &&
      Array.isArray(request.source.playerIds) &&
      !context.memberRefs
    ) {
      try {
        const refs = [];
        for (const id of request.source.playerIds) {
          const player = context.playerById?.[id] || { id };
          const result = await resolveParticipant(player, {
            competitionId: request.competitionId,
          });
          if (!result || result.ok === false) {
            return resolveFail(
              REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
              "Injected participant resolve failed",
              { playerId: id, error: result?.error || null }
            );
          }
          const person = result.participant?.person || result.person;
          if (!person?.id) {
            return resolveFail(
              REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
              "Injected participant missing person reference",
              { playerId: id }
            );
          }
          refs.push(person);
        }
        context.memberRefs = refs;
      } catch (err) {
        if (isRegistrationRuntimeError(err)) {
          return resolveFail(err.code, err.message, err.details);
        }
        return resolveFail(
          REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
          err instanceof Error ? err.message : "Participant dependency failed",
          {}
        );
      }
    }

    const adapter = selectAdapter(adapters, request.source, context);
    if (!adapter) {
      return resolveFail(
        REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_SOURCE,
        "No RegistrationAdapter supports this source",
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
      if (isRegistrationRuntimeError(err)) {
        return resolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return resolveFail(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION_MAPPING,
        err instanceof Error ? err.message : "Mapping failed",
        { adapterId: adapter.id }
      );
    }

    let registration;
    try {
      registration = normalizeAndValidateRegistration(mapped);
      assertGuestPreserved(
        {
          .../** @type {object} */ (request.source),
          __playerById: context.playerById,
        },
        registration
      );
    } catch (err) {
      if (isRegistrationRuntimeError(err)) {
        return resolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return resolveFail(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
        err instanceof Error ? err.message : "Validation failed",
        { adapterId: adapter.id }
      );
    }

    if (registration.competitionId !== request.competitionId) {
      return resolveFail(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
        "Mapped competitionId does not match request",
        {
          expected: request.competitionId,
          actual: registration.competitionId,
        }
      );
    }

    const seenPlayerKeys = batchState.seenPlayerKeys || new Set();
    try {
      detectDuplicatePlayers(registration, seenPlayerKeys);
    } catch (err) {
      if (isRegistrationRuntimeError(err)) {
        return resolveFail(err.code, err.message, err.details);
      }
      return resolveFail(
        REGISTRATION_RUNTIME_ERROR_CODE.DUPLICATE_REGISTRATION,
        err instanceof Error ? err.message : "Duplicate registration",
        {}
      );
    }

    let identity;
    try {
      identity = requireRegistrationIdentity(registration);
      identityLookup.register(registration);
    } catch (err) {
      if (isRegistrationRuntimeError(err)) {
        return resolveFail(err.code, err.message, err.details, {
          adapterId: adapter.id,
        });
      }
      return resolveFail(
        REGISTRATION_RUNTIME_ERROR_CODE.REGISTRATION_IDENTITY_COLLISION,
        err instanceof Error ? err.message : "Identity lookup failed",
        { adapterId: adapter.id }
      );
    }

    if (enablePersistence) {
      try {
        await persistence.save({
          ...registration,
          identityKey: identity.key,
        });
      } catch (err) {
        return resolveFail(
          REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
          "Persistence stub failed",
          {
            adapterId: adapter.id,
            message: err instanceof Error ? err.message : String(err),
          }
        );
      }
    }

    return resolveOk({
      registration,
      identity,
      adapterId: adapter.id,
      sourceType: registration.sourceType || adapter.sourceType,
      diagnostics: {
        persistenceEnabled: enablePersistence,
        identityKey: identity.key,
        registrationKind: registration.registrationKind,
      },
    });
  }

  /**
   * Batch resolve — preserves input ordering. Failures are per-item results.
   * @param {Array<import('./contracts/resolveRequest.js').RegistrationResolveRequest|Record<string, unknown>>} requests
   * @returns {Promise<import('./contracts/resolveResult.js').RegistrationResolveResult[]>}
   */
  async function resolveBatch(requests) {
    const list = Array.isArray(requests) ? requests : [];
    const seenPlayerKeys = new Set();
    /** @type {import('./contracts/resolveResult.js').RegistrationResolveResult[]} */
    const results = [];
    for (const req of list) {
      // Sequential await preserves order and shared duplicate-detection state.
      results.push(await resolve(req, { seenPlayerKeys }));
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
 * @param {RegistrationResolverOptions} [options]
 */
export function RegistrationResolver(options) {
  return createRegistrationResolver(options);
}
