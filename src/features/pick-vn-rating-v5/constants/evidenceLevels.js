/** Evidence hierarchy — higher level may influence verified track only at 4–5. */
export const EVIDENCE_LEVEL = Object.freeze({
  NONE: 0,
  SELF_ASSESSMENT: 1,
  UNVERIFIED_EXTERNAL: 2,
  PLAYER_CONFIRMED: 3,
  CLUB_COACH_COURT: 4,
  PICK_VN_VERIFIED: 5,
});

export const EVIDENCE_LEVEL_LABELS = Object.freeze({
  [EVIDENCE_LEVEL.NONE]: "Chưa có dữ liệu",
  [EVIDENCE_LEVEL.SELF_ASSESSMENT]: "Tự đánh giá",
  [EVIDENCE_LEVEL.UNVERIFIED_EXTERNAL]: "Chưa xác minh",
  [EVIDENCE_LEVEL.PLAYER_CONFIRMED]: "Người chơi xác nhận",
  [EVIDENCE_LEVEL.CLUB_COACH_COURT]: "CLB / HLV / sân",
  [EVIDENCE_LEVEL.PICK_VN_VERIFIED]: "Pick_VN xác thực",
});

export const VERIFIED_EVIDENCE_MIN_LEVEL = EVIDENCE_LEVEL.CLUB_COACH_COURT;

export function isVerifiedEvidenceLevel(level) {
  return Number(level) >= VERIFIED_EVIDENCE_MIN_LEVEL;
}
