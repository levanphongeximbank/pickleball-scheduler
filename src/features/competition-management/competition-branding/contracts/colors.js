/**
 * Color validation + normalization (CM-05).
 * Canonical format: uppercase #RRGGBB. No alpha. No CSS functions.
 */

import {
  COMPETITION_BRAND_COLOR_FORMAT,
  COMPETITION_BRAND_PALETTE_REQUIRED_KEYS,
  COMPETITION_BRAND_PALETTE_ALLOWED_KEYS,
} from "../constants/colors.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "./validation.js";
import { deepFreeze, isNonEmptyString } from "./shared.js";

const RAW_HEX_RE = /^#([0-9a-fA-F]{6})$/;
const CSS_INJECTION_RE =
  /var\s*\(|url\s*\(|expression\s*\(|gradient\s*\(|@import|javascript:|<|>|;|\{|\}/i;

/**
 * Normalize a color to uppercase #RRGGBB or return null if invalid.
 * Does not silently repair malformed values.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeBrandColor(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (CSS_INJECTION_RE.test(trimmed)) return null;
  if (trimmed.includes(" ") || trimmed.includes("(")) return null;
  const match = RAW_HEX_RE.exec(trimmed);
  if (!match) return null;
  return `#${match[1].toUpperCase()}`;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidBrandColor(value) {
  const normalized = normalizeBrandColor(value);
  return (
    normalized != null && COMPETITION_BRAND_COLOR_FORMAT.pattern.test(normalized)
  );
}

/**
 * Validate a single color field.
 * @param {unknown} value
 * @param {string} fieldPath
 * @returns {{ errors: object[], value: string | null }}
 */
export function parseBrandColor(value, fieldPath) {
  /** @type {object[]} */
  const errors = [];
  if (value == null || value === "") {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_COLOR,
        "color is required when palette key is present",
        { value }
      )
    );
    return { errors, value: null };
  }
  if (typeof value !== "string") {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_COLOR,
        "color must be a #RRGGBB string",
        { value }
      )
    );
    return { errors, value: null };
  }
  const raw = value.trim();
  if (CSS_INJECTION_RE.test(raw) || raw.includes("(") || raw.includes(" ")) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_COLOR,
        "CSS functions, injection, and arbitrary CSS color strings are rejected",
        { value }
      )
    );
    return { errors, value: null };
  }
  if (!RAW_HEX_RE.test(raw)) {
    // Explicitly reject alpha forms like #RRGGBBAA
    if (/^#[0-9a-fA-F]{8}$/.test(raw)) {
      errors.push(
        createFieldError(
          fieldPath,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_COLOR,
          "alpha hex (#RRGGBBAA) is not supported; use #RRGGBB only",
          { value }
        )
      );
      return { errors, value: null };
    }
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_COLOR,
        "malformed color; expected #RRGGBB (no silent repair)",
        { value }
      )
    );
    return { errors, value: null };
  }
  return { errors: [], value: normalizeBrandColor(raw) };
}

/**
 * Parse palette. null/undefined/{} empty is allowed for empty draft.
 * When any key is present, all required keys must be present and valid.
 *
 * @param {unknown} palette
 * @param {string} [basePath]
 * @returns {{ errors: object[], value: Readonly<object> | null }}
 */
export function parseBrandPalette(palette, basePath = "palette") {
  /** @type {object[]} */
  const errors = [];

  if (palette == null) {
    return { errors: [], value: null };
  }

  if (typeof palette !== "object" || Array.isArray(palette)) {
    errors.push(
      createFieldError(
        basePath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_CONTRACT,
        "palette must be a plain object or null",
        {}
      )
    );
    return { errors, value: null };
  }

  const src = /** @type {Record<string, unknown>} */ (palette);
  const keys = Object.keys(src);

  if (keys.length === 0) {
    return { errors: [], value: deepFreeze({}) };
  }

  for (const key of keys) {
    if (!COMPETITION_BRAND_PALETTE_ALLOWED_KEYS.includes(key)) {
      errors.push(
        createFieldError(
          `${basePath}.${key}`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_CONTRACT,
          "unknown palette key (no silent discard)",
          { key }
        )
      );
    }
  }

  for (const required of COMPETITION_BRAND_PALETTE_REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(src, required)) {
      errors.push(
        createFieldError(
          `${basePath}.${required}`,
          COMPETITION_BRANDING_ERROR_CODE.INCOMPLETE_PALETTE,
          `required palette key "${required}" is missing when palette is provided`,
          { requiredKeys: COMPETITION_BRAND_PALETTE_REQUIRED_KEYS }
        )
      );
    }
  }

  /** @type {Record<string, string>} */
  const out = {};
  for (const key of COMPETITION_BRAND_PALETTE_ALLOWED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    const parsed = parseBrandColor(src[key], `${basePath}.${key}`);
    errors.push(...parsed.errors);
    if (parsed.value) out[key] = parsed.value;
  }

  if (errors.length > 0) {
    return { errors, value: null };
  }

  return { errors: [], value: deepFreeze(out) };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isBrandPalette(value) {
  if (value == null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return true;
  for (const key of keys) {
    if (!COMPETITION_BRAND_PALETTE_ALLOWED_KEYS.includes(key)) return false;
  }
  for (const required of COMPETITION_BRAND_PALETTE_REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, required)) return false;
    if (!isValidBrandColor(/** @type {any} */ (value)[required])) return false;
  }
  for (const optional of ["textSecondary", "border"]) {
    if (
      Object.prototype.hasOwnProperty.call(value, optional) &&
      !isValidBrandColor(/** @type {any} */ (value)[optional])
    ) {
      return false;
    }
  }
  return true;
}

export { isNonEmptyString };
