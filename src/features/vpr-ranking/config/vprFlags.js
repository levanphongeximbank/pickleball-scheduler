function readFlag(name) {
  const fromVite = String(import.meta.env?.[name] || "").toLowerCase();
  const nodeEnv = globalThis["process"]?.env;
  const fromNode = nodeEnv ? String(nodeEnv[name] || "").toLowerCase() : "";
  return fromVite === "true" || fromNode === "true";
}

/** When true, VPR uses Supabase RPC; otherwise local persistence (dev/tests). */
export function isVprRankingEnabled() {
  return readFlag("VITE_VPR_RANKING_ENABLED");
}

export function isVprCloudSyncEnabled() {
  return isVprRankingEnabled() && readFlag("VITE_VPR_CLOUD_SYNC");
}
