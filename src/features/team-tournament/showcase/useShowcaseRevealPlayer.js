import { useCallback, useEffect, useRef, useState } from "react";

import { SHOWCASE_REVEAL_STEP_MS } from "./showcaseConstants.js";

/**
 * Drives a self-contained full-screen reveal.
 *
 * Reveals `total` frozen steps one at a time (~2s each), then holds at the end
 * until the operator continues or closes. Pause/resume and reduced-motion only
 * change the pace — never the underlying frozen result.
 */
export function useShowcaseRevealPlayer({
  total = 0,
  reducedMotion = false,
  autoStart = true,
  stepMs = SHOWCASE_REVEAL_STEP_MS,
} = {}) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Restart whenever the sequence identity (length) changes.
    setRevealedCount(0);
    setPaused(false);
  }, [total]);

  useEffect(() => {
    if (!autoStart) return undefined;
    if (paused) return undefined;
    if (revealedCount >= total) return undefined;

    if (reducedMotion) {
      // Snap straight to the final hold without per-step animation.
      setRevealedCount(total);
      return undefined;
    }

    timerRef.current = window.setTimeout(() => {
      setRevealedCount((count) => Math.min(count + 1, total));
    }, revealedCount === 0 ? Math.min(stepMs, 900) : stepMs);

    return clearTimer;
  }, [
    autoStart,
    paused,
    revealedCount,
    total,
    reducedMotion,
    stepMs,
    clearTimer,
  ]);

  const pause = useCallback(() => {
    clearTimer();
    setPaused(true);
  }, [clearTimer]);

  const resume = useCallback(() => {
    setPaused(false);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((value) => {
      if (!value) clearTimer();
      return !value;
    });
  }, [clearTimer]);

  const skipToEnd = useCallback(() => {
    clearTimer();
    setPaused(false);
    setRevealedCount(total);
  }, [clearTimer, total]);

  const restart = useCallback(() => {
    clearTimer();
    setPaused(false);
    setRevealedCount(0);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    revealedCount,
    paused,
    isComplete: revealedCount >= total,
    pause,
    resume,
    togglePause,
    skipToEnd,
    restart,
  };
}
