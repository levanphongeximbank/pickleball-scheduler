/**
 * Coaching runtime factory (COACHING-04).
 *
 * Explicit mode only — never auto-switch from durable failure to legacy success.
 * Resolvers are injected; adapters do not read process.env.
 */

import {
  COACHING_RUNTIME_MODE,
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
  COACHING_04_PHASE,
  COACHING_04_PLAYER_SELF_SCOPE_STATUS,
} from "./constants.js";
import {
  createCoachingRuntimeError,
  COACHING_RUNTIME_ERROR_CODES,
} from "./errors.js";
import { createLegacyCoachingAdapter } from "./createLegacyCoachingAdapter.js";
import { createDurableCoachingAdapter } from "./createDurableCoachingAdapter.js";
import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import { isCoachingError } from "../errors/CoachingError.js";
import { emitCoachingLegacyTelemetry } from "./legacyTelemetry.js";
import {
  resolveCoachingPlayerSelfScope,
  assertCoachingPlayerDurableWriteAllowed,
  classifyCoachingDurableCollectionResult,
} from "./playerSelfScope.js";

/**
 * @param {unknown} err
 */
function mapRuntimePersistenceError(err) {
  if (isCoachingError(err)) {
    if (
      err.code === COACHING_ERROR_CODES.VERSION_CONFLICT ||
      err.code === COACHING_ERROR_CODES.CONFLICT
    ) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.CONCURRENCY_CONFLICT,
        err.message || "Coaching concurrency conflict.",
        err.context
      );
    }
    if (
      err.code === COACHING_ERROR_CODES.UNAUTHORIZED ||
      err.code === COACHING_ERROR_CODES.FORBIDDEN_ACTION ||
      err.code === COACHING_ERROR_CODES.FORBIDDEN_SCOPE
    ) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED,
        err.message || "Coaching authorization denied.",
        err.context
      );
    }
    if (err.code === COACHING_ERROR_CODES.MISSING_ACTOR) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.MISSING_ACTOR,
        err.message || "Missing actor."
      );
    }
    if (err.code === COACHING_ERROR_CODES.MISSING_SCOPE) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE,
        err.message || "Missing scope."
      );
    }
  }
  if (
    err?.code === "CONCURRENCY_CONFLICT" ||
    /expectedVersion|VERSION_CONFLICT/i.test(String(err?.message || ""))
  ) {
    return createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.CONCURRENCY_CONFLICT,
      err?.message || "Coaching concurrency conflict."
    );
  }
  return createCoachingRuntimeError(
    COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
    err?.message || "Coaching runtime operation failed."
  );
}

/**
 * @param {{
 *   mode?: string,
 *   databaseClient?: object|null,
 *   resolveTenantClub?: (clubId: string) => { tenantId?: string, clubId?: string, venueId?: string|null }|null,
 *   resolveActor?: () => { actorId?: string, principalId?: string }|null,
 *   applicationService?: object|null,
 *   requirePlayerSelfScope?: boolean,
 *   resolvePlayerSelfScope?: typeof resolveCoachingPlayerSelfScope,
 * }} [options]
 */
export function createCoachingRuntime(options = {}) {
  const explicitMode = options.mode;
  const mode =
    explicitMode != null && String(explicitMode).trim() !== ""
      ? String(explicitMode)
      : COACHING_DURABLE_RUNTIME_DEFAULT
        ? COACHING_RUNTIME_MODE.DURABLE
        : COACHING_RUNTIME_MODE.LEGACY;

  const databaseClient = options.databaseClient ?? null;
  const resolveTenantClub =
    typeof options.resolveTenantClub === "function"
      ? options.resolveTenantClub
      : null;
  const resolveActor =
    typeof options.resolveActor === "function" ? options.resolveActor : null;
  const applicationService = options.applicationService ?? null;
  const requirePlayerSelfScope = options.requirePlayerSelfScope === true;
  const resolvePlayerSelfScopeFn =
    typeof options.resolvePlayerSelfScope === "function"
      ? options.resolvePlayerSelfScope
      : resolveCoachingPlayerSelfScope;

  const legacyAdapter =
    mode === COACHING_RUNTIME_MODE.LEGACY
      ? createLegacyCoachingAdapter()
      : null;

  const isDurable = mode === COACHING_RUNTIME_MODE.DURABLE;
  const isLegacy = mode === COACHING_RUNTIME_MODE.LEGACY;

  function getStatus() {
    return Object.freeze({
      mode,
      isDurable,
      isLegacy,
      phase: COACHING_04_PHASE,
      durableRuntimeDefault: COACHING_DURABLE_RUNTIME_DEFAULT,
      localStorageRetired: LOCALSTORAGE_RETIRED,
      playerSelfScopeStatus: COACHING_04_PLAYER_SELF_SCOPE_STATUS,
      requirePlayerSelfScope,
      hasApplicationService: Boolean(applicationService),
      hasDatabaseClient: Boolean(databaseClient),
    });
  }

  /**
   * Resolve durable deps or return a fail-closed result (never legacy).
   */
  function resolveDurableAdapter(clubId) {
    if (!resolveTenantClub || !resolveActor) {
      return {
        error: createCoachingRuntimeError(
          COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
          "Durable mode requires resolveTenantClub and resolveActor injectors."
        ),
      };
    }
    const scope = resolveTenantClub(clubId) || {};
    const tenantId = String(scope.tenantId || "").trim();
    const resolvedClubId = String(scope.clubId || clubId || "").trim();
    if (!tenantId || !resolvedClubId) {
      return {
        error: createCoachingRuntimeError(
          COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE,
          "Durable coaching requires tenantId and clubId; fail closed."
        ),
      };
    }
    const actor = resolveActor() || {};
    const actorId = String(actor.actorId || actor.principalId || "").trim();
    if (!actorId) {
      return {
        error: createCoachingRuntimeError(
          COACHING_RUNTIME_ERROR_CODES.MISSING_ACTOR,
          "Durable coaching requires an authenticated actor; fail closed."
        ),
      };
    }
    return {
      tenantId,
      clubId: resolvedClubId,
      adapter: createDurableCoachingAdapter({
        databaseClient,
        tenantId,
        clubId: resolvedClubId,
        actorId,
        applicationService,
      }),
    };
  }

  async function resolvePlayerScopeIfRequired(tenantId, clubId) {
    if (!requirePlayerSelfScope) return { ok: true, skipped: true };
    return resolvePlayerSelfScopeFn({ tenantId, clubId });
  }

  async function listCollection(name, clubId) {
    if (mode === COACHING_RUNTIME_MODE.UNAVAILABLE) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
        "Coaching runtime mode is unavailable."
      );
    }
    if (isLegacy) {
      emitCoachingLegacyTelemetry(clubId, "legacy_read", { collection: name });
      return legacyAdapter.list(name, clubId);
    }
    if (isDurable) {
      try {
        const resolved = resolveDurableAdapter(clubId);
        if (resolved.error) {
          emitCoachingLegacyTelemetry(clubId, "silent_fallback_blocked", {
            collection: name,
            reason: resolved.error.code,
          });
          return resolved.error;
        }
        const playerScope = await resolvePlayerScopeIfRequired(
          resolved.tenantId,
          resolved.clubId
        );
        if (playerScope && playerScope.ok === false) {
          return {
            ...playerScope.error,
            details: {
              ...(playerScope.error?.details || {}),
              playerScopeState: playerScope.state,
              mappingStatus: playerScope.status,
            },
          };
        }
        const listResult = await resolved.adapter.list(name, clubId);
        if (!listResult || listResult.ok !== true) {
          emitCoachingLegacyTelemetry(clubId, "silent_fallback_blocked", {
            collection: name,
            reason: listResult?.code || "durable_list_failed",
          });
        }
        const classified = classifyCoachingDurableCollectionResult(
          listResult,
          playerScope?.skipped ? null : playerScope
        );
        if (classified.error && classified.state !== "EMPTY") {
          return {
            ...classified.error,
            details: {
              ...(classified.error.details || {}),
              playerScopeState: classified.state,
            },
          };
        }
        return {
          ok: true,
          data: classified.rows,
          provenance: "durable",
          state: classified.state,
          empty: classified.empty,
        };
      } catch (err) {
        emitCoachingLegacyTelemetry(clubId, "silent_fallback_blocked", {
          collection: name,
          reason: "durable_exception",
        });
        return mapRuntimePersistenceError(err);
      }
    }
    return createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
      `Unsupported coaching runtime mode: ${mode}`
    );
  }

  async function saveCollection(name, clubId, row) {
    if (mode === COACHING_RUNTIME_MODE.UNAVAILABLE) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
        "Coaching runtime mode is unavailable."
      );
    }
    if (isLegacy) {
      emitCoachingLegacyTelemetry(clubId, "legacy_write", { collection: name });
      return legacyAdapter.save(name, clubId, row);
    }
    if (isDurable) {
      try {
        const resolved = resolveDurableAdapter(clubId);
        if (resolved.error) {
          emitCoachingLegacyTelemetry(clubId, "silent_fallback_blocked", {
            collection: name,
            reason: resolved.error.code,
          });
          return resolved.error;
        }
        if (requirePlayerSelfScope) {
          const playerScope = await resolvePlayerScopeIfRequired(
            resolved.tenantId,
            resolved.clubId
          );
          const writeGate = assertCoachingPlayerDurableWriteAllowed(playerScope);
          return writeGate;
        }
        return await resolved.adapter.save(name, clubId, row);
      } catch (err) {
        emitCoachingLegacyTelemetry(clubId, "silent_fallback_blocked", {
          collection: name,
          reason: "durable_exception",
        });
        return mapRuntimePersistenceError(err);
      }
    }
    return createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
      `Unsupported coaching runtime mode: ${mode}`
    );
  }

  async function deleteCollection(name, clubId, id) {
    if (mode === COACHING_RUNTIME_MODE.UNAVAILABLE) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
        "Coaching runtime mode is unavailable."
      );
    }
    if (isLegacy) {
      emitCoachingLegacyTelemetry(clubId, "legacy_write", {
        collection: name,
        op: "delete",
      });
      return legacyAdapter.delete(name, clubId, id);
    }
    if (isDurable) {
      try {
        const resolved = resolveDurableAdapter(clubId);
        if (resolved.error) {
          emitCoachingLegacyTelemetry(clubId, "silent_fallback_blocked", {
            collection: name,
            reason: resolved.error.code,
          });
          return resolved.error;
        }
        if (requirePlayerSelfScope) {
          const playerScope = await resolvePlayerScopeIfRequired(
            resolved.tenantId,
            resolved.clubId
          );
          return assertCoachingPlayerDurableWriteAllowed(playerScope);
        }
        return await resolved.adapter.delete(name, clubId, id);
      } catch (err) {
        emitCoachingLegacyTelemetry(clubId, "silent_fallback_blocked", {
          collection: name,
          reason: "durable_exception",
        });
        return mapRuntimePersistenceError(err);
      }
    }
    return createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
      `Unsupported coaching runtime mode: ${mode}`
    );
  }

  return Object.freeze({
    mode,
    isDurable,
    isLegacy,
    listCollection,
    saveCollection,
    deleteCollection,
    getStatus,
    resolvePlayerSelfScope: resolvePlayerSelfScopeFn,
  });
}
