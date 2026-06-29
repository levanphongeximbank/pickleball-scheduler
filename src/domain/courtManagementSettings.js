import {
  DEFAULT_CLOSE_HOUR,
  DEFAULT_OPEN_HOUR,
  DEFAULT_SLOT_MINUTES,
} from "./courtBookingEngine.js";
import { loadClubData, saveClubData } from "./clubStorage.js";

export function getDefaultPeakHourRules() {
  return {
    enabled: false,
    startHour: 17,
    endHour: 22,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  };
}

export function getDefaultNotificationSettings() {
  return {
    enabled: false,
    minutesBefore: 30,
    browserNotify: true,
    inAppNotify: true,
  };
}

export function getDefaultAutomationSettings() {
  return {
    autoCompleteOnOpen: false,
    autoStartPlaying: false,
  };
}

export function getDefaultCourtManagementSettings() {
  return {
    openHour: DEFAULT_OPEN_HOUR,
    closeHour: DEFAULT_CLOSE_HOUR,
    slotMinutes: DEFAULT_SLOT_MINUTES,
    peakHourRules: getDefaultPeakHourRules(),
    notificationSettings: getDefaultNotificationSettings(),
    automationSettings: getDefaultAutomationSettings(),
  };
}

export function normalizePeakHourRules(raw = {}) {
  const defaults = getDefaultPeakHourRules();
  const startHour = Number(raw.startHour);
  const endHour = Number(raw.endHour);
  const weekdays = Array.isArray(raw.weekdays)
    ? raw.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : defaults.weekdays;

  return {
    enabled: Boolean(raw.enabled),
    startHour: Number.isFinite(startHour)
      ? Math.max(0, Math.min(23, startHour))
      : defaults.startHour,
    endHour: Number.isFinite(endHour)
      ? Math.max(1, Math.min(24, endHour))
      : defaults.endHour,
    weekdays: weekdays.length > 0 ? weekdays : defaults.weekdays,
  };
}

export function normalizeNotificationSettings(raw = {}) {
  const defaults = getDefaultNotificationSettings();
  const minutesBefore = Number(raw.minutesBefore);

  return {
    enabled: Boolean(raw.enabled),
    minutesBefore: Number.isFinite(minutesBefore)
      ? Math.max(5, Math.min(180, minutesBefore))
      : defaults.minutesBefore,
    browserNotify: raw.browserNotify !== false,
    inAppNotify: raw.inAppNotify !== false,
  };
}

export function normalizeAutomationSettings(raw = {}) {
  return {
    autoCompleteOnOpen: Boolean(raw.autoCompleteOnOpen),
    autoStartPlaying: Boolean(raw.autoStartPlaying),
  };
}

export function normalizeCourtManagementSettings(raw = {}) {
  const defaults = getDefaultCourtManagementSettings();
  const openHour = Number(raw.openHour);
  const closeHour = Number(raw.closeHour);
  const slotMinutes = Number(raw.slotMinutes);

  return {
    openHour: Number.isFinite(openHour) ? Math.max(0, Math.min(23, openHour)) : defaults.openHour,
    closeHour: Number.isFinite(closeHour)
      ? Math.max(1, Math.min(24, closeHour))
      : defaults.closeHour,
    slotMinutes: Number.isFinite(slotMinutes)
      ? Math.max(15, Math.min(120, slotMinutes))
      : defaults.slotMinutes,
    peakHourRules: normalizePeakHourRules(raw.peakHourRules || {}),
    notificationSettings: normalizeNotificationSettings(raw.notificationSettings || {}),
    automationSettings: normalizeAutomationSettings(raw.automationSettings || {}),
  };
}

export function loadCourtManagementSettings(clubId) {
  const data = loadClubData(clubId);
  return normalizeCourtManagementSettings(data.courtManagement || {});
}

export function saveCourtManagementSettings(clubId, settings) {
  const data = loadClubData(clubId);
  const current = normalizeCourtManagementSettings(data.courtManagement || {});
  data.courtManagement = normalizeCourtManagementSettings({
    ...current,
    ...settings,
    peakHourRules: settings.peakHourRules
      ? normalizePeakHourRules({ ...current.peakHourRules, ...settings.peakHourRules })
      : current.peakHourRules,
    notificationSettings: settings.notificationSettings
      ? normalizeNotificationSettings({
          ...current.notificationSettings,
          ...settings.notificationSettings,
        })
      : current.notificationSettings,
    automationSettings: settings.automationSettings
      ? normalizeAutomationSettings({
          ...current.automationSettings,
          ...settings.automationSettings,
        })
      : current.automationSettings,
  });
  return saveClubData(clubId, data).courtManagement;
}

export function buildRevenueCsv(summary) {
  const lines = [
    "Chỉ số,Giá trị",
    `Ngày,${summary.date || ""}`,
    `Tổng doanh thu dự kiến,${summary.expectedRevenue}`,
    `Đã thu,${summary.collected}`,
    `Còn nợ,${summary.debt}`,
    `Số booking,${summary.totalBookings}`,
    `Hoàn thành,${summary.completed}`,
    `Đang chơi,${summary.playing}`,
    `Hủy,${summary.cancelled}`,
    `No-show,${summary.noShow}`,
    "",
    "Doanh thu theo sân,",
  ];

  Object.entries(summary.byCourt || {}).forEach(([courtName, amount]) => {
    lines.push(`${courtName},${amount}`);
  });

  lines.push("", "Doanh thu theo loại booking,");
  Object.entries(summary.byType || {}).forEach(([type, amount]) => {
    lines.push(`${type},${amount}`);
  });

  return lines.join("\n");
}

export function buildBookingsCsv(bookings = []) {
  const lines = [
    "Mã,Tên khách,SĐT,Sân,Ngày,Bắt đầu,Kết thúc,Loại,Trạng thái,Thanh toán,Tổng tiền,Đã thu",
  ];

  bookings.forEach((booking) => {
    lines.push(
      [
        booking.bookingCode || "",
        booking.customerName || "",
        booking.customerPhone || "",
        booking.courtName || "",
        booking.date || "",
        booking.startTime || "",
        booking.endTime || "",
        booking.bookingType || "",
        booking.bookingStatus || "",
        booking.paymentStatus || "",
        booking.totalAmount || 0,
        booking.paidAmount || 0,
      ].join(",")
    );
  });

  return lines.join("\n");
}

export function buildUtilizationCsv(summary) {
  const lines = [
    "Chỉ số,Giá trị",
    `Từ ngày,${summary.fromDate}`,
    `Đến ngày,${summary.toDate}`,
    `Công suất tổng (%),${summary.utilizationPercent}`,
    `Phút đã book,${summary.bookedMinutes}`,
    `Phút khả dụng,${summary.availableMinutes}`,
    "",
    "Sân,Booking,Phút đã book,Phút khả dụng,Công suất (%)",
  ];

  (summary.byCourt || []).forEach((row) => {
    lines.push(
      `${row.courtName},${row.bookingCount},${row.bookedMinutes},${row.availableMinutes},${row.utilizationPercent}`
    );
  });

  return lines.join("\n");
}

export function buildRangeRevenueCsv(summary) {
  const lines = [
    "Chỉ số,Giá trị",
    `Từ ngày,${summary.fromDate}`,
    `Đến ngày,${summary.toDate}`,
    `Tổng doanh thu dự kiến,${summary.expectedRevenue}`,
    `Đã thu,${summary.collected}`,
    `Còn nợ,${summary.debt}`,
    `Số booking,${summary.totalBookings}`,
    "",
    "Chi tiết theo ngày,",
    "Ngày,Doanh thu dự kiến,Đã thu,Còn nợ,Booking",
  ];

  (summary.dailyBreakdown || []).forEach((day) => {
    lines.push(
      `${day.date},${day.expectedRevenue},${day.collected},${day.debt},${day.totalBookings}`
    );
  });

  lines.push("", "Doanh thu theo sân,");
  Object.entries(summary.byCourt || {}).forEach(([courtName, amount]) => {
    lines.push(`${courtName},${amount}`);
  });

  lines.push("", "Doanh thu theo loại booking,");
  Object.entries(summary.byType || {}).forEach(([type, amount]) => {
    lines.push(`${type},${amount}`);
  });

  return lines.join("\n");
}

export function downloadTextFile(filename, content) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
