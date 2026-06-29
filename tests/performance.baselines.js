export const PERF_SCENARIOS = [
  { name: "small_10_courts", courtCount: 10 },
  { name: "medium_20_courts", courtCount: 20 },
  { name: "large_40_courts", courtCount: 40 },
];

// Baselines are intentionally conservative to avoid flaky failures on slower machines.
export const PERF_BASELINES_MS = {
  small_10_courts: 3000,
  medium_20_courts: 5000,
  large_40_courts: 8000,
};
