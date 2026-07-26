/**
 * Canonical Player Rating write facade (BM-FINAL-RATING-01).
 *
 * Single public write boundary for verification / adjustment / state / history /
 * snapshot commands. Durable persistence must be composed via adapters —
 * never falls back to browser draft/local mirror stores or Competition Elo.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { isNonEmptyString, requireNonEmptyString } from "../contracts/shared.js";
import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import { verifyPlayerRating } from "../verification-adjustment/verifyPlayerRating.js";
import { adjustPlayerRating } from "../verification-adjustment/adjustPlayerRating.js";
import {
  createUnimplementedMatchResultRatingPort,
} from "../ports/matchResultRatingPort.js";
import {
  failDurableRuntimeUnavailable,
  failWriteFacade,
  PLAYER_RATING_WRITE_FACADE_PHASE,
} from "./writeFacadeErrors.js";

/**
 * @param {unknown} port
 * @param {string} portName
 * @param {string[]} methods
 */
function requireWritePortMethods(port, portName, methods) {
  if (!port || typeof port !== "object") {
    failDurableRuntimeUnavailable("compose", { portName });
  }
  for (const method of methods) {
    if (typeof /** @type {Record<string, unknown>} */ (port)[method] !== "function") {
      failDurableRuntimeUnavailable("compose", { portName, method });
    }
  }
}

/**
 * @param {unknown} playerId
 * @returns {string}
 */
function requireCanonicalPlayerId(playerId) {
  if (!isNonEmptyString(playerId)) {
    failWriteFacade(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.IDENTITY_UNRESOLVED,
      "Canonical playerId is required for Player Rating writes",
      { playerId }
    );
  }
  return String(playerId).trim();
}

/**
 * Reject alias foreign keys used as if they were the rating owner id.
 * @param {unknown} request
 */
function rejectAliasAsCanonicalFk(request) {
  if (!request || typeof request !== "object") return;
  const raw = /** @type {Record<string, unknown>} */ (request);
  const banned = ["athleteId", "memberId", "participantId", "authUserId"];
  for (const key of banned) {
    if (raw.playerId == null && raw[key] != null) {
      failWriteFacade(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_COMMAND,
        `Player Rating write rejects ${key} as canonical FK; resolve to playerId first`,
        { field: key }
      );
    }
  }
}

/**
 * Create the canonical Player Rating write facade.
 *
 * @param {{
 *   currentStateAdapter: object,
 *   historyAdapter: object,
 *   auditAdapter?: object,
 *   snapshotAdapter?: object,
 *   identityResolver?: { resolveCanonicalPlayerId: Function },
 *   matchResultPort?: object,
 *   durableRuntimeReady?: boolean,
 * }} deps
 */
export function createPlayerRatingWriteFacade(deps) {
  if (!deps || typeof deps !== "object") {
    failWriteFacade(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_COMMAND,
      "createPlayerRatingWriteFacade requires a dependency object"
    );
  }

  if (deps.durableRuntimeReady === false) {
    failDurableRuntimeUnavailable("createPlayerRatingWriteFacade", {
      reason: "durableRuntimeReady=false",
    });
  }

  const currentStateAdapter = deps.currentStateAdapter;
  const historyAdapter = deps.historyAdapter;
  const auditAdapter = deps.auditAdapter ?? null;
  const snapshotAdapter = deps.snapshotAdapter ?? null;
  const identityResolver = deps.identityResolver ?? null;
  const matchResultPort =
    deps.matchResultPort ?? createUnimplementedMatchResultRatingPort();

  requireWritePortMethods(currentStateAdapter, "currentStateAdapter", [
    "getCurrentState",
    "saveCurrentState",
    "preflightOperation",
    "getOperationRecord",
    "compareAndSetCurrentState",
  ]);
  requireWritePortMethods(historyAdapter, "historyAdapter", [
    "appendHistoryEntry",
  ]);

  const workflowDeps = {
    currentStateAdapter,
    historyAdapter,
    auditAdapter,
  };

  return Object.freeze({
    phase: PLAYER_RATING_WRITE_FACADE_PHASE,

    /**
     * @param {unknown} reference
     * @param {unknown} scope
     */
    async resolveCanonicalPlayerId(reference, scope) {
      requireExplicitPlayerRatingScope(scope);
      if (!identityResolver || typeof identityResolver.resolveCanonicalPlayerId !== "function") {
        failWriteFacade(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.IDENTITY_UNRESOLVED,
          "Canonical player identity resolver is not composed",
          { reference }
        );
      }
      return identityResolver.resolveCanonicalPlayerId(reference, scope);
    },

    /**
     * @param {string} playerId
     * @param {unknown} scope
     * @param {string} ratingMode
     */
    async getCurrentState(playerId, scope, ratingMode) {
      const id = requireCanonicalPlayerId(playerId);
      requireExplicitPlayerRatingScope(scope);
      return currentStateAdapter.getCurrentState(id, scope, ratingMode);
    },

    /**
     * Persist current state via durable adapter (CAS-aware save).
     * @param {unknown} state
     */
    async persistCurrentState(state) {
      if (!state || typeof state !== "object") {
        failWriteFacade(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_COMMAND,
          "persistCurrentState requires a state object"
        );
      }
      rejectAliasAsCanonicalFk(state);
      requireCanonicalPlayerId(/** @type {{ playerId?: unknown }} */ (state).playerId);
      try {
        return await currentStateAdapter.saveCurrentState(state);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          /** @type {{ code?: string }} */ (err).code
        ) {
          throw err;
        }
        failWriteFacade(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.PERSISTENCE_FAILED,
          "Durable current-state persistence failed",
          {
            cause:
              err instanceof Error ? err.message : String(err ?? "unknown"),
          }
        );
      }
    },

    /**
     * @param {unknown} entry
     */
    async appendHistoryEvent(entry) {
      try {
        return await historyAdapter.appendHistoryEntry(entry);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          /** @type {{ code?: string }} */ (err).code
        ) {
          throw err;
        }
        failWriteFacade(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.PERSISTENCE_FAILED,
          "Durable history append failed",
          {
            cause:
              err instanceof Error ? err.message : String(err ?? "unknown"),
          }
        );
      }
    },

    /**
     * @param {unknown} snapshot
     */
    async persistSnapshot(snapshot) {
      if (
        !snapshotAdapter ||
        typeof snapshotAdapter.createSnapshot !== "function"
      ) {
        failDurableRuntimeUnavailable("persistSnapshot", {
          reason: "snapshotAdapter not composed",
        });
      }
      try {
        return await snapshotAdapter.createSnapshot(snapshot);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          /** @type {{ code?: string }} */ (err).code
        ) {
          throw err;
        }
        failWriteFacade(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.PERSISTENCE_FAILED,
          "Durable snapshot persistence failed",
          {
            cause:
              err instanceof Error ? err.message : String(err ?? "unknown"),
          }
        );
      }
    },

    /**
     * Canonical verification command — delegates to foundation workflow.
     * @param {unknown} request
     */
    async verify(request) {
      rejectAliasAsCanonicalFk(request);
      if (!request || typeof request !== "object") {
        failWriteFacade(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_COMMAND,
          "verify requires a command object"
        );
      }
      requireCanonicalPlayerId(/** @type {{ playerId?: unknown }} */ (request).playerId);
      if (/** @type {{ actor?: unknown }} */ (request).actor == null) {
        failWriteFacade(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED,
          "verify requires actor context",
          {}
        );
      }
      const result = await verifyPlayerRating(request, workflowDeps);
      if (
        snapshotAdapter &&
        typeof snapshotAdapter.createSnapshot === "function" &&
        result?.afterState
      ) {
        const after = /** @type {Record<string, unknown>} */ (result.afterState);
        await snapshotAdapter.createSnapshot({
          snapshotId: `snap-${requireNonEmptyString(result.operationId, "operationId")}`,
          playerId: after.playerId,
          scope: after.scope,
          ratingMode: after.ratingMode,
          projectedState: after,
          sourceStateVersion: String(after.stateVersion),
          effectiveAt: after.effectiveAt ?? result.occurredAt,
          createdAt: result.occurredAt,
          correlationId: result.correlationId,
          sourceScale: after.sourceScale,
          authoritativeForPublicPlayerRating: true,
        });
      }
      return result;
    },

    /**
     * Canonical adjustment command — delegates to foundation workflow.
     * @param {unknown} request
     */
    async adjust(request) {
      rejectAliasAsCanonicalFk(request);
      if (!request || typeof request !== "object") {
        failWriteFacade(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_COMMAND,
          "adjust requires a command object"
        );
      }
      requireCanonicalPlayerId(/** @type {{ playerId?: unknown }} */ (request).playerId);
      if (/** @type {{ actor?: unknown }} */ (request).actor == null) {
        failWriteFacade(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED,
          "adjust requires actor context",
          {}
        );
      }
      if (
        !auditAdapter ||
        typeof auditAdapter.recordAdjustmentAudit !== "function"
      ) {
        failDurableRuntimeUnavailable("adjust", {
          reason: "auditAdapter not composed",
        });
      }
      const result = await adjustPlayerRating(request, workflowDeps);
      if (
        snapshotAdapter &&
        typeof snapshotAdapter.createSnapshot === "function" &&
        result?.afterState
      ) {
        const after = /** @type {Record<string, unknown>} */ (result.afterState);
        await snapshotAdapter.createSnapshot({
          snapshotId: `snap-${requireNonEmptyString(result.operationId, "operationId")}`,
          playerId: after.playerId,
          scope: after.scope,
          ratingMode: after.ratingMode,
          projectedState: after,
          sourceStateVersion: String(after.stateVersion),
          effectiveAt: after.effectiveAt ?? result.occurredAt,
          createdAt: result.occurredAt,
          correlationId: result.correlationId,
          sourceScale: after.sourceScale,
          authoritativeForPublicPlayerRating: true,
        });
      }
      return result;
    },

    /**
     * Match-result application remains fail-closed until algorithm exists.
     * @param {unknown} applicationIdentity
     * @param {unknown} [evidence]
     */
    async applyFromMatchResult(applicationIdentity, evidence) {
      return matchResultPort.applyRatingFromMatchResult(
        applicationIdentity,
        evidence
      );
    },

    /**
     * @param {unknown} reversalIdentity
     * @param {unknown} [evidence]
     */
    async reverseFromMatchResult(reversalIdentity, evidence) {
      return matchResultPort.reverseRatingApplication(
        reversalIdentity,
        evidence
      );
    },
  });
}
