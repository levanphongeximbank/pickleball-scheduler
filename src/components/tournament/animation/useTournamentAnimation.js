import { useCallback, useRef, useState } from "react";

export function useTournamentAnimation() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(null);
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
  }, []);

  const transitionAnimation = useCallback((nextPayload, persistFn) => {
    hasPersistedRef.current = false;
    if (persistFn) {
      pendingRef.current = persistFn;
    }
    setPayload((prev) => ({
      ...prev,
      ...nextPayload,
      animationMode: nextPayload.animationMode || prev?.animationMode,
    }));
  }, []);

  return {
    open,
    payload,
    showAnimation,
    transitionAnimation,
    persist,
    dismiss,
    dialogProps: {
      open,
      animationMode: payload?.animationMode,
      ...payload,
      onAnimationComplete: persist,
      onSkip: persist,
      onDismiss: dismiss,
    },
  };
}
