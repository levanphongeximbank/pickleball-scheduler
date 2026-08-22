/**
 * Status tone style map — node-safe (no JSX).
 * @ownership AUTHENTICATED_SHARED
 */

import { COLOR } from "../../theme/designTokens.js";

/** Canonical tones — no arbitrary hex API on the public contract. */
export const STATUS_TONES = Object.freeze([
  "neutral",
  "info",
  "success",
  "warning",
  "error",
  /** Optional brand-adjacent visual; prefer info for informational status */
  "primary",
]);

export const STATUS_TONE_STYLES = Object.freeze({
  neutral: Object.freeze({
    color: COLOR.neutral.dark,
    bgcolor: COLOR.neutral.light,
  }),
  info: Object.freeze({
    color: COLOR.info.dark,
    bgcolor: COLOR.info.light,
  }),
  success: Object.freeze({
    color: COLOR.success.dark,
    bgcolor: COLOR.success.light,
  }),
  warning: Object.freeze({
    color: COLOR.warning.dark,
    bgcolor: COLOR.warning.light,
  }),
  error: Object.freeze({
    color: COLOR.error.dark,
    bgcolor: COLOR.error.light,
  }),
  primary: Object.freeze({
    color: COLOR.primary.dark,
    bgcolor: COLOR.primary.surface,
  }),
});

/**
 * Resolve tone styles. Unknown tones fall back to neutral.
 * @param {string} tone
 */
export function resolveStatusToneStyle(tone) {
  return STATUS_TONE_STYLES[tone] || STATUS_TONE_STYLES.neutral;
}
