import { writeAuditLog } from "../../identity/services/auditService.js";
import { getTenantIntegrationSettings } from "../../integrations/storage/integrationStorage.js";
import {
  createPaymentCallback,
  createPaymentRefund,
  createPaymentTransaction,
  PAYMENT_STATUS,
  sanitizePaymentPayload,
} from "../models/paymentModels.js";
import { resolvePaymentProvider } from "../providers/index.js";
import {
  loadPaymentCallbacks,
  loadPaymentRefunds,
  loadPaymentTransactions,
  savePaymentCallbacks,
  savePaymentRefunds,
  savePaymentTransactions,
} from "../storage/paymentStorage.js";
import { markOrderPaid, markOrderFailed } from "../../marketplace/services/marketplaceOrderService.js";

function getTransactions() {
  return loadPaymentTransactions();
}

function saveTransactions(items) {
  savePaymentTransactions(items);
}

export function getPaymentTransaction(transactionId) {
  return getTransactions().find((t) => t.id === transactionId) || null;
}

export function listPaymentTransactions({ tenantId = null } = {}) {
  let items = getTransactions();
  if (tenantId) {
    items = items.filter((t) => t.tenantId === tenantId);
  }
  return items;
}

function resolveProviderForTenant(tenantId, requestedProvider) {
  const settings = getTenantIntegrationSettings(tenantId);
  if (requestedProvider === "mock" && settings.mockPaymentEnabled !== false) {
    return "mock";
  }
  if (requestedProvider === "vnpay" && settings.vnpayEnabled) return "vnpay";
  if (requestedProvider === "momo" && settings.momoEnabled) return "momo";
  if (requestedProvider === "stripe" && settings.stripeEnabled) return "stripe";
  return settings.defaultPaymentProvider || "mock";
}

export async function createPayment(input = {}) {
  const tenantId = input.tenantId;
  const orderId = input.orderId;
  const amount = Number(input.amount);
  const providerName = resolveProviderForTenant(tenantId, input.provider);

  if (!tenantId || !orderId || !amount) {
    return { ok: false, error: "tenantId, orderId, amount là bắt buộc." };
  }

  const idempotencyKey = input.idempotencyKey || `pay_${orderId}`;
  const existing = getTransactions().find((t) => t.idempotencyKey === idempotencyKey);
  if (existing) {
    return { ok: true, transaction: existing, reused: true };
  }

  const provider = resolvePaymentProvider(providerName);
  const result = await provider.createPayment({
    tenantId,
    orderId,
    amount,
    currency: input.currency || "VND",
    idempotencyKey,
    metadata: input.metadata || {},
  });

  if (!result.ok) {
    return { ok: false, error: result.error || "Không tạo được payment." };
  }

  const transaction = createPaymentTransaction({
    tenantId,
    orderId,
    provider: providerName,
    amount,
    currency: input.currency || "VND",
    providerTransactionId: result.providerTransactionId,
    providerPaymentUrl: result.paymentUrl,
    idempotencyKey,
    rawResponse: result.rawResponse,
    status: PAYMENT_STATUS.PENDING,
  });

  const items = getTransactions();
  items.unshift(transaction);
  saveTransactions(items);

  return { ok: true, transaction };
}

export async function handlePaymentCallback(provider, input = {}) {
  const transactionId = input.transactionId;
  const transaction = transactionId ? getPaymentTransaction(transactionId) : null;

  const providerImpl = resolvePaymentProvider(provider);
  const verification = await providerImpl.verifyCallback({
    transactionId,
    payload: input.payload || {},
    signature: input.signature,
    expectedAmount: transaction?.amount,
  });

  const callback = createPaymentCallback({
    transactionId: transaction?.id || transactionId,
    provider,
    payload: sanitizePaymentPayload(input.payload || {}),
    signature: input.signature ? "[REDACTED]" : null,
    verified: verification.verified,
  });

  const callbacks = loadPaymentCallbacks();
  callbacks.unshift(callback);
  savePaymentCallbacks(callbacks);

  if (!verification.ok || !verification.verified) {
    if (transaction) {
      await updateTransactionStatus(transaction.id, PAYMENT_STATUS.FAILED);
      markOrderFailed(transaction.orderId);
    }
    return { ok: false, error: verification.error || "Callback không hợp lệ.", callback };
  }

  if (verification.status === "failed") {
    if (transaction) {
      await updateTransactionStatus(transaction.id, PAYMENT_STATUS.FAILED);
      markOrderFailed(transaction.orderId);
    }
    return { ok: false, error: "Thanh toán thất bại.", callback };
  }

  if (!transaction) {
    return { ok: false, error: "Transaction không tồn tại.", callback };
  }

  const idempotent = transaction.status === PAYMENT_STATUS.SUCCESS;
  if (!idempotent) {
    await updateTransactionStatus(transaction.id, PAYMENT_STATUS.SUCCESS);
    markOrderPaid(transaction.orderId, {
      paymentProvider: provider,
      paymentTransactionId: transaction.id,
    });
    await writeAuditLog({
      action: "payment_success",
      resourceType: "payment_transaction",
      resourceId: transaction.id,
      metadata: { orderId: transaction.orderId, provider },
    });
  }

  return { ok: true, transaction: getPaymentTransaction(transaction.id), callback, idempotent };
}

async function updateTransactionStatus(transactionId, status) {
  const items = getTransactions();
  const index = items.findIndex((t) => t.id === transactionId);
  if (index < 0) return null;
  items[index] = {
    ...items[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  saveTransactions(items);
  return items[index];
}

export async function simulateMockPayment(transactionId, status = "success") {
  return handlePaymentCallback("mock", {
    transactionId,
    payload: {
      status,
      providerTransactionId: transactionId,
    },
  });
}

export function getPaymentStatus(transactionId) {
  const transaction = getPaymentTransaction(transactionId);
  if (!transaction) {
    return { ok: false, error: "Transaction không tồn tại." };
  }
  return { ok: true, transaction };
}

export async function refundPayment(transactionId) {
  const transaction = getPaymentTransaction(transactionId);
  if (!transaction) {
    return { ok: false, error: "Transaction không tồn tại." };
  }

  const provider = resolvePaymentProvider(transaction.provider);
  const result = await provider.refund({
    transactionId,
    amount: transaction.amount,
  });

  const refund = createPaymentRefund({
    transactionId,
    amount: transaction.amount,
    status: result.ok ? "success" : "failed",
    providerRefundId: result.providerRefundId || null,
  });

  const refunds = loadPaymentRefunds();
  refunds.unshift(refund);
  savePaymentRefunds(refunds);

  if (result.ok) {
    await updateTransactionStatus(transactionId, PAYMENT_STATUS.REFUNDED);
  }

  return { ok: result.ok, refund, error: result.error };
}

export function listPaymentCallbacks({ limit = 100 } = {}) {
  return loadPaymentCallbacks().slice(0, limit);
}

export function listPaymentRefunds({ limit = 100 } = {}) {
  return loadPaymentRefunds().slice(0, limit);
}
