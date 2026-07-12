export const RATING_MODE = Object.freeze({
  SINGLES: "singles",
  DOUBLES: "doubles",
});

export const RATING_MODE_LABELS = Object.freeze({
  [RATING_MODE.SINGLES]: "Đánh đơn",
  [RATING_MODE.DOUBLES]: "Đánh đôi",
});

export function isValidRatingMode(mode) {
  return mode === RATING_MODE.SINGLES || mode === RATING_MODE.DOUBLES;
}
