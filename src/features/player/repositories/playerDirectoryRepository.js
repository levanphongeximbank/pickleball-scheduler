/**
 * Phase 1I-A — Player Directory repository port (infrastructure-agnostic).
 *
 * Implementations must not invent eligibility; they call the durable read RPCs
 * (1I-B) and project strict Directory DTOs.
 */

/**
 * @typedef {object} DirectorySearchRequest
 * @property {string} query
 * @property {string|null} activityRegion
 * @property {string|null} cursor
 * @property {object|null} [decodedCursor]
 * @property {number} limit
 */

/**
 * @typedef {object} DirectorySearchRepositoryResult
 * @property {boolean} ok
 * @property {string|null} [code]
 * @property {string|null} [message]
 * @property {object[]} [items]
 * @property {string|null} [nextCursor]
 */

/**
 * @typedef {object} DirectoryDetailRepositoryResult
 * @property {boolean} ok
 * @property {string|null} [code]
 * @property {string|null} [message]
 * @property {object|null} [player]
 */

/**
 * @typedef {object} PlayerDirectoryRepository
 * @property {(request: DirectorySearchRequest) => Promise<DirectorySearchRepositoryResult>} directorySearch
 * @property {(playerId: string) => Promise<DirectoryDetailRepositoryResult>} directoryGetByPlayerId
 */

/**
 * Create an in-memory / mock directory repository for tests.
 * @param {Partial<PlayerDirectoryRepository>} impl
 * @returns {PlayerDirectoryRepository}
 */
export function createPlayerDirectoryRepository(impl = {}) {
  return {
    async directorySearch(request) {
      if (typeof impl.directorySearch === "function") {
        return impl.directorySearch(request);
      }
      return {
        ok: false,
        code: "DIRECTORY_BACKEND_UNAVAILABLE",
        message: "Directory search repository is not configured",
        items: [],
        nextCursor: null,
      };
    },
    async directoryGetByPlayerId(playerId) {
      if (typeof impl.directoryGetByPlayerId === "function") {
        return impl.directoryGetByPlayerId(playerId);
      }
      return {
        ok: false,
        code: "DIRECTORY_BACKEND_UNAVAILABLE",
        message: "Directory detail repository is not configured",
        player: null,
      };
    },
  };
}
