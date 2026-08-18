export const FIXTURE_TOURNAMENT_ID = "pick-vn-open-2026";

export const FIXTURE_TOURNAMENTS = [
  {
    id: FIXTURE_TOURNAMENT_ID,
    name: "PICK VN OPEN 2026",
    typeLabel: "Chính thức / Mở rộng",
    venue: "Cụm sân Nam Long",
    city: "TP.HCM",
    status: "ongoing",
    dates: "20–22/09/2026",
    location: "Cụm sân Nam Long • TP.HCM",
    athletes: 184,
    events: 5,
    matches: 268,
    completedMatches: 160,
    courts: 12,
    activeCourts: 11,
    type: "official",
  },
  {
    id: "nam-long-internal-cup",
    name: "Nam Long Internal Cup",
    typeLabel: "Nội bộ",
    venue: "Cụm sân Nam Long",
    city: "TP.HCM",
    status: "preparing",
    dates: "05–06/10/2026",
    location: "Cụm sân Nam Long",
    athletes: 96,
    events: 8,
    matches: 84,
    completedMatches: 0,
    courts: 8,
    activeCourts: 0,
    type: "internal",
  },
  {
    id: "team-cup-autumn",
    name: "Team Cup Autumn",
    typeLabel: "Giải đồng đội",
    venue: "Nhà thi đấu Phú Thọ",
    city: "TP.HCM",
    status: "registering",
    dates: "12–14/11/2026",
    location: "Nhà thi đấu Phú Thọ • TP.HCM",
    athletes: 128,
    events: 6,
    matches: 0,
    completedMatches: 0,
    courts: 10,
    activeCourts: 0,
    type: "team",
    teams: 32,
  },
];

export const FIXTURE_EVENTS = [
  { id: "md-35", name: "Đôi nam 3.5", pairs: 32, status: "ongoing", stage: "Vòng bảng", done: 57, total: 80, accent: "blue", category: "Đôi nam", level: "3.5", format: "Group + Knockout", scoring: "Rally 11, thắng cách 2" },
  { id: "md-40", name: "Đôi nam 4.0", pairs: 24, status: "ongoing", stage: "Tứ kết", done: 40, total: 56, accent: "purple", category: "Đôi nam", level: "4.0", format: "Knockout", scoring: "Rally 11, thắng cách 2" },
  { id: "wd-35", name: "Đôi nữ 3.5", pairs: 16, status: "soon", stage: "Chờ bốc thăm", done: 8, total: 28, accent: "pink", category: "Đôi nữ", level: "3.5", format: "Group + Knockout", scoring: "Rally 11, thắng cách 2" },
  { id: "mx-35", name: "Mixed 3.5", pairs: 20, status: "ongoing", stage: "Vòng bảng", done: 22, total: 48, accent: "orange", category: "Mixed", level: "3.5", format: "Group + Knockout", scoring: "Rally 11, thắng cách 2" },
  { id: "mx-open", name: "Mixed Open", pairs: 12, status: "soon", stage: "Đăng ký", done: 0, total: 22, accent: "green", category: "Mixed", level: "Open", format: "Knockout", scoring: "Rally 11, thắng cách 2" },
];

export const FIXTURE_LIVE_MATCHES = [
  {
    id: "A-18",
    event: "Đôi nam 3.5",
    stage: "Vòng bảng • Bảng A",
    court: "Sân 3",
    a: "Minh Quân / Hoàng Nam",
    b: "Tuấn Anh / Đình Phúc",
    score: "11-7, 8-11, 6-4",
  },
  {
    id: "QF2",
    event: "Đôi nam 4.0",
    stage: "Tứ kết",
    court: "Sân 1",
    a: "Thảo KV / Quốc Khánh",
    b: "Tiến Đạt / Văn Bình",
    score: "11-8, 7-6",
  },
  {
    id: "B-07",
    event: "Mixed 3.5",
    stage: "Vòng bảng • Bảng B",
    court: "Sân 5",
    a: "Diệu Linh / Mỹ Linh",
    b: "Lan Anh / Minh Trí",
    score: "6-4",
  },
];

/** Prototype presentation state only — not domain/backend authority. */
export const FIXTURE_REGISTRATION_PUBLICATION_STATUS = "PUBLISHED";

export const FIXTURE_REGISTRATIONS = [
  {
    id: "REG-00067",
    names: "Minh Quân / Hoàng Nam",
    phone: "0901 234 567",
    source: "Public link",
    status: "confirmed",
    payment: "paid",
    checkin: false,
    time: "12/09/2026 09:14",
  },
  {
    id: "REG-00066",
    names: "Tuấn Anh / Đình Phúc",
    phone: "0902 111 222",
    source: "BTC nhập",
    status: "confirmed",
    payment: "paid",
    checkin: true,
    time: "12/09/2026 08:40",
  },
  {
    id: "REG-00065",
    names: "Thảo KV / Quốc Khánh",
    phone: "0903 333 444",
    source: "Import",
    status: "pending",
    payment: "unpaid",
    checkin: false,
    time: "11/09/2026 21:02",
  },
  {
    id: "REG-00064",
    names: "Diệu Linh / Mỹ Linh",
    phone: "0904 555 666",
    source: "Public link",
    status: "waitlist",
    payment: "free",
    checkin: false,
    time: "11/09/2026 18:20",
  },
  {
    id: "REG-00063",
    names: "Tiến Đạt / Văn Bình",
    phone: "0905 777 888",
    source: "Public link",
    status: "missing",
    payment: "paid",
    checkin: false,
    time: "10/09/2026 14:05",
  },
  {
    id: "REG-00062",
    names: "Lan Anh / Minh Trí",
    phone: "0906 999 000",
    source: "BTC nhập",
    status: "confirmed",
    payment: "paid",
    checkin: false,
    time: "10/09/2026 11:48",
  },
];

export const FIXTURE_CENTER_STATS = {
  ongoing: { value: 8, trend: "+14%" },
  upcoming: { value: 12, trend: "+9%" },
  registering: { value: 6, trend: "+20%" },
  attention: { value: 4, trend: "-25%" },
};

export const FIXTURE_TASKS = [
  { label: "Duyệt đăng ký", count: 12, tone: "warning" },
  { label: "Xác nhận thanh toán", count: 5, tone: "warning" },
  { label: "Thiếu thông tin VĐV", count: 3, tone: "danger" },
  { label: "Phân công trọng tài", count: 2, tone: "info" },
];

export const FIXTURE_ACTIVITY = [
  { time: "10:45", text: "Sân 1 — trận A-18 bắt đầu", tone: "live" },
  { time: "10:32", text: "PICK VN OPEN 2026 — thêm Mixed Open", tone: "info" },
  { time: "10:18", text: "Đã duyệt 3 hồ sơ Đôi nam 3.5", tone: "success" },
];

export const FIXTURE_OVERVIEW_ATTENTION = [
  { label: "2 trận thiếu trọng tài", tone: "danger" },
  { label: "Sân 4 tạm ngừng", tone: "warning" },
  { label: "1 VĐV chấn thương", tone: "warning" },
];

export const FIXTURE_NOTIFICATIONS = [
  { time: "09:40", text: "Lịch 21/09 đã cập nhật" },
  { time: "09:12", text: "Trận #105 đổi sân" },
];

export const FIXTURE_LIFECYCLE = [
  { label: "Cấu hình", state: "done", meta: "Đã khóa" },
  { label: "Đăng ký", state: "done", meta: "Đã đóng" },
  { label: "Bốc thăm", state: "done", meta: "Đã công bố" },
  { label: "Thi đấu", state: "current", meta: "Ngày 1 / 3" },
  { label: "Kết quả", state: "pending", meta: "Chưa mở" },
];

export const FIXTURE_OPS = {
  playing: 6,
  waiting: 8,
  late: 2,
  completedToday: 43,
};

export function getFixtureTournament(id = FIXTURE_TOURNAMENT_ID) {
  return FIXTURE_TOURNAMENTS.find((item) => item.id === id) || FIXTURE_TOURNAMENTS[0];
}
