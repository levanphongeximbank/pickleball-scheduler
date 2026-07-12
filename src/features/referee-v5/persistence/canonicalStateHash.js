import { serializeMatchState } from "./matchStateSerializer.js";

/**
 * Stable JSON representation with sorted object keys (recursive).
 * Avoids hash drift from key insertion order.
 */
export function canonicalStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
}

export function hashCanonicalValue(value) {
  return digest(canonicalStringify(value));
}

export function hashMatchStateCanonical(state) {
  return hashCanonicalValue(serializeMatchState(state));
}

export function buildRequestHash(parts) {
  return hashCanonicalValue(parts);
}

function digest(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
