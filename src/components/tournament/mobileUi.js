export const TOUCH_TARGET_MIN_HEIGHT = 48;
export const BRACKET_ROUND_MIN_WIDTH = 280;
export const MOBILE_PAGE_GUTTER = { xs: 1.5, sm: 2 };

export const horizontalScrollSx = {
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  pb: 1,
  mx: { xs: -1, sm: 0 },
  px: { xs: 1, sm: 0 },
};

export const touchButtonSx = {
  minHeight: TOUCH_TARGET_MIN_HEIGHT,
  fontWeight: 700,
};

export function getBracketLanesMinWidth(roundCount = 1) {
  const safeCount = Math.max(1, Number(roundCount) || 1);
  return safeCount * BRACKET_ROUND_MIN_WIDTH + Math.max(0, safeCount - 1) * 16;
}
