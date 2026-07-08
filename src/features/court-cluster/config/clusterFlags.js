export function isCourtClustersEnabled() {
  const fromVite = String(import.meta.env?.VITE_COURT_CLUSTERS_ENABLED || "").toLowerCase();
  const fromNode =
    typeof process !== "undefined" && process?.env
      ? String(process.env.VITE_COURT_CLUSTERS_ENABLED || "").toLowerCase()
      : "";
  return fromVite === "true" || fromNode === "true";
}
