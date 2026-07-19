/**
 * Phase 3G — candidate validation.
 */

import { isNonEmptyString } from "../../participants/contracts/shared.js";
import { SEEDING_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { SeedingRuntimeError } from "../errors/SeedingRuntimeError.js";

/**
 * @param {import('../contracts/seedingCandidate.js').SeedingCandidate[]} candidates
 * @returns {{ ok: true } | never}
 */
export function validateCandidates(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new SeedingRuntimeError(
      SEEDING_RUNTIME_ERROR_CODE.SEEDING_CANDIDATE_REQUIRED,
      "At least one seeding candidate is required",
      {}
    );
  }

  /** @type {Set<string>} */
  const refs = new Set();
  /** @type {Set<string>} */
  const identityKeys = new Set();

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      throw new SeedingRuntimeError(
        SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT,
        "Candidate must be an object",
        {}
      );
    }
    if (!isNonEmptyString(candidate.candidateReference)) {
      throw new SeedingRuntimeError(
        SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT,
        "Candidate requires candidateReference",
        { candidateId: candidate.candidateId }
      );
    }
    if (!isNonEmptyString(candidate.candidateIdentityKey)) {
      throw new SeedingRuntimeError(
        SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT,
        "Candidate requires candidateIdentityKey",
        { candidateReference: candidate.candidateReference }
      );
    }

    const ref = String(candidate.candidateReference);
    if (refs.has(ref)) {
      throw new SeedingRuntimeError(
        SEEDING_RUNTIME_ERROR_CODE.SEEDING_CANDIDATE_DUPLICATE,
        "Duplicate candidate reference",
        { candidateReference: ref }
      );
    }
    refs.add(ref);

    const identityKey = String(candidate.candidateIdentityKey);
    if (identityKeys.has(identityKey)) {
      throw new SeedingRuntimeError(
        SEEDING_RUNTIME_ERROR_CODE.SEEDING_IDENTITY_COLLISION,
        "Duplicate candidate identity key",
        { candidateIdentityKey: identityKey }
      );
    }
    identityKeys.add(identityKey);

    if (
      candidate.ratingValue != null &&
      !Number.isFinite(Number(candidate.ratingValue))
    ) {
      throw new SeedingRuntimeError(
        SEEDING_RUNTIME_ERROR_CODE.SEEDING_RATING_INVALID,
        "Candidate ratingValue must be finite when present",
        { candidateReference: ref }
      );
    }
  }

  return { ok: true };
}

/**
 * Validate manual seeds among eligible candidates.
 * @param {import('../contracts/seedingCandidate.js').SeedingCandidate[]} eligible
 */
export function validateManualSeeds(eligible = []) {
  /** @type {Map<number, string>} */
  const used = new Map();
  const n = eligible.length;

  for (const candidate of eligible) {
    if (candidate.manualSeed == null) continue;
    const seed = Number(candidate.manualSeed);
    if (!Number.isInteger(seed) || seed < 1 || seed > n) {
      throw new SeedingRuntimeError(
        SEEDING_RUNTIME_ERROR_CODE.SEEDING_MANUAL_SEED_INVALID,
        "Manual seed must be an integer between 1 and candidate count",
        {
          candidateReference: candidate.candidateReference,
          manualSeed: candidate.manualSeed,
          max: n,
        }
      );
    }
    if (used.has(seed)) {
      throw new SeedingRuntimeError(
        SEEDING_RUNTIME_ERROR_CODE.SEEDING_MANUAL_SEED_DUPLICATE,
        "Duplicate manual seed numbers are rejected",
        {
          seedNumber: seed,
          first: used.get(seed),
          second: candidate.candidateReference,
        }
      );
    }
    used.set(seed, candidate.candidateReference);
  }
}
