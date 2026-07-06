import { useCallback, useEffect, useState } from "react";

const MIN_SCALE = 0.28;
const MAX_SCALE = 1;
const VIEWPORT_PADDING = 24;

export function computeBracketViewportScale(
  viewportWidth,
  viewportHeight,
  contentWidth,
  contentHeight,
  padding = VIEWPORT_PADDING
) {
  if (!viewportWidth || !viewportHeight || !contentWidth || !contentHeight) {
    return 1;
  }

  const availableWidth = Math.max(viewportWidth - padding, 1);
  const availableHeight = Math.max(viewportHeight - padding, 1);
  const widthScale = availableWidth / contentWidth;
  const heightScale = availableHeight / contentHeight;
  const nextScale = Math.min(widthScale, heightScale, MAX_SCALE);

  return Math.max(nextScale, MIN_SCALE);
}

/**
 * Tính scale để bracket tree vừa khung trình chiếu (width + height).
 */
export function useBracketViewportScale(viewportRef, contentSize) {
  const [scale, setScale] = useState(1);

  const recalculate = useCallback(() => {
    const viewport = viewportRef.current;
    const { width, height } = contentSize || {};

    if (!viewport || !width || !height) {
      setScale(1);
      return;
    }

    setScale(
      computeBracketViewportScale(viewport.clientWidth, viewport.clientHeight, width, height)
    );
  }, [viewportRef, contentSize]);

  useEffect(() => {
    recalculate();

    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }

    const observer = new ResizeObserver(recalculate);
    observer.observe(viewport);
    window.addEventListener("resize", recalculate);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalculate);
    };
  }, [recalculate, viewportRef]);

  return scale;
}
