/**
 * CORE-12 Phase 1D-B1 / 1D-B2 — test-only provider doubles.
 *
 * NOT part of the production court-assignment barrel.
 * Import only from this module in tests.
 */

/**
 * Fixed eligibility provider for tests only (sync).
 * @param {object|((query: object) => object)} snapshotOrFactory
 */
export function createFixedEligibilitySnapshotProvider(snapshotOrFactory) {
  return Object.freeze({
    resolveEligibilitySnapshot(query) {
      if (typeof snapshotOrFactory === "function") {
        return snapshotOrFactory(query);
      }
      return snapshotOrFactory;
    },
  });
}

/**
 * Fixed eligibility provider for tests only (async).
 * @param {object|((query: object) => object|Promise<object>)} snapshotOrFactory
 */
export function createAsyncEligibilitySnapshotProvider(snapshotOrFactory) {
  return Object.freeze({
    async resolveEligibilitySnapshot(query) {
      if (typeof snapshotOrFactory === "function") {
        return snapshotOrFactory(query);
      }
      return snapshotOrFactory;
    },
  });
}

/**
 * Phase 1D-B2 — VenueEligibilityProvider double.
 * @param {object|((request: object) => object|Promise<object>)} evidenceOrFactory
 * @param {{ async?: boolean }} [options]
 */
export function createFixedVenueEligibilityProvider(
  evidenceOrFactory,
  options = {}
) {
  const run = (request) =>
    typeof evidenceOrFactory === "function"
      ? evidenceOrFactory(request)
      : evidenceOrFactory;
  if (options.async) {
    return Object.freeze({
      async resolveEligibility(request) {
        return run(request);
      },
    });
  }
  return Object.freeze({
    resolveEligibility(request) {
      return run(request);
    },
  });
}

/**
 * Phase 1D-B2 — CanonicalCourtDescriptorProvider double.
 * @param {object|((request: object) => object|Promise<object>)} envelopeOrFactory
 * @param {{ async?: boolean }} [options]
 */
export function createFixedCanonicalCourtDescriptorProvider(
  envelopeOrFactory,
  options = {}
) {
  const run = (request) =>
    typeof envelopeOrFactory === "function"
      ? envelopeOrFactory(request)
      : envelopeOrFactory;
  if (options.async) {
    return Object.freeze({
      async resolveDescriptors(request) {
        return run(request);
      },
    });
  }
  return Object.freeze({
    resolveDescriptors(request) {
      return run(request);
    },
  });
}
