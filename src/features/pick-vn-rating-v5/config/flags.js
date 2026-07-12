import { PICK_VN_RATING_V5_ENABLED } from "./featureFlags.js";

export { PICK_VN_RATING_V5_ENABLED };

export function isPickVnRatingV5Enabled() {
  return PICK_VN_RATING_V5_ENABLED;
}

export function getRatingV5EdgeBaseUrl() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const explicit = String(import.meta.env.VITE_PICK_VN_RATING_V5_EDGE_BASE_URL || "").trim();
    if (explicit) {
      return explicit.replace(/\/$/, "");
    }
    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
    if (supabaseUrl) {
      return supabaseUrl.replace(/\/$/, "");
    }
  }
  return "";
}
