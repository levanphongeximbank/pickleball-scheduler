import { useCallback, useRef, useState } from "react";

import { FLOW_MODES } from "./shared/tournamentFlowConfig.js";

export function useTournamentAnimation() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(null);
  const [handoff, setHandoff] = useState(null);
  const pendingRef = useRef(null);
  const hasPersistedRef = useRef(false);

  const showAnimation = useCallback((nextPayload, persistFn) => {
    hasPersistedRef.current = false;
    setPayload(nextPayload);
    pendingRef.current = persistFn;
    setOpen(true);
  }, []);

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

  const transitionAnimation = useCallback((nextPayload, persistFn) => {
    hasPersistedRef.current = false;
    setHandoff(null);
    if (persistFn) {
      pendingRef.current = persistFn;
    }
    setPayload((prev) => ({
      ...prev,
      ...nextPayload,
      bracketReviewMode: false,
      animationMode: nextPayload.animationMode || prev?.animationMode,
    }));
  }, []);

  return {
    open,
    payload,
    handoff,
    showAnimation,
    transitionAnimation,
    persist,
    dismiss,
    showHandoff,
    clearHandoff,
    enterBracketReview,
    dialogProps: {
      open,
      animationMode: payload?.animationMode,
      flowMode: payload?.flowMode || FLOW_MODES.STANDALONE,
      handoff,
      ...payload,
      onAnimationComplete: persist,
      onSkip: persist,
      onDismiss: dismiss,
    },
  };
}
