import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  checkBookingConflict,
  calculateDuration,
  doTimesOverlap,
  getBookingsByDate,
  computeDailyRevenue,
} from "../src/domain/courtBookingEngine.js";
import { derivePaymentStatus, getRemainingAmount } from "../src/models/booking.js";
import { createBooking } from "../src/domain/bookingService.js";
import {
  loadBookingsForClub,
  loadClubData,
  saveClubData,
  getDefaultClubData,
} from "../src/domain/clubStorage.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { normalizeCourt } from "../src/models/court.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

let originalDateNow;

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  originalDateNow = Date.now;
  Date.now = () => 1700000000000;
  setActiveClubId(DEFAULT_CLUB.id);

  const data = getDefaultClubData(DEFAULT_CLUB.id);
  data.courts = [
    normalizeCourt({ id: 1, name: "Sân 1", number: 1, active: true }),
    normalizeCourt({ id: 2, name: "Sân 2", number: 2, active: true }),
  ];
  saveClubData(DEFAULT_CLUB.id, data);
});

afterEach(() => {
  Date.now = originalDateNow;
});

test("calculateDuration returns minutes between times", () => {
  assert.equal(calculateDuration("18:00", "20:00"), 120);
  assert.equal(calculateDuration("20:00", "18:00"), 0);
});

test("doTimesOverlap detects overlapping ranges", () => {
  assert.equal(doTimesOverlap("18:00", "20:00", "19:00", "21:00"), true);
  assert.equal(doTimesOverlap("18:00", "20:00", "20:00", "21:00"), false);
  assert.equal(doTimesOverlap("18:00", "20:00", "16:00", "18:00"), false);
  assert.equal(doTimesOverlap("18:00", "20:00", "17:30", "18:30"), true);
});

test("checkBookingConflict blocks overlapping booking on same court", () => {
  const bookings = [
    {
      id: "b1",
      courtId: 1,
      courtName: "Sân 1",
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      bookingStatus: "confirmed",
    },
  ];

  const conflict = checkBookingConflict(bookings, {
    courtId: 1,
    date: "2026-06-28",
    startTime: "19:00",
    endTime: "21:00",
  });

  assert.ok(conflict);
  assert.match(conflict.message, /Sân 1/);
});

test("checkBookingConflict allows adjacent booking", () => {
  const bookings = [
    {
      id: "b1",
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      bookingStatus: "confirmed",
    },
  ];

  const conflict = checkBookingConflict(bookings, {
    courtId: 1,
    date: "2026-06-28",
    startTime: "20:00",
    endTime: "21:00",
  });

  assert.equal(conflict, null);
});

test("createBooking saves booking and appears in storage", () => {
  const result = createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      customerPhone: "0901234567",
      totalAmount: 400000,
      depositAmount: 100000,
      paidAmount: 100000,
    },
    DEFAULT_CLUB.id
  );

  assert.equal(result.ok, true);
  assert.equal(result.booking.customerName, "Anh Nam");
  assert.equal(result.booking.paymentStatus, "deposit_paid");

  const stored = loadBookingsForClub(DEFAULT_CLUB.id);
  assert.equal(stored.length, 1);
});

test("saveBooking rejects conflict", () => {
  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  const result = createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "19:00",
      endTime: "21:00",
      customerName: "Chị Hằng",
      totalAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /trùng giờ/);
});

test("payment status updates correctly", () => {
  assert.equal(derivePaymentStatus(400000, 0), "unpaid");
  assert.equal(derivePaymentStatus(400000, 100000), "deposit_paid");
  assert.equal(derivePaymentStatus(400000, 400000), "paid");
  assert.equal(getRemainingAmount(400000, 100000), 300000);
});

test("computeDailyRevenue aggregates day stats", () => {
  const bookings = [
    {
      date: "2026-06-28",
      totalAmount: 400000,
      paidAmount: 400000,
      bookingStatus: "completed",
      bookingType: "single",
      courtName: "Sân 1",
    },
    {
      date: "2026-06-28",
      totalAmount: 200000,
      paidAmount: 100000,
      bookingStatus: "playing",
      bookingType: "single",
      courtName: "Sân 2",
    },
    {
      date: "2026-06-28",
      totalAmount: 100000,
      paidAmount: 0,
      bookingStatus: "cancelled",
      bookingType: "single",
      courtName: "Sân 1",
    },
  ];

  const summary = computeDailyRevenue(bookings, "2026-06-28");

  assert.equal(summary.expectedRevenue, 600000);
  assert.equal(summary.collected, 500000);
  assert.equal(summary.debt, 100000);
  assert.equal(summary.totalBookings, 3);
  assert.equal(summary.completed, 1);
  assert.equal(summary.playing, 1);
  assert.equal(summary.cancelled, 1);
});

test("getBookingsByDate filters by date", () => {
  const bookings = [
    { date: "2026-06-28", id: "a" },
    { date: "2026-06-29", id: "b" },
  ];

  assert.equal(getBookingsByDate(bookings, "2026-06-28").length, 1);
});

test("saveBooking rejects locked court", () => {
  const data = getDefaultClubData(DEFAULT_CLUB.id);
  data.courts = [
    normalizeCourt({ id: 1, name: "Sân 1", active: false, status: "locked" }),
  ];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Test",
      totalAmount: 100000,
    },
    DEFAULT_CLUB.id
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /khóa/i);
});

test("saveBooking rejects maintenance court", () => {
  const data = getDefaultClubData(DEFAULT_CLUB.id);
  data.courts = [
    normalizeCourt({ id: 1, name: "Sân 1", active: false, status: "maintenance" }),
  ];
  saveClubData(DEFAULT_CLUB.id, data);

  const result = createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Test",
      totalAmount: 100000,
    },
    DEFAULT_CLUB.id
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /bảo trì/i);
});

test("loadClubData initializes empty bookings and customers", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  assert.ok(Array.isArray(data.bookings));
  assert.ok(Array.isArray(data.customers));
  assert.ok(Array.isArray(data.recurringSeries));
  assert.equal(data.bookings.length, 0);
});

test("extendBookingTime adds duration and updates total", async () => {
  const { extendBookingTime } = await import("../src/domain/bookingService.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
      defaultHourlyRate: 200000,
    },
    DEFAULT_CLUB.id
  );

  const bookings = loadBookingsForClub(DEFAULT_CLUB.id);
  const result = extendBookingTime(bookings[0].id, 60, DEFAULT_CLUB.id);

  assert.equal(result.ok, true);
  assert.equal(result.booking.endTime, "21:00");
});

test("transferBookingCourt moves booking to another court", async () => {
  const { transferBookingCourt } = await import("../src/domain/bookingService.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  const bookings = loadBookingsForClub(DEFAULT_CLUB.id);
  const result = transferBookingCourt(bookings[0].id, 2, DEFAULT_CLUB.id);

  assert.equal(result.ok, true);
  assert.equal(result.booking.courtId, 2);
});

test("expandRecurringSeriesToBookings creates weekly bookings", async () => {
  const { expandRecurringSeriesToBookings, createRecurringBookingSeries } = await import(
    "../src/domain/recurringBookingService.js"
  );

  const series = createRecurringBookingSeries({
    id: "rec-1",
    customerName: "Anh Nam",
    courtId: 1,
    weekday: 1,
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    startTime: "18:00",
    endTime: "20:00",
    totalAmount: 400000,
  });

  const bookings = expandRecurringSeriesToBookings(series);

  assert.ok(bookings.length >= 4);
  assert.equal(bookings[0].bookingType, "recurring");
  assert.equal(bookings[0].recurringSeriesId, "rec-1");
});

test("calculateBookingAmount applies peak hour rules by time segment", async () => {
  const { calculateBookingAmount } = await import("../src/domain/courtBookingEngine.js");

  const court = {
    defaultHourlyRate: 200000,
    peakHourlyRate: 300000,
  };

  const peakHourRules = { enabled: true, startHour: 17, endHour: 22, weekdays: [0, 1, 2, 3, 4, 5, 6] };

  const offPeakAmount = calculateBookingAmount(court, "15:00", "17:00", {
    peakHourRules,
    date: "2026-06-28",
  });
  const mixedAmount = calculateBookingAmount(court, "16:00", "18:00", {
    peakHourRules,
    date: "2026-06-28",
  });

  assert.equal(offPeakAmount, 400000);
  assert.equal(mixedAmount, 500000);
});

test("computeRangeRevenue aggregates multiple days", async () => {
  const { computeRangeRevenue } = await import("../src/domain/courtBookingEngine.js");

  const first = createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
      paidAmount: 200000,
    },
    DEFAULT_CLUB.id
  );

  const second = createBooking(
    {
      courtId: 1,
      date: "2026-06-29",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Chi Lan",
      totalAmount: 300000,
      paidAmount: 300000,
    },
    DEFAULT_CLUB.id
  );

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const bookings = loadBookingsForClub(DEFAULT_CLUB.id);
  const summary = computeRangeRevenue(bookings, "2026-06-28", "2026-06-29");

  assert.equal(summary.expectedRevenue, 700000);
  assert.equal(summary.collected, 500000);
  assert.equal(summary.totalBookings, 2);
  assert.equal(summary.dailyBreakdown.length, 2);
});

test("customer CRUD create update delete", async () => {
  const {
    createCustomer,
    updateCustomer,
    deleteCustomer,
    findCustomerById,
  } = await import("../src/domain/customerService.js");
  const { loadCustomersForClub } = await import("../src/domain/clubStorage.js");

  const created = createCustomer(
    { name: "Khách V4", phone: "0901111111", customerType: "member", note: "VIP" },
    DEFAULT_CLUB.id
  );

  assert.equal(created.ok, true);
  assert.equal(created.customer.name, "Khách V4");

  const updated = updateCustomer(
    created.customer.id,
    { name: "Khách V4 Plus", note: "VIP gold" },
    DEFAULT_CLUB.id
  );

  assert.equal(updated.ok, true);
  assert.equal(updated.customer.name, "Khách V4 Plus");

  const deleted = deleteCustomer(created.customer.id, DEFAULT_CLUB.id);
  assert.equal(deleted.ok, true);
  assert.equal(findCustomerById(created.customer.id, DEFAULT_CLUB.id), null);
  assert.equal(loadCustomersForClub(DEFAULT_CLUB.id).length, 0);
});

test("normalizeCourtManagementSettings includes V4 fields", async () => {
  const { normalizeCourtManagementSettings } = await import(
    "../src/domain/courtManagementSettings.js"
  );

  const settings = normalizeCourtManagementSettings({
    openHour: 6,
    peakHourRules: { enabled: true, startHour: 18, endHour: 23 },
    notificationSettings: { enabled: true, minutesBefore: 45 },
  });

  assert.equal(settings.peakHourRules.enabled, true);
  assert.equal(settings.peakHourRules.startHour, 18);
  assert.equal(settings.notificationSettings.minutesBefore, 45);
});

test("validateClubPayloadForSync normalizes malformed court management data", async () => {
  const { validateClubPayloadForSync, CLUB_SCHEMA_VERSION } = await import(
    "../src/domain/clubStorage.js"
  );

  const result = validateClubPayloadForSync(
    {
      bookings: "invalid",
      customers: null,
      courtManagement: "bad",
    },
    DEFAULT_CLUB.id
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.schemaVersion, CLUB_SCHEMA_VERSION);
  assert.ok(Array.isArray(result.data.bookings));
  assert.ok(Array.isArray(result.data.customers));
  assert.equal(typeof result.data.courtManagement.openHour, "number");
  assert.ok(result.warnings.length >= 1);
});

test("getUpcomingReminders finds bookings starting soon", async () => {
  const { getUpcomingReminders } = await import("../src/domain/bookingReminderService.js");
  const { saveCourtManagementSettings } = await import(
    "../src/domain/courtManagementSettings.js"
  );

  saveCourtManagementSettings(DEFAULT_CLUB.id, {
    notificationSettings: { enabled: true, minutesBefore: 60 },
  });

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:30",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  const now = new Date("2026-06-28T18:00:00");
  const reminders = getUpcomingReminders(DEFAULT_CLUB.id, now);

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].customerName, "Anh Nam");
});

test("computeDebtSummary lists bookings with remaining balance", async () => {
  const { computeDebtSummary } = await import("../src/domain/courtBookingEngine.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
      paidAmount: 100000,
    },
    DEFAULT_CLUB.id
  );

  const bookings = loadBookingsForClub(DEFAULT_CLUB.id);
  const summary = computeDebtSummary(bookings);

  assert.equal(summary.bookingCount, 1);
  assert.equal(summary.totalDebt, 300000);
});

test("mergeCustomersByPhone merges duplicate phone records", async () => {
  const { mergeCustomersByPhone } = await import("../src/domain/customerService.js");
  const { loadCustomersForClub, saveCustomersForClub } = await import(
    "../src/domain/clubStorage.js"
  );
  const { normalizeCustomer } = await import("../src/models/customer.js");

  saveCustomersForClub(
    [
      normalizeCustomer({ id: "c1", name: "A", phone: "0909000001" }),
      normalizeCustomer({ id: "c2", name: "B", phone: "0909000001" }),
    ],
    DEFAULT_CLUB.id
  );

  const result = mergeCustomersByPhone(DEFAULT_CLUB.id);

  assert.equal(result.ok, true);
  assert.equal(result.mergedCount, 1);
  assert.equal(loadCustomersForClub(DEFAULT_CLUB.id).length, 1);
});

test("getTodayUpcomingBookings returns future bookings today", async () => {
  const { getTodayUpcomingBookings } = await import("../src/domain/courtBookingEngine.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "20:00",
      endTime: "22:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  const bookings = loadBookingsForClub(DEFAULT_CLUB.id);
  const now = new Date("2026-06-28T18:00:00");
  const upcoming = getTodayUpcomingBookings(bookings, "2026-06-28", now);

  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].startTime, "20:00");
});

test("duplicateBooking creates copy one week later", async () => {
  const { duplicateBooking } = await import("../src/domain/bookingService.js");

  const created = createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      customerPhone: "0901234567",
      totalAmount: 400000,
      paidAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  assert.equal(created.ok, true);

  const result = duplicateBooking(created.booking.id, DEFAULT_CLUB.id);
  assert.equal(result.ok, true);
  assert.equal(result.booking.date, "2026-07-05");
  assert.equal(result.booking.paidAmount, 0);
  assert.notEqual(result.booking.id, created.booking.id);
});

test("computeCourtUtilization measures booked minutes", async () => {
  const { computeCourtUtilization } = await import("../src/domain/courtBookingEngine.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  const data = loadClubData(DEFAULT_CLUB.id);
  const summary = computeCourtUtilization(
    loadBookingsForClub(DEFAULT_CLUB.id),
    data.courts,
    "2026-06-28",
    "2026-06-28",
    0,
    24
  );

  assert.equal(summary.bookedMinutes, 120);
  assert.ok(summary.utilizationPercent > 0);
  assert.equal(summary.byCourt[0].bookingCount, 1);
});

test("getWeekDates returns seven dates starting Monday", async () => {
  const { getWeekDates } = await import("../src/domain/courtBookingEngine.js");

  const dates = getWeekDates("2026-06-28");

  assert.equal(dates.length, 7);
  assert.equal(dates[0], "2026-06-22");
  assert.equal(dates[6], "2026-06-28");
});

test("findAvailableSlots returns free court windows", async () => {
  const { findAvailableSlots } = await import("../src/domain/courtBookingEngine.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  const data = loadClubData(DEFAULT_CLUB.id);
  const slots = findAvailableSlots({
    bookings: loadBookingsForClub(DEFAULT_CLUB.id),
    courts: data.courts,
    date: "2026-06-28",
    durationMinutes: 60,
    openHour: 0,
    closeHour: 24,
    slotMinutes: 60,
  });

  assert.ok(slots.length > 0);
  assert.ok(slots.some((slot) => slot.courtId === 2));
  assert.ok(!slots.some((slot) => slot.courtId === 1 && slot.startTime === "18:00"));
});

test("autoCompletePastBookings marks overdue bookings completed", async () => {
  const { autoCompletePastBookings } = await import("../src/domain/bookingService.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-27",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
      bookingStatus: "playing",
    },
    DEFAULT_CLUB.id
  );

  const now = new Date("2026-06-28T10:00:00");
  const result = autoCompletePastBookings(DEFAULT_CLUB.id, now);

  assert.equal(result.ok, true);
  assert.equal(result.updatedCount, 1);

  const bookings = loadBookingsForClub(DEFAULT_CLUB.id);
  assert.equal(bookings[0].bookingStatus, "completed");
});

test("buildBookingReceiptHtml includes booking code", async () => {
  const { buildBookingReceiptHtml } = await import("../src/domain/bookingReceipt.js");

  const html = buildBookingReceiptHtml({
    bookingCode: "BK202606280001",
    customerName: "Anh Nam",
    courtName: "Sân 1",
    date: "2026-06-28",
    startTime: "18:00",
    endTime: "20:00",
    totalAmount: 400000,
    paidAmount: 200000,
  });

  assert.match(html, /BK202606280001/);
  assert.match(html, /Anh Nam/);
});

test("summarizeTodayOperations aggregates daily and debt stats", async () => {
  const { summarizeTodayOperations } = await import("../src/domain/courtBookingEngine.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "20:00",
      endTime: "22:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
      paidAmount: 100000,
    },
    DEFAULT_CLUB.id
  );

  const bookings = loadBookingsForClub(DEFAULT_CLUB.id);
  const now = new Date("2026-06-28T18:00:00");
  const summary = summarizeTodayOperations(bookings, "2026-06-28", now);

  assert.equal(summary.totalBookings, 1);
  assert.equal(summary.upcomingCount, 1);
  assert.equal(summary.totalDebt, 300000);
});

test("normalizeCourtManagementSettings includes automation settings", async () => {
  const { normalizeCourtManagementSettings } = await import(
    "../src/domain/courtManagementSettings.js"
  );

  const settings = normalizeCourtManagementSettings({
    automationSettings: { autoCompleteOnOpen: true },
  });

  assert.equal(settings.automationSettings.autoCompleteOnOpen, true);
  assert.equal(settings.automationSettings.autoStartPlaying, false);
});

test("buildCourtManagementExport includes bookings and customers", async () => {
  const { buildCourtManagementExport } = await import("../src/domain/courtManagementExport.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  const payload = buildCourtManagementExport(DEFAULT_CLUB.id);

  assert.equal(payload.clubId, DEFAULT_CLUB.id);
  assert.ok(Array.isArray(payload.bookings));
  assert.ok(payload.bookings.length >= 1);
  assert.ok(Array.isArray(payload.customers));
});

test("buildBookingShareText formats booking summary", async () => {
  const { buildBookingShareText } = await import("../src/domain/bookingReceipt.js");

  const text = buildBookingShareText({
    bookingCode: "BK001",
    customerName: "Anh Nam",
    customerPhone: "0901234567",
    courtName: "Sân 1",
    date: "2026-06-28",
    startTime: "18:00",
    endTime: "20:00",
    totalAmount: 400000,
    paidAmount: 200000,
  });

  assert.match(text, /BK001/);
  assert.match(text, /Anh Nam/);
  assert.match(text, /0901234567/);
});

test("importCourtManagementExport restores bookings", async () => {
  const {
    buildCourtManagementExport,
    importCourtManagementExport,
  } = await import("../src/domain/courtManagementExport.js");
  const { loadBookingsForClub } = await import("../src/domain/clubStorage.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  const payload = buildCourtManagementExport(DEFAULT_CLUB.id);
  importCourtManagementExport(DEFAULT_CLUB.id, payload, { mode: "replace" });

  assert.ok(loadBookingsForClub(DEFAULT_CLUB.id).length >= 1);
});

test("autoStartDueBookings marks in-window bookings as playing", async () => {
  const { autoStartDueBookings } = await import("../src/domain/bookingService.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
      bookingStatus: "confirmed",
    },
    DEFAULT_CLUB.id
  );

  const now = new Date("2026-06-28T18:30:00");
  const result = autoStartDueBookings(DEFAULT_CLUB.id, now);

  assert.equal(result.updatedCount, 1);
  assert.equal(loadBookingsForClub(DEFAULT_CLUB.id)[0].bookingStatus, "playing");
});

test("buildWhatsAppShareUrl includes phone when available", async () => {
  const { buildWhatsAppShareUrl } = await import("../src/domain/bookingReceipt.js");

  const url = buildWhatsAppShareUrl({
    bookingCode: "BK001",
    customerName: "Anh Nam",
    customerPhone: "0901234567",
    courtName: "Sân 1",
    date: "2026-06-28",
    startTime: "18:00",
    endTime: "20:00",
    totalAmount: 400000,
    paidAmount: 0,
  });

  assert.match(url, /wa\.me\/84901234567/);
});

test("getMonthCalendarDates returns 42 cells for calendar grid", async () => {
  const { getMonthCalendarDates } = await import("../src/domain/courtBookingEngine.js");

  const cells = getMonthCalendarDates("2026-06-15");

  assert.equal(cells.length, 42);
  assert.equal(cells.filter((cell) => cell.inMonth).length, 30);
  assert.equal(cells[0].date, "2026-06-01");
});

test("summarizeCourtManagementImport previews counts", async () => {
  const {
    buildCourtManagementExport,
    summarizeCourtManagementImport,
  } = await import("../src/domain/courtManagementExport.js");

  createBooking(
    {
      courtId: 1,
      date: "2026-06-28",
      startTime: "18:00",
      endTime: "20:00",
      customerName: "Anh Nam",
      totalAmount: 400000,
    },
    DEFAULT_CLUB.id
  );

  const payload = buildCourtManagementExport(DEFAULT_CLUB.id);
  const preview = summarizeCourtManagementImport(DEFAULT_CLUB.id, payload);

  assert.equal(preview.ok, true);
  assert.ok(preview.summary.importBookings >= 1);
});

test("buildDayGridBlocks spans multi-hour bookings and skips covered slots", async () => {
  const { buildDayGridBlocks, buildHourSlots } = await import("../src/domain/courtBookingEngine.js");

  const courts = [{ id: "c1", name: "Sân 1", status: "active", active: true }];
  const hourSlots = buildHourSlots(8, 12, 60);
  const date = "2026-07-07";
  const bookings = [
    {
      id: "b1",
      courtId: "c1",
      date,
      startTime: "08:00",
      endTime: "10:00",
      bookingStatus: "confirmed",
    },
  ];

  const blocks = buildDayGridBlocks(bookings, courts, date, hourSlots, 60);
  const start = blocks.get("c1::08:00");
  const covered = blocks.get("c1::09:00");
  const empty = blocks.get("c1::10:00");

  assert.equal(start?.type, "booking");
  assert.equal(start?.rowSpan, 2);
  assert.equal(covered?.type, "skip");
  assert.equal(empty?.type, "empty");
});
