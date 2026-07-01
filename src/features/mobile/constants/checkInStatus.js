export const CHECKIN_STATUS = Object.freeze({
  PENDING: "pending",
  CHECKED_IN: "checked_in",
  LATE: "late",
  INVALID: "invalid",
  DUPLICATE: "duplicate",
});

export const CHECKIN_STATUS_LABELS = Object.freeze({
  [CHECKIN_STATUS.PENDING]: "Chưa check-in",
  [CHECKIN_STATUS.CHECKED_IN]: "Đã check-in",
  [CHECKIN_STATUS.LATE]: "Đến muộn",
  [CHECKIN_STATUS.INVALID]: "Không hợp lệ",
  [CHECKIN_STATUS.DUPLICATE]: "Trùng QR",
});

export const CHECKIN_STATUS_COLORS = Object.freeze({
  [CHECKIN_STATUS.PENDING]: "default",
  [CHECKIN_STATUS.CHECKED_IN]: "success",
  [CHECKIN_STATUS.LATE]: "warning",
  [CHECKIN_STATUS.INVALID]: "error",
  [CHECKIN_STATUS.DUPLICATE]: "warning",
});

export const CHECKIN_SOURCE = Object.freeze({
  QR_SCAN: "qr_scan",
  MANUAL: "manual",
  OFFLINE_QUEUE: "offline_queue",
});
