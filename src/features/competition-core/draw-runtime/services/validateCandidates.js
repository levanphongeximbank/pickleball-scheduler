/**
 * Phase 3H — merge candidates with seed assignment references.
 */

import { createDrawCandidate } from "../contracts/drawCandidate.js";
import { mapSeedAssignmentToReference } from "../contracts/drawSeedReference.js";
import { buildCandidateIdentityKey } from "../contracts/drawIdentity.js";
import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { DrawRuntimeError } from "../errors/DrawRuntimeError.js";
import { normalizeCandidates } from "./normalizeCandidates.js";

/**
 * Extract candidateReference from a seed assignment's candidateIdentityKey
 * when the key follows `...::CANDIDATE::ref` pattern, else use metadata.
 * @param {import('../contracts/drawSeedReference.js').DrawSeedReference} ref
 * @param {string} drawIdentityKey
 * @returns {string}
 */
function resolveReferenceFromSeed(ref, drawIdentityKey) {
  if (ref.candidateReference) return String(ref.candidateReference);
  const key = String(ref.candidateIdentityKey || "");
  const marker = "::CANDIDATE::";
  const idx = key.lastIndexOf(marker);
  if (idx >= 0) return key.slice(idx + marker.length);
  // If seed provides a foreign candidateIdentityKey, keep it as reference suffix
  if (key) return key;
  return `seed-${ref.seedNumber}`;
}

/**
 * @param {{
 *   candidates?: Array<Record<string, unknown>>,
 *   seedAssignments?: Array<Record<string, unknown>>,
 *   competitionId: string,
 *   contextId: string,
 *   drawIdentityKey: string,
 * }} input
 * @returns {import('../contracts/drawCandidate.js').DrawCandidate[]}
 */
export function mergeCandidatesAndSeeds(input) {
  const {
    candidates: rawCandidates = [],
    seedAssignments: rawSeeds = [],
    competitionId,
    contextId,
    drawIdentityKey,
  } = input;

  const hasCandidates = Array.isArray(rawCandidates) && rawCandidates.length > 0;
  const hasSeeds = Array.isArray(rawSeeds) && rawSeeds.length > 0;

  if (!hasCandidates && !hasSeeds) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_REQUIRED,
      "candidates[] or seedAssignments[] is required",
      {}
    );
  }

  const seedRefs = (rawSeeds || []).map((row) => mapSeedAssignmentToReference(row));

  /** @type {Map<number, string>} */
  const seedNumbers = new Map();
  for (const ref of seedRefs) {
    if (!Number.isFinite(ref.seedNumber) || ref.seedNumber < 1) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
        "seedAssignment.seedNumber must be a positive finite number",
        { seedNumber: ref.seedNumber }
      );
    }
    if (!ref.candidateIdentityKey && !ref.candidateReference) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_SEED_ASSIGNMENT_REQUIRED,
        "seedAssignment requires candidateIdentityKey or candidateReference",
        { seedNumber: ref.seedNumber }
      );
    }
    if (seedNumbers.has(ref.seedNumber)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_SEED_ASSIGNMENT_DUPLICATE,
        "Duplicate seedAssignment seedNumber",
        { seedNumber: ref.seedNumber }
      );
    }
    seedNumbers.set(ref.seedNumber, ref.candidateIdentityKey || ref.candidateReference || "");
  }

  if (hasCandidates && !hasSeeds) {
    return normalizeCandidates(rawCandidates, {
      competitionId,
      contextId,
      drawIdentityKey,
    });
  }

  if (!hasCandidates && hasSeeds) {
    return seedRefs.map((ref, index) => {
      const candidateReference = resolveReferenceFromSeed(ref, drawIdentityKey);
      // Prefer foreign candidateIdentityKey from seeding when present & non-empty
      const foreignKey = String(ref.candidateIdentityKey || "").trim();
      const candidateIdentityKey =
        foreignKey ||
        buildCandidateIdentityKey({
          drawIdentityKey,
          candidateReference,
        });

      return createDrawCandidate({
        competitionId,
        contextId,
        drawIdentityKey,
        candidateId: candidateReference || `seed-cand-${index + 1}`,
        candidateReference,
        candidateIdentityKey,
        seedNumber: ref.seedNumber,
        seedTier: ref.seedTier,
        seedAssignmentReference: ref.assignmentIdentityKey,
        metadata: ref.metadata,
      });
    });
  }

  // Both: join on candidateIdentityKey (draw-local or foreign)
  const normalized = normalizeCandidates(rawCandidates, {
    competitionId,
    contextId,
    drawIdentityKey,
  });

  /** @type {Map<string, typeof seedRefs[0]>} */
  const byCandKey = new Map();
  /** @type {Map<string, typeof seedRefs[0]>} */
  const byRef = new Map();
  for (const ref of seedRefs) {
    if (ref.candidateIdentityKey) {
      if (byCandKey.has(ref.candidateIdentityKey)) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_SEED_ASSIGNMENT_DUPLICATE,
          "Duplicate seedAssignment candidateIdentityKey",
          { candidateIdentityKey: ref.candidateIdentityKey }
        );
      }
      byCandKey.set(ref.candidateIdentityKey, ref);
    }
    const cref = resolveReferenceFromSeed(ref, drawIdentityKey);
    if (cref) byRef.set(cref, ref);
  }

  const usedSeedKeys = new Set();
  const merged = normalized.map((candidate) => {
    let ref =
      byCandKey.get(candidate.candidateIdentityKey) ||
      byRef.get(candidate.candidateReference) ||
      null;

    // Also try matching seeding-style key embedded in candidateIdentityKey suffix
    if (!ref) {
      for (const [key, value] of byCandKey) {
        if (key.endsWith(`::CANDIDATE::${candidate.candidateReference}`)) {
          ref = value;
          break;
        }
      }
    }

    if (!ref) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_IDENTITY_MISMATCH,
        "Candidate has no matching seedAssignment",
        {
          candidateIdentityKey: candidate.candidateIdentityKey,
          candidateReference: candidate.candidateReference,
        }
      );
    }

    usedSeedKeys.add(ref.assignmentIdentityKey);
    return createDrawCandidate({
      ...candidate,
      competitionId,
      contextId,
      drawIdentityKey,
      seedNumber: ref.seedNumber,
      seedTier: ref.seedTier ?? candidate.seedTier,
      seedAssignmentReference: ref.assignmentIdentityKey,
    });
  });

  if (usedSeedKeys.size !== seedRefs.length) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_IDENTITY_MISMATCH,
      "seedAssignment set does not fully join to candidates",
      {
        candidateCount: normalized.length,
        seedCount: seedRefs.length,
        joined: usedSeedKeys.size,
      }
    );
  }

  return merged;
}
