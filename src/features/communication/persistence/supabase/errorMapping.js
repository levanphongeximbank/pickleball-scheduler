/**
 * Database / Supabase client error → CommunicationFoundationError (COMMS-05).
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../../errors/errorCodes.js";
import { CommunicationFoundationError } from "../../errors/CommunicationFoundationError.js";

const SAFE_CONTEXT_KEYS = new Set([
  "entity",
  "conversationId",
  "messageId",
  "participantId",
  "requestId",
  "tenantId",
  "clubId",
  "pairKey",
  "channelKey",
  "table",
  "constraint",
  "code",
  "retryable",
  "operation",
  "field",
]);

/**
 * @param {object} [raw]
 * @returns {Readonly<object>}
 */
export function sanitizePersistenceErrorContext(raw = {}) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue;
    if (value == null) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    }
  }
  return Object.freeze(out);
}

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
 * Map uniqueness detail → domain conflict code when possible.
 * @param {string|null} details
 * @param {object} context
 */
function mapUniquenessConflict(details, context) {
  const d = String(details || "").toLowerCase();
  if (d.includes("direct_pair")) {
    return new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_DIRECT_CONVERSATION,
      "A direct conversation already exists for this pair",
      sanitizePersistenceErrorContext({ ...context, constraint: details || undefined })
    );
  }
  if (d.includes("pending_pair") || d.includes("direct_requests_pending")) {
    return new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PENDING_REQUEST,
      "A pending conversation request already exists for this pair",
      sanitizePersistenceErrorContext({ ...context, constraint: details || undefined })
    );
  }
  if (d.includes("channel_key") || d.includes("club_general") || d.includes("community_lobby")) {
    const entity = String(context.entity || "");
    const code = d.includes("lobby") || entity.includes("Community")
      ? entity.includes("Lobby") || d.includes("lobby")
        ? COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_COMMUNITY_LOBBY
        : COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_COMMUNITY_CHANNEL
      : d.includes("club") || entity.includes("Club")
        ? COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_CLUB_CHANNEL
        : COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_COMMUNITY_CHANNEL;
    return new CommunicationFoundationError(
      code,
      "Channel uniqueness conflict",
      sanitizePersistenceErrorContext({ ...context, constraint: details || undefined })
    );
  }
  if (d.includes("pinned")) {
    return new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PIN,
      "Pin already exists for message in conversation",
      sanitizePersistenceErrorContext({ ...context, constraint: details || undefined })
    );
  }
  if (d.includes("participants")) {
    return new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PARTICIPANT,
      "Participant already exists in conversation",
      sanitizePersistenceErrorContext({ ...context, constraint: details || undefined })
    );
  }
  return new CommunicationFoundationError(
    COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONFLICT,
    `${context.entity || "Communication record"} uniqueness conflict.`,
    sanitizePersistenceErrorContext({ ...context, constraint: details || undefined })
  );
}

/**
 * @param {unknown} err
 * @param {object} [context]
 * @returns {CommunicationFoundationError}
 */
export function mapSupabaseCommunicationError(err, context = {}) {
  if (err instanceof CommunicationFoundationError) return err;

  const parts = extractClientErrorParts(err);
  const base = sanitizePersistenceErrorContext({
    ...context,
    code: parts.code || undefined,
  });
  const code = (parts.code || "").toUpperCase();
  const messageLower = `${parts.message} ${parts.details || ""}`.toLowerCase();
  const status = parts.status;

  if (messageLower.includes("read cursor regression") || code === "P0001") {
    return new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.READ_CURSOR_REGRESSION,
      "Read cursor must only advance forward",
      base
    );
  }

  if (
    code === "23505" ||
    messageLower.includes("duplicate key") ||
    messageLower.includes("unique constraint")
  ) {
    return mapUniquenessConflict(parts.details, base);
  }

  if (code === "23503" || messageLower.includes("foreign key")) {
    return new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONSTRAINT_VIOLATION,
      `${context.entity || "Communication record"} reference constraint violation.`,
      base
    );
  }

  if (
    code === "23514" ||
    messageLower.includes("check constraint") ||
    messageLower.includes("cross-conversation")
  ) {
    if (messageLower.includes("cross-conversation reply")) {
      return new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.CROSS_CONVERSATION_REPLY,
        "Reply target must belong to the same conversation",
        base
      );
    }
    return new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONSTRAINT_VIOLATION,
      `${context.entity || "Communication record"} check constraint violation.`,
      base
    );
  }

  if (
    status === 401 ||
    status === 403 ||
    code === "42501" ||
    messageLower.includes("row-level security") ||
    messageLower.includes("permission denied") ||
    messageLower.includes("rls")
  ) {
    return new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_PERMISSION_DENIED,
      "Communication persistence permission or RLS denial.",
      base
    );
  }

  if (
    status === 408 ||
    status === 503 ||
    status === 504 ||
    code === "57014" ||
    messageLower.includes("timeout") ||
    messageLower.includes("unavailable") ||
    messageLower.includes("connection")
  ) {
    return new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
      "Communication persistence backend unavailable or timed out.",
      { ...base, retryable: true }
    );
  }

  if (code === "PGRST116") {
    return new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_NOT_FOUND,
      `${context.entity || "Communication record"} not found.`,
      base
    );
  }

  return new CommunicationFoundationError(
    COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNKNOWN_FAILURE,
    "Unknown Communication persistence failure.",
    base
  );
}

/**
 * @param {string} entity
 * @param {object} [context]
 */
export function malformedRowError(entity, context = {}) {
  return new CommunicationFoundationError(
    COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_MALFORMED_ROW,
    `${entity} returned an invalid or corrupt database row.`,
    sanitizePersistenceErrorContext({ entity, ...context })
  );
}

/**
 * @param {string} entity
 * @param {object} [context]
 */
export function notFoundError(entity, context = {}) {
  return new CommunicationFoundationError(
    COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_NOT_FOUND,
    `${entity} not found.`,
    sanitizePersistenceErrorContext({ entity, ...context })
  );
}
