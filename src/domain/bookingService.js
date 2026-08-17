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
  isActiveBookingStatus,
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
import { isCanonicalReservationCutover } from "../features/court-resource/constants/canonicalReservation.js";
import { isCanonicalBookingLifecycle } from "../features/court-resource/constants/canonicalBooking.js";
import { COURT_RESOURCE_CODE } from "../features/court-resource/constants/courtResourceContract.js";

let canonicalBookingGateway = {
  reserveCourts: null,
  releaseCourts: null,
};

/** @internal Gateway bind — breaks ESM init cycle. */
export function __bindCanonicalBookingGateway(next = {}) {
  canonicalBookingGateway = {
    reserveCourts: next.reserveCourts || null,
    releaseCourts: next.releaseCourts || null,
  };
}

/** @internal */
export function __resetCanonicalBookingGatewayForTests() {
  canonicalBookingGateway = { reserveCourts: null, releaseCourts: null };
}

async function settle(value) {
  return value && typeof value.then === "function" ? await value : value;
}

function compensationRequestId(bookingId) {
  return `booking-compensate:${bookingId}`;
}

function releaseCapacityRequestId(bookingId, reason = "release") {
  return `booking-release:${reason}:${bookingId}`;
}

function rescheduleReserveRequestId(booking) {
  return [
    "booking-reschedule",
    booking.id,
    booking.courtId,
    booking.date,
    booking.startTime,
    booking.endTime,
  ].join(":");
}

function capacityFingerprint(booking) {
  return [
    String(booking?.courtId || ""),
    String(booking?.date || ""),
    String(booking?.startTime || ""),
    String(booking?.endTime || ""),
  ].join("|");
}

function buildCanonicalReserveOptions(record, clubId, requestId) {
  const tenantId = resolveTenantIdForClub(clubId);
  return {
    clubId,
    tenantId,
    courtId: record.courtId,
    physicalCourtId: record.physicalCourtId,
    physicalCourtIds: record.physicalCourtId ? [record.physicalCourtId] : undefined,
    owner: {
      type: "booking",
      id: record.id,
      subType: record.bookingType === "recurring" ? "recurring" : "customer",
    },
    date: record.date,
    startTime: record.startTime,
    endTime: record.endTime,
    requestId,
    label: record.customerName,
    clusterId: record.clusterId,
    sourceSystem: record.sourceSystem,
    sourceVersion: record.sourceVersion,
    legacyClusterId: record.legacyClusterId || record.clusterId,
    legacyMappings: record.legacyMappings,
  };
}

async function releaseBookingCanonicalCapacity(booking, clubId, requestId, releaseReason) {
  const release = canonicalBookingGateway.releaseCourts;
  if (typeof release !== "function") {
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      message: "Canonical reservation cutover is enabled but no release adapter is bound.",
    };
  }
  const tenantId = resolveTenantIdForClub(clubId);
  return settle(
    release({
      clubId,
      tenantId,
      courtId: booking.courtId,
      physicalCourtId: booking.physicalCourtId,
      physicalCourtIds: booking.physicalCourtId ? [booking.physicalCourtId] : undefined,
      reservationIds: booking.reservationId ? [booking.reservationId] : null,
      owner: {
        type: "booking",
        id: booking.id,
        subType: booking.bookingType === "recurring" ? "recurring" : "customer",
      },
      requestId,
      releaseReason,
      clusterId: booking.clusterId,
      sourceSystem: booking.sourceSystem,
      sourceVersion: booking.sourceVersion,
      legacyClusterId: booking.legacyClusterId || booking.clusterId,
      legacyMappings: booking.legacyMappings,
    })
  );
}

function reconciliationFailure(message, extra = {}) {
  return {
    ok: false,
    code: COURT_RESOURCE_CODE.CANONICAL_RECONCILIATION_REQUIRED,
    message,
    reconciliationRequired: true,
    ...extra,
  };
}

export function loadCourtManagementData(clubId) {
  return {
    courts: loadCourtsForClub(clubId),
    bookings: loadBookingsForClub(clubId),
  };
}

export function saveBooking(booking, clubId, { excludeId = null, skipConflictCheck = false } = {}) {
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
  if (conflict && !skipConflictCheck) {
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

export async function createBooking(input, clubId) {
  const record = createBookingRecord(input);
  if (isCanonicalReservationCutover()) {
    return createBookingViaCanonical(record, clubId);
  }
  return saveBooking(record, clubId);
}

async function createBookingViaCanonical(record, clubId) {
  const reserve = canonicalBookingGateway.reserveCourts;
  if (typeof reserve !== "function") {
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      message: "Canonical reservation cutover is enabled but no reserve adapter is bound.",
    };
  }
  const result = await settle(
    reserve(buildCanonicalReserveOptions(record, clubId, record.id))
  );
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      message: result?.error || result?.message || "Canonical reserve failed.",
      conflict: result,
    };
  }
  const reservationId = result.reservationIds?.[0]
    || result.reserved?.[0]?.reservationId
    || null;
  const physicalCourtId = result.physicalCourtIds?.[0]
    || record.physicalCourtId
    || null;
  let saved;
  try {
    saved = saveBooking(
      { ...record, reservationId, physicalCourtId },
      clubId,
      { skipConflictCheck: true }
    );
  } catch (error) {
    saved = {
      ok: false,
      message: error?.message || "Booking projection save failed.",
    };
  }
  if (saved?.ok) {
    return saved;
  }
  const compensated = await releaseBookingCanonicalCapacity(
    { ...record, reservationId, physicalCourtId },
    clubId,
    compensationRequestId(record.id),
    "projection_save_failed"
  );
  if (!compensated?.ok) {
    return reconciliationFailure(
      "Canonical reserve succeeded but booking projection save failed, and compensation release also failed.",
      {
        reservationId,
        physicalCourtId,
        saveError: saved?.message || "Booking projection save failed.",
        compensation: compensated,
      }
    );
  }
  return {
    ok: false,
    code: saved?.code || COURT_RESOURCE_CODE.PARTIAL_FAILURE,
    message: saved?.message || "Booking projection save failed after canonical reserve; reservation was compensated.",
    compensated: true,
    reservationId,
  };
}

export async function updateBookingStatus(bookingId, nextStatus, clubId) {
  const check = guardClubAction(clubId, PERMISSIONS.BOOKING_UPDATE);
  if (!check.ok) {
    return { ok: false, message: check.error };
  }

  const bookings = loadBookingsForClub(clubId);
  const booking = bookings.find((item) => item.id === bookingId);

  if (!booking) {
    return { ok: false, message: "Không tìm thấy booking." };
  }

  const becomingCancelled =
    nextStatus === "cancelled" && booking.bookingStatus !== "cancelled";

  const result = saveBooking(
    {
      ...booking,
      bookingStatus: nextStatus,
    },
    clubId,
    {
      excludeId: bookingId,
      skipConflictCheck: isCanonicalReservationCutover() && becomingCancelled,
    }
  );

  if (
    result.ok &&
    becomingCancelled &&
    isCanonicalReservationCutover() &&
    isActiveBookingStatus(booking.bookingStatus)
  ) {
    const released = await releaseBookingCanonicalCapacity(
      booking,
      clubId,
      releaseCapacityRequestId(bookingId, "cancel"),
      "booking_cancelled"
    );
    if (!released?.ok) {
      return reconciliationFailure(
        "Booking was cancelled in projection but canonical release failed.",
        { booking: result.booking, release: released }
      );
    }
  }

  if (
    result.ok &&
    becomingCancelled
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

export async function deleteBooking(bookingId, clubId) {
  const check = guardClubAction(clubId, PERMISSIONS.BOOKING_UPDATE);
  if (!check.ok) {
    return { ok: false, message: check.error };
  }

  const bookings = loadBookingsForClub(clubId);
  const booking = bookings.find((item) => item.id === bookingId) || null;
  const nextBookings = bookings.filter((item) => item.id !== bookingId);
  saveBookingsForClub(nextBookings, clubId);

  if (
    booking
    && isCanonicalReservationCutover()
    && isActiveBookingStatus(booking.bookingStatus)
  ) {
    const released = await releaseBookingCanonicalCapacity(
      booking,
      clubId,
      releaseCapacityRequestId(bookingId, "delete"),
      "booking_deleted"
    );
    if (!released?.ok) {
      return reconciliationFailure(
        "Booking projection was deleted but canonical release failed.",
        { bookings: nextBookings, release: released }
      );
    }
  }

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

export async function createRecurringSeriesBookings(seriesInput, clubId) {
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

  for (const candidate of candidates) {
    const result = await createBooking(candidate, clubId);

    if (result.ok) {
      created.push(result.booking);
      continue;
    }

    skipped.push({
      date: candidate.date,
      message: result.message,
    });
  }

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

async function mutateBookingCanonicalCapacity(existing, nextBooking, clubId) {
  const reserve = canonicalBookingGateway.reserveCourts;
  if (typeof reserve !== "function") {
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      message: "Canonical reservation cutover is enabled but no reserve adapter is bound.",
    };
  }

  const targetRequestId = rescheduleReserveRequestId(nextBooking);
  const reserved = await settle(
    reserve(buildCanonicalReserveOptions(nextBooking, clubId, targetRequestId))
  );
  if (!reserved?.ok) {
    return {
      ok: false,
      code: reserved?.code || COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      message: reserved?.error || reserved?.message || "Canonical target reserve failed.",
      conflict: reserved,
    };
  }

  const reservationId = reserved.reservationIds?.[0]
    || reserved.reserved?.[0]?.reservationId
    || null;
  const physicalCourtId = reserved.physicalCourtIds?.[0]
    || nextBooking.physicalCourtId
    || null;

  let saved;
  try {
    saved = saveBooking(
      { ...nextBooking, reservationId, physicalCourtId },
      clubId,
      { excludeId: existing.id, skipConflictCheck: true }
    );
  } catch (error) {
    saved = { ok: false, message: error?.message || "Booking projection update failed." };
  }

  if (!saved?.ok) {
    const compensated = await releaseBookingCanonicalCapacity(
      { ...nextBooking, reservationId, physicalCourtId },
      clubId,
      compensationRequestId(`${nextBooking.id}:target`),
      "projection_update_failed"
    );
    if (!compensated?.ok) {
      return reconciliationFailure(
        "Canonical target reserve succeeded but projection update failed, and target compensation release also failed.",
        {
          reservationId,
          saveError: saved?.message,
          compensation: compensated,
        }
      );
    }
    return {
      ok: false,
      code: saved?.code || COURT_RESOURCE_CODE.PARTIAL_FAILURE,
      message: saved?.message || "Booking projection update failed; target reservation was compensated.",
      compensated: true,
    };
  }

  const releasedOld = await releaseBookingCanonicalCapacity(
    existing,
    clubId,
    releaseCapacityRequestId(existing.id, "reschedule-previous"),
    "booking_rescheduled"
  );
  if (!releasedOld?.ok) {
    return reconciliationFailure(
      "Booking projection moved to the new window but previous canonical release failed.",
      { booking: saved.booking, release: releasedOld }
    );
  }

  return saved;
}

export async function saveBookingCapacityMutation(booking, clubId, { excludeId = null } = {}) {
  if (!isCanonicalReservationCutover()) {
    return saveBooking(booking, clubId, { excludeId });
  }
  const existingId = excludeId || booking.id;
  const existing = getBookingById(existingId, clubId);
  if (!existing) {
    return createBooking(booking, clubId);
  }
  if (capacityFingerprint(existing) === capacityFingerprint(booking)) {
    return saveBooking(booking, clubId, { excludeId: existingId, skipConflictCheck: true });
  }
  return mutateBookingCanonicalCapacity(existing, { ...booking, id: existing.id }, clubId);
}

export async function extendBookingTime(bookingId, extraMinutes, clubId) {
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

  const nextBooking = {
    ...booking,
    endTime: newEndTime,
    totalAmount: (Number(booking.totalAmount) || 0) + extraAmount,
  };

  if (isCanonicalReservationCutover()) {
    return mutateBookingCanonicalCapacity(booking, nextBooking, clubId);
  }

  return saveBooking(nextBooking, clubId, { excludeId: bookingId });
}

export async function transferBookingCourt(bookingId, newCourtId, clubId) {
  const booking = getBookingById(bookingId, clubId);

  if (!booking) {
    return { ok: false, message: "Không tìm thấy booking." };
  }

  if (!newCourtId || newCourtId === booking.courtId) {
    return { ok: false, message: "Chọn sân khác để chuyển." };
  }

  const nextBooking = {
    ...booking,
    courtId: newCourtId,
  };

  if (isCanonicalReservationCutover()) {
    return mutateBookingCanonicalCapacity(booking, nextBooking, clubId);
  }

  return saveBooking(nextBooking, clubId, { excludeId: bookingId });
}

export async function createMaintenanceBooking(input, clubId) {
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
  if (isCanonicalBookingLifecycle()) {
    return {
      ok: true,
      updatedCount: 0,
      canonical: true,
      message:
        "Canonical booking lifecycle is enabled — use Court Operations lifecycle commands (no blob auto-complete).",
    };
  }

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
  if (isCanonicalBookingLifecycle()) {
    return {
      ok: true,
      updatedCount: 0,
      canonical: true,
      message:
        "Canonical booking lifecycle is enabled — use Court Operations lifecycle commands (no blob auto-start).",
    };
  }

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

export async function duplicateBooking(bookingId, clubId, overrides = {}) {
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
    "reservationId",
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
