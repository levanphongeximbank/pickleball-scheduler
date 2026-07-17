/**
 * P1.5A Showcase — stage constants and copy.
 * Presentation layer only; no engine or persistence authority.
 */

export const SHOWCASE_STAGE = Object.freeze({
  IDLE: "idle",
  SETUP: "setup",
  TEAM_GENERATING: "team_generating",
  TEAM_PREVIEW: "team_preview",
  PREFLIGHT: "preflight",
  COUNTDOWN: "countdown",
  PROCESSING: "processing",
  TEAM_REVEAL: "team_reveal",
  CAPTAIN_REVEAL: "captain_reveal",
  GROUP_SETUP: "group_setup",
  GROUP_GENERATING: "group_generating",
  GROUP_PREVIEW: "group_preview",
  GROUP_FORMAT: "group_format",
  GROUP_REVEAL: "group_reveal",
  FINAL_REVIEW: "final_review",
  SAVING: "saving",
  RESULTS: "results",
  COMPLETED: "completed",
  REPLAY: "replay",
});

export const SHOWCASE_MODE = Object.freeze({
  LIVE: "live",
  REPLAY: "replay",
});

export const PROCESSING_STAGES = Object.freeze([
  "Đang kiểm tra danh sách vận động viên",
  "Đang xác nhận giới tính và trình độ",
  "Đang áp dụng quy tắc bắt buộc",
  "Đang cân bằng trình độ giữa các đội",
  "Đang hoàn tất kết quả",
]);

export const SHOWCASE_COPY = Object.freeze({
  setupTitle: "Thiết lập lễ bốc thăm",
  start: "Bắt đầu lễ bốc thăm",
  generateTeams: "AI ghép đội",
  regenerateTeams: "Ghép lại đội",
  previewTeams: "Xem trước đội",
  startTeamReveal: "Bắt đầu công bố đội",
  previewGroups: "Xem trước bảng",
  startGroupReveal: "Bắt đầu công bố bảng",
  generateMatchups: "Tạo cặp đấu",
  previewMatchups: "Xem trước cặp đấu",
  confirmMatchups: "Xác nhận lưu cặp đấu",
  continueMatchups: "Tiếp tục thiết lập cặp đấu",
  saveDraftContinue: "Lưu giải và làm tiếp sau",
  replay: "Xem lại lễ bốc thăm",
  projectorOn: "Chế độ trình chiếu",
  projectorOff: "Thoát trình chiếu",
  countdownTitle: "Lễ bốc thăm sẽ bắt đầu",
  continueGroups: "Tiếp tục chia bảng",
  complete: "Lễ bốc thăm hoàn tất",
  replayBadge: "Chế độ xem lại",
  missingCaptain: "Chưa chỉ định đội trưởng",
  backEdit: "Quay lại chỉnh sửa",
  back: "Quay lại",
  confirmSave: "Xác nhận và lưu",
  cancelUnsaved: "Hủy kết quả chưa lưu",
});

/** Default requested MLP team count for showcase (TT32 / 8 teams). */
export const SHOWCASE_DEFAULT_TEAM_COUNT = 8;

export const SHOWCASE_COUNTDOWN_SECONDS = 10;

/** Full-screen reveal pacing: ~2.8s per athlete/team, faster when reduced motion. */
export const SHOWCASE_REVEAL_STEP_MS = 2800;
export const SHOWCASE_REVEAL_STEP_MS_REDUCED = 120;
