import { NOTIFICATION_EVENT_TYPES } from "../constants/notificationEvents.js";

/**
 * Vietnamese presentation mapping: eventType → title/message.
 * Domain modules should pass structured payload fields, not full bodies.
 */

function pick(payload, keys, fallback = null) {
  for (const key of keys) {
    if (payload?.[key] !== undefined && payload?.[key] !== null && payload?.[key] !== "") {
      return String(payload[key]);
    }
  }
  return fallback;
}

const BUILDERS = Object.freeze({
  [NOTIFICATION_EVENT_TYPES.CLUB_SCHEDULE_UPDATED]: (payload) => ({
    title: pick(payload, ["title"], "Cập nhật lịch CLB"),
    message: pick(
      payload,
      ["message", "body"],
      "Lịch sinh hoạt câu lạc bộ đã được cập nhật."
    ),
  }),
  [NOTIFICATION_EVENT_TYPES.BOOKING_CREATED]: (payload) => {
    const court = pick(payload, ["courtName", "courtLabel"], "sân");
    const start = pick(payload, ["startTime"], "");
    const customer = pick(payload, ["customerName"], "Khách");
    return {
      title: "Booking mới",
      message: start
        ? `${customer} đã đặt ${court} lúc ${start}.`
        : `${customer} đã tạo booking mới (${court}).`,
    };
  },
  [NOTIFICATION_EVENT_TYPES.BOOKING_CANCELLED]: (payload) => {
    const court = pick(payload, ["courtName", "courtLabel"], "sân");
    const start = pick(payload, ["startTime"], "");
    return {
      title: "Booking đã hủy",
      message: start
        ? `Booking ${court} lúc ${start} đã bị hủy.`
        : `Booking trên ${court} đã bị hủy.`,
    };
  },
  [NOTIFICATION_EVENT_TYPES.PAYMENT_CONFIRMED]: (payload) => {
    const amount = pick(payload, ["amountLabel", "amount"], null);
    return {
      title: "Thanh toán thành công",
      message: amount
        ? `Giao dịch ${amount} đã được xác nhận.`
        : "Thanh toán của bạn đã được xác nhận.",
    };
  },
  [NOTIFICATION_EVENT_TYPES.PAYMENT_FAILED]: (payload) => {
    const reason = pick(payload, ["reason", "error"], null);
    return {
      title: "Thanh toán thất bại",
      message: reason
        ? `Thanh toán không thành công: ${reason}`
        : "Thanh toán không thành công. Vui lòng thử lại.",
    };
  },
  [NOTIFICATION_EVENT_TYPES.MATCH_SCHEDULED]: (payload) => {
    const matchLabel = pick(payload, ["matchLabel", "matchId"], "trận đấu");
    const when = pick(payload, ["scheduledAtLabel", "scheduledAt"], null);
    const court = pick(payload, ["courtLabel", "courtName"], null);
    const parts = [`${matchLabel} đã được xếp lịch`];
    if (when) parts.push(`lúc ${when}`);
    if (court) parts.push(`tại ${court}`);
    return {
      title: "Lịch trận đã xếp",
      message: `${parts.join(" ")}.`,
    };
  },
});

/**
 * @param {string} eventType
 * @param {Record<string, unknown>} payload
 * @returns {{ ok: true, title: string, message: string } | { ok: false, error: string }}
 */
export function renderNotificationContent(eventType, payload = {}) {
  const builder = BUILDERS[eventType];
  if (!builder) {
    const title = pick(payload, ["title"], null);
    const message = pick(payload, ["message", "body"], null);
    if (!title || !message) {
      return {
        ok: false,
        error: `No presentation mapping for eventType ${eventType} and payload lacks title/message.`,
      };
    }
    return { ok: true, title, message };
  }

  const rendered = builder(payload || {});
  if (!rendered.title || !rendered.message) {
    return {
      ok: false,
      error: `Presentation for ${eventType} produced empty title/message.`,
    };
  }
  return { ok: true, title: rendered.title, message: rendered.message };
}
