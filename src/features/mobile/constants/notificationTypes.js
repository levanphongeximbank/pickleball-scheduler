export const NOTIFICATION_TYPES = Object.freeze({
  MATCH_UPCOMING: "match_upcoming",
  REFEREE_ASSIGNED: "referee_assigned",
  BOOKING_NEW: "booking_new",
  TOURNAMENT_SCHEDULE_CHANGE: "tournament_schedule_change",
  PAYMENT_REMINDER: "payment_reminder",
  CLUB_ANNOUNCEMENT: "club_announcement",
  CLUB_SCHEDULE: "club_schedule",
});

export const NOTIFICATION_TYPE_LABELS = Object.freeze({
  [NOTIFICATION_TYPES.MATCH_UPCOMING]: "Sắp đến giờ thi đấu",
  [NOTIFICATION_TYPES.REFEREE_ASSIGNED]: "Phân công trọng tài",
  [NOTIFICATION_TYPES.BOOKING_NEW]: "Booking mới",
  [NOTIFICATION_TYPES.TOURNAMENT_SCHEDULE_CHANGE]: "Thay đổi lịch giải",
  [NOTIFICATION_TYPES.PAYMENT_REMINDER]: "Nhắc thanh toán",
  [NOTIFICATION_TYPES.CLUB_ANNOUNCEMENT]: "Thông báo CLB",
  [NOTIFICATION_TYPES.CLUB_SCHEDULE]: "Lịch sinh hoạt CLB",
});

/** Default enabled types for new subscriptions. */
export const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  [NOTIFICATION_TYPES.MATCH_UPCOMING]: true,
  [NOTIFICATION_TYPES.REFEREE_ASSIGNED]: true,
  [NOTIFICATION_TYPES.BOOKING_NEW]: true,
  [NOTIFICATION_TYPES.TOURNAMENT_SCHEDULE_CHANGE]: true,
  [NOTIFICATION_TYPES.PAYMENT_REMINDER]: true,
  [NOTIFICATION_TYPES.CLUB_ANNOUNCEMENT]: true,
  [NOTIFICATION_TYPES.CLUB_SCHEDULE]: true,
});
