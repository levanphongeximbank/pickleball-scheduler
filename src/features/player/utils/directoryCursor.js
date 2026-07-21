/**
 * Phase 1I-A — Opaque directory pagination cursor.
 *
 * Logical sort key (1I-0): lower(trim(display_name)), player_id
 * UI sees only an opaque, URL-safe token. Malformed → INVALID_CURSOR (no fallback).
 * Pure JS encoding — safe for Node unit tests and browser Vite bundles.
 */
import {
  DIRECTORY_CURSOR_VERSION,
  DIRECTORY_ERROR_CODES,
} from "../constants/directory.js";
import { trimId } from "./playerId.js";

const CURSOR_PREFIX = `pd${DIRECTORY_CURSOR_VERSION}.`;

const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Normalize display name for the cursor sort key.
 * @param {unknown} displayName
 * @returns {string}
 */
export function normalizeDirectorySortName(displayName) {
  return String(displayName ?? "")
    .trim()
    .toLowerCase();
}

function utf8Bytes(text) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text);
  }
  // Minimal UTF-8 fallback for rare environments without TextEncoder.
  const out = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
        out.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
        continue;
      }
      out.push(0xef, 0xbf, 0xbd);
    } else {
      out.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return Uint8Array.from(out);
}

function bytesToUtf8(bytes) {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function encodeBase64Url(bytes) {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    result += B64[(triple >> 18) & 63];
    result += B64[(triple >> 12) & 63];
    result += i + 1 < bytes.length ? B64[(triple >> 6) & 63] : "";
    result += i + 2 < bytes.length ? B64[triple & 63] : "";
  }
  return result.replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(token) {
  const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const base64 = normalized + "=".repeat(padLen);
  const bytes = [];
  for (let i = 0; i < base64.length; i += 4) {
    const c1 = base64[i];
    const c2 = base64[i + 1];
    const c3 = base64[i + 2];
    const c4 = base64[i + 3];
    const enc1 = B64.indexOf(c1);
    const enc2 = B64.indexOf(c2);
    if (enc1 < 0 || enc2 < 0) throw new Error("invalid base64");
    const enc3 = c3 === "=" ? -1 : B64.indexOf(c3);
    const enc4 = c4 === "=" ? -1 : B64.indexOf(c4);
    if (c3 !== "=" && enc3 < 0) throw new Error("invalid base64");
    if (c4 !== "=" && enc4 < 0) throw new Error("invalid base64");
    const triple =
      (enc1 << 18) |
      (enc2 << 12) |
      ((enc3 < 0 ? 0 : enc3) << 6) |
      (enc4 < 0 ? 0 : enc4);
    bytes.push((triple >> 16) & 255);
    if (enc3 >= 0) bytes.push((triple >> 8) & 255);
    if (enc4 >= 0) bytes.push(triple & 255);
  }
  return Uint8Array.from(bytes);
}

/**
 * Encode an opaque cursor from the approved logical sort key.
 * @param {{ displayName?: unknown, normalizedDisplayName?: unknown, playerId: unknown }} parts
 * @returns {{ ok: true, cursor: string } | { ok: false, code: string, message: string }}
 */
export function encodeDirectoryCursor(parts = {}) {
  const playerId = trimId(parts.playerId);
  if (!playerId) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Cursor requires a non-empty playerId",
    };
  }

  const normalized =
    parts.normalizedDisplayName != null
      ? normalizeDirectorySortName(parts.normalizedDisplayName)
      : normalizeDirectorySortName(parts.displayName);

  if (!normalized) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Cursor requires a non-empty normalized display name",
    };
  }

  const payload = JSON.stringify({
    v: DIRECTORY_CURSOR_VERSION,
    n: normalized,
    p: playerId,
  });

  const encoded = encodeBase64Url(utf8Bytes(payload));
  return { ok: true, cursor: `${CURSOR_PREFIX}${encoded}` };
}

/**
 * Decode and validate an opaque cursor.
 * @param {unknown} raw
 * @returns {{ ok: true, value: { version: number, normalizedDisplayName: string, playerId: string } } | { ok: false, code: string, message: string }}
 */
export function decodeDirectoryCursor(raw) {
  if (raw == null || raw === "") {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Cursor is empty",
    };
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Cursor must be a string",
    };
  }

  const token = raw.trim();
  if (!token.startsWith(CURSOR_PREFIX)) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Unsupported or malformed cursor token",
    };
  }

  const body = token.slice(CURSOR_PREFIX.length);
  if (!body || /[^A-Za-z0-9_-]/.test(body)) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Cursor token is not URL-safe base64",
    };
  }

  let parsed;
  try {
    const json = bytesToUtf8(decodeBase64Url(body));
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Cursor payload could not be decoded",
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Cursor payload must be an object",
    };
  }

  if (parsed.v !== DIRECTORY_CURSOR_VERSION) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Unsupported cursor version",
    };
  }

  const normalizedDisplayName = normalizeDirectorySortName(parsed.n);
  if (!normalizedDisplayName) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Cursor is missing the sort name key",
    };
  }

  const playerId = trimId(parsed.p);
  if (!playerId) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "Cursor is missing a valid playerId",
    };
  }

  // Reject unexpected PII-bearing keys in the cursor payload.
  const allowed = new Set(["v", "n", "p"]);
  for (const key of Object.keys(parsed)) {
    if (!allowed.has(key)) {
      return {
        ok: false,
        code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
        message: "Cursor contains unsupported fields",
      };
    }
  }

  return {
    ok: true,
    value: {
      version: DIRECTORY_CURSOR_VERSION,
      normalizedDisplayName,
      playerId,
    },
  };
}
