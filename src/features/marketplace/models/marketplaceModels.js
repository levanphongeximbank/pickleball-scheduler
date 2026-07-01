export const MARKETPLACE_CATEGORIES = Object.freeze([
  "tournament_package",
  "club_management",
  "ai_tournament",
  "notification_sms_zalo",
  "qr_checkin",
  "advanced_dashboard",
  "tournament_sponsorship",
  "tournament_promotion",
  "coach_service",
  "court_rental",
]);

export const PRODUCT_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive",
});

export const BILLING_TYPES = Object.freeze({
  ONE_TIME: "one_time",
  MONTHLY: "monthly",
  YEARLY: "yearly",
});

export function createMarketplaceProduct(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || `mp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId || null,
    vendorId: input.vendorId || null,
    name: String(input.name || "").trim(),
    description: input.description || "",
    category: input.category || MARKETPLACE_CATEGORIES[0],
    price: Number(input.price) || 0,
    currency: input.currency || "VND",
    billingType: input.billingType || BILLING_TYPES.ONE_TIME,
    status: input.status || PRODUCT_STATUS.DRAFT,
    metadata: input.metadata || {},
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function createMarketplaceOrder(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || `mo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    buyerUserId: input.buyerUserId || null,
    totalAmount: Number(input.totalAmount) || 0,
    currency: input.currency || "VND",
    status: input.status || "pending",
    paymentProvider: input.paymentProvider || null,
    paymentTransactionId: input.paymentTransactionId || null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function createMarketplaceOrderItem(input = {}) {
  return {
    id: input.id || `moi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderId: input.orderId,
    productId: input.productId,
    productName: input.productName,
    quantity: Number(input.quantity) || 1,
    unitPrice: Number(input.unitPrice) || 0,
    totalPrice: Number(input.totalPrice) || 0,
  };
}

export function createMarketplaceSubscription(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || `ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    productId: input.productId,
    orderId: input.orderId,
    status: input.status || "active",
    startsAt: input.startsAt || now,
    endsAt: input.endsAt || null,
    createdAt: input.createdAt || now,
  };
}

export function createMarketplaceVendor(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || `mv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId || null,
    name: String(input.name || "").trim(),
    description: input.description || "",
    status: input.status || "active",
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}
