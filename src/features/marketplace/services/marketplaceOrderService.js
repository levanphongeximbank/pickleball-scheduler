import { writeAuditLog } from "../../identity/services/auditService.js";
import { createPayment } from "../../payments/services/paymentGatewayService.js";
import {
  createMarketplaceOrder,
  createMarketplaceOrderItem,
  createMarketplaceSubscription,
  BILLING_TYPES,
} from "../models/marketplaceModels.js";
import { getProduct } from "./marketplaceProductService.js";
import {
  loadMarketplaceOrderItems,
  loadMarketplaceOrders,
  loadMarketplaceSubscriptions,
  saveMarketplaceOrderItems,
  saveMarketplaceOrders,
  saveMarketplaceSubscriptions,
} from "../storage/marketplaceStorage.js";

export function getOrder(orderId) {
  return loadMarketplaceOrders().find((o) => o.id === orderId) || null;
}

export function listOrders({ tenantId = null } = {}) {
  let orders = loadMarketplaceOrders();
  if (tenantId) {
    orders = orders.filter((o) => o.tenantId === tenantId);
  }
  return orders;
}

export function getOrderItems(orderId) {
  return loadMarketplaceOrderItems().filter((i) => i.orderId === orderId);
}

function activateEntitlement(order, product) {
  if (product.billingType === BILLING_TYPES.ONE_TIME) {
    return null;
  }
  const endsAt = new Date();
  if (product.billingType === BILLING_TYPES.MONTHLY) {
    endsAt.setMonth(endsAt.getMonth() + 1);
  } else if (product.billingType === BILLING_TYPES.YEARLY) {
    endsAt.setFullYear(endsAt.getFullYear() + 1);
  }

  const subscription = createMarketplaceSubscription({
    tenantId: order.tenantId,
    productId: product.id,
    orderId: order.id,
    status: "active",
    endsAt: endsAt.toISOString(),
  });

  const subs = loadMarketplaceSubscriptions();
  subs.unshift(subscription);
  saveMarketplaceSubscriptions(subs);
  return subscription;
}

export async function createOrder(input = {}) {
  const { tenantId, buyerUserId, productId, quantity = 1, provider } = input;
  const product = getProduct(productId);

  if (!tenantId || !productId) {
    return { ok: false, error: "tenantId và productId là bắt buộc." };
  }
  if (!product || product.status !== "active") {
    return { ok: false, error: "Sản phẩm không khả dụng." };
  }
  if (product.tenantId && product.tenantId !== tenantId) {
    return { ok: false, error: "Sản phẩm không thuộc tenant này." };
  }

  const qty = Math.max(1, Number(quantity) || 1);
  const totalAmount = product.price * qty;

  const order = createMarketplaceOrder({
    tenantId,
    buyerUserId,
    totalAmount,
    currency: product.currency,
    status: "pending",
  });

  const orderItem = createMarketplaceOrderItem({
    orderId: order.id,
    productId: product.id,
    productName: product.name,
    quantity: qty,
    unitPrice: product.price,
    totalPrice: totalAmount,
  });

  const orders = loadMarketplaceOrders();
  orders.unshift(order);
  saveMarketplaceOrders(orders);

  const items = loadMarketplaceOrderItems();
  items.unshift(orderItem);
  saveMarketplaceOrderItems(items);

  const payment = await createPayment({
    tenantId,
    orderId: order.id,
    amount: totalAmount,
    currency: product.currency,
    provider,
    idempotencyKey: `order_${order.id}`,
  });

  if (!payment.ok) {
    markOrderFailed(order.id);
    return { ok: false, error: payment.error };
  }

  const updatedOrders = loadMarketplaceOrders();
  const idx = updatedOrders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    updatedOrders[idx] = {
      ...updatedOrders[idx],
      paymentProvider: payment.transaction.provider,
      paymentTransactionId: payment.transaction.id,
      updatedAt: new Date().toISOString(),
    };
    saveMarketplaceOrders(updatedOrders);
  }

  await writeAuditLog({
    action: "create",
    resourceType: "marketplace_order",
    resourceId: order.id,
    metadata: { productId, totalAmount },
  });

  return {
    ok: true,
    order: getOrder(order.id),
    items: getOrderItems(order.id),
    payment: payment.transaction,
  };
}

export function markOrderPaid(orderId, input = {}) {
  const orders = loadMarketplaceOrders();
  const index = orders.findIndex((o) => o.id === orderId);
  if (index < 0) return { ok: false, error: "Order không tồn tại." };

  const order = orders[index];
  if (order.status === "paid") {
    return { ok: true, order, idempotent: true };
  }

  orders[index] = {
    ...order,
    status: "paid",
    paymentProvider: input.paymentProvider || order.paymentProvider,
    paymentTransactionId: input.paymentTransactionId || order.paymentTransactionId,
    updatedAt: new Date().toISOString(),
  };
  saveMarketplaceOrders(orders);

  const items = getOrderItems(orderId);
  const product = items[0] ? getProduct(items[0].productId) : null;
  let subscription = null;
  if (product) {
    subscription = activateEntitlement(orders[index], product);
  }

  writeAuditLog({
    action: "update",
    resourceType: "marketplace_order",
    resourceId: orderId,
    metadata: { status: "paid" },
  });

  return { ok: true, order: orders[index], subscription };
}

export function markOrderFailed(orderId) {
  const orders = loadMarketplaceOrders();
  const index = orders.findIndex((o) => o.id === orderId);
  if (index < 0) return { ok: false, error: "Order không tồn tại." };
  orders[index] = {
    ...orders[index],
    status: "failed",
    updatedAt: new Date().toISOString(),
  };
  saveMarketplaceOrders(orders);
  return { ok: true, order: orders[index] };
}

export function listMarketplaceSubscriptions({ tenantId = null } = {}) {
  let subs = loadMarketplaceSubscriptions();
  if (tenantId) {
    subs = subs.filter((s) => s.tenantId === tenantId);
  }
  return subs;
}
