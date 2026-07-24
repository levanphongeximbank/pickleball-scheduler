/**
 * Deterministic WCAG 2.1 relative luminance + contrast ratio (CM-05).
 * Browser-independent. Does not auto-repair colors.
 */

import {
  COMPETITION_BRANDING_CONTRAST_ALGORITHM,
  COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY,
} from "../constants/accessibility.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "../contracts/validation.js";
import { deepFreeze, compareFieldPath } from "../contracts/shared.js";
import { isValidBrandColor, normalizeBrandColor } from "../contracts/colors.js";

/**
 * @param {string} hexUpper #RRGGBB
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hexUpper) {
  const n = parseInt(hexUpper.slice(1), 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

/**
 * @param {number} channel 0-255
 * @returns {number}
 */
function linearize(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Relative luminance (WCAG 2.1).
 * @param {string} hex
 * @returns {number | null}
 */
export function relativeLuminance(hex) {
  const normalized = normalizeBrandColor(hex);
  if (!normalized) return null;
  const { r, g, b } = hexToRgb(normalized);
  return (
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  );
}

/**
 * Contrast ratio between two #RRGGBB colors.
 * @param {string} foreground
 * @param {string} background
 * @returns {number | null}
 */
export function contrastRatio(foreground, background) {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  if (l1 == null || l2 == null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Evaluate accessibility baseline for a palette (+ optional alt-text issues already validated).
 *
 * @param {{
 *   palette?: object | null,
 *   assets?: object[],
 *   asHardErrors?: boolean,
 * }} input
 * @returns {Readonly<{
 *   algorithm: string,
 *   threshold: number,
 *   passed: boolean,
 *   issues: readonly object[],
 *   ratios: Readonly<Record<string, number | null>>,
 * }>}
 */
export function evaluateBrandingAccessibility(input = {}) {
  /** @type {object[]} */
  const issues = [];
  /** @type {Record<string, number | null>} */
  const ratios = {};
  const palette =
    input.palette && typeof input.palette === "object" ? input.palette : null;
  const asHardErrors = input.asHardErrors === true;
  const threshold = COMPETITION_BRANDING_CONTRAST_ALGORITHM.threshold;

  if (palette && Object.keys(palette).length > 0) {
    for (const pair of COMPETITION_BRANDING_CONTRAST_ALGORITHM.pairs) {
      const fg = /** @type {any} */ (palette)[pair.foreground];
      const bg = /** @type {any} */ (palette)[pair.background];
      const pairKey = `${pair.foreground}_on_${pair.background}`;
      if (!isValidBrandColor(fg) || !isValidBrandColor(bg)) {
        ratios[pairKey] = null;
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      ratios[pairKey] = ratio;
      if (ratio != null && ratio < threshold) {
        issues.push(
          deepFreeze({
            path: `palette.${pairKey}`,
            code: COMPETITION_BRANDING_ERROR_CODE.CONTRAST_FAILURE,
            severity: COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY.ERROR,
            message: `contrast ratio ${ratio.toFixed(2)} is below threshold ${threshold}`,
            details: {
              foreground: pair.foreground,
              background: pair.background,
              ratio: Number(ratio.toFixed(4)),
              threshold,
              algorithm: COMPETITION_BRANDING_CONTRAST_ALGORITHM.id,
              autoRepaired: false,
            },
          })
        );
      }
    }
  }

  issues.sort((a, b) => {
    const byPath = compareFieldPath(a.path, b.path);
    if (byPath !== 0) return byPath;
    return String(a.code).localeCompare(String(b.code), "en");
  });

  const result = deepFreeze({
    algorithm: COMPETITION_BRANDING_CONTRAST_ALGORITHM.id,
    threshold,
    passed: issues.every(
      (i) => i.severity !== COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY.ERROR
    ),
    issues: Object.freeze(issues),
    ratios: deepFreeze(ratios),
  });

  // asHardErrors is used by callers that convert issues → field errors.
  void asHardErrors;
  return result;
}

/**
 * Convert accessibility ERROR issues into field errors (fail-closed validation).
 * @param {ReturnType<typeof evaluateBrandingAccessibility>} accessibility
 * @returns {object[]}
 */
export function accessibilityIssuesToFieldErrors(accessibility) {
  return accessibility.issues
    .filter(
      (i) => i.severity === COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY.ERROR
    )
    .map((i) =>
      createFieldError(i.path, i.code, i.message, i.details || {})
    );
}
