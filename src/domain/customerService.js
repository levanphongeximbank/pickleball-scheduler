import {
  loadCustomersForClub,
  loadBookingsForClub,
  saveCustomersForClub,
} from "./clubStorage.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { guardClubAction } from "../auth/guardAction.js";
import { normalizeCustomer } from "../models/customer.js";
import { getRemainingAmount } from "../models/booking.js";

const INACTIVE_STATUSES = new Set(["cancelled", "no_show"]);

function matchesCustomer(booking, customer) {
  if (!booking?.customerName || !customer?.name) {
    return false;
  }

  if (customer.phone && booking.customerPhone) {
    return customer.phone === booking.customerPhone;
  }

  return booking.customerName.toLowerCase() === customer.name.toLowerCase();
}

export function getBookingsForCustomer(bookings, customer) {
  return (bookings || []).filter((booking) => matchesCustomer(booking, customer));
}

function recalculateCustomerStats(customer, bookings) {
  const related = getBookingsForCustomer(bookings, customer).filter(
    (booking) => !INACTIVE_STATUSES.has(booking.bookingStatus)
  );

  return {
    totalBookings: related.length,
    totalSpent: related.reduce((sum, booking) => sum + (Number(booking.paidAmount) || 0), 0),
    debtAmount: related.reduce(
      (sum, booking) => sum + getRemainingAmount(booking.totalAmount, booking.paidAmount),
      0
    ),
  };
}

export function findCustomerById(customerId, clubId) {
  return loadCustomersForClub(clubId).find((item) => item.id === customerId) || null;
}

function findDuplicatePhone(customers, phone, excludeId = null) {
  if (!phone) {
    return null;
  }

  return (
    customers.find((item) => item.phone === phone && item.id !== excludeId) || null
  );
}

export function createCustomer(input, clubId) {
  const check = guardClubAction(clubId, PERMISSIONS.CUSTOMER_UPDATE);
  if (!check.ok) {
    return { ok: false, message: check.error };
  }

  const name = input.name?.trim();

  if (!name) {
    return { ok: false, message: "Vui lòng nhập tên khách." };
  }

  const customers = loadCustomersForClub(clubId);
  const phone = input.phone?.trim() || "";
  const duplicate = findDuplicatePhone(customers, phone);

  if (duplicate) {
    return { ok: false, message: "Số điện thoại đã tồn tại." };
  }

  const now = new Date().toISOString();
  const customerType = input.customerType || "walk_in";
  const created = normalizeCustomer({
    id: `customer-${Date.now()}`,
    name,
    phone,
    customerType,
    note: input.note?.trim() || "",
    memberSince: customerType === "member" ? input.memberSince || now : "",
    membershipPlan: customerType === "member" ? input.membershipPlan || "" : "",
    membershipExpiresAt: customerType === "member" ? input.membershipExpiresAt || "" : "",
    totalBookings: 0,
    totalSpent: 0,
    debtAmount: 0,
    createdAt: now,
    updatedAt: now,
  });

  saveCustomersForClub([...customers, created], clubId);

  return { ok: true, customer: created };
}

export function updateCustomer(customerId, input, clubId) {
  const check = guardClubAction(clubId, PERMISSIONS.CUSTOMER_UPDATE);
  if (!check.ok) {
    return { ok: false, message: check.error };
  }

  const customers = loadCustomersForClub(clubId);
  const existing = customers.find((item) => item.id === customerId);

  if (!existing) {
    return { ok: false, message: "Không tìm thấy khách." };
  }

  const name = input.name?.trim() || existing.name;
  const phone = input.phone !== undefined ? input.phone.trim() : existing.phone;
  const duplicate = findDuplicatePhone(customers, phone, customerId);

  if (duplicate) {
    return { ok: false, message: "Số điện thoại đã tồn tại." };
  }

  const bookings = loadBookingsForClub(clubId);
  const stats = recalculateCustomerStats(
    { ...existing, name, phone },
    bookings
  );

  const nextType = input.customerType || existing.customerType;
  const updated = normalizeCustomer({
    ...existing,
    name,
    phone,
    customerType: nextType,
    note: input.note !== undefined ? input.note.trim() : existing.note,
    memberSince:
      input.memberSince !== undefined
        ? input.memberSince
        : nextType === "member"
          ? existing.memberSince || existing.createdAt
          : "",
    membershipPlan:
      input.membershipPlan !== undefined
        ? input.membershipPlan
        : nextType === "member"
          ? existing.membershipPlan
          : "",
    membershipExpiresAt:
      input.membershipExpiresAt !== undefined
        ? input.membershipExpiresAt
        : nextType === "member"
          ? existing.membershipExpiresAt
          : "",
    totalBookings: stats.totalBookings,
    totalSpent: stats.totalSpent,
    debtAmount: stats.debtAmount,
    updatedAt: new Date().toISOString(),
  });

  saveCustomersForClub(
    customers.map((item) => (item.id === customerId ? updated : item)),
    clubId
  );

  return { ok: true, customer: updated };
}

export function deleteCustomer(customerId, clubId) {
  const check = guardClubAction(clubId, PERMISSIONS.CUSTOMER_UPDATE);
  if (!check.ok) {
    return { ok: false, message: check.error };
  }

  const customers = loadCustomersForClub(clubId);
  const existing = customers.find((item) => item.id === customerId);

  if (!existing) {
    return { ok: false, message: "Không tìm thấy khách." };
  }

  const bookings = loadBookingsForClub(clubId);
  const related = getBookingsForCustomer(bookings, existing);
  const hasActive = related.some(
    (booking) => !INACTIVE_STATUSES.has(booking.bookingStatus)
  );

  if (hasActive) {
    return {
      ok: false,
      message: "Khách còn booking đang hiệu lực, không thể xóa.",
    };
  }

  saveCustomersForClub(
    customers.filter((item) => item.id !== customerId),
    clubId
  );

  return { ok: true };
}

export function recalculateAllCustomerStats(clubId) {
  const customers = loadCustomersForClub(clubId);
  const bookings = loadBookingsForClub(clubId);
  const now = new Date().toISOString();

  const updated = customers.map((customer) => {
    const stats = recalculateCustomerStats(customer, bookings);

    return normalizeCustomer({
      ...customer,
      ...stats,
      updatedAt: now,
    });
  });

  saveCustomersForClub(updated, clubId);

  return updated;
}

export function mergeCustomersByPhone(clubId) {
  const customers = loadCustomersForClub(clubId);
  const bookings = loadBookingsForClub(clubId);
  const withoutPhone = customers.filter((customer) => !customer.phone);
  const withPhone = customers.filter((customer) => customer.phone);
  const groups = new Map();

  withPhone.forEach((customer) => {
    const list = groups.get(customer.phone) || [];
    list.push(customer);
    groups.set(customer.phone, list);
  });

  let mergedCount = 0;
  const merged = [];

  groups.forEach((group) => {
    if (group.length === 1) {
      merged.push(group[0]);
      return;
    }

    mergedCount += group.length - 1;
    const primary = [...group].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))[0];
    const stats = recalculateCustomerStats(primary, bookings);

    merged.push(
      normalizeCustomer({
        ...primary,
        note: group
          .map((item) => item.note)
          .filter(Boolean)
          .join(" · "),
        ...stats,
        updatedAt: new Date().toISOString(),
      })
    );
  });

  const finalCustomers = [...withoutPhone, ...merged];
  saveCustomersForClub(finalCustomers, clubId);

  return {
    ok: true,
    mergedCount,
    totalCustomers: finalCustomers.length,
    message:
      mergedCount > 0
        ? `Đã gộp ${mergedCount} khách trùng SĐT.`
        : "Không có khách trùng SĐT để gộp.",
  };
}

export function buildCustomerCsv(customers = []) {
  const lines = ["Tên,SĐT,Loại,Booking,Đã chi,Công nợ,Ghi chú"];

  customers.forEach((customer) => {
    lines.push(
      [
        customer.name,
        customer.phone || "",
        customer.customerType,
        customer.totalBookings || 0,
        customer.totalSpent || 0,
        customer.debtAmount || 0,
        customer.note || "",
      ].join(",")
    );
  });

  return lines.join("\n");
}

export function upsertCustomerFromBooking(booking, clubId, { isNew = true } = {}) {
  if (!booking?.customerName) {
    return null;
  }

  const customers = loadCustomersForClub(clubId);
  const bookings = loadBookingsForClub(clubId);
  const phone = booking.customerPhone || "";
  const existing = customers.find((item) => matchesCustomer(booking, item));
  const now = new Date().toISOString();

  if (existing) {
    const stats = recalculateCustomerStats(existing, bookings);
    const updated = normalizeCustomer({
      ...existing,
      name: booking.customerName,
      phone: phone || existing.phone,
      customerType: booking.customerType || existing.customerType,
      totalBookings: stats.totalBookings,
      totalSpent: stats.totalSpent,
      debtAmount: stats.debtAmount,
      updatedAt: now,
    });

    saveCustomersForClub(
      customers.map((item) => (item.id === existing.id ? updated : item)),
      clubId
    );

    return updated;
  }

  const stats = recalculateCustomerStats(
    { name: booking.customerName, phone },
    [...bookings, booking]
  );

  const created = normalizeCustomer({
    id: `customer-${Date.now()}`,
    name: booking.customerName,
    phone,
    customerType: booking.customerType || "walk_in",
    totalBookings: isNew ? stats.totalBookings : 0,
    totalSpent: stats.totalSpent,
    debtAmount: stats.debtAmount,
    createdAt: now,
    updatedAt: now,
  });

  saveCustomersForClub([...customers, created], clubId);
  return created;
}
