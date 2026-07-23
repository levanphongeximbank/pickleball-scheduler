/**
 * Immutable rating snapshot service (Phase 1D).
 * Caller-supplied IDs/timestamps only. No scale conversion or SSOT selection.
 */

import { createRatingCurrentStateContract } from "../contracts/currentStateContract.js";
import { createRatingSnapshotContract } from "../contracts/snapshotContract.js";
import { assertSnapshotImmutable } from "../contracts/snapshotContract.js";
import { requireSupportedRatingMode } from "../contracts/ratingModes.js";
import {
  clonePlain,
  deepFreeze,
  failContract,
  isNonEmptyString,
  requireNonEmptyString,
  requireValidTimestamp,
} from "../contracts/shared.js";
import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { PLAYER_ID_RESOLUTION_STATUS } from "../read-model/sourceTypes.js";
import {
  compareSnapshotsAscending,
  sortDeterministically,
} from "./ordering.js";
import { requireQueryScope, scopesMatch } from "./scopeMatch.js";

/**
 * @typedef {Readonly<{
 *   snapshotId: string,
 *   playerId: string,
 *   scope: import('../contracts/scopeContract.js').PlayerRatingScope,
 *   ratingMode: 'overall'|'singles'|'doubles',
 *   ratingValue?: unknown,
 *   projectedState?: unknown,
 *   sourceStateVersion: string,
 *   effectiveAt: string|number,
 *   createdAt: string|number,
 *   correlationId?: string,
 *   sourceScale?: string,
 *   sourceMetadata?: Readonly<Record<string, unknown>>,
 *   authoritativeForPublicPlayerRating?: boolean,
 * }>} StoredRatingSnapshot
 */

/**
 * @param {unknown} candidate
 */
function assertCanonicalCandidateIdentity(candidate) {
  const raw = /** @type {Record<string, unknown>} */ (candidate);
  if (!isNonEmptyString(raw.playerId)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
      "Snapshot from candidate requires resolved canonical playerId",
      { playerId: raw.playerId }
    );
  }

  const status = raw.playerIdResolutionStatus;
  if (
    status != null &&
    String(status).trim() !== "" &&
    String(status).trim() !== PLAYER_ID_RESOLUTION_STATUS.RESOLVED
  ) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
      "Snapshot rejects alias promotion to canonical identity",
      { playerIdResolutionStatus: status }
    );
  }

  if (Array.isArray(raw.aliases) && raw.aliases.length > 0) {
    const playerId = String(raw.playerId).trim();
    for (const alias of raw.aliases) {
      if (
        alias &&
        typeof alias === "object" &&
        isNonEmptyString(/** @type {{ value?: unknown }} */ (alias).value) &&
        String(/** @type {{ value: string }} */ (alias).value).trim() ===
          playerId &&
        status !== PLAYER_ID_RESOLUTION_STATUS.RESOLVED
      ) {
        failContract(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
          "Snapshot rejects alias value used as canonical playerId",
          { playerId, alias }
        );
      }
    }
  }
}

/**
 * Build a stored snapshot from direct fields, Phase 1B current state, or Phase 1C candidate.
 *
 * @param {unknown} input
 * @returns {StoredRatingSnapshot}
 */
export function buildStoredSnapshot(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "snapshot");
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const snapshotId = requireNonEmptyString(raw.snapshotId, "snapshotId");
  const createdAt = requireValidTimestamp(raw.createdAt, "createdAt");

  /** @type {Record<string, unknown>} */
  let contractInput;

  if (raw.currentState != null) {
    const state = createRatingCurrentStateContract(raw.currentState);
    const sourceStateVersion = requireNonEmptyString(
      raw.sourceStateVersion ?? state.lastEventId ?? state.algorithmVersion,
      "sourceStateVersion"
    );
    contractInput = {
      snapshotId,
      playerId: state.playerId,
      scope: state.scope,
      ratingMode: state.ratingMode,
      projectedState: clonePlain(state),
      sourceStateVersion,
      effectiveAt: state.effectiveAt,
      createdAt,
    };
    if (raw.correlationId != null) {
      contractInput.correlationId = raw.correlationId;
    }
    if ("ratingValue" in raw) {
      contractInput.ratingValue = raw.ratingValue;
    }
  } else if (raw.candidate != null) {
    if (!raw.candidate || typeof raw.candidate !== "object") {
      failContract(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
        "Snapshot candidate must be an object",
        { field: "candidate" }
      );
    }
    assertCanonicalCandidateIdentity(raw.candidate);
    const candidate = /** @type {Record<string, unknown>} */ (raw.candidate);
    const scope =
      candidate.scope != null
        ? candidate.scope
        : candidate.tenantId != null
          ? { kind: "tenant", tenantId: candidate.tenantId }
          : raw.scope;

    const sourceStateVersion = requireNonEmptyString(
      raw.sourceStateVersion ?? candidate.candidateId,
      "sourceStateVersion"
    );
    const effectiveAt = requireValidTimestamp(
      raw.effectiveAt ?? candidate.effectiveAt,
      "effectiveAt"
    );

    contractInput = {
      snapshotId,
      playerId: candidate.playerId,
      scope,
      ratingMode: requireSupportedRatingMode(
        candidate.ratingMode ?? raw.ratingMode ?? "overall"
      ),
      projectedState: clonePlain(candidate),
      sourceStateVersion,
      effectiveAt,
      createdAt,
    };
    if (raw.correlationId != null) {
      contractInput.correlationId = raw.correlationId;
    }
    if ("ratingValue" in raw) {
      contractInput.ratingValue = raw.ratingValue;
    }
  } else {
    if (!isNonEmptyString(raw.playerId)) {
      failContract(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
        "Snapshot requires a non-empty canonical playerId",
        { playerId: raw.playerId }
      );
    }
    if (
      raw.playerIdResolutionStatus != null &&
      String(raw.playerIdResolutionStatus).trim() !== "" &&
      String(raw.playerIdResolutionStatus).trim() !==
        PLAYER_ID_RESOLUTION_STATUS.RESOLVED
    ) {
      failContract(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
        "Snapshot rejects alias promotion to canonical identity",
        { playerIdResolutionStatus: raw.playerIdResolutionStatus }
      );
    }
    contractInput = {
      snapshotId,
      playerId: raw.playerId,
      scope: raw.scope ?? raw.tenantId,
      ratingMode: raw.ratingMode,
      sourceStateVersion: raw.sourceStateVersion,
      effectiveAt: raw.effectiveAt,
      createdAt,
    };
    if ("ratingValue" in raw) contractInput.ratingValue = raw.ratingValue;
    if ("projectedState" in raw) {
      contractInput.projectedState = raw.projectedState;
    }
    if (raw.correlationId != null) {
      contractInput.correlationId = raw.correlationId;
    }
  }

  const contract = createRatingSnapshotContract(contractInput);

  /** @type {Record<string, unknown>} */
  const stored = {
    snapshotId: contract.snapshotId,
    playerId: contract.playerId,
    scope: clonePlain(contract.scope),
    ratingMode: contract.ratingMode,
    sourceStateVersion: contract.sourceStateVersion,
    effectiveAt: contract.effectiveAt,
    createdAt: contract.createdAt,
  };

  if ("ratingValue" in contract) {
    stored.ratingValue = clonePlain(contract.ratingValue);
  }
  if ("projectedState" in contract) {
    stored.projectedState = clonePlain(contract.projectedState);
  }
  if (contract.correlationId != null) {
    stored.correlationId = contract.correlationId;
  }

  if (raw.sourceScale != null) {
    stored.sourceScale = requireNonEmptyString(raw.sourceScale, "sourceScale");
  } else if (
    raw.candidate &&
    typeof raw.candidate === "object" &&
    isNonEmptyString(
      /** @type {{ sourceScale?: unknown }} */ (raw.candidate).sourceScale
    )
  ) {
    stored.sourceScale = String(
      /** @type {{ sourceScale: string }} */ (raw.candidate).sourceScale
    ).trim();
  }

  if (raw.sourceMetadata != null && typeof raw.sourceMetadata === "object") {
    stored.sourceMetadata = clonePlain(raw.sourceMetadata);
  } else if (
    raw.candidate &&
    typeof raw.candidate === "object" &&
    /** @type {{ rawSourceMetadata?: unknown }} */ (raw.candidate)
      .rawSourceMetadata &&
    typeof /** @type {{ rawSourceMetadata?: unknown }} */ (raw.candidate)
      .rawSourceMetadata === "object"
  ) {
    stored.sourceMetadata = clonePlain(
      /** @type {{ rawSourceMetadata: object }} */ (raw.candidate)
        .rawSourceMetadata
    );
  } else if (raw.currentState && typeof raw.currentState === "object") {
    const state = /** @type {Record<string, unknown>} */ (raw.currentState);
    stored.sourceMetadata = clonePlain({
      source: state.source,
      status: state.status,
      algorithmVersion: state.algorithmVersion ?? null,
      lastEventId: state.lastEventId ?? null,
    });
  }

  if (typeof raw.authoritativeForPublicPlayerRating === "boolean") {
    stored.authoritativeForPublicPlayerRating =
      raw.authoritativeForPublicPlayerRating;
  } else if (
    raw.candidate &&
    typeof raw.candidate === "object" &&
    typeof /** @type {{ authoritativeForPublicPlayerRating?: unknown }} */ (
      raw.candidate
    ).authoritativeForPublicPlayerRating === "boolean"
  ) {
    stored.authoritativeForPublicPlayerRating =
      /** @type {{ authoritativeForPublicPlayerRating: boolean }} */ (
        raw.candidate
      ).authoritativeForPublicPlayerRating;
  } else {
    stored.authoritativeForPublicPlayerRating = false;
  }

  return /** @type {StoredRatingSnapshot} */ (deepFreeze(stored));
}

/**
 * @param {{ bySnapshotId: Map<string, StoredRatingSnapshot> }} store
 * @param {unknown} input
 * @returns {StoredRatingSnapshot}
 */
export function createRatingSnapshot(store, input) {
  const snapshot = buildStoredSnapshot(input);
  if (store.bySnapshotId.has(snapshot.snapshotId)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_DUPLICATE,
      `Duplicate snapshotId: ${snapshot.snapshotId}`,
      { snapshotId: snapshot.snapshotId }
    );
  }
  store.bySnapshotId.set(snapshot.snapshotId, snapshot);
  return snapshot;
}

/**
 * @param {{ bySnapshotId: Map<string, StoredRatingSnapshot> }} store
 * @param {unknown} snapshotId
 * @returns {StoredRatingSnapshot}
 */
export function getRatingSnapshotById(store, snapshotId) {
  const id = requireNonEmptyString(snapshotId, "snapshotId");
  const snapshot = store.bySnapshotId.get(id);
  if (!snapshot) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.SNAPSHOT_NOT_FOUND,
      `Snapshot not found: ${id}`,
      { snapshotId: id }
    );
  }
  return snapshot;
}

/**
 * @param {{ bySnapshotId: Map<string, StoredRatingSnapshot> }} store
 * @param {unknown} playerId
 * @param {unknown} scope
 * @param {{ ratingMode?: string }} [options]
 * @returns {StoredRatingSnapshot[]}
 */
export function listRatingSnapshots(store, playerId, scope, options = {}) {
  const canonicalPlayerId = requireNonEmptyString(playerId, "playerId");
  const queryScope = requireQueryScope(scope);
  const modeFilter =
    options && options.ratingMode != null
      ? requireSupportedRatingMode(options.ratingMode)
      : null;

  /** @type {StoredRatingSnapshot[]} */
  const matched = [];
  for (const snapshot of store.bySnapshotId.values()) {
    if (snapshot.playerId !== canonicalPlayerId) continue;
    if (!scopesMatch(snapshot.scope, queryScope)) continue;
    if (modeFilter != null && snapshot.ratingMode !== modeFilter) continue;
    matched.push(snapshot);
  }

  return sortDeterministically(matched, compareSnapshotsAscending);
}

/**
 * @param {string} field
 * @returns {never}
 */
export function rejectSnapshotMutation(field = "unknown") {
  assertSnapshotImmutable(/** @type {any} */ ({ snapshotId: null }), field);
}
