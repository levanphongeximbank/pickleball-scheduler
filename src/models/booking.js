export const CUSTOMER_TYPES = ["walk_in", "member", "club", "visitor", "event"];

export const BOOKING_TYPES = [
  "single",
  "recurring",
  "social_play",
  "tournament",
  "maintenance",
];

export const PAYMENT_STATUSES = ["unpaid", "deposit_paid", "paid", "refunded"];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "playing",
  "completed",
  "cancelled",
  "no_show",
];

const ACTIVE_BOOKING_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "playing",
]);

function toNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export function derivePaymentStatus(totalAmount, paidAmount, depositAmount = 0) {
  const total = toNonNegativeNumber(totalAmount);
  const paid = toNonNegativeNumber(paidAmount);

  if (paid >= total && total > 0) {
    return "paid";
  }

  if (paid > 0) {
    return "deposit_paid";
  }

  if (toNonNegativeNumber(depositAmount) > 0) {
    return "deposit_paid";
  }

  return "unpaid";
}

export function getRemainingAmount(totalAmount, paidAmount) {
  return Math.max(0, toNonNegativeNumber(totalAmount) - toNonNegativeNumber(paidAmount));
}

export function generateBookingCode() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const randomPart = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `BK${datePart}${randomPart}`;
}

export function isActiveBookingStatus(status) {
  return ACTIVE_BOOKING_STATUSES.has(status);
}

export function normalizeBooking(raw = {}, index = 0) {
  const totalAmount = toNonNegativeNumber(raw.totalAmount);
  const depositAmount = toNonNegativeNumber(raw.depositAmount);
  const paidAmount = toNonNegativeNumber(raw.paidAmount);
  const now = new Date().toISOString();

  const bookingStatus = BOOKING_STATUSES.includes(raw.bookingStatus)
    ? raw.bookingStatus
    : "confirmed";

  const paymentStatus =
    raw.paymentStatus && PAYMENT_STATUSES.includes(raw.paymentStatus)
      ? raw.paymentStatus
      : derivePaymentStatus(totalAmount, paidAmount, depositAmount);

  return {
    id: raw.id ?? `booking-${Date.now()}-${index}`,
    bookingCode: raw.bookingCode ? String(raw.bookingCode) : generateBookingCode(),
    courtId: raw.courtId ?? null,
    courtName: raw.courtName ? String(raw.courtName).trim() : "",
    customerName: raw.customerName ? String(raw.customerName).trim() : "",
    customerPhone: raw.customerPhone ? String(raw.customerPhone).trim() : "",
    customerType: CUSTOMER_TYPES.includes(raw.customerType)
      ? raw.customerType
      : "walk_in",
    bookingType: BOOKING_TYPES.includes(raw.bookingType)
      ? raw.bookingType
      : "single",
    date: raw.date ? String(raw.date).slice(0, 10) : "",
    startTime: raw.startTime ? String(raw.startTime).slice(0, 5) : "",
    endTime: raw.endTime ? String(raw.endTime).slice(0, 5) : "",
    durationMinutes: toNonNegativeNumber(raw.durationMinutes),
    totalAmount,
    depositAmount,
    paidAmount,
    paymentStatus,
    bookingStatus,
    note: raw.note ? String(raw.note).trim() : "",
    recurringSeriesId: raw.recurringSeriesId ? String(raw.recurringSeriesId) : null,
    tournamentId: raw.tournamentId ? String(raw.tournamentId) : null,
    reminderSentAt: raw.reminderSentAt ? String(raw.reminderSentAt) : null,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

export function normalizeBookings(bookings = []) {
  if (!Array.isArray(bookings)) {
    return [];
  }

  return bookings.filter(Boolean).map((item, index) => normalizeBooking(item, index));
}

export function createBookingRecord(input = {}) {
  const now = new Date().toISOString();
  const uniqueSuffix = Math.random().toString(36).slice(2, 8);

  return normalizeBooking({
    id: `booking-${Date.now()}-${uniqueSuffix}`,
    bookingCode: generateBookingCode(),
    bookingType: "single",
    bookingStatus: "confirmed",
    customerType: "walk_in",
    createdAt: now,
    updatedAt: now,
    ...input,
  });
}
