import { useCallback, useRef, useState } from "react";

import { prefersReducedMotion } from "../animation/animationUtils.js";
import { clearAnimationTimer, createAnimationWait } from "../animation/shared/animationWait.js";
import { getBracketAnimationTiming } from "./bracketScreenUtils.js";

export const BRACKET_CONTROL_MODES = {
  AUTO: "auto",
  STEP: "step",
};

const PHASES = {
  IDLE: "idle",
  REVEAL: "reveal",
  ADVANCE: "advance",
  COMPLETE: "complete",
};

export function useBracketSequence({
  revealPlan = [],
  speed = "normal",
  onComplete,
}) {
  const timing = getBracketAnimationTiming(speed);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [visibleRoundIndex, setVisibleRoundIndex] = useState(-1);
  const [visibleMatchIndex, setVisibleMatchIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState(BRACKET_CONTROL_MODES.AUTO);
  const [skipped, setSkipped] = useState(false);
  const [connectorReveal, setConnectorReveal] = useState(0);

  const pausedRef = useRef(false);
  const runningRef = useRef(false);
  const timerRef = useRef(null);
  const modeRef = useRef(mode);

  modeRef.current = mode;

  const clearTimer = () => clearAnimationTimer(timerRef);

  const wait = useCallback(createAnimationWait(timerRef, pausedRef), []);

  const finish = useCallback(() => {
    setPhase(PHASES.COMPLETE);
    setPlaying(false);
    runningRef.current = false;
    onComplete?.();
  }, [onComplete]);

  const revealAll = useCallback(() => {
    const lastRound = revealPlan.length - 1;
    const lastMatch = revealPlan[lastRound]?.matches?.length
      ? revealPlan[lastRound].matches.length - 1
      : 0;
    setVisibleRoundIndex(lastRound);
    setVisibleMatchIndex(lastMatch);
    setConnectorReveal(1);
    setPhase(PHASES.COMPLETE);
    setPlaying(false);
    runningRef.current = false;
    setSkipped(true);
  }, [revealPlan]);

  const runAuto = useCallback(
    async (fromRound = 0, fromMatch = 0) => {
      if (runningRef.current || !revealPlan.length) {
        return;
      }

      runningRef.current = true;
      setPlaying(true);
      setSkipped(false);
      setPhase(PHASES.REVEAL);

      const totalMatches = revealPlan.reduce((sum, round) => sum + round.matches.length, 0);
      let revealedCount = 0;

      for (let roundIndex = 0; roundIndex < fromRound; roundIndex += 1) {
        revealedCount += revealPlan[roundIndex].matches.length;
      }
      revealedCount += fromMatch;

      for (let roundIndex = fromRound; roundIndex < revealPlan.length; roundIndex += 1) {
        const round = revealPlan[roundIndex];
        const matchStart = roundIndex === fromRound ? fromMatch : 0;

        for (let matchIndex = matchStart; matchIndex < round.matches.length; matchIndex += 1) {
          setVisibleRoundIndex(roundIndex);
          setVisibleMatchIndex(matchIndex);
          revealedCount += 1;
          setConnectorReveal(totalMatches ? revealedCount / totalMatches : 1);
          await wait(timing.matchMs);
        }

        await wait(timing.roundMs);
      }

      setConnectorReveal(1);
      finish();
    },
    [revealPlan, timing, wait, finish]
  );

  const revealNext = useCallback(async () => {
    if (runningRef.current || !revealPlan.length) {
      return;
    }

    runningRef.current = true;
    setPlaying(true);
    setPhase(PHASES.REVEAL);

    let nextRound = visibleRoundIndex < 0 ? 0 : visibleRoundIndex;
    let nextMatch = visibleRoundIndex < 0 ? 0 : visibleMatchIndex + 1;

    if (nextMatch >= (revealPlan[nextRound]?.matches?.length || 0)) {
      nextRound += 1;
      nextMatch = 0;
    }

    if (nextRound >= revealPlan.length) {
      finish();
      return;
    }

    setVisibleRoundIndex(nextRound);
    setVisibleMatchIndex(nextMatch);

    const totalMatches = revealPlan.reduce((sum, round) => sum + round.matches.length, 0);
    let revealedCount = 0;

    for (let roundIndex = 0; roundIndex <= nextRound; roundIndex += 1) {
      const round = revealPlan[roundIndex];
      const limit = roundIndex === nextRound ? nextMatch + 1 : round.matches.length;
      revealedCount += limit;
    }

    setConnectorReveal(totalMatches ? revealedCount / totalMatches : 1);
    await wait(timing.matchMs);

    const isLast =
      nextRound === revealPlan.length - 1 &&
      nextMatch === (revealPlan[nextRound]?.matches?.length || 1) - 1;

    if (isLast) {
      finish();
      return;
    }

    setPlaying(false);
    runningRef.current = false;
  }, [revealPlan, visibleRoundIndex, visibleMatchIndex, timing.matchMs, wait, finish]);

  const reset = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);
    runningRef.current = false;
    setPlaying(false);
    setSkipped(false);
    setVisibleRoundIndex(-1);
    setVisibleMatchIndex(-1);
    setConnectorReveal(0);
    setPhase(PHASES.IDLE);
  }, []);

  const start = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);

    if (prefersReducedMotion()) {
      revealAll();
      onComplete?.();
      return;
    }

    if (modeRef.current === BRACKET_CONTROL_MODES.STEP) {
      revealNext();
      return;
    }

    if (phase === PHASES.COMPLETE || skipped) {
      reset();
    }

    runAuto();
  }, [phase, skipped, revealAll, onComplete, revealNext, runAuto, reset]);

  const replay = useCallback(() => {
    reset();
    requestAnimationFrame(() => {
      if (modeRef.current === BRACKET_CONTROL_MODES.AUTO) {
        runAuto();
      }
    });
  }, [reset, runAuto]);

  const skip = useCallback(() => {
    clearTimer();
    pausedRef.current = false;
    setPaused(false);
    revealAll();
    onComplete?.();
  }, [revealAll, onComplete]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);

    if (!playing || runningRef.current || modeRef.current !== BRACKET_CONTROL_MODES.AUTO) {
      return;
    }

    let fromRound = visibleRoundIndex < 0 ? 0 : visibleRoundIndex;
    let fromMatch = visibleRoundIndex < 0 ? 0 : visibleMatchIndex + 1;

    if (fromMatch >= (revealPlan[fromRound]?.matches?.length || 0)) {
      fromRound += 1;
      fromMatch = 0;
    }

    if (fromRound >= revealPlan.length) {
      finish();
      return;
    }

    runAuto(fromRound, fromMatch);
  }, [playing, visibleRoundIndex, visibleMatchIndex, revealPlan, runAuto, finish]);

  const isMatchVisible = useCallback(
    (roundIndex, matchIndex) => {
      if (skipped || phase === PHASES.COMPLETE) {
        return true;
      }

      if (roundIndex < visibleRoundIndex) {
        return true;
      }

      if (roundIndex === visibleRoundIndex && matchIndex <= visibleMatchIndex) {
        return true;
      }

      return false;
    },
    [skipped, phase, visibleRoundIndex, visibleMatchIndex]
  );

  const isRoundVisible = useCallback(
    (roundIndex) => {
      if (skipped || phase === PHASES.COMPLETE) {
        return true;
      }

      return roundIndex <= visibleRoundIndex;
    },
    [skipped, phase, visibleRoundIndex]
  );

  return {
    phase,
    playing,
    paused,
    skipped,
    mode,
    setMode,
    visibleRoundIndex,
    visibleMatchIndex,
    start,
    revealNext,
    pause,
    resume,
    replay,
    skip,
    reset,
    isMatchVisible,
    isRoundVisible,
    isComplete: phase === PHASES.COMPLETE || skipped,
    connectorReveal,
    PHASES,
  };
}
