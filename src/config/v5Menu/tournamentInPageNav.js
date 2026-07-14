/**
 * Điều hướng trong màn hình — Giải đấu (không hiển thị trên sidebar).
 * @see docs/v5/V5_SIDEBAR_NAV_IMPLEMENTATION.md
 */
import { PERMISSIONS } from "../../auth/permissions.js";
import { TOURNAMENT_ROUTES } from "../tournamentRoutes.js";
import { FEATURE_STATUS } from "./menuBuilders.js";

const VIEW = [PERMISSIONS.TOURNAMENT_VIEW];
/** Chỉ role có quyền sửa giải — `.some()` trên VIEW sẽ lộ mục cho đội trưởng. */
const MANAGE = [PERMISSIONS.TOURNAMENT_UPDATE];
const STATS = [PERMISSIONS.STATISTICS_VIEW];
const SCHED = [PERMISSIONS.SCHEDULING_RUN, PERMISSIONS.TOURNAMENT_UPDATE];
const DIRECTOR = [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.TOURNAMENT_VIEW];
const REFEREE = [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.MATCH_UPDATE];

function leaf(key, text, path, extra = {}) {
  return { key, text, path, permissions: VIEW, featureStatus: FEATURE_STATUS.LIVE, ...extra };
}

function individualEvent(key, text) {
  return leaf(key, text, `${TOURNAMENT_ROUTES.typeIndividual}?event=${key}`, {
    featureStatus: FEATURE_STATUS.LIVE,
    featureNote: "Preselect loại nội dung khi tạo giải",
  });
}

function teamPreset(key, text) {
  return leaf(key, text, `${TOURNAMENT_ROUTES.teamPresets}?type=${key}`, {
    featureStatus: FEATURE_STATUS.LIVE,
  });
}

export const TOURNAMENT_IN_PAGE_NAV = Object.freeze({
  types: {
    hubKey: "tournament-types-hub",
    title: "Loại giải",
    description:
      "Chọn thể thức cá nhân/đôi hoặc đồng đội. Chi tiết nằm trong từng thẻ — không hiển thị trên sidebar.",
    sections: [
      {
        id: "individual",
        label: "Giải cá nhân",
        items: [
          individualEvent("men_single", "Đơn nam"),
          individualEvent("women_single", "Đơn nữ"),
          individualEvent("men_double", "Đôi nam"),
          individualEvent("women_double", "Đôi nữ"),
          individualEvent("mixed_double", "Đôi nam nữ"),
          individualEvent("open_double", "Đôi tự do"),
        ],
      },
      {
        id: "team-preset",
        label: "Đội có sẵn",
        items: [
          teamPreset("club", "CLB"),
          teamPreset("enterprise", "Doanh nghiệp"),
          teamPreset("school", "Trường học"),
          teamPreset("guest", "Đội khách mời"),
        ],
      },
      {
        id: "team-build",
        label: "Đội tạo trong giải",
        items: [
          leaf("tournament-team-manual", "Chia thủ công", TOURNAMENT_ROUTES.teamBuildManual, {
            permissions: MANAGE,
          }),
          leaf("tournament-team-random", "Bốc thăm tự động", TOURNAMENT_ROUTES.teamBuildRandom, {
            permissions: MANAGE,
            featureStatus: FEATURE_STATUS.LIVE,
          }),
          leaf("tournament-team-draft", "Chọn đội theo lượt", TOURNAMENT_ROUTES.teamBuildDraft, {
            permissions: MANAGE,
            featureStatus: FEATURE_STATUS.LIVE,
          }),
        ],
      },
    ],
  },
  roster: {
    hubKey: "tournament-roster-hub",
    title: "Vận động viên / Đội",
    description: "Đăng ký, danh sách và quản lý đội trong giải đã chọn.",
    sections: [
      {
        id: "roster",
        label: "Danh sách & đăng ký",
        items: [
          leaf("tournament-register", "Đăng ký VĐV", TOURNAMENT_ROUTES.register, {
            permissions: MANAGE,
          }),
          leaf("tournament-player-portal", "Cổng VĐV (Individual)", TOURNAMENT_ROUTES.playerPortal, {
            featureStatus: FEATURE_STATUS.LIVE,
          }),
          leaf("tournament-athlete-list", "Danh sách VĐV", TOURNAMENT_ROUTES.register, {
            featureStatus: FEATURE_STATUS.LIVE,
          }),
          leaf("tournament-team-list", "Danh sách đội", TOURNAMENT_ROUTES.teams),
          leaf("tournament-team-preset", "Đội có sẵn", TOURNAMENT_ROUTES.teamPresets),
          leaf("tournament-team-build-hub", "Đội tạo trong giải", TOURNAMENT_ROUTES.teamBuildManual, {
            permissions: MANAGE,
          }),
          leaf("tournament-eligibility", "Kiểm tra điều kiện tham gia", TOURNAMENT_ROUTES.eligibility, {
            permissions: MANAGE,
          }),
          leaf("tournament-entry-fee", "Lệ phí tham gia", TOURNAMENT_ROUTES.entryFee, {
            permissions: MANAGE,
          }),
        ],
      },
    ],
  },
  organize: {
    hubKey: "tournament-organize-hub",
    title: "Tổ chức thi đấu",
    description: "Ghép cặp, chia bảng, lịch và điều phối sân. Dùng «Bắt đầu trình chiếu» trên trang setup giải để chạy liên tục.",
    sections: [
      {
        id: "organize",
        label: "Chuẩn bị thi đấu",
        items: [
          leaf("tournament-pairing", "Ghép cặp", TOURNAMENT_ROUTES.pairing, { permissions: SCHED }),
          leaf("tournament-seeding", "Xếp hạt giống", TOURNAMENT_ROUTES.draw, {
            permissions: MANAGE,
            featureStatus: FEATURE_STATUS.LIVE,
          }),
          leaf("tournament-draw", "Chia bảng", TOURNAMENT_ROUTES.draw),
          leaf("tournament-schedule", "Lịch thi đấu", TOURNAMENT_ROUTES.schedule, {
            permissions: DIRECTOR,
          }),
          leaf("bracket", "Sơ đồ thi đấu", TOURNAMENT_ROUTES.bracket),
          leaf("tournament-director", "Điều phối sân", TOURNAMENT_ROUTES.director, {
            permissions: DIRECTOR,
          }),
          leaf("tournament-time-estimate", "Dự kiến thời gian", "/tournament?ai=time", {
            featureStatus: FEATURE_STATUS.LIVE,
            requiresFeature: "ai",
          }),
          leaf("tournament-publish-schedule", "Công bố lịch", TOURNAMENT_ROUTES.publishSchedule, {
            permissions: MANAGE,
          }),
        ],
      },
    ],
  },
  operations: {
    hubKey: "tournament-operations-hub",
    title: "Điều hành",
    description: "Trọng tài, nhập kết quả và xử lý phát sinh trong giải.",
    sections: [
      {
        id: "operations",
        label: "Vận hành trận đấu",
        items: [
          leaf("referee", "Trọng tài", TOURNAMENT_ROUTES.referee, { permissions: REFEREE }),
          leaf("tournament-referee-assign", "Phân công trọng tài", TOURNAMENT_ROUTES.refereeAssign, {
            permissions: MANAGE,
          }),
          leaf("tournament-score-entry", "Nhập kết quả", TOURNAMENT_ROUTES.scoreEntry, {
            permissions: REFEREE,
          }),
          leaf("tournament-match-report", "Biên bản trận đấu", TOURNAMENT_ROUTES.matchReports),
          leaf("tournament-reschedule", "Thay đổi lịch", TOURNAMENT_ROUTES.schedule, {
            permissions: MANAGE,
            featureStatus: FEATURE_STATUS.LIVE,
          }),
          leaf("tournament-court-change", "Thay đổi sân", TOURNAMENT_ROUTES.director, {
            permissions: DIRECTOR,
            featureStatus: FEATURE_STATUS.LIVE,
          }),
          leaf("tournament-withdrawal", "Xử lý rút lui / bỏ cuộc", TOURNAMENT_ROUTES.withdrawal, {
            permissions: MANAGE,
          }),
          leaf("tournament-adjustment-log", "Nhật ký điều chỉnh", TOURNAMENT_ROUTES.matchReports, {
            featureStatus: FEATURE_STATUS.LIVE,
          }),
        ],
      },
    ],
  },
  results: {
    hubKey: "tournament-results-hub",
    title: "Kết quả",
    description: "Bảng điểm, xếp hạng và xuất kết quả.",
    sections: [
      {
        id: "results",
        label: "Thành tích",
        items: [
          leaf("tournament-scoreboard", "Bảng điểm", TOURNAMENT_ROUTES.resultsScoreboard, {
            permissions: STATS,
          }),
          leaf("tournament-rankings", "Xếp hạng", TOURNAMENT_ROUTES.resultsRankings, {
            permissions: STATS,
          }),
          leaf("tournament-player-stats", "Thành tích VĐV", TOURNAMENT_ROUTES.resultsPlayers, {
            permissions: STATS,
          }),
          leaf("tournament-team-results", "Thành tích đội", TOURNAMENT_ROUTES.teams, {
            permissions: STATS,
            featureStatus: FEATURE_STATUS.LIVE,
          }),
          leaf("tournament-awards", "Trao giải", TOURNAMENT_ROUTES.awards, {
            permissions: MANAGE,
          }),
          leaf("tournament-export-results", "Xuất kết quả", "/statistics", {
            permissions: STATS,
            featureStatus: FEATURE_STATUS.LIVE,
          }),
        ],
      },
    ],
  },
  config: {
    hubKey: "tournament-config-hub",
    title: "Cấu hình giải",
    description: "Thể thức, luật và điều kiện tham gia.",
    sections: [
      {
        id: "config",
        label: "Thiết lập",
        items: [
          leaf("tournament-format", "Thể thức thi đấu", TOURNAMENT_ROUTES.configFormat, {
            permissions: MANAGE,
          }),
          leaf("tournament-scoring-rules", "Luật tính điểm", TOURNAMENT_ROUTES.configScoring, {
            permissions: MANAGE,
            featureStatus: FEATURE_STATUS.LIVE,
          }),
          leaf("tournament-skill-tiers", "Hạng trình độ", TOURNAMENT_ROUTES.configSkill, {
            permissions: MANAGE,
            featureStatus: FEATURE_STATUS.LIVE,
          }),
          leaf("tournament-age-rules", "Độ tuổi", TOURNAMENT_ROUTES.configAgeRules, {
            permissions: MANAGE,
          }),
          leaf("tournament-gender-rules", "Giới tính", TOURNAMENT_ROUTES.configGenderRules, {
            permissions: MANAGE,
          }),
          leaf("tournament-fee-config", "Lệ phí tham gia", TOURNAMENT_ROUTES.configFee, {
            permissions: MANAGE,
          }),
          leaf("tournament-regulations-template", "Mẫu điều lệ", TOURNAMENT_ROUTES.configRegulations, {
            permissions: MANAGE,
          }),
          leaf("tournament-settings", "Cài đặt giải", TOURNAMENT_ROUTES.configSettings, {
            permissions: MANAGE,
          }),
        ],
      },
    ],
  },
});

/** Thu thập nhãn tất cả mục in-page (cho audit / test). */
export function collectTournamentInPageLabels() {
  const labels = [];
  for (const hub of Object.values(TOURNAMENT_IN_PAGE_NAV)) {
    for (const section of hub.sections) {
      for (const item of section.items) {
        labels.push(item.text);
      }
    }
  }
  return labels;
}
