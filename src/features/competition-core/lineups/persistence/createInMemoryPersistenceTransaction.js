/**
 * CORE-06 Phase 1F — in-memory persistence transaction double (tests only).
 * Models atomic claim/commit/release semantics without SQL.
 */

import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";
import { createInMemoryIdempotencyRepository } from "../repositories/inMemoryIdempotencyRepository.js";
import { matchesLineupPersistenceTransactionPort } from "../contracts/persistenceTransaction.js";

/**
 * @returns {import('../contracts/persistenceTransaction.js').LineupPersistenceTransactionPort}
 */
export function createInMemoryLineupPersistenceTransactionPort() {
  /** @type {Map<string, object>} */
  const aggregates = new Map();
  const idempotency = createInMemoryIdempotencyRepository();
  /** @type {Array<object>} */
  const audits = [];

  const port = {
    async loadForUpdate(identity = {}) {
      const key = String(identity.identityKey || identity.id || "").trim();
      if (!key) return null;
      const current = aggregates.get(key) ?? null;
      return current ? Object.freeze({ ...current }) : null;
    },

    async lookupIdempotency(identity = {}) {
      return idempotency.lookup(identity);
    },

    async claimIdempotency(identity = {}) {
      return idempotency.claimOrLookup(identity);
    },

    async completeIdempotency(identity = {}, result = null) {
      return idempotency.remember({
        ...identity,
        idempotencyKey: identity.idempotencyKey,
        result,
        replayed: false,
      });
    },

    async releaseIdempotency(identity = {}) {
      return idempotency.release(String(identity.idempotencyKey || ""));
    },

    /**
     * Atomic-ish in-memory commit:
     * validate expectedVersion → mutate → version++ → audit → complete idempotency.
     * On failure: release idempotency claim; no partial audit.
     */
    async commitCommand(tx = {}) {
      const identityKey = String(tx.identityKey || "").trim();
      const idempotencyKey =
        tx.idempotencyKey != null ? String(tx.idempotencyKey).trim() : null;
      const claimInput = tx.idempotencyClaim || null;

      try {
        if (claimInput && idempotencyKey) {
          const claim = idempotency.claimOrLookup({
            ...claimInput,
            idempotencyKey,
          });
          if (claim.conflict) {
            throw new LineupRuntimeError(
              LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT,
              claim.message || "Idempotency conflict",
              { idempotencyKey }
            );
          }
          if (claim.found && claim.record?.result) {
            return Object.freeze({
              ok: true,
              replayed: true,
              value: claim.record.result,
            });
          }
        }

        const existing = aggregates.get(identityKey) ?? null;
        if (
          tx.expectedVersion != null &&
          Number.isInteger(Number(tx.expectedVersion))
        ) {
          const current = existing?.revision ?? null;
          if (current != null && current !== Number(tx.expectedVersion)) {
            throw new LineupRuntimeError(
              LINEUP_RUNTIME_ERROR_CODE.LINEUP_VERSION_CONFLICT,
              "expectedVersion conflict",
              {
                expectedVersion: Number(tx.expectedVersion),
                actualVersion: current,
              }
            );
          }
        }

        const nextAggregate = tx.nextAggregate;
        if (!nextAggregate || typeof nextAggregate !== "object") {
          throw new TypeError("commitCommand requires nextAggregate");
        }
        const previousVersion = existing?.revision ?? null;
        const resultingVersion =
          typeof nextAggregate.revision === "number"
            ? nextAggregate.revision
            : (previousVersion ?? 0) + 1;

        aggregates.set(identityKey, Object.freeze({ ...nextAggregate }));

        const auditEvent = Object.freeze({
          type: tx.auditType || "LINEUP_COMMAND",
          identityKey,
          commandType: tx.commandType ?? null,
          previousVersion,
          resultingVersion,
          actor: tx.actor ?? null,
          source: tx.source ?? null,
          idempotencyKey,
          evaluatedAt: tx.evaluatedAt ?? null,
          reason: tx.reason ?? null,
        });
        audits.push(auditEvent);

        if (idempotencyKey) {
          idempotency.remember({
            idempotencyKey,
            aggregateIdentity: identityKey,
            commandType: tx.commandType ?? null,
            canonicalPayloadFingerprint: tx.payloadFingerprint || "fp",
            expectedVersion:
              tx.expectedVersion != null ? Number(tx.expectedVersion) : null,
            resultingVersion,
            createdAt: tx.evaluatedAt ?? null,
            result: Object.freeze({
              ok: true,
              value: aggregates.get(identityKey),
              details: { previousVersion, resultingVersion },
            }),
          });
        }

        return Object.freeze({
          ok: true,
          replayed: false,
          value: aggregates.get(identityKey),
          auditEvent,
          previousVersion,
          resultingVersion,
        });
      } catch (err) {
        if (idempotencyKey) {
          idempotency.release(idempotencyKey);
        }
        throw err;
      }
    },

    /** @internal */
    _audits: audits,
    /** @internal */
    _aggregates: aggregates,
  };

  if (!matchesLineupPersistenceTransactionPort(port)) {
    throw new TypeError("Persistence transaction port contract mismatch");
  }
  return port;
}
