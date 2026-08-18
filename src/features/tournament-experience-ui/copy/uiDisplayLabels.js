/** Prototype UI display labels only. Canonical tokens remain English. */

export const PROTOTYPE_BANNER_TEXT =
  "Nguyên mẫu UX Giải đấu — chỉ dùng dữ liệu mẫu. Không ghi dữ liệu môi trường thật.";

const STATUS_DISPLAY = {
  LIVE: "ĐANG THI ĐẤU",
  live: "ĐANG THI ĐẤU",
  NEXT: "TIẾP THEO",
  upcoming: "SẮP TỚI",
  AVAILABLE: "SẴN SÀNG",
  READY: "SẴN SÀNG",
  WAITING: "ĐANG CHỜ",
  DELAY: "TRỄ",
  MAINTENANCE: "BẢO TRÌ",
  COMPLETED: "HOÀN TẤT",
  completed: "HOÀN TẤT",
  ATTENTION: "CẦN XỬ LÝ",
  attention: "CẦN XỬ LÝ",
  DRAFT: "BẢN NHÁP",
  Draft: "Bản nháp",
  LOCKED: "ĐÃ KHÓA",
  PAUSED: "TẠM DỪNG",
  OFFLINE: "NGOẠI TUYẾN",
  IN_PROGRESS: "ĐANG DIỄN RA",
  NOT_READY: "CHƯA SẴN SÀNG",
  CONFIRMED: "ĐÃ XÁC NHẬN",
  ASSIGNED: "ĐÃ PHÂN CÔNG",
  Published: "Đã công bố",
  Ready: "Sẵn sàng",
  PASS: "ĐẠT",
  WARN: "CẢNH BÁO",
  Valid: "Hợp lệ",
  Warning: "Cảnh báo",
};

export function displayStatusLabel(token) {
  if (token == null || token === "") return "";
  if (STATUS_DISPLAY[token]) return STATUS_DISPLAY[token];
  const upper = String(token).toUpperCase();
  return STATUS_DISPLAY[upper] || STATUS_DISPLAY[token] || String(token);
}

export function displayYesNo(ok) {
  return ok ? "Có" : "Không";
}

export const BRACKET_ROUND_LABEL = {
  R32: "Vòng 32",
  R16: "Vòng 16",
  QF: "Tứ kết",
  SF: "Bán kết",
  Final: "Chung kết",
  Champion: "Vô địch",
};

export function displayBracketRoundLabel(round) {
  return BRACKET_ROUND_LABEL[round] || String(round || "");
}

export function displayCompetitorLabel(value) {
  if (value == null || value === "") return value;
  if (value === "TBD") return "Chưa xác định";
  if (value === "BYE" || value === "Bye") return "Miễn";
  if (String(value).startsWith("Winner ")) {
    const rest = String(value).slice(7);
    return `Thắng ${displayBracketRoundLabel(rest) || rest}`;
  }
  return value;
}
