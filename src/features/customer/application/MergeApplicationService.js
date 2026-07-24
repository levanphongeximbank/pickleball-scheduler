/**
 * Customer Merge Application Service (CUSTOMER-06).
 *
 * Search, duplicate detection, merge proposals, and merge execution.
 * No auto-merge. Approval required (approvalReference or MergeApprovalPort).
 */

import { CUSTOMER_DUPLICATE_CANDIDATE_STATUS } from "../constants/duplicateCandidateStatuses.js";
import { CUSTOMER_DUPLICATE_CLASSIFICATION } from "../constants/duplicateClassifications.js";
import { CUSTOMER_STATUS } from "../constants/customerStatuses.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import {
  createDuplicateCandidate,
  isDuplicateCandidateStale,
} from "../domain/duplicateCandidate.js";
import { evaluateCustomerPair } from "../domain/duplicateEvaluation.js";
import {
  requireMergeApprovalPort,
} from "../domain/mergeApproval.js";
import {
  CUSTOMER_MERGE_APPROVAL_STATUS,
  CUSTOMER_MERGE_STATUS,
  createRichCustomerMergeProposal,
} from "../domain/mergeContract.js";
import { buildMergeResultSnapshots } from "../domain/mergeExecution.js";
import {
  resolveCanonicalCustomerId,
  resolveMergedCustomer,
} from "../domain/mergeRedirect.js";
import { createCustomerScope, scopesMatch } from "../domain/scope.js";
import {
  createCustomerSearchQuery,
} from "../domain/searchQuery.js";
import {
  projectCustomerDuplicateCandidateView,
  projectCustomerMergeProposalView,
  projectCustomerMergeResultView,
  projectCustomerRedirectView,
  projectCustomerSearchResultView,
} from "../projectors/mergeViews.js";
import {
  createSequentialCustomerIdGenerator,
  createSystemCustomerClock,
} from "../repositories/ports.js";
import { cloneFrozen } from "../repositories/inMemory.js";

/**
 * @param {object} [deps]
 */
export function createMergeApplicationService(deps = {}) {
  const customerRepository = deps.customerRepository ?? null;
  const mergeRepository = deps.mergeRepository ?? null;
  const linkageRepository = deps.linkageRepository ?? null;
  const consentPreferenceRepository = deps.consentPreferenceRepository ?? null;
  const mergeApprovalPort = deps.mergeApprovalPort ?? null;
  const clock = deps.clock || createSystemCustomerClock();
  const idGenerator = deps.idGenerator || createSequentialCustomerIdGenerator();

  function domainDeps() {
    return {
      nowIso: () => clock.nowIso(),
      nextId: (prefix) => idGenerator.nextId(prefix),
    };
  }

  function requireCustomerRepo() {
    if (!customerRepository) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
        "Customer Management runtime adapter is not configured.",
        { adapter: "CustomerRepository" }
      );
    }
    return customerRepository;
  }

  function requireMergeRepo() {
    if (!mergeRepository) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
        "Customer merge repository is not configured.",
        { adapter: "CustomerMergeRepository" }
      );
    }
    return mergeRepository;
  }

  async function loadCustomer(scope, customerId) {
    const repo = requireCustomerRepo();
    const s = createCustomerScope(scope);
    const found = await repo.getById(s, customerId);
    if (!found) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.NOT_FOUND,
        "Customer not found.",
        { customerId, tenantId: s.tenantId, venueId: s.venueId }
      );
    }
    return { scope: s, customer: found };
  }

  async function loadLinkages(scope, customerId) {
    if (!linkageRepository || typeof linkageRepository.listByCustomer !== "function") {
      return [];
    }
    return linkageRepository.listByCustomer(scope, customerId);
  }

  async function filterByExternalReference(scope, rows, externalReference) {
    if (!externalReference) return rows;
    if (!linkageRepository) {
      return [];
    }
    const filtered = [];
    for (const row of rows) {
      const linkages = await loadLinkages(scope, row.customerId);
      const hit = (linkages || []).some(
        (l) =>
          String(l.linkageType || "") === externalReference.type &&
          String(l.externalReferenceId || "") === externalReference.id
      );
      if (hit) filtered.push(row);
    }
    return filtered;
  }

  return Object.freeze({
    async searchCustomers(scope, queryInput = {}) {
      const repo = requireCustomerRepo();
      const s = createCustomerScope(scope);
      const query = createCustomerSearchQuery(queryInput);
      let rows = await repo.search(s, query);
      rows = await filterByExternalReference(s, rows, query.externalReference);
      return Object.freeze(
        rows.map((row) => projectCustomerSearchResultView(row))
      );
    },

    async findExactCustomerMatches(scope, criteria = {}) {
      const repo = requireCustomerRepo();
      const s = createCustomerScope(scope);
      /** @type {object[]} */
      const matches = [];

      if (criteria.customerId) {
        const row = await repo.getById(s, criteria.customerId);
        if (row) matches.push(row);
      }
      if (criteria.customerNumber) {
        const row = await repo.findByCustomerNumber(s, criteria.customerNumber);
        if (row && !matches.some((m) => m.customerId === row.customerId)) {
          matches.push(row);
        }
      }
      if (criteria.email || criteria.phone) {
        const query = createCustomerSearchQuery({
          email: criteria.email,
          phone: criteria.phone,
          includeMerged: criteria.includeMerged === true,
          limit: 50,
        });
        const rows = await repo.search(s, query);
        for (const row of rows) {
          if (!matches.some((m) => m.customerId === row.customerId)) {
            matches.push(row);
          }
        }
      }
      if (criteria.externalReference) {
        const all = await repo.search(s, {
          includeMerged: criteria.includeMerged === true,
          limit: 200,
        });
        const filtered = await filterByExternalReference(
          s,
          all,
          {
            type: String(criteria.externalReference.type || "").trim(),
            id: String(criteria.externalReference.id || "").trim(),
          }
        );
        for (const row of filtered) {
          if (!matches.some((m) => m.customerId === row.customerId)) {
            matches.push(row);
          }
        }
      }

      return Object.freeze(
        matches.map((row) => projectCustomerSearchResultView(row))
      );
    },

    async resolveCanonicalCustomerId(scope, customerId) {
      const repo = requireCustomerRepo();
      const s = createCustomerScope(scope);
      return resolveCanonicalCustomerId(s, customerId, {
        getById: (sc, id) => repo.getById(sc, id),
      });
    },

    async resolveMergedCustomer(scope, customerId) {
      const repo = requireCustomerRepo();
      const s = createCustomerScope(scope);
      const result = await resolveMergedCustomer(s, customerId, {
        getById: (sc, id) => repo.getById(sc, id),
      });
      return projectCustomerRedirectView(result);
    },

    async evaluateCustomerPair(scope, customerIdA, customerIdB) {
      const { scope: s, customer: a } = await loadCustomer(scope, customerIdA);
      const bLoad = await loadCustomer(s, customerIdB);
      if (!scopesMatch(a, bLoad.customer)) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.SCOPE_MISMATCH,
          "Customers must share the same scope for evaluation."
        );
      }
      const linkagesA = await loadLinkages(s, a.customerId);
      const linkagesB = await loadLinkages(s, bLoad.customer.customerId);
      const evaluation = evaluateCustomerPair(a, bLoad.customer, {
        linkagesA,
        linkagesB,
      });
      return Object.freeze({
        customerIdA: a.customerId,
        customerIdB: bLoad.customer.customerId,
        customerVersionA: a.version,
        customerVersionB: bLoad.customer.version,
        ...evaluation,
      });
    },

    async detectDuplicateCandidates(scope, options = {}) {
      const repo = requireCustomerRepo();
      const s = createCustomerScope(scope);
      const limit =
        Number.isInteger(options.limit) && options.limit > 0
          ? options.limit
          : 100;
      const customers = await repo.search(s, {
        includeMerged: false,
        limit: Math.min(limit * 2, 200),
      });
      /** @type {object[]} */
      const created = [];
      for (let i = 0; i < customers.length; i += 1) {
        for (let j = i + 1; j < customers.length; j += 1) {
          const evaluation = await this.evaluateCustomerPair(
            s,
            customers[i].customerId,
            customers[j].customerId
          );
          if (
            evaluation.classification ===
              CUSTOMER_DUPLICATE_CLASSIFICATION.NOT_DUPLICATE ||
            evaluation.classification ===
              CUSTOMER_DUPLICATE_CLASSIFICATION.INSUFFICIENT_EVIDENCE
          ) {
            continue;
          }
          const candidate = await this.createOrRefreshDuplicateCandidate(s, {
            customerIdA: customers[i].customerId,
            customerIdB: customers[j].customerId,
            source: options.source || "DETECT",
          });
          created.push(candidate);
          if (created.length >= limit) {
            return Object.freeze(created);
          }
        }
      }
      return Object.freeze(created);
    },

    async createOrRefreshDuplicateCandidate(scope, input = {}) {
      const mergeRepo = requireMergeRepo();
      const s = createCustomerScope(scope);
      const evaluation = await this.evaluateCustomerPair(
        s,
        input.customerIdA,
        input.customerIdB
      );
      const existing = await mergeRepo.findCandidateByPair(
        s,
        input.customerIdA,
        input.customerIdB
      );

      const status =
        evaluation.classification ===
          CUSTOMER_DUPLICATE_CLASSIFICATION.CONFLICTING_IDENTITIES ||
        evaluation.classification ===
          CUSTOMER_DUPLICATE_CLASSIFICATION.REQUIRES_MANUAL_REVIEW
          ? CUSTOMER_DUPLICATE_CANDIDATE_STATUS.REVIEW_REQUIRED
          : CUSTOMER_DUPLICATE_CANDIDATE_STATUS.OPEN;

      const payload = createDuplicateCandidate(
        {
          candidateId: existing?.candidateId,
          customerIdA: input.customerIdA,
          customerIdB: input.customerIdB,
          tenantId: s.tenantId,
          venueId: s.venueId,
          classification: evaluation.classification,
          score: evaluation.score,
          signals: evaluation.signals,
          conflicts: evaluation.conflicts,
          reasonCodes: evaluation.reasonCodes,
          status: existing?.status === CUSTOMER_DUPLICATE_CANDIDATE_STATUS.REJECTED
            ? CUSTOMER_DUPLICATE_CANDIDATE_STATUS.REJECTED
            : existing?.status === CUSTOMER_DUPLICATE_CANDIDATE_STATUS.RESOLVED
              ? CUSTOMER_DUPLICATE_CANDIDATE_STATUS.RESOLVED
              : status,
          evaluatedVersions: {
            [evaluation.customerIdA]: evaluation.customerVersionA,
            [evaluation.customerIdB]: evaluation.customerVersionB,
          },
          detectedAt: existing?.detectedAt,
          version: existing ? existing.version + 1 : 1,
          source: input.source || existing?.source || "SYSTEM",
          reviewedAt: existing?.reviewedAt,
          reviewReference: existing?.reviewReference,
        },
        domainDeps()
      );

      const saved = await mergeRepo.saveCandidate(payload, {
        expectedVersion: existing ? existing.version : 0,
      });
      return projectCustomerDuplicateCandidateView(saved);
    },

    async listDuplicateCandidates(scope, query = {}) {
      const mergeRepo = requireMergeRepo();
      const s = createCustomerScope(scope);
      const rows = await mergeRepo.listCandidates(s, query);
      return Object.freeze(
        rows.map((row) => projectCustomerDuplicateCandidateView(row))
      );
    },

    async rejectDuplicateCandidate(scope, candidateId, options = {}) {
      const mergeRepo = requireMergeRepo();
      const s = createCustomerScope(scope);
      const existing = await mergeRepo.getCandidateById(s, candidateId);
      if (!existing) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.DUPLICATE_CANDIDATE_NOT_FOUND,
          "Duplicate candidate not found.",
          { candidateId }
        );
      }
      const next = createDuplicateCandidate(
        {
          ...existing,
          status: CUSTOMER_DUPLICATE_CANDIDATE_STATUS.REJECTED,
          reviewedAt: clock.nowIso(),
          reviewReference: options.reviewReference || null,
          version: existing.version + 1,
        },
        domainDeps()
      );
      const saved = await mergeRepo.saveCandidate(next, {
        expectedVersion: existing.version,
      });
      return projectCustomerDuplicateCandidateView(saved);
    },

    async createMergeProposal(scope, input = {}) {
      const mergeRepo = requireMergeRepo();
      const s = createCustomerScope(scope);
      const { customer: survivor } = await loadCustomer(
        s,
        input.survivorCustomerId
      );
      const { customer: absorbed } = await loadCustomer(
        s,
        input.absorbedCustomerId || input.duplicateCustomerId
      );

      if (input.candidateId) {
        const candidate = await mergeRepo.getCandidateById(s, input.candidateId);
        if (!candidate) {
          throwCustomerError(
            CUSTOMER_ERROR_CODES.DUPLICATE_CANDIDATE_NOT_FOUND,
            "Duplicate candidate not found.",
            { candidateId: input.candidateId }
          );
        }
        if (isDuplicateCandidateStale(candidate, survivor, absorbed)) {
          throwCustomerError(
            CUSTOMER_ERROR_CODES.DUPLICATE_CANDIDATE_STALE,
            "Duplicate candidate is stale relative to customer versions.",
            { candidateId: input.candidateId }
          );
        }
      }

      const evaluation = await this.evaluateCustomerPair(
        s,
        survivor.customerId,
        absorbed.customerId
      );

      const proposal = createRichCustomerMergeProposal(
        {
          ...input,
          tenantId: s.tenantId,
          venueId: s.venueId,
          survivorCustomerId: survivor.customerId,
          absorbedCustomerId: absorbed.customerId,
          expectedSurvivorVersion:
            input.expectedSurvivorVersion ?? survivor.version,
          expectedAbsorbedVersion:
            input.expectedAbsorbedVersion ?? absorbed.version,
          conflicts: evaluation.conflicts,
          status: CUSTOMER_MERGE_STATUS.DRAFT,
          approvalStatus: CUSTOMER_MERGE_APPROVAL_STATUS.PENDING,
        },
        domainDeps()
      );

      const saved = await mergeRepo.saveProposal(proposal, {
        expectedVersion: 0,
      });
      return projectCustomerMergeProposalView(saved);
    },

    async validateMergeProposal(scope, mergeProposalId) {
      const mergeRepo = requireMergeRepo();
      const s = createCustomerScope(scope);
      const proposal = await mergeRepo.getProposalById(s, mergeProposalId);
      if (!proposal) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_NOT_FOUND,
          "Merge proposal not found.",
          { mergeProposalId }
        );
      }
      const { customer: survivor } = await loadCustomer(
        s,
        proposal.survivorCustomerId
      );
      const { customer: absorbed } = await loadCustomer(
        s,
        proposal.absorbedCustomerId
      );
      /** @type {string[]} */
      const issues = [];
      if (
        proposal.expectedSurvivorVersion != null &&
        Number(proposal.expectedSurvivorVersion) !== Number(survivor.version)
      ) {
        issues.push("SURVIVOR_VERSION_STALE");
      }
      if (
        proposal.expectedAbsorbedVersion != null &&
        Number(proposal.expectedAbsorbedVersion) !== Number(absorbed.version)
      ) {
        issues.push("ABSORBED_VERSION_STALE");
      }
      if (survivor.status === CUSTOMER_STATUS.MERGED) {
        issues.push("SURVIVOR_ALREADY_MERGED");
      }
      if (absorbed.status === CUSTOMER_STATUS.MERGED) {
        issues.push("ABSORBED_ALREADY_MERGED");
      }
      // Identity/Player conflicts are surfaced on the proposal and enforced at
      // merge execution (BLOCK_MERGE) — they do not block proposal approval.
      return Object.freeze({
        mergeProposalId,
        valid: issues.length === 0,
        issues: Object.freeze(issues),
        proposal: projectCustomerMergeProposalView(proposal),
      });
    },

    async approveMergeProposal(scope, mergeProposalId, options = {}) {
      const mergeRepo = requireMergeRepo();
      const s = createCustomerScope(scope);
      const proposal = await mergeRepo.getProposalById(s, mergeProposalId);
      if (!proposal) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_NOT_FOUND,
          "Merge proposal not found.",
          { mergeProposalId }
        );
      }

      const validation = await this.validateMergeProposal(s, mergeProposalId);
      if (!validation.valid) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_STALE,
          "Merge proposal failed validation before approval.",
          { issues: validation.issues }
        );
      }

      let approvalReference = options.approvalReference
        ? String(options.approvalReference)
        : proposal.approvalReference;

      if (!approvalReference) {
        const port = requireMergeApprovalPort(mergeApprovalPort);
        const decision = await port.authorize({
          scope: s,
          proposal,
          actorReference: options.actorReference || null,
          approvalReference: options.approvalReference || null,
        });
        if (!decision?.approved) {
          throwCustomerError(
            CUSTOMER_ERROR_CODES.MERGE_APPROVAL_REQUIRED,
            decision?.reason || "Merge approval was denied.",
            { mergeProposalId }
          );
        }
        approvalReference = decision.reference || "approved";
      }

      const now = clock.nowIso();
      const next = createRichCustomerMergeProposal(
        {
          ...proposal,
          status: CUSTOMER_MERGE_STATUS.APPROVED,
          approvalStatus: CUSTOMER_MERGE_APPROVAL_STATUS.APPROVED,
          approvalReference,
          approvedBy: options.actorReference || proposal.approvedBy || null,
          approvedAt: now,
          updatedAt: now,
          version: proposal.version + 1,
        },
        domainDeps()
      );
      const saved = await mergeRepo.saveProposal(next, {
        expectedVersion: proposal.version,
      });

      if (proposal.candidateId) {
        const candidate = await mergeRepo.getCandidateById(
          s,
          proposal.candidateId
        );
        if (candidate) {
          await mergeRepo.saveCandidate(
            createDuplicateCandidate(
              {
                ...candidate,
                status: CUSTOMER_DUPLICATE_CANDIDATE_STATUS.APPROVED_FOR_MERGE,
                reviewedAt: now,
                reviewReference: approvalReference,
                version: candidate.version + 1,
              },
              domainDeps()
            ),
            { expectedVersion: candidate.version }
          );
        }
      }

      return projectCustomerMergeProposalView(saved);
    },

    async rejectMergeProposal(scope, mergeProposalId, options = {}) {
      const mergeRepo = requireMergeRepo();
      const s = createCustomerScope(scope);
      const proposal = await mergeRepo.getProposalById(s, mergeProposalId);
      if (!proposal) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_NOT_FOUND,
          "Merge proposal not found.",
          { mergeProposalId }
        );
      }
      const now = clock.nowIso();
      const next = createRichCustomerMergeProposal(
        {
          ...proposal,
          status: CUSTOMER_MERGE_STATUS.REJECTED,
          approvalStatus: CUSTOMER_MERGE_APPROVAL_STATUS.REJECTED,
          updatedAt: now,
          version: proposal.version + 1,
          approvedBy: options.actorReference || null,
        },
        domainDeps()
      );
      const saved = await mergeRepo.saveProposal(next, {
        expectedVersion: proposal.version,
      });
      return projectCustomerMergeProposalView(saved);
    },

    async readMergeProposal(scope, mergeProposalId) {
      const mergeRepo = requireMergeRepo();
      const s = createCustomerScope(scope);
      const proposal = await mergeRepo.getProposalById(s, mergeProposalId);
      if (!proposal) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_NOT_FOUND,
          "Merge proposal not found.",
          { mergeProposalId }
        );
      }
      return projectCustomerMergeProposalView(proposal);
    },

    async mergeCustomers(scope, mergeProposalId, options = {}) {
      const mergeRepo = requireMergeRepo();
      const customerRepo = requireCustomerRepo();
      const s = createCustomerScope(scope);
      const proposal = await mergeRepo.getProposalById(s, mergeProposalId);
      if (!proposal) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_NOT_FOUND,
          "Merge proposal not found.",
          { mergeProposalId }
        );
      }

      const survivorBefore = await customerRepo.getById(
        s,
        proposal.survivorCustomerId
      );
      const absorbedBefore = await customerRepo.getById(
        s,
        proposal.absorbedCustomerId
      );
      const snapshot = {
        survivor: cloneFrozen(survivorBefore),
        absorbed: cloneFrozen(absorbedBefore),
      };

      try {
        let workingProposal = proposal;
        if (options.approvalReference && !workingProposal.approvalReference) {
          workingProposal = await this.approveMergeProposal(
            s,
            mergeProposalId,
            options
          );
          // re-read full domain proposal
          workingProposal =
            (await mergeRepo.getProposalById(s, mergeProposalId)) ||
            workingProposal;
        }

        if (!workingProposal.approvalReference) {
          const port = requireMergeApprovalPort(mergeApprovalPort);
          const decision = await port.authorize({
            scope: s,
            proposal: workingProposal,
            actorReference: options.actorReference || null,
            approvalReference: options.approvalReference || null,
          });
          if (!decision?.approved) {
            throwCustomerError(
              CUSTOMER_ERROR_CODES.MERGE_APPROVAL_REQUIRED,
              decision?.reason || "Merge approval was denied.",
              { mergeProposalId }
            );
          }
          workingProposal = await this.approveMergeProposal(s, mergeProposalId, {
            ...options,
            approvalReference: decision.reference || "approved",
          });
          workingProposal =
            (await mergeRepo.getProposalById(s, mergeProposalId)) ||
            workingProposal;
        }

        const { customer: survivor } = await loadCustomer(
          s,
          workingProposal.survivorCustomerId
        );
        const { customer: absorbed } = await loadCustomer(
          s,
          workingProposal.absorbedCustomerId
        );

        const linkagesSurvivor = await loadLinkages(s, survivor.customerId);
        const linkagesAbsorbed = await loadLinkages(s, absorbed.customerId);

        let consentsSurvivor = [];
        let consentsAbsorbed = [];
        let preferencesSurvivor = [];
        let preferencesAbsorbed = [];
        if (consentPreferenceRepository) {
          consentsSurvivor = await consentPreferenceRepository.listConsents(
            s,
            survivor.customerId
          );
          consentsAbsorbed = await consentPreferenceRepository.listConsents(
            s,
            absorbed.customerId
          );
          preferencesSurvivor =
            await consentPreferenceRepository.listPreferences(
              s,
              survivor.customerId
            );
          preferencesAbsorbed =
            await consentPreferenceRepository.listPreferences(
              s,
              absorbed.customerId
            );
        }

        const result = buildMergeResultSnapshots(
          {
            survivor,
            absorbed,
            proposal: workingProposal,
            consentsSurvivor,
            consentsAbsorbed,
            preferencesSurvivor,
            preferencesAbsorbed,
            linkagesSurvivor,
            linkagesAbsorbed,
          },
          domainDeps()
        );

        if (typeof mergeRepo.executeMerge === "function") {
          await mergeRepo.executeMerge({
            survivor: result.survivor,
            absorbed: result.absorbed,
            history: result.history,
            proposal: {
              ...workingProposal,
              status: CUSTOMER_MERGE_STATUS.COMPLETED,
              version: workingProposal.version + 1,
            },
            transferredLinkages: result.transferredLinkages,
            transferredConsents: result.transferredConsents,
            transferredPreferences: result.transferredPreferences,
          });
        } else {
          await customerRepo.save(result.survivor);
          await customerRepo.save(result.absorbed);
          await mergeRepo.appendHistory(result.history);

          if (consentPreferenceRepository) {
            for (const consent of result.transferredConsents || []) {
              await consentPreferenceRepository.saveConsentWithHistory(
                consent,
                {
                  historyId: idGenerator.nextId("cnsh"),
                  consentId: consent.consentId,
                  customerId: consent.customerId,
                  tenantId: consent.tenantId,
                  venueId: consent.venueId,
                  previousStatus: null,
                  nextStatus: consent.status,
                  action: "MERGE_TRANSFER",
                  recordedAt: clock.nowIso(),
                  sequence: 1,
                  customerVersion: result.survivor.version,
                },
                { expectedVersion: 0 }
              );
            }
            for (const preference of result.transferredPreferences || []) {
              await consentPreferenceRepository.savePreferenceWithHistory(
                preference,
                {
                  historyId: idGenerator.nextId("prefh"),
                  preferenceId: preference.preferenceId,
                  customerId: preference.customerId,
                  tenantId: preference.tenantId,
                  venueId: preference.venueId,
                  previousStatus: null,
                  nextStatus: preference.status,
                  action: "MERGE_TRANSFER",
                  recordedAt: clock.nowIso(),
                  sequence: 1,
                  customerVersion: result.survivor.version,
                },
                { expectedVersion: 0 }
              );
            }
          }

          if (
            linkageRepository &&
            typeof linkageRepository.saveLinkageWithHistory === "function"
          ) {
            for (const link of result.transferredLinkages || []) {
              await linkageRepository.saveLinkageWithHistory(
                link,
                {
                  historyId: idGenerator.nextId("lnkh"),
                  linkageId: link.linkageId,
                  customerId: link.customerId,
                  tenantId: link.tenantId,
                  venueId: link.venueId,
                  linkageType: link.linkageType,
                  externalReferenceId: link.externalReferenceId,
                  previousStatus: null,
                  nextStatus: link.status,
                  action: "LINK",
                  source: link.source,
                  reason: "MERGE_TRANSFER",
                  recordedAt: clock.nowIso(),
                  sequence: 1,
                  customerVersion: result.survivor.version,
                  effectiveAt: clock.nowIso(),
                },
                {
                  expectedLinkageVersion: 0,
                  skipCustomerSync: true,
                }
              );
            }
          }

          await mergeRepo.saveProposal(
            createRichCustomerMergeProposal(
              {
                ...workingProposal,
                status: CUSTOMER_MERGE_STATUS.COMPLETED,
                updatedAt: clock.nowIso(),
                version: workingProposal.version + 1,
              },
              domainDeps()
            ),
            { expectedVersion: workingProposal.version }
          );

          if (workingProposal.candidateId) {
            const candidate = await mergeRepo.getCandidateById(
              s,
              workingProposal.candidateId
            );
            if (candidate) {
              await mergeRepo.saveCandidate(
                createDuplicateCandidate(
                  {
                    ...candidate,
                    status: CUSTOMER_DUPLICATE_CANDIDATE_STATUS.RESOLVED,
                    reviewedAt: clock.nowIso(),
                    version: candidate.version + 1,
                  },
                  domainDeps()
                ),
                { expectedVersion: candidate.version }
              );
            }
          }
        }

        return projectCustomerMergeResultView(result);
      } catch (err) {
        if (
          snapshot.survivor &&
          typeof customerRepo._restoreForTests === "function"
        ) {
          customerRepo._restoreForTests(snapshot.survivor);
        }
        if (
          snapshot.absorbed &&
          typeof customerRepo._restoreForTests === "function"
        ) {
          customerRepo._restoreForTests(snapshot.absorbed);
        }
        throw err;
      }
    },

    async getMergeHistory(scope, query = {}) {
      const mergeRepo = requireMergeRepo();
      const s = createCustomerScope(scope);
      if (query.mergeHistoryId) {
        const row = await mergeRepo.getHistoryById(s, query.mergeHistoryId);
        return row ? Object.freeze([row]) : Object.freeze([]);
      }
      const rows = await mergeRepo.listHistory(s, query);
      return Object.freeze(rows);
    },
  });
}

/**
 * @param {object} [deps]
 */
export function createFailClosedMergeApplication(deps = {}) {
  return createMergeApplicationService({
    ...deps,
    customerRepository: deps.customerRepository ?? null,
    mergeRepository: deps.mergeRepository ?? null,
    mergeApprovalPort: deps.mergeApprovalPort ?? null,
  });
}
