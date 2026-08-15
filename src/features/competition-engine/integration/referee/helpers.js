/**
 * Deterministic freeze/clone helpers for the referee adapter contract.
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

export function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(/** @type {Record<string, unknown>} */ (value)).sort();
    return `{${keys
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stableStringify(
            /** @type {Record<string, unknown>} */ (value)[k]
          )}`
      )
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

export function hashCanonical(value) {
  const input = stableStringify(value);
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}

export function matchStateId(tenantId, competitionId, matchId) {
  return `${tenantId}::${competitionId}::${matchId}`;
}
