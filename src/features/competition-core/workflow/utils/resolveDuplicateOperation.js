/**
 * CORE-19 — deterministic duplicate operation detection (no persistence).
 *
 * Canonical policy:
 * - same idempotency key + same payload fingerprint → idempotent no-op
 * - same idempotency key + different payload fingerprint → DETERMINISTIC_INPUT_VIOLATION
 * - unseen key → proceed
 *
 * Does not depend on current time or randomness.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import {
  createWorkflowPayloadFingerprint,
  isPlainObject,
} from "./canonicalizeWorkflowPayload.js";

/**
 * @param {object} args
 * @param {string} args.idempotencyKey
 * @param {unknown} args.payload
 * @param {unknown} [args.processedOperations] — map/list of prior ops
 * @param {unknown} [args.seenIdempotencyKeys]
 * @param {string} [args.operation]
 * @returns {{ kind: "proceed"|"noop"|"conflict", code: string|null, fingerprint: string, details: object }}
 */
export function resolveDuplicateOperation(args = {}) {
  const idempotencyKey = String(args.idempotencyKey || "");
  const operation = args.operation != null ? String(args.operation) : null;
  const payload = isPlainObject(args.payload) ? args.payload : {};
  const fingerprint = createWorkflowPayloadFingerprint({
    operation,
    payload,
  });

  /** @type {Map<string, string>} */
  const prior = new Map();

  if (Array.isArray(args.processedOperations)) {
    for (const item of args.processedOperations) {
      if (!isPlainObject(item)) continue;
      const key = String(item.idempotencyKey || "");
      if (!key) continue;
      const fp =
        item.payloadFingerprint != null
          ? String(item.payloadFingerprint)
          : createWorkflowPayloadFingerprint({
              operation: item.operation ?? null,
              payload: isPlainObject(item.payload) ? item.payload : {},
            });
      prior.set(key, fp);
    }
  } else if (isPlainObject(args.processedOperations)) {
    for (const [key, value] of Object.entries(args.processedOperations)) {
      if (typeof value === "string") {
        prior.set(String(key), value);
      } else if (isPlainObject(value)) {
        prior.set(
          String(key),
          value.payloadFingerprint != null
            ? String(value.payloadFingerprint)
            : createWorkflowPayloadFingerprint({
                operation: value.operation ?? null,
                payload: isPlainObject(value.payload) ? value.payload : {},
              })
        );
      }
    }
  }

  // Legacy seenIdempotencyKeys without fingerprint: treat as same-key conflict
  // only when no processedOperations fingerprint is available — prefer noop if
  // caller did not supply a differing fingerprint channel.
  if (Array.isArray(args.seenIdempotencyKeys)) {
    for (const key of args.seenIdempotencyKeys) {
      const k = String(key);
      if (!prior.has(k)) {
        // Without a stored fingerprint, identical-key replay is treated as noop
        // only when caller also supplies matchingOperationFingerprints map; else
        // mark as seen-without-fingerprint for conservative conflict if payload
        // channel is required. Spec: same key + same payload = noop. Without
        // stored fingerprint we cannot prove sameness → DETERMINISTIC_INPUT_VIOLATION
        // unless processedOperations provided the fingerprint.
        prior.set(k, "");
      }
    }
  }

  if (!idempotencyKey) {
    return {
      kind: "proceed",
      code: null,
      fingerprint,
      details: { idempotencyKey, fingerprint },
    };
  }

  if (!prior.has(idempotencyKey)) {
    return {
      kind: "proceed",
      code: null,
      fingerprint,
      details: { idempotencyKey, fingerprint },
    };
  }

  const previousFingerprint = prior.get(idempotencyKey);
  if (previousFingerprint === "" || previousFingerprint == null) {
    // Seen key without fingerprint proof — conflict to avoid silent double-apply.
    return {
      kind: "conflict",
      code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
      fingerprint,
      details: {
        idempotencyKey,
        fingerprint,
        previousFingerprint: previousFingerprint || null,
        reason: "Idempotency key previously seen without matching payload fingerprint",
      },
    };
  }

  if (previousFingerprint === fingerprint) {
    return {
      kind: "noop",
      code: null,
      fingerprint,
      details: {
        idempotencyKey,
        fingerprint,
        previousFingerprint,
        policy: "same-key-same-payload-idempotent-noop",
      },
    };
  }

  return {
    kind: "conflict",
    code: WORKFLOW_ERROR_CODE.DETERMINISTIC_INPUT_VIOLATION,
    fingerprint,
    details: {
      idempotencyKey,
      fingerprint,
      previousFingerprint,
      policy: "same-key-different-payload-conflict",
    },
  };
}
