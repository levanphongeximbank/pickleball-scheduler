import { useCallback, useMemo, useRef, useState } from "react";

import { getScaledTiming } from "../animationConfig.js";
import { getGroupMatchRanges, prefersReducedMotion } from "../animationUtils.js";
import { clearAnimationTimer, createAnimationWait } from "../shared/animationWait.js";

export const PAIRING_CONTROL_MODES = {
  MANUAL: "manual",
  AUTO: "auto",
};

export const PAIRING_PHASES = {
  IDLE: "idle",
  SHUFFLE: "shuffle",
  REVEAL: "reveal",
  FLY: "fly",
  GROUP_PAUSE: "group_pause",
  COMPLETE: "complete",
};

export function usePairingSequence({
  steps = [],
  speed = "normal",
  controlMode = PAIRING_CONTROL_MODES.MANUAL,
  autoNextGroup = false,
  onComplete,
}) {
  const timing = getScaledTiming(speed);
  const ranges = useMemo(() => getGroupMatchRanges(steps), [steps]);

  const [phase, setPhase] = useState(PAIRING_PHASES.IDLE);
  const [revealedCount, setRevealedCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [waitingGroupAdvance, setWaitingGroupAdvance] = useState(false);
  const [mode, setMode] = useState(controlMode);
  const [autoAdvanceGroups, setAutoAdvanceGroups] = useState(autoNextGroup);

  const revealedCountRef = useRef(0);
  const pausedRef = useRef(false);
  const timerRef = useRef(null);
  const runningRef = useRef(false);
  const modeRef = useRef(mode);
  const autoAdvanceRef = useRef(autoAdvanceGroups);

  modeRef.current = mode;
  autoAdvanceRef.current = autoAdvanceGroups;

  const clearTimer = () => clearAnimationTimer(timerRef);

  const wait = useCallback(createAnimationWait(timerRef, pausedRef), []);

  const finishIfDone = useCallback(() => {
    if (revealedCountRef.current >= steps.length) {
      setPhase(PAIRING_PHASES.COMPLETE);
      setPlaying(false);
      setWaitingGroupAdvance(false);
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

    setPhase(PAIRING_PHASES.SHUFFLE);
    await wait(timing.shuffleMs);

    setPhase(PAIRING_PHASES.REVEAL);
    await wait(timing.pairingSpotlightMs);

    setPhase(PAIRING_PHASES.FLY);
    await wait(timing.pairingFlyMs);

    const nextCount = index + 1;
    revealedCountRef.current = nextCount;
    setRevealedCount(nextCount);

    if (finishIfDone()) {
      return false;
    }

    const rangeEnded = ranges.some((range) => nextCount === range.end);
    if (rangeEnded) {
      if (modeRef.current === PAIRING_CONTROL_MODES.MANUAL || !autoAdvanceRef.current) {
        setWaitingGroupAdvance(true);
        setPhase(PAIRING_PHASES.GROUP_PAUSE);
        setPlaying(false);
        runningRef.current = false;
        return false;
      }

      setPhase(PAIRING_PHASES.GROUP_PAUSE);
      await wait(timing.pairingGroupPauseMs);
      setWaitingGroupAdvance(false);
      setPhase(PAIRING_PHASES.IDLE);
      return true;
    }

    setPhase(PAIRING_PHASES.IDLE);
    return true;
  }, [steps.length, ranges, timing, wait, finishIfDone]);

  const runAutoChain = useCallback(async () => {
    if (runningRef.current || waitingGroupAdvance) {
      return;
    }

    runningRef.current = true;
    setPlaying(true);

    let canContinue = true;
    while (
      canContinue &&
      revealedCountRef.current < steps.length &&
      modeRef.current === PAIRING_CONTROL_MODES.AUTO &&
      !pausedRef.current
    ) {
      canContinue = await executeReveal();
      if (canContinue && revealedCountRef.current < steps.length) {
        await wait(timing.gapMs);
      }
    }

    if (!finishIfDone()) {
      runningRef.current = false;
      if (!waitingGroupAdvance) {
        setPlaying(false);
      }
    }
  }, [executeReveal, finishIfDone, steps.length, timing.gapMs, wait, waitingGroupAdvance]);

  const revealNext = useCallback(async () => {
    if (waitingGroupAdvance || revealedCountRef.current >= steps.length) {
      return;
    }

    setPlaying(true);
    runningRef.current = true;
    const canContinue = await executeReveal();
    runningRef.current = false;

    if (!canContinue) {
      return;
    }

    if (modeRef.current === PAIRING_CONTROL_MODES.AUTO) {
      await wait(timing.gapMs);
      runAutoChain();
      return;
    }

    setPlaying(false);
  }, [executeReveal, runAutoChain, steps.length, timing.gapMs, wait, waitingGroupAdvance]);

  const startAuto = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);
    setMode(PAIRING_CONTROL_MODES.AUTO);
    modeRef.current = PAIRING_CONTROL_MODES.AUTO;

    if (prefersReducedMotion()) {
      revealedCountRef.current = steps.length;
      setRevealedCount(steps.length);
      setPhase(PAIRING_PHASES.COMPLETE);
      onComplete?.();
      return;
    }

    if (waitingGroupAdvance) {
      return;
    }

    runAutoChain();
  }, [onComplete, runAutoChain, steps.length, waitingGroupAdvance]);

  const goToNextGroup = useCallback(() => {
    setWaitingGroupAdvance(false);
    setPhase(PAIRING_PHASES.SHUFFLE);

    if (modeRef.current === PAIRING_CONTROL_MODES.AUTO) {
      runAutoChain();
      return;
    }

    setPlaying(false);
  }, [runAutoChain]);

  const skip = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);
    runningRef.current = false;
    revealedCountRef.current = steps.length;
    setRevealedCount(steps.length);
    setWaitingGroupAdvance(false);
    setPhase(PAIRING_PHASES.COMPLETE);
    setPlaying(false);
  }, [steps.length]);

  const replay = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);
    runningRef.current = false;
    revealedCountRef.current = 0;
    setRevealedCount(0);
    setWaitingGroupAdvance(false);
    setPhase(PAIRING_PHASES.IDLE);
    setPlaying(false);
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);

    if (modeRef.current === PAIRING_CONTROL_MODES.AUTO && !waitingGroupAdvance) {
      runAutoChain();
    }
  }, [runAutoChain, waitingGroupAdvance]);

  const viewResultsNow = useCallback(() => {
    skip();
  }, [skip]);

  const currentStep =
    revealedCount < steps.length && phase !== PAIRING_PHASES.COMPLETE
      ? steps[revealedCount]
      : null;

  const currentGroup = useMemo(() => {
    const index = Math.min(Math.max(revealedCount, 0), Math.max(steps.length - 1, 0));
    if (!steps[index]) {
      return null;
    }

    return {
      id: steps[index].groupId,
      label: steps[index].groupLabel,
      name: steps[index].groupName,
    };
  }, [steps, revealedCount]);

  const completedGroupRange = useMemo(() => {
    if (!waitingGroupAdvance) {
      return null;
    }

    return ranges.find((range) => revealedCount === range.end) || null;
  }, [waitingGroupAdvance, revealedCount, ranges]);

  const nextGroupRange = useMemo(() => {
    if (!waitingGroupAdvance) {
      return null;
    }

    return ranges.find((range) => range.start === revealedCount) || null;
  }, [waitingGroupAdvance, revealedCount, ranges]);

  return {
    phase,
    revealedCount,
    totalCount: steps.length,
    currentStep,
    currentGroup,
    completedGroupRange,
    nextGroupRange,
    ranges,
    paused,
    playing,
    waitingGroupAdvance,
    controlMode: mode,
    autoNextGroup: autoAdvanceGroups,
    setControlMode: setMode,
    setAutoNextGroup: setAutoAdvanceGroups,
    revealNext,
    startAuto,
    goToNextGroup,
    skip,
    replay,
    pause,
    resume,
    viewResultsNow,
    PHASES: PAIRING_PHASES,
    isComplete: phase === PAIRING_PHASES.COMPLETE || revealedCount >= steps.length,
  };
}
