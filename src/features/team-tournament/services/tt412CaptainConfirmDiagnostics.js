/**
 * Preview diagnostic markers for PR #412 captain-confirm live divergence.
 * Logging only — never throws, never mutates inputs, never drives control flow.
 */

const MARKERS = Object.freeze({
  START: "[TT412_CAPTAIN_CONFIRM_START]",
  GROUP_PERSIST_DECISION: "[TT412_GROUP_PERSIST_DECISION]",
  REPLACE_GROUPS_CALL: "[TT412_REPLACE_GROUPS_CALL]",
  REPLACE_GROUPS_SKIPPED: "[TT412_REPLACE_GROUPS_SKIPPED]",
  RESULT: "[TT412_CAPTAIN_CONFIRM_RESULT]",
});

/**
 * @param {string} marker
 * @param {Record<string, unknown>} [payload]
 */
export function tt412CaptainConfirmDiag(marker, payload = {}) {
  try {
    if (typeof console === "undefined" || typeof console.info !== "function") {
      return;
    }
    // Strip accidental secret-ish keys if callers pass a broad object.
    const safe = { ...payload };
    for (const key of Object.keys(safe)) {
      const lower = String(key).toLowerCase();
      if (
        lower.includes("token") ||
        lower.includes("password") ||
        lower.includes("secret") ||
        lower.includes("authorization") ||
        lower.includes("apikey") ||
        lower.includes("email")
      ) {
        delete safe[key];
      }
    }
    console.info(marker, safe);
  } catch {
    // Diagnostic only — swallow.
  }
}

export const TT412_CAPTAIN_CONFIRM_DIAG = MARKERS;
