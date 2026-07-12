/** Pick_VN Rating V5 — continuous public scale (display only rounds to 0.1). */

export const V5_MIN_RATING = 1.5;
export const V5_MAX_RATING = 6.0;
export const V5_DISPLAY_STEP = 0.1;

export function clampRatingMean(value, fallback = 3.5) {
  const numeric = Number(value);
  const base = Number.isFinite(numeric) ? numeric : Number(fallback);
  const safe = Number.isFinite(base) ? base : 3.5;
  return Math.min(V5_MAX_RATING, Math.max(V5_MIN_RATING, safe));
}

/** Display rating — only rounding step in the entire V5 pipeline. */
export function toDisplayRating(ratingMean) {
  const clamped = clampRatingMean(ratingMean);
  return Math.round(clamped * 10) / 10;
}

export function toEstimatedRange(ratingMean, estimatedError) {
  const mean = clampRatingMean(ratingMean);
  const error = Math.max(0, Number(estimatedError) || 0);
  return {
    low: toDisplayRating(mean - error),
    high: toDisplayRating(mean + error),
  };
}
