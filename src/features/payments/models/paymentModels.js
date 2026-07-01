export const PAYMENT_PROVIDERS = Object.freeze({
  MOCK: "mock",
  VNPAY: "vnpay",
  MOMO: "momo",
  STRIPE: "stripe",
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
});

export const ORDER_STATUS = Object.freeze({
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
});

export function createPaymentTransaction(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || `ptx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    orderId: input.orderId,
    provider: input.provider || PAYMENT_PROVIDERS.MOCK,
    amount: Number(input.amount) || 0,
    currency: input.currency || "VND",
    status: input.status || PAYMENT_STATUS.PENDING,
    providerTransactionId: input.providerTransactionId || null,
    providerPaymentUrl: input.providerPaymentUrl || null,
    idempotencyKey: input.idempotencyKey || `idem_${Date.now()}`,
    rawResponse: input.rawResponse || null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function createPaymentCallback(input = {}) {
  return {
    id: input.id || `pcb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    transactionId: input.transactionId,
    provider: input.provider,
    payload: input.payload || {},
    signature: input.signature || null,
    verified: Boolean(input.verified),
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function createPaymentRefund(input = {}) {
  return {
    id: input.id || `prf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    transactionId: input.transactionId,
    amount: Number(input.amount) || 0,
    status: input.status || "pending",
    providerRefundId: input.providerRefundId || null,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function sanitizePaymentPayload(payload = {}) {
  const blocked = new Set([
    "password",
    "secret",
    "hashSecret",
    "accessKey",
    "secretKey",
    "token",
    "signature",
  ]);
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (blocked.has(key)) {
      acc[key] = "[REDACTED]";
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
}
