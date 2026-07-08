/** VPR placement keys — maps to point config rows. */
export const VPR_PLACEMENT = {
  CHAMPION: "champion",
  RUNNER_UP: "runner_up",
  SEMIFINAL: "semifinal",
  QUARTERFINAL: "quarterfinal",
  ROUND_16: "round_16",
  PARTICIPATION: "participation",
};

export const VPR_PLACEMENT_LABELS = {
  [VPR_PLACEMENT.CHAMPION]: "Vô địch",
  [VPR_PLACEMENT.RUNNER_UP]: "Á quân",
  [VPR_PLACEMENT.SEMIFINAL]: "Bán kết",
  [VPR_PLACEMENT.QUARTERFINAL]: "Tứ kết",
  [VPR_PLACEMENT.ROUND_16]: "Vòng 16",
  [VPR_PLACEMENT.PARTICIPATION]: "Tham gia",
};

/** Lower rank = better placement (for best_placement aggregate). */
export const VPR_PLACEMENT_RANK = {
  [VPR_PLACEMENT.CHAMPION]: 1,
  [VPR_PLACEMENT.RUNNER_UP]: 2,
  [VPR_PLACEMENT.SEMIFINAL]: 3,
  [VPR_PLACEMENT.QUARTERFINAL]: 4,
  [VPR_PLACEMENT.ROUND_16]: 5,
  [VPR_PLACEMENT.PARTICIPATION]: 6,
};
