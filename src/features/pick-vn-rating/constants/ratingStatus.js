export const RATING_STATUS = Object.freeze({
  UNRATED: "unrated",
  SELF_DECLARED: "self_declared",
  PROVISIONAL: "provisional",
  CLUB_VERIFIED: "club_verified",
  ADMIN_VERIFIED: "admin_verified",
  SYSTEM_VERIFIED: "system_verified",
  UNDER_REVIEW: "under_review",
  REJECTED: "rejected",
});

export const RATING_STATUS_LABELS = Object.freeze({
  [RATING_STATUS.UNRATED]: "Chưa đánh giá",
  [RATING_STATUS.SELF_DECLARED]: "Tự khai báo",
  [RATING_STATUS.PROVISIONAL]: "Tạm tính",
  [RATING_STATUS.CLUB_VERIFIED]: "CLB xác thực",
  [RATING_STATUS.ADMIN_VERIFIED]: "Admin xác thực",
  [RATING_STATUS.SYSTEM_VERIFIED]: "Hệ thống xác thực",
  [RATING_STATUS.UNDER_REVIEW]: "Đang xem xét",
  [RATING_STATUS.REJECTED]: "Từ chối",
});

export const VERIFIED_STATUSES = new Set([
  RATING_STATUS.CLUB_VERIFIED,
  RATING_STATUS.ADMIN_VERIFIED,
  RATING_STATUS.SYSTEM_VERIFIED,
]);

export function isValidRatingStatus(status) {
  return Object.values(RATING_STATUS).includes(status);
}

export function normalizeRatingStatus(status, fallback = RATING_STATUS.UNRATED) {
  return isValidRatingStatus(status) ? status : fallback;
}

export function isVerifiedRatingStatus(status) {
  return VERIFIED_STATUSES.has(status);
}
