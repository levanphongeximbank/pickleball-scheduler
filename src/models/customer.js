export const CUSTOMER_TYPES = ["walk_in", "member", "club", "visitor"];

export const MEMBERSHIP_PLANS = Object.freeze([
  { value: "monthly", label: "Gói tháng" },
  { value: "quarterly", label: "Gói quý" },
  { value: "yearly", label: "Gói năm" },
]);

export function getMembershipPlanLabel(plan) {
  return MEMBERSHIP_PLANS.find((item) => item.value === plan)?.label || "—";
}

export function getMembershipStatus(customer) {
  if (customer?.customerType !== "member") {
    return "none";
  }
  if (!customer.membershipExpiresAt) {
    return "active";
  }
  const expires = new Date(customer.membershipExpiresAt);
  if (Number.isNaN(expires.getTime())) {
    return "active";
  }
  return expires >= new Date() ? "active" : "expired";
}

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
    memberSince: raw.memberSince || (raw.customerType === "member" ? raw.createdAt : "") || "",
    membershipPlan: raw.membershipPlan ? String(raw.membershipPlan).trim() : "",
    membershipExpiresAt: raw.membershipExpiresAt || "",
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
