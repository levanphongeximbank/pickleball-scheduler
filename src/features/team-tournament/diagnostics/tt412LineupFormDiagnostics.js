/**
 * Preview-safe TT412 lineup form diagnostics (no emails/tokens/secrets).
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

export function logTt412LineupForm(marker, payload = {}) {
  try {
    console.info(marker, scrub(payload));
  } catch {
    // ignore
  }
}

export const TT412_LINEUP_SELECT_CHANGE = "[TT412_LINEUP_SELECT_CHANGE]";
export const TT412_LINEUP_REHYDRATE_DECISION = "[TT412_LINEUP_REHYDRATE_DECISION]";
export const TT412_LINEUP_SAVE_RESULT = "[TT412_LINEUP_SAVE_RESULT]";
export const TT412_LINEUP_SUBMIT_RESULT = "[TT412_LINEUP_SUBMIT_RESULT]";
