/**
 * Database / Supabase client error → NewsPublicContentError (NEWS-02).
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../../errors/errorCodes.js";
import { NewsPublicContentError } from "../../errors/NewsPublicContentError.js";

/**
 * @param {unknown} err
 */
export function extractClientErrorParts(err) {
  if (err == null) {
    return {
      code: null,
      message: "Unknown persistence failure.",
      details: null,
      hint: null,
      status: null,
    };
  }
  if (typeof err === "string") {
    return {
      code: null,
      message: err.slice(0, 200),
      details: null,
      hint: null,
      status: null,
    };
  }
  const obj = /** @type {Record<string, unknown>} */ (err);
  const code =
    typeof obj.code === "string"
      ? obj.code
      : typeof obj.error_code === "string"
        ? obj.error_code
        : null;
  const message =
    typeof obj.message === "string"
      ? obj.message.slice(0, 200)
      : err instanceof Error
        ? err.message.slice(0, 200)
        : "Persistence client failure.";
  const details = typeof obj.details === "string" ? obj.details.slice(0, 200) : null;
  const hint = typeof obj.hint === "string" ? obj.hint.slice(0, 120) : null;
  const status =
    typeof obj.status === "number"
      ? obj.status
      : typeof obj.statusCode === "number"
        ? obj.statusCode
        : null;
  return { code, message, details, hint, status };
}

/**
 * @param {unknown} err
 * @param {{ contentId?: string, operation?: string, expectedVersion?: number, actualVersion?: number }} [context]
 */
export function mapSupabaseNewsError(err, context = {}) {
  if (err instanceof NewsPublicContentError) return err;

  const parts = extractClientErrorParts(err);
  const code = (parts.code || "").toUpperCase();
  const blob = `${parts.message} ${parts.details || ""}`.toLowerCase();
  const detail = parts.details || "";

  if (
    code === "P0001" &&
    (parts.message.includes("NEWS_VERSION_CONFLICT") ||
      detail.includes("expected") ||
      blob.includes("news_version_conflict"))
  ) {
    return new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT,
      "News content version conflict",
      {
        contentId: context.contentId,
        expectedVersion: context.expectedVersion,
        actualVersion: context.actualVersion,
        detail: parts.details || undefined,
      }
    );
  }

  if (
    parts.message.includes("NEWS_APPROVAL_REVISION_MISMATCH") ||
    blob.includes("approval must bind")
  ) {
    return new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.APPROVAL_REVISION_MISMATCH,
      "Approval is not bound to the current revision",
      { contentId: context.contentId }
    );
  }

  if (
    parts.message.includes("NEWS_REVISION_IMMUTABLE") ||
    blob.includes("revision payload is immutable") ||
    blob.includes("cannot mutate approved")
  ) {
    return new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.REVISION_IMMUTABLE,
      "Approved or published revision cannot be mutated",
      { contentId: context.contentId }
    );
  }

  if (
    parts.message.includes("NEWS_PROVENANCE_MISMATCH") ||
    blob.includes("mock content cannot be published")
  ) {
    return new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.PROVENANCE_MISMATCH,
      "Invalid provenance for persistence operation",
      { contentId: context.contentId }
    );
  }

  if (
    code === "23505" ||
    blob.includes("duplicate key") ||
    blob.includes("unique constraint")
  ) {
    if (blob.includes("version") || blob.includes("content_version")) {
      return new NewsPublicContentError(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT,
        "Duplicate revision version for content",
        {
          contentId: context.contentId,
          constraint: parts.details || undefined,
        }
      );
    }
    return new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.VERSION_CONFLICT,
      "News uniqueness conflict (slug or revision)",
      {
        contentId: context.contentId,
        constraint: parts.details || undefined,
      }
    );
  }

  if (code === "23514" || blob.includes("check constraint")) {
    return new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.PERSISTENCE_CONSTRAINT_VIOLATION,
      "News check constraint violation",
      { contentId: context.contentId, operation: context.operation }
    );
  }

  if (
    parts.status === 401 ||
    parts.status === 403 ||
    code === "42501" ||
    blob.includes("row-level security") ||
    blob.includes("permission denied")
  ) {
    return new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.FORBIDDEN,
      "News persistence permission or RLS denial",
      { contentId: context.contentId, operation: context.operation }
    );
  }

  if (
    parts.status === 408 ||
    parts.status === 503 ||
    parts.status === 504 ||
    blob.includes("timeout") ||
    blob.includes("unavailable")
  ) {
    return new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
      "News persistence backend unavailable",
      { contentId: context.contentId, retryable: true }
    );
  }

  return new NewsPublicContentError(
    NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
    "Unknown News persistence failure",
    {
      contentId: context.contentId,
      operation: context.operation,
      code: parts.code || undefined,
    }
  );
}
