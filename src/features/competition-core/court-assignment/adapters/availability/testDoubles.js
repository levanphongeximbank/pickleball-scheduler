/**
 * CORE-12 Phase 1D-B1 — test-only eligibility provider doubles.
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
