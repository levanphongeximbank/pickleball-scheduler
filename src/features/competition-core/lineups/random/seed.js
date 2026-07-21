/**
 * CORE-06 Phase 1D — seed normalization and canonical composition.
 *
 * Rules:
 * - Reject missing / empty seed (never invent).
 * - Unicode NFC normalize.
 * - No locale-dependent lowercase or comparison.
 * - Trim only ASCII/Unicode whitespace via String.trim (not locale case fold).
 */

import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";

/** Unit separator — stable field delimiter for seed material. */
export const CANONICAL_SEED_FIELD_SEP = "\u001f";

/**
 * Canonical seed field order (documented + tested):
 * tenantId, competitionId, contextId, teamId, rosterVersion,
 * lineupIdentityKey, revisionOrCommandId, ownerSeed
 *
 * `ownerSeed` is required and must be non-empty after NFC + trim.
 */
export const CANONICAL_SEED_FIELDS = Object.freeze([
  "tenantId",
  "competitionId",
  "contextId",
  "teamId",
  "rosterVersion",
  "lineupIdentityKey",
  "revisionOrCommandId",
  "ownerSeed",
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeSeedPart(value) {
  if (value == null) return "";
  const asString =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
  return asString.normalize("NFC").trim();
}

/**
 * Normalize an owner-supplied or composed seed. Fail closed if empty.
 * @param {unknown} seed
 * @returns {string}
 */
export function normalizeSeed(seed) {
  if (seed == null || (typeof seed !== "string" && typeof seed !== "number")) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.MISSING_SEED,
      "Lineup random seed is required",
      {}
    );
  }
  const normalized = String(seed).normalize("NFC").trim();
  if (!normalized) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.MISSING_SEED,
      "Lineup random seed is empty after normalization",
      {}
    );
  }
  if (normalized.includes("\0")) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_SEED,
      "Lineup random seed must not contain NUL",
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
 *   tenantId?: unknown,
 *   competitionId?: unknown,
 *   contextId?: unknown,
 *   teamId?: unknown,
 *   rosterVersion?: unknown,
 *   lineupIdentityKey?: unknown,
 *   revisionOrCommandId?: unknown,
 *   ownerSeed?: unknown,
 * }} parts
 * @returns {string}
 */
export function composeCanonicalSeed(parts = {}) {
  const ownerSeed = normalizeSeedPart(parts.ownerSeed);
  if (!ownerSeed) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.MISSING_SEED,
      "Canonical seed requires non-empty ownerSeed",
      {}
    );
  }
  const fields = [
    normalizeSeedPart(parts.tenantId),
    normalizeSeedPart(parts.competitionId),
    normalizeSeedPart(parts.contextId),
    normalizeSeedPart(parts.teamId),
    normalizeSeedPart(parts.rosterVersion),
    normalizeSeedPart(parts.lineupIdentityKey),
    normalizeSeedPart(parts.revisionOrCommandId),
    ownerSeed,
  ];
  return normalizeSeed(fields.join(CANONICAL_SEED_FIELD_SEP));
}
