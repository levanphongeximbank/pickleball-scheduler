/**
 * Platform Technical Contract Kit — Phase 1B local exports.
 *
 * Contract-local barrel only. Not re-exported from src/core/platform/index.js.
 */

export { ok, fail, isOk, isFail } from "./result.js";
export {
  normalizeOpaqueId,
  isOpaqueId,
  OPAQUE_ID_ERROR,
} from "./opaqueId.js";
export {
  nowIso,
  parseIsoStrict,
  ISO_INSTANT_ERROR,
} from "./isoClock.js";
