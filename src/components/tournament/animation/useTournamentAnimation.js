import { useCallback, useRef, useState } from "react";

import {
  buildEffectPreludeContext,
  hasEffectPrelude,
  resolveEffectPreludePreset,
} from "./shared/effectPreludeConfig.js";
import { FLOW_MODES } from "./shared/tournamentFlowConfig.js";

export function useTournamentAnimation() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(null);
  const [handoff, setHandoff] = useState(null);
  const [preludeActive, setPreludeActive] = useState(false);
  const pendingRef = useRef(null);
  const hasPersistedRef = useRef(false);

  const activatePrelude = useCallback((animationMode) => {
    setPreludeActive(hasEffectPrelude(animationMode));
  }, []);

  const showAnimation = useCallback((nextPayload, persistFn) => {
    hasPersistedRef.current = false;
    setPayload(nextPayload);
    pendingRef.current = persistFn;
    activatePrelude(nextPayload?.animationMode);
    setOpen(true);
  }, [activatePrelude]);

  const persist = useCallback(() => {
    if (hasPersistedRef.current) {
      return;
    }

    hasPersistedRef.current = true;
    pendingRef.current?.();
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    pendingRef.current = null;
    hasPersistedRef.current = false;
    setPayload(null);
    setHandoff(null);
    setPreludeActive(false);
  }, []);

  const showHandoff = useCallback((nextHandoff) => {
    setHandoff(nextHandoff);
  }, []);

  const clearHandoff = useCallback(() => {
    setHandoff(null);
  }, []);

  const enterBracketReview = useCallback(() => {
    setHandoff(null);
    setPayload((prev) => ({
      ...prev,
      bracketReviewMode: true,
    }));
  }, []);

  const completePrelude = useCallback(() => {
    setPreludeActive(false);
    setPayload((prev) => {
      if (!prev?.animationMode) {
        return prev;
      }

      const preset = resolveEffectPreludePreset(
        prev.animationMode,
        buildEffectPreludeContext(prev)
      );

      if (preset?.skipDailyAnalyzePhase) {
        return { ...prev, skipDailyAnalyzePhase: true };
      }

      return prev;
    });
  }, []);

  const transitionAnimation = useCallback((nextPayload, persistFn) => {
    hasPersistedRef.current = false;
    setHandoff(null);
    if (persistFn) {
      pendingRef.current = persistFn;
    }

    const animationMode = nextPayload.animationMode;
    activatePrelude(animationMode);

    setPayload((prev) => ({
      ...prev,
      ...nextPayload,
      bracketReviewMode: false,
      animationMode: animationMode || prev?.animationMode,
    }));
  }, [activatePrelude]);

  return {
    open,
    payload,
    handoff,
    preludeActive,
    showAnimation,
    transitionAnimation,
    persist,
    dismiss,
    showHandoff,
    clearHandoff,
    enterBracketReview,
    completePrelude,
    dialogProps: {
      open,
      animationMode: payload?.animationMode,
      flowMode: payload?.flowMode || FLOW_MODES.STANDALONE,
      handoff,
      preludeActive,
      onPreludeComplete: completePrelude,
      ...payload,
      onAnimationComplete: persist,
      onSkip: persist,
      onDismiss: dismiss,
    },
  };
}
