export const CUSTOMER_TYPES = ["walk_in", "member", "club", "visitor"];

function toNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export function normalizeCustomer(raw = {}, index = 0) {
  return {
    id: raw.id ?? `customer-${Date.now()}-${index}`,
    name: raw.name ? String(raw.name).trim() : "",
    phone: raw.phone ? String(raw.phone).trim() : "",
    customerType: CUSTOMER_TYPES.includes(raw.customerType)
      ? raw.customerType
      : "walk_in",
    totalBookings: toNonNegativeNumber(raw.totalBookings),
    totalSpent: toNonNegativeNumber(raw.totalSpent),
    debtAmount: toNonNegativeNumber(raw.debtAmount),
    note: raw.note ? String(raw.note).trim() : "",
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function normalizeCustomers(customers = []) {
  if (!Array.isArray(customers)) {
    return [];
  }

  return customers.filter(Boolean).map((item, index) => normalizeCustomer(item, index));
}
