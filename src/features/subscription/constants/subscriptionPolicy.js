/** Số ngày sau hết hạn trước khi khóa tenant (past_due → expired). */
export const GRACE_PERIOD_DAYS = 3;

/** Nhắc thanh toán trước khi hết hạn (ngày). */
export const PAYMENT_REMINDER_DAYS = Object.freeze([7, 3, 1]);

/** Đường dẫn nâng cấp / gia hạn trong app. */
export const SUBSCRIPTION_SETTINGS_PATH = "/settings#tenant-subscription";
