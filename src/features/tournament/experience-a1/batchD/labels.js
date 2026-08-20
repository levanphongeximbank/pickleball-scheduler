export const BRACKET_ROUND_LABEL = {
  R32: "Vòng 32",
  R16: "Vòng 16",
  QF: "Tứ kết",
  SF: "Bán kết",
  Final: "Chung kết",
  Champion: "Vô địch",
};

const ROUND_NAME_TO_KEY = {
  "Vong 1/16": "R32",
  "Vòng 1/16": "R32",
  "Vong 1/8": "R16",
  "Vòng 1/8": "R16",
  "Tu ket": "QF",
  "Tứ kết": "QF",
  "Ban ket": "SF",
  "Bán kết": "SF",
  "Chung ket": "Final",
  "Chung kết": "Final",
  R32: "R32",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  Final: "Final",
  Champion: "Champion",
};

export function displayBracketRoundLabel(round) {
  const key = BRACKET_ROUND_LABEL[round] ? round : ROUND_NAME_TO_KEY[round] || round;
  return BRACKET_ROUND_LABEL[key] || String(round || "");
}

export function bracketRoundKey(name) {
  const raw = String(name || "").trim();
  return ROUND_NAME_TO_KEY[raw] || (BRACKET_ROUND_LABEL[raw] ? raw : "");
}

export function displayCompetitorLabel(value) {
  if (value == null || value === "") return "Chưa xác định";
  if (value === "TBD") return "Chưa xác định";
  if (value === "BYE" || value === "Bye" || value === "Miễn") return "Miễn";
  const text = String(value);
  if (text.startsWith("Winner ")) {
    const rest = text.slice(7);
    return `Thắng ${displayBracketRoundLabel(rest) || rest}`;
  }
  if (text.startsWith("W(") && text.endsWith(")")) {
    return `Thắng ${text.slice(2, -1)}`;
  }
  return text;
}

export function matchStatusTone(status) {
  if (status === "live") return "live";
  if (status === "completed") return "success";
  if (status === "attention" || status === "conflict") return "warning";
  if (status === "upcoming") return "info";
  return "draft";
}

export function matchStatusLabel(status) {
  if (status === "live") return "ĐANG THI ĐẤU";
  if (status === "completed") return "HOÀN TẤT";
  if (status === "attention") return "CẦN XỬ LÝ";
  if (status === "upcoming") return "TIẾP THEO";
  if (status === "waiting") return "ĐANG CHỜ";
  return "ĐANG CHỜ";
}
