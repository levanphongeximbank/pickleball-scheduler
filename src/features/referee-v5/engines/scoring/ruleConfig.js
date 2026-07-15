export function buildRuleConfig(state, overrides = {}) {
  return {
    pointsToWin: overrides.pointsToWin ?? state.pointsToWin,
    winBy: overrides.winBy ?? state.winBy,
    maximumScore: overrides.maximumScore ?? state.maximumScore,
    sideOutInitialServerSide: overrides.sideOutInitialServerSide,
    sideSwitchAt: overrides.sideSwitchAt,
  };
}
