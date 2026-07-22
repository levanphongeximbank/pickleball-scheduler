/**
 * CORE-14 — canonical serializer for frozen contract values.
 * No whitespace; sorted keys; safe-integer decimal; fail closed on unsupported.
 *
 * Unsupported values throw ResourceConflictContractError with
 * INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE and evidence:
 * { valuePath, valueType, reason }.
 */

import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { ResourceConflictContractError } from "../errors/ResourceConflictContractError.js";
import { compareUtf8Bytewise, sortedObjectKeys, sortIdentifiers } from "./compare.js";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  if (value instanceof Map) return false;
  if (value instanceof Set) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function valueTypeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "Date";
  if (value instanceof Map) return "Map";
  if (value instanceof Set) return "Set";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return "Infinity";
    if (!Number.isSafeInteger(value)) return "unsafe-number";
    return "number";
  }
  return typeof value;
}

/**
 * Decimal representation of a safe integer (no exponent, no leading +).
 * @param {number} value
 * @returns {string}
 */
export function formatSafeIntegerDecimal(value) {
  if (!Number.isSafeInteger(value)) {
    throw new ResourceConflictContractError(
      INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
      "Canonical numeric serialization requires Number.isSafeInteger",
      {
        valuePath: "",
        valueType: valueTypeOf(value),
        reason: "NON_SAFE_INTEGER",
        value: String(value),
      }
    );
  }
  if (Object.is(value, -0)) return "0";
  return String(value);
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {string} reason
 * @returns {never}
 */
function rejectUnsupported(value, path, reason = "UNSUPPORTED_TYPE") {
  throw new ResourceConflictContractError(
    INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
    `Unsupported canonical value at ${path || "(root)"}: ${valueTypeOf(value)}`,
    {
      valuePath: path || "",
      valueType: valueTypeOf(value),
      reason,
    }
  );
}

/**
 * @param {string} s
 * @returns {string}
 */
function escapeJsonString(s) {
  let out = '"';
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    const ch = s[i];
    if (ch === '"' || ch === "\\") {
      out += `\\${ch}`;
    } else if (c === 0x08) out += "\\b";
    else if (c === 0x09) out += "\\t";
    else if (c === 0x0a) out += "\\n";
    else if (c === 0x0c) out += "\\f";
    else if (c === 0x0d) out += "\\r";
    else if (c < 0x20) {
      out += `\\u${c.toString(16).padStart(4, "0")}`;
    } else {
      out += ch;
    }
  }
  return `${out}"`;
}

/**
 * Serialize an identifier set: sorted UTF-8 bytewise, then sequence-serialized.
 * Use when the contract treats the array as an unordered set of identifiers.
 * @param {readonly unknown[]} values
 * @param {{ includeMetadata?: boolean }} [options]
 * @returns {string}
 */
export function canonicalSerializeIdentifierSet(values, options = {}) {
  return canonicalSerialize(sortIdentifiers(values), options);
}

/**
 * Canonical serialize supported structures (no insignificant whitespace).
 * Arrays are treated as ordered sequences unless callers use
 * canonicalSerializeIdentifierSet for set-like identifier lists.
 *
 * @param {unknown} value
 * @param {{ includeMetadata?: boolean, path?: string, seen?: WeakSet<object> }} [options]
 * @returns {string}
 */
export function canonicalSerialize(value, options = {}) {
  const includeMetadata = options.includeMetadata === true;
  const path = options.path || "";
  const seen = options.seen || new WeakSet();

  if (value === null) return "null";

  const t = typeof value;
  if (t === "string") return escapeJsonString(value);
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (!Number.isSafeInteger(value)) {
      rejectUnsupported(value, path, "NON_SAFE_INTEGER");
    }
    return formatSafeIntegerDecimal(value);
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    rejectUnsupported(value, path, "UNSUPPORTED_TYPE");
  }

  if (t !== "object") rejectUnsupported(value, path, "UNSUPPORTED_TYPE");

  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    rejectUnsupported(value, path, "UNSUPPORTED_TYPE");
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      rejectUnsupported(value, path, "CYCLIC_REFERENCE");
    }
    seen.add(value);
    const parts = value.map((item, i) =>
      canonicalSerialize(item, {
        includeMetadata,
        path: `${path}[${i}]`,
        seen,
      })
    );
    return `[${parts.join(",")}]`;
  }

  if (!isPlainObject(value)) {
    rejectUnsupported(value, path, "UNSUPPORTED_TYPE");
  }

  if (seen.has(/** @type {object} */ (value))) {
    rejectUnsupported(value, path, "CYCLIC_REFERENCE");
  }
  seen.add(/** @type {object} */ (value));

  const keys = sortedObjectKeys(/** @type {Record<string, unknown>} */ (value)).filter(
    (key) => includeMetadata || key !== "metadata"
  );
  keys.sort(compareUtf8Bytewise);

  const parts = [];
  for (const key of keys) {
    const child = /** @type {Record<string, unknown>} */ (value)[key];
    if (child === undefined) continue;
    parts.push(
      `${escapeJsonString(key)}:${canonicalSerialize(child, {
        includeMetadata,
        path: path ? `${path}.${key}` : key,
        seen,
      })}`
    );
  }
  return `{${parts.join(",")}}`;
}

/**
 * Deep freeze a plain clone. Does not mutate caller input.
 * @param {unknown} value
 * @returns {unknown}
 */
export function deepFreezeClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const arr = value.map((item) => deepFreezeClone(item));
    return Object.freeze(arr);
  }
  if (!isPlainObject(value)) {
    rejectUnsupported(value, "", "UNSUPPORTED_TYPE");
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = deepFreezeClone(/** @type {Record<string, unknown>} */ (value)[key]);
  }
  return Object.freeze(out);
}
