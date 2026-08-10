/**
 * Preview-safe TT412 captain-access diagnostics (no tokens/emails/secrets).
 */

function scrub(value) {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  const out = Array.isArray(value) ? [] : {};
  for (const [key, entry] of Object.entries(value)) {
    const lower = String(key).toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("password") ||
      lower.includes("secret") ||
      lower.includes("email") ||
      lower.includes("authorization")
    ) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = typeof entry === "object" && entry !== null ? scrub(entry) : entry;
  }
  return out;
}

export function logTt412CaptainAccess(marker, payload = {}) {
  try {
    console.info(marker, scrub(payload));
  } catch {
    // ignore
  }
}

export const TT412_CAPTAIN_ACCESS_TOGGLE_START = "[TT412_CAPTAIN_ACCESS_TOGGLE_START]";
export const TT412_CAPTAIN_ACCESS_TOGGLE_RESULT = "[TT412_CAPTAIN_ACCESS_TOGGLE_RESULT]";
export const TT412_CAPTAIN_PORTAL_READ = "[TT412_CAPTAIN_PORTAL_READ]";
export const TT412_CAPTAIN_PORTAL_GATE = "[TT412_CAPTAIN_PORTAL_GATE]";
