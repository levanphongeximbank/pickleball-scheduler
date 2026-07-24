/**
 * Presentation metadata validation (CM-05).
 * Presentation-only — never replaces CM-01 canonical name/description.
 */

import {
  COMPETITION_BRAND_SHORT_LABEL_MAX_LENGTH,
  COMPETITION_BRAND_TAGLINE_MAX_LENGTH,
  isCompetitionBrandLockupVariant,
  isCompetitionBrandThemeMode,
} from "../constants/presentation.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "./validation.js";
import { deepFreeze, isNonEmptyString, hasControlCharacters } from "./shared.js";

/**
 * @param {unknown} text
 * @param {string} fieldPath
 * @param {number} maxLength
 * @param {boolean} [allowEmpty]
 * @returns {{ errors: object[], value: string | null }}
 */
function parseSafeText(text, fieldPath, maxLength, allowEmpty = true) {
  /** @type {object[]} */
  const errors = [];
  if (text == null || text === "") {
    return { errors: [], value: null };
  }
  if (typeof text !== "string") {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA,
        "presentation text must be a string",
        {}
      )
    );
    return { errors, value: null };
  }
  // Trim for validation length, but reject if trim changes meaning of leading/trailing
  // only after validating raw control chars on original.
  if (hasControlCharacters(text)) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA,
        "control characters are rejected",
        {}
      )
    );
    return { errors, value: null };
  }
  const trimmed = text.trim();
  if (!trimmed && !allowEmpty) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA,
        "text must be non-empty after trim",
        {}
      )
    );
    return { errors, value: null };
  }
  if (!trimmed) {
    return { errors: [], value: null };
  }
  if (trimmed.length > maxLength) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA,
        `text exceeds max length ${maxLength}`,
        { length: trimmed.length, maxLength }
      )
    );
    return { errors, value: null };
  }
  // Reject HTML / script-ish content
  if (/[<>]|javascript:|on\w+\s*=/i.test(trimmed)) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA,
        "HTML/script-like content is rejected",
        {}
      )
    );
    return { errors, value: null };
  }
  return { errors: [], value: trimmed };
}

/**
 * @param {unknown} presentation
 * @param {string} [basePath]
 * @returns {{ errors: object[], value: Readonly<object> }}
 */
export function parsePresentationMetadata(presentation, basePath = "presentation") {
  /** @type {object[]} */
  const errors = [];

  if (presentation == null) {
    return {
      errors: [],
      value: deepFreeze({
        shortLabel: null,
        tagline: null,
        lockupVariant: null,
        themeModePreference: null,
      }),
    };
  }

  if (typeof presentation !== "object" || Array.isArray(presentation)) {
    errors.push(
      createFieldError(
        basePath,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA,
        "presentation must be a plain object or null",
        {}
      )
    );
    return {
      errors,
      value: deepFreeze({
        shortLabel: null,
        tagline: null,
        lockupVariant: null,
        themeModePreference: null,
      }),
    };
  }

  const src = /** @type {any} */ (presentation);

  // Reject ownership collisions with CM-01
  for (const forbidden of [
    "name",
    "canonicalName",
    "description",
    "canonicalDescription",
    "displayNameOverride",
    "html",
    "markdown",
    "cssClass",
    "style",
    "componentProps",
    "uiWizardState",
  ]) {
    if (Object.prototype.hasOwnProperty.call(src, forbidden)) {
      const code =
        forbidden === "name" ||
        forbidden === "canonicalName" ||
        forbidden === "description" ||
        forbidden === "canonicalDescription"
          ? COMPETITION_BRANDING_ERROR_CODE.CANONICAL_NAME_OWNERSHIP
          : COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA;
      errors.push(
        createFieldError(
          `${basePath}.${forbidden}`,
          code,
          forbidden.includes("name") || forbidden.includes("description")
            ? "canonical name/description remain owned by CM-01; use shortLabel/tagline for presentation-only copy"
            : "UI/runtime presentation fields are rejected",
          {}
        )
      );
    }
  }

  // Locale map deferred unless explicit simple map of safe shortLabel/tagline
  if (src.localized != null) {
    errors.push(
      createFieldError(
        `${basePath}.localized`,
        COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA,
        "localized presentation map is deferred (no i18n ownership in CM-05)",
        {}
      )
    );
  }

  const shortLabel = parseSafeText(
    src.shortLabel,
    `${basePath}.shortLabel`,
    COMPETITION_BRAND_SHORT_LABEL_MAX_LENGTH
  );
  errors.push(...shortLabel.errors);

  const tagline = parseSafeText(
    src.tagline,
    `${basePath}.tagline`,
    COMPETITION_BRAND_TAGLINE_MAX_LENGTH
  );
  errors.push(...tagline.errors);

  let lockupVariant = null;
  if (src.lockupVariant != null && src.lockupVariant !== "") {
    if (!isCompetitionBrandLockupVariant(src.lockupVariant)) {
      errors.push(
        createFieldError(
          `${basePath}.lockupVariant`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA,
          "lockupVariant must be a known enum value",
          { value: src.lockupVariant }
        )
      );
    } else {
      lockupVariant = src.lockupVariant;
    }
  }

  let themeModePreference = null;
  if (src.themeModePreference != null && src.themeModePreference !== "") {
    if (!isCompetitionBrandThemeMode(src.themeModePreference)) {
      errors.push(
        createFieldError(
          `${basePath}.themeModePreference`,
          COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA,
          "themeModePreference must be light|dark|system",
          { value: src.themeModePreference }
        )
      );
    } else {
      themeModePreference = src.themeModePreference;
    }
  }

  if (errors.length > 0) {
    return {
      errors,
      value: deepFreeze({
        shortLabel: null,
        tagline: null,
        lockupVariant: null,
        themeModePreference: null,
      }),
    };
  }

  return {
    errors: [],
    value: deepFreeze({
      shortLabel: shortLabel.value,
      tagline: tagline.value,
      lockupVariant,
      themeModePreference,
    }),
  };
}

export { isNonEmptyString };
