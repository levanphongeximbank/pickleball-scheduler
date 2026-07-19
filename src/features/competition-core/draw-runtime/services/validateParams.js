/**
 * Phase 3H — candidate / placement / group / bracket validation.
 */

import { isNonEmptyString } from "../../participants/contracts/shared.js";
import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { DrawRuntimeError } from "../errors/DrawRuntimeError.js";

/**
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 */
export function validateCandidates(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_REQUIRED,
      "At least one draw candidate is required",
      {}
    );
  }

  /** @type {Set<string>} */
  const refs = new Set();
  /** @type {Set<string>} */
  const identityKeys = new Set();

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
        "Candidate must be an object",
        {}
      );
    }
    if (!isNonEmptyString(candidate.candidateReference)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
        "Candidate requires candidateReference",
        { candidateId: candidate.candidateId }
      );
    }
    if (!isNonEmptyString(candidate.candidateIdentityKey)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
        "Candidate requires candidateIdentityKey",
        { candidateReference: candidate.candidateReference }
      );
    }

    const ref = String(candidate.candidateReference);
    if (refs.has(ref)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_DUPLICATE,
        "Duplicate candidate reference",
        { candidateReference: ref }
      );
    }
    refs.add(ref);

    const identityKey = String(candidate.candidateIdentityKey);
    if (identityKeys.has(identityKey)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_IDENTITY_COLLISION,
        "Duplicate candidate identity key",
        { candidateIdentityKey: identityKey }
      );
    }
    identityKeys.add(identityKey);
  }

  return { ok: true };
}

/**
 * @param {number|null|undefined} groupCount
 * @param {number} candidateCount
 * @param {number|null|undefined} groupCapacity
 */
export function validateGroupParams(groupCount, candidateCount, groupCapacity) {
  if (groupCount == null || !Number.isInteger(groupCount) || groupCount < 1) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_COUNT_INVALID,
      "groupCount must be a positive integer",
      { groupCount }
    );
  }
  if (
    groupCapacity != null &&
    (!Number.isInteger(groupCapacity) || groupCapacity < 1)
  ) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_CAPACITY_INVALID,
      "groupCapacity must be a positive integer when provided",
      { groupCapacity }
    );
  }
  if (
    groupCapacity != null &&
    groupCount * groupCapacity < candidateCount
  ) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_OVERFLOW,
      "groupCount * groupCapacity cannot hold all candidates",
      { groupCount, groupCapacity, candidateCount }
    );
  }
}

/**
 * @param {number} n
 * @returns {boolean}
 */
export function isPowerOfTwo(n) {
  return Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
}

/**
 * @param {number|null|undefined} bracketSize
 * @param {number} candidateCount
 * @param {{ allowNonPowerOfTwo?: boolean }} [options]
 */
export function validateBracketParams(bracketSize, candidateCount, options = {}) {
  if (bracketSize == null || !Number.isInteger(bracketSize) || bracketSize < 2) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_BRACKET_SIZE_INVALID,
      "bracketSize must be an integer >= 2",
      { bracketSize }
    );
  }
  if (!isPowerOfTwo(bracketSize) && options.allowNonPowerOfTwo !== true) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_BRACKET_SIZE_INVALID,
      "bracketSize must be a power of two unless allowNonPowerOfTwo is true",
      { bracketSize }
    );
  }
  if (candidateCount > bracketSize) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_BRACKET_SIZE_INVALID,
      "candidate count exceeds bracketSize",
      { bracketSize, candidateCount }
    );
  }
  const byeCount = bracketSize - candidateCount;
  if (byeCount < 0) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_BYE_COUNT_INVALID,
      "bye count cannot be negative",
      { bracketSize, candidateCount }
    );
  }
}

/**
 * Validate manual/protected placement uniqueness before auto-fill.
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {"group"|"bracket"} layout
 * @param {{ groupCount?: number|null, bracketSize?: number|null }} bounds
 */
export function validateManualAndProtected(candidates, layout, bounds = {}) {
  /** @type {Map<string, string>} */
  const groupPos = new Map();
  /** @type {Map<number, string>} */
  const slots = new Map();

  for (const candidate of candidates) {
    const mp = candidate.manualPlacement;
    if (!mp) continue;

    if (layout === "group") {
      if (mp.groupNumber == null) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_INVALID,
          "Manual group placement requires groupNumber",
          { candidateReference: candidate.candidateReference }
        );
      }
      const gn = Number(mp.groupNumber);
      if (
        bounds.groupCount != null &&
        (gn < 1 || gn > bounds.groupCount)
      ) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_INVALID,
          "Manual groupNumber out of range",
          { groupNumber: gn, groupCount: bounds.groupCount }
        );
      }
      const pos = mp.positionNumber != null ? Number(mp.positionNumber) : 0;
      const key = `${gn}::${pos}`;
      if (groupPos.has(key) && pos !== 0) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_DUPLICATE,
          "Duplicate manual group position",
          {
            groupNumber: gn,
            positionNumber: pos,
            first: groupPos.get(key),
            second: candidate.candidateReference,
          }
        );
      }
      if (pos !== 0) groupPos.set(key, candidate.candidateReference);
    }

    if (layout === "bracket") {
      if (mp.slotNumber == null) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_INVALID,
          "Manual bracket placement requires slotNumber",
          { candidateReference: candidate.candidateReference }
        );
      }
      const slot = Number(mp.slotNumber);
      if (
        bounds.bracketSize != null &&
        (slot < 1 || slot > bounds.bracketSize)
      ) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_SLOT_INVALID,
          "Manual slotNumber out of range",
          { slotNumber: slot, bracketSize: bounds.bracketSize }
        );
      }
      if (slots.has(slot)) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_DUPLICATE,
          "Duplicate manual bracket slot",
          {
            slotNumber: slot,
            first: slots.get(slot),
            second: candidate.candidateReference,
          }
        );
      }
      slots.set(slot, candidate.candidateReference);
    }
  }
}
