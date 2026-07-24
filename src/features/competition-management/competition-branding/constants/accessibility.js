/**
 * CM-05 accessibility / contrast baseline (deterministic, browser-independent).
 *
 * Algorithm: WCAG 2.1 relative luminance + contrast ratio.
 * Threshold: 4.5:1 for textPrimary vs background and textPrimary vs surface.
 *
 * This is a baseline check only — not a full WCAG certification.
 */

export const COMPETITION_BRANDING_CONTRAST_ALGORITHM = Object.freeze({
  id: "wcag21-relative-luminance-v1",
  threshold: 4.5,
  pairs: Object.freeze([
    Object.freeze({ foreground: "textPrimary", background: "background" }),
    Object.freeze({ foreground: "textPrimary", background: "surface" }),
  ]),
});

export const COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY = Object.freeze({
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO",
});

export const COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY_VALUES = Object.freeze(
  Object.values(COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY)
);
