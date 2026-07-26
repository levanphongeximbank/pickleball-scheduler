/**
 * Webhook idempotency / replay projection — no persistence ownership.
 * Distinguishes NEW / DUPLICATE / CONFLICT using caller-supplied priors.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  IDEMPOTENCY_OUTCOME,
  WEBHOOK_REPLAY_PROJECTION_VERSION,
} from "../constants/catalogues.js";
import {
  createIdempotencyProjection,
  evaluateIdempotencyProjection,
} from "./idempotencyProjection.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireNonEmptyString,
} from "./shared.js";

export const WEBHOOK_REPLAY_PROJECTION_ERROR = Object.freeze({
  INVALID: "WEBHOOK_REPLAY_PROJECTION_INVALID",
  VERSION_INVALID: "WEBHOOK_REPLAY_PROJECTION_VERSION_INVALID",
  KEY_INVALID: "WEBHOOK_REPLAY_PROJECTION_KEY_INVALID",
  FINGERPRINT_INVALID: "WEBHOOK_REPLAY_PROJECTION_FINGERPRINT_INVALID",
  SCOPE_INVALID: "WEBHOOK_REPLAY_PROJECTION_SCOPE_INVALID",
});

/**
 * Build a webhook-scoped idempotency identity from ingress metadata.
 * Prefer providerEventId; fall back to bodyDigest.
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createWebhookReplayProjection(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_REPLAY_PROJECTION_ERROR.INVALID,
        "WebhookReplayProjection input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? WEBHOOK_REPLAY_PROJECTION_VERSION,
    "contractVersion",
    WEBHOOK_REPLAY_PROJECTION_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const scope = requireNonEmptyString(
    input.scope ?? input.routeKey ?? input.connectorId ?? "webhook",
    "scope",
    WEBHOOK_REPLAY_PROJECTION_ERROR.SCOPE_INVALID,
    "scope"
  );
  if (!scope.ok) return scope;

  const idempotencyKeyRaw =
    input.idempotencyKey ??
    input.providerEventId ??
    input.eventId ??
    input.bodyDigest;

  const fingerprintRaw =
    input.fingerprint ??
    input.requestFingerprint ??
    input.bodyDigest ??
    input.providerEventId ??
    input.eventId;

  if (typeof idempotencyKeyRaw !== "string" || !idempotencyKeyRaw.trim()) {
    return fail(
      contractError(
        WEBHOOK_REPLAY_PROJECTION_ERROR.KEY_INVALID,
        "idempotencyKey / providerEventId / bodyDigest is required",
        "idempotencyKey"
      )
    );
  }

  if (typeof fingerprintRaw !== "string" || !fingerprintRaw.trim()) {
    return fail(
      contractError(
        WEBHOOK_REPLAY_PROJECTION_ERROR.FINGERPRINT_INVALID,
        "fingerprint / bodyDigest is required",
        "fingerprint"
      )
    );
  }

  const projection = createIdempotencyProjection({
    scope: scope.value,
    idempotencyKey: idempotencyKeyRaw.trim(),
    fingerprint: fingerprintRaw.trim(),
  });
  if (!projection.ok) {
    return fail(
      contractError(
        WEBHOOK_REPLAY_PROJECTION_ERROR.INVALID,
        projection.error.message,
        projection.error.field
      )
    );
  }

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      ...projection.value,
    })
  );
}

/**
 * Evaluate webhook replay/idempotency against caller-supplied prior projections.
 * @param {*} candidateInput
 * @param {ReadonlyArray<*>} [priorProjections]
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function evaluateWebhookReplayProjection(
  candidateInput,
  priorProjections = []
) {
  const candidate = createWebhookReplayProjection(candidateInput);
  if (!candidate.ok) return candidate;

  const evaluation = evaluateIdempotencyProjection(
    {
      scope: candidate.value.scope,
      idempotencyKey: candidate.value.idempotencyKey,
      fingerprint: candidate.value.fingerprint,
    },
    priorProjections
  );
  if (!evaluation.ok) {
    return fail(
      contractError(
        WEBHOOK_REPLAY_PROJECTION_ERROR.INVALID,
        evaluation.error.message,
        evaluation.error.field
      )
    );
  }

  return ok(
    deepFreeze({
      outcome: evaluation.value.outcome,
      projection: candidate.value,
      ...(evaluation.value.matchedIdentity
        ? { matchedIdentity: evaluation.value.matchedIdentity }
        : {}),
      ...(evaluation.value.conflictingIdentities
        ? { conflictingIdentities: evaluation.value.conflictingIdentities }
        : {}),
      isNew: evaluation.value.outcome === IDEMPOTENCY_OUTCOME.NEW,
      isDuplicate: evaluation.value.outcome === IDEMPOTENCY_OUTCOME.DUPLICATE,
      isConflict: evaluation.value.outcome === IDEMPOTENCY_OUTCOME.CONFLICT,
    })
  );
}
