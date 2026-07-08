import {
  computeCourtUtilization,
  computeDailyRevenue,
  formatCurrency,
} from "../../../domain/courtBookingEngine.js";
import { isActiveBookingStatus } from "../../../models/booking.js";
import { isCourtBookable } from "../../../models/court.js";

export function computeCalendarDayKpis({ bookings, courts, date, openHour, closeHour }) {
  const activeCourts = (courts || []).filter((court) => court.status !== "maintenance");
  const dayBookings = (bookings || []).filter(
    (booking) => booking.date === date && isActiveBookingStatus(booking.bookingStatus)
  );

  const utilization = computeCourtUtilization(
    dayBookings,
    activeCourts,
    date,
    date,
    openHour,
    closeHour
  );

  const revenue = computeDailyRevenue(dayBookings, date);
  const bookableCount = (courts || []).filter((court) => isCourtBookable(court)).length;

  return {
    activeCourts: activeCourts.length,
    totalCourts: courts?.length || 0,
    bookingCount: dayBookings.length,
    utilizationPercent: utilization.utilizationPercent,
    expectedRevenue: revenue.collected || revenue.expectedRevenue || 0,
    expectedRevenueLabel: formatCurrency(revenue.collected || revenue.expectedRevenue || 0),
    bookableCount,
  };
}
