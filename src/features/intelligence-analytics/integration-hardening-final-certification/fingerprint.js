/**
 * Stable non-cryptographic fingerprint for certification evidence.
 * Caller must exclude secrets/PII before fingerprinting.
 * @param {unknown} value
 * @returns {string}
 */
export function createSafeCertificationFingerprint(value) {
  const canonical = JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce((acc, k) => {
          acc[k] = v[k];
          return acc;
        }, /** @type {Record<string, unknown>} */ ({}));
    }
    return v;
  });
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
