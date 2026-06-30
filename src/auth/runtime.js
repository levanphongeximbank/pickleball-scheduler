/**
 * Runtime flags — khóa dev fallback trên Preview/Production build hoặc khi có Supabase env.
 */
export function isProductionBuild() {
  return Boolean(typeof import.meta !== "undefined" && import.meta.env?.PROD);
}

export function isSecureRuntime() {
  if (isProductionBuild()) {
    return true;
  }

  const url =
    typeof import.meta !== "undefined" && import.meta.env
      ? String(import.meta.env.VITE_SUPABASE_URL || "").trim()
      : "";

  return url !== "";
}
