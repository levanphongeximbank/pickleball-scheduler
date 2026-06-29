export const VISUAL_MODES = {
  PROFESSIONAL: "professional",
  CLASSIC: "classic",
  CEREMONY: "ceremony",
};

export const ANIMATION_SPEEDS = {
  slow: { key: "slow", label: "Chậm", multiplier: 1.55 },
  normal: { key: "normal", label: "Bình thường", multiplier: 1 },
  fast: { key: "fast", label: "Nhanh", multiplier: 0.62 },
};

export const GROUP_THEME = {
  A: { main: "#2e7d32", light: "#e8f5e9", label: "Bảng A" },
  B: { main: "#1565c0", light: "#e3f2fd", label: "Bảng B" },
  C: { main: "#6a1b9a", light: "#f3e5f5", label: "Bảng C" },
  D: { main: "#ef6c00", light: "#fff3e0", label: "Bảng D" },
};

export function getGroupTheme(label = "A") {
  const key = String(label || "A").trim().charAt(0).toUpperCase();
  return GROUP_THEME[key] || {
    main: "#455a64",
    light: "#eceff1",
    label: `Bảng ${key}`,
  };
}

export function getDailyFairMatchTiming(speedKey = "normal") {
  const multiplier = ANIMATION_SPEEDS[speedKey]?.multiplier ?? 1;

  return {
    analyzeMs: Math.round(1400 * multiplier),
    teamRevealMs: Math.round(1100 * multiplier),
    vsMs: Math.round(1000 * multiplier),
    fairnessMs: Math.round(1200 * multiplier),
    courtMs: Math.round(900 * multiplier),
    confirmMs: Math.round(1000 * multiplier),
    flyMs: Math.round(1300 * multiplier),
    gapMs: Math.round(800 * multiplier),
  };
}

export function getScaledTiming(speedKey = "normal") {
  const multiplier = ANIMATION_SPEEDS[speedKey]?.multiplier ?? 1;

  return {
    shuffleMs: Math.round(2000 * multiplier),
    pickMs: Math.round(400 * multiplier),
    spotlightMs: Math.round(2400 * multiplier),
    flyMs: Math.round(1800 * multiplier),
    gapMs: Math.round(700 * multiplier),
    pairingSpotlightMs: Math.round(2200 * multiplier),
    pairingFlyMs: Math.round(1200 * multiplier),
    pairingGroupPauseMs: Math.round(1800 * multiplier),
    summaryMs: Math.round(1800 * multiplier),
  };
}

export function getSnakeFlowLabels(groupCount = 4) {
  const count = Math.max(1, Number(groupCount) || 1);
  const labels = Array.from({ length: count }, (_, index) =>
    String.fromCharCode(65 + index)
  );

  return [...labels, ...[...labels].reverse().slice(1)];
}
