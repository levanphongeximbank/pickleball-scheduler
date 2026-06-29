import { useCallback, useEffect, useState } from "react";

import { shuffleVisualOrder } from "../animationUtils.js";

export const VISUAL_SHUFFLE_INTERVAL_MS = 4800;

export function useVisualShuffle(itemIds = [], { active = false, intervalMs = VISUAL_SHUFFLE_INTERVAL_MS } = {}) {
  const [displayOrder, setDisplayOrder] = useState([]);

  const reshuffle = useCallback(() => {
    if (!itemIds.length) {
      setDisplayOrder([]);
      return;
    }
    setDisplayOrder(shuffleVisualOrder(itemIds));
  }, [itemIds]);

  useEffect(() => {
    reshuffle();
  }, [reshuffle]);

  useEffect(() => {
    if (!active || !itemIds.length) {
      return undefined;
    }

    const timer = setInterval(reshuffle, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, itemIds.length, reshuffle]);

  return { displayOrder, reshuffle };
}
