import {
  DEFAULT_CLOSE_HOUR,
  DEFAULT_OPEN_HOUR,
} from "../../domain/courtBookingEngine.js";
import {
  absoluteToCivilDate,
  getBrowserDisplayCivilDate,
  resolveVenueTimezoneForClub,
} from "../../domain/civilTime.js";
import { CALENDAR_CELL_TONES } from "./calendar/courtCalendarTokens.js";

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

export const CALENDAR_CELL_COLORS = Object.fromEntries(
  Object.entries(CALENDAR_CELL_TONES).map(([key, value]) => [
    key,
    { bg: value.bg, color: value.color },
  ])
);

export const CALENDAR_STATUS_LABELS = Object.fromEntries(
  Object.entries(CALENDAR_CELL_TONES).map(([key, value]) => [key, value.label])
);

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

export function todayIsoDate(options = {}) {
  if (options && typeof options === "object") {
    if (options.timezone || options.clubId) {
      const tz = options.timezone
        ? { ok: true, timezone: String(options.timezone).trim() }
        : resolveVenueTimezoneForClub(options.clubId, options);
      if (tz.ok) {
        return absoluteToCivilDate(options.now || new Date(), tz.timezone);
      }
      if (options.allowBrowserLocal === true) {
        return getBrowserDisplayCivilDate(options.now || new Date());
      }
      throw Object.assign(new Error(tz.error || "TIMEZONE_REQUIRED"), {
        code: tz.code || "TIMEZONE_REQUIRED",
      });
    }
    if (options.allowBrowserLocal === true) {
      return getBrowserDisplayCivilDate(options.now || new Date());
    }
  }
  // Legacy no-arg calls remain display-only (browser local). Venue decision
  // paths must pass clubId or timezone explicitly.
  return getBrowserDisplayCivilDate();
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
