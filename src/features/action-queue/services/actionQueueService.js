import { loadBookingsForClub, loadCustomersForClub } from "../../../domain/clubStorage.js";
import { listTournaments } from "../../../domain/tournamentService.js";
import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { todayIsoDate } from "../../../pages/courtManagement/courtManagement.constants.js";

/**
 * Hàng đợi việc cần xử lý trên Dashboard.
 */
export function buildActionQueue({ clubId, referenceDate = new Date() } = {}) {
  if (!clubId) return [];

  const today = todayIsoDate(referenceDate);
  const items = [];

  const bookings = loadBookingsForClub(clubId) || [];
  for (const booking of bookings) {
    if (booking.status === "pending" || booking.status === "awaiting_payment") {
      items.push({
        id: `booking-${booking.id}`,
        type: "booking",
        priority: booking.status === "pending" ? "high" : "medium",
        title: booking.status === "pending" ? "Đặt sân chờ duyệt" : "Đặt sân chờ thanh toán",
        subtitle: `${booking.customerName || "Khách"} · ${booking.date || today}`,
        path: "/court-management/bookings",
        createdAt: booking.updatedAt || booking.createdAt || today,
      });
    }
  }

  const customers = loadCustomersForClub(clubId) || [];
  for (const customer of customers) {
    const debt = Number(customer.debt || customer.outstandingBalance || 0);
    if (debt > 0) {
      items.push({
        id: `debt-${customer.id}`,
        type: "debt",
        priority: debt > 500000 ? "high" : "medium",
        title: "Công nợ khách hàng",
        subtitle: `${customer.name} · ${debt.toLocaleString("vi-VN")} đ`,
        path: "/court-management/customers",
        createdAt: customer.updatedAt || today,
      });
    }
  }

  const tournaments = listTournaments(clubId) || [];
  for (const tournament of tournaments) {
    if (
      tournament.status === TOURNAMENT_STATUS.REGISTRATION ||
      tournament.status === TOURNAMENT_STATUS.DRAFT
    ) {
      const entryCount = tournament.entries?.length || tournament.players?.length || 0;
      if (entryCount < 4) {
        items.push({
          id: `tournament-${tournament.id}`,
          type: "tournament",
          priority: "medium",
          title: "Giải thiếu VĐV đăng ký",
          subtitle: `${tournament.name} · ${entryCount} VĐV`,
          path: "/tournament/register",
          createdAt: tournament.updatedAt || today,
        });
      }
    }
  }

  return items.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);
  });
}
