import { deepFreeze } from "../domain/deepFreeze.js";
import {
  CORE07_COMPARISON_CONTRACT_VERSION,
  CORE07_SEEDING_CONTRACT_VERSION,
} from "../domain/constants.js";
import { normalizeSeedingScope } from "../domain/normalizeSeedingScope.js";
import { normalizeSeedingCandidates } from "../domain/normalizeSeedingCandidates.js";
import { normalizeManualSeedOverrides } from "../domain/normalizeManualSeedOverrides.js";
import { createSeedingResult } from "../domain/createSeedingResult.js";
import { normalizeSeedingPolicy } from "../policies/normalizeSeedingPolicy.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
  normalizeOpaqueId,
} from "../domain/normalizeHelpers.js";
import { reserveOverrideSeedSlots } from "./reserveOverrideSeedSlots.js";
import { allocateSeedNumbers } from "./allocateSeedNumbers.js";
import { buildResultFingerprintPayload } from "./buildResultFingerprintPayload.js";
import {
  stringifyCanonicalJson,
} from "./buildAssignmentFingerprintPayload.js";
import {
  fingerprintCanonicalPayload,
  isFingerprintPort,
} from "../ports/FingerprintPort.js";

/**
 * Pure DRAFT seeding allocation runtime (Phase 1D).
 * Does not finalize, persist, or call Rule Engine / CORE-03 adapters.
 *
 * @param {{
 *   scope: unknown,
 *   candidates: unknown,
 *   policy: unknown,
 *   manualOverrides?: unknown,
 *   rankingRatingSnapshot?: {
 *     snapshotId: string,
 *     checksum?: string,
 *     fingerprint?: string,
 *     completenessState?: string,
 *     sourceSystem?: string,
 *     sourceVersion?: string,
 *   }|null,
 *   requireSnapshot?: boolean,
 *   deterministicContext: {
 *     effectiveAt: string|number,
 *     comparisonContractVersion?: string,
 *   },
 *   requestId: string,
 *   resultId: string,
 *   resultVersion: string|number,
 *   generatedAt: string|number,
 *   fingerprintPort: import('../ports/FingerprintPort.js').FingerprintPort,
 * }} input
 * @returns {Readonly<import('../domain/createSeedingResult.js').SeedingResult>}
 */
export function createDraftSeedingResult(input) {
  if (!input || typeof input !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "createDraftSeedingResult input is required"
    );
  }

  const requestId = normalizeOpaqueId(input.requestId);
  const resultId = normalizeOpaqueId(input.resultId);
  if (!requestId || !resultId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "requestId and resultId are required"
    );
  }
  if (input.resultVersion == null || input.resultVersion === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "resultVersion is required"
    );
  }
  if (input.generatedAt == null || input.generatedAt === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "generatedAt must be caller-supplied"
    );
  }
  if (!input.deterministicContext || input.deterministicContext.effectiveAt == null) {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "deterministicContext.effectiveAt is required"
    );
  }
  const compareVersion =
    input.deterministicContext.comparisonContractVersion ||
    CORE07_COMPARISON_CONTRACT_VERSION;
  if (compareVersion !== CORE07_COMPARISON_CONTRACT_VERSION) {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "Unsupported comparisonContractVersion",
      { comparisonContractVersion: compareVersion }
    );
  }
  if (!isFingerprintPort(input.fingerprintPort)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "FingerprintPort is required"
    );
  }

  const scope = normalizeSeedingScope(input.scope);
  const policy = normalizeSeedingPolicy(input.policy);

  const snapshot = input.rankingRatingSnapshot;
  if (input.requireSnapshot === true && (snapshot == null || !snapshot.snapshotId)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.SNAPSHOT_REQUIRED,
      "rankingRatingSnapshot is required by request"
    );
  }

  const candidates = normalizeSeedingCandidates(input.candidates, {
    scopeEntryType: scope.entryType,
    scopeDivisionId: scope.divisionId,
    scopeCategoryId: scope.categoryId,
  });

  const overrides = normalizeManualSeedOverrides(input.manualOverrides);

  /** @type {Map<string, import('../domain/normalizeSeedingCandidate.js').SeedingCandidate>} */
  const byEntry = new Map();
  for (const c of candidates) {
    byEntry.set(c.entryId, c);
  }

  const reservation = reserveOverrideSeedSlots({
    overrides,
    candidatesByEntryId: byEntry,
    policy,
    scope,
  });

  const snapshotId =
    snapshot && snapshot.snapshotId != null ? String(snapshot.snapshotId) : null;
  const snapshotProvenance =
    snapshot == null
      ? null
      : deepFreeze({
          snapshotId,
          checksum: snapshot.checksum ?? snapshot.fingerprint ?? null,
          completenessState: snapshot.completenessState ?? null,
          sourceSystem: snapshot.sourceSystem ?? null,
          sourceVersion: snapshot.sourceVersion ?? null,
        });

  const allocated = allocateSeedNumbers({
    candidates,
    policy,
    acceptedReservations: reservation.acceptedReservations,
    reservedSeedNumbers: reservation.reservedSeedNumbers,
    reservedEntryIds: reservation.reservedEntryIds,
    snapshotId,
    fingerprintPort: input.fingerprintPort,
  });

  const acceptedOverrideRows = reservation.acceptedReservations.map((r) => ({
    overrideId: r.override.overrideId,
    entryId: r.override.entryId,
    action: r.override.action,
    requestedSeedNumber: r.override.requestedSeedNumber,
  }));

  const fingerprintPayload = buildResultFingerprintPayload({
    scope,
    policy,
    candidates,
    orderedAssignments: allocated.orderedAssignments,
    acceptedOverrides: acceptedOverrideRows,
    snapshotProvenance,
    deterministicContext: {
      effectiveAt: input.deterministicContext.effectiveAt,
      comparisonContractVersion: compareVersion,
    },
  });

  const canonical = stringifyCanonicalJson(fingerprintPayload);
  const deterministicFingerprint = fingerprintCanonicalPayload(
    input.fingerprintPort,
    canonical
  );

  return createSeedingResult({
    contractVersion: CORE07_SEEDING_CONTRACT_VERSION,
    requestId,
    resultId,
    resultVersion: input.resultVersion,
    scope,
    orderedAssignments: allocated.orderedAssignments,
    eligibleUnseededEntries: allocated.eligibleUnseededEntries,
    excludedEntries: allocated.excludedEntries,
    rejectedOverrides: reservation.rejectedOverrides,
    warnings: [],
    acceptedClears: reservation.acceptedClears,
    policyProvenance: {
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
    },
    snapshotProvenance,
    deterministicContext: {
      effectiveAt: input.deterministicContext.effectiveAt,
      comparisonContractVersion: compareVersion,
    },
    deterministicFingerprint,
    generatedAt: input.generatedAt,
    finalizationState: "DRAFT",
  });
}
