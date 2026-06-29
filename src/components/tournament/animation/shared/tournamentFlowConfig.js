export const TOURNAMENT_FLOW_STEPS = [
  { key: "pairing", label: "Đề xuất ghép cặp" },
  { key: "draw", label: "Chia bảng" },
  { key: "match_pairing", label: "Ghép cặp thi đấu" },
  { key: "bracket", label: "Sơ đồ thi đấu" },
  { key: "results", label: "Nhập kết quả" },
];

export const FLOW_STEP_KEYS = {
  PAIRING: "pairing",
  DRAW: "draw",
  MATCH_PAIRING: "match_pairing",
  BRACKET: "bracket",
  SCHEDULE: "bracket",
  RESULTS: "results",
};

export function getFlowStepState(activeKey, stepKey) {
  const order = TOURNAMENT_FLOW_STEPS.map((step) => step.key);
  const activeIndex = order.indexOf(activeKey);
  const stepIndex = order.indexOf(stepKey);

  if (stepIndex < 0 || activeIndex < 0) {
    return "pending";
  }

  if (stepIndex < activeIndex) {
    return "done";
  }

  if (stepIndex === activeIndex) {
    return "active";
  }

  return "pending";
}
