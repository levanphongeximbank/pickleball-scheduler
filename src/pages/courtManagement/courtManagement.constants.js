import {
  DEFAULT_CLOSE_HOUR,
  DEFAULT_OPEN_HOUR,
} from "../../domain/courtBookingEngine.js";

export function buildTimeOptions(
  openHour = DEFAULT_OPEN_HOUR,
  closeHour = DEFAULT_CLOSE_HOUR
) {
  const options = [];

  for (let hour = openHour; hour < closeHour; hour += 1) {
    options.push(formatHourLabel(hour));
  }

  return options;
}

export function buildEndTimeOptions(
  openHour = DEFAULT_OPEN_HOUR,
  closeHour = DEFAULT_CLOSE_HOUR
) {
  const options = [];

  for (let hour = openHour + 1; hour <= closeHour; hour += 1) {
    options.push(formatHourLabel(hour));
  }

  return options;
}

function formatHourLabel(hour) {
  if (hour === 24) {
    return "24:00";
  }

  return `${String(hour).padStart(2, "0")}:00`;
}

export const CALENDAR_CELL_COLORS = {
  empty: { bg: "#f5f5f5", color: "#757575" },
  booked: { bg: "#e3f2fd", color: "#1565c0" },
  deposit_paid: { bg: "#e0f7fa", color: "#00838f" },
  playing: { bg: "#e8f5e9", color: "#2e7d32" },
  completed: { bg: "#eeeeee", color: "#616161" },
  cancelled: { bg: "#ffebee", color: "#c62828" },
  locked: { bg: "#efebe9", color: "#5d4037" },
  maintenance: { bg: "#fff3e0", color: "#ef6c00" },
  tournament: { bg: "#fff8e1", color: "#f57f17" },
  social_play: { bg: "#f3e5f5", color: "#7b1fa2" },
  recurring: { bg: "#e8eaf6", color: "#3949ab" },
};

export const BOOKING_TYPE_LABELS = {
  single: "Booking lẻ",
  recurring: "Lặp tuần",
  social_play: "Social Play",
  tournament: "Giải đấu",
  maintenance: "Bảo trì",
};

export const PAYMENT_STATUS_LABELS = {
  unpaid: "Chưa thanh toán",
  deposit_paid: "Đã cọc",
  paid: "Đã thanh toán",
  refunded: "Đã hoàn tiền",
};

export const BOOKING_STATUS_LABELS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  checked_in: "Đã check-in",
  playing: "Đang chơi",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  no_show: "No-show",
};

export const COURT_STATUS_LABELS = {
  active: "Hoạt động",
  locked: "Khóa",
  maintenance: "Bảo trì",
};

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDisplayDate(isoDate) {
  if (!isoDate) {
    return "";
  }

  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) {
    return "";
  }

  return `${startTime} - ${endTime}`;
}
