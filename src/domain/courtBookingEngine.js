import { getCourtDisplayName, isCourtBookable } from "../models/court.js";
import {
  derivePaymentStatus,
  getRemainingAmount,
  isActiveBookingStatus,
  normalizeBooking,
} from "../models/booking.js";

export const DEFAULT_OPEN_HOUR = 0;
export const DEFAULT_CLOSE_HOUR = 24;
export const DEFAULT_SLOT_MINUTES = 60;

const CANCELLED_STATUSES = new Set(["cancelled", "no_show"]);

export function timeToMinutes(time) {
  if (!time || typeof time !== "string") {
    return 0;
  }

  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function calculateDuration(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (end <= start) {
    return 0;
  }

  return end - start;
}

export function doTimesOverlap(startA, endA, startB, endB) {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);

  return aStart < bEnd && bStart < aEnd;
}

export function isBookingBlocking(booking) {
  if (!booking) {
    return false;
  }

  return isActiveBookingStatus(booking.bookingStatus);
}

export function checkBookingConflict(bookings, newBooking, excludeBookingId = null) {
  if (!newBooking?.courtId || !newBooking?.date) {
    return null;
  }

  if (!newBooking.startTime || !newBooking.endTime) {
    return { code: "INVALID_TIME", message: "Vui lòng chọn giờ bắt đầu và kết thúc." };
  }

  if (timeToMinutes(newBooking.endTime) <= timeToMinutes(newBooking.startTime)) {
    return {
      code: "INVALID_RANGE",
      message: "Giờ kết thúc phải sau giờ bắt đầu.",
    };
  }

  const conflicts = (bookings || []).filter((booking) => {
    if (excludeBookingId && booking.id === excludeBookingId) {
      return false;
    }

    if (!isBookingBlocking(booking)) {
      return false;
    }

    if (booking.courtId !== newBooking.courtId) {
      return false;
    }

    if (booking.date !== newBooking.date) {
      return false;
    }

    return doTimesOverlap(
      booking.startTime,
      booking.endTime,
      newBooking.startTime,
      newBooking.endTime
    );
  });

  if (conflicts.length === 0) {
    return null;
  }

  const conflict = conflicts[0];
  const courtLabel = conflict.courtName || `Sân ${conflict.courtId}`;

  return {
    code: "CONFLICT",
    message: `${courtLabel} đã có booking từ ${conflict.startTime} đến ${conflict.endTime}. Không thể tạo booking trùng giờ.`,
    conflict,
  };
}

export function calculateBookingAmount(court, startTime, endTime, pricingRules = {}) {
  const durationMinutes = calculateDuration(startTime, endTime);

  if (durationMinutes <= 0) {
    return 0;
  }

  const { peakHourRules, date } = pricingRules;

  if (!peakHourRules?.enabled) {
    const hours = durationMinutes / 60;
    const hourlyRate =
      Number(pricingRules.hourlyRate) ||
      Number(court?.peakHourlyRate) ||
      Number(court?.defaultHourlyRate) ||
      0;

    return Math.round(hourlyRate * hours);
  }

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  let total = 0;
  let cursor = startMin;
  const segmentMinutes = 15;

  while (cursor < endMin) {
    const segmentEnd = Math.min(cursor + segmentMinutes, endMin);
    const hourlyRate = resolveHourlyRate(court, cursor, peakHourRules, date || "", pricingRules);
    total += hourlyRate * ((segmentEnd - cursor) / 60);
    cursor = segmentEnd;
  }

  return Math.round(total);
}

export function isPeakMinute(minuteOfDay, peakRules, dateIso) {
  if (!peakRules?.enabled) {
    return false;
  }

  if (dateIso) {
    const weekday = new Date(`${dateIso}T12:00:00`).getDay();
    const weekdays = peakRules.weekdays;

    if (Array.isArray(weekdays) && weekdays.length > 0 && !weekdays.includes(weekday)) {
      return false;
    }
  }

  const start = (peakRules.startHour ?? 17) * 60;
  const end = (peakRules.endHour ?? 22) * 60;

  return minuteOfDay >= start && minuteOfDay < end;
}

export function resolveHourlyRate(court, minuteOfDay, peakRules, dateIso, pricingRules = {}) {
  if (Number(pricingRules.hourlyRate)) {
    return Number(pricingRules.hourlyRate);
  }

  if (peakRules?.enabled) {
    const isPeak = isPeakMinute(minuteOfDay, peakRules, dateIso);

    if (isPeak) {
      return Number(court?.peakHourlyRate) || Number(court?.defaultHourlyRate) || 0;
    }

    return Number(court?.defaultHourlyRate) || 0;
  }

  return (
    Number(court?.peakHourlyRate) ||
    Number(court?.defaultHourlyRate) ||
    0
  );
}

export function getBookingsByDate(bookings, date) {
  return (bookings || []).filter((booking) => booking.date === date);
}

export function getBookingsByCourt(bookings, courtId, date) {
  return getBookingsByDate(bookings, date).filter(
    (booking) => booking.courtId === courtId
  );
}

export function getCourtStatusAtTime(court, bookings, date, time) {
  if (!court) {
    return "unknown";
  }

  if (court.status === "maintenance") {
    return "maintenance";
  }

  if (court.status === "locked" || court.active === false) {
    return "locked";
  }

  const courtBookings = getBookingsByCourt(bookings, court.id, date).filter(
    isBookingBlocking
  );

  const activeNow = courtBookings.find((booking) =>
    doTimesOverlap(booking.startTime, booking.endTime, time, minutesToTime(timeToMinutes(time) + 1))
  );

  if (!activeNow) {
    return "empty";
  }

  if (activeNow.bookingStatus === "playing") {
    return "playing";
  }

  if (activeNow.paymentStatus === "deposit_paid") {
    return "deposit_paid";
  }

  if (activeNow.paymentStatus === "paid") {
    return "booked";
  }

  return "booked";
}

export function buildHourSlots(openHour = DEFAULT_OPEN_HOUR, closeHour = DEFAULT_CLOSE_HOUR, slotMinutes = DEFAULT_SLOT_MINUTES) {
  const slots = [];

  for (let minutes = openHour * 60; minutes < closeHour * 60; minutes += slotMinutes) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
}

export function findBookingAtSlot(bookings, courtId, date, slotTime, slotMinutes = DEFAULT_SLOT_MINUTES) {
  const slotEnd = minutesToTime(timeToMinutes(slotTime) + slotMinutes);

  return (bookings || []).find((booking) => {
    if (!isBookingBlocking(booking)) {
      return false;
    }

    if (booking.courtId !== courtId || booking.date !== date) {
      return false;
    }

    return (
      booking.startTime <= slotTime &&
      timeToMinutes(booking.startTime) < timeToMinutes(slotEnd) &&
      doTimesOverlap(booking.startTime, booking.endTime, slotTime, slotEnd)
    );
  });
}

/**
 * Build per-cell render plan for day grid (supports multi-slot booking blocks).
 * Returns Map keyed by `${courtId}::${slotTime}` with type: empty | booking | skip.
 */
export function buildDayGridBlocks(
  dayBookings,
  courts,
  date,
  hourSlots,
  slotMinutes = DEFAULT_SLOT_MINUTES
) {
  const blocks = new Map();

  for (const court of courts || []) {
    for (let index = 0; index < hourSlots.length; index += 1) {
      const slotTime = hourSlots[index];
      const key = `${court.id}::${slotTime}`;
      const booking = findBookingAtSlot(dayBookings, court.id, date, slotTime, slotMinutes);

      if (!booking) {
        blocks.set(key, {
          type: "empty",
          court,
          slotTime,
          slotIndex: index,
        });
        continue;
      }

      const bookingStartMin = timeToMinutes(booking.startTime);
      const slotMin = timeToMinutes(slotTime);

      if (bookingStartMin < slotMin) {
        blocks.set(key, { type: "skip" });
        continue;
      }

      const duration = calculateDuration(booking.startTime, booking.endTime);
      const rowSpan = Math.max(1, Math.ceil(duration / slotMinutes));

      blocks.set(key, {
        type: "booking",
        court,
        slotTime,
        slotIndex: index,
        booking,
        rowSpan,
      });
    }
  }

  return blocks;
}

export function getCurrentBookingForCourt(court, bookings, date, now = new Date()) {
  const today = date || now.toISOString().slice(0, 10);
  const currentTime = minutesToTime(now.getHours() * 60 + now.getMinutes());

  const courtBookings = getBookingsByCourt(bookings, court.id, today)
    .filter(isBookingBlocking)
    .filter((booking) =>
      doTimesOverlap(booking.startTime, booking.endTime, currentTime, minutesToTime(timeToMinutes(currentTime) + 1))
    );

  return courtBookings[0] || null;
}

export function getNextBookingForCourt(court, bookings, date, now = new Date()) {
  const today = date || now.toISOString().slice(0, 10);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const upcoming = getBookingsByCourt(bookings, court.id, today)
    .filter(isBookingBlocking)
    .filter((booking) => timeToMinutes(booking.startTime) >= currentMinutes)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  return upcoming[0] || null;
}

export function validateCourtForBooking(court) {
  if (!court) {
    return { ok: false, message: "Không tìm thấy sân." };
  }

  if (court.status === "maintenance") {
    return { ok: false, message: "Sân đang bảo trì, không thể đặt." };
  }

  if (!isCourtBookable(court)) {
    return { ok: false, message: "Sân đang khóa, không thể đặt." };
  }

  return { ok: true };
}

export function validateBookingAmounts(booking) {
  const totalAmount = Number(booking.totalAmount) || 0;
  const depositAmount = Number(booking.depositAmount) || 0;
  const paidAmount = Number(booking.paidAmount) || 0;

  if (totalAmount < 0 || depositAmount < 0 || paidAmount < 0) {
    return { ok: false, message: "Số tiền không được âm." };
  }

  return { ok: true };
}

export function enrichBookingWithCourt(booking, courts) {
  const court = (courts || []).find((item) => item.id === booking.courtId);

  return normalizeBooking({
    ...booking,
    courtName: court ? getCourtDisplayName(court) : booking.courtName,
    durationMinutes: calculateDuration(booking.startTime, booking.endTime),
    paymentStatus: derivePaymentStatus(
      booking.totalAmount,
      booking.paidAmount,
      booking.depositAmount
    ),
  });
}

export function computeDailyRevenue(bookings, date) {
  const dayBookings = getBookingsByDate(bookings, date);

  let expectedRevenue = 0;
  let collected = 0;
  let debt = 0;
  let completed = 0;
  let cancelled = 0;
  let playing = 0;
  let noShow = 0;

  const byCourt = {};
  const byType = {};

  dayBookings.forEach((booking) => {
    if (CANCELLED_STATUSES.has(booking.bookingStatus)) {
      cancelled += 1;
      if (booking.bookingStatus === "no_show") {
        noShow += 1;
      }
      return;
    }

    expectedRevenue += Number(booking.totalAmount) || 0;
    collected += Number(booking.paidAmount) || 0;
    debt += getRemainingAmount(booking.totalAmount, booking.paidAmount);

    if (booking.bookingStatus === "completed") {
      completed += 1;
    }

    if (booking.bookingStatus === "playing") {
      playing += 1;
    }

    const courtKey = booking.courtName || `Sân ${booking.courtId}`;
    byCourt[courtKey] = (byCourt[courtKey] || 0) + (Number(booking.totalAmount) || 0);

    const typeKey = booking.bookingType || "single";
    byType[typeKey] = (byType[typeKey] || 0) + (Number(booking.totalAmount) || 0);
  });

  return {
    date,
    expectedRevenue,
    collected,
    debt,
    totalBookings: dayBookings.length,
    completed,
    playing,
    cancelled,
    noShow,
    byCourt,
    byType,
  };
}

export function listDatesInRange(fromDate, toDate) {
  if (!fromDate || !toDate || fromDate > toDate) {
    return [];
  }

  const dates = [];
  const [startYear, startMonth, startDay] = fromDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = toDate.split("-").map(Number);
  const cursor = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function computeRangeRevenue(bookings, fromDate, toDate) {
  const dailyBreakdown = listDatesInRange(fromDate, toDate).map((date) =>
    computeDailyRevenue(bookings, date)
  );

  const totals = {
    expectedRevenue: 0,
    collected: 0,
    debt: 0,
    totalBookings: 0,
    completed: 0,
    playing: 0,
    cancelled: 0,
    noShow: 0,
  };

  const byCourt = {};
  const byType = {};

  dailyBreakdown.forEach((day) => {
    totals.expectedRevenue += day.expectedRevenue;
    totals.collected += day.collected;
    totals.debt += day.debt;
    totals.totalBookings += day.totalBookings;
    totals.completed += day.completed;
    totals.playing += day.playing;
    totals.cancelled += day.cancelled;
    totals.noShow += day.noShow;

    Object.entries(day.byCourt).forEach(([courtName, amount]) => {
      byCourt[courtName] = (byCourt[courtName] || 0) + amount;
    });

    Object.entries(day.byType).forEach(([type, amount]) => {
      byType[type] = (byType[type] || 0) + amount;
    });
  });

  return {
    fromDate,
    toDate,
    ...totals,
    byCourt,
    byType,
    dailyBreakdown,
  };
}

export function getDebtBookings(bookings, { includePast = true, today } = {}) {
  const todayDate = today || new Date().toISOString().slice(0, 10);

  return (bookings || []).filter((booking) => {
    if (CANCELLED_STATUSES.has(booking.bookingStatus)) {
      return false;
    }

    const remaining = getRemainingAmount(booking.totalAmount, booking.paidAmount);

    if (remaining <= 0) {
      return false;
    }

    return includePast || booking.date >= todayDate;
  });
}

export function computeDebtSummary(bookings, options = {}) {
  const debtBookings = getDebtBookings(bookings, options);
  const totalDebt = debtBookings.reduce(
    (sum, booking) => sum + getRemainingAmount(booking.totalAmount, booking.paidAmount),
    0
  );

  const byCustomer = {};
  debtBookings.forEach((booking) => {
    const key = booking.customerPhone || booking.customerName || "Không rõ";
    byCustomer[key] =
      (byCustomer[key] || 0) + getRemainingAmount(booking.totalAmount, booking.paidAmount);
  });

  return {
    totalDebt,
    bookingCount: debtBookings.length,
    byCustomer,
    bookings: [...debtBookings].sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.startTime.localeCompare(b.startTime);
    }),
  };
}

export function getWeekDates(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const cursor = new Date(year, month - 1, day);
  const weekday = cursor.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(year, month - 1, day + diffToMonday);
  const dates = [];

  for (let index = 0; index < 7; index += 1) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
  }

  return dates;
}

export function getMonthCalendarDates(isoDate) {
  const [year, month] = isoDate.split("-").map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const weekday = firstOfMonth.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(year, month - 1, 1 + diffToMonday);
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");

    cells.push({
      date: `${y}-${m}-${d}`,
      inMonth: current.getMonth() === month - 1,
    });
  }

  return cells;
}

export function shiftIsoMonth(isoDate, months) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const cursor = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, "0");
  const d = String(safeDay).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftIsoDate(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const cursor = new Date(year, month - 1, day);
  cursor.setDate(cursor.getDate() + days);
  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, "0");
  const d = String(cursor.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeCourtUtilization(
  bookings,
  courts,
  fromDate,
  toDate,
  openHour = DEFAULT_OPEN_HOUR,
  closeHour = DEFAULT_CLOSE_HOUR
) {
  const dates = listDatesInRange(fromDate, toDate);
  const availableMinutesPerCourtPerDay = Math.max(0, closeHour - openHour) * 60;
  const availableMinutesPerCourt = availableMinutesPerCourtPerDay * dates.length;
  const totalAvailableMinutes = availableMinutesPerCourt * (courts?.length || 0);

  const byCourt = (courts || []).map((court, index) => ({
    courtId: court.id,
    courtName: getCourtDisplayName(court, index),
    bookedMinutes: 0,
    availableMinutes: availableMinutesPerCourt,
    utilizationPercent: 0,
    bookingCount: 0,
  }));

  const courtMap = new Map(byCourt.map((item) => [item.courtId, item]));
  let totalBookedMinutes = 0;

  (bookings || []).forEach((booking) => {
    if (CANCELLED_STATUSES.has(booking.bookingStatus)) {
      return;
    }

    if (!dates.includes(booking.date)) {
      return;
    }

    const bookedMinutes = calculateDuration(booking.startTime, booking.endTime);

    if (bookedMinutes <= 0) {
      return;
    }

    totalBookedMinutes += bookedMinutes;
    const courtStats = courtMap.get(booking.courtId);

    if (courtStats) {
      courtStats.bookedMinutes += bookedMinutes;
      courtStats.bookingCount += 1;
    }
  });

  const courtRows = [...courtMap.values()].map((item) => ({
    ...item,
    utilizationPercent:
      item.availableMinutes > 0
        ? Math.round((item.bookedMinutes / item.availableMinutes) * 100)
        : 0,
  }));

  return {
    fromDate,
    toDate,
    dayCount: dates.length,
    courtCount: courts?.length || 0,
    bookedMinutes: totalBookedMinutes,
    availableMinutes: totalAvailableMinutes,
    utilizationPercent:
      totalAvailableMinutes > 0
        ? Math.round((totalBookedMinutes / totalAvailableMinutes) * 100)
        : 0,
    byCourt: courtRows,
  };
}

export function getTodayUpcomingBookings(
  bookings,
  date = new Date().toISOString().slice(0, 10),
  now = new Date()
) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (bookings || [])
    .filter((booking) => booking.date === date)
    .filter((booking) => isActiveBookingStatus(booking.bookingStatus))
    .filter((booking) => timeToMinutes(booking.startTime) >= nowMinutes)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    .slice(0, 5);
}

export function getMonthRange(isoDate = new Date().toISOString().slice(0, 10)) {
  const [year, month] = isoDate.split("-").map(Number);
  const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { fromDate, toDate };
}

export function findAvailableSlots({
  bookings = [],
  courts = [],
  date,
  durationMinutes = 60,
  openHour = DEFAULT_OPEN_HOUR,
  closeHour = DEFAULT_CLOSE_HOUR,
  slotMinutes = DEFAULT_SLOT_MINUTES,
}) {
  if (!date) {
    return [];
  }

  const duration = Math.max(slotMinutes, Number(durationMinutes) || 60);
  const dayBookings = getBookingsByDate(bookings, date).filter(isBookingBlocking);
  const slots = [];

  (courts || []).forEach((court, index) => {
    if (!isCourtBookable(court) || court.status !== "active") {
      return;
    }

    for (let start = openHour * 60; start + duration <= closeHour * 60; start += slotMinutes) {
      const startTime = minutesToTime(start);
      const endTime = minutesToTime(start + duration);
      const hasConflict = dayBookings.some(
        (booking) =>
          booking.courtId === court.id &&
          doTimesOverlap(booking.startTime, booking.endTime, startTime, endTime)
      );

      if (!hasConflict) {
        slots.push({
          courtId: court.id,
          courtName: getCourtDisplayName(court, index),
          date,
          startTime,
          endTime,
          durationMinutes: duration,
        });
      }
    }
  });

  return slots.sort((a, b) => {
    if (a.startTime !== b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }

    return a.courtName.localeCompare(b.courtName);
  });
}

export function summarizeTodayOperations(bookings, date = new Date().toISOString().slice(0, 10), now = new Date()) {
  const daySummary = computeDailyRevenue(bookings, date);
  const debtSummary = computeDebtSummary(bookings, { includePast: true, today: date });
  const upcoming = getTodayUpcomingBookings(bookings, date, now);

  return {
    date,
    ...daySummary,
    totalDebt: debtSummary.totalDebt,
    debtBookingCount: debtSummary.bookingCount,
    upcomingCount: upcoming.length,
    upcoming,
  };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(Number(amount) || 0));
}

export function getBookingDisplayStatus(booking) {
  if (!booking) {
    return { label: "Trống", tone: "empty" };
  }

  if (booking.bookingStatus === "playing") {
    return { label: "Đang chơi", tone: "playing", color: "success" };
  }

  if (booking.bookingStatus === "completed") {
    return { label: "Hoàn thành", tone: "completed", color: "default" };
  }

  if (booking.bookingStatus === "cancelled") {
    return { label: "Hủy", tone: "cancelled", color: "error" };
  }

  if (booking.bookingStatus === "no_show") {
    return { label: "No-show", tone: "cancelled", color: "warning" };
  }

  if (booking.paymentStatus === "deposit_paid") {
    return { label: "Đã cọc", tone: "deposit_paid", color: "info" };
  }

  if (booking.paymentStatus === "paid") {
    return { label: "Đã đặt", tone: "booked", color: "primary" };
  }

  return { label: "Đã đặt", tone: "booked", color: "primary" };
}

export function getCalendarCellStatus(booking, court) {
  if (court?.status === "maintenance") {
    return { label: "Bảo trì", tone: "maintenance" };
  }

  if (court?.status === "locked" || court?.active === false) {
    return { label: "Khóa", tone: "locked" };
  }

  if (!booking) {
    return { label: "Trống", tone: "empty" };
  }

  const base = getBookingDisplayStatus(booking);

  if (booking.bookingType === "tournament") {
    return { ...base, label: "Giải đấu", tone: "tournament" };
  }

  if (booking.bookingType === "social_play") {
    return { ...base, label: "Social", tone: "social_play" };
  }

  if (booking.bookingType === "recurring") {
    return { ...base, label: booking.customerName || "Lặp tuần", tone: "recurring" };
  }

  return base;
}
