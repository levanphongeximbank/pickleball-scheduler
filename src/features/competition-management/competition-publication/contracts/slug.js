/**
 * Public reference slug validation (CM-06).
 *
 * A `requestedPublicReference` is optional. When provided it must be a safe,
 * deterministic, URL-path-safe slug: no path traversal, no protocol, no
 * query/fragment, no whitespace/control characters.
 */

import { COMPETITION_PUBLICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "./validation.js";
import { deepFreeze, hasControlCharacters } from "./shared.js";

/** `a-z0-9`, single internal hyphens, 1-64 chars total. */
export const PUBLIC_REFERENCE_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;

const TRAVERSAL_RE = /\.\.(\/|\\)|\.\.$/;
const PROTOCOL_RE = /:\/\//;
const QUERY_OR_FRAGMENT_RE = /[?#]/;
const WHITESPACE_RE = /\s/;

/**
 * @param {unknown} slug
 * @param {string} [fieldPath]
 * @returns {{ errors: object[], value: string | null }}
 */
export function validateSlug(slug, fieldPath = "requestedPublicReference") {
  if (slug == null) {
    return { errors: [], value: null };
  }

  if (typeof slug !== "string") {
    return {
      errors: [
        createFieldError(
          fieldPath,
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG,
          "requestedPublicReference must be a string when provided",
          {}
        ),
      ],
      value: null,
    };
  }

  const raw = slug;

  if (raw.trim().length === 0) {
    return {
      errors: [
        createFieldError(
          fieldPath,
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG,
          "requestedPublicReference must not be empty when provided",
          {}
        ),
      ],
      value: null,
    };
  }

  if (WHITESPACE_RE.test(raw) || hasControlCharacters(raw)) {
    return {
      errors: [
        createFieldError(
          fieldPath,
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG,
          "requestedPublicReference must not contain whitespace or control characters",
          {}
        ),
      ],
      value: null,
    };
  }

  if (TRAVERSAL_RE.test(raw)) {
    return {
      errors: [
        createFieldError(
          fieldPath,
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG,
          "requestedPublicReference must not contain path traversal sequences",
          {}
        ),
      ],
      value: null,
    };
  }

  if (PROTOCOL_RE.test(raw)) {
    return {
      errors: [
        createFieldError(
          fieldPath,
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG,
          "requestedPublicReference must not contain a protocol",
          {}
        ),
      ],
      value: null,
    };
  }

  if (QUERY_OR_FRAGMENT_RE.test(raw)) {
    return {
      errors: [
        createFieldError(
          fieldPath,
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG,
          "requestedPublicReference must not contain query or fragment characters",
          {}
        ),
      ],
      value: null,
    };
  }

  if (raw.includes("/") || raw.includes("\\")) {
    return {
      errors: [
        createFieldError(
          fieldPath,
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG,
          "requestedPublicReference must be a single path segment (no slashes)",
          {}
        ),
      ],
      value: null,
    };
  }

  if (!PUBLIC_REFERENCE_SLUG_PATTERN.test(raw)) {
    return {
      errors: [
        createFieldError(
          fieldPath,
          COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG,
          "requestedPublicReference must match ^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$",
          { value: raw }
        ),
      ],
      value: null,
    };
  }

  return { errors: [], value: raw };
}

/**
 * Parse an optional `requestedPublicReference` into a frozen `{ slug }` shape.
 * @param {unknown} requestedPublicReference
 * @returns {{ errors: object[], value: Readonly<{ slug: string }> | null }}
 */
export function parseRequestedPublicReference(requestedPublicReference) {
  const parsed = validateSlug(requestedPublicReference);
  if (parsed.errors.length > 0 || parsed.value == null) {
    return { errors: parsed.errors, value: null };
  }
  return { errors: [], value: deepFreeze({ slug: parsed.value }) };
}
