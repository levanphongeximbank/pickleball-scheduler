import { ANIMATION_MODES } from "../animationUtils.js";

export const FLOW_MODES = Object.freeze({
  GUIDED: "guided",
  STANDALONE: "standalone",
});

export const ANIMATION_TO_FLOW_KEY = Object.freeze({
  [ANIMATION_MODES.PAIRING_REVEAL]: "pairing",
  [ANIMATION_MODES.RANDOM_DRAW]: "draw",
  [ANIMATION_MODES.SNAKE_GROUP]: "draw",
  [ANIMATION_MODES.GROUP_MATCH_PAIRING]: "match_pairing",
  [ANIMATION_MODES.BRACKET_REVEAL]: "bracket",
});

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

export function resolveGuidedPipeline({ includeBracket = true } = {}) {
  const pipeline = [
    ANIMATION_MODES.PAIRING_REVEAL,
    ANIMATION_MODES.SNAKE_GROUP,
    ANIMATION_MODES.GROUP_MATCH_PAIRING,
  ];

  if (includeBracket) {
    pipeline.push(ANIMATION_MODES.BRACKET_REVEAL);
  }

  return pipeline;
}

export function resolveOfficialOpenPipeline({ includeBracket = true } = {}) {
  const pipeline = [
    ANIMATION_MODES.RANDOM_DRAW,
    ANIMATION_MODES.GROUP_MATCH_PAIRING,
  ];

  if (includeBracket) {
    pipeline.push(ANIMATION_MODES.BRACKET_REVEAL);
  }

  return pipeline;
}

export function getFlowStepLabel(stepKey) {
  return TOURNAMENT_FLOW_STEPS.find((step) => step.key === stepKey)?.label || stepKey;
}

export function isGuidedFlow(flowMode) {
  return flowMode === FLOW_MODES.GUIDED;
}

/** Giây đếm ngược giữa các bước trình chiếu. */
export const FLOW_HANDOFF_COUNTDOWN_SEC = 3;

const PREPARATION_BY_NEXT_STEP = Object.freeze({
  [FLOW_STEP_KEYS.DRAW]: "Chuẩn bị ghép bảng",
  [FLOW_STEP_KEYS.MATCH_PAIRING]: "Chuẩn bị ghép trận đấu",
  [FLOW_STEP_KEYS.BRACKET]: "Tính toán sơ đồ thi đấu",
});

export function getFlowPreparationMessage(nextStepKey) {
  return PREPARATION_BY_NEXT_STEP[nextStepKey] || `Chuẩn bị ${getFlowStepLabel(nextStepKey).toLowerCase()}`;
}
