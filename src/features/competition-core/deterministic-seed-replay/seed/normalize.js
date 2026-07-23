/**
 * CORE-21 — seed normalization and canonical composition.
 *
 * Rules:
 * - Reject missing / empty seed (never invent).
 * - Unicode NFC normalize + trim.
 * - Owner seeds: string or finite integer only (no object JSON.stringify).
 * - No locale-dependent case fold.
 */

import {
  CANONICAL_SEED_FIELD_SEP,
  CANONICAL_SEED_FIELDS,
  CORE21_SEED_ALGORITHM_VERSION,
} from "../constants.js";
import { DETERMINISTIC_SEED_REPLAY_ERROR_CODE } from "../errors/errorCodes.js";
import { DeterministicSeedReplayError } from "../errors/DeterministicSeedReplayError.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeSeedPart(value) {
  if (value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new DeterministicSeedReplayError(
        DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_INVALID,
        "Seed part numeric values must be finite integers",
        { value: String(value) }
      );
    }
    return String(value).normalize("NFC").trim();
  }
  if (typeof value !== "string") return "";
  return value.normalize("NFC").trim();
}

/**
 * Normalize an owner-supplied or composed seed. Fail closed if empty.
 * @param {unknown} seed
 * @returns {string}
 */
export function normalizeSeed(seed) {
  if (seed === null || seed === undefined) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_MISSING,
      "Explicit seed is required; host RNG fallback is forbidden",
      { seed: null }
    );
  }
  if (typeof seed === "number") {
    if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
      throw new DeterministicSeedReplayError(
        DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_INVALID,
        "Numeric seed must be a finite integer",
        { seed }
      );
    }
    return String(seed).normalize("NFC").trim();
  }
  if (typeof seed !== "string") {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_INVALID,
      "Seed must be a string or integer (object seeds are rejected)",
      { type: typeof seed }
    );
  }
  const normalized = seed.normalize("NFC").trim();
  if (!normalized) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_MISSING,
      "Seed is empty after NFC normalization",
      {}
    );
  }
  if (normalized.includes("\0")) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_INVALID,
      "Seed must not contain NUL",
      {}
    );
  }
  return normalized;
}

/**
 * Compose a canonical deterministic seed from scope + owner seed.
 * Does not invent ownerSeed — fails closed when missing.
 *
 * @param {{
 *   seedNamespace?: unknown,
 *   purpose?: unknown,
 *   tenantId?: unknown,
 *   competitionId?: unknown,
 *   contextId?: unknown,
 *   derivationFingerprint?: unknown,
 *   ownerSeed?: unknown,
 * }} parts
 * @returns {string}
 */
export function composeCanonicalSeed(parts = {}) {
  const ownerSeed = normalizeSeedPart(parts.ownerSeed);
  if (!ownerSeed) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_MISSING,
      "Canonical seed requires non-empty ownerSeed",
      {}
    );
  }
  if (ownerSeed.includes("\0")) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_INVALID,
      "ownerSeed must not contain NUL",
      {}
    );
  }
  const fields = [
    normalizeSeedPart(parts.seedNamespace),
    normalizeSeedPart(parts.purpose),
    normalizeSeedPart(parts.tenantId),
    normalizeSeedPart(parts.competitionId),
    normalizeSeedPart(parts.contextId),
    normalizeSeedPart(parts.derivationFingerprint),
    ownerSeed,
  ];
  return normalizeSeed(fields.join(CANONICAL_SEED_FIELD_SEP));
}

/**
 * Redaction-safe seed identity projection (no secrets).
 *
 * @param {{
 *   seedIdentity?: unknown,
 *   seedNamespace?: unknown,
 *   purpose?: unknown,
 *   tenantId?: unknown,
 *   competitionId?: unknown,
 *   contextId?: unknown,
 *   derivationInputs?: unknown,
 *   ownerSeed?: unknown,
 * }} partial
 * @returns {Readonly<{
 *   seedIdentity: string,
 *   seedNamespace: string | null,
 *   purpose: string | null,
 *   seedAlgorithmVersion: string,
 *   derivationFingerprint: string | null,
 * }>}
 */
export function createSeedIdentity(partial = {}) {
  let seedIdentity;
  let derivationFingerprint = null;

  if (partial.derivationInputs !== undefined && partial.derivationInputs !== null) {
    // Lazy import avoided — caller may pass precomputed fingerprint string
    // or leave derivationInputs for composeCanonicalSeed via fingerprint helper.
    if (typeof partial.derivationInputs === "string") {
      derivationFingerprint = normalizeSeedPart(partial.derivationInputs) || null;
    } else {
      throw new DeterministicSeedReplayError(
        DETERMINISTIC_SEED_REPLAY_ERROR_CODE.SEED_INVALID,
        "derivationInputs must be supplied as a fingerprint string (use fingerprintValue)",
        { type: typeof partial.derivationInputs }
      );
    }
  } else if (partial.derivationFingerprint != null) {
    derivationFingerprint =
      normalizeSeedPart(partial.derivationFingerprint) || null;
  }

  if (partial.seedIdentity != null && partial.seedIdentity !== "") {
    seedIdentity = normalizeSeed(partial.seedIdentity);
  } else {
    seedIdentity = composeCanonicalSeed({
      seedNamespace: partial.seedNamespace,
      purpose: partial.purpose,
      tenantId: partial.tenantId,
      competitionId: partial.competitionId,
      contextId: partial.contextId,
      derivationFingerprint,
      ownerSeed: partial.ownerSeed,
    });
  }

  return Object.freeze({
    seedIdentity,
    seedNamespace: normalizeSeedPart(partial.seedNamespace) || null,
    purpose: normalizeSeedPart(partial.purpose) || null,
    seedAlgorithmVersion: CORE21_SEED_ALGORITHM_VERSION,
    derivationFingerprint,
  });
}

export { CANONICAL_SEED_FIELDS, CANONICAL_SEED_FIELD_SEP, CORE21_SEED_ALGORITHM_VERSION };
