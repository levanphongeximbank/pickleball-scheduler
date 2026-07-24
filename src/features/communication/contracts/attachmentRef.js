/**
 * Attachment reference contract — opaque Storage refs only (COMMS-01).
 * Does not own buckets, upload, or RLS.
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { requireOpaqueId } from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "./shared.js";

/**
 * @typedef {Object} AttachmentReferenceContract
 * @property {string} attachmentRefId
 * @property {string|null} bucket
 * @property {string} path
 * @property {string|null} contentType
 * @property {number|null} sizeBytes
 * @property {string|null} checksum
 */

/**
 * @param {object} input
 * @returns {Readonly<AttachmentReferenceContract>}
 */
export function createAttachmentReferenceContract(input = {}) {
  const attachmentRefId = requireOpaqueId(
    input.attachmentRefId,
    "attachmentRefId"
  );
  const path = requireNonEmptyString(input.path, "path");
  const bucket = optionalNonEmptyString(input.bucket, "bucket");
  const contentType = optionalNonEmptyString(input.contentType, "contentType");
  const checksum = optionalNonEmptyString(input.checksum, "checksum");

  let sizeBytes = null;
  if (input.sizeBytes != null && input.sizeBytes !== "") {
    if (
      typeof input.sizeBytes !== "number" ||
      !Number.isFinite(input.sizeBytes) ||
      input.sizeBytes < 0
    ) {
      failContract(
        COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_ATTACHMENT_REF,
        "sizeBytes must be a finite number >= 0 when provided",
        { field: "sizeBytes", value: input.sizeBytes }
      );
    }
    sizeBytes = input.sizeBytes;
  }

  return deepFreeze({
    attachmentRefId,
    bucket,
    path,
    contentType,
    sizeBytes,
    checksum,
  });
}
