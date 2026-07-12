import {
  DREAMBREAKER_STATUS,
  LINEUP_STATUS,
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
} from "../../../features/team-tournament/constants.js";

export const LINEUP_STATUS_META = {
  [LINEUP_STATUS.NOT_SUBMITTED]: { label: "Chưa nộp", color: "default" },
  [LINEUP_STATUS.DRAFT]: { label: "Nháp", color: "warning" },
  [LINEUP_STATUS.SUBMITTED]: { label: "Đã nộp", color: "info" },
  [LINEUP_STATUS.LOCKED]: { label: "Đã khóa", color: "secondary" },
  [LINEUP_STATUS.PUBLISHED]: { label: "Đã công bố", color: "success" },
};

export const MATCHUP_STATUS_META = {
  [MATCHUP_STATUS.SCHEDULED]: { label: "Đã lên lịch", color: "default" },
  [MATCHUP_STATUS.LINEUP_OPEN]: { label: "Mở nộp đội hình", color: "info" },
  [MATCHUP_STATUS.LOCKED]: { label: "Đã khóa đội hình", color: "warning" },
  [MATCHUP_STATUS.PUBLISHED]: { label: "Đã công bố", color: "success" },
  [MATCHUP_STATUS.IN_PROGRESS]: { label: "Đang thi đấu", color: "warning" },
  [MATCHUP_STATUS.COMPLETED]: { label: "Hoàn tất", color: "success" },
};

export const SUB_MATCH_STATUS_META = {
  [SUB_MATCH_STATUS.WAITING]: { label: "Chờ", color: "default" },
  [SUB_MATCH_STATUS.PLAYING]: { label: "Nháp", color: "warning" },
  [SUB_MATCH_STATUS.COMPLETED]: { label: "Xong", color: "success" },
  [SUB_MATCH_STATUS.FORFEIT]: { label: "Bỏ cuộc", color: "error" },
};

export const DREAMBREAKER_STATUS_META = {
  [DREAMBREAKER_STATUS.PENDING]: { label: "Chờ", color: "default" },
  [DREAMBREAKER_STATUS.LINEUP_OPEN]: { label: "Nộp thứ tự DB", color: "warning" },
  [DREAMBREAKER_STATUS.READY]: { label: "Sẵn sàng DB", color: "info" },
  [DREAMBREAKER_STATUS.IN_PROGRESS]: { label: "Dreambreaker", color: "secondary" },
  [DREAMBREAKER_STATUS.COMPLETED]: { label: "DB xong", color: "success" },
};

export const MLP_TIE_RESOLUTION_LEGEND =
  "3–1 hoặc 4–0: chốt tie • 2–2: vào Dreambreaker (đấu đơn luân lưu)";

export function getDreambreakerStatusMeta(status) {
  return (
    DREAMBREAKER_STATUS_META[status] || {
      label: status || "—",
      color: "default",
    }
  );
}

export function getLineupStatusMeta(status) {
  return LINEUP_STATUS_META[status] || LINEUP_STATUS_META[LINEUP_STATUS.NOT_SUBMITTED];
}

export function getMatchupStatusMeta(status) {
  return MATCHUP_STATUS_META[status] || { label: status || "—", color: "default" };
}

export function getSubMatchStatusMeta(status) {
  return SUB_MATCH_STATUS_META[status] || SUB_MATCH_STATUS_META[SUB_MATCH_STATUS.WAITING];
}

export function formatTeamTournamentDateTime(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCountdownTo(targetIso, now = new Date()) {
  if (!targetIso) {
    return null;
  }

  const nowMs = typeof now === "number" ? now : now.getTime();
  const diffMs = new Date(targetIso).getTime() - nowMs;
  if (diffMs <= 0) {
    return "Đã quá hạn";
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Còn ${days} ngày ${hours % 24} giờ`;
  }
  if (hours > 0) {
    return `Còn ${hours} giờ ${minutes} phút`;
  }
  return `Còn ${minutes} phút`;
}
