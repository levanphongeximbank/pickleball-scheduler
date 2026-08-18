/** Prototype-only operational fixtures. Not domain/backend authority. */

export { FIXTURE_OPS } from "./prototypeFixture.js";

export const FIXTURE_PUBLIC_REGISTRATION_STATE = "CLOSED";

export const FIXTURE_FORMAT_STEPS = [
  { id: "pairs", label: "32 cặp", vi: "32 cặp" },
  { id: "groups", label: "4 bảng × 8", vi: "4 bảng × 8" },
  { id: "top4", label: "Top 4", vi: "Top 4 vào KO" },
  { id: "r16", label: "Vòng 16", vi: "Vòng 16" },
  { id: "qf", label: "Tứ kết", vi: "Tứ kết" },
  { id: "sf", label: "Bán kết", vi: "Bán kết" },
  { id: "final", label: "Chung kết", vi: "Chung kết" },
];

export const FIXTURE_SETTINGS_RULES = [
  { title: "Cách tính điểm", detail: "Rally 11 điểm, thắng cách 2. Trận 2/3 set." },
  { title: "Thời gian trận", detail: "Không giới hạn giờ. Time-out 1 lần / set, 60 giây." },
  { title: "Hạt giống", detail: "8 hạt giống. Hạt 1–2 không chung bảng. Chỉ dữ liệu mẫu." },
  { title: "Vào vòng trong", detail: "Top 4 mỗi bảng vào Vòng 16." },
  { title: "Vắng mặt / bỏ cuộc", detail: "Vắng mặt 10 phút sau giờ gọi sân = thua cuộc." },
];

export const FIXTURE_SETTINGS_FEES = [
  { item: "Lệ phí / cặp", value: "400.000đ", note: "Đôi nam 3.5 / 4.0, Mixed" },
  { item: "Lệ phí / cặp Open", value: "500.000đ", note: "Mixed Open" },
  { item: "Vô địch", value: "Cúp + 5.000.000đ", note: "Mỗi nội dung" },
  { item: "Á quân", value: "Huy chương + 2.500.000đ", note: "Mỗi nội dung" },
  { item: "Hạng ba", value: "Huy chương + 1.000.000đ", note: "Mỗi nội dung" },
];

export const FIXTURE_SETTINGS_SCHEDULE = [
  { day: "Ngày 1 — 20/09", blocks: ["07:30 Check-in", "08:30 Vòng bảng buổi sáng", "13:30 Vòng bảng buổi chiều"] },
  { day: "Ngày 2 — 21/09", blocks: ["08:00 Hoàn tất vòng bảng", "11:00 Vòng 16", "15:00 Tứ kết"] },
  { day: "Ngày 3 — 22/09", blocks: ["09:00 Bán kết", "14:00 Chung kết", "16:30 Lễ trao giải"] },
];

export const FIXTURE_PARTICIPANTS = [
  { id: "P-01", names: "Minh Quân / Hoàng Nam", payment: "paid", profile: "complete", checkin: true, eligible: true, issue: null },
  { id: "P-02", names: "Tuấn Anh / Đình Phúc", payment: "paid", profile: "complete", checkin: true, eligible: true, issue: null },
  { id: "P-03", names: "Thảo KV / Quốc Khánh", payment: "unpaid", profile: "complete", checkin: false, eligible: false, issue: "Chưa thanh toán" },
  { id: "P-04", names: "Diệu Linh / Mỹ Linh", payment: "paid", profile: "incomplete", checkin: false, eligible: false, issue: "Thiếu CCCD" },
  { id: "P-05", names: "Tiến Đạt / Văn Bình", payment: "paid", profile: "complete", checkin: false, eligible: true, issue: null },
  { id: "P-06", names: "Lan Anh / Minh Trí", payment: "paid", profile: "complete", checkin: true, eligible: true, issue: null },
];

export const FIXTURE_UNPAIRED = ["Ngọc Hà", "Quốc Việt", "Bảo Châu"];

export const FIXTURE_FORMATION_PARTICIPANTS = [
  { id: "U-01", name: "Ngọc Hà", rating: 3.42, club: "Nam Long", seed: 12, status: "Chưa ghép" },
  { id: "U-02", name: "Quốc Việt", rating: 3.38, club: "Phú Nhuận", seed: 15, status: "Chưa ghép" },
  { id: "U-03", name: "Bảo Châu", rating: 3.51, club: "Nam Long", seed: 18, status: "Chưa ghép" },
  { id: "U-04", name: "Đình Lộc", rating: 3.29, club: "Q7 Pickle", seed: 21, status: "Chưa ghép" },
];

export const FIXTURE_FORMATION_PAIRS = [
  { id: "PAIR-01", a: "Minh Quân", b: "Hoàng Nam", mode: "Đăng ký cùng", seed: 1, ratingA: 3.82, ratingB: 3.79, combined: 7.61, source: "Đăng ký", status: "Valid" },
  { id: "PAIR-02", a: "Tuấn Anh", b: "Đình Phúc", mode: "BTC ghép thủ công", seed: 4, ratingA: 3.65, ratingB: 3.58, combined: 7.23, source: "BTC", status: "Valid" },
  { id: "PAIR-03", a: "Thảo KV", b: "Quốc Khánh", mode: "Cân bằng Rating", seed: 5, ratingA: 3.55, ratingB: 3.52, combined: 7.07, source: "Tự cân bằng", status: "Valid" },
  { id: "PAIR-04", a: "Lan Anh", b: "Minh Trí", mode: "Ghép ngẫu nhiên", seed: 8, ratingA: 3.41, ratingB: 3.39, combined: 6.80, source: "Ngẫu nhiên", status: "Valid" },
  { id: "PAIR-05", a: "Tiến Đạt", b: "Văn Bình", mode: "Kết hợp", seed: 9, ratingA: 3.48, ratingB: 3.44, combined: 6.92, source: "Kết hợp", status: "Warning" },
];

export const FIXTURE_FORMATION_MODES = {
  together: { label: "Đăng ký cùng", impact: "Ưu tiên cặp đăng ký chung. BTC chỉ xử lý ngoại lệ." },
  manual: { label: "BTC ghép thủ công", impact: "BTC chọn từng VĐV và ghép thủ công. Phù hợp ngoại lệ/check-in." },
  random: { label: "Ghép ngẫu nhiên", impact: "Hệ thống ghép ngẫu nhiên trong nhóm chưa ghép. Không cân Rating." },
  rating: { label: "Cân bằng Rating", impact: "Ghép theo chênh Rating tối thiểu. Cảnh báo nếu vượt ngưỡng." },
  draft: { label: "Chọn theo lượt", impact: "Đội trưởng chọn lượt. Nguyên mẫu hiển thị thứ tự chọn mẫu." },
  hybrid: { label: "Kết hợp", impact: "Kết hợp đăng ký cùng + BTC ghép thủ công + Cân bằng Rating cho phần còn lại." },
};

export const FIXTURE_PAIR_DRAW_TOTAL = 32;

export const FIXTURE_PAIR_DRAW_POOL_A = [
  { id: "PA-01", name: "Nguyễn Văn A", club: "Nam Long", rating: 3.72 },
  { id: "PA-02", name: "Trần Văn B", club: "Phú Nhuận", rating: 3.68 },
  { id: "PA-03", name: "Lê Minh C", club: "Q7 Pickle", rating: 3.55 },
  { id: "PA-04", name: "Phạm D", club: "Nam Long", rating: 3.49 },
];

export const FIXTURE_PAIR_DRAW_POOL_B = [
  { id: "PB-01", name: "Hoàng E", club: "Thảo Điền", rating: 3.71 },
  { id: "PB-02", name: "Vũ F", club: "Nam Long", rating: 3.63 },
  { id: "PB-03", name: "Đặng G", club: "Bình Thạnh", rating: 3.57 },
  { id: "PB-04", name: "Bùi H", club: "Phú Nhuận", rating: 3.44 },
];

export const FIXTURE_PAIR_DRAW_LEDGER = [
  { id: "D-01", number: 1, a: "Minh Quân", b: "Hoàng Nam", total: 7.61, diff: 0.03, valid: true },
  { id: "D-02", number: 2, a: "Tuấn Anh", b: "Đình Phúc", total: 7.23, diff: 0.07, valid: true },
  { id: "D-03", number: 3, a: "Thảo KV", b: "Quốc Khánh", total: 7.07, diff: 0.03, valid: true },
  { id: "D-04", number: 4, a: "Lan Anh", b: "Minh Trí", total: 6.80, diff: 0.02, valid: true },
  { id: "D-05", number: 5, a: "Tiến Đạt", b: "Văn Bình", total: 6.92, diff: 0.04, valid: true },
  { id: "D-06", number: 6, a: "Diệu Linh", b: "Mỹ Linh", total: 6.75, diff: 0.05, valid: true },
  { id: "D-07", number: 7, a: "Pair 7A", b: "Pair 7B", total: 6.68, diff: 0.12, valid: true },
];

export const FIXTURE_PAIR_DRAW_RULES = [
  { label: "Không ghép cùng CLB", status: "ĐẠT", tone: "success", note: "Trừ khi bật ghi đè" },
  { label: "Chênh Rating tối đa", status: "0.15", tone: "info", note: "Cặp hiện tại: 0.04" },
  { label: "Luật giới tính / đội", status: "Không áp dụng", tone: "info", note: "Đôi nam 3.5" },
  { label: "Cân hạt giống", status: "CẢNH BÁO", tone: "warning", note: "1 cặp ràng buộc hạt giống" },
];

export const FIXTURE_PAIR_DRAW_HISTORY = [
  { time: "09:12", text: "#07 Minh Quân + Hoàng Nam — Hợp lệ", tone: "success" },
  { time: "09:14", text: "#08 Tuấn Anh + Đình Phúc — Hợp lệ", tone: "success" },
  { time: "09:16", text: "#08 cảnh báo hạt giống — vẫn cho phép trên dữ liệu mẫu", tone: "warning" },
];

export const FIXTURE_GROUP_DRAW_SUMMARY = {
  totalPairs: 32,
  groups: 4,
  perGroup: 8,
  method: "Ngẫu nhiên cân hạt giống",
  seedRule: "Rải hạt giống 1–8 đều các bảng",
};

export const FIXTURE_GROUP_DRAW_AWAITING = [
  { id: "GP-18", name: "Gia Bảo / Lê Minh", seed: 3, pool: "Nhóm A" },
  { id: "GP-19", name: "An Khang / Bảo Long", seed: 6, pool: "Nhóm B" },
  { id: "GP-20", name: "Hữu Phúc / Đức Anh", seed: 9, pool: "Nhóm A" },
];

export const FIXTURE_GROUP_DRAW_LEDGER = [
  { id: "GL-01", pair: "Minh Quân / Hoàng Nam", group: "A", seed: 1, position: 1, status: "Valid" },
  { id: "GL-02", pair: "Tuấn Anh / Đình Phúc", group: "B", seed: 4, position: 2, status: "Valid" },
  { id: "GL-03", pair: "Thảo KV / Quốc Khánh", group: "C", seed: 5, position: 3, status: "Valid" },
  { id: "GL-04", pair: "Lan Anh / Minh Trí", group: "D", seed: 8, position: 4, status: "Valid" },
];

export const FIXTURE_GROUP_DRAW_RULES = [
  { label: "Rải hạt giống đều các bảng", status: "ĐẠT", tone: "success" },
  { label: "8 cặp / bảng", status: "ĐẠT", tone: "success" },
  { label: "Không trùng vị trí hạt giống", status: "ĐẠT", tone: "success" },
  { label: "Ưu tiên tách CLB", status: "CẢNH BÁO", tone: "warning", note: "1 cặp cùng CLB trong Bảng B" },
];

export const FIXTURE_GROUP_DRAW_HISTORY = [
  { time: "10:02", text: "Cặp 17 → Bảng A vị trí 4/8", tone: "success" },
  { time: "10:04", text: "Cặp 18 → Bảng C vị trí 5/8", tone: "success" },
  { time: "10:06", text: "Kiểm tra rải hạt giống — Đạt", tone: "success" },
];

export const FIXTURE_PAIRS = [
  { id: "PAIR-01", a: "Minh Quân", b: "Hoàng Nam", mode: "Đăng ký cùng", seed: 1 },
  { id: "PAIR-02", a: "Tuấn Anh", b: "Đình Phúc", mode: "BTC ghép thủ công", seed: 4 },
  { id: "PAIR-03", a: "Thảo KV", b: "Quốc Khánh", mode: "Cân bằng Rating", seed: 5 },
  { id: "PAIR-04", a: "Lan Anh", b: "Minh Trí", mode: "Ghép ngẫu nhiên", seed: 8 },
];

export const FIXTURE_POOLS = {
  a: ["Minh Quân / Hoàng Nam", "Thảo KV / Quốc Khánh", "Diệu Linh / Mỹ Linh"],
  b: ["Tuấn Anh / Đình Phúc", "Tiến Đạt / Văn Bình", "Lan Anh / Minh Trí"],
};

export const FIXTURE_DRAW_HISTORY = [
  { time: "09:12", text: "Minh Quân / Hoàng Nam ← Nhóm A" },
  { time: "09:14", text: "Tuấn Anh / Đình Phúc ← Nhóm B" },
  { time: "09:16", text: "Ghép cặp đang thi đấu" },
];

export const FIXTURE_GROUPS = [
  { id: "A", name: "Bảng A", pairs: 8, played: 12, remaining: 4, qualified: "Top 4" },
  { id: "B", name: "Bảng B", pairs: 8, played: 10, remaining: 6, qualified: "Top 4" },
  { id: "C", name: "Bảng C", pairs: 8, played: 11, remaining: 5, qualified: "Top 4" },
  { id: "D", name: "Bảng D", pairs: 8, played: 9, remaining: 7, qualified: "Top 4" },
];

export const FIXTURE_GROUP_STANDINGS = [
  { rank: 1, pair: "Minh Quân / Hoàng Nam", played: 3, won: 3, lost: 0, points: 9, diff: "+18", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
  { rank: 2, pair: "Tuấn Anh / Đình Phúc", played: 3, won: 2, lost: 1, points: 6, diff: "+7", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
  { rank: 3, pair: "Thảo KV / Quốc Khánh", played: 3, won: 2, lost: 1, points: 6, diff: "+5", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
  { rank: 4, pair: "Lan Anh / Minh Trí", played: 3, won: 2, lost: 1, points: 6, diff: "+2", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
  { rank: 5, pair: "Tiến Đạt / Văn Bình", played: 3, won: 1, lost: 2, points: 3, diff: "-4", qual: "Chờ", qualState: "contention", qualLabel: "Còn cơ hội đi tiếp" },
  { rank: 6, pair: "Diệu Linh / Mỹ Linh", played: 2, won: 1, lost: 1, points: 3, diff: "-1", qual: "Chờ", qualState: "contention", qualLabel: "Còn cơ hội đi tiếp" },
  { rank: 7, pair: "Gia Bảo / Lê Minh", played: 3, won: 0, lost: 3, points: 0, diff: "-12", qual: "Loại", qualState: "eliminated", qualLabel: "Đã bị loại" },
  { rank: 8, pair: "An Khang / Bảo Long", played: 3, won: 0, lost: 3, points: 0, diff: "-15", qual: "Loại", qualState: "eliminated", qualLabel: "Đã bị loại" },
];

export const FIXTURE_STANDINGS_BY_GROUP = {
  A: FIXTURE_GROUP_STANDINGS,
  B: [
    { rank: 1, pair: "Tuấn Anh / Đình Phúc", played: 3, won: 3, lost: 0, points: 9, diff: "+14", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 2, pair: "Pair B2", played: 3, won: 2, lost: 1, points: 6, diff: "+6", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 3, pair: "Pair B3", played: 3, won: 2, lost: 1, points: 6, diff: "+3", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 4, pair: "Pair B4", played: 2, won: 1, lost: 1, points: 3, diff: "+1", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 5, pair: "Pair B5", played: 2, won: 1, lost: 1, points: 3, diff: "-2", qual: "Chờ", qualState: "contention", qualLabel: "Còn cơ hội đi tiếp" },
    { rank: 6, pair: "Pair B6", played: 3, won: 1, lost: 2, points: 3, diff: "-5", qual: "Chờ", qualState: "contention", qualLabel: "Còn cơ hội đi tiếp" },
    { rank: 7, pair: "Pair B7", played: 3, won: 0, lost: 3, points: 0, diff: "-8", qual: "Loại", qualState: "eliminated", qualLabel: "Đã bị loại" },
    { rank: 8, pair: "Pair B8", played: 3, won: 0, lost: 3, points: 0, diff: "-11", qual: "Loại", qualState: "eliminated", qualLabel: "Đã bị loại" },
  ],
  C: [
    { rank: 1, pair: "Thảo KV / Quốc Khánh", played: 3, won: 3, lost: 0, points: 9, diff: "+11", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 2, pair: "Pair C2", played: 3, won: 2, lost: 1, points: 6, diff: "+4", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 3, pair: "Pair C3", played: 3, won: 2, lost: 1, points: 6, diff: "+2", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 4, pair: "Gia Bảo / Lê Minh", played: 2, won: 1, lost: 1, points: 3, diff: "0", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 5, pair: "Pair C5", played: 3, won: 1, lost: 2, points: 3, diff: "-3", qual: "Chờ", qualState: "contention", qualLabel: "Còn cơ hội đi tiếp" },
    { rank: 6, pair: "Pair C6", played: 2, won: 1, lost: 1, points: 3, diff: "-4", qual: "Chờ", qualState: "contention", qualLabel: "Còn cơ hội đi tiếp" },
    { rank: 7, pair: "Pair C7", played: 3, won: 0, lost: 3, points: 0, diff: "-7", qual: "Loại", qualState: "eliminated", qualLabel: "Đã bị loại" },
    { rank: 8, pair: "Pair C8", played: 3, won: 0, lost: 3, points: 0, diff: "-10", qual: "Loại", qualState: "eliminated", qualLabel: "Đã bị loại" },
  ],
  D: [
    { rank: 1, pair: "Lan Anh / Minh Trí", played: 3, won: 3, lost: 0, points: 9, diff: "+9", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 2, pair: "Pair D2", played: 3, won: 2, lost: 1, points: 6, diff: "+5", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 3, pair: "Pair D3", played: 3, won: 2, lost: 1, points: 6, diff: "+1", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 4, pair: "Pair D4", played: 2, won: 1, lost: 1, points: 3, diff: "+1", qual: "Vào R16", qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" },
    { rank: 5, pair: "Pair D5", played: 3, won: 1, lost: 2, points: 3, diff: "-2", qual: "Chờ", qualState: "contention", qualLabel: "Còn cơ hội đi tiếp" },
    { rank: 6, pair: "Pair D6", played: 2, won: 1, lost: 1, points: 3, diff: "-3", qual: "Chờ", qualState: "contention", qualLabel: "Còn cơ hội đi tiếp" },
    { rank: 7, pair: "Pair D7", played: 3, won: 0, lost: 3, points: 0, diff: "-6", qual: "Loại", qualState: "eliminated", qualLabel: "Đã bị loại" },
    { rank: 8, pair: "Pair D8", played: 3, won: 0, lost: 3, points: 0, diff: "-9", qual: "Loại", qualState: "eliminated", qualLabel: "Đã bị loại" },
  ],
};

export const FIXTURE_COURTS = [
  {
    id: "C1",
    name: "Sân 1",
    status: "LIVE",
    match: "QF2",
    next: "SF1 14:00",
    event: "Đôi nam 4.0",
    currentMatch: { id: "QF2", a: "Thảo KV / Quốc Khánh", b: "Tiến Đạt / Văn Bình", event: "Đôi nam 4.0", stage: "Tứ kết", time: "10:20", score: "11–8, 7–6", status: "LIVE" },
    nextMatch: { id: "SF1", time: "14:00", event: "Đôi nam 4.0", stage: "Bán kết" },
  },
  {
    id: "C2",
    name: "Sân 2",
    status: "NEXT",
    match: "—",
    next: "A-19 11:20",
    event: "Đôi nam 3.5",
    currentMatch: null,
    nextMatch: { id: "A-19", time: "11:20", event: "Đôi nam 3.5", stage: "Vòng bảng" },
  },
  {
    id: "C3",
    name: "Sân 3",
    status: "LIVE",
    match: "A-18",
    next: "A-20 12:00",
    event: "Đôi nam 3.5",
    currentMatch: { id: "A-18", a: "Minh Quân / Hoàng Nam", b: "Tuấn Anh / Đình Phúc", event: "Đôi nam 3.5", stage: "Vòng bảng", time: "10:40", score: "11–7, 8–11, 6–4", status: "LIVE" },
    nextMatch: { id: "A-20", time: "12:00", event: "Đôi nam 3.5", stage: "Vòng bảng" },
  },
  {
    id: "C4",
    name: "Sân 4",
    status: "MAINTENANCE",
    match: "—",
    next: "—",
    event: "—",
    maintenance: true,
    eta: "12:30",
    currentMatch: null,
    nextMatch: null,
  },
  {
    id: "C5",
    name: "Sân 5",
    status: "LIVE",
    match: "B-07",
    next: "B-08 11:40",
    event: "Mixed 3.5",
    currentMatch: { id: "B-07", a: "Diệu Linh / Mỹ Linh", b: "Lan Anh / Minh Trí", event: "Mixed 3.5", stage: "Vòng bảng", time: "10:35", score: "6–4", status: "LIVE" },
    nextMatch: { id: "B-08", time: "11:40", event: "Mixed 3.5", stage: "Vòng bảng" },
  },
  {
    id: "C6",
    name: "Sân 6",
    status: "NEXT",
    match: "—",
    next: "C-03 11:30",
    event: "Đôi nữ 3.5",
    currentMatch: null,
    nextMatch: { id: "C-03", time: "11:30", event: "Đôi nữ 3.5", stage: "Vòng bảng" },
  },
  {
    id: "C7",
    name: "Sân 7",
    status: "DELAY",
    match: "C-02",
    next: "C-04 12:10",
    event: "Đôi nữ 3.5",
    delay: true,
    currentMatch: { id: "C-02", a: "Pair C2", b: "Pair C5", event: "Đôi nữ 3.5", stage: "Vòng bảng", time: "10:15", score: "—", status: "DELAY" },
    nextMatch: { id: "C-04", time: "12:10", event: "Đôi nữ 3.5", stage: "Vòng bảng" },
  },
  {
    id: "C8",
    name: "Sân 8",
    status: "AVAILABLE",
    match: "—",
    next: "—",
    event: "—",
    currentMatch: null,
    nextMatch: null,
  },
  {
    id: "C9",
    name: "Sân 9",
    status: "NEXT",
    match: "—",
    next: "WD-03 12:20",
    event: "Đôi nữ 3.5",
    currentMatch: null,
    nextMatch: { id: "WD-03", time: "12:20", event: "Đôi nữ 3.5", stage: "Vòng bảng" },
  },
  {
    id: "C10",
    name: "Sân 10",
    status: "NEXT",
    match: "—",
    next: "MX-05 11:50",
    event: "Mixed Open",
    currentMatch: null,
    nextMatch: { id: "MX-05", time: "11:50", event: "Mixed Open", stage: "Vòng loại trực tiếp" },
  },
  {
    id: "C11",
    name: "Sân 11",
    status: "AVAILABLE",
    match: "—",
    next: "—",
    event: "—",
    currentMatch: null,
    nextMatch: null,
  },
  {
    id: "C12",
    name: "Sân 12",
    status: "AVAILABLE",
    match: "—",
    next: "—",
    event: "—",
    currentMatch: null,
    nextMatch: null,
  },
];

export const FIXTURE_SCHEDULE_SLOTS = [
  { time: "10:00", c1: "QF2 đang thi đấu", c2: "—", c3: "A-18 đang thi đấu", c4: "Bảo trì" },
  { time: "11:20", c1: "—", c2: "A-19", c3: "—", c4: "Bảo trì" },
  { time: "12:00", c1: "SF1", c2: "—", c3: "A-20", c4: "Bảo trì" },
  { time: "14:00", c1: "SF2", c2: "MX-04", c3: "—", c4: "Bảo trì" },
];

export const FIXTURE_EVENT_ALLOCATED_COURTS = ["C1", "C2", "C3", "C4"];

export const FIXTURE_SCHEDULE_GRID = [
  {
    time: "08:00",
    C1: { match: "A-11", meta: "Vòng bảng • A", status: "completed" },
    C2: { match: "A-12", meta: "Vòng bảng • A", status: "completed" },
    C3: { match: "A-13", meta: "Vòng bảng • A", status: "completed" },
    C4: { match: "Bảo trì", status: "maintenance" },
  },
  {
    time: "09:10",
    C1: { match: "A-14", meta: "Vòng bảng • A", status: "completed" },
    C2: { match: "A-15", meta: "Vòng bảng • A", status: "completed" },
    C3: { match: "A-16", meta: "Vòng bảng • A", status: "completed" },
    C4: { match: "Bảo trì", status: "maintenance" },
  },
  {
    time: "10:00",
    C1: { match: "A-17", meta: "Vòng bảng • A", status: "completed" },
    C2: { match: "—", status: "empty" },
    C3: { match: "A-18", meta: "Vòng bảng • A", status: "live" },
    C4: { match: "Bảo trì", status: "maintenance" },
  },
  {
    time: "10:40",
    C1: { match: "—", status: "empty" },
    C2: { match: "A-19", meta: "Thiếu TT", status: "conflict" },
    C3: { match: "A-18", meta: "Vòng bảng • A", status: "live" },
    C4: { match: "Bảo trì", status: "maintenance" },
  },
  {
    time: "11:20",
    C1: { match: "—", status: "empty" },
    C2: { match: "A-19", meta: "Vòng bảng • A", status: "upcoming" },
    C3: { match: "A-20", meta: "Vòng bảng • A", status: "upcoming" },
    C4: { match: "Bảo trì", status: "maintenance" },
  },
  {
    time: "12:00",
    C1: { match: "A-21", meta: "Chưa xác nhận", status: "upcoming" },
    C2: { match: "—", status: "empty" },
    C3: { match: "A-22", meta: "Vòng bảng • A", status: "upcoming" },
    C4: { match: "Bảo trì", status: "maintenance" },
  },
  {
    time: "13:30",
    C1: { match: "DELAY", meta: "Trễ 15'", status: "conflict" },
    C2: { match: "A-23", meta: "Vòng bảng • B", status: "upcoming" },
    C3: { match: "—", status: "empty" },
    C4: { match: "Bảo trì", status: "maintenance" },
  },
  {
    time: "14:00",
    C1: { match: "A-24", meta: "Vòng bảng • B", status: "upcoming" },
    C2: { match: "—", status: "empty" },
    C3: { match: "A-25", meta: "Vòng bảng • C", status: "upcoming" },
    C4: { match: "Bảo trì", status: "maintenance" },
  },
];

export const FIXTURE_UNSCHEDULED_MATCHES = [
  { id: "A-26", event: "Đôi nam 3.5", stage: "Vòng bảng", group: "A", a: "Tiến Đạt / Văn Bình", b: "Diệu Linh / Mỹ Linh", time: "—", court: "Chưa gán", referee: "Chưa gán", status: "attention", score: "—" },
  { id: "A-27", event: "Đôi nam 3.5", stage: "Vòng bảng", group: "B", a: "Pair B5", b: "Pair B6", time: "—", court: "Chưa gán", referee: "Chưa gán", status: "upcoming", score: "—" },
];

export const FIXTURE_SCHEDULE_CONFLICTS = [
  { id: "Sân 4", text: "Bảo trì — không xếp trận" },
  { id: "A-19", text: "Sân 2 • 10:40 — chưa gán trọng tài" },
  { id: "Sân 1", text: "13:30 trễ 15 phút" },
];

export const FIXTURE_MATCH_REGISTRY = [
  {
    id: "A-18",
    event: "Đôi nam 3.5",
    stage: "Vòng bảng",
    group: "A",
    a: "Minh Quân / Hoàng Nam",
    b: "Tuấn Anh / Đình Phúc",
    time: "10:40",
    court: "Sân 3",
    referee: "Trọng tài Hùng",
    status: "live",
    score: "11-7, 8-11, 6-4",
    games: [{ set: 1, a: 11, b: 7 }, { set: 2, a: 8, b: 11 }, { set: 3, a: 6, b: 4 }],
    timeline: [
      { time: "10:40", text: "Bắt đầu trận" },
      { time: "10:52", text: "Kết thúc set 1 — 11–7" },
      { time: "11:08", text: "Kết thúc set 2 — 8–11" },
      { time: "11:14", text: "Set 3 đang diễn ra 6–4" },
    ],
    issues: [],
  },
  {
    id: "QF2",
    event: "Đôi nam 4.0",
    stage: "Tứ kết",
    group: "—",
    a: "Thảo KV / Quốc Khánh",
    b: "Tiến Đạt / Văn Bình",
    time: "10:20",
    court: "Sân 1",
    referee: "Trọng tài Mai",
    status: "live",
    score: "11-8, 7-6",
    games: [{ set: 1, a: 11, b: 8 }, { set: 2, a: 7, b: 6 }],
    timeline: [{ time: "10:20", text: "Bắt đầu trận" }, { time: "10:34", text: "Set 1 xong 11–8" }],
    issues: [],
  },
  {
    id: "B-07",
    event: "Mixed 3.5",
    stage: "Vòng bảng",
    group: "B",
    a: "Diệu Linh / Mỹ Linh",
    b: "Lan Anh / Minh Trí",
    time: "10:35",
    court: "Sân 5",
    referee: "Trọng tài Long",
    status: "live",
    score: "6-4",
    games: [{ set: 1, a: 6, b: 4 }],
    timeline: [{ time: "10:35", text: "Set 1 đang diễn ra" }],
    issues: [],
  },
  {
    id: "A-12",
    event: "Đôi nam 3.5",
    stage: "Vòng bảng",
    group: "A",
    a: "Pair 5",
    b: "Pair 8",
    time: "09:10",
    court: "Sân 2",
    referee: "Trọng tài Hùng",
    status: "completed",
    score: "11-4, 11-6",
    games: [{ set: 1, a: 11, b: 4 }, { set: 2, a: 11, b: 6 }],
    timeline: [{ time: "09:10", text: "Hoàn tất" }],
    issues: [],
  },
  {
    id: "A-15",
    event: "Đôi nam 3.5",
    stage: "Vòng bảng",
    group: "A",
    a: "Thảo KV / Quốc Khánh",
    b: "Gia Bảo / Lê Minh",
    time: "09:10",
    court: "Sân 3",
    referee: "Trọng tài An",
    status: "completed",
    score: "11-6, 11-8",
    games: [{ set: 1, a: 11, b: 6 }, { set: 2, a: 11, b: 8 }],
    timeline: [{ time: "09:38", text: "Hoàn tất" }],
    issues: [],
  },
  {
    id: "A-17",
    event: "Đôi nam 3.5",
    stage: "Vòng bảng",
    group: "A",
    a: "Lan Anh / Minh Trí",
    b: "An Khang / Bảo Long",
    time: "10:00",
    court: "Sân 1",
    referee: "Trọng tài Mai",
    status: "completed",
    score: "11-9, 11-5",
    games: [{ set: 1, a: 11, b: 9 }, { set: 2, a: 11, b: 5 }],
    timeline: [{ time: "10:28", text: "Hoàn tất" }],
    issues: [],
  },
  {
    id: "A-19",
    event: "Đôi nam 3.5",
    stage: "Vòng bảng",
    group: "A",
    a: "Pair 3",
    b: "Pair 6",
    time: "11:20",
    court: "Sân 2",
    referee: "Chưa gán",
    status: "attention",
    score: "—",
    games: [],
    timeline: [{ time: "11:05", text: "Cảnh báo: chưa gán trọng tài" }],
    issues: ["Chưa gán trọng tài", "Risk trễ giờ"],
  },
  {
    id: "A-20",
    event: "Đôi nam 3.5",
    stage: "Vòng bảng",
    group: "A",
    a: "Tiến Đạt / Văn Bình",
    b: "Diệu Linh / Mỹ Linh",
    time: "12:00",
    court: "Sân 3",
    referee: "Trọng tài Hùng",
    status: "upcoming",
    score: "—",
    games: [],
    timeline: [],
    issues: [],
  },
  {
    id: "A-21",
    event: "Đôi nam 3.5",
    stage: "Vòng bảng",
    group: "A",
    a: "Minh Quân / Hoàng Nam",
    b: "Lan Anh / Minh Trí",
    time: "12:00",
    court: "Sân 1",
    referee: "Trọng tài Mai",
    status: "upcoming",
    score: "—",
    games: [],
    timeline: [],
    issues: [],
  },
  {
    id: "SF1",
    event: "Đôi nam 4.0",
    stage: "Bán kết",
    group: "—",
    a: "TBD",
    b: "TBD",
    time: "14:00",
    court: "Sân 1",
    referee: "Trọng tài Mai",
    status: "upcoming",
    score: "—",
    games: [],
    timeline: [],
    issues: [],
  },
];

export const FIXTURE_KO_ROUNDS = ["R32", "R16", "QF", "SF", "Final"];

export const FIXTURE_KO_MATCHES = {
  R32: [
    { id: "R32-1", a: "BYE", b: "Minh Quân / Hoàng Nam", seedA: null, seedB: 1, sourceA: "Bye", sourceB: "A1", court: "—", time: "—", status: "completed", score: "WO", winner: "b", live: false },
    { id: "R32-2", a: "Gia Bảo / Lê Minh", b: "BYE", seedA: 16, seedB: null, sourceA: "C5", sourceB: "Bye", court: "—", time: "—", status: "completed", score: "WO", winner: "a", live: false },
    { id: "R32-3", a: "BYE", b: "Tuấn Anh / Đình Phúc", seedB: 4, sourceB: "B1", court: "—", time: "—", status: "completed", score: "WO", winner: "b", live: false },
    { id: "R32-4", a: "An Khang / Bảo Long", b: "BYE", seedA: 13, sourceA: "D6", court: "—", time: "—", status: "completed", score: "WO", winner: "a", live: false },
    { id: "R32-5", a: "BYE", b: "Thảo KV / Quốc Khánh", seedB: 5, sourceB: "C1", court: "—", time: "—", status: "completed", score: "WO", winner: "b", live: false },
    { id: "R32-6", a: "Pair C3", b: "BYE", seedA: 12, sourceA: "C3", court: "—", time: "—", status: "completed", score: "WO", winner: "a", live: false },
    { id: "R32-7", a: "BYE", b: "Lan Anh / Minh Trí", seedB: 8, sourceB: "D1", court: "—", time: "—", status: "completed", score: "WO", winner: "b", live: false },
    { id: "R32-8", a: "Pair D3", b: "BYE", seedA: 9, sourceA: "D3", court: "—", time: "—", status: "completed", score: "WO", winner: "a", live: false, advancesTo: "R16-4" },
    { id: "R32-9", a: "BYE", b: "Tiến Đạt / Văn Bình", seedB: 9, sourceA: "Bye", sourceB: "A5", court: "—", time: "—", status: "completed", score: "WO", winner: "b", live: false, advancesTo: "R16-5" },
    { id: "R32-10", a: "Pair B3", b: "BYE", seedA: 8, sourceA: "B3", sourceB: "Bye", court: "—", time: "—", status: "completed", score: "WO", winner: "a", live: false, advancesTo: "R16-5" },
    { id: "R32-11", a: "BYE", b: "Diệu Linh / Mỹ Linh", seedB: 6, sourceA: "Bye", sourceB: "MX", court: "—", time: "—", status: "completed", score: "WO", winner: "b", live: false, advancesTo: "R16-6" },
    { id: "R32-12", a: "Pair A6", b: "BYE", seedA: 11, sourceA: "A6", sourceB: "Bye", court: "—", time: "—", status: "completed", score: "WO", winner: "a", live: false, advancesTo: "R16-6" },
    { id: "R32-13", a: "BYE", b: "Pair B2", seedB: 3, sourceA: "Bye", sourceB: "B2", court: "—", time: "—", status: "completed", score: "WO", winner: "b", live: false, advancesTo: "R16-7" },
    { id: "R32-14", a: "Pair C2", b: "BYE", seedA: 14, sourceA: "C2", sourceB: "Bye", court: "—", time: "—", status: "completed", score: "WO", winner: "a", live: false, advancesTo: "R16-7" },
    { id: "R32-15", a: "BYE", b: "Pair D2", seedB: 7, sourceA: "Bye", sourceB: "D2", court: "—", time: "—", status: "completed", score: "WO", winner: "b", live: false, advancesTo: "R16-8" },
    { id: "R32-16", a: "Pair B4", b: "BYE", seedA: 10, sourceA: "B4", sourceB: "Bye", court: "—", time: "—", status: "completed", score: "WO", winner: "a", live: false, advancesTo: "R16-8" },
  ],
  R16: [
    { id: "R16-1", a: "Minh Quân / Hoàng Nam", b: "Gia Bảo / Lê Minh", seedA: 1, seedB: 16, sourceA: "R32-1", sourceB: "R32-2", court: "Sân 1", time: "11:00", status: "completed", score: "11-5, 11-7", winner: "a", live: false },
    { id: "R16-2", a: "Tuấn Anh / Đình Phúc", b: "An Khang / Bảo Long", seedA: 4, seedB: 13, sourceA: "R32-3", sourceB: "R32-4", court: "Sân 2", time: "11:00", status: "completed", score: "11-8, 11-6", winner: "a", live: false },
    { id: "R16-3", a: "Thảo KV / Quốc Khánh", b: "Pair C3", seedA: 5, seedB: 12, sourceA: "R32-5", sourceB: "R32-6", court: "Sân 3", time: "11:30", status: "completed", score: "11-9, 8-11, 11-6", winner: "a", live: false },
    { id: "R16-4", a: "Lan Anh / Minh Trí", b: "Pair D3", seedA: 8, seedB: 9, sourceA: "R32-7", sourceB: "R32-8", court: "Sân 4", time: "11:30", status: "completed", score: "11-4, 11-9", winner: "a", live: false },
    { id: "R16-5", a: "Tiến Đạt / Văn Bình", b: "Pair B3", seedA: 9, seedB: 8, sourceA: "R32-9", sourceB: "R32-10", court: "Sân 1", time: "12:10", status: "completed", score: "11-7, 6-11, 11-8", winner: "a", live: false },
    { id: "R16-6", a: "Diệu Linh / Mỹ Linh", b: "Pair A6", seedA: 6, seedB: 11, sourceA: "R32-11", sourceB: "R32-12", court: "Sân 2", time: "12:10", status: "upcoming", score: "—", winner: null, live: false },
    { id: "R16-7", a: "Pair B2", b: "Pair C2", seedA: 3, seedB: 14, sourceA: "R32-13", sourceB: "R32-14", court: "Sân 3", time: "12:40", status: "upcoming", score: "—", winner: null, live: false },
    { id: "R16-8", a: "Pair D2", b: "Pair B4", seedA: 7, seedB: 10, sourceA: "R32-15", sourceB: "R32-16", court: "Sân 4", time: "12:40", status: "attention", score: "—", winner: null, live: false },
  ],
  QF: [
    { id: "QF1", a: "Minh Quân / Hoàng Nam", b: "Tuấn Anh / Đình Phúc", seedA: 1, seedB: 4, sourceA: "R16-1", sourceB: "R16-2", court: "Sân 1", time: "15:00", status: "upcoming", score: "—", winner: null, live: false },
    { id: "QF2", a: "Thảo KV / Quốc Khánh", b: "Tiến Đạt / Văn Bình", seedA: 5, seedB: 9, sourceA: "R16-3", sourceB: "R16-5", court: "Sân 1", time: "10:20", status: "live", score: "11-8, 7-6", winner: null, live: true },
    { id: "QF3", a: "Lan Anh / Minh Trí", b: "Winner R16-6", seedA: 8, seedB: null, sourceA: "R16-4", sourceB: "R16-6", court: "Sân 2", time: "15:40", status: "upcoming", score: "—", winner: null, live: false },
    { id: "QF4", a: "Winner R16-7", b: "Winner R16-8", seedA: null, seedB: null, sourceA: "R16-7", sourceB: "R16-8", court: "Sân 3", time: "16:20", status: "upcoming", score: "—", winner: null, live: false },
  ],
  SF: [
    { id: "SF1", a: "Winner QF1", b: "Winner QF2", sourceA: "QF1", sourceB: "QF2", court: "Sân 1", time: "14:00", status: "upcoming", score: "—", winner: null, live: false },
    { id: "SF2", a: "Winner QF3", b: "Winner QF4", sourceA: "QF3", sourceB: "QF4", court: "Sân 2", time: "15:00", status: "upcoming", score: "—", winner: null, live: false },
  ],
  Final: [
    { id: "F", a: "Winner SF1", b: "Winner SF2", sourceA: "SF1", sourceB: "SF2", court: "Sân 1", time: "16:30", status: "upcoming", score: "—", winner: null, live: false },
  ],
};

export const FIXTURE_CHAMPION_NODE = {
  id: "CHAMPION",
  a: "TBD",
  b: "",
  status: "upcoming",
  score: "—",
  sourceA: "Winner Final",
};

export const FIXTURE_KO_RESULTS = [
  { id: "R16-1", round: "R16", a: "Minh Quân / Hoàng Nam", b: "Gia Bảo / Lê Minh", score: "11-5, 11-7", winner: "Minh Quân / Hoàng Nam" },
  { id: "R16-2", round: "R16", a: "Tuấn Anh / Đình Phúc", b: "An Khang / Bảo Long", score: "11-8, 11-6", winner: "Tuấn Anh / Đình Phúc" },
  { id: "QF2", round: "QF", a: "Thảo KV / Quốc Khánh", b: "Tiến Đạt / Văn Bình", score: "Đang thi đấu 11-8, 7-6", winner: "—" },
];

export const FIXTURE_OVERALL_PREVIEW = [
  { place: "Vô địch", pair: "TBD", note: "Chưa thi đấu chung kết" },
  { place: "Á quân", pair: "TBD", note: "Chưa thi đấu chung kết" },
  { place: "Hạng ba", pair: "TBD", note: "Chưa thi đấu bán kết" },
];

export const FIXTURE_STANDINGS_READINESS = [
  { label: "Trận đã tính BXH", ready: false, note: "12/16 trận vòng bảng hoàn tất" },
  { label: "Không kết quả chờ xác nhận", ready: false, note: "2 kết quả chưa xác nhận" },
  { label: "Hòa điểm / tie-break", ready: true, note: "Đã xử lý" },
  { label: "Đã tính điều kiện đi tiếp", ready: false, note: "Top 4 chưa khóa" },
];

export const FIXTURE_REFEREES = [
  { id: "R1", name: "Trọng tài Hùng", status: "LIVE", current: "A-18 • Sân 3", currentMatch: "A-18", court: "Sân 3", currentTime: "10:40", next: "A-20", nextAssignment: "A-20", nextCourt: "Sân 3", nextTime: "12:00", workload: "5 trận", event: "Đôi nam 3.5", stage: "Vòng bảng", issue: null },
  { id: "R2", name: "Trọng tài Mai", status: "LIVE", current: "QF2 • Sân 1", currentMatch: "QF2", court: "Sân 1", currentTime: "10:20", next: "SF1", nextAssignment: "SF1", nextCourt: "Sân 1", nextTime: "14:00", workload: "4 trận", event: "Đôi nam 4.0", stage: "Tứ kết", issue: null },
  { id: "R3", name: "Trọng tài Long", status: "LIVE", current: "B-07 • Sân 5", currentMatch: "B-07", court: "Sân 5", currentTime: "10:35", next: "B-08", nextAssignment: "B-08", nextCourt: "Sân 5", nextTime: "11:40", workload: "4 trận", event: "Mixed 3.5", stage: "Vòng bảng", issue: null },
  { id: "R4", name: "Trọng tài An", status: "AVAILABLE", current: "—", currentMatch: null, court: "—", currentTime: null, next: "A-19", nextAssignment: "A-19", nextCourt: "Sân 2", nextTime: "11:20", workload: "2 trận", event: "Đôi nam 3.5", stage: "Vòng bảng", issue: "Chưa nhận sân" },
  { id: "R5", name: "Trọng tài Hà", status: "NEXT", current: "—", currentMatch: null, court: "Sân 6", currentTime: null, next: "C-03", nextAssignment: "C-03", nextCourt: "Sân 6", nextTime: "11:30", workload: "3 trận", event: "Đôi nữ 3.5", stage: "Vòng bảng", issue: null },
  { id: "R6", name: "Trọng tài Phong", status: "ATTENTION", current: "C-02 • Sân 7", currentMatch: "C-02", court: "Sân 7", currentTime: "10:15", next: "C-04", nextAssignment: "C-04", nextCourt: "Sân 7", nextTime: "12:10", workload: "3 trận", event: "Đôi nữ 3.5", stage: "Vòng bảng", issue: "Trận DELAY 15'" },
];

export const FIXTURE_UNASSIGNED_MATCHES = [
  { id: "A-19", court: "Sân 2", event: "Đôi nam 3.5", stage: "Vòng bảng", time: "11:20" },
  { id: "A-26", court: "Chưa gán", event: "Đôi nam 3.5", stage: "Vòng bảng", time: "—" },
];

export const FIXTURE_INCIDENTS = [
  {
    id: "INC-11",
    title: "Trận A-19 thiếu trọng tài",
    type: "Thiếu trọng tài",
    severity: "danger",
    status: "open",
    owner: "BTC sân",
    affect: "Sân 2 • Đôi nam 3.5",
    event: "Đôi nam 3.5",
    match: "A-19",
    court: "Sân 2",
    opened: "10:28",
    description: "Trận A-19 Sân 2 không có trọng tài. Không thể bắt đầu đúng 11:20.",
    action: "Gán trọng tài còn trống",
    timeline: [
      { time: "10:28", text: "Đã mở sự cố" },
      { time: "10:31", text: "Gợi ý Trọng tài An còn trống" },
    ],
  },
  {
    id: "INC-12",
    title: "Sân 4 bảo trì",
    type: "Sân không dùng được",
    severity: "warning",
    status: "open",
    owner: "Kỹ thuật",
    affect: "Cụm Nam Long",
    event: "—",
    match: "—",
    court: "Sân 4",
    opened: "09:40",
    description: "Lưới / mặt sân Sân 4. ETA 12:30. Không occupy cả cụm.",
    action: "Xem Bảng điều hành sân",
    timeline: [
      { time: "09:40", text: "Bảo trì bắt đầu" },
      { time: "10:12", text: "ETA cập nhật 12:30" },
    ],
  },
  {
    id: "INC-13",
    title: "VĐV chấn thương",
    type: "Sự cố VĐV",
    severity: "warning",
    status: "watching",
    owner: "Y tế",
    affect: "Mixed 3.5",
    event: "Mixed 3.5",
    match: "B-07",
    court: "Sân 5",
    opened: "10:38",
    description: "VĐV Mixed 3.5 đang được theo dõi. Trận B-07 vẫn đang thi đấu.",
    action: "Mở trung tâm trận đấu",
    timeline: [{ time: "10:38", text: "Y tế tiếp nhận" }, { time: "10:44", text: "Đang theo dõi — chưa dừng trận" }],
  },
  {
    id: "INC-14",
    title: "Trễ giờ C-02",
    type: "Trễ lịch",
    severity: "warning",
    status: "open",
    owner: "Điều hành",
    affect: "Sân 7",
    event: "Đôi nữ 3.5",
    match: "C-02",
    court: "Sân 7",
    opened: "10:22",
    description: "C-02 DELAY 15 phút. C-04 có nguy cơ dồn.",
    action: "Điều chỉnh lịch",
    timeline: [{ time: "10:22", text: "Đã ghi nhận trễ giờ" }, { time: "10:41", text: "C-04 giữ 12:10" }],
  },
  {
    id: "INC-15",
    title: "Lệch kết quả A-12",
    type: "Lệch kết quả",
    severity: "danger",
    status: "open",
    owner: "Kết quả",
    affect: "A-12 • Đôi nam 3.5",
    event: "Đôi nam 3.5",
    match: "A-12",
    court: "Sân 2",
    opened: "09:50",
    description: "Score sheet và live board không khớp set 2.",
    action: "Xác minh kết quả",
    timeline: [{ time: "09:50", text: "Đã đánh dấu lệch kết quả" }],
  },
  {
    id: "INC-16",
    title: "Xung đột lịch Sân 1 13:30",
    type: "Xung đột lịch",
    severity: "warning",
    status: "resolved",
    owner: "Điều hành",
    affect: "Sân 1",
    event: "Đôi nam 4.0",
    match: "—",
    court: "Sân 1",
    opened: "08:15",
    description: "Đã dời khung giờ trễ. Đã xử lý hôm nay.",
    action: "Xem lịch",
    timeline: [{ time: "08:15", text: "Đã mở xung đột" }, { time: "09:05", text: "Đã xử lý" }],
  },
];

export const FIXTURE_OPS_TIMELINE = [
  { time: "10:20", status: "LIVE", text: "Trận bắt đầu — QF2 Sân 1" },
  { time: "10:28", status: "ATTENTION", text: "Sự cố mở — A-19 thiếu trọng tài" },
  { time: "10:35", status: "LIVE", text: "Trận bắt đầu — B-07 Sân 5" },
  { time: "10:40", status: "LIVE", text: "Trận bắt đầu — A-18 Sân 3" },
  { time: "10:41", status: "DELAY", text: "Trận trễ — C-02 Sân 7 +15'" },
  { time: "10:44", status: "NEXT", text: "Đã gán trọng tài — Hà → C-03 Sân 6" },
  { time: "10:48", status: "COMPLETED", text: "Trận hoàn tất — A-17 Sân 1" },
  { time: "10:51", status: "MAINTENANCE", text: "Đổi sân — Sân 4 vẫn bảo trì, ETA 12:30" },
];

export const FIXTURE_WAITING_QUEUE = [
  { id: "A-19", court: "Sân 2", time: "11:20", status: "WAITING", note: "Chờ trọng tài" },
  { id: "C-03", court: "Sân 6", time: "11:30", status: "WAITING", note: "Chờ sân tiếp theo" },
  { id: "B-08", court: "Sân 5", time: "11:40", status: "WAITING", note: "Sau B-07 đang thi đấu" },
];

export const FIXTURE_MESSAGES = [
  { id: "M1", title: "Nhắc check-in Đôi nam 3.5", channels: ["PICK_VN App", "Zalo OA"], audience: "Nội dung", status: "delivered", time: "08:40", delivery: 96, template: "Nhắc check-in" },
  { id: "M2", title: "Trọng tài nhận sân 1", channels: ["SMS"], audience: "Trọng tài", status: "sent", time: "09:05", delivery: 100, template: "Trận sắp bắt đầu" },
  { id: "M3", title: "Lịch chiều 21/09", channels: ["Email", "PICK_VN App"], audience: "Cả giải", status: "scheduled", time: "12:00", delivery: 0, template: "Cập nhật lịch" },
  { id: "M4", title: "Đổi sân A-20 → Sân 3", channels: ["PICK_VN App", "SMS"], audience: "Đội trưởng", status: "delivered", time: "09:50", delivery: 88, template: "Đổi sân" },
  { id: "M5", title: "Kết quả A-12 đã công bố", channels: ["PICK_VN App", "Zalo OA"], audience: "Nội dung", status: "failed", time: "09:55", delivery: 12, template: "Kết quả đã công bố" },
];

export const FIXTURE_COMMS_TEMPLATES = [
  { id: "checkin", label: "Nhắc check-in", title: "Nhắc check-in", body: "Vui lòng check-in trước giờ thi đấu 30 phút tại cụm Nam Long." },
  { id: "court", label: "Đổi sân", title: "Đổi sân", body: "Trận của bạn được chuyển sân. Vui lòng xem Bảng điều hành sân." },
  { id: "starting", label: "Trận sắp bắt đầu", title: "Trận sắp bắt đầu", body: "Trận của bạn sắp bắt đầu. Có mặt tại sân được gán." },
  { id: "schedule", label: "Cập nhật lịch", title: "Cập nhật lịch", body: "Lịch thi đấu đã cập nhật. Xem chi tiết trên PICK_VN App." },
  { id: "result", label: "Kết quả đã công bố", title: "Kết quả đã công bố", body: "Kết quả trận đã được công bố trên trang giải." },
];

export const FIXTURE_OUTPUTS = [
  { id: "draw", label: "Màn bốc thăm", status: "READY", ready: true, hint: "Bốc cặp / chia bảng" },
  { id: "live", label: "Tỷ số trực tiếp", status: "LIVE", ready: true, hint: "A-18 • Sân 3" },
  { id: "standings", label: "Bảng xếp hạng", status: "READY", ready: true, hint: "Bảng A–D" },
  { id: "bracket", label: "Nhánh đấu", status: "READY", ready: true, hint: "KO R16+" },
  { id: "court", label: "Bảng điều hành sân", status: "READY", ready: true, hint: "12 sân vật lý" },
  { id: "champion", label: "Vô địch", status: "OFFLINE", ready: false, hint: "Chưa xác định — nội dung đang thi đấu" },
  { id: "sponsor", label: "Luân phiên nhà tài trợ", status: "READY", ready: true, hint: "12s / ô" },
  { id: "media", label: "Truyền thông / Video", status: "READY", ready: true, hint: "Highlight" },
];

export const FIXTURE_PRESENTATION_DEVICES = [
  { id: "led1", name: "LED Sân 1", context: "1920×1080 • Sân 1", status: "LIVE" },
  { id: "led2", name: "LED Sân 2", context: "1920×1080 • Sân 3", status: "READY" },
  { id: "tv", name: "TV sảnh", context: "3840×2160 • Sảnh", status: "READY" },
  { id: "director", name: "Xem trước điều hành", context: "1280×720 • Điều hành", status: "LIVE" },
  { id: "obs", name: "Đầu ra OBS", context: "1920×1080 • NDI/Browser", status: "READY" },
];

export const FIXTURE_SPONSORS = [
  { id: "s1", name: "PICK_VN", slot: "Chính", duration: "12s", active: true },
  { id: "s2", name: "Yonex", slot: "Luân phiên 2", duration: "12s", active: false },
  { id: "s3", name: "Nam Long Courts", slot: "Luân phiên 3", duration: "8s", active: false },
];

export const FIXTURE_PODIUM_BY_EVENT = {
  "md-35": [
    { place: "VÔ ĐỊCH", pair: "TBD", status: "NOT_READY", rank: 1 },
    { place: "Á QUÂN", pair: "TBD", status: "NOT_READY", rank: 2 },
    { place: "HẠNG BA", pair: "TBD", status: "NOT_READY", rank: 3 },
  ],
  "md-40": [
    { place: "VÔ ĐỊCH", pair: "Thảo KV / Quốc Khánh", status: "CONFIRMED", rank: 1 },
    { place: "Á QUÂN", pair: "Tiến Đạt / Văn Bình", status: "CONFIRMED", rank: 2 },
    { place: "HẠNG BA", pair: "Pair 40-C / Pair 40-D", status: "CONFIRMED", rank: 3 },
  ],
  "wd-35": [
    { place: "VÔ ĐỊCH", pair: "Lan Anh / Mỹ Linh", status: "CONFIRMED", rank: 1 },
    { place: "Á QUÂN", pair: "Diệu Linh / Hà My", status: "CONFIRMED", rank: 2 },
    { place: "HẠNG BA", pair: "Pair WD-C", status: "CONFIRMED", rank: 3 },
  ],
  "mx-35": [
    { place: "VÔ ĐỊCH", pair: "TBD", status: "NOT_READY", rank: 1 },
    { place: "Á QUÂN", pair: "TBD", status: "NOT_READY", rank: 2 },
    { place: "HẠNG BA", pair: "TBD", status: "NOT_READY", rank: 3 },
  ],
  "mx-open": [
    { place: "VÔ ĐỊCH", pair: "TBD", status: "NOT_READY", rank: 1 },
    { place: "Á QUÂN", pair: "TBD", status: "NOT_READY", rank: 2 },
    { place: "HẠNG BA", pair: "TBD", status: "NOT_READY", rank: 3 },
  ],
};

export const FIXTURE_SPECIAL_AWARDS = [
  { id: "mvp", place: "MVP", pair: "Minh Quân", event: "Đôi nam 3.5", assigned: true },
  { id: "fair", place: "Giải Fair Play", pair: "Lan Anh / Minh Trí", event: "Mixed 3.5", assigned: true },
  { id: "best", place: "Trận đấu ấn tượng", pair: "A-18", event: "Đôi nam 3.5", assigned: true },
  { id: "seed", place: "Hạt giống số 1", pair: "Minh Quân / Hoàng Nam", event: "Đôi nam 3.5", assigned: true },
  { id: "break", place: "VĐV / Cặp tiến bộ nổi bật", pair: "Lan Anh / Minh Trí", event: "Mixed 3.5", assigned: true },
];

export const FIXTURE_AWARDS = [
  { place: "Vô địch", pair: "TBD", event: "Đôi nam 3.5" },
  { place: "Á quân", pair: "TBD", event: "Đôi nam 3.5" },
  { place: "Hạng ba", pair: "TBD", event: "Đôi nam 3.5" },
  { place: "MVP", pair: "Minh Quân", event: "Đôi nam 3.5" },
  { place: "Giải Fair Play", pair: "Lan Anh / Minh Trí", event: "Mixed 3.5" },
  { place: "Trận đấu ấn tượng", pair: "A-18", event: "Đôi nam 3.5" },
  { place: "Hạt giống số 1", pair: "Minh Quân / Hoàng Nam", event: "Đôi nam 3.5" },
  { place: "VĐV / Cặp tiến bộ nổi bật", pair: "Lan Anh / Minh Trí", event: "Mixed 3.5" },
];

export const FIXTURE_EVENT_COMPLETION = [
  { id: "md-35", name: "Đôi nam 3.5", status: "IN_PROGRESS", matchesTerminal: false, done: 52, total: 90, officialResult: false, standings: false, awards: false, eventComplete: false },
  { id: "md-40", name: "Đôi nam 4.0", status: "COMPLETED", matchesTerminal: true, done: 56, total: 56, officialResult: true, standings: true, awards: true, eventComplete: true },
  { id: "wd-35", name: "Đôi nữ 3.5", status: "COMPLETED", matchesTerminal: true, done: 28, total: 28, officialResult: true, standings: true, awards: true, eventComplete: true },
  { id: "mx-35", name: "Mixed 3.5", status: "IN_PROGRESS", matchesTerminal: false, done: 24, total: 56, officialResult: false, standings: false, awards: false, eventComplete: false },
  { id: "mx-open", name: "Mixed Open", status: "NOT_READY", matchesTerminal: false, done: 0, total: 38, officialResult: false, standings: false, awards: false, eventComplete: false },
];

export function summarizeEventCompletion(events = FIXTURE_EVENT_COMPLETION) {
  const totalMatches = events.reduce((sum, item) => sum + item.total, 0);
  const terminalMatches = events.reduce((sum, item) => sum + item.done, 0);
  const completedEvents = events.filter((item) => item.status === "COMPLETED").length;
  const activeEvents = events.filter((item) => item.status !== "COMPLETED");
  const pendingOfficial = events.filter((item) => !item.officialResult).length;
  return {
    totalMatches,
    terminalMatches,
    remainingMatches: totalMatches - terminalMatches,
    completedEvents,
    activeEventCount: activeEvents.length,
    pendingOfficial,
    activeEventNames: activeEvents.map((item) => item.name).join(" • "),
    eventCount: events.length,
  };
}

const CLOSE_TOTALS = summarizeEventCompletion();

export const FIXTURE_CLOSE_BLOCKERS = [
  { id: "matches", label: `${CLOSE_TOTALS.remainingMatches} trận còn lại`, detail: `${CLOSE_TOTALS.terminalMatches}/${CLOSE_TOTALS.totalMatches} đã kết thúc`, to: "matches" },
  { id: "events", label: `${CLOSE_TOTALS.activeEventCount} nội dung vẫn đang diễn ra`, detail: CLOSE_TOTALS.activeEventNames, to: "awards" },
  { id: "incidents", label: "4 sự cố mở", detail: "Trung tâm xử lý sự cố", to: "exceptions" },
  { id: "standings", label: "BXH chưa khóa", detail: "Màn Kết quả & BXH — Khóa BXH", to: "standings" },
  { id: "awards", label: "Giải thưởng chưa công bố", detail: "Màn giải thưởng", to: "awards" },
];

export const FIXTURE_CLOSE_READINESS = [
  { label: "Tất cả trận đã kết thúc", ready: CLOSE_TOTALS.remainingMatches === 0, note: `${CLOSE_TOTALS.remainingMatches} trận còn lại (${CLOSE_TOTALS.terminalMatches}/${CLOSE_TOTALS.totalMatches})` },
  { label: "Tất cả nội dung đã hoàn tất", ready: CLOSE_TOTALS.activeEventCount === 0, note: `${CLOSE_TOTALS.completedEvents}/${CLOSE_TOTALS.eventCount} nội dung đã hoàn tất • ${CLOSE_TOTALS.activeEventCount} còn lại` },
  { label: "Không kết quả chính thức chờ xác nhận", ready: CLOSE_TOTALS.pendingOfficial === 0, note: CLOSE_TOTALS.pendingOfficial ? `${CLOSE_TOTALS.pendingOfficial} nội dung chưa xác nhận` : "Đạt" },
  { label: "BXH chung cuộc đã khóa", ready: false, note: "Chưa Khóa BXH" },
  { label: "Không sự cố chặn", ready: false, note: "4 sự cố mở" },
  { label: "Giải thưởng đã công bố", ready: false, note: "Chưa Công bố giải thưởng" },
];
