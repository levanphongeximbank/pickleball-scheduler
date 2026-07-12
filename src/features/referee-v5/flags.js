export function isRefereeV5Enabled() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return String(import.meta.env.VITE_REFEREE_V5_ENABLED || "").toLowerCase() === "true";
  }
  return false;
}

export function isRefereeV5RemoteMode() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return String(import.meta.env.VITE_REFEREE_V5_DATA_MODE || "").toLowerCase() === "remote";
  }
  return false;
}

export function isRefereeV5RealtimeEnabled() {
  if (!isRefereeV5RemoteMode()) {
    return false;
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const flag = String(import.meta.env.VITE_REFEREE_V5_REALTIME_ENABLED || "true").toLowerCase();
    return flag !== "false";
  }
  return true;
}

export function getRefereeV5EdgeBaseUrl() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const explicit = String(import.meta.env.VITE_REFEREE_V5_EDGE_BASE_URL || "").trim();
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
