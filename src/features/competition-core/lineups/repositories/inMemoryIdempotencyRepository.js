/**
 * CORE-06 Phase 1E — hardened in-memory idempotency repository (test double only).
 * Same key + aggregate + command + payload → replay.
 * Any contextual mismatch → LINEUP_IDEMPOTENCY_CONFLICT.
 */

import { createLineupIdempotencyRecord } from "../contracts/idempotencyRecord.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @typedef {Object} HardenedIdempotencyLookup
 * @property {boolean} found
 * @property {boolean} conflict
 * @property {boolean} [replayed]
 * @property {import('../contracts/idempotencyRecord.js').LineupIdempotencyRecordV2|null} [record]
 * @property {string|null} [code]
 * @property {string|null} [message]
 */

/**
 * @returns {{
 *   lookup: (input: object) => HardenedIdempotencyLookup,
 *   remember: (record: object) => import('../contracts/idempotencyRecord.js').LineupIdempotencyRecordV2,
 *   markReplayed: (key: string) => import('../contracts/idempotencyRecord.js').LineupIdempotencyRecordV2|null,
 *   clear: () => void,
 *   size: () => number,
 * }}
 */
export function createInMemoryIdempotencyRepository() {
  /** @type {Map<string, import('../contracts/idempotencyRecord.js').LineupIdempotencyRecordV2>} */
  const byKey = new Map();

  return {
    /**
     * @param {object} input
     * @returns {HardenedIdempotencyLookup}
     */
    lookup(input = {}) {
      const key = String(input.idempotencyKey || "").trim();
      if (!key) {
        return {
          found: false,
          conflict: false,
          record: null,
          code: null,
          message: null,
        };
      }
      const existing = byKey.get(key);
      if (!existing) {
        return {
          found: false,
          conflict: false,
          record: null,
          code: null,
          message: null,
        };
      }

      const aggregateIdentity =
        input.aggregateIdentity != null
          ? String(input.aggregateIdentity).trim()
          : null;
      const commandType =
        input.commandType != null ? String(input.commandType).trim() : null;
      const fingerprint = String(
        input.canonicalPayloadFingerprint || input.payloadHash || ""
      ).trim();
      const expectedVersion =
        typeof input.expectedVersion === "number" &&
        Number.isInteger(input.expectedVersion)
          ? input.expectedVersion
          : null;

      const mismatches = [];
      if (
        existing.aggregateIdentity != null &&
        aggregateIdentity != null &&
        existing.aggregateIdentity !== aggregateIdentity
      ) {
        mismatches.push("aggregateIdentity");
      }
      if (
        existing.commandType != null &&
        commandType != null &&
        existing.commandType !== commandType
      ) {
        mismatches.push("commandType");
      }
      if (
        existing.canonicalPayloadFingerprint &&
        fingerprint &&
        existing.canonicalPayloadFingerprint !== fingerprint
      ) {
        mismatches.push("payload");
      }
      if (
        existing.expectedVersion != null &&
        expectedVersion != null &&
        existing.expectedVersion !== expectedVersion
      ) {
        mismatches.push("expectedVersion");
      }

      if (mismatches.length) {
        return {
          found: true,
          conflict: true,
          record: existing,
          code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT,
          message: `Idempotency conflict on: ${mismatches.join(", ")}`,
        };
      }

      return {
        found: true,
        conflict: false,
        replayed: true,
        record: existing,
        code: null,
        message: null,
      };
    },

    /**
     * Atomically claim a key for first execution, or return replay/conflict.
     * Pending reservations prevent two same-key mutations from both proceeding.
     * @param {object} input
     * @returns {HardenedIdempotencyLookup & { claimed?: boolean, pending?: boolean }}
     */
    claimOrLookup(input = {}) {
      const key = String(input.idempotencyKey || "").trim();
      if (!key) {
        return {
          found: false,
          conflict: false,
          claimed: false,
          record: null,
          code: null,
          message: null,
        };
      }
      const existing = byKey.get(key);
      if (existing) {
        const looked = this.lookup(input);
        if (
          looked.found &&
          !looked.conflict &&
          /** @type {{ pending?: boolean }} */ (existing).pending === true
        ) {
          return {
            ...looked,
            pending: true,
            conflict: true,
            code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT,
            message:
              "Idempotency key is already claimed by an in-flight command",
          };
        }
        return looked;
      }

      const reservation = createLineupIdempotencyRecord({
        idempotencyKey: key,
        aggregateIdentity:
          input.aggregateIdentity != null
            ? String(input.aggregateIdentity).trim()
            : null,
        commandType:
          input.commandType != null ? String(input.commandType).trim() : null,
        canonicalPayloadFingerprint: String(
          input.canonicalPayloadFingerprint || input.payloadHash || ""
        ).trim(),
        expectedVersion:
          typeof input.expectedVersion === "number" &&
          Number.isInteger(input.expectedVersion)
            ? input.expectedVersion
            : null,
        createdAt: input.createdAt ?? null,
        replayed: false,
        result: null,
      });
      /** @type {import('../contracts/idempotencyRecord.js').LineupIdempotencyRecordV2 & { pending?: boolean }} */
      const pending = Object.freeze({ ...reservation, pending: true });
      byKey.set(key, pending);
      return {
        found: false,
        conflict: false,
        claimed: true,
        pending: true,
        record: pending,
        code: null,
        message: null,
      };
    },

    /**
     * @param {object} record
     */
    remember(record) {
      const stored = createLineupIdempotencyRecord({
        ...record,
        replayed: false,
      });
      if (!stored.idempotencyKey) {
        throw new TypeError("idempotencyKey is required");
      }
      byKey.set(stored.idempotencyKey, stored);
      return stored;
    },

    /**
     * @param {string} key
     */
    markReplayed(key) {
      const existing = byKey.get(String(key));
      if (!existing) return null;
      const next = createLineupIdempotencyRecord({
        ...existing,
        replayed: true,
      });
      byKey.set(String(key), next);
      return next;
    },

    /**
     * Drop an in-flight reservation after a failed mutation.
     * @param {string} key
     */
    release(key) {
      const existing = byKey.get(String(key));
      if (
        existing &&
        /** @type {{ pending?: boolean }} */ (existing).pending === true
      ) {
        byKey.delete(String(key));
        return true;
      }
      return false;
    },

    clear() {
      byKey.clear();
    },

    size() {
      return byKey.size;
    },
  };
}
