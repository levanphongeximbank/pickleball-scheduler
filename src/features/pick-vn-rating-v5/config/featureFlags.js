/** Feature flag — V5 rating system (default OFF until owner approval). */
export const PICK_VN_RATING_V5_ENABLED =
  String(import.meta.env?.VITE_PICK_VN_RATING_V5_ENABLED ?? "false").toLowerCase() === "true";
