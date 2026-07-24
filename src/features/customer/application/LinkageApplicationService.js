/**
 * Customer Linkage Application Service (CUSTOMER-05).
 *
 * Owns customer-side Identity / Player / CRM linkage lifecycle.
 * External directories are fail-closed. No auto-link by email/phone/name.
 */

import { CUSTOMER_LINKAGE_ACTION } from "../constants/linkageActions.js";
import {
  CUSTOMER_LINKAGE_EXTERNAL_SYSTEM,
  CUSTOMER_LINKAGE_TYPE,
} from "../constants/linkageTypes.js";
import { CUSTOMER_LINKAGE_SOURCE } from "../constants/linkageSources.js";
import {
  CUSTOMER_LINKAGE_STATUS,
  isActiveCustomerLinkageStatus,
} from "../constants/linkageStatuses.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import {
  activateCustomerLinkage,
  createCustomerLinkageHistoryRecord,
  createCustomerLinkageRecord,
  defaultExternalSystemForLinkageType,
  endCustomerLinkage,
} from "../domain/linkageRecord.js";
import { createCustomerScope } from "../domain/scope.js";
import {
  projectCustomerCrmLinkView,
  projectCustomerIdentityLinkView,
  projectCustomerLinkageHistoryView,
  projectCustomerLinkageLookupView,
  projectCustomerLinkageView,
  projectCustomerPlayerLinkView,
} from "../projectors/linkageViews.js";
import {
  createSequentialCustomerIdGenerator,
  createSystemCustomerClock,
} from "../repositories/ports.js";

/**
 * @param {object} [deps]
 */
export function createLinkageApplicationService(deps = {}) {
  const customerRepository = deps.customerRepository ?? null;
  const linkageRepository = deps.linkageRepository ?? null;
  const identityAccountDirectory = deps.identityAccountDirectory ?? null;
  const playerDirectory = deps.playerDirectory ?? null;
  const crmContactDirectory = deps.crmContactDirectory ?? null;
  const clock = deps.clock || createSystemCustomerClock();
  const idGenerator = deps.idGenerator || createSequentialCustomerIdGenerator();

  function domainDeps() {
    return {
      nowIso: () => clock.nowIso(),
      nextId: (prefix) => idGenerator.nextId(prefix),
    };
  }

  function requireLinkageRepo() {
    if (!linkageRepository) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
        "Customer linkage repository is not configured.",
        { adapter: "CustomerLinkageRepository" }
      );
    }
    return linkageRepository;
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

  function assertCustomerExpectedVersion(customer, expectedVersion) {
    if (expectedVersion == null) return;
    if (Number(expectedVersion) !== customer.version) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
        "Customer version conflict.",
        {
          customerId: customer.customerId,
          expectedVersion: Number(expectedVersion),
          actualVersion: customer.version,
        }
      );
    }
  }

  function requireDirectory(port, name) {
    if (!port || typeof port.getReference !== "function") {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.LINKAGE_DIRECTORY_UNAVAILABLE,
        `${name} is not configured.`,
        { adapter: name }
      );
    }
    return port;
  }

  function assertExternalActive(ref, notFoundCode, label) {
    if (!ref) {
      throwCustomerError(notFoundCode, `${label} not found.`, {});
    }
    if (ref.active === false) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
        `${label} is inactive.`,
        { status: ref.status || ref.lifecycleStatus || "INACTIVE" }
      );
    }
    const status = String(ref.status || ref.lifecycleStatus || "ACTIVE").toUpperCase();
    if (status === "INACTIVE" || status === "DISABLED" || status === "DELETED") {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
        `${label} is inactive.`,
        { status }
      );
    }
  }

  function assertExternalScope(scope, ref, label) {
    if (!ref) return;
    if (ref.tenantId != null && String(ref.tenantId) !== scope.tenantId) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.EXTERNAL_REFERENCE_SCOPE_MISMATCH,
        `${label} tenant scope mismatch.`,
        {
          expectedTenantId: scope.tenantId,
          actualTenantId: ref.tenantId,
        }
      );
    }
    if (ref.venueId != null && String(ref.venueId) !== scope.venueId) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.EXTERNAL_REFERENCE_SCOPE_MISMATCH,
        `${label} venue scope mismatch.`,
        {
          expectedVenueId: scope.venueId,
          actualVenueId: ref.venueId,
        }
      );
    }
  }

  async function validateIdentityAccount(scope, accountId) {
    const directory = requireDirectory(
      identityAccountDirectory,
      "IdentityAccountDirectoryPort"
    );
    const ref = await directory.getReference(scope, accountId);
    assertExternalActive(
      ref,
      CUSTOMER_ERROR_CODES.IDENTITY_ACCOUNT_NOT_FOUND,
      "Identity account"
    );
    assertExternalScope(scope, ref, "Identity account");
    return ref;
  }

  async function validatePlayer(scope, playerId) {
    const directory = requireDirectory(playerDirectory, "PlayerDirectoryPort");
    const ref = await directory.getReference(scope, playerId);
    assertExternalActive(ref, CUSTOMER_ERROR_CODES.PLAYER_NOT_FOUND, "Player");
    assertExternalScope(scope, ref, "Player");
    return ref;
  }

  async function validateCrmContact(scope, contactRefId, externalSystem) {
    const directory = requireDirectory(
      crmContactDirectory,
      "CrmContactDirectoryPort"
    );
    const ref = await directory.getReference(scope, contactRefId, {
      externalSystem,
    });
    assertExternalActive(
      ref,
      CUSTOMER_ERROR_CODES.CRM_REFERENCE_NOT_FOUND,
      "CRM reference"
    );
    assertExternalScope(scope, ref, "CRM reference");
    return ref;
  }

  async function rejectTransferOrConflict({
    scope,
    customerId,
    linkageType,
    externalReferenceId,
    externalSystem,
  }) {
    const repo = requireLinkageRepo();
    const existingExternal = await repo.findActiveByExternalReference(
      scope,
      linkageType,
      externalReferenceId,
      { externalSystem, activeOnly: true }
    );
    if (existingExternal && existingExternal.customerId !== customerId) {
      const code =
        linkageType === CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT
          ? CUSTOMER_ERROR_CODES.IDENTITY_LINK_CONFLICT
          : linkageType === CUSTOMER_LINKAGE_TYPE.PLAYER
            ? CUSTOMER_ERROR_CODES.PLAYER_LINK_CONFLICT
            : CUSTOMER_ERROR_CODES.CRM_LINK_CONFLICT;
      throwCustomerError(
        CUSTOMER_ERROR_CODES.LINKAGE_TRANSFER_REQUIRES_EXPLICIT_ACTION,
        "External reference is already linked to another Customer. Transfer requires an explicit Owner-authorized action.",
        {
          code,
          linkageType,
          externalReferenceId,
          existingCustomerId: existingExternal.customerId,
          requestedCustomerId: customerId,
        }
      );
    }
    return existingExternal;
  }

  async function appendLinkHistory(scope, linkage, previousStatus, action, input, customerVersion) {
    const repo = requireLinkageRepo();
    const historyRows = await repo.listHistory(scope, linkage.linkageId);
    const sequence = historyRows.length + 1;
    return createCustomerLinkageHistoryRecord({
      historyId: idGenerator.nextId("lnk_hist"),
      linkageId: linkage.linkageId,
      customerId: linkage.customerId,
      tenantId: scope.tenantId,
      venueId: scope.venueId,
      linkageType: linkage.linkageType,
      externalReferenceId: linkage.externalReferenceId,
      previousStatus,
      nextStatus: linkage.status,
      action,
      source: linkage.source,
      reason: input.reason ?? null,
      evidenceReference: linkage.evidenceReference,
      actorReference: linkage.actorReference,
      effectiveAt: linkage.effectiveAt,
      sequence,
      customerVersion,
      recordedAt: clock.nowIso(),
    });
  }

  async function persistLink(scope, customer, linkage, history, syncOptions = {}) {
    const repo = requireLinkageRepo();
    return repo.saveLinkageWithHistory(linkage, history, {
      expectedLinkageVersion: syncOptions.expectedLinkageVersion,
      expectedCustomerVersion: customer.version,
      customerVersionAfter: customer.version + 1,
      ...syncOptions,
    });
  }

  async function linkTyped({
    scope,
    customerId,
    linkageType,
    externalReferenceId,
    externalSystem,
    input = {},
    options = {},
    sync,
  }) {
    const { scope: s, customer } = await loadCustomer(scope, customerId);
    assertCustomerExpectedVersion(customer, options.expectedVersion);

    const system =
      externalSystem ||
      input.externalSystem ||
      defaultExternalSystemForLinkageType(linkageType);

    const sameActive = await rejectTransferOrConflict({
      scope: s,
      customerId: customer.customerId,
      linkageType,
      externalReferenceId,
      externalSystem: system,
    });

    // Idempotent same active link
    if (
      sameActive &&
      sameActive.customerId === customer.customerId &&
      isActiveCustomerLinkageStatus(sameActive.status)
    ) {
      return projectCustomerLinkageView(sameActive);
    }

    const repo = requireLinkageRepo();
    if (
      linkageType === CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT ||
      linkageType === CUSTOMER_LINKAGE_TYPE.PLAYER
    ) {
      const existingForCustomer = await repo.findActiveByCustomerAndType(
        s,
        customer.customerId,
        linkageType,
        { externalSystem: system, activeOnly: true }
      );

      if (
        existingForCustomer &&
        (existingForCustomer.externalReferenceId !== externalReferenceId ||
          existingForCustomer.externalSystem !== system)
      ) {
        const code =
          linkageType === CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT
            ? CUSTOMER_ERROR_CODES.IDENTITY_LINK_CONFLICT
            : CUSTOMER_ERROR_CODES.PLAYER_LINK_CONFLICT;
        throwCustomerError(
          code,
          "Customer already has a conflicting active linkage.",
          {
            customerId: customer.customerId,
            linkageType,
            existingExternalReferenceId: existingForCustomer.externalReferenceId,
            requestedExternalReferenceId: externalReferenceId,
          }
        );
      }
    }

    // Re-activate prior inactive row for same external reference if present
    const priorSame = await repo.findActiveByExternalReference(
      s,
      linkageType,
      externalReferenceId,
      { externalSystem: system, activeOnly: false }
    );

    const canReactivate =
      priorSame &&
      priorSame.customerId === customer.customerId &&
      !isActiveCustomerLinkageStatus(priorSame.status);

    let next;
    let previousStatus;
    let expectedLinkageVersion;
    let action;

    if (canReactivate) {
      next = activateCustomerLinkage(
        priorSame,
        {
          source: input.source || CUSTOMER_LINKAGE_SOURCE.MANUAL,
          evidenceReference: input.evidenceReference,
          actorReference: input.actorReference,
          effectiveAt: input.effectiveAt,
        },
        domainDeps()
      );
      previousStatus = priorSame.status;
      expectedLinkageVersion = priorSame.version;
      action = CUSTOMER_LINKAGE_ACTION.REACTIVATE;
    } else {
      next = createCustomerLinkageRecord(
        {
          customerId: customer.customerId,
          tenantId: s.tenantId,
          venueId: s.venueId,
          linkageType,
          externalReferenceId,
          externalSystem: system,
          externalReferenceType: input.externalReferenceType,
          status: CUSTOMER_LINKAGE_STATUS.ACTIVE,
          source: input.source || CUSTOMER_LINKAGE_SOURCE.MANUAL,
          evidenceReference: input.evidenceReference,
          actorReference: input.actorReference,
          effectiveAt: input.effectiveAt,
        },
        domainDeps()
      );
      previousStatus = null;
      expectedLinkageVersion = 0;
      action = CUSTOMER_LINKAGE_ACTION.LINK;
    }

    if (options.expectedLinkageVersion != null) {
      expectedLinkageVersion = Number(options.expectedLinkageVersion);
    }

    const history = await appendLinkHistory(
      s,
      next,
      previousStatus,
      action,
      input,
      customer.version + 1
    );

    // For new linkage, listHistory may be empty — rebuild sequence from empty
    const historyRows = await repo.listHistory(s, next.linkageId);
    const historyFixed = createCustomerLinkageHistoryRecord({
      ...history,
      sequence: historyRows.length + 1,
    });

    const saved = await persistLink(s, customer, next, historyFixed, {
      expectedLinkageVersion,
      ...sync(next),
    });
    return projectCustomerLinkageView(saved);
  }

  async function unlinkTyped({
    scope,
    customerId,
    linkageType,
    externalReferenceId,
    externalSystem,
    nextStatus,
    input = {},
    options = {},
    sync,
  }) {
    const { scope: s, customer } = await loadCustomer(scope, customerId);
    assertCustomerExpectedVersion(customer, options.expectedVersion);
    const repo = requireLinkageRepo();
    const system =
      externalSystem ||
      input.externalSystem ||
      defaultExternalSystemForLinkageType(linkageType);

    let current;
    if (externalReferenceId) {
      current = await repo.findActiveByExternalReference(
        s,
        linkageType,
        externalReferenceId,
        { externalSystem: system, activeOnly: false }
      );
      if (current && current.customerId !== customer.customerId) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.LINKAGE_NOT_FOUND,
          "Linkage not found for this Customer.",
          { customerId: customer.customerId, linkageType }
        );
      }
    } else {
      current = await repo.findActiveByCustomerAndType(
        s,
        customer.customerId,
        linkageType,
        {
          externalSystem: system,
          activeOnly: false,
        }
      );
    }

    if (!current) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.LINKAGE_NOT_FOUND,
        "Linkage not found.",
        { customerId: customer.customerId, linkageType }
      );
    }

    if (!isActiveCustomerLinkageStatus(current.status)) {
      if (options.idempotent !== false) {
        return projectCustomerLinkageView(current);
      }
      throwCustomerError(
        CUSTOMER_ERROR_CODES.LINKAGE_ALREADY_INACTIVE,
        "Linkage is already inactive.",
        { linkageId: current.linkageId, status: current.status }
      );
    }

    const next = endCustomerLinkage(
      current,
      nextStatus,
      {
        source: input.source || current.source,
        actorReference: input.actorReference,
        endedAt: input.endedAt,
      },
      domainDeps()
    );

    const historyRows = await repo.listHistory(s, next.linkageId);
    const history = createCustomerLinkageHistoryRecord({
      historyId: idGenerator.nextId("lnk_hist"),
      linkageId: next.linkageId,
      customerId: next.customerId,
      tenantId: s.tenantId,
      venueId: s.venueId,
      linkageType: next.linkageType,
      externalReferenceId: next.externalReferenceId,
      previousStatus: current.status,
      nextStatus: next.status,
      action:
        nextStatus === CUSTOMER_LINKAGE_STATUS.INACTIVE
          ? CUSTOMER_LINKAGE_ACTION.DEACTIVATE
          : CUSTOMER_LINKAGE_ACTION.UNLINK,
      source: next.source,
      reason: input.reason ?? null,
      evidenceReference: next.evidenceReference,
      actorReference: next.actorReference,
      effectiveAt: next.endedAt,
      sequence: historyRows.length + 1,
      customerVersion: customer.version + 1,
      recordedAt: clock.nowIso(),
    });

    const saved = await persistLink(s, customer, next, history, {
      expectedLinkageVersion:
        options.expectedLinkageVersion != null
          ? Number(options.expectedLinkageVersion)
          : current.version,
      ...sync(next),
    });
    return projectCustomerLinkageView(saved);
  }

  return Object.freeze({
    async linkIdentityAccount(scope, customerId, accountId, input = {}, options = {}) {
      const id = String(accountId || input.accountId || input.userAccountId || "").trim();
      if (!id) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
          "accountId is required.",
          { field: "accountId" }
        );
      }
      await validateIdentityAccount(createCustomerScope(scope), id);
      return linkTyped({
        scope,
        customerId,
        linkageType: CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT,
        externalReferenceId: id,
        externalSystem: CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.IDENTITY,
        input,
        options,
        sync: () => ({
          syncCustomerAccountUserId: id,
        }),
      });
    },

    async unlinkIdentityAccount(scope, customerId, input = {}, options = {}) {
      return unlinkTyped({
        scope,
        customerId,
        linkageType: CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT,
        externalReferenceId: input.accountId || input.userAccountId || null,
        externalSystem: CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.IDENTITY,
        nextStatus: CUSTOMER_LINKAGE_STATUS.UNLINKED,
        input,
        options,
        sync: () => ({
          clearCustomerAccountUserId: true,
        }),
      });
    },

    async getIdentityLink(scope, customerId) {
      const { scope: s, customer } = await loadCustomer(scope, customerId);
      const row = await requireLinkageRepo().findActiveByCustomerAndType(
        s,
        customer.customerId,
        CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT,
        { activeOnly: false }
      );
      return projectCustomerIdentityLinkView(row);
    },

    async findCustomerByIdentityAccount(scope, accountId) {
      const s = createCustomerScope(scope);
      const id = String(accountId || "").trim();
      const linkage = await requireLinkageRepo().findActiveByExternalReference(
        s,
        CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT,
        id,
        {
          externalSystem: CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.IDENTITY,
          activeOnly: true,
        }
      );
      if (!linkage) return null;
      const customer = await requireCustomerRepo().getById(s, linkage.customerId);
      return projectCustomerLinkageLookupView(customer, linkage);
    },

    async linkPlayer(scope, customerId, playerId, input = {}, options = {}) {
      const id = String(playerId || input.playerId || "").trim();
      if (!id) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
          "playerId is required.",
          { field: "playerId" }
        );
      }
      await validatePlayer(createCustomerScope(scope), id);
      return linkTyped({
        scope,
        customerId,
        linkageType: CUSTOMER_LINKAGE_TYPE.PLAYER,
        externalReferenceId: id,
        externalSystem: CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.PLAYER,
        input,
        options,
        sync: () => ({
          syncCustomerPlayerId: id,
        }),
      });
    },

    async unlinkPlayer(scope, customerId, input = {}, options = {}) {
      return unlinkTyped({
        scope,
        customerId,
        linkageType: CUSTOMER_LINKAGE_TYPE.PLAYER,
        externalReferenceId: input.playerId || null,
        externalSystem: CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.PLAYER,
        nextStatus: CUSTOMER_LINKAGE_STATUS.UNLINKED,
        input,
        options,
        sync: () => ({
          clearCustomerPlayerId: true,
        }),
      });
    },

    async getPlayerLink(scope, customerId) {
      const { scope: s, customer } = await loadCustomer(scope, customerId);
      const row = await requireLinkageRepo().findActiveByCustomerAndType(
        s,
        customer.customerId,
        CUSTOMER_LINKAGE_TYPE.PLAYER,
        { activeOnly: false }
      );
      return projectCustomerPlayerLinkView(row);
    },

    async findCustomerByPlayerId(scope, playerId) {
      const s = createCustomerScope(scope);
      const id = String(playerId || "").trim();
      const linkage = await requireLinkageRepo().findActiveByExternalReference(
        s,
        CUSTOMER_LINKAGE_TYPE.PLAYER,
        id,
        {
          externalSystem: CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.PLAYER,
          activeOnly: true,
        }
      );
      if (!linkage) return null;
      const customer = await requireCustomerRepo().getById(s, linkage.customerId);
      return projectCustomerLinkageLookupView(customer, linkage);
    },

    async linkCrmReference(scope, customerId, contactRefId, input = {}, options = {}) {
      const id = String(
        contactRefId || input.contactRefId || input.externalReferenceId || ""
      ).trim();
      if (!id) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
          "contactRefId is required.",
          { field: "contactRefId" }
        );
      }
      const system = String(
        input.externalSystem || CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.CRM
      ).trim();
      await validateCrmContact(createCustomerScope(scope), id, system);
      return linkTyped({
        scope,
        customerId,
        linkageType: CUSTOMER_LINKAGE_TYPE.CRM_CONTACT,
        externalReferenceId: id,
        externalSystem: system,
        input: {
          ...input,
          externalReferenceType: input.externalReferenceType || "CONTACT_REF",
        },
        options,
        sync: () => ({}),
      });
    },

    async unlinkCrmReference(scope, customerId, contactRefId, input = {}, options = {}) {
      const id = String(
        contactRefId || input.contactRefId || input.externalReferenceId || ""
      ).trim();
      if (!id) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
          "contactRefId is required.",
          { field: "contactRefId" }
        );
      }
      return unlinkTyped({
        scope,
        customerId,
        linkageType: CUSTOMER_LINKAGE_TYPE.CRM_CONTACT,
        externalReferenceId: id,
        externalSystem:
          input.externalSystem || CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.CRM,
        nextStatus: CUSTOMER_LINKAGE_STATUS.UNLINKED,
        input,
        options,
        sync: () => ({}),
      });
    },

    async listCrmReferences(scope, customerId, options = {}) {
      const { scope: s, customer } = await loadCustomer(scope, customerId);
      const rows = await requireLinkageRepo().listByCustomer(
        s,
        customer.customerId,
        {
          linkageType: CUSTOMER_LINKAGE_TYPE.CRM_CONTACT,
          activeOnly: options.activeOnly === true,
        }
      );
      return Object.freeze(rows.map((row) => projectCustomerCrmLinkView(row)));
    },

    async findCustomerByCrmReference(scope, contactRefId, options = {}) {
      const s = createCustomerScope(scope);
      const id = String(contactRefId || "").trim();
      const system = String(
        options.externalSystem || CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.CRM
      ).trim();
      const linkage = await requireLinkageRepo().findActiveByExternalReference(
        s,
        CUSTOMER_LINKAGE_TYPE.CRM_CONTACT,
        id,
        { externalSystem: system, activeOnly: true }
      );
      if (!linkage) return null;
      const customer = await requireCustomerRepo().getById(s, linkage.customerId);
      return projectCustomerLinkageLookupView(customer, linkage);
    },

    async listCustomerLinkages(scope, customerId, options = {}) {
      const { scope: s, customer } = await loadCustomer(scope, customerId);
      const rows = await requireLinkageRepo().listByCustomer(
        s,
        customer.customerId,
        options
      );
      return Object.freeze(rows.map((row) => projectCustomerLinkageView(row)));
    },

    async getLinkageHistory(scope, customerId, options = {}) {
      const { scope: s, customer } = await loadCustomer(scope, customerId);
      const repo = requireLinkageRepo();
      let rows;
      if (options.linkageId) {
        rows = await repo.listHistory(s, options.linkageId);
        rows = rows.filter((row) => row.customerId === customer.customerId);
      } else if (typeof repo.listHistoryByCustomer === "function") {
        rows = await repo.listHistoryByCustomer(s, customer.customerId);
      } else {
        const linkages = await repo.listByCustomer(s, customer.customerId, {});
        rows = [];
        for (const linkage of linkages) {
          const hist = await repo.listHistory(s, linkage.linkageId);
          rows.push(...hist);
        }
      }
      return Object.freeze(
        rows.map((row) => projectCustomerLinkageHistoryView(row))
      );
    },

    async validateLinkageConflict(scope, input = {}) {
      const s = createCustomerScope(scope);
      const linkageType = String(input.linkageType || "").trim();
      const externalReferenceId = String(input.externalReferenceId || "").trim();
      const customerId = input.customerId
        ? String(input.customerId).trim()
        : null;
      const externalSystem =
        input.externalSystem ||
        defaultExternalSystemForLinkageType(linkageType);

      if (!linkageType || !externalReferenceId) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
          "linkageType and externalReferenceId are required.",
          { field: "validateLinkageConflict" }
        );
      }

      const existing = await requireLinkageRepo().findActiveByExternalReference(
        s,
        linkageType,
        externalReferenceId,
        { externalSystem, activeOnly: true }
      );

      if (!existing) {
        return Object.freeze({
          conflict: false,
          transferRequired: false,
          existingCustomerId: null,
        });
      }

      if (customerId && existing.customerId === customerId) {
        return Object.freeze({
          conflict: false,
          transferRequired: false,
          existingCustomerId: existing.customerId,
          linkageId: existing.linkageId,
          sameCustomer: true,
        });
      }

      return Object.freeze({
        conflict: true,
        transferRequired: true,
        existingCustomerId: existing.customerId,
        linkageId: existing.linkageId,
        reasonCode: CUSTOMER_ERROR_CODES.LINKAGE_TRANSFER_REQUIRES_EXPLICIT_ACTION,
      });
    },

    async deactivateLinkage(scope, customerId, linkageId, input = {}, options = {}) {
      const { scope: s, customer } = await loadCustomer(scope, customerId);
      assertCustomerExpectedVersion(customer, options.expectedVersion);
      const repo = requireLinkageRepo();
      const current = await repo.getById(s, linkageId);
      if (!current || current.customerId !== customer.customerId) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.LINKAGE_NOT_FOUND,
          "Linkage not found.",
          { linkageId, customerId: customer.customerId }
        );
      }
      return unlinkTyped({
        scope: s,
        customerId: customer.customerId,
        linkageType: current.linkageType,
        externalReferenceId: current.externalReferenceId,
        externalSystem: current.externalSystem,
        nextStatus: CUSTOMER_LINKAGE_STATUS.INACTIVE,
        input,
        options,
        sync: (next) => {
          if (next.linkageType === CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT) {
            return { clearCustomerAccountUserId: true };
          }
          if (next.linkageType === CUSTOMER_LINKAGE_TYPE.PLAYER) {
            return { clearCustomerPlayerId: true };
          }
          return {};
        },
      });
    },
  });
}

/**
 * @param {object} [deps]
 */
export function createFailClosedLinkageApplication(deps = {}) {
  return createLinkageApplicationService({
    ...deps,
    linkageRepository: deps.linkageRepository ?? null,
    customerRepository: deps.customerRepository ?? null,
  });
}
