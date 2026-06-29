/** Shared pause-aware delay — fewer timer ticks than 80ms slicing. */
export function createAnimationWait(timerRef, pausedRef) {
  return function wait(ms) {
    return new Promise((resolve) => {
      let remaining = Math.max(0, ms);
      let lastTick = Date.now();

      const tick = () => {
        if (pausedRef.current) {
          timerRef.current = setTimeout(tick, 150);
          return;
        }

        const now = Date.now();
        remaining -= now - lastTick;
        lastTick = now;

        if (remaining <= 0) {
          timerRef.current = null;
          resolve();
          return;
        }

        timerRef.current = setTimeout(tick, Math.min(remaining, 250));
      };

      lastTick = Date.now();
      timerRef.current = setTimeout(tick, Math.min(remaining, 250));
    });
  };
}

export function clearAnimationTimer(timerRef) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}
