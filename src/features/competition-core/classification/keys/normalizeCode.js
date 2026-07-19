import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { classificationError, classificationFail, classificationOk } from "../errors/classificationError.js";

/**
 * Normalize a business code for deterministic keys and duplicate detection.
 *
 * Algorithm (pure, locale-independent):
 * 1. Reject non-strings.
 * 2. Unicode NFC normalize (`String.prototype.normalize('NFC')`).
 * 3. Trim leading/trailing whitespace.
 * 4. Lowercase with `toLowerCase()` — never `toLocaleLowerCase`.
 * 5. Map runs of whitespace / `_` / `-` / `.` to a single `_`.
 * 6. Strip leading/trailing `_`.
 * 7. Accept only `[a-z0-9_]+`; otherwise fail closed.
 * 8. Reject empty result.
 *
 * Semantically equivalent inputs collide, e.g.:
 * `MEN_DOUBLE`, `men-double`, `" men double "`, `men__double`, `men---double`
 * all normalize to `men_double`.
 *
 * @param {unknown} raw
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function normalizeClassificationCode(raw) {
  if (typeof raw !== "string") {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_CODE,
        "code",
        "Classification code must be a non-empty string"
      ),
    ]);
  }

  let value = raw.normalize("NFC").trim().toLowerCase();
  if (!value) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_CODE,
        "code",
        "Classification code must be a non-empty string"
      ),
    ]);
  }

  // Unify separators: whitespace, underscore, hyphen, dot → single underscore
  value = value.replace(/[\s_.-]+/g, "_");
  // Strip leading/trailing separators
  value = value.replace(/^_+|_+$/g, "");

  if (!value) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_CODE,
        "code",
        "Classification code is empty after separator normalization"
      ),
    ]);
  }

  if (!/^[a-z0-9_]+$/.test(value)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_CODE,
        "code",
        "Classification code contains unsupported characters after normalization",
        { code: value }
      ),
    ]);
  }

  return classificationOk(value);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function requireNormalizedCodeOrThrow(value) {
  const result = normalizeClassificationCode(value);
  if (!result.ok) {
    const message = result.errors?.[0]?.message || "Invalid classification code";
    throw new Error(message);
  }
  return /** @type {string} */ (result.value);
}
