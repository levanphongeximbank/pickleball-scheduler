import { useCallback, useEffect, useRef, useState } from "react";

import {
  DRAW_CONTROL_MODES,
  DRAW_PHASES,
  getDrawSequenceTiming,
  runDrawAutoChain,
  runDrawManualStep,
} from "./drawSequenceLogic.js";
import { prefersReducedMotion } from "./animationUtils.js";
import { clearAnimationTimer, createAnimationWait } from "./shared/animationWait.js";

export { DRAW_CONTROL_MODES };

export function useDrawSequence({
  steps = [],
  speed = "normal",
  controlMode = DRAW_CONTROL_MODES.AUTO,
  onComplete,
  autoStart = false,
}) {
  const timing = getDrawSequenceTiming(speed);
  const [phase, setPhase] = useState(DRAW_PHASES.IDLE);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [placedCount, setPlacedCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState(controlMode);

  const pausedRef = useRef(false);
  const timerRef = useRef(null);
  const runningRef = useRef(false);
  const playingRef = useRef(false);
  const modeRef = useRef(mode);
  const placedCountRef = useRef(0);
  const phaseRef = useRef(DRAW_PHASES.IDLE);

  modeRef.current = mode;
  placedCountRef.current = placedCount;
  playingRef.current = playing;
  phaseRef.current = phase;

  const clearTimer = () => clearAnimationTimer(timerRef);

  const wait = useCallback(createAnimationWait(timerRef, pausedRef), []);

  const getState = useCallback(
    () => ({
      placedCount: placedCountRef.current,
      currentIndex,
      phase: phaseRef.current,
      controlMode: modeRef.current,
      running: runningRef.current,
      playing: playingRef.current,
    }),
    [currentIndex]
  );

  const setState = useCallback((patch) => {
    if (patch.placedCount != null) {
      placedCountRef.current = patch.placedCount;
      setPlacedCount(patch.placedCount);
    }

    if (patch.currentIndex != null) {
      setCurrentIndex(patch.currentIndex);
    }

    if (patch.phase != null) {
      phaseRef.current = patch.phase;
      setPhase(patch.phase);
    }

    if (patch.playing != null) {
      playingRef.current = patch.playing;
      setPlaying(patch.playing);
    }

    if (patch.running != null) {
      runningRef.current = patch.running;
    }
  }, []);

  const runAuto = useCallback(async () => {
    await runDrawAutoChain({
      steps,
      timing,
      wait,
      getState,
      setState,
      onComplete,
    });
  }, [steps, timing, wait, getState, setState, onComplete]);

  const runManual = useCallback(async () => {
    await runDrawManualStep({
      steps,
      timing,
      wait,
      getState,
      setState,
      onComplete,
    });
  }, [steps, timing, wait, getState, setState, onComplete]);

  const resetToIdle = useCallback(() => {
    placedCountRef.current = 0;
    phaseRef.current = DRAW_PHASES.IDLE;
    runningRef.current = false;
    playingRef.current = false;
    setPlacedCount(0);
    setCurrentIndex(-1);
    setPhase(DRAW_PHASES.IDLE);
    setPlaying(false);
  }, []);

  const applyReducedMotion = useCallback(() => {
    placedCountRef.current = steps.length;
    phaseRef.current = DRAW_PHASES.DONE;
    runningRef.current = false;
    playingRef.current = false;
    setPlacedCount(steps.length);
    setCurrentIndex(steps.length - 1);
    setPhase(DRAW_PHASES.DONE);
    setPlaying(false);
    onComplete?.();
  }, [steps.length, onComplete]);

  const startAuto = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);

    if (prefersReducedMotion()) {
      applyReducedMotion();
      return;
    }

    if (placedCountRef.current >= steps.length) {
      return;
    }

    runAuto();
  }, [applyReducedMotion, runAuto, steps.length]);

  const start = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);

    if (prefersReducedMotion()) {
      applyReducedMotion();
      return;
    }

    if (modeRef.current === DRAW_CONTROL_MODES.MANUAL) {
      runManual();
      return;
    }

    if (placedCountRef.current > 0 && placedCountRef.current < steps.length) {
      startAuto();
      return;
    }

    resetToIdle();
    runAuto();
  }, [applyReducedMotion, runAuto, runManual, resetToIdle, startAuto, steps.length]);

  const revealNext = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);

    if (prefersReducedMotion()) {
      applyReducedMotion();
      return;
    }

    runManual();
  }, [applyReducedMotion, runManual]);

  const skip = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);
    runningRef.current = false;
    playingRef.current = false;
    placedCountRef.current = steps.length;
    phaseRef.current = DRAW_PHASES.DONE;
    setPlacedCount(steps.length);
    setCurrentIndex(steps.length - 1);
    setPhase(DRAW_PHASES.DONE);
    setPlaying(false);
  }, [steps.length]);

  const viewResultsNow = useCallback(() => {
    skip();
  }, [skip]);

  const replay = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);
    resetToIdle();

    if (modeRef.current === DRAW_CONTROL_MODES.AUTO) {
      runAuto();
      return;
    }
  }, [resetToIdle, runAuto]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);

    if (
      modeRef.current === DRAW_CONTROL_MODES.AUTO &&
      placedCountRef.current < steps.length &&
      !runningRef.current &&
      playingRef.current
    ) {
      runAuto();
    }
  }, [runAuto, steps.length]);

  useEffect(() => {
    if (autoStart) {
      startAuto();
    }

    return clearTimer;
  }, []);

  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;
  const isComplete = phase === DRAW_PHASES.DONE || placedCount >= steps.length;

  return {
    phase,
    currentIndex,
    currentStep,
    placedCount,
    totalCount: steps.length,
    paused,
    playing,
    isComplete,
    controlMode: mode,
    setControlMode: setMode,
    start,
    startAuto,
    revealNext,
    skip,
    viewResultsNow,
    replay,
    pause,
    resume,
    PHASES: DRAW_PHASES,
  };
}
