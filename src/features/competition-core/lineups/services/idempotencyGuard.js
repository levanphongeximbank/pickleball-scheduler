/**
 * CORE-06 Phase 1E — hardened idempotency guard helpers.
 */

import { createLineupIdempotencyRecord } from "../contracts/idempotencyRecord.js";
import { fingerprintValue } from "../random/fingerprint.js";
import { buildCommandFingerprint } from "../concurrency/assertExpectedVersion.js";
import { createInMemoryIdempotencyRepository } from "../repositories/inMemoryIdempotencyRepository.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * Canonical payload fingerprint for mutating commands.
 * @param {object} payload
 * @returns {string}
 */
export function buildIdempotencyPayloadFingerprint(payload = {}) {
  return fingerprintValue({
    kind: "LINEUP_IDEMPOTENCY_PAYLOAD_V1",
    ...payload,
    commandFingerprint: payload.commandFingerprint
      ? payload.commandFingerprint
      : buildCommandFingerprint(payload),
  });
}

/**
 * Wrap hardened repository as a Phase 1C-compatible IdempotencyPort,
 * while exposing lookupContext for Phase 1E conflict semantics.
 * @param {ReturnType<typeof createInMemoryIdempotencyRepository>} [repo]
 */
export function createHardenedLineupIdempotencyPort(repo = null) {
  const store = repo || createInMemoryIdempotencyRepository();

  return {
    /**
     * Legacy Phase 1C signature: lookup(key, payloadHash)
     */
    async lookup(key, payloadHash) {
      const result = store.lookup({
        idempotencyKey: key,
        canonicalPayloadFingerprint: payloadHash,
      });
      if (result.conflict) {
        return { found: true, conflict: true, record: result.record };
      }
      if (result.found) {
        return {
          found: true,
          conflict: false,
          record: {
            key: result.record.idempotencyKey,
            payloadHash: result.record.canonicalPayloadFingerprint,
            result: result.record.result,
            at: result.record.createdAt,
            replayed: true,
            recordV2: result.record,
          },
        };
      }
      return { found: false, conflict: false, record: null };
    },

    /**
     * Phase 1E contextual lookup with atomic claim on first use.
     * @param {object} input
     */
    async lookupContext(input) {
      return store.claimOrLookup(input);
    },

    /**
     * Non-claiming read (tests / diagnostics).
     * @param {object} input
     */
    async peekContext(input) {
      return store.lookup(input);
    },

    async remember(record) {
      if (record && record.idempotencyKey) {
        store.remember(record);
        return;
      }
      // Legacy remember({ key, payloadHash, result, at })
      store.remember(
        createLineupIdempotencyRecord({
          idempotencyKey: record?.key,
          canonicalPayloadFingerprint: record?.payloadHash,
          result: record?.result,
          createdAt: record?.at ?? null,
          replayed: false,
        })
      );
    },

    markReplayed(key) {
      return store.markReplayed(key);
    },

    release(key) {
      return store.release(key);
    },

    /** @internal test helper */
    _repository: store,
  };
}

/**
 * Apply lookup decision to a domain fail helper.
 * @param {object} lookup
 * @param {(code: string, message: string, issues?: unknown[], details?: object) => object} fail
 */
export function idempotencyConflictResult(lookup, fail) {
  return fail(
    lookup?.code || LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT,
    lookup?.message || "Idempotency key reused with conflicting context",
    [],
    {
      idempotencyKey: lookup?.record?.idempotencyKey ?? null,
    }
  );
}
