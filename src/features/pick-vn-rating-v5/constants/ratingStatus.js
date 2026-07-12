/** V5 lifecycle statuses — distinct from legacy Phase 30 statuses. */
export const V5_RATING_STATUS = Object.freeze({
  NOT_ASSESSED: "not_assessed",
  SELF_ASSESSED: "self_assessed",
  PROVISIONAL: "provisional",
  PROJECTED: "projected",
  UNDER_REVIEW: "under_review",
  COURT_ASSESSED: "court_assessed",
  COACH_VERIFIED: "coach_verified",
  MATCH_CALIBRATED: "match_calibrated",
  VERIFIED: "verified",
  RELIABLE: "reliable",
  STABLE: "stable",
  OVERRIDDEN: "overridden",
  SUSPENDED: "suspended",
});

export const V5_RATING_STATUS_LABELS = Object.freeze({
  [V5_RATING_STATUS.NOT_ASSESSED]: "Chưa đánh giá",
  [V5_RATING_STATUS.SELF_ASSESSED]: "Tự đánh giá",
  [V5_RATING_STATUS.PROVISIONAL]: "Tạm tính",
  [V5_RATING_STATUS.PROJECTED]: "Dự kiến",
  [V5_RATING_STATUS.UNDER_REVIEW]: "Đang xem xét",
  [V5_RATING_STATUS.COURT_ASSESSED]: "Đã kiểm tra sân",
  [V5_RATING_STATUS.COACH_VERIFIED]: "HLV xác nhận",
  [V5_RATING_STATUS.MATCH_CALIBRATED]: "Đã hiệu chỉnh",
  [V5_RATING_STATUS.VERIFIED]: "Đã xác minh",
  [V5_RATING_STATUS.RELIABLE]: "Đáng tin cậy",
  [V5_RATING_STATUS.STABLE]: "Ổn định",
  [V5_RATING_STATUS.OVERRIDDEN]: "Ghi đè có kiểm soát",
  [V5_RATING_STATUS.SUSPENDED]: "Tạm ngưng",
});
