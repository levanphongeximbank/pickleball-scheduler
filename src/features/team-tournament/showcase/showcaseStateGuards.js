/**
 * P1.5A Showcase — explicit stage transition guards.
 */

import { SHOWCASE_MODE, SHOWCASE_STAGE } from "./showcaseConstants.js";

const ORDERED_STAGES = [
  SHOWCASE_STAGE.SETUP,
  SHOWCASE_STAGE.TEAM_GENERATING,
  SHOWCASE_STAGE.TEAM_PREVIEW,
  SHOWCASE_STAGE.PREFLIGHT,
  SHOWCASE_STAGE.COUNTDOWN,
  SHOWCASE_STAGE.PROCESSING,
  SHOWCASE_STAGE.TEAM_REVEAL,
  SHOWCASE_STAGE.CAPTAIN_REVEAL,
  SHOWCASE_STAGE.GROUP_SETUP,
  SHOWCASE_STAGE.GROUP_GENERATING,
  SHOWCASE_STAGE.GROUP_PREVIEW,
  SHOWCASE_STAGE.GROUP_FORMAT,
  SHOWCASE_STAGE.GROUP_REVEAL,
  SHOWCASE_STAGE.FINAL_REVIEW,
  SHOWCASE_STAGE.SAVING,
  SHOWCASE_STAGE.RESULTS,
  SHOWCASE_STAGE.COMPLETED,
  SHOWCASE_STAGE.REPLAY,
];

/**
 * @param {object} state
 * @param {string} nextStage
 * @param {{ session?: object|null, mode?: string }} context
 */
export function canTransitionShowcaseStage(state, nextStage, context = {}) {
  const mode = context.mode || state?.mode || SHOWCASE_MODE.LIVE;
  const session = context.session ?? state?.session ?? null;
  const current = state?.stage || SHOWCASE_STAGE.IDLE;

  if (mode === SHOWCASE_MODE.REPLAY) {
    if (
      [
        SHOWCASE_STAGE.SAVING,
        SHOWCASE_STAGE.TEAM_GENERATING,
        SHOWCASE_STAGE.GROUP_GENERATING,
      ].includes(nextStage)
    ) {
      return { ok: false, reason: "Replay không được ghi hoặc tái sinh kết quả." };
    }
    if (!session?.teamCards?.length && nextStage !== SHOWCASE_STAGE.SETUP) {
      return { ok: false, reason: "Replay thiếu dữ liệu đội đã lưu." };
    }
    return { ok: true };
  }

  switch (nextStage) {
    case SHOWCASE_STAGE.TEAM_PREVIEW:
    case SHOWCASE_STAGE.COUNTDOWN:
    case SHOWCASE_STAGE.PROCESSING:
    case SHOWCASE_STAGE.TEAM_REVEAL:
      if (!session?.teamCards?.length) {
        return { ok: false, reason: "Chưa AI ghép đội." };
      }
      break;
    case SHOWCASE_STAGE.GROUP_SETUP:
    case SHOWCASE_STAGE.GROUP_GENERATING:
    case SHOWCASE_STAGE.GROUP_PREVIEW:
    case SHOWCASE_STAGE.GROUP_FORMAT:
      if (!session?.teamCards?.length) {
        return { ok: false, reason: "Chưa có đội — không thể chia bảng." };
      }
      break;
    case SHOWCASE_STAGE.GROUP_REVEAL:
    case SHOWCASE_STAGE.FINAL_REVIEW:
      if (!session?.teamCards?.length) {
        return { ok: false, reason: "Chưa có đội — không thể chia bảng." };
      }
      if (!session?.groupSession?.groupCards?.length) {
        return { ok: false, reason: "Chưa tạo preview bảng." };
      }
      break;
    case SHOWCASE_STAGE.SAVING:
      if (!session?.teamCards?.length || !session?.groupSession?.groupCards?.length) {
        return { ok: false, reason: "Thiếu đội hoặc bảng trước khi lưu." };
      }
      break;
    default:
      break;
  }

  if (current === SHOWCASE_STAGE.SAVING && nextStage !== SHOWCASE_STAGE.RESULTS) {
    return { ok: false, reason: "Đang lưu — không chuyển stage khác." };
  }

  if (!ORDERED_STAGES.includes(nextStage) && nextStage !== SHOWCASE_STAGE.IDLE) {
    return { ok: false, reason: `Stage không hợp lệ: ${nextStage}` };
  }

  return { ok: true };
}

export function showcaseStageLabel(stage) {
  const labels = {
    [SHOWCASE_STAGE.SETUP]: "Thiết lập",
    [SHOWCASE_STAGE.TEAM_GENERATING]: "Đang ghép đội",
    [SHOWCASE_STAGE.TEAM_PREVIEW]: "Xem trước đội",
    [SHOWCASE_STAGE.COUNTDOWN]: "Đếm ngược",
    [SHOWCASE_STAGE.PROCESSING]: "Đang xử lý",
    [SHOWCASE_STAGE.TEAM_REVEAL]: "Công bố đội",
    [SHOWCASE_STAGE.CAPTAIN_REVEAL]: "Công bố đội trưởng",
    [SHOWCASE_STAGE.GROUP_SETUP]: "Thiết lập chia bảng",
    [SHOWCASE_STAGE.GROUP_GENERATING]: "Đang chia bảng",
    [SHOWCASE_STAGE.GROUP_PREVIEW]: "Xem trước bảng",
    [SHOWCASE_STAGE.GROUP_FORMAT]: "Chọn kiểu bảng",
    [SHOWCASE_STAGE.GROUP_REVEAL]: "Công bố bảng",
    [SHOWCASE_STAGE.FINAL_REVIEW]: "Xác nhận cuối",
    [SHOWCASE_STAGE.SAVING]: "Đang lưu",
    [SHOWCASE_STAGE.RESULTS]: "Kết quả",
    [SHOWCASE_STAGE.COMPLETED]: "Hoàn tất",
    [SHOWCASE_STAGE.REPLAY]: "Xem lại",
  };
  return labels[stage] || stage;
}
