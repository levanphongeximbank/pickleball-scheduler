/**
 * Idempotency projection — deterministic, no persistence / no globals.
 */

import { createIdempotencyKey, fail, ok } from "../../../core/platform/index.js";
import { IDEMPOTENCY_OUTCOME } from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireNonEmptyString,
} from "./shared.js";

export const IDEMPOTENCY_PROJECTION_ERROR = Object.freeze({
  INVALID: "IDEMPOTENCY_PROJECTION_INVALID",
  KEY_INVALID: "IDEMPOTENCY_PROJECTION_KEY_INVALID",
  FINGERPRINT_INVALID: "IDEMPOTENCY_PROJECTION_FINGERPRINT_INVALID",
  SCOPE_INVALID: "IDEMPOTENCY_PROJECTION_SCOPE_INVALID",
});

/**
 * Deterministic identity string for an idempotent operation observation.
 * @param {*} input
 */
export function createIdempotencyProjection(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        IDEMPOTENCY_PROJECTION_ERROR.INVALID,
        "IdempotencyProjection input must be a plain object"
      )
    );
  }

  const keyResult = createIdempotencyKey(input.idempotencyKey ?? input.key);
  if (!keyResult.ok) {
    return fail(
      contractError(
        IDEMPOTENCY_PROJECTION_ERROR.KEY_INVALID,
        "idempotencyKey must be a valid Platform IdempotencyKey",
        "idempotencyKey"
      )
    );
  }

  const fingerprint = requireNonEmptyString(
    input.fingerprint ?? input.requestFingerprint,
    "fingerprint",
    IDEMPOTENCY_PROJECTION_ERROR.FINGERPRINT_INVALID,
    "fingerprint"
  );
  if (!fingerprint.ok) return fingerprint;

  const scope = requireNonEmptyString(
    input.scope ?? input.scopeKey ?? "default",
    "scope",
    IDEMPOTENCY_PROJECTION_ERROR.SCOPE_INVALID,
    "scope"
  );
  if (!scope.ok) return scope;

  const identity = `${scope.value}|${keyResult.value}|${fingerprint.value}`;

  return ok(
    deepFreeze({
      identity,
      scope: scope.value,
      idempotencyKey: keyResult.value,
      fingerprint: fingerprint.value,
    })
  );
}

/**
 * Evaluate against prior observations (caller-supplied; no store owned here).
 * @param {*} candidateInput
 * @param {ReadonlyArray<*>} [priorProjections]
 */
export function evaluateIdempotencyProjection(candidateInput, priorProjections = []) {
  const candidate = createIdempotencyProjection(candidateInput);
  if (!candidate.ok) return candidate;

  if (!Array.isArray(priorProjections)) {
    return fail(
      contractError(
        IDEMPOTENCY_PROJECTION_ERROR.INVALID,
        "priorProjections must be an array",
        "priorProjections"
      )
    );
  }

  /** @type {Array<{ scope: string, idempotencyKey: string, fingerprint: string, identity: string }>} */
  const priors = [];
  for (let i = 0; i < priorProjections.length; i += 1) {
    const prior = createIdempotencyProjection(priorProjections[i]);
    if (!prior.ok) {
      return fail(
        contractError(
          IDEMPOTENCY_PROJECTION_ERROR.INVALID,
          `priorProjections[${i}] is invalid`,
          "priorProjections"
        )
      );
    }
    priors.push(prior.value);
  }

  const sameKey = priors.filter(
    (p) =>
      p.scope === candidate.value.scope &&
      p.idempotencyKey === candidate.value.idempotencyKey
  );

  if (sameKey.length === 0) {
    return ok(
      deepFreeze({
        outcome: IDEMPOTENCY_OUTCOME.NEW,
        projection: candidate.value,
      })
    );
  }

  const sameFingerprint = sameKey.find(
    (p) => p.fingerprint === candidate.value.fingerprint
  );
  if (sameFingerprint) {
    return ok(
      deepFreeze({
        outcome: IDEMPOTENCY_OUTCOME.DUPLICATE,
        projection: candidate.value,
        matchedIdentity: sameFingerprint.identity,
      })
    );
  }

  return ok(
    deepFreeze({
      outcome: IDEMPOTENCY_OUTCOME.CONFLICT,
      projection: candidate.value,
      conflictingIdentities: Object.freeze(
        sameKey.map((p) => p.identity)
      ),
    })
  );
}
