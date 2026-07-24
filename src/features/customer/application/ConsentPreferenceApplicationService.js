/**
 * Consent & Communication Preference Application Service (CUSTOMER-04).
 */

import { CUSTOMER_COMMUNICATION_CHANNEL_VALUES } from "../constants/communicationChannels.js";
import { CUSTOMER_CONSENT_STATUS } from "../constants/consentStatuses.js";
import { CUSTOMER_PREFERENCE_STATUS } from "../constants/preferenceStatuses.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import {
  createCustomerConsentHistoryRecord,
  createCustomerConsentRecord,
  transitionCustomerConsent,
} from "../domain/consentRecord.js";
import {
  createCustomerPreferenceHistoryRecord,
  setCustomerPreferenceStatus,
} from "../domain/preferenceRecord.js";
import { evaluateCommunicationEligibility } from "../domain/communicationEligibility.js";
import { createCustomerScope } from "../domain/scope.js";
import {
  projectCommunicationEligibilityView,
  projectCustomerCommunicationPreferenceView,
  projectCustomerConsentView,
} from "../projectors/consentPreferenceViews.js";
import {
  createSequentialCustomerIdGenerator,
  createSystemCustomerClock,
} from "../repositories/ports.js";

/**
 * @param {object} [deps]
 * @param {import("../repositories/ports.js").CustomerRepository|null} [deps.customerRepository]
 * @param {import("../repositories/consentPreferencePorts.js").CustomerConsentPreferenceRepository|null} [deps.consentPreferenceRepository]
 * @param {import("../repositories/ports.js").CustomerClock} [deps.clock]
 * @param {import("../repositories/ports.js").CustomerIdGenerator} [deps.idGenerator]
 */
export function createConsentPreferenceApplicationService(deps = {}) {
  const customerRepository = deps.customerRepository ?? null;
  const consentPreferenceRepository = deps.consentPreferenceRepository ?? null;
  const clock = deps.clock || createSystemCustomerClock();
  const idGenerator = deps.idGenerator || createSequentialCustomerIdGenerator();

  function requireConsentRepo() {
    if (!consentPreferenceRepository) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
        "Customer consent/preference repository is not configured.",
        { adapter: "CustomerConsentPreferenceRepository" }
      );
    }
    return consentPreferenceRepository;
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

  function domainDeps() {
    return {
      nowIso: () => clock.nowIso(),
      nextId: (prefix) => idGenerator.nextId(prefix),
    };
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

  async function appendConsentTransition(
    scope,
    customerId,
    nextStatus,
    input,
    options = {}
  ) {
    const repo = requireConsentRepo();
    const { scope: s, customer } = await loadCustomer(scope, customerId);
    const purpose = String(input.purpose || "").trim();
    const channel =
      input.channel == null || input.channel === ""
        ? null
        : String(input.channel).trim();

    const current = await repo.getConsent(s, customer.customerId, purpose, channel);
    if (
      options.expectedVersion != null &&
      current &&
      Number(options.expectedVersion) !== current.version
    ) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
        "Consent version conflict.",
        {
          consentId: current.consentId,
          expectedVersion: Number(options.expectedVersion),
          actualVersion: current.version,
        }
      );
    }
    if (options.expectedVersion != null && !current && Number(options.expectedVersion) !== 0) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
        "Consent version conflict on create.",
        {
          expectedVersion: Number(options.expectedVersion),
          actualVersion: 0,
        }
      );
    }

    const next = transitionCustomerConsent(
      current,
      nextStatus,
      {
        customerId: customer.customerId,
        tenantId: s.tenantId,
        venueId: s.venueId,
        purpose,
        channel,
        source: input.source,
        evidenceReference: input.evidenceReference,
        actorReference: input.actorReference,
        effectiveAt: input.effectiveAt,
        expiresAt: input.expiresAt,
        revokedAt: input.revokedAt,
        consentId: current?.consentId,
      },
      domainDeps()
    );

    const historyRows = current
      ? await repo.listConsentHistory(s, current.consentId)
      : [];
    const sequence = historyRows.length + 1;
    const history = createCustomerConsentHistoryRecord({
      historyId: idGenerator.nextId("cns_hist"),
      consentId: next.consentId,
      customerId: next.customerId,
      tenantId: s.tenantId,
      venueId: s.venueId,
      sequence,
      previousStatus: current?.status || CUSTOMER_CONSENT_STATUS.NOT_RECORDED,
      nextStatus: next.status,
      purpose: next.purpose,
      channel: next.channel,
      effectiveAt: next.effectiveAt,
      source: next.source,
      evidenceReference: next.evidenceReference,
      actorReference: next.actorReference,
      reason: input.reason ?? null,
      aggregateVersion: next.version,
      recordedAt: clock.nowIso(),
    });

    const saved = await repo.saveConsentWithHistory(next, history, {
      expectedVersion: options.expectedVersion,
    });
    return projectCustomerConsentView(saved);
  }

  async function setPreference(scope, customerId, nextStatus, input, options = {}) {
    const repo = requireConsentRepo();
    const { scope: s, customer } = await loadCustomer(scope, customerId);
    const purpose = String(input.purpose || "").trim();
    const channel = String(input.channel || "").trim();

    const current = await repo.getPreference(
      s,
      customer.customerId,
      purpose,
      channel
    );
    if (
      options.expectedVersion != null &&
      current &&
      Number(options.expectedVersion) !== current.version
    ) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
        "Preference version conflict.",
        {
          preferenceId: current.preferenceId,
          expectedVersion: Number(options.expectedVersion),
          actualVersion: current.version,
        }
      );
    }
    if (
      options.expectedVersion != null &&
      !current &&
      Number(options.expectedVersion) !== 0
    ) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
        "Preference version conflict on create.",
        {
          expectedVersion: Number(options.expectedVersion),
          actualVersion: 0,
        }
      );
    }

    const next = setCustomerPreferenceStatus(
      current,
      nextStatus,
      {
        customerId: customer.customerId,
        tenantId: s.tenantId,
        venueId: s.venueId,
        purpose,
        channel,
        source: input.source,
        actorReference: input.actorReference,
        effectiveAt: input.effectiveAt,
        preferenceId: current?.preferenceId,
      },
      domainDeps()
    );

    const historyRows = current
      ? await repo.listPreferenceHistory(s, current.preferenceId)
      : [];
    const sequence = historyRows.length + 1;
    const history = createCustomerPreferenceHistoryRecord({
      historyId: idGenerator.nextId("cpref_hist"),
      preferenceId: next.preferenceId,
      customerId: next.customerId,
      tenantId: s.tenantId,
      venueId: s.venueId,
      sequence,
      previousStatus: current?.status || CUSTOMER_PREFERENCE_STATUS.UNSPECIFIED,
      nextStatus: next.status,
      purpose: next.purpose,
      channel: next.channel,
      effectiveAt: next.effectiveAt,
      source: next.source,
      actorReference: next.actorReference,
      reason: input.reason ?? null,
      aggregateVersion: next.version,
      recordedAt: clock.nowIso(),
    });

    const saved = await repo.savePreferenceWithHistory(next, history, {
      expectedVersion: options.expectedVersion,
    });
    return projectCustomerCommunicationPreferenceView(saved);
  }

  return Object.freeze({
    async grantConsent(scope, customerId, input = {}, options = {}) {
      return appendConsentTransition(
        scope,
        customerId,
        CUSTOMER_CONSENT_STATUS.GRANTED,
        input,
        options
      );
    },

    async denyConsent(scope, customerId, input = {}, options = {}) {
      return appendConsentTransition(
        scope,
        customerId,
        CUSTOMER_CONSENT_STATUS.DENIED,
        input,
        options
      );
    },

    async revokeConsent(scope, customerId, input = {}, options = {}) {
      const repo = requireConsentRepo();
      const { scope: s, customer } = await loadCustomer(scope, customerId);
      const purpose = String(input.purpose || "").trim();
      const channel =
        input.channel == null || input.channel === ""
          ? null
          : String(input.channel).trim();
      const current = await repo.getConsent(
        s,
        customer.customerId,
        purpose,
        channel
      );
      if (!current) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.CONSENT_NOT_FOUND,
          "Consent not found.",
          { customerId, purpose, channel }
        );
      }
      if (current.status === CUSTOMER_CONSENT_STATUS.REVOKED) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.CONSENT_ALREADY_REVOKED,
          "Consent is already revoked.",
          { consentId: current.consentId }
        );
      }
      return appendConsentTransition(
        scope,
        customerId,
        CUSTOMER_CONSENT_STATUS.REVOKED,
        input,
        options
      );
    },

    async expireConsent(scope, customerId, input = {}, options = {}) {
      const repo = requireConsentRepo();
      const { scope: s, customer } = await loadCustomer(scope, customerId);
      const purpose = String(input.purpose || "").trim();
      const channel =
        input.channel == null || input.channel === ""
          ? null
          : String(input.channel).trim();
      const current = await repo.getConsent(
        s,
        customer.customerId,
        purpose,
        channel
      );
      if (!current) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.CONSENT_NOT_FOUND,
          "Consent not found.",
          { customerId, purpose, channel }
        );
      }
      return appendConsentTransition(
        scope,
        customerId,
        CUSTOMER_CONSENT_STATUS.EXPIRED,
        input,
        options
      );
    },

    async setCommunicationPreference(scope, customerId, input = {}, options = {}) {
      const status = String(input.status || "").trim();
      if (
        status !== CUSTOMER_PREFERENCE_STATUS.OPTED_IN &&
        status !== CUSTOMER_PREFERENCE_STATUS.OPTED_OUT &&
        status !== CUSTOMER_PREFERENCE_STATUS.UNSPECIFIED
      ) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.INVALID_COMMUNICATION_PREFERENCE,
          "Preference status is invalid.",
          { field: "status", status }
        );
      }
      return setPreference(scope, customerId, status, input, options);
    },

    async optInCommunication(scope, customerId, input = {}, options = {}) {
      return setPreference(
        scope,
        customerId,
        CUSTOMER_PREFERENCE_STATUS.OPTED_IN,
        input,
        options
      );
    },

    async optOutCommunication(scope, customerId, input = {}, options = {}) {
      return setPreference(
        scope,
        customerId,
        CUSTOMER_PREFERENCE_STATUS.OPTED_OUT,
        input,
        options
      );
    },

    async resetCommunicationPreference(scope, customerId, input = {}, options = {}) {
      return setPreference(
        scope,
        customerId,
        CUSTOMER_PREFERENCE_STATUS.UNSPECIFIED,
        input,
        options
      );
    },

    async getConsent(scope, customerId, purpose, channel = null) {
      const repo = requireConsentRepo();
      const { scope: s } = await loadCustomer(scope, customerId);
      const row = await repo.getConsent(s, customerId, purpose, channel);
      return projectCustomerConsentView(row);
    },

    async listConsents(scope, customerId) {
      const repo = requireConsentRepo();
      const { scope: s } = await loadCustomer(scope, customerId);
      const rows = await repo.listConsents(s, customerId);
      return Object.freeze(rows.map(projectCustomerConsentView));
    },

    async getConsentHistory(scope, customerId, purpose, channel = null) {
      const repo = requireConsentRepo();
      const { scope: s } = await loadCustomer(scope, customerId);
      const current = await repo.getConsent(s, customerId, purpose, channel);
      if (!current) return Object.freeze([]);
      const rows = await repo.listConsentHistory(s, current.consentId);
      return Object.freeze(rows.map((r) => Object.freeze({ ...r })));
    },

    async getPreference(scope, customerId, purpose, channel) {
      const repo = requireConsentRepo();
      const { scope: s } = await loadCustomer(scope, customerId);
      const row = await repo.getPreference(s, customerId, purpose, channel);
      return projectCustomerCommunicationPreferenceView(row);
    },

    async listPreferences(scope, customerId) {
      const repo = requireConsentRepo();
      const { scope: s } = await loadCustomer(scope, customerId);
      const rows = await repo.listPreferences(s, customerId);
      return Object.freeze(rows.map(projectCustomerCommunicationPreferenceView));
    },

    async getPreferenceHistory(scope, customerId, purpose, channel) {
      const repo = requireConsentRepo();
      const { scope: s } = await loadCustomer(scope, customerId);
      const current = await repo.getPreference(s, customerId, purpose, channel);
      if (!current) return Object.freeze([]);
      const rows = await repo.listPreferenceHistory(s, current.preferenceId);
      return Object.freeze(rows.map((r) => Object.freeze({ ...r })));
    },

    async evaluateCommunicationEligibility(scope, customerId, input = {}) {
      const repo = requireConsentRepo();
      const { scope: s, customer } = await loadCustomer(scope, customerId);
      const purpose = String(input.purpose || "").trim();
      const channel = String(input.channel || "").trim();
      const consent = await repo.getConsent(s, customerId, purpose, channel);
      const preference = await repo.getPreference(
        s,
        customerId,
        purpose,
        channel
      );
      const result = evaluateCommunicationEligibility({
        customer,
        consent,
        preference,
        purpose,
        channel,
        evaluatedAt: clock.nowIso(),
        governancePolicyResolved: input.governancePolicyResolved === true,
        requiredPolicyReference: input.requiredPolicyReference ?? null,
        requireVerifiedContact: input.requireVerifiedContact === true,
      });
      return projectCommunicationEligibilityView(result);
    },

    async listEligibleChannels(scope, customerId, purpose, options = {}) {
      const results = [];
      for (const channel of CUSTOMER_COMMUNICATION_CHANNEL_VALUES) {
        const view = await this.evaluateCommunicationEligibility(
          scope,
          customerId,
          {
            purpose,
            channel,
            governancePolicyResolved: options.governancePolicyResolved === true,
            requireVerifiedContact: options.requireVerifiedContact === true,
          }
        );
        results.push(view);
      }
      return Object.freeze(results);
    },

    /** Domain factory escape hatch for tests / adapters — immutable. */
    createConsentRecordForTests(input) {
      return createCustomerConsentRecord(input, domainDeps());
    },
  });
}

/**
 * Fail-closed stub when adapters are missing.
 */
export function createFailClosedConsentPreferenceApplication() {
  return createConsentPreferenceApplicationService({
    customerRepository: null,
    consentPreferenceRepository: null,
  });
}
