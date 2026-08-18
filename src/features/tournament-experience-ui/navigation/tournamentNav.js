import { TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE } from "../design/tournamentDesignTokens.js";
import { FIXTURE_TOURNAMENT_ID } from "../fixtures/prototypeFixture.js";

export function tournamentPath(id = FIXTURE_TOURNAMENT_ID, suffix = "") {
  const base = `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${id}`;
  return suffix ? `${base}/${suffix}` : base;
}

export function publicTournamentPath(id = FIXTURE_TOURNAMENT_ID) {
  return `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/public/${id}`;
}

export const TOURNAMENT_NAV_ITEMS = [
  { id: "center", label: "Trung tâm", screen: "01", path: TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE, implemented: true },
  { id: "overview", label: "Tổng quan", screen: "02", suffix: "", implemented: true },
  { id: "settings", label: "Cài đặt", screen: "03", suffix: "settings", implemented: true },
  { id: "registration", label: "Đăng ký", screen: "04", suffix: "registration", implemented: true },
  { id: "participants", label: "Người tham dự", screen: "05", suffix: "participants", implemented: true },
  { id: "pairs", label: "Cặp / Đội", screen: "06", suffix: "pairs", implemented: true },
  { id: "pair-draw", label: "Bốc thăm ghép", screen: "07", suffix: "pair-draw", implemented: true },
  { id: "group-draw", label: "Bốc thăm chia bảng", screen: "08", suffix: "group-draw", implemented: true },
  { id: "groups", label: "Bảng đấu", screen: "09", suffix: "groups", implemented: true },
  { id: "schedule", label: "Lịch thi đấu", screen: "10", suffix: "schedule", implemented: true },
  { id: "matches", label: "Trận đấu", screen: "11", suffix: "matches", implemented: true },
  { id: "standings", label: "Kết quả & BXH", screen: "12", suffix: "standings", implemented: true },
  { id: "knockout", label: "Vòng loại", screen: "13", suffix: "knockout", implemented: true },
  { id: "bracket", label: "Nhánh đấu", screen: "14", suffix: "bracket", implemented: true },
  { id: "director", label: "Điều hành", screen: "15", suffix: "director", implemented: true },
  { id: "courts", label: "Sân", screen: "16", suffix: "courts", implemented: true },
  { id: "referees", label: "Trọng tài", screen: "17", suffix: "referees", implemented: true },
  { id: "exceptions", label: "Xử lý sự cố", screen: "18", suffix: "exceptions", implemented: true },
  { id: "communications", label: "Thông báo", screen: "19", suffix: "communications", implemented: true },
  { id: "media", label: "Truyền thông", screen: "20", suffix: "media", implemented: true },
  { id: "awards", label: "Giải thưởng", screen: "21", suffix: "awards", implemented: true },
  { id: "complete", label: "Hoàn tất", screen: "22", suffix: "complete", implemented: true },
];

export function resolveNavPath(item, tournamentId = FIXTURE_TOURNAMENT_ID) {
  if (item.id === "center") return item.path;
  return tournamentPath(tournamentId, item.suffix);
}
