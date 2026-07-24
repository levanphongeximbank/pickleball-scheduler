/**
 * Webhook request verification port — contract + deterministic fake.
 * Fail-closed. No credential storage. No public HTTP endpoint.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { WEBHOOK_VERIFICATION_OUTCOME } from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireIsoInstant,
  requireNonEmptyString,
} from "../contracts/shared.js";

export const WEBHOOK_VERIFICATION_ERROR = Object.freeze({
  INVALID: "WEBHOOK_VERIFICATION_INVALID",
  REQUEST_INVALID: "WEBHOOK_VERIFICATION_REQUEST_INVALID",
});

/**
 * Normalize inbound verification request (metadata only — no raw secret retention).
 * @param {*} input
 */
export function createWebhookVerificationRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_VERIFICATION_ERROR.REQUEST_INVALID,
        "WebhookVerificationRequest must be a plain object"
      )
    );
  }

  const connectorId = requireNonEmptyString(
    input.connectorId,
    "connectorId",
    WEBHOOK_VERIFICATION_ERROR.REQUEST_INVALID,
    "connectorId"
  );
  if (!connectorId.ok) return connectorId;

  const hasSignatureHeader =
    typeof input.signatureHeader === "string" &&
    input.signatureHeader.trim().length > 0;
  const hasTimestamp =
    input.timestamp !== undefined && input.timestamp !== null;

  let timestamp;
  if (hasTimestamp) {
    const ts = requireIsoInstant(
      input.timestamp,
      "timestamp",
      WEBHOOK_VERIFICATION_ERROR.REQUEST_INVALID
    );
    if (!ts.ok) {
      return ok(
        deepFreeze({
          connectorId: connectorId.value,
          signaturePresent: hasSignatureHeader,
          timestampPresent: true,
          timestampMalformed: true,
          bodyDigest: typeof input.bodyDigest === "string" ? input.bodyDigest : null,
          now: typeof input.now === "string" ? input.now : null,
          maxSkewSeconds:
            Number.isFinite(Number(input.maxSkewSeconds))
              ? Number(input.maxSkewSeconds)
              : 300,
        })
      );
    }
    timestamp = ts.value;
  }

  // Never retain raw signature/secret values on the normalized request.
  return ok(
    deepFreeze({
      connectorId: connectorId.value,
      signaturePresent: hasSignatureHeader,
      timestampPresent: Boolean(timestamp),
      timestampMalformed: false,
      timestamp: timestamp ?? null,
      bodyDigest:
        typeof input.bodyDigest === "string" && input.bodyDigest.trim()
          ? input.bodyDigest.trim()
          : null,
      now: typeof input.now === "string" ? input.now : null,
      maxSkewSeconds:
        Number.isFinite(Number(input.maxSkewSeconds))
          ? Number(input.maxSkewSeconds)
          : 300,
      // Opaque expected digest for fake verifier only (not a secret).
      expectedBodyDigest:
        typeof input.expectedBodyDigest === "string" &&
        input.expectedBodyDigest.trim()
          ? input.expectedBodyDigest.trim()
          : null,
      seenEventIds: Object.freeze(
        Array.isArray(input.seenEventIds)
          ? input.seenEventIds.filter((id) => typeof id === "string")
          : []
      ),
      eventId:
        typeof input.eventId === "string" && input.eventId.trim()
          ? input.eventId.trim()
          : null,
    })
  );
}

/**
 * Fail-closed verification classification (no crypto provider here).
 * @param {*} requestInput
 */
export function verifyWebhookRequestFailClosed(requestInput) {
  const requestResult = createWebhookVerificationRequest(requestInput);
  if (!requestResult.ok) {
    return ok(
      deepFreeze({
        outcome: WEBHOOK_VERIFICATION_OUTCOME.MALFORMED,
        accepted: false,
        reason: "request_normalization_failed",
      })
    );
  }

  const request = requestResult.value;

  if (!request.signaturePresent) {
    return ok(
      deepFreeze({
        outcome: WEBHOOK_VERIFICATION_OUTCOME.MISSING,
        accepted: false,
        reason: "signature_missing",
      })
    );
  }

  if (request.timestampMalformed) {
    return ok(
      deepFreeze({
        outcome: WEBHOOK_VERIFICATION_OUTCOME.MALFORMED,
        accepted: false,
        reason: "timestamp_malformed",
      })
    );
  }

  if (!request.timestampPresent || !request.timestamp) {
    return ok(
      deepFreeze({
        outcome: WEBHOOK_VERIFICATION_OUTCOME.MALFORMED,
        accepted: false,
        reason: "timestamp_missing",
      })
    );
  }

  if (!request.bodyDigest) {
    return ok(
      deepFreeze({
        outcome: WEBHOOK_VERIFICATION_OUTCOME.MALFORMED,
        accepted: false,
        reason: "body_digest_missing",
      })
    );
  }

  if (
    request.expectedBodyDigest != null &&
    request.bodyDigest !== request.expectedBodyDigest
  ) {
    return ok(
      deepFreeze({
        outcome: WEBHOOK_VERIFICATION_OUTCOME.INVALID,
        accepted: false,
        reason: "signature_mismatch",
      })
    );
  }

  if (request.now) {
    const nowMs = Date.parse(request.now);
    const tsMs = Date.parse(request.timestamp);
    if (Number.isNaN(nowMs) || Number.isNaN(tsMs)) {
      return ok(
        deepFreeze({
          outcome: WEBHOOK_VERIFICATION_OUTCOME.MALFORMED,
          accepted: false,
          reason: "timestamp_parse_failed",
        })
      );
    }
    const skewSeconds = Math.abs(nowMs - tsMs) / 1000;
    if (skewSeconds > request.maxSkewSeconds) {
      return ok(
        deepFreeze({
          outcome: WEBHOOK_VERIFICATION_OUTCOME.EXPIRED,
          accepted: false,
          reason: "timestamp_outside_tolerance",
          skewSeconds,
        })
      );
    }
  }

  if (
    request.eventId &&
    request.seenEventIds.includes(request.eventId)
  ) {
    return ok(
      deepFreeze({
        outcome: WEBHOOK_VERIFICATION_OUTCOME.REPLAY_SUSPECTED,
        accepted: false,
        reason: "event_id_seen",
      })
    );
  }

  return ok(
    deepFreeze({
      outcome: WEBHOOK_VERIFICATION_OUTCOME.VERIFIED,
      accepted: true,
      reason: "verified",
      connectorId: request.connectorId,
    })
  );
}

/**
 * Deterministic fake verifier for tests — explicit expected digest config.
 * @param {{ expectedBodyDigest: string, maxSkewSeconds?: number }} config
 */
export function createFakeWebhookVerifier(config) {
  if (!isPlainObject(config) || typeof config.expectedBodyDigest !== "string") {
    throw new Error(
      "createFakeWebhookVerifier requires explicit expectedBodyDigest"
    );
  }
  const expectedBodyDigest = config.expectedBodyDigest.trim();
  if (!expectedBodyDigest) {
    throw new Error("expectedBodyDigest must be non-empty");
  }
  const maxSkewSeconds =
    Number.isFinite(Number(config.maxSkewSeconds))
      ? Number(config.maxSkewSeconds)
      : 300;

  /** @type {Set<string>} */
  const seen = new Set(
    Array.isArray(config.initialSeenEventIds)
      ? config.initialSeenEventIds.filter((id) => typeof id === "string")
      : []
  );

  return deepFreeze({
    kind: "fake-webhook-verifier",
    verify(requestInput) {
      const merged = {
        ...(isPlainObject(requestInput) ? requestInput : {}),
        expectedBodyDigest,
        maxSkewSeconds:
          requestInput?.maxSkewSeconds != null
            ? requestInput.maxSkewSeconds
            : maxSkewSeconds,
        seenEventIds: Object.freeze([
          ...seen,
          ...(Array.isArray(requestInput?.seenEventIds)
            ? requestInput.seenEventIds
            : []),
        ]),
      };
      const result = verifyWebhookRequestFailClosed(merged);
      if (
        result.ok &&
        result.value.accepted &&
        typeof requestInput?.eventId === "string" &&
        requestInput.eventId.trim()
      ) {
        // Fake verifier may optionally remember — but keep mutation local to instance.
        seen.add(requestInput.eventId.trim());
      }
      return result;
    },
  });
}
