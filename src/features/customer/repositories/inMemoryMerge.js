/**
 * In-memory merge / duplicate candidate / history repository (CUSTOMER-06).
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { CustomerError } from "../errors/CustomerError.js";
import { createCustomerScope, scopesMatch } from "../domain/scope.js";
import { duplicateCandidatePairKey } from "../domain/duplicateCandidate.js";
import { cloneFrozen } from "./inMemory.js";
import { CUSTOMER_MERGE_REPOSITORY_PORTS } from "./mergePorts.js";

/**
 * @param {{ customerRepository?: object|null }} [deps]
 */
export function createInMemoryCustomerMergeRepository(deps = {}) {
  void deps;
  /** @type {Map<string, object>} */
  const candidates = new Map();
  /** @type {Map<string, object>} */
  const proposals = new Map();
  /** @type {Map<string, object>} */
  const history = new Map();

  function assertVersion(existing, expectedVersion, entityId) {
    if (expectedVersion == null) return;
    const expected = Number(expectedVersion);
    if (!existing) {
      if (expected !== 0) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
          "Merge entity version conflict on create.",
          { entityId, expectedVersion: expected, actualVersion: 0 }
        );
      }
      return;
    }
    if (!Number.isInteger(expected) || expected !== existing.version) {
      throw new CustomerError(
        CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
        "Merge entity version conflict.",
        {
          entityId,
          expectedVersion: expected,
          actualVersion: existing.version,
        }
      );
    }
  }

  return {
    port: CUSTOMER_MERGE_REPOSITORY_PORTS.CustomerMergeRepository,

    resetAllForTests() {
      candidates.clear();
      proposals.clear();
      history.clear();
    },

    async getCandidateById(scopeInput, candidateId) {
      const scope = createCustomerScope(scopeInput);
      const row = candidates.get(String(candidateId));
      if (!row || !scopesMatch(scope, row)) return null;
      return cloneFrozen(row);
    },

    async findCandidateByPair(scopeInput, customerIdA, customerIdB) {
      const scope = createCustomerScope(scopeInput);
      const key = duplicateCandidatePairKey(scope, customerIdA, customerIdB);
      for (const row of candidates.values()) {
        if (!scopesMatch(scope, row)) continue;
        const rowKey = duplicateCandidatePairKey(
          scope,
          row.customerIdA,
          row.customerIdB
        );
        if (rowKey === key) return cloneFrozen(row);
      }
      return null;
    },

    async listCandidates(scopeInput, query = {}) {
      const scope = createCustomerScope(scopeInput);
      const limit =
        Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 50;
      const offset =
        Number.isInteger(query.offset) && query.offset >= 0 ? query.offset : 0;
      const rows = [];
      for (const row of candidates.values()) {
        if (!scopesMatch(scope, row)) continue;
        if (query.status && row.status !== query.status) continue;
        if (
          query.customerId &&
          row.customerIdA !== query.customerId &&
          row.customerIdB !== query.customerId
        ) {
          continue;
        }
        rows.push(cloneFrozen(row));
      }
      rows.sort((a, b) =>
        String(a.candidateId).localeCompare(String(b.candidateId))
      );
      return rows.slice(offset, offset + limit);
    },

    async saveCandidate(candidate, options = {}) {
      const scope = createCustomerScope(candidate);
      const existing = candidates.get(candidate.candidateId);
      assertVersion(existing, options.expectedVersion, candidate.candidateId);

      // Canonical pair uniqueness within scope
      const pairKey = duplicateCandidatePairKey(
        scope,
        candidate.customerIdA,
        candidate.customerIdB
      );
      for (const row of candidates.values()) {
        if (row.candidateId === candidate.candidateId) continue;
        if (!scopesMatch(scope, row)) continue;
        const otherKey = duplicateCandidatePairKey(
          scope,
          row.customerIdA,
          row.customerIdB
        );
        if (otherKey === pairKey) {
          throw new CustomerError(
            CUSTOMER_ERROR_CODES.DUPLICATE_CANDIDATE_CONFLICT,
            "Duplicate candidate already exists for this ordered pair.",
            {
              existingCandidateId: row.candidateId,
              customerIdA: candidate.customerIdA,
              customerIdB: candidate.customerIdB,
            }
          );
        }
      }

      if (existing && candidate.version <= existing.version) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
          "Candidate version must increase on save.",
          {
            candidateId: candidate.candidateId,
            existingVersion: existing.version,
            receivedVersion: candidate.version,
          }
        );
      }

      const frozen = cloneFrozen(candidate);
      candidates.set(candidate.candidateId, frozen);
      return cloneFrozen(frozen);
    },

    async getProposalById(scopeInput, mergeProposalId) {
      const scope = createCustomerScope(scopeInput);
      const row = proposals.get(String(mergeProposalId));
      if (!row || !scopesMatch(scope, row)) return null;
      return cloneFrozen(row);
    },

    async listProposals(scopeInput, query = {}) {
      const scope = createCustomerScope(scopeInput);
      const limit =
        Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 50;
      const offset =
        Number.isInteger(query.offset) && query.offset >= 0 ? query.offset : 0;
      const rows = [];
      for (const row of proposals.values()) {
        if (!scopesMatch(scope, row)) continue;
        if (query.status && row.status !== query.status) continue;
        rows.push(cloneFrozen(row));
      }
      rows.sort((a, b) =>
        String(a.mergeProposalId).localeCompare(String(b.mergeProposalId))
      );
      return rows.slice(offset, offset + limit);
    },

    async saveProposal(proposal, options = {}) {
      const existing = proposals.get(proposal.mergeProposalId);
      assertVersion(existing, options.expectedVersion, proposal.mergeProposalId);
      if (existing && proposal.version <= existing.version) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
          "Proposal version must increase on save.",
          {
            mergeProposalId: proposal.mergeProposalId,
            existingVersion: existing.version,
            receivedVersion: proposal.version,
          }
        );
      }
      const frozen = cloneFrozen(proposal);
      proposals.set(proposal.mergeProposalId, frozen);
      return cloneFrozen(frozen);
    },

    async getHistoryById(scopeInput, mergeHistoryId) {
      const scope = createCustomerScope(scopeInput);
      const row = history.get(String(mergeHistoryId));
      if (!row || !scopesMatch(scope, row)) return null;
      return cloneFrozen(row);
    },

    async listHistory(scopeInput, query = {}) {
      const scope = createCustomerScope(scopeInput);
      const limit =
        Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 50;
      const offset =
        Number.isInteger(query.offset) && query.offset >= 0 ? query.offset : 0;
      const rows = [];
      for (const row of history.values()) {
        if (!scopesMatch(scope, row)) continue;
        if (
          query.survivorCustomerId &&
          row.survivorCustomerId !== query.survivorCustomerId
        ) {
          continue;
        }
        if (
          query.absorbedCustomerId &&
          row.absorbedCustomerId !== query.absorbedCustomerId
        ) {
          continue;
        }
        rows.push(cloneFrozen(row));
      }
      rows.sort((a, b) =>
        String(a.mergeHistoryId).localeCompare(String(b.mergeHistoryId))
      );
      return rows.slice(offset, offset + limit);
    },

    async appendHistory(record) {
      if (history.has(record.mergeHistoryId)) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.DUPLICATE,
          "Merge history is append-only and id already exists.",
          { mergeHistoryId: record.mergeHistoryId }
        );
      }
      const frozen = cloneFrozen(record);
      history.set(record.mergeHistoryId, frozen);
      return cloneFrozen(frozen);
    },
  };
}
