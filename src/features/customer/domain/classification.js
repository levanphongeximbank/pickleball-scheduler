/**
 * Classification and segmentation reference contracts.
 */

import {
  CUSTOMER_CLASSIFICATION_KIND,
  isCustomerClassificationKind,
} from "../constants/classification.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { requireOpaqueId } from "./identifiers.js";

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createClassificationEntry(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Classification entry must be a plain object."
    );
  }
  const kind = String(input.kind || CUSTOMER_CLASSIFICATION_KIND.BUSINESS_TAG);
  if (!isCustomerClassificationKind(kind)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Classification kind is invalid.",
      { field: "kind", kind }
    );
  }
  const code = requireOpaqueId(input.code, "code");
  return Object.freeze({ kind, code });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createSegmentReference(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Segment reference must be a plain object."
    );
  }
  return Object.freeze({
    segmentId: requireOpaqueId(input.segmentId, "segmentId"),
    source: input.source != null ? String(input.source).trim() || null : null,
  });
}

/**
 * @param {unknown} tags
 * @returns {readonly string[]}
 */
export function normalizeControlledTags(tags) {
  if (tags == null) return Object.freeze([]);
  if (!Array.isArray(tags)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "tags must be an array when provided.",
      { field: "tags" }
    );
  }
  const out = [];
  const seen = new Set();
  for (const tag of tags) {
    if (typeof tag !== "string" || !tag.trim()) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_INPUT,
        "Each tag must be a non-empty string.",
        { field: "tags" }
      );
    }
    const normalized = tag.trim().toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return Object.freeze(out);
}
