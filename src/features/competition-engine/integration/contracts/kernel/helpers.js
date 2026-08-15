/**
 * Deterministic freeze/clone helpers for Canonical Competition Adapter Contracts.
 * No Date.now / Math.random.
 */

export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    const child = /** @type {Record<string|symbol, unknown>} */ (value)[key];
    if (child && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
}

export function clonePlain(value) {
  return structuredClone(value);
}

export function freezeClone(value) {
  return deepFreeze(clonePlain(value));
}

export function freezeArray(values) {
  return Object.freeze([...(values || [])].map((item) =>
    item && typeof item === "object" ? freezeClone(item) : item
  ));
}
