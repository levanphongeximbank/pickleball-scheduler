import { useCallback, useRef, useState } from "react";

import { getDailyFairMatchTiming } from "../animationConfig.js";
import { prefersReducedMotion } from "../animationUtils.js";
import { clearAnimationTimer, createAnimationWait } from "../shared/animationWait.js";
import { FAIR_MATCH_PHASES } from "./dailyFairMatchUtils.js";

export const FAIR_MATCH_CONTROL_MODES = {
  MANUAL: "manual",
  AUTO: "auto",
};

export function useFairMatchSequence({
  steps = [],
  speed = "normal",
  controlMode = FAIR_MATCH_CONTROL_MODES.AUTO,
  onComplete,
}) {
  const timing = getDailyFairMatchTiming(speed);

  const [phase, setPhase] = useState(FAIR_MATCH_PHASES.IDLE);
  const [revealedCount, setRevealedCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState(controlMode);

  const revealedCountRef = useRef(0);
  const pausedRef = useRef(false);
  const timerRef = useRef(null);
  const runningRef = useRef(false);
  const modeRef = useRef(mode);

  modeRef.current = mode;

  const clearTimer = () => clearAnimationTimer(timerRef);

  const wait = useCallback(createAnimationWait(timerRef, pausedRef), []);

  const finishIfDone = useCallback(() => {
    if (revealedCountRef.current >= steps.length) {
      setPhase(FAIR_MATCH_PHASES.COMPLETE);
      setPlaying(false);
      runningRef.current = false;
      onComplete?.();
      return true;
    }

    return false;
  }, [steps.length, onComplete]);

  const executeReveal = useCallback(async () => {
    const index = revealedCountRef.current;
    if (index >= steps.length) {
      return false;
    }

    setPhase(FAIR_MATCH_PHASES.ANALYZE);
    await wait(timing.analyzeMs);

    setPhase(FAIR_MATCH_PHASES.TEAM_A);
    await wait(timing.teamRevealMs);

    setPhase(FAIR_MATCH_PHASES.TEAM_B);
    await wait(timing.teamRevealMs);

    setPhase(FAIR_MATCH_PHASES.VS);
    await wait(timing.vsMs);

    setPhase(FAIR_MATCH_PHASES.FAIRNESS);
    await wait(timing.fairnessMs);

    setPhase(FAIR_MATCH_PHASES.COURT);
    await wait(timing.courtMs);

    setPhase(FAIR_MATCH_PHASES.CONFIRM);
    await wait(timing.confirmMs);

    setPhase(FAIR_MATCH_PHASES.FLY);
    await wait(timing.flyMs);

    const nextCount = index + 1;
    revealedCountRef.current = nextCount;
    setRevealedCount(nextCount);

    if (finishIfDone()) {
      return false;
    }

    setPhase(FAIR_MATCH_PHASES.IDLE);
    return true;
  }, [steps.length, timing, wait, finishIfDone]);

  const runAutoChain = useCallback(async () => {
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;
    setPlaying(true);

    let canContinue = true;
    while (
      canContinue &&
      revealedCountRef.current < steps.length &&
      modeRef.current === FAIR_MATCH_CONTROL_MODES.AUTO &&
      !pausedRef.current
    ) {
      canContinue = await executeReveal();
      if (canContinue && revealedCountRef.current < steps.length) {
        await wait(timing.gapMs);
      }
    }

    if (!finishIfDone()) {
      runningRef.current = false;
      setPlaying(false);
    }
  }, [executeReveal, finishIfDone, steps.length, timing.gapMs, wait]);

  const revealNext = useCallback(async () => {
    if (revealedCountRef.current >= steps.length) {
      return;
    }

    setPlaying(true);
    runningRef.current = true;
    const canContinue = await executeReveal();
    runningRef.current = false;

    if (!canContinue) {
      return;
    }

    if (modeRef.current === FAIR_MATCH_CONTROL_MODES.AUTO) {
      await wait(timing.gapMs);
      runAutoChain();
      return;
    }

    setPlaying(false);
  }, [executeReveal, runAutoChain, steps.length, timing.gapMs, wait]);

  const startAuto = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);
    setMode(FAIR_MATCH_CONTROL_MODES.AUTO);
    modeRef.current = FAIR_MATCH_CONTROL_MODES.AUTO;

    if (prefersReducedMotion()) {
      revealedCountRef.current = steps.length;
      setRevealedCount(steps.length);
      setPhase(FAIR_MATCH_PHASES.COMPLETE);
      onComplete?.();
      return;
    }

    runAutoChain();
  }, [onComplete, runAutoChain, steps.length]);

  const skip = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);
    runningRef.current = false;
    revealedCountRef.current = steps.length;
    setRevealedCount(steps.length);
    setPhase(FAIR_MATCH_PHASES.COMPLETE);
    setPlaying(false);
  }, [steps.length]);

  const replay = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);
    runningRef.current = false;
    revealedCountRef.current = 0;
    setRevealedCount(0);
    setPhase(FAIR_MATCH_PHASES.IDLE);
    setPlaying(false);
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);

    if (modeRef.current === FAIR_MATCH_CONTROL_MODES.AUTO) {
      runAutoChain();
    }
  }, [runAutoChain]);

  const viewResultsNow = useCallback(() => {
    skip();
  }, [skip]);

  const currentStep =
    revealedCount < steps.length && phase !== FAIR_MATCH_PHASES.COMPLETE
      ? steps[revealedCount]
      : null;

  const currentMatchIndex =
    phase !== FAIR_MATCH_PHASES.COMPLETE && revealedCount < steps.length
      ? revealedCount
      : -1;

  return {
    phase,
    revealedCount,
    totalCount: steps.length,
    currentStep,
    currentMatchIndex,
    paused,
    playing,
    controlMode: mode,
    setControlMode: setMode,
    revealNext,
    startAuto,
    skip,
    replay,
    pause,
    resume,
    viewResultsNow,
    PHASES: FAIR_MATCH_PHASES,
    isComplete: phase === FAIR_MATCH_PHASES.COMPLETE || revealedCount >= steps.length,
  };
}
