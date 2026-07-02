const encoder = new TextEncoder();

async function digestSha256(value) {
  const data = encoder.encode(value);
  if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  throw new Error("SHA-256 not available in this runtime.");
}

export async function hashApiKey(plainKey) {
  return digestSha256(String(plainKey || ""));
}

/** Constant-time-ish compare for SHA-256 hex digests. */
export function verifyApiKey(plainKey, storedHash) {
  if (!plainKey || !storedHash) return false;
  const a = String(storedHash);
  let b = "";
  return hashApiKey(plainKey).then((computed) => {
    b = computed;
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i += 1) {
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
  });
}

export function parseApiKeyPrefix(plainKey) {
  const value = String(plainKey || "");
  const dot = value.indexOf(".");
  if (dot <= 0) return "";
  return value.slice(0, dot);
}

export function generateApiKeyPrefix() {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `pk_${rand}`;
}

export async function generateApiKey() {
  const prefix = generateApiKeyPrefix();
  const secret =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : `${Date.now()}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  const plainKey = `${prefix}.${secret}`;
  const hashedKey = await hashApiKey(plainKey);
  return { plainKey, prefix, hashedKey };
}
