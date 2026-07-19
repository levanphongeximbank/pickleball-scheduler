import { doTimesOverlap } from "./courtBookingEngine.js";
import { createBookingRecord } from "../models/booking.js";
import { listCivilDatesForWeekday } from "./civilTime.js";

export const WEEKDAY_LABELS = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

export function createRecurringBookingSeries(input = {}) {
  return {
    id: input.id || `recurring-${Date.now()}`,
    customerName: input.customerName || "",
    customerPhone: input.customerPhone || "",
    courtId: input.courtId ?? null,
    startTime: input.startTime || "",
    endTime: input.endTime || "",
    weekday: Number.isFinite(Number(input.weekday)) ? Number(input.weekday) : 1,
    startDate: input.startDate || "",
    endDate: input.endDate || "",
    totalAmount: Number(input.totalAmount) || 0,
    depositAmount: Number(input.depositAmount) || 0,
    paidAmount: Number(input.paidAmount) || 0,
    status: input.status || "active",
    note: input.note || "",
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

export function listDatesForWeekday(startDate, endDate, weekday) {
  if (!startDate || !endDate) {
    return [];
  }
  try {
    return listCivilDatesForWeekday(startDate, endDate, weekday);
  } catch {
    return [];
  }
}

export function expandRecurringSeriesToBookings(series, options = {}) {
  if (!series?.courtId || !series.startDate || !series.endDate) {
    return [];
  }

  const dates = listDatesForWeekday(series.startDate, series.endDate, series.weekday);

  return dates.map((date) =>
    createBookingRecord({
      id: `${series.id}-${date}`,
      bookingType: "recurring",
      recurringSeriesId: series.id,
      courtId: series.courtId,
      courtName: options.courtName || "",
      customerName: series.customerName,
      customerPhone: series.customerPhone,
      date,
      startTime: series.startTime,
      endTime: series.endTime,
      totalAmount: series.totalAmount,
      depositAmount: series.depositAmount,
      paidAmount: series.paidAmount,
      bookingStatus: "confirmed",
      note: series.note ? `[Lặp tuần] ${series.note}` : "[Lặp tuần]",
      createdAt: series.createdAt,
      updatedAt: series.updatedAt,
    })
  );
}

export function findRecurringConflict(existingBookings, candidate) {
  return (existingBookings || []).find((booking) => {
    if (booking.bookingStatus === "cancelled" || booking.bookingStatus === "no_show") {
      return false;
    }

    if (booking.courtId !== candidate.courtId || booking.date !== candidate.date) {
      return false;
    }

    return doTimesOverlap(
      booking.startTime,
      booking.endTime,
      candidate.startTime,
      candidate.endTime
    );
  });
}
