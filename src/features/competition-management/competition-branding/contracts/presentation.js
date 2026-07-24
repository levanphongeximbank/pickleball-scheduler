/**
 * Typography reference validation (CM-05).
 * Opaque safe token only — no font loading, no CSS, no files.
 */

import { COMPETITION_BRAND_TYPOGRAPHY_TOKEN_MAX_LENGTH } from "../constants/presentation.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "./validation.js";
import { deepFreeze, isNonEmptyString } from "./shared.js";

const TYPOGRAPHY_TOKEN_RE = /^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/;
const UNSAFE_TYPOGRAPHY_RE =
  /url\s*\(|var\s*\(|@import|<|>|;|\{|\}|javascript:|expression\s*\(/i;

/**
 * @param {unknown} value
 * @param {string} [fieldPath]
 * @returns {{ errors: object[], value: Readonly<object> | null }}
 */
export function parseTypographyReference(value, fieldPath = "typography") {
  /** @type {object[]} */
  const errors = [];

  if (value == null) {
    return { errors: [], value: null };
  }

  if (typeof value === "string") {
    const token = value.trim();
    if (!token) {
      return { errors: [], value: null };
    }
    if (
      UNSAFE_TYPOGRAPHY_RE.test(token) ||
      !TYPOGRAPHY_TOKEN_RE.test(token) ||
      token.length > COMPETITION_BRAND_TYPOGRAPHY_TOKEN_MAX_LENGTH
    ) {
      errors.push(
        createFieldError(
          fieldPath,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_TYPOGRAPHY_REFERENCE,
          "typography token must be an opaque safe id (no CSS/url/injection)",
          { value: token.slice(0, 80) }
        )
      );
      return { errors, value: null };
    }
    return {
      errors: [],
      value: deepFreeze({
        tokenId: token,
        fallbackSemantics: "platform_default",
      }),
    };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_TYPOGRAPHY_REFERENCE,
        "typography must be a string token, object reference, or null",
        {}
      )
    );
    return { errors, value: null };
  }

  const src = /** @type {any} */ (value);

  for (const forbidden of ["css", "fontFace", "url", "style", "familyCss", "stack"]) {
    if (Object.prototype.hasOwnProperty.call(src, forbidden)) {
      errors.push(
        createFieldError(
          `${fieldPath}.${forbidden}`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_TYPOGRAPHY_REFERENCE,
          "arbitrary CSS / font file fields are rejected",
          {}
        )
      );
    }
  }

  if (!isNonEmptyString(src.tokenId)) {
    errors.push(
      createFieldError(
        `${fieldPath}.tokenId`,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_TYPOGRAPHY_REFERENCE,
        "typography.tokenId is required when typography object is provided",
        {}
      )
    );
    return { errors, value: null };
  }

  const token = String(src.tokenId).trim();
  if (
    UNSAFE_TYPOGRAPHY_RE.test(token) ||
    !TYPOGRAPHY_TOKEN_RE.test(token) ||
    token.length > COMPETITION_BRAND_TYPOGRAPHY_TOKEN_MAX_LENGTH
  ) {
    errors.push(
      createFieldError(
        `${fieldPath}.tokenId`,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_TYPOGRAPHY_REFERENCE,
        "typography.tokenId must be an opaque safe id (no CSS/url/injection)",
        { value: token.slice(0, 80) }
      )
    );
    return { errors, value: null };
  }

  const fallbackSemantics = isNonEmptyString(src.fallbackSemantics)
    ? String(src.fallbackSemantics).trim()
    : "platform_default";

  if (!/^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/.test(fallbackSemantics)) {
    errors.push(
      createFieldError(
        `${fieldPath}.fallbackSemantics`,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_TYPOGRAPHY_REFERENCE,
        "fallbackSemantics must be a safe opaque token",
        {}
      )
    );
    return { errors, value: null };
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors: [],
    value: deepFreeze({
      tokenId: token,
      fallbackSemantics,
    }),
  };
}
