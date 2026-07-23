/**
 * In-memory Finance repositories (Phase 1C capability proof / tests only).
 *
 * NOT production persistence. No shared global singleton across instances.
 * Each call to createInMemoryFinanceRepositories() creates an isolated store.
 *
 * Policy: provider transaction references are unique per tenant.
 * Database uniqueness remains required in a later persistence phase.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { FINANCE_REPOSITORY_PORTS } from "./ports.js";

/**
 * Deep-clone JSON-like values and freeze recursively to prevent mutation leakage.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function cloneFrozen(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneFrozen(item)));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = cloneFrozen(value[key]);
  }
  return Object.freeze(out);
}

/**
 * @param {string} tenantId
 * @param {string} entityId
 * @returns {string}
 */
function tenantKey(tenantId, entityId) {
  return `${tenantId}\u0000${entityId}`;
}

/**
 * @param {string} label
 * @returns {never}
 */
function throwNotFound(label, context) {
  throw new FinanceError(
    FINANCE_ERROR_CODES.NOT_FOUND,
    `${label} not found.`,
    context
  );
}

/**
 * @param {string} label
 * @param {object} context
 * @returns {never}
 */
function throwConflict(label, context) {
  throw new FinanceError(
    FINANCE_ERROR_CODES.CONFLICT,
    `${label} already exists.`,
    context
  );
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireTenantScopedId(value, field) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFERENCE,
      `${field} is required.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * Create a tenant-scoped entity map repository.
 *
 * @param {{
 *   label: string,
 *   idField: string,
 *   assertImmutable?: (existing: object, next: object) => void
 * }} config
 */
function createEntityRepository(config) {
  /** @type {Map<string, object>} */
  const byId = new Map();

  return {
    port: config.label,
    /**
     * @param {string} tenantId
     * @param {string} id
     */
    findById(tenantId, id) {
      const t = requireTenantScopedId(tenantId, "tenantId");
      const entityId = requireTenantScopedId(id, config.idField);
      const found = byId.get(tenantKey(t, entityId));
      return found ? cloneFrozen(found) : null;
    },
    /**
     * @param {string} tenantId
     * @param {string} id
     */
    getById(tenantId, id) {
      const found = this.findById(tenantId, id);
      if (!found) {
        throwNotFound(config.label, {
          tenantId: String(tenantId || "").trim(),
          [config.idField]: String(id || "").trim(),
        });
      }
      return found;
    },
    /**
     * @param {object} entity
     */
    save(entity) {
      if (!entity || typeof entity !== "object") {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          `${config.label} entity must be an object.`
        );
      }
      const tenantId = requireTenantScopedId(entity.tenantId, "tenantId");
      const entityId = requireTenantScopedId(entity[config.idField], config.idField);
      const key = tenantKey(tenantId, entityId);
      if (byId.has(key)) {
        throwConflict(config.label, { tenantId, [config.idField]: entityId });
      }
      const stored = cloneFrozen(entity);
      byId.set(key, stored);
      return cloneFrozen(stored);
    },
    /**
     * @param {string} tenantId
     * @param {string} id
     * @param {object} next
     */
    update(tenantId, id, next) {
      const t = requireTenantScopedId(tenantId, "tenantId");
      const entityId = requireTenantScopedId(id, config.idField);
      const key = tenantKey(t, entityId);
      const existing = byId.get(key);
      if (!existing) {
        throwNotFound(config.label, { tenantId: t, [config.idField]: entityId });
      }
      if (!next || typeof next !== "object") {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          `${config.label} update must be an object.`
        );
      }
      const nextTenant = requireTenantScopedId(next.tenantId, "tenantId");
      const nextId = requireTenantScopedId(next[config.idField], config.idField);
      if (nextTenant !== t || nextId !== entityId) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_REFERENCE,
          `${config.label} identity cannot change on update.`,
          { tenantId: t, [config.idField]: entityId }
        );
      }
      if (typeof config.assertImmutable === "function") {
        config.assertImmutable(existing, next);
      }
      const stored = cloneFrozen(next);
      byId.set(key, stored);
      return cloneFrozen(stored);
    },
    /** Test-only: clear this repository map. */
    _resetForTests() {
      byId.clear();
    },
    /** Test-only: size for assertions. */
    _sizeForTests() {
      return byId.size;
    },
  };
}

/**
 * Create a fully isolated set of in-memory Finance repositories.
 *
 * @returns {object}
 */
export function createInMemoryFinanceRepositories() {
  const feeDefinitions = createEntityRepository({
    label: FINANCE_REPOSITORY_PORTS.FeeDefinitionRepository,
    idField: "feeId",
  });

  const obligations = createEntityRepository({
    label: FINANCE_REPOSITORY_PORTS.FinancialObligationRepository,
    idField: "obligationId",
    assertImmutable(existing, next) {
      if (
        existing.settlementStarted &&
        (existing.amount?.amountMinor !== next.amount?.amountMinor ||
          existing.currency !== next.currency)
      ) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
          "Obligation amount/currency cannot change after settlement begins.",
          { obligationId: existing.obligationId }
        );
      }
    },
  });

  const invoices = createEntityRepository({
    label: FINANCE_REPOSITORY_PORTS.InvoiceRepository,
    idField: "invoiceId",
  });

  /** @type {Map<string, string>} tenant\0providerTxn -> paymentId */
  const providerTxnIndex = new Map();
  const paymentsBase = createEntityRepository({
    label: FINANCE_REPOSITORY_PORTS.PaymentRepository,
    idField: "paymentId",
  });

  const payments = {
    findById: paymentsBase.findById.bind(paymentsBase),
    getById: paymentsBase.getById.bind(paymentsBase),
    findByProviderTransactionReference(tenantId, providerTransactionReference) {
      const t = requireTenantScopedId(tenantId, "tenantId");
      const ref = requireTenantScopedId(
        providerTransactionReference,
        "providerTransactionReference"
      );
      const paymentId = providerTxnIndex.get(tenantKey(t, ref));
      if (!paymentId) return null;
      return paymentsBase.findById(t, paymentId);
    },
    save(payment) {
      if (!payment || typeof payment !== "object") {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          "Payment entity must be an object."
        );
      }
      const tenantId = requireTenantScopedId(payment.tenantId, "tenantId");
      const txn = payment.providerTransactionReference;
      if (txn) {
        const key = tenantKey(tenantId, String(txn).trim());
        if (providerTxnIndex.has(key)) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.CONFLICT,
            "providerTransactionReference is already used by another payment in this tenant.",
            {
              tenantId,
              providerTransactionReference: String(txn).trim(),
              existingPaymentId: providerTxnIndex.get(key),
            }
          );
        }
      }
      const saved = paymentsBase.save(payment);
      if (saved.providerTransactionReference) {
        providerTxnIndex.set(
          tenantKey(saved.tenantId, saved.providerTransactionReference),
          saved.paymentId
        );
      }
      return saved;
    },
    update(tenantId, paymentId, next) {
      const existing = paymentsBase.getById(tenantId, paymentId);
      const incomingTxn = next?.providerTransactionReference || null;
      if (incomingTxn) {
        const key = tenantKey(tenantId, incomingTxn);
        const owner = providerTxnIndex.get(key);
        if (owner && owner !== paymentId) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.CONFLICT,
            "providerTransactionReference is already used by another payment in this tenant.",
            {
              tenantId,
              providerTransactionReference: incomingTxn,
              existingPaymentId: owner,
            }
          );
        }
      }
      if (
        existing.providerTransactionReference &&
        incomingTxn &&
        existing.providerTransactionReference !== incomingTxn
      ) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
          "providerTransactionReference is immutable once set.",
          { paymentId }
        );
      }
      const updated = paymentsBase.update(tenantId, paymentId, next);
      if (updated.providerTransactionReference) {
        providerTxnIndex.set(
          tenantKey(updated.tenantId, updated.providerTransactionReference),
          updated.paymentId
        );
      }
      return updated;
    },
    _resetForTests() {
      paymentsBase._resetForTests();
      providerTxnIndex.clear();
    },
    _sizeForTests() {
      return paymentsBase._sizeForTests();
    },
  };

  const attempts = createEntityRepository({
    label: FINANCE_REPOSITORY_PORTS.PaymentAttemptRepository,
    idField: "attemptId",
  });
  /** @type {Map<string, string[]>} tenant\0paymentId -> attemptIds */
  const attemptsByPayment = new Map();

  const paymentAttempts = {
    ...attempts,
    listByPaymentId(tenantId, paymentId) {
      const t = requireTenantScopedId(tenantId, "tenantId");
      const pId = requireTenantScopedId(paymentId, "paymentId");
      const ids = attemptsByPayment.get(tenantKey(t, pId)) || [];
      return Object.freeze(
        ids
          .map((attemptId) => attempts.findById(t, attemptId))
          .filter(Boolean)
      );
    },
    save(attempt) {
      const saved = attempts.save(attempt);
      const key = tenantKey(saved.tenantId, saved.paymentId);
      const list = attemptsByPayment.get(key) || [];
      if (!list.includes(saved.attemptId)) {
        list.push(saved.attemptId);
        attemptsByPayment.set(key, list);
      }
      return saved;
    },
    update(tenantId, attemptId, next) {
      return attempts.update(tenantId, attemptId, next);
    },
    _resetForTests() {
      attempts._resetForTests();
      attemptsByPayment.clear();
    },
    _sizeForTests() {
      return attempts._sizeForTests();
    },
  };

  const receiptsBase = createEntityRepository({
    label: FINANCE_REPOSITORY_PORTS.ReceiptRepository,
    idField: "receiptId",
  });
  /** @type {Map<string, string>} tenant\0paymentId -> receiptId */
  const receiptByPayment = new Map();

  const receipts = {
    findById: receiptsBase.findById.bind(receiptsBase),
    getById: receiptsBase.getById.bind(receiptsBase),
    findByPaymentId(tenantId, paymentId) {
      const t = requireTenantScopedId(tenantId, "tenantId");
      const pId = requireTenantScopedId(paymentId, "paymentId");
      const receiptId = receiptByPayment.get(tenantKey(t, pId));
      if (!receiptId) return null;
      return receiptsBase.findById(t, receiptId);
    },
    save(receipt) {
      const tenantId = requireTenantScopedId(receipt?.tenantId, "tenantId");
      const paymentId = requireTenantScopedId(receipt?.paymentId, "paymentId");
      const paymentKey = tenantKey(tenantId, paymentId);
      if (receiptByPayment.has(paymentKey)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.DUPLICATE_FINANCIAL_EFFECT,
          "A receipt already exists for this confirmed payment.",
          {
            tenantId,
            paymentId,
            existingReceiptId: receiptByPayment.get(paymentKey),
          }
        );
      }
      const saved = receiptsBase.save(receipt);
      receiptByPayment.set(paymentKey, saved.receiptId);
      return saved;
    },
    _resetForTests() {
      receiptsBase._resetForTests();
      receiptByPayment.clear();
    },
    _sizeForTests() {
      return receiptsBase._sizeForTests();
    },
  };

  const refundsBase = createEntityRepository({
    label: FINANCE_REPOSITORY_PORTS.RefundRepository,
    idField: "refundId",
  });
  /** @type {Map<string, string[]>} */
  const refundsByPayment = new Map();

  const refunds = {
    ...refundsBase,
    listByPaymentId(tenantId, paymentId) {
      const t = requireTenantScopedId(tenantId, "tenantId");
      const pId = requireTenantScopedId(paymentId, "paymentId");
      const ids = refundsByPayment.get(tenantKey(t, pId)) || [];
      return Object.freeze(
        ids.map((refundId) => refundsBase.findById(t, refundId)).filter(Boolean)
      );
    },
    save(refund) {
      const saved = refundsBase.save(refund);
      const key = tenantKey(saved.tenantId, saved.paymentId);
      const list = refundsByPayment.get(key) || [];
      if (!list.includes(saved.refundId)) {
        list.push(saved.refundId);
        refundsByPayment.set(key, list);
      }
      return saved;
    },
    _resetForTests() {
      refundsBase._resetForTests();
      refundsByPayment.clear();
    },
  };

  /** @type {Map<string, object>} tenant\0operation\0key -> record */
  const idempotencyStore = new Map();

  function idempotencyMapKey(tenantId, operationType, idempotencyKey) {
    return `${tenantId}\u0000${operationType}\u0000${idempotencyKey}`;
  }

  const idempotency = {
    port: FINANCE_REPOSITORY_PORTS.IdempotencyRepository,
    find(tenantId, operationType, idempotencyKey) {
      const t = requireTenantScopedId(tenantId, "tenantId");
      const op = requireTenantScopedId(operationType, "operationType");
      const key = requireTenantScopedId(idempotencyKey, "idempotencyKey");
      const found = idempotencyStore.get(idempotencyMapKey(t, op, key));
      return found ? cloneFrozen(found) : null;
    },
    save(record) {
      if (!record || typeof record !== "object") {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_INPUT,
          "Idempotency record must be an object."
        );
      }
      const tenantId = requireTenantScopedId(record.tenantId, "tenantId");
      const operationType = requireTenantScopedId(
        record.operationType,
        "operationType"
      );
      const idempotencyKey = requireTenantScopedId(
        record.idempotencyKey,
        "idempotencyKey"
      );
      const requestFingerprint = requireTenantScopedId(
        record.requestFingerprint,
        "requestFingerprint"
      );
      const mapKey = idempotencyMapKey(tenantId, operationType, idempotencyKey);
      if (idempotencyStore.has(mapKey)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          "Idempotency key already recorded for this tenant and operation.",
          { tenantId, operationType, idempotencyKey }
        );
      }
      const stored = cloneFrozen({
        tenantId,
        operationType,
        idempotencyKey,
        requestFingerprint,
        result: record.result == null ? null : record.result,
        eventIds: Array.isArray(record.eventIds) ? record.eventIds.slice() : [],
        createdAt: requireTenantScopedId(record.createdAt, "createdAt"),
      });
      idempotencyStore.set(mapKey, stored);
      return cloneFrozen(stored);
    },
    _resetForTests() {
      idempotencyStore.clear();
    },
    _sizeForTests() {
      return idempotencyStore.size;
    },
  };

  /** @type {Map<string, object>} tenant\0eventId */
  const eventsById = new Map();
  /** @type {Map<string, string>} tenant\0eventIdempotencyKey -> eventId */
  const eventsByIdempotency = new Map();
  /** @type {Map<string, string[]>} tenantId -> eventIds order */
  const eventsByTenant = new Map();

  const events = {
    port: FINANCE_REPOSITORY_PORTS.FinanceEventRepository,
    append(event) {
      if (!event || typeof event !== "object") {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
          "Finance event must be an object."
        );
      }
      const tenantId = requireTenantScopedId(event.tenantId, "tenantId");
      const eventId = requireTenantScopedId(event.eventId, "eventId");
      const idempotencyKey = requireTenantScopedId(
        event.idempotencyKey,
        "idempotencyKey"
      );
      const idKey = tenantKey(tenantId, eventId);
      if (eventsById.has(idKey)) {
        throwConflict("Finance event", { tenantId, eventId });
      }
      const idemKey = tenantKey(tenantId, idempotencyKey);
      if (eventsByIdempotency.has(idemKey)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.DUPLICATE_FINANCIAL_EFFECT,
          "Finance event with this idempotencyKey already exists for tenant.",
          {
            tenantId,
            idempotencyKey,
            existingEventId: eventsByIdempotency.get(idemKey),
          }
        );
      }
      const stored = cloneFrozen(event);
      eventsById.set(idKey, stored);
      eventsByIdempotency.set(idemKey, eventId);
      const list = eventsByTenant.get(tenantId) || [];
      list.push(eventId);
      eventsByTenant.set(tenantId, list);
      return cloneFrozen(stored);
    },
    findById(tenantId, eventId) {
      const t = requireTenantScopedId(tenantId, "tenantId");
      const id = requireTenantScopedId(eventId, "eventId");
      const found = eventsById.get(tenantKey(t, id));
      return found ? cloneFrozen(found) : null;
    },
    findByIdempotencyKey(tenantId, idempotencyKey) {
      const t = requireTenantScopedId(tenantId, "tenantId");
      const key = requireTenantScopedId(idempotencyKey, "idempotencyKey");
      const eventId = eventsByIdempotency.get(tenantKey(t, key));
      if (!eventId) return null;
      return this.findById(t, eventId);
    },
    listByTenant(tenantId) {
      const t = requireTenantScopedId(tenantId, "tenantId");
      const ids = eventsByTenant.get(t) || [];
      return Object.freeze(
        ids.map((eventId) => this.findById(t, eventId)).filter(Boolean)
      );
    },
    _resetForTests() {
      eventsById.clear();
      eventsByIdempotency.clear();
      eventsByTenant.clear();
    },
    _sizeForTests() {
      return eventsById.size;
    },
  };

  return {
    /** Capability-proof only — not production persistence. */
    kind: "in-memory",
    feeDefinitions,
    obligations,
    invoices,
    payments,
    paymentAttempts,
    receipts,
    refunds,
    idempotency,
    events,
    /** Test-only: reset every repository in this isolated instance. */
    resetAllForTests() {
      feeDefinitions._resetForTests();
      obligations._resetForTests();
      invoices._resetForTests();
      payments._resetForTests();
      paymentAttempts._resetForTests();
      receipts._resetForTests();
      refunds._resetForTests();
      idempotency._resetForTests();
      events._resetForTests();
    },
  };
}
