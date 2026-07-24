/**
 * Merge / duplicate candidate repository ports (CUSTOMER-06).
 */

export const CUSTOMER_MERGE_REPOSITORY_PORTS = Object.freeze({
  DuplicateCandidateRepository: "DuplicateCandidateRepository",
  MergeProposalRepository: "MergeProposalRepository",
  MergeHistoryRepository: "MergeHistoryRepository",
  CustomerMergeRepository: "CustomerMergeRepository",
});

/**
 * @typedef {object} CustomerMergeRepository
 * @property {(scope: object, candidateId: string) => object|null|Promise<object|null>} getCandidateById
 * @property {(scope: object, customerIdA: string, customerIdB: string) => object|null|Promise<object|null>} findCandidateByPair
 * @property {(scope: object, query?: object) => object[]|Promise<object[]>} listCandidates
 * @property {(candidate: object, options?: { expectedVersion?: number|null }) => object|Promise<object>} saveCandidate
 * @property {(scope: object, mergeProposalId: string) => object|null|Promise<object|null>} getProposalById
 * @property {(scope: object, query?: object) => object[]|Promise<object[]>} listProposals
 * @property {(proposal: object, options?: { expectedVersion?: number|null }) => object|Promise<object>} saveProposal
 * @property {(scope: object, mergeHistoryId: string) => object|null|Promise<object|null>} getHistoryById
 * @property {(scope: object, query?: object) => object[]|Promise<object[]>} listHistory
 * @property {(history: object) => object|Promise<object>} appendHistory
 * @property {(payload: object) => object|Promise<object>} [executeMerge]
 */
