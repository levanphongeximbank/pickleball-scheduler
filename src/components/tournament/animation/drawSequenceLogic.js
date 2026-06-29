export const DRAW_CONTROL_MODES = {
  MANUAL: "manual",
  AUTO: "auto",
};

export const DRAW_PHASES = {
  IDLE: "idle",
  SHUFFLE: "shuffle",
  SPOTLIGHT: "spotlight",
  FLY: "fly",
  SUMMARY: "summary",
  DONE: "done",
};

/**
 * Per-turn timing budgets for draw/pairing reveal animations.
 * Targets: fast 600–800ms, normal 1000–1400ms, slow 1600–2200ms per lượt.
 */
export function getDrawSequenceTiming(speedKey = "normal") {
  const presets = {
    fast: { shuffle: 150, spotlight: 250, fly: 200, gap: 150, summary: 400 },
    normal: { shuffle: 250, spotlight: 450, fly: 350, gap: 350, summary: 600 },
    slow: { shuffle: 400, spotlight: 700, fly: 550, gap: 450, summary: 800 },
  };

  const base = presets[speedKey] || presets.normal;

  return {
    shuffleMs: base.shuffle,
    spotlightMs: base.spotlight,
    flyMs: base.fly,
    gapMs: base.gap,
    pickMs: base.gap,
    summaryMs: base.summary,
  };
}

export function getDrawTurnTotalMs(speedKey = "normal") {
  const timing = getDrawSequenceTiming(speedKey);
  return timing.shuffleMs + timing.spotlightMs + timing.flyMs + timing.gapMs;
}

/**
 * Pure auto-chain runner — used by useDrawSequence and tests.
 */
export async function runDrawAutoChain({
  steps = [],
  timing,
  wait,
  getState,
  setState,
  onComplete,
}) {
  if (getState().running) {
    return getState();
  }

  setState({ running: true, playing: true });

  while (getState().placedCount < steps.length && getState().controlMode === DRAW_CONTROL_MODES.AUTO) {
    const index = getState().placedCount;

    setState({ currentIndex: index, phase: DRAW_PHASES.SHUFFLE });
    await wait(timing.shuffleMs);

    setState({ phase: DRAW_PHASES.SPOTLIGHT });
    await wait(timing.spotlightMs);

    setState({ phase: DRAW_PHASES.FLY });
    await wait(timing.flyMs);

    const nextCount = index + 1;
    setState({ placedCount: nextCount });

    if (nextCount >= steps.length) {
      break;
    }

    await wait(timing.gapMs);
  }

  if (getState().placedCount >= steps.length) {
    setState({ phase: DRAW_PHASES.SUMMARY });
    await wait(timing.summaryMs);
    setState({ phase: DRAW_PHASES.DONE, playing: false, running: false });
    onComplete?.();
    return getState();
  }

  setState({ playing: false, running: false });
  return getState();
}

export async function runDrawManualStep({
  steps = [],
  timing,
  wait,
  getState,
  setState,
  onComplete,
}) {
  if (getState().running || getState().placedCount >= steps.length) {
    return getState();
  }

  setState({ running: true, playing: true });

  const index = getState().placedCount;

  setState({ currentIndex: index, phase: DRAW_PHASES.SHUFFLE });
  await wait(index === 0 ? timing.shuffleMs : timing.gapMs);

  setState({ phase: DRAW_PHASES.SPOTLIGHT });
  await wait(timing.spotlightMs);

  setState({ phase: DRAW_PHASES.FLY });
  await wait(timing.flyMs);

  const nextCount = index + 1;
  setState({ placedCount: nextCount });

  if (nextCount >= steps.length) {
    setState({ phase: DRAW_PHASES.SUMMARY });
    await wait(timing.summaryMs);
    setState({ phase: DRAW_PHASES.DONE, playing: false, running: false });
    onComplete?.();
    return getState();
  }

  setState({ playing: false, running: false, phase: DRAW_PHASES.IDLE });
  return getState();
}
