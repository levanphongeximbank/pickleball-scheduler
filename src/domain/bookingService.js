import {
  loadBookingsForClub,
  loadCourtsForClub,
  loadRecurringSeriesForClub,
  saveBookingsForClub,
  saveCourtsForClub,
  saveRecurringSeriesForClub,
} from "./clubStorage.js";
import { PERMISSIONS } from "../auth/permissions.js";
import {
  guardBookingPayment,
  guardBookingSave,
  guardClubAction,
} from "../auth/guardAction.js";
import {
  checkBookingConflict,
  calculateDuration,
  enrichBookingWithCourt,
  validateCourtForBooking,
  validateBookingAmounts,
  timeToMinutes,
  minutesToTime,
  calculateBookingAmount,
} from "./courtBookingEngine.js";
import {
  addDaysToCivilDate,
  absoluteToCivilDate,
  absoluteToCivilMinutes,
  resolveVenueTimezoneForClub,
  CIVIL_TIME_ERROR,
} from "./civilTime.js";
import {
  createBookingRecord,
  derivePaymentStatus,
  normalizeBooking,
  normalizeBookings,
} from "../models/booking.js";
import { normalizeCourts } from "../models/court.js";
import { upsertCustomerFromBooking } from "./customerService.js";
import { loadCourtManagementSettings } from "./courtManagementSettings.js";
import {
  createRecurringBookingSeries,
  expandRecurringSeriesToBookings,
} from "./recurringBookingService.js";
import { getCourtDisplayName } from "../models/court.js";
import { resolveTenantIdForClub } from "../features/tenant/guards/tenantGuard.js";
import { emitBookingLifecycleNotification } from "../features/notifications/adapters/bookingNotificationPilot.js";
import { NOTIFICATION_EVENT_TYPES } from "../features/notifications/constants/notificationEvents.js";

export function loadCourtManagementData(clubId) {
  return {
    courts: loadCourtsForClub(clubId),
    bookings: loadBookingsForClub(clubId),
  };
}

export function saveBooking(booking, clubId, { excludeId = null } = {}) {
  const bookings = loadBookingsForClub(clubId);
  const isNew = !bookings.some((item) => item.id === booking.id);
  const access = guardBookingSave(clubId, { isNew });
  if (!access.ok) {
    return { ok: false, message: access.error };
  }

  const courts = loadCourtsForClub(clubId);
  const court = courts.find((item) => item.id === booking.courtId);

  const skipCourtCheck =
    booking.bookingType === "tournament" || booking.bookingType === "maintenance";

  if (!skipCourtCheck) {
    const courtCheck = validateCourtForBooking(court);
    if (!courtCheck.ok) {
      return { ok: false, message: courtCheck.message };
    }
  } else if (!court) {
    return { ok: false, message: "Không tìm thấy sân." };
  }

  const amountCheck = validateBookingAmounts(booking);
  if (!amountCheck.ok) {
    return { ok: false, message: amountCheck.message };
  }

  const enriched = enrichBookingWithCourt(
    {
      ...booking,
      durationMinutes: calculateDuration(booking.startTime, booking.endTime),
      paymentStatus: derivePaymentStatus(
        booking.totalAmount,
        booking.paidAmount,
        booking.depositAmount
      ),
      updatedAt: new Date().toISOString(),
    },
    courts
  );

  const conflict = checkBookingConflict(bookings, enriched, excludeId);
  if (conflict) {
    return { ok: false, message: conflict.message, conflict };
  }

  const existingIndex = bookings.findIndex((item) => item.id === enriched.id);
  let nextBookings;

  if (existingIndex >= 0) {
    nextBookings = bookings.map((item, index) =>
      index === existingIndex ? enriched : item
    );
  } else {
    nextBookings = [...bookings, enriched];
  }

  saveBookingsForClub(nextBookings, clubId);
  upsertCustomerFromBooking(enriched, clubId, { isNew: existingIndex < 0 });

  // Phase 1.2/1.3 pilot — booking lifecycle event (not start reminder).
  if (existingIndex < 0) {
    const tenantId = resolveTenantIdForClub(clubId);
    if (tenantId) {
      void emitBookingLifecycleNotification(NOTIFICATION_EVENT_TYPES.BOOKING_CREATED, {
        tenantId,
        clubId,
        booking: enriched,
        version: enriched.createdAt || enriched.id,
      }).catch(() => {});
    }
  }

  return { ok: true, booking: enriched, bookings: nextBookings };
}

export function createBooking(input, clubId) {
  const record = createBookingRecord(input);
  return saveBooking(record, clubId);
}

export function updateBookingStatus(bookingId, nextStatus, clubId) {
  const check = guardClubAction(clubId, PERMISSIONS.BOOKING_UPDATE);
  if (!check.ok) {
    return { ok: false, message: check.error };
  }

  const bookings = loadBookingsForClub(clubId);
  const booking = bookings.find((item) => item.id === bookingId);

  if (!booking) {
    return { ok: false, message: "Không tìm thấy booking." };
  }

  const result = saveBooking(
    {
      ...booking,
      bookingStatus: nextStatus,
    },
    clubId,
    { excludeId: bookingId }
  );

  // Phase 1.2/1.3 pilot — cancellation event (browser start reminder remains separate).
  if (
    result.ok &&
    nextStatus === "cancelled" &&
    booking.bookingStatus !== "cancelled"
  ) {
    const tenantId = resolveTenantIdForClub(clubId);
    if (tenantId) {
      void emitBookingLifecycleNotification(NOTIFICATION_EVENT_TYPES.BOOKING_CANCELLED, {
        tenantId,
        clubId,
        booking: result.booking,
        version: result.booking?.updatedAt || `cancelled:${bookingId}`,
      }).catch(() => {});
    }
  }

  return result;
}

export function updateBookingPayment(bookingId, paymentUpdate, clubId) {
  const check = guardBookingPayment(clubId);
  if (!check.ok) {
    return { ok: false, message: check.error };
  }

  const bookings = loadBookingsForClub(clubId);
  const booking = bookings.find((item) => item.id === bookingId);

  if (!booking) {
    return { ok: false, message: "Không tìm thấy booking." };
  }

  const totalAmount =
    paymentUpdate.totalAmount !== undefined
      ? paymentUpdate.totalAmount
      : booking.totalAmount;
  const depositAmount =
    paymentUpdate.depositAmount !== undefined
      ? paymentUpdate.depositAmount
      : booking.depositAmount;
  const paidAmount =
    paymentUpdate.paidAmount !== undefined
      ? paymentUpdate.paidAmount
      : booking.paidAmount;

  return saveBooking(
    {
      ...booking,
      totalAmount,
      depositAmount,
      paidAmount,
      paymentStatus: derivePaymentStatus(totalAmount, paidAmount, depositAmount),
    },
    clubId,
    { excludeId: bookingId }
  );
}

export function deleteBooking(bookingId, clubId) {
  const check = guardClubAction(clubId, PERMISSIONS.BOOKING_UPDATE);
  if (!check.ok) {
    return { ok: false, message: check.error };
  }

  const bookings = loadBookingsForClub(clubId);
  const nextBookings = bookings.filter((item) => item.id !== bookingId);
  saveBookingsForClub(nextBookings, clubId);
  return { ok: true, bookings: nextBookings };
}

export function setCourtOperationalStatus(courtId, status, clubId) {
  const check = guardClubAction(clubId, PERMISSIONS.COURT_UPDATE);
  if (!check.ok) {
    return { ok: false, message: check.error };
  }

  const courts = normalizeCourts(loadCourtsForClub(clubId));
  const nextCourts = courts.map((court) =>
    court.id === courtId
      ? {
          ...court,
          status,
          active: status === "active",
        }
      : court
  );

  saveCourtsForClub(nextCourts, clubId);
  return { ok: true, courts: nextCourts };
}

export function getBookingById(bookingId, clubId) {
  return loadBookingsForClub(clubId).find((item) => item.id === bookingId) || null;
}

export function listBookingsForDate(date, clubId) {
  return loadBookingsForClub(clubId).filter((booking) => booking.date === date);
}

export function createRecurringSeriesBookings(seriesInput, clubId) {
  const courts = loadCourtsForClub(clubId);
  const court = courts.find((item) => item.id === seriesInput.courtId);

  if (!court) {
    return { ok: false, message: "Không tìm thấy sân." };
  }

  const courtCheck = validateCourtForBooking(court);
  if (!courtCheck.ok) {
    return { ok: false, message: courtCheck.message };
  }

  const series = createRecurringBookingSeries(seriesInput);
  const candidates = expandRecurringSeriesToBookings(series, {
    courtName: getCourtDisplayName(court),
  });

  if (candidates.length === 0) {
    return { ok: false, message: "Không có ngày nào trong khoảng thời gian đã chọn." };
  }

  const created = [];
  const skipped = [];

  candidates.forEach((candidate) => {
    const result = saveBooking(candidate, clubId);

    if (result.ok) {
      created.push(result.booking);
      return;
    }

    skipped.push({
      date: candidate.date,
      message: result.message,
    });
  });

  if (created.length === 0) {
    return {
      ok: false,
      message: skipped[0]?.message || "Không tạo được booking lặp tuần.",
      created,
      skipped,
    };
  }

  saveRecurringSeriesForClub(
    [...loadRecurringSeriesForClub(clubId), series],
    clubId
  );

  return {
    ok: true,
    series,
    created,
    skipped,
    message: `Đã tạo ${created.length}/${candidates.length} booking lặp tuần.`,
  };
}

export function extendBookingTime(bookingId, extraMinutes, clubId) {
  const booking = getBookingById(bookingId, clubId);

  if (!booking) {
    return { ok: false, message: "Không tìm thấy booking." };
  }

  const extra = Number(extraMinutes) || 0;
  if (extra <= 0) {
    return { ok: false, message: "Số phút gia hạn không hợp lệ." };
  }

  const courts = loadCourtsForClub(clubId);
  const court = courts.find((item) => item.id === booking.courtId);
  const settings = loadCourtManagementSettings(clubId);
  const newEndTime = minutesToTime(timeToMinutes(booking.endTime) + extra);
  const extraAmount = court
    ? calculateBookingAmount(court, booking.endTime, newEndTime, {
        peakHourRules: settings.peakHourRules,
        date: booking.date,
      })
    : 0;

  return saveBooking(
    {
      ...booking,
      endTime: newEndTime,
      totalAmount: (Number(booking.totalAmount) || 0) + extraAmount,
    },
    clubId,
    { excludeId: bookingId }
  );
}

export function transferBookingCourt(bookingId, newCourtId, clubId) {
  const booking = getBookingById(bookingId, clubId);

  if (!booking) {
    return { ok: false, message: "Không tìm thấy booking." };
  }

  if (!newCourtId || newCourtId === booking.courtId) {
    return { ok: false, message: "Chọn sân khác để chuyển." };
  }

  return saveBooking(
    {
      ...booking,
      courtId: newCourtId,
    },
    clubId,
    { excludeId: bookingId }
  );
}

export function createMaintenanceBooking(input, clubId) {
  return createBooking({
    bookingType: "maintenance",
    customerName: "Bảo trì sân",
    customerType: "event",
    bookingStatus: "confirmed",
    totalAmount: 0,
    depositAmount: 0,
    paidAmount: 0,
    note: input.note || "Bảo trì sân",
    ...input,
  }, clubId);
}

export function autoCompletePastBookings(clubId, now = new Date(), options = {}) {
  const tz = resolveVenueTimezoneForClub(clubId, options);
  if (!tz.ok) {
    return {
      ok: false,
      code: tz.code || CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      updatedCount: 0,
      message: tz.error || "Thiếu venue.timezone — không thể auto-complete.",
    };
  }

  const bookings = loadBookingsForClub(clubId);
  const today = absoluteToCivilDate(now, tz.timezone);
  const nowMinutes = absoluteToCivilMinutes(now, tz.timezone);
  const autoStatuses = new Set(["confirmed", "checked_in", "playing"]);
  let updatedCount = 0;
  const timestamp = now.toISOString();

  const nextBookings = bookings.map((booking) => {
    if (!autoStatuses.has(booking.bookingStatus)) {
      return booking;
    }

    const isPastDay = booking.date < today;
    const isPastToday =
      booking.date === today && timeToMinutes(booking.endTime) <= nowMinutes;

    if (!isPastDay && !isPastToday) {
      return booking;
    }

    updatedCount += 1;

    return {
      ...booking,
      bookingStatus: "completed",
      updatedAt: timestamp,
    };
  });

  if (updatedCount > 0) {
    saveBookingsForClub(nextBookings, clubId);
  }

  return {
    ok: true,
    updatedCount,
    message:
      updatedCount > 0
        ? `Đã chuyển ${updatedCount} booking quá giờ sang Hoàn thành.`
        : "Không có booking quá giờ cần cập nhật.",
  };
}

export function autoStartDueBookings(clubId, now = new Date(), options = {}) {
  const tz = resolveVenueTimezoneForClub(clubId, options);
  if (!tz.ok) {
    return {
      ok: false,
      code: tz.code || CIVIL_TIME_ERROR.TIMEZONE_REQUIRED,
      updatedCount: 0,
      message: tz.error || "Thiếu venue.timezone — không thể auto-start.",
    };
  }

  const bookings = loadBookingsForClub(clubId);
  const today = absoluteToCivilDate(now, tz.timezone);
  const nowMinutes = absoluteToCivilMinutes(now, tz.timezone);
  const startStatuses = new Set(["confirmed", "checked_in"]);
  let updatedCount = 0;
  const timestamp = now.toISOString();

  const nextBookings = bookings.map((booking) => {
    if (!startStatuses.has(booking.bookingStatus)) {
      return booking;
    }

    if (booking.date !== today) {
      return booking;
    }

    const startMinutes = timeToMinutes(booking.startTime);
    const endMinutes = timeToMinutes(booking.endTime);

    if (nowMinutes < startMinutes || nowMinutes >= endMinutes) {
      return booking;
    }

    updatedCount += 1;

    return {
      ...booking,
      bookingStatus: "playing",
      updatedAt: timestamp,
    };
  });

  if (updatedCount > 0) {
    saveBookingsForClub(nextBookings, clubId);
  }

  return {
    ok: true,
    updatedCount,
    message:
      updatedCount > 0
        ? `Đã chuyển ${updatedCount} booking sang Đang chơi.`
        : "Không có booking nào cần chuyển sang Đang chơi.",
  };
}

export function duplicateBooking(bookingId, clubId, overrides = {}) {
  const booking = getBookingById(bookingId, clubId);

  if (!booking) {
    return { ok: false, message: "Không tìm thấy booking." };
  }

  if (["tournament", "maintenance"].includes(booking.bookingType)) {
    return { ok: false, message: "Không thể nhân bản loại booking này." };
  }

  const duplicateOmitKeys = new Set([
    "id",
    "bookingCode",
    "reminderSentAt",
    "createdAt",
    "updatedAt",
    "recurringSeriesId",
    "tournamentId",
  ]);
  const rest = Object.fromEntries(
    Object.entries(booking).filter(([key]) => !duplicateOmitKeys.has(key))
  );

  const nextDate =
    overrides.date ||
    (() => {
      try {
        return addDaysToCivilDate(booking.date, 7);
      } catch {
        return booking.date;
      }
    })();

  return createBooking(
    {
      ...rest,
      ...overrides,
      date: nextDate,
      courtId: overrides.courtId || booking.courtId,
      bookingType: booking.bookingType === "recurring" ? "single" : booking.bookingType,
      bookingStatus: "confirmed",
      paidAmount: 0,
      depositAmount: 0,
      note: booking.note ? `${booking.note} (nhân bản)` : "Nhân bản booking",
    },
    clubId
  );
}

export { normalizeBookings, normalizeBooking };
