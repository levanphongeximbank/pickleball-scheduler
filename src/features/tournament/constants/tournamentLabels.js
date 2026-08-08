/**
 * Vietnamese UI labels for canonical Tournament surfaces.
 * Internal enum values stay English; visible copy must not.
 */
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";

export const MODE_LABELS_VI = Object.freeze({
  [TOURNAMENT_MODE.DAILY_PLAY]: "Chơi hằng ngày",
  [TOURNAMENT_MODE.INTERNAL_TOURNAMENT]: "Giải nội bộ",
  [TOURNAMENT_MODE.OFFICIAL_TOURNAMENT]: "Giải chính thức / mở rộng",
  [TOURNAMENT_MODE.TEAM_TOURNAMENT]: "Giải đồng đội",
});

export const STATUS_LABELS_VI = Object.freeze({
  [TOURNAMENT_STATUS.DRAFT]: "Nháp",
  [TOURNAMENT_STATUS.REGISTRATION]: "Đang đăng ký",
  [TOURNAMENT_STATUS.READY]: "Sẵn sàng",
  [TOURNAMENT_STATUS.ACTIVE]: "Đang diễn ra",
  [TOURNAMENT_STATUS.COMPLETED]: "Đã kết thúc",
  [TOURNAMENT_STATUS.CANCELLED]: "Đã hủy",
});

export function modeLabelVi(mode) {
  return MODE_LABELS_VI[mode] || "Giải đấu";
}

export function statusLabelVi(status) {
  return STATUS_LABELS_VI[status] || String(status || "");
}
