import { TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE } from "./design/tournamentDesignTokens.js";
import { FIXTURE_TOURNAMENT_ID } from "./fixtures/prototypeFixture.js";

export const PROTOTYPE_SCREEN_CATALOG = [
  { id: "01", heading: "Trung tâm giải đấu", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}` },
  { id: "02", heading: "Tổng quan giải đấu", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}` },
  { id: "03", heading: "Cài đặt Giải đấu / Nội dung", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/settings` },
  { id: "04", heading: "Đăng ký & Công bố", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/registration` },
  { id: "05", heading: "Người tham dự / Chốt danh sách", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/participants` },
  { id: "06", heading: "Hình thành cặp / đội", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/pairs` },
  { id: "07", heading: "Bốc thăm ghép cặp / đội", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/pair-draw` },
  { id: "08", heading: "Bốc thăm chia bảng", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/group-draw` },
  { id: "09", heading: "Vòng bảng", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/groups` },
  { id: "10", heading: "Lịch thi đấu & Phân sân", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/schedule` },
  { id: "11", heading: "Trung tâm trận đấu", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/matches` },
  { id: "12", heading: "Kết quả & Bảng xếp hạng", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/standings` },
  { id: "13", heading: "Vòng loại trực tiếp", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/knockout` },
  { id: "14", heading: "Sơ đồ nhánh đấu", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/bracket` },
  { id: "15", heading: "Điều hành giải", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/director` },
  { id: "16", heading: "Bảng điều hành sân", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/courts` },
  { id: "17", heading: "Bảng trọng tài", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/referees` },
  { id: "18", heading: "Trung tâm xử lý sự cố", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/exceptions` },
  { id: "19", heading: "Trung tâm thông báo", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/communications` },
  { id: "20", heading: "Trung tâm truyền thông & trình chiếu", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/media` },
  { id: "21", heading: "Kết quả chung cuộc & Giải thưởng", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/awards` },
  { id: "22", heading: "Hoàn tất giải đấu", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${FIXTURE_TOURNAMENT_ID}/complete` },
  { id: "23", heading: "Trang giải đấu công khai", path: `${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/public/${FIXTURE_TOURNAMENT_ID}` },
];
