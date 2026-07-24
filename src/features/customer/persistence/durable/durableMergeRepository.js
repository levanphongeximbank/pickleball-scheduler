/**
 * Durable Customer merge repository (CUSTOMER-06).
 * Reads via table select; transactional merge via customer_execute_merge RPC.
 */

import { CUSTOMER_ERROR_CODES } from "../../errors/codes.js";
import { CustomerError } from "../../errors/CustomerError.js";
import { createCustomerScope, scopesMatch } from "../../domain/scope.js";
import { duplicateCandidatePairKey, orderCustomerPair } from "../../domain/duplicateCandidate.js";
import { CUSTOMER_MERGE_REPOSITORY_PORTS } from "../../repositories/mergePorts.js";
import { cloneFrozen } from "../../repositories/inMemory.js";
import {
  CUSTOMER_PHASE_6_RPC,
  CUSTOMER_PHASE_6_TABLES,
  requireCustomerDatabaseClientPort,
} from "../databaseClientPort.js";
import { withCustomerPersistenceErrors } from "../errorTranslation.js";
import {
  mapCandidateDomainToRow,
  mapCandidateRowToDomain,
  mapMergeHistoryDomainToRow,
  mapMergeHistoryRowToDomain,
  mapProposalDomainToRow,
  mapProposalRowToDomain,
} from "../mapping/mergeMapping.js";
import {
  mapCustomerDomainToSavePayload,
} from "../mapping/customerMapping.js";

/**
 * @param {{ db: import('../databaseClientPort.js').CustomerDatabaseClientPort }} deps
 */
export function createDurableCustomerMergeRepository(deps = {}) {
  const db = requireCustomerDatabaseClientPort(deps.db);

  function scopeFilters(scope) {
    return { tenant_id: scope.tenantId, venue_id: scope.venueId };
  }

  return {
    port: CUSTOMER_MERGE_REPOSITORY_PORTS.CustomerMergeRepository,

    async getCandidateById(scopeInput, candidateId) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_6_TABLES.CANDIDATES,
          filters: {
            ...scopeFilters(scope),
            candidate_id: String(candidateId),
          },
          limit: 1,
        });
        if (!rows?.length) return null;
        return cloneFrozen(mapCandidateRowToDomain(rows[0]));
      });
    },

    async findCandidateByPair(scopeInput, customerIdA, customerIdB) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_6_TABLES.CANDIDATES,
          filters: scopeFilters(scope),
        });
        const key = duplicateCandidatePairKey(scope, customerIdA, customerIdB);
        for (const row of rows || []) {
          const domain = mapCandidateRowToDomain(row);
          if (!scopesMatch(scope, domain)) continue;
          const rowKey = duplicateCandidatePairKey(
            scope,
            domain.customerIdA,
            domain.customerIdB
          );
          if (rowKey === key) return cloneFrozen(domain);
        }
        return null;
      });
    },

    async listCandidates(scopeInput, query = {}) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_6_TABLES.CANDIDATES,
          filters: scopeFilters(scope),
          order: [{ column: "candidate_id", ascending: true }],
        });
        const limit =
          Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 50;
        const offset =
          Number.isInteger(query.offset) && query.offset >= 0 ? query.offset : 0;
        const mapped = (rows || [])
          .map((row) => mapCandidateRowToDomain(row))
          .filter((row) => {
            if (query.status && row.status !== query.status) return false;
            if (
              query.customerId &&
              row.customerIdA !== query.customerId &&
              row.customerIdB !== query.customerId
            ) {
              return false;
            }
            return true;
          });
        return mapped.slice(offset, offset + limit).map((r) => cloneFrozen(r));
      });
    },

    async saveCandidate(candidate, options = {}) {
      return withCustomerPersistenceErrors(async () => {
        const ordered = orderCustomerPair(
          candidate.customerIdA,
          candidate.customerIdB
        );
        const row = mapCandidateDomainToRow({
          ...candidate,
          customerIdA: ordered.customerIdA,
          customerIdB: ordered.customerIdB,
        });
        // Defensive: Postgres CHECK (customer_id_a < customer_id_b) must hold
        // even if a caller bypassed domain ordering.
        if (!(String(row.customer_id_a) < String(row.customer_id_b))) {
          throw new CustomerError(
            CUSTOMER_ERROR_CODES.INVALID_INPUT,
            "Duplicate candidate pair must be lexicographically ordered.",
            {
              customerIdA: row.customer_id_a,
              customerIdB: row.customer_id_b,
            }
          );
        }
        const result = await db.rpc({
          fn: CUSTOMER_PHASE_6_RPC.SAVE_CANDIDATE,
          args: {
            p_candidate: row,
            p_expected_version:
              options.expectedVersion == null
                ? null
                : Number(options.expectedVersion),
          },
        });
        return cloneFrozen(mapCandidateRowToDomain(result));
      });
    },

    async getProposalById(scopeInput, mergeProposalId) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_6_TABLES.PROPOSALS,
          filters: {
            ...scopeFilters(scope),
            merge_proposal_id: String(mergeProposalId),
          },
          limit: 1,
        });
        if (!rows?.length) return null;
        return cloneFrozen(mapProposalRowToDomain(rows[0]));
      });
    },

    async listProposals(scopeInput, query = {}) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_6_TABLES.PROPOSALS,
          filters: scopeFilters(scope),
          order: [{ column: "merge_proposal_id", ascending: true }],
        });
        const limit =
          Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 50;
        const offset =
          Number.isInteger(query.offset) && query.offset >= 0 ? query.offset : 0;
        return (rows || [])
          .map((row) => mapProposalRowToDomain(row))
          .filter((row) => !query.status || row.status === query.status)
          .slice(offset, offset + limit)
          .map((r) => cloneFrozen(r));
      });
    },

    async saveProposal(proposal, options = {}) {
      return withCustomerPersistenceErrors(async () => {
        const result = await db.rpc({
          fn: CUSTOMER_PHASE_6_RPC.SAVE_PROPOSAL,
          args: {
            p_proposal: mapProposalDomainToRow(proposal),
            p_expected_version:
              options.expectedVersion == null
                ? null
                : Number(options.expectedVersion),
          },
        });
        return cloneFrozen(mapProposalRowToDomain(result));
      });
    },

    async getHistoryById(scopeInput, mergeHistoryId) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_6_TABLES.HISTORY,
          filters: {
            ...scopeFilters(scope),
            merge_history_id: String(mergeHistoryId),
          },
          limit: 1,
        });
        if (!rows?.length) return null;
        return cloneFrozen(mapMergeHistoryRowToDomain(rows[0]));
      });
    },

    async listHistory(scopeInput, query = {}) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_6_TABLES.HISTORY,
          filters: scopeFilters(scope),
          order: [{ column: "merge_history_id", ascending: true }],
        });
        const limit =
          Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 50;
        const offset =
          Number.isInteger(query.offset) && query.offset >= 0 ? query.offset : 0;
        return (rows || [])
          .map((row) => mapMergeHistoryRowToDomain(row))
          .filter((row) => {
            if (
              query.survivorCustomerId &&
              row.survivorCustomerId !== query.survivorCustomerId
            ) {
              return false;
            }
            if (
              query.absorbedCustomerId &&
              row.absorbedCustomerId !== query.absorbedCustomerId
            ) {
              return false;
            }
            return true;
          })
          .slice(offset, offset + limit)
          .map((r) => cloneFrozen(r));
      });
    },

    async appendHistory(history) {
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.insert({
          table: CUSTOMER_PHASE_6_TABLES.HISTORY,
          rows: mapMergeHistoryDomainToRow(history),
          returning: true,
        });
        if (!rows?.length) {
          throw new CustomerError(
            CUSTOMER_ERROR_CODES.CONFLICT,
            "Failed to append merge history."
          );
        }
        return cloneFrozen(mapMergeHistoryRowToDomain(rows[0]));
      });
    },

    async executeMerge(payload) {
      return withCustomerPersistenceErrors(async () => {
        const survivorPayload = mapCustomerDomainToSavePayload(payload.survivor);
        const absorbedPayload = mapCustomerDomainToSavePayload(payload.absorbed);
        return db.rpc({
          fn: CUSTOMER_PHASE_6_RPC.EXECUTE_MERGE,
          args: {
            p_survivor: survivorPayload.customer,
            p_survivor_contacts: survivorPayload.contactPoints,
            p_survivor_addresses: survivorPayload.addresses,
            p_absorbed: absorbedPayload.customer,
            p_history: mapMergeHistoryDomainToRow(payload.history),
            p_proposal: mapProposalDomainToRow(payload.proposal),
          },
        });
      });
    },
  };
}
