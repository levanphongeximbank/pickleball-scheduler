/**
 * Read-only Player Rating facade (Phase 1H).
 * Composes Phase 1C candidate collection + Phase 1D history/snapshot reads.
 * No write API, no winner selection, no scale conversion, no runtime SSOT.
 */

import {
  requireSupportedRatingMode,
} from "../contracts/ratingModes.js";
import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import {
  clonePlain,
  deepFreeze,
  isNonEmptyString,
  requireNonEmptyString,
} from "../contracts/shared.js";
import { collectRatingCandidates } from "../read-model/collectRatingCandidates.js";
import { buildPlayerRatingOverview } from "./buildPlayerRatingOverview.js";
import {
  failReadFacade,
  PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE,
} from "./readFacadeErrors.js";

/** @typedef {import('../read-model/currentStateCandidate.js').PlayerRatingCurrentStateCandidate} PlayerRatingCurrentStateCandidate */

/**
 * @param {unknown} port
 * @param {string} portName
 * @param {string[]} methods
 */
function requireReadPortMethods(port, portName, methods) {
  if (!port || typeof port !== "object") {
    failReadFacade(
      PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
      `${portName} is required for the read facade`,
      { portName }
    );
  }
  for (const method of methods) {
    if (typeof /** @type {Record<string, unknown>} */ (port)[method] !== "function") {
      failReadFacade(
        PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
        `${portName} must implement read operation: ${method}`,
        { portName, method }
      );
    }
  }
}

/**
 * @param {unknown} sourceRecords
 * @param {Record<string, unknown>} [options]
 */
function toCollectorInput(sourceRecords, options = {}) {
  if (Array.isArray(sourceRecords)) {
    return {
      sources: sourceRecords,
      ...options,
    };
  }

  if (
    sourceRecords &&
    typeof sourceRecords === "object" &&
    (Array.isArray(/** @type {{ sources?: unknown }} */ (sourceRecords).sources) ||
      Array.isArray(/** @type {{ records?: unknown }} */ (sourceRecords).records))
  ) {
    return {
      .../** @type {Record<string, unknown>} */ (sourceRecords),
      ...options,
    };
  }

  failReadFacade(
    PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.INVALID_SOURCE_RECORD,
    "collectCandidates requires a sourceRecords array or collector input object",
    { sourceRecords }
  );
}

/**
 * @param {unknown} playerId
 * @returns {string}
 */
function requireCanonicalPlayerId(playerId) {
  if (!isNonEmptyString(playerId)) {
    failReadFacade(
      PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
      "Canonical playerId is required and must be a non-empty string",
      { playerId }
    );
  }
  return String(playerId).trim();
}

/**
 * Create a read-only Player Rating facade.
 *
 * @param {{
 *   historyPort: {
 *     listHistory: Function,
 *     getHistoryEntry: Function,
 *   },
 *   snapshotPort: {
 *     getSnapshot: Function,
 *     listSnapshots: Function,
 *   },
 * }} deps
 */
export function createPlayerRatingReadFacade(deps) {
  if (!deps || typeof deps !== "object") {
    failReadFacade(
      PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.INVALID_RATING_CONTRACT,
      "createPlayerRatingReadFacade requires a dependency object"
    );
  }

  const historyPort = deps.historyPort;
  const snapshotPort = deps.snapshotPort;

  requireReadPortMethods(historyPort, "historyPort", [
    "listHistory",
    "getHistoryEntry",
  ]);
  requireReadPortMethods(snapshotPort, "snapshotPort", [
    "getSnapshot",
    "listSnapshots",
  ]);

  /**
   * @param {unknown} sourceRecords
   * @param {Record<string, unknown>} [options]
   */
  function collectCandidates(sourceRecords, options = {}) {
    const input = toCollectorInput(sourceRecords, options);
    // Fail closed: overview/candidate reads require explicit scope on the request.
    requireExplicitPlayerRatingScope(input.scope);
    return collectRatingCandidates(input);
  }

  /**
   * @param {unknown} candidateId
   * @param {unknown} sourceRecords
   * @param {Record<string, unknown>} [options]
   */
  function getCandidate(candidateId, sourceRecords, options = {}) {
    const id = requireNonEmptyString(candidateId, "candidateId");
    const collection = collectCandidates(sourceRecords, options);
    const found = collection.candidates.find((c) => c.candidateId === id);
    return found == null ? null : found;
  }

  /**
   * @param {unknown} sourceRecords
   * @param {Record<string, unknown>} [options]
   */
  function listCandidates(sourceRecords, options = {}) {
    return collectCandidates(sourceRecords, options).candidates;
  }

  /**
   * @param {{ playerId: unknown, scope: unknown, ratingMode?: unknown }} query
   */
  async function listHistory(query) {
    if (!query || typeof query !== "object") {
      failReadFacade(
        PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.INVALID_RATING_CONTRACT,
        "listHistory requires a query object"
      );
    }
    const playerId = requireCanonicalPlayerId(query.playerId);
    const scope = requireExplicitPlayerRatingScope(query.scope);
    /** @type {{ ratingMode?: string }} */
    const options = {};
    if (query.ratingMode != null) {
      options.ratingMode = requireSupportedRatingMode(query.ratingMode);
    }
    const entries = await historyPort.listHistory(playerId, scope, options);
    return deepFreeze(clonePlain(entries));
  }

  /**
   * @param {unknown} eventId
   */
  async function getHistoryEntry(eventId) {
    const id = requireNonEmptyString(eventId, "eventId");
    const entry = await historyPort.getHistoryEntry(id);
    return deepFreeze(clonePlain(entry));
  }

  /**
   * @param {{ playerId: unknown, scope: unknown, ratingMode?: unknown }} query
   */
  async function listSnapshots(query) {
    if (!query || typeof query !== "object") {
      failReadFacade(
        PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.INVALID_RATING_CONTRACT,
        "listSnapshots requires a query object"
      );
    }
    const playerId = requireCanonicalPlayerId(query.playerId);
    const scope = requireExplicitPlayerRatingScope(query.scope);
    /** @type {{ ratingMode?: string }} */
    const options = {};
    if (query.ratingMode != null) {
      options.ratingMode = requireSupportedRatingMode(query.ratingMode);
    }
    const snapshots = await snapshotPort.listSnapshots(playerId, scope, options);
    return deepFreeze(clonePlain(snapshots));
  }

  /**
   * @param {unknown} snapshotId
   * @param {unknown} [scope]
   */
  async function getSnapshot(snapshotId, scope) {
    const id = requireNonEmptyString(snapshotId, "snapshotId");
    const snapshot =
      scope === undefined
        ? await snapshotPort.getSnapshot(id)
        : await snapshotPort.getSnapshot(id, scope);
    return deepFreeze(clonePlain(snapshot));
  }

  /**
   * @param {unknown} input
   */
  async function getPlayerRatingOverview(input) {
    if (!input || typeof input !== "object") {
      failReadFacade(
        PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE.INVALID_RATING_CONTRACT,
        "getPlayerRatingOverview input must be an object"
      );
    }

    const raw = /** @type {Record<string, unknown>} */ (input);
    const scope = requireExplicitPlayerRatingScope(raw.scope);

    if (raw.ratingMode != null) {
      requireSupportedRatingMode(raw.ratingMode);
    }

    if (raw.playerId != null && raw.playerId !== "") {
      requireCanonicalPlayerId(raw.playerId);
    }

    const sourceRecords =
      raw.sourceRecords ?? raw.sources ?? raw.records ?? [];

    const collection = collectCandidates(sourceRecords, {
      scope,
      failClosedOnIdentityConflict: raw.failClosedOnIdentityConflict,
      ...(raw.ratingMode != null ? {} : {}),
    });

    let history = /** @type {unknown[]} */ ([]);
    let snapshots = /** @type {unknown[]} */ ([]);

    if (isNonEmptyString(raw.playerId)) {
      const query = {
        playerId: String(raw.playerId).trim(),
        scope,
        ...(raw.ratingMode != null ? { ratingMode: raw.ratingMode } : {}),
      };
      history = /** @type {unknown[]} */ (await listHistory(query));
      snapshots = /** @type {unknown[]} */ (await listSnapshots(query));
    }

    return buildPlayerRatingOverview({
      playerId: raw.playerId,
      scope,
      ratingMode: raw.ratingMode,
      collection,
      history,
      snapshots,
    });
  }

  return Object.freeze({
    collectCandidates,
    getCandidate,
    listCandidates,
    listHistory,
    getHistoryEntry,
    listSnapshots,
    getSnapshot,
    getPlayerRatingOverview,
  });
}
