import {
  getCurrentBookingForCourt,
  getNextBookingForCourt,
  timeToMinutes,
} from "../domain/courtBookingEngine.js";
import { todayIsoDate } from "../pages/courtManagement/courtManagement.constants.js";

export function getCourtOperationalStatus(court, currentBooking) {
  if (court?.status === "maintenance") {
    return "maintenance";
  }

  if (court?.status === "locked" || court?.active === false) {
    return "locked";
  }

  if (currentBooking?.bookingStatus === "playing") {
    return "playing";
  }

  if (
    currentBooking?.bookingStatus === "confirmed" ||
    currentBooking?.bookingStatus === "checked_in"
  ) {
    return "pending";
  }

  if (currentBooking) {
    return "booked";
  }

  return "empty";
}

export function getCourtStatusMeta(status) {
  const map = {
    empty: {
      label: "Trống",
      color: "#0f766e",
      bg: "rgba(15, 118, 110, 0.1)",
      border: "rgba(15, 118, 110, 0.25)",
    },
    playing: {
      label: "Đang thi đấu",
      color: "#4f46e5",
      bg: "rgba(79, 70, 229, 0.1)",
      border: "rgba(79, 70, 229, 0.3)",
    },
    pending: {
      label: "Chờ xác nhận",
      color: "#ca8a04",
      bg: "rgba(202, 138, 4, 0.12)",
      border: "rgba(202, 138, 4, 0.3)",
    },
    booked: {
      label: "Đã đặt",
      color: "#2563eb",
      bg: "rgba(37, 99, 235, 0.1)",
      border: "rgba(37, 99, 235, 0.25)",
    },
    maintenance: {
      label: "Bảo trì",
      color: "#ea580c",
      bg: "rgba(234, 88, 12, 0.1)",
      border: "rgba(234, 88, 12, 0.3)",
    },
    locked: {
      label: "Khóa sân",
      color: "#64748b",
      bg: "rgba(100, 116, 139, 0.12)",
      border: "rgba(100, 116, 139, 0.3)",
    },
  };

  return map[status] || map.empty;
}

export function computeCourtDashboardStats(courts = [], bookings = [], now = new Date()) {
  const today = todayIsoDate();
  let empty = 0;
  let playing = 0;
  let maintenance = 0;
  let pending = 0;
  let activeMatches = 0;

  courts.forEach((court) => {
    const current = getCurrentBookingForCourt(court, bookings, today, now);
    const status = getCourtOperationalStatus(court, current);

    if (status === "empty") empty += 1;
    else if (status === "playing") {
      playing += 1;
      activeMatches += 1;
    } else if (status === "maintenance") maintenance += 1;
    else if (status === "pending") pending += 1;
    else if (status === "locked") {
      /* counted separately if needed */
    }
  });

  const waitingCount = bookings.filter(
    (b) =>
      b.date === today &&
      ["confirmed", "checked_in"].includes(b.bookingStatus) &&
      !courts.some((court) => {
        const current = getCurrentBookingForCourt(court, bookings, today, now);
        return current?.id === b.id;
      })
  ).length;

  return {
    total: courts.length,
    empty,
    playing,
    maintenance,
    pending,
    waiting: waitingCount,
    activeMatches,
  };
}

export function getMatchElapsedMinutes(booking, now = new Date()) {
  if (!booking?.startTime || !booking?.date) return 0;

  const [year, month, day] = booking.date.split("-").map(Number);
  const [hours, minutes] = booking.startTime.split(":").map(Number);
  const start = new Date(year, month - 1, day, hours, minutes);

  if (Number.isNaN(start.getTime())) return 0;

  const diff = Math.floor((now.getTime() - start.getTime()) / 60000);
  return Math.max(0, diff);
}

export function getMatchDurationProgress(booking, now = new Date()) {
  if (!booking?.startTime || !booking?.endTime) return 0;

  const start = timeToMinutes(booking.startTime);
  const end = timeToMinutes(booking.endTime);
  const total = end - start;

  if (total <= 0) return 0;

  const elapsed = getMatchElapsedMinutes(booking, now);
  return Math.min(100, Math.round((elapsed / total) * 100));
}

export function formatElapsedTime(minutes) {
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}p` : `${h}h`;
}

export function generateDirectorSuggestions({ courts = [], bookings = [], now = new Date() }) {
  const today = todayIsoDate();
  const stats = computeCourtDashboardStats(courts, bookings, now);
  const suggestions = [];

  if (stats.waiting > 0) {
    suggestions.push({
      type: "waiting",
      priority: "high",
      text: `${stats.waiting} booking đang chờ xếp sân — nên ưu tiên sân trống.`,
    });
  }

  const emptyCourts = courts.filter((court) => {
    const current = getCurrentBookingForCourt(court, bookings, today, now);
    return getCourtOperationalStatus(court, current) === "empty";
  });

  if (emptyCourts.length > 0 && stats.waiting > 0) {
    suggestions.push({
      type: "assign",
      priority: "medium",
      text: `Nên xếp tiếp ${emptyCourts.length} sân trống để giảm hàng chờ.`,
    });
  } else if (emptyCourts.length > 0) {
    suggestions.push({
      type: "ready",
      priority: "low",
      text: `${emptyCourts.length} sân sẵn sàng — có thể mở thêm trận giao lưu.`,
    });
  }

  const longMatches = [];
  courts.forEach((court) => {
    const current = getCurrentBookingForCourt(court, bookings, today, now);
    if (current?.bookingStatus !== "playing") return;

    const elapsed = getMatchElapsedMinutes(current, now);
    const planned = timeToMinutes(current.endTime) - timeToMinutes(current.startTime);

    if (planned > 0 && elapsed > planned * 1.15) {
      longMatches.push({ court, booking: current, elapsed });
    }
  });

  if (longMatches.length > 0) {
    suggestions.push({
      type: "overtime",
      priority: "high",
      text: `${longMatches.length} trận chạy quá giờ dự kiến — cân nhắc kết thúc hoặc gia hạn.`,
    });
  }

  if (stats.playing > 0 && stats.empty === 0 && stats.maintenance === 0) {
    suggestions.push({
      type: "capacity",
      priority: "medium",
      text: "Tất cả sân đang bận — theo dõi thời gian kết thúc để xoay vòng nhanh.",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: "ok",
      priority: "low",
      text: "Hệ thống ổn định — AI sẵn sàng hỗ trợ xếp trận tiếp theo.",
    });
  }

  return suggestions;
}

export function buildCourtBoardData(courts, bookings, now = new Date()) {
  const today = todayIsoDate();

  return courts.map((court, index) => {
    const currentBooking = getCurrentBookingForCourt(court, bookings, today, now);
    const nextBooking = getNextBookingForCourt(court, bookings, today, now);
    const status = getCourtOperationalStatus(court, currentBooking);
    const statusMeta = getCourtStatusMeta(status);

    return {
      court,
      index,
      currentBooking,
      nextBooking,
      status,
      statusMeta,
      elapsedMinutes: currentBooking ? getMatchElapsedMinutes(currentBooking, now) : 0,
      progress: currentBooking ? getMatchDurationProgress(currentBooking, now) : 0,
    };
  });
}
