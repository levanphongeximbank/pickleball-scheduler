const PRODUCTS_KEY = "pickleball-marketplace-products-v1";
const ORDERS_KEY = "pickleball-marketplace-orders-v1";
const ORDER_ITEMS_KEY = "pickleball-marketplace-order-items-v1";
const SUBS_KEY = "pickleball-marketplace-subscriptions-v1";
const VENDORS_KEY = "pickleball-marketplace-vendors-v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadMarketplaceProducts() {
  return readJson(PRODUCTS_KEY, []);
}

export function saveMarketplaceProducts(items) {
  writeJson(PRODUCTS_KEY, items || []);
}

export function loadMarketplaceOrders() {
  return readJson(ORDERS_KEY, []);
}

export function saveMarketplaceOrders(items) {
  writeJson(ORDERS_KEY, items || []);
}

export function loadMarketplaceOrderItems() {
  return readJson(ORDER_ITEMS_KEY, []);
}

export function saveMarketplaceOrderItems(items) {
  writeJson(ORDER_ITEMS_KEY, items || []);
}

export function loadMarketplaceSubscriptions() {
  return readJson(SUBS_KEY, []);
}

export function saveMarketplaceSubscriptions(items) {
  writeJson(SUBS_KEY, items || []);
}

export function loadMarketplaceVendors() {
  return readJson(VENDORS_KEY, []);
}

export function saveMarketplaceVendors(items) {
  writeJson(VENDORS_KEY, items || []);
}

export function clearMarketplaceStorage() {
  localStorage.removeItem(PRODUCTS_KEY);
  localStorage.removeItem(ORDERS_KEY);
  localStorage.removeItem(ORDER_ITEMS_KEY);
  localStorage.removeItem(SUBS_KEY);
  localStorage.removeItem(VENDORS_KEY);
}
