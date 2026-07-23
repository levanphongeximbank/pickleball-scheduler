/**
 * In-memory RatingAdjustmentAuditPort adapter (foundation/test only).
 * Append-only. Caller-supplied IDs/timestamps only.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createRatingAdjustmentAuditContract } from "../contracts/adjustmentContract.js";
import { requireSupportedRatingMode } from "../contracts/ratingModes.js";
import {
  clonePlain,
  deepFreeze,
  failContract,
  requireNonEmptyString,
  requireValidTimestamp,
} from "../contracts/shared.js";
import { matchesRatingAdjustmentAuditPort } from "../ports/ratingAdjustmentAuditPort.js";
import {
  compareHistoryEntriesAscending,
  sortDeterministically,
} from "../history-snapshot/ordering.js";
import { requireQueryScope, scopesMatch } from "../history-snapshot/scopeMatch.js";

/**
 * @typedef {Readonly<{
 *   auditId: string,
 *   operationId: string,
 *   playerId: string,
 *   scope: import('../contracts/scopeContract.js').PlayerRatingScope,
 *   ratingMode: 'overall'|'singles'|'doubles',
 *   actorId: string,
 *   reason: string,
 *   beforeState: unknown,
 *   afterState: unknown,
 *   occurredAt: string|number,
 *   correlationId: string,
 * }>} StoredAdjustmentAuditEntry
 */

/**
 * @param {unknown} input
 * @returns {StoredAdjustmentAuditEntry}
 */
export function buildStoredAdjustmentAuditEntry(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "adjustmentAudit");
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const operationId = requireNonEmptyString(raw.operationId, "operationId");
  const correlationId = requireNonEmptyString(raw.correlationId, "correlationId");
  const occurredAt = requireValidTimestamp(
    raw.occurredAt ?? raw.adjustedAt,
    "occurredAt"
  );
  const ratingMode = requireSupportedRatingMode(raw.ratingMode);

  const contract = createRatingAdjustmentAuditContract({
    auditId: raw.auditId,
    playerId: raw.playerId,
    scope: raw.scope ?? raw.tenantId,
    ratingMode,
    actorId: raw.actorId,
    reason: raw.reason,
    beforeState: raw.beforeState,
    afterState: raw.afterState,
    adjustedAt: occurredAt,
    correlationId,
  });

  return /** @type {StoredAdjustmentAuditEntry} */ (
    deepFreeze({
      auditId: contract.auditId,
      operationId,
      playerId: contract.playerId,
      scope: clonePlain(contract.scope),
      ratingMode,
      actorId: contract.actorId,
      reason: contract.reason,
      beforeState: clonePlain(contract.beforeState),
      afterState: clonePlain(contract.afterState),
      occurredAt,
      correlationId,
    })
  );
}

/**
 * @returns {import('../ports/ratingAdjustmentAuditPort.js').RatingAdjustmentAuditPort & {
 *   listAdjustmentAudits: (playerId: string, scope: unknown, options?: { ratingMode?: string }) => Promise<StoredAdjustmentAuditEntry[]>,
 *   getAdjustmentAuditById: (auditId: string) => Promise<StoredAdjustmentAuditEntry>,
 *   hasAuditOperationId: (operationId: string) => boolean,
 *   hasAuditId: (auditId: string) => boolean,
 *   updateAdjustmentAudit: () => Promise<never>,
 *   deleteAdjustmentAudit: () => Promise<never>,
 * }}
 */
export function createInMemoryRatingAdjustmentAuditAdapter() {
  /** @type {Map<string, StoredAdjustmentAuditEntry>} */
  const byAuditId = new Map();
  /** @type {Map<string, string>} */
  const operationIdToAuditId = new Map();

  const adapter = {
    async recordAdjustmentAudit(auditInput) {
      const entry = buildStoredAdjustmentAuditEntry(auditInput);
      if (byAuditId.has(entry.auditId)) {
        failContract(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.ADJUSTMENT_AUDIT_DUPLICATE,
          `Duplicate auditId: ${entry.auditId}`,
          { auditId: entry.auditId }
        );
      }
      if (operationIdToAuditId.has(entry.operationId)) {
        failContract(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.ADJUSTMENT_AUDIT_DUPLICATE,
          `Duplicate audit operationId: ${entry.operationId}`,
          { operationId: entry.operationId }
        );
      }
      byAuditId.set(entry.auditId, entry);
      operationIdToAuditId.set(entry.operationId, entry.auditId);
      return entry;
    },

    async getAdjustmentAuditById(auditId) {
      const id = requireNonEmptyString(auditId, "auditId");
      const entry = byAuditId.get(id);
      if (!entry) {
        failContract(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
          `Adjustment audit not found: ${id}`,
          { auditId: id }
        );
      }
      return entry;
    },

    async listAdjustmentAudits(playerId, scope, options = {}) {
      const canonicalPlayerId = requireNonEmptyString(playerId, "playerId");
      const queryScope = requireQueryScope(scope);
      const modeFilter =
        options && options.ratingMode != null
          ? requireSupportedRatingMode(options.ratingMode)
          : null;

      /** @type {StoredAdjustmentAuditEntry[]} */
      const matched = [];
      for (const entry of byAuditId.values()) {
        if (entry.playerId !== canonicalPlayerId) continue;
        if (!scopesMatch(entry.scope, queryScope)) continue;
        if (modeFilter != null && entry.ratingMode !== modeFilter) continue;
        matched.push(entry);
      }

      return sortDeterministically(matched, (a, b) =>
        compareHistoryEntriesAscending(
          {
            effectiveAt: a.occurredAt,
            recordedAt: a.occurredAt,
            eventId: a.auditId,
          },
          {
            effectiveAt: b.occurredAt,
            recordedAt: b.occurredAt,
            eventId: b.auditId,
          }
        )
      );
    },

    hasAuditOperationId(operationId) {
      return operationIdToAuditId.has(String(operationId));
    },

    hasAuditId(auditId) {
      return byAuditId.has(String(auditId));
    },

    async updateAdjustmentAudit() {
      failContract(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_MUTATION_FORBIDDEN,
        "Adjustment audit is append-only; update is forbidden",
        { field: "update" }
      );
    },

    async deleteAdjustmentAudit() {
      failContract(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_MUTATION_FORBIDDEN,
        "Adjustment audit is append-only; delete is forbidden",
        { field: "delete" }
      );
    },
  };

  if (!matchesRatingAdjustmentAuditPort(adapter)) {
    throw new Error(
      "In-memory adjustment audit adapter does not match RatingAdjustmentAuditPort"
    );
  }

  return adapter;
}
