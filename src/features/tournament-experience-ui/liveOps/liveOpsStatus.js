/** Canonical Live Operations status tokens. Used by Screens 10, 11, 15–18. */
export const OPS_STATUS = {
  LIVE: "LIVE",
  NEXT: "NEXT",
  AVAILABLE: "AVAILABLE",
  WAITING: "WAITING",
  DELAY: "DELAY",
  MAINTENANCE: "MAINTENANCE",
  COMPLETED: "COMPLETED",
  ATTENTION: "ATTENTION",
};

export function normalizeOpsStatus(value) {
  if (!value) return null;
  const upper = String(value).trim().toUpperCase();
  if (upper === "LIVE") return OPS_STATUS.LIVE;
  if (upper === "NEXT" || upper === "UPCOMING") return OPS_STATUS.NEXT;
  if (upper === "AVAILABLE") return OPS_STATUS.AVAILABLE;
  if (upper === "WAITING") return OPS_STATUS.WAITING;
  if (upper === "DELAY") return OPS_STATUS.DELAY;
  if (upper === "MAINTENANCE") return OPS_STATUS.MAINTENANCE;
  if (upper === "COMPLETED") return OPS_STATUS.COMPLETED;
  if (upper === "ATTENTION" || upper === "CONFLICT") return OPS_STATUS.ATTENTION;
  return null;
}

export function resolveCourtStatus(court) {
  if (!court) return OPS_STATUS.AVAILABLE;
  const current = court.currentMatch || null;
  const currentStatus = normalizeOpsStatus(current?.status);
  if (current && currentStatus === OPS_STATUS.LIVE) return OPS_STATUS.LIVE;
  if (court.maintenance || normalizeOpsStatus(court.status) === OPS_STATUS.MAINTENANCE) {
    return OPS_STATUS.MAINTENANCE;
  }
  if (court.delay || currentStatus === OPS_STATUS.DELAY || normalizeOpsStatus(court.status) === OPS_STATUS.DELAY) {
    return OPS_STATUS.DELAY;
  }
  if (court.nextMatch) return OPS_STATUS.NEXT;
  if (court.match && court.match !== "—" && normalizeOpsStatus(court.status) === OPS_STATUS.LIVE) {
    return OPS_STATUS.LIVE;
  }
  return OPS_STATUS.AVAILABLE;
}

export function opsStatusTone(status, severity) {
  const token = normalizeOpsStatus(status) || status;
  if (token === OPS_STATUS.LIVE) return "live";
  if (token === OPS_STATUS.NEXT || token === OPS_STATUS.WAITING) return "info";
  if (token === OPS_STATUS.AVAILABLE || token === OPS_STATUS.COMPLETED) return "success";
  if (token === OPS_STATUS.DELAY) return "warning";
  if (token === OPS_STATUS.MAINTENANCE) return "danger";
  if (token === OPS_STATUS.ATTENTION) return severity === "danger" || severity === "critical" ? "danger" : "warning";
  return "draft";
}

export function opsStatusLabel(status) {
  if (status && typeof status === "object") {
    return normalizeOpsStatus(status.status) || OPS_STATUS.AVAILABLE;
  }
  return normalizeOpsStatus(status) || status || OPS_STATUS.AVAILABLE;
}

export function courtAccent(status) {
  const token = normalizeOpsStatus(status) || status;
  if (token === OPS_STATUS.LIVE) return "live";
  if (token === OPS_STATUS.DELAY || token === OPS_STATUS.ATTENTION) return "warning";
  if (token === OPS_STATUS.MAINTENANCE) return "danger";
  if (token === OPS_STATUS.AVAILABLE || token === OPS_STATUS.COMPLETED) return "success";
  return "info";
}
