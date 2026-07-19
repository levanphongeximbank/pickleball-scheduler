import { isActiveBookingStatus } from "../models/booking.js";
import { loadBookingsForClub, saveBookingsForClub } from "./clubStorage.js";
import { loadCourtManagementSettings } from "./courtManagementSettings.js";
import { timeToMinutes } from "./courtBookingEngine.js";
import {
  absoluteToCivilDate,
  absoluteToCivilMinutes,
  resolveVenueTimezoneForClub,
} from "./civilTime.js";

const SKIP_BOOKING_TYPES = new Set(["maintenance", "tournament"]);

export function getUpcomingReminders(clubId, now = new Date(), options = {}) {
  const settings = loadCourtManagementSettings(clubId);
  const notificationSettings = settings.notificationSettings || {};

  if (!notificationSettings.enabled) {
    return [];
  }

  const tz = resolveVenueTimezoneForClub(clubId, options);
  if (!tz.ok) {
    // Fail closed: do not evaluate reminders against host timezone.
    return [];
  }

  const minutesBefore = notificationSettings.minutesBefore || 30;
  const bookings = loadBookingsForClub(clubId);
  const today = absoluteToCivilDate(now, tz.timezone);
  const nowMinutes = absoluteToCivilMinutes(now, tz.timezone);

  return bookings.filter((booking) => {
    if (!isActiveBookingStatus(booking.bookingStatus)) {
      return false;
    }

    if (booking.date !== today) {
      return false;
    }

    if (booking.reminderSentAt) {
      return false;
    }

    if (SKIP_BOOKING_TYPES.has(booking.bookingType)) {
      return false;
    }

    const startMinutes = timeToMinutes(booking.startTime);
    const diff = startMinutes - nowMinutes;

    return diff > 0 && diff <= minutesBefore;
  });
}

export function markReminderSent(bookingId, clubId) {
  const bookings = loadBookingsForClub(clubId);
  const now = new Date().toISOString();

  saveBookingsForClub(
    bookings.map((booking) =>
      booking.id === bookingId ? { ...booking, reminderSentAt: now, updatedAt: now } : booking
    ),
    clubId
  );
}

export function sendBrowserNotification(booking) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return false;
  }

  const courtLabel = booking.courtName || `Sân ${booking.courtId}`;
  new Notification("Nhắc booking sắp tới", {
    body: `${booking.customerName} · ${courtLabel} · ${booking.startTime}`,
  });

  return true;
}

export async function requestBrowserNotificationPermission() {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  return Notification.requestPermission();
}

export function processBookingReminders(clubId, now = new Date(), options = {}) {
  const settings = loadCourtManagementSettings(clubId);
  const notificationSettings = settings.notificationSettings || {};
  const reminders = getUpcomingReminders(clubId, now, options);

  reminders.forEach((booking) => {
    if (notificationSettings.browserNotify) {
      sendBrowserNotification(booking);
    }

    markReminderSent(booking.id, clubId);
  });

  return reminders;
}
