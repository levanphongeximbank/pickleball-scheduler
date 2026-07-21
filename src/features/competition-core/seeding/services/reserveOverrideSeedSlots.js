import { deepFreeze } from "../domain/deepFreeze.js";
import {
  AUTHORIZATION_DECISION,
  ELIGIBILITY_STATUS,
  MANUAL_OVERRIDE_MODE,
  OVERRIDE_ACTION,
  OVERRIDE_STATUS,
} from "../domain/constants.js";
import {
  sortOverridesDeterministically,
} from "../domain/normalizeManualSeedOverrides.js";
import { SEEDING_ERROR_CODE } from "../errors/seedingErrorCodes.js";

/**
 * @typedef {Object} RejectedOverrideRecord
 * @property {string} overrideId
 * @property {string} entryId
 * @property {string} action
 * @property {number|null} [requestedSeedNumber]
 * @property {string|null} [targetOverrideId]
 * @property {unknown} [actor]
 * @property {string} status
 * @property {ReadonlyArray<string>} reasonCodes
 * @property {Readonly<Record<string, unknown>>} policyProvenance
 * @property {import('../domain/normalizeSeedingScope.js').SeedingScope} scope
 * @property {Readonly<Record<string, unknown>>|null} [auditMetadata]
 */

/**
 * @typedef {Object} AcceptedClearRecord
 * @property {string} overrideId
 * @property {string} entryId
 * @property {string} action
 * @property {string} targetOverrideId
 * @property {string} status
 * @property {unknown} [actor]
 * @property {Readonly<Record<string, unknown>>} policyProvenance
 * @property {import('../domain/normalizeSeedingScope.js').SeedingScope} scope
 * @property {Readonly<Record<string, unknown>>|null} [auditMetadata]
 */

/**
 * @param {import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride} override
 * @param {string[]} reasonCodes
 * @param {import('../policies/normalizeSeedingPolicy.js').NormalizedSeedingPolicy} policy
 * @param {import('../domain/normalizeSeedingScope.js').SeedingScope} scope
 * @returns {RejectedOverrideRecord}
 */
function toRejected(override, reasonCodes, policy, scope) {
  return deepFreeze({
    overrideId: override.overrideId,
    entryId: override.entryId,
    action: override.action,
    requestedSeedNumber: override.requestedSeedNumber,
    targetOverrideId: override.targetOverrideId,
    actor: override.actor,
    status: OVERRIDE_STATUS.REJECTED,
    reasonCodes: deepFreeze(reasonCodes.slice()),
    policyProvenance: deepFreeze({
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
    }),
    scope,
    auditMetadata: override.auditMetadata,
  });
}

/**
 * @param {import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride} clear
 * @param {import('../policies/normalizeSeedingPolicy.js').NormalizedSeedingPolicy} policy
 * @param {import('../domain/normalizeSeedingScope.js').SeedingScope} scope
 * @returns {AcceptedClearRecord}
 */
function toAcceptedClear(clear, policy, scope) {
  return deepFreeze({
    overrideId: clear.overrideId,
    entryId: clear.entryId,
    action: OVERRIDE_ACTION.CLEAR,
    targetOverrideId: /** @type {string} */ (clear.targetOverrideId),
    status: OVERRIDE_STATUS.ACCEPTED,
    actor: clear.actor,
    policyProvenance: deepFreeze({
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
    }),
    scope,
    auditMetadata: clear.auditMetadata,
  });
}

/**
 * Compute max inclusive seed bound when maximumSeededEntries is set.
 * @param {import('../policies/normalizeSeedingPolicy.js').NormalizedSeedingPolicy} policy
 * @returns {number|null}
 */
export function computeSeedNumberUpperBound(policy) {
  if (policy.maximumSeededEntries == null) return null;
  return policy.seedNumberStart + policy.maximumSeededEntries - 1;
}

/**
 * Deterministic override conflict detection + slot reservation for DRAFT allocation.
 *
 * CLEAR (DRAFT): suppresses exactly one ASSIGN/PROTECT identified by
 * `targetOverrideId`. Never clears by entryId alone.
 *
 * @param {{
 *   overrides: ReadonlyArray<import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride>,
 *   candidatesByEntryId: Map<string, import('../domain/normalizeSeedingCandidate.js').SeedingCandidate>,
 *   policy: import('../policies/normalizeSeedingPolicy.js').NormalizedSeedingPolicy,
 *   scope: import('../domain/normalizeSeedingScope.js').SeedingScope,
 * }} input
 * @returns {{
 *   acceptedReservations: ReadonlyArray<{
 *     override: import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride,
 *     seedNumber: number,
 *     candidate: import('../domain/normalizeSeedingCandidate.js').SeedingCandidate,
 *   }>,
 *   acceptedClears: ReadonlyArray<AcceptedClearRecord>,
 *   rejectedOverrides: ReadonlyArray<RejectedOverrideRecord>,
 *   reservedSeedNumbers: ReadonlySet<number>,
 *   reservedEntryIds: ReadonlySet<string>,
 * }}
 */
export function reserveOverrideSeedSlots(input) {
  const { overrides, candidatesByEntryId, policy, scope } = input;
  const ordered = sortOverridesDeterministically(overrides || []);
  /** @type {RejectedOverrideRecord[]} */
  const rejected = [];
  /** @type {AcceptedClearRecord[]} */
  const acceptedClears = [];

  if (policy.manualOverrideMode === MANUAL_OVERRIDE_MODE.DISALLOW) {
    for (const ov of ordered) {
      rejected.push(
        toRejected(ov, [SEEDING_ERROR_CODE.OVERRIDE_UNAUTHORIZED], policy, scope)
      );
    }
    return deepFreeze({
      acceptedReservations: [],
      acceptedClears: [],
      rejectedOverrides: rejected,
      reservedSeedNumbers: new Set(),
      reservedEntryIds: new Set(),
    });
  }

  const upper = computeSeedNumberUpperBound(policy);

  /** @type {Map<string, import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride>} */
  const byId = new Map();
  for (const ov of ordered) {
    byId.set(ov.overrideId, ov);
  }

  /** @type {Set<string>} */
  const earlyRejectedIds = new Set();
  /** @type {import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride[]} */
  const clearRequests = [];
  /** @type {Map<string, import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride>} */
  const activeReserving = new Map();

  for (const ov of ordered) {
    const candidate = candidatesByEntryId.get(ov.entryId);
    const reasons = [];

    if (!candidate) {
      reasons.push(SEEDING_ERROR_CODE.INVALID_REQUEST);
    } else if (candidate.eligibilityStatus === ELIGIBILITY_STATUS.INELIGIBLE) {
      reasons.push(SEEDING_ERROR_CODE.ENTRY_INELIGIBLE);
    } else if (
      candidate.eligibilityStatus === ELIGIBILITY_STATUS.UNKNOWN &&
      policy.manualOverrideMode === MANUAL_OVERRIDE_MODE.REQUIRE_AUTHORIZED
    ) {
      reasons.push(SEEDING_ERROR_CODE.ELIGIBILITY_REQUIRED);
    }

    if (
      policy.manualOverrideMode === MANUAL_OVERRIDE_MODE.REQUIRE_AUTHORIZED &&
      ov.authorizationDecision !== AUTHORIZATION_DECISION.ALLOWED
    ) {
      reasons.push(SEEDING_ERROR_CODE.OVERRIDE_UNAUTHORIZED);
    } else if (ov.authorizationDecision === AUTHORIZATION_DECISION.DENIED) {
      reasons.push(SEEDING_ERROR_CODE.OVERRIDE_UNAUTHORIZED);
    }

    if (
      ov.action === OVERRIDE_ACTION.ASSIGN ||
      ov.action === OVERRIDE_ACTION.PROTECT
    ) {
      const seed = ov.requestedSeedNumber;
      if (
        seed == null ||
        seed < 1 ||
        seed < policy.seedNumberStart ||
        (upper != null && seed > upper)
      ) {
        reasons.push(SEEDING_ERROR_CODE.INVALID_REQUEST);
      }
    }

    if (reasons.length > 0) {
      rejected.push(toRejected(ov, reasons, policy, scope));
      earlyRejectedIds.add(ov.overrideId);
      continue;
    }

    if (ov.action === OVERRIDE_ACTION.CLEAR) {
      clearRequests.push(ov);
    } else {
      activeReserving.set(ov.overrideId, ov);
    }
  }

  // Duplicate CLEAR → same target: reject all such CLEARs fail-closed.
  /** @type {Map<string, import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride[]>} */
  const clearsByTarget = new Map();
  for (const clear of clearRequests) {
    const tid = /** @type {string} */ (clear.targetOverrideId);
    const list = clearsByTarget.get(tid) || [];
    list.push(clear);
    clearsByTarget.set(tid, list);
  }

  for (const clear of clearRequests) {
    const tid = /** @type {string} */ (clear.targetOverrideId);
    const peers = clearsByTarget.get(tid) || [];
    if (peers.length > 1) {
      rejected.push(
        toRejected(clear, [SEEDING_ERROR_CODE.OVERRIDE_CONFLICT], policy, scope)
      );
      continue;
    }

    const target = byId.get(tid);
    if (!target) {
      rejected.push(
        toRejected(clear, [SEEDING_ERROR_CODE.INVALID_REQUEST], policy, scope)
      );
      continue;
    }

    if (
      target.action !== OVERRIDE_ACTION.ASSIGN &&
      target.action !== OVERRIDE_ACTION.PROTECT
    ) {
      rejected.push(
        toRejected(clear, [SEEDING_ERROR_CODE.INVALID_REQUEST], policy, scope)
      );
      continue;
    }

    if (earlyRejectedIds.has(tid) || !activeReserving.has(tid)) {
      rejected.push(
        toRejected(clear, [SEEDING_ERROR_CODE.OVERRIDE_CONFLICT], policy, scope)
      );
      continue;
    }

    if (clear.entryId !== target.entryId) {
      rejected.push(
        toRejected(clear, [SEEDING_ERROR_CODE.INVALID_SCOPE], policy, scope)
      );
      continue;
    }

    // Same-request DRAFT: all overrides share the request SeedingScope.
    // Cross-scope marker: CLEAR may carry auditMetadata.scope that must match.
    const clearScopeMeta =
      clear.auditMetadata &&
      typeof clear.auditMetadata === "object" &&
      clear.auditMetadata.seedingScope
        ? /** @type {Record<string, unknown>} */ (clear.auditMetadata.seedingScope)
        : null;
    if (clearScopeMeta) {
      const mismatch =
        (clearScopeMeta.competitionId != null &&
          String(clearScopeMeta.competitionId) !== scope.competitionId) ||
        (clearScopeMeta.divisionId != null &&
          String(clearScopeMeta.divisionId) !== String(scope.divisionId)) ||
        (clearScopeMeta.categoryId != null &&
          String(clearScopeMeta.categoryId) !== String(scope.categoryId)) ||
        (clearScopeMeta.entryType != null &&
          String(clearScopeMeta.entryType) !== scope.entryType);
      if (mismatch) {
        rejected.push(
          toRejected(clear, [SEEDING_ERROR_CODE.INVALID_SCOPE], policy, scope)
        );
        continue;
      }
    }

    activeReserving.delete(tid);
    acceptedClears.push(toAcceptedClear(clear, policy, scope));
  }

  const afterClear = [...activeReserving.values()];

  /** @type {Map<number, import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride[]>} */
  const bySeed = new Map();
  /** @type {Map<string, import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride[]>} */
  const byEntry = new Map();
  for (const ov of afterClear) {
    const seedList = bySeed.get(ov.requestedSeedNumber) || [];
    seedList.push(ov);
    bySeed.set(ov.requestedSeedNumber, seedList);
    const entryList = byEntry.get(ov.entryId) || [];
    entryList.push(ov);
    byEntry.set(ov.entryId, entryList);
  }

  /** @type {Set<string>} */
  const conflictIds = new Set();
  for (const list of bySeed.values()) {
    if (list.length > 1) {
      for (const ov of list) conflictIds.add(ov.overrideId);
    }
  }
  for (const list of byEntry.values()) {
    if (list.length > 1) {
      for (const ov of list) conflictIds.add(ov.overrideId);
    }
  }

  /** @type {Array<{
   *   override: import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride,
   *   seedNumber: number,
   *   candidate: import('../domain/normalizeSeedingCandidate.js').SeedingCandidate,
   * }>} */
  const accepted = [];
  /** @type {Set<number>} */
  const reservedSeeds = new Set();
  /** @type {Set<string>} */
  const reservedEntries = new Set();

  for (const ov of afterClear) {
    if (conflictIds.has(ov.overrideId)) {
      const codes = [];
      const seedPeers = bySeed.get(ov.requestedSeedNumber) || [];
      const entryPeers = byEntry.get(ov.entryId) || [];
      if (seedPeers.length > 1) {
        codes.push(SEEDING_ERROR_CODE.DUPLICATE_SEED_NUMBER);
        codes.push(SEEDING_ERROR_CODE.OVERRIDE_CONFLICT);
      }
      if (entryPeers.length > 1) {
        codes.push(SEEDING_ERROR_CODE.OVERRIDE_CONFLICT);
      }
      rejected.push(toRejected(ov, [...new Set(codes)], policy, scope));
      continue;
    }
    const candidate = candidatesByEntryId.get(ov.entryId);
    accepted.push({
      override: ov,
      seedNumber: /** @type {number} */ (ov.requestedSeedNumber),
      candidate: /** @type {import('../domain/normalizeSeedingCandidate.js').SeedingCandidate} */ (
        candidate
      ),
    });
    reservedSeeds.add(/** @type {number} */ (ov.requestedSeedNumber));
    reservedEntries.add(ov.entryId);
  }

  rejected.sort((a, b) =>
    a.overrideId < b.overrideId ? -1 : a.overrideId > b.overrideId ? 1 : 0
  );
  acceptedClears.sort((a, b) =>
    a.overrideId < b.overrideId ? -1 : a.overrideId > b.overrideId ? 1 : 0
  );
  accepted.sort((a, b) =>
    a.override.overrideId < b.override.overrideId
      ? -1
      : a.override.overrideId > b.override.overrideId
        ? 1
        : 0
  );

  return {
    acceptedReservations: deepFreeze(accepted),
    acceptedClears: deepFreeze(acceptedClears),
    rejectedOverrides: deepFreeze(rejected),
    reservedSeedNumbers: reservedSeeds,
    reservedEntryIds: reservedEntries,
  };
}
