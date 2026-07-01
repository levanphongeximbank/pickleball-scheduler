import { createId } from "../../../utils/id.js";
import { PAYMENT_STATUS } from "../constants/billingConstants.js";
import { getPaymentProvider } from "../providers/index.js";
import { BillingAuditService } from "./billingAuditService.js";
import { ensureCollection, writeCollection } from "./billingStoreUtils.js";

export class PaymentService {
  constructor({ store, subscriptionService, invoiceService } = {}) {
    this.store = store;
    this.subscriptionService = subscriptionService;
    this.invoiceService = invoiceService;
    this.audit = new BillingAuditService({ store });
  }

  getById(id) {
    return ensureCollection(this.store, "payments", []).find((item) => item.id === id) || null;
  }

  listByTenant(tenantId) {
    return ensureCollection(this.store, "payments", []).filter((item) => item.tenant_id === tenantId);
  }

  listAll() {
    return ensureCollection(this.store, "payments", []);
  }

  validateInvoiceAmount(invoiceId, amount) {
    const invoice = this.invoiceService?.getById(invoiceId);
    if (!invoice) {
      return { ok: false, error: "invoice_not_found" };
    }
    if (Number(amount) !== Number(invoice.total_amount)) {
      return { ok: false, error: "amount_mismatch", expected: invoice.total_amount, received: amount };
    }
    return { ok: true, invoice };
  }

  async createPaymentIntent({ tenantId, invoiceId, provider = "manual", amount, currency = "VND" } = {}) {
    const validation = this.validateInvoiceAmount(invoiceId, amount);
    if (!validation.ok) {
      return validation;
    }

    const paymentProvider = getPaymentProvider(provider);
    if (!paymentProvider) {
      return { ok: false, error: "unknown_provider" };
    }

    if (!paymentProvider.isEnabled(import.meta.env || {})) {
      return { ok: false, error: "provider_disabled", code: "GATEWAY_DISABLED" };
    }

    const intent = await paymentProvider.createPaymentIntent({
      tenantId,
      invoiceId,
      amount,
      currency,
    });

    const payment = this.recordPayment({
      tenantId,
      invoiceId,
      provider,
      amount,
      currency,
      status: PAYMENT_STATUS.PENDING,
      rawPayload: intent,
    });

    return { ok: true, intent, payment };
  }

  recordPayment({ tenantId, invoiceId, provider = "manual", amount = 0, currency = "VND", status = PAYMENT_STATUS.PENDING, rawPayload = null, actorUserId = null } = {}) {
    const payments = ensureCollection(this.store, "payments", []);
    const payment = {
      id: `payment-${createId()}`,
      tenant_id: tenantId,
      invoice_id: invoiceId,
      provider,
      provider_transaction_id: `tx-${createId()}`,
      amount,
      currency,
      status,
      paid_at: status === PAYMENT_STATUS.SUCCEEDED ? new Date().toISOString() : null,
      raw_payload: rawPayload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    writeCollection(this.store, "payments", [...payments, payment]);

    this.audit.log({
      tenantId,
      actorUserId,
      eventType: "PaymentCreated",
      entityType: "payment",
      entityId: payment.id,
      after: { status, provider, amount },
    });

    if (status === PAYMENT_STATUS.SUCCEEDED) {
      this.handleProviderSuccess({ paymentId: payment.id, actorUserId });
    } else if (status === PAYMENT_STATUS.FAILED) {
      this.handleProviderFail({ paymentId: payment.id, actorUserId });
    }

    return payment;
  }

  handleProviderSuccess({ paymentId, actorUserId } = {}) {
    const payment = this.getById(paymentId);
    if (!payment) {
      return { ok: false, error: "payment_not_found" };
    }

    const payments = ensureCollection(this.store, "payments", []);
    writeCollection(
      this.store,
      "payments",
      payments.map((item) =>
        item.id === paymentId
          ? { ...item, status: PAYMENT_STATUS.SUCCEEDED, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : item
      )
    );

    this.invoiceService?.markPaid(payment.invoice_id, { actorUserId });
    const subscription = this.subscriptionService?.getByTenant(payment.tenant_id);
    if (subscription) {
      this.subscriptionService?.activateSubscription(subscription.id);
    }

    this.audit.log({
      tenantId: payment.tenant_id,
      actorUserId,
      eventType: "PaymentReceived",
      entityType: "payment",
      entityId: paymentId,
      after: { status: PAYMENT_STATUS.SUCCEEDED },
    });

    return { ok: true, payment };
  }

  handleProviderFail({ paymentId, actorUserId, reason = "payment_failed" } = {}) {
    const payment = this.getById(paymentId);
    if (!payment) {
      return { ok: false, error: "payment_not_found" };
    }

    const payments = ensureCollection(this.store, "payments", []);
    writeCollection(
      this.store,
      "payments",
      payments.map((item) =>
        item.id === paymentId
          ? { ...item, status: PAYMENT_STATUS.FAILED, updated_at: new Date().toISOString() }
          : item
      )
    );

    this.audit.log({
      tenantId: payment.tenant_id,
      actorUserId,
      eventType: "PaymentFailed",
      entityType: "payment",
      entityId: paymentId,
      metadata: { reason },
    });

    return { ok: true, payment };
  }

  async refund({ paymentId, actorUserId } = {}) {
    const payment = this.getById(paymentId);
    if (!payment) {
      return { ok: false, error: "payment_not_found" };
    }

    const provider = getPaymentProvider(payment.provider);
    const result = await provider?.refund?.({ paymentId });

    const payments = ensureCollection(this.store, "payments", []);
    writeCollection(
      this.store,
      "payments",
      payments.map((item) =>
        item.id === paymentId
          ? { ...item, status: PAYMENT_STATUS.REFUNDED, updated_at: new Date().toISOString() }
          : item
      )
    );

    this.audit.log({
      tenantId: payment.tenant_id,
      actorUserId,
      eventType: "PaymentRefunded",
      entityType: "payment",
      entityId: paymentId,
      after: { status: PAYMENT_STATUS.REFUNDED },
    });

    return { ok: true, result };
  }
}
