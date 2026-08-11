/**
 * Preview diagnostic markers for PR #412 "Lưu giải" / tournament.save_draft live path.
 * Logging only — never throws, never mutates inputs, never drives control flow.
 */

const MARKERS = Object.freeze({
  START: "[TT412_SAVE_START]",
  RPC_CALL: "[TT412_SAVE_RPC_CALL]",
  RPC_RESULT: "[TT412_SAVE_RPC_RESULT]",
  READBACK: "[TT412_SAVE_READBACK]",
  FINAL: "[TT412_SAVE_FINAL]",
});

/**
 * @param {string} marker
 * @param {Record<string, unknown>} [payload]
 */
export function tt412SaveDraftDiag(marker, payload = {}) {
  try {
    if (typeof console === "undefined" || typeof console.info !== "function") {
      return;
    }
    const safe = { ...payload };
    for (const key of Object.keys(safe)) {
      const lower = String(key).toLowerCase();
      if (
        lower.includes("token") ||
        lower.includes("password") ||
        lower.includes("secret") ||
        lower.includes("authorization") ||
        lower.includes("apikey") ||
        lower.includes("email") ||
        lower === "idempotencykey" ||
        lower.includes("idempotency_key")
      ) {
        delete safe[key];
      }
    }
    console.info(marker, safe);
  } catch {
    // Diagnostic only — swallow.
  }
}

export const TT412_SAVE_DRAFT_DIAG = MARKERS;
