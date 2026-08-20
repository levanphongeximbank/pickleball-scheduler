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

export function opsStatusLabelVi(status) {
  if (status === OPS_STATUS.LIVE) return "Đang thi đấu";
  if (status === OPS_STATUS.NEXT) return "Tiếp theo";
  if (status === OPS_STATUS.AVAILABLE) return "Sẵn sàng";
  if (status === OPS_STATUS.WAITING) return "Đang chờ";
  if (status === OPS_STATUS.DELAY) return "Chậm";
  if (status === OPS_STATUS.MAINTENANCE) return "Bảo trì";
  if (status === OPS_STATUS.COMPLETED) return "Hoàn tất";
  if (status === OPS_STATUS.ATTENTION) return "Cần xử lý";
  return "Chưa xác định";
}

export function opsStatusTone(status) {
  if (status === OPS_STATUS.LIVE) return "live";
  if (status === OPS_STATUS.NEXT || status === OPS_STATUS.WAITING) return "info";
  if (status === OPS_STATUS.AVAILABLE || status === OPS_STATUS.COMPLETED) return "success";
  if (status === OPS_STATUS.DELAY || status === OPS_STATUS.ATTENTION) return "warning";
  if (status === OPS_STATUS.MAINTENANCE) return "danger";
  return "draft";
}

export function isMaintenanceCourt(court) {
  if (!court) return false;
  if (court.maintenance === true) return true;
  const status = String(court.status || "").toLowerCase();
  return status === "maintenance" || status === "bao_tri";
}

export function derivePhysicalCourtStatus(court, matchesOnCourt) {
  const list = Array.isArray(matchesOnCourt) ? matchesOnCourt : [];
  if (list.some((match) => match.status === "live")) return OPS_STATUS.LIVE;
  if (list.some((match) => match.status === "attention" || match.rawStatus === "postponed")) {
    return OPS_STATUS.DELAY;
  }
  if (isMaintenanceCourt(court)) return OPS_STATUS.MAINTENANCE;
  if (list.some((match) => match.status === "upcoming" || match.status === "waiting")) {
    return OPS_STATUS.NEXT;
  }
  return OPS_STATUS.AVAILABLE;
}
