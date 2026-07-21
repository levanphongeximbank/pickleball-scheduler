/**
 * Phase 1I-A — Supabase RPC adapter for Public Player Directory.
 *
 * Calls authenticated SECURITY DEFINER RPCs only (no table SELECT).
 * Client is injected — never a browser service-role singleton.
 * SQL is not implemented yet (1I-B); unit tests mock client.rpc.
 */
import { DIRECTORY_ERROR_CODES } from "../constants/directory.js";
import { projectDirectoryPlayerFromRpcRow } from "../projectors/projectDirectoryPlayer.js";
import { decodeDirectoryCursor } from "../utils/directoryCursor.js";
import { trimId } from "../utils/playerId.js";

export const PLAYER_DIRECTORY_RPC = Object.freeze({
  SEARCH: "player_directory_search",
  GET: "player_directory_get",
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const REDACT =
  /(postgres(ql)?:\/\/\S+)|((?:svc|service)[_-]?role)|(\beyJ[A-Za-z0-9_-]{20,})|(sb_[a-z]+_[A-Za-z0-9]+)|(password=\S+)/gi;

function sanitizeMessage(raw, fallback) {
  const text = String(raw || fallback || "Directory backend unavailable").trim();
  return text.replace(REDACT, "[redacted]").slice(0, 280);
}

function mapTransportError(error) {
  const message = sanitizeMessage(
    error?.message || error?.error || error?.details,
    "Directory backend unavailable"
  );
  const lower = message.toLowerCase();
  const code = String(error?.code || "").trim();

  if (
    code === "PGRST202" ||
    lower.includes("could not find the function") ||
    (lower.includes("function") && lower.includes("does not exist"))
  ) {
    return {
      code: DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
      message: "Player directory RPC is not available",
    };
  }

  if (
    code === "42501" ||
    /permission denied|row-level security|rls|jwt|not authenticated|unauthorized/i.test(
      lower
    )
  ) {
    // Do not leak RLS / JWT internals — surface as auth or backend.
    if (/not authenticated|jwt|unauthorized/i.test(lower)) {
      return {
        code: DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED,
        message: "Authentication required for the player directory",
      };
    }
    return {
      code: DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
      message: "Player directory backend denied the request",
    };
  }

  return {
    code: DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
    message: "Player directory backend is unavailable",
  };
}

function parseEnvelope(data) {
  if (data == null) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory RPC returned an empty response",
    };
  }
  if (typeof data === "string") {
    try {
      return parseEnvelope(JSON.parse(data));
    } catch {
      return {
        ok: false,
        code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
        message: "Directory RPC returned a non-JSON payload",
      };
    }
  }
  if (!isPlainObject(data)) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory RPC envelope must be an object",
    };
  }
  return data;
}

function mapEnvelopeErrorCode(code) {
  const raw = String(code || "").trim().toUpperCase();
  if (!raw) return DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE;
  if (raw === "NOT_AUTHENTICATED" || raw === DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED) {
    return DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED;
  }
  if (raw === "INVALID_CURSOR" || raw === DIRECTORY_ERROR_CODES.INVALID_CURSOR) {
    return DIRECTORY_ERROR_CODES.INVALID_CURSOR;
  }
  if (raw === "INVALID_REQUEST" || raw === DIRECTORY_ERROR_CODES.INVALID_REQUEST) {
    return DIRECTORY_ERROR_CODES.INVALID_REQUEST;
  }
  return DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE;
}

function projectRows(rows) {
  if (!Array.isArray(rows)) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory RPC data must be an array",
    };
  }
  const items = [];
  for (const row of rows) {
    const projected = projectDirectoryPlayerFromRpcRow(row);
    if (!projected.ok) {
      return projected;
    }
    items.push(projected.value);
  }
  return { ok: true, items };
}

/**
 * Resolve nextCursor from the approved 1I-0 envelope only:
 *   meta: { nextCursor: "<opaque>"|null, limit, count }
 *
 * Do not invent hasMore / next_sort_name fields absent from the SQL contract.
 * Opaque nextCursor is passed through after URL-safe / app-format validation.
 * Application owns request-cursor encode/decode; RPC returns opaque meta.nextCursor.
 */
function resolveNextCursor(envelope) {
  const meta = isPlainObject(envelope.meta) ? envelope.meta : {};
  const rawNext =
    meta.nextCursor !== undefined
      ? meta.nextCursor
      : meta.next_cursor !== undefined
        ? meta.next_cursor
        : null;

  if (rawNext === null || rawNext === undefined || rawNext === "") {
    return { ok: true, nextCursor: null };
  }

  if (typeof rawNext !== "string") {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory meta.nextCursor must be a string or null",
    };
  }

  const token = rawNext.trim();
  // Prefer app-owned pd1.* format; also allow opaque URL-safe tokens if RPC minted them.
  const decoded = decodeDirectoryCursor(token);
  if (decoded.ok) {
    return { ok: true, nextCursor: token };
  }
  if (/^[A-Za-z0-9._~-]+$/.test(token)) {
    return { ok: true, nextCursor: token };
  }
  return {
    ok: false,
    code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
    message: "Directory meta.nextCursor is malformed",
  };
}

/**
 * @param {object} [deps]
 * @param {() => object|null} [deps.getClient]
 * @param {object} [deps.supabase] — injected authenticated client
 * @param {() => boolean} [deps.hasConfig]
 */
export function createSupabasePlayerDirectoryRepository(deps = {}) {
  const getClient =
    deps.getClient ||
    (deps.supabase ? () => deps.supabase : null) ||
    null;
  const hasConfig =
    deps.hasConfig ||
    (() => Boolean(getClient && getClient()));

  async function invokeRpc(rpcName, args) {
    if (!hasConfig() || !getClient) {
      return {
        ok: false,
        code: DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
        message: "Player directory backend is not configured",
      };
    }
    const client = getClient();
    if (!client || typeof client.rpc !== "function") {
      return {
        ok: false,
        code: DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
        message: "Player directory client is unavailable",
      };
    }

    let result;
    try {
      result = await client.rpc(rpcName, args);
    } catch (error) {
      const mapped = mapTransportError(error);
      return { ok: false, ...mapped };
    }

    if (result?.error) {
      const mapped = mapTransportError(result.error);
      return { ok: false, ...mapped };
    }

    return { ok: true, data: result?.data };
  }

  return {
    kind: "supabase_player_directory_rpc",

    /**
     * @param {import("./playerDirectoryRepository.js").DirectorySearchRequest} request
     */
    async directorySearch(request = {}) {
      // Cursor flow (locked to 1I-0 SQL contract §7):
      // - Facade already validated/decoded opaque request.cursor → INVALID_CURSOR if bad.
      // - Adapter passes opaque p_cursor text only (RPC signature); no invented cursor args.
      // - p_region is string|null per Owner 1I-A remediation (1I-0 designed jsonb —
      //   1I-B must accept text or cast; application does not invent jsonb objects).
      const invoked = await invokeRpc(PLAYER_DIRECTORY_RPC.SEARCH, {
        p_query: request.query || null,
        p_region: request.activityRegion || null,
        p_cursor: request.cursor || null,
        p_limit: request.limit,
      });

      if (!invoked.ok) {
        return {
          ok: false,
          code: invoked.code,
          message: invoked.message,
          items: [],
          nextCursor: null,
        };
      }

      const envelope = parseEnvelope(invoked.data);
      if (envelope.ok === false) {
        return {
          ok: false,
          code: mapEnvelopeErrorCode(envelope.code),
          message: sanitizeMessage(
            envelope.message,
            "Player directory search failed"
          ),
          items: [],
          nextCursor: null,
        };
      }

      // Treat missing ok as success only when data array is present (strict).
      if (envelope.ok !== true && !Array.isArray(envelope.data)) {
        return {
          ok: false,
          code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
          message: "Directory search envelope is invalid",
          items: [],
          nextCursor: null,
        };
      }

      const projected = projectRows(envelope.data);
      if (!projected.ok) {
        return {
          ok: false,
          code: projected.code,
          message: projected.message,
          items: [],
          nextCursor: null,
        };
      }

      const cursorResult = resolveNextCursor(envelope);
      if (!cursorResult.ok) {
        return {
          ok: false,
          code: cursorResult.code,
          message: cursorResult.message,
          items: [],
          nextCursor: null,
        };
      }

      return {
        ok: true,
        code: null,
        message: null,
        items: projected.items,
        nextCursor: cursorResult.nextCursor,
      };
    },

    /**
     * @param {string} playerId
     */
    async directoryGetByPlayerId(playerId) {
      const id = trimId(playerId);
      if (!id) {
        return {
          ok: false,
          code: DIRECTORY_ERROR_CODES.INVALID_REQUEST,
          message: "playerId is required",
          player: null,
        };
      }

      const invoked = await invokeRpc(PLAYER_DIRECTORY_RPC.GET, {
        p_player_id: id,
      });

      if (!invoked.ok) {
        return {
          ok: false,
          code: invoked.code,
          message: invoked.message,
          player: null,
        };
      }

      const envelope = parseEnvelope(invoked.data);
      if (envelope.ok === false) {
        const mapped = mapEnvelopeErrorCode(envelope.code);
        // Auth / request errors stay explicit. Everything else (NOT_FOUND,
        // ineligible, hidden) collapses to a generic null player — no hide reason.
        if (
          mapped === DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED ||
          mapped === DIRECTORY_ERROR_CODES.INVALID_REQUEST ||
          mapped === DIRECTORY_ERROR_CODES.INVALID_CURSOR
        ) {
          return {
            ok: false,
            code: mapped,
            message: sanitizeMessage(envelope.message, "Directory request failed"),
            player: null,
          };
        }
        return { ok: true, code: null, message: null, player: null };
      }

      if (envelope.ok !== true && envelope.data === undefined) {
        return {
          ok: false,
          code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
          message: "Directory detail envelope is invalid",
          player: null,
        };
      }

      const data = envelope.data;
      if (data == null) {
        return { ok: true, code: null, message: null, player: null };
      }

      // Some envelopes wrap a single object; others wrap a one-element array.
      const row = Array.isArray(data) ? data[0] ?? null : data;
      if (row == null) {
        return { ok: true, code: null, message: null, player: null };
      }

      const projected = projectDirectoryPlayerFromRpcRow(row);
      if (!projected.ok) {
        return {
          ok: false,
          code: projected.code,
          message: projected.message,
          player: null,
        };
      }

      return {
        ok: true,
        code: null,
        message: null,
        player: projected.value,
      };
    },
  };
}
