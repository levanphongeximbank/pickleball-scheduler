import { COURT_CLAIM_REQUEST_STATUSES } from "../constants/courtClaimRequestStatuses.js";

export function normalizeCourtClaimRequest(request) {
  const id = String(request?.id || "").trim();
  const userId = String(request?.userId || request?.user_id || "").trim();
  const venueId = String(request?.venueId || request?.venue_id || "").trim();
  const clusterIds = Array.isArray(request?.clusterIds || request?.cluster_ids)
    ? (request.clusterIds || request.cluster_ids).map((item) => String(item).trim()).filter(Boolean)
    : [];

  const status = Object.values(COURT_CLAIM_REQUEST_STATUSES).includes(request?.status)
    ? request.status
    : COURT_CLAIM_REQUEST_STATUSES.PENDING;

  return {
    id: id || `ccr-${userId}-${Date.now()}`,
    userId,
    venueId,
    clusterIds,
    message: request?.message ? String(request.message).trim() : "",
    status,
    requestedAt: request?.requestedAt || request?.requested_at || new Date().toISOString(),
    reviewedBy: request?.reviewedBy || request?.reviewed_by || null,
    reviewedAt: request?.reviewedAt || request?.reviewed_at || null,
    reviewNote: request?.reviewNote || request?.review_note || "",
    userEmail: request?.userEmail || request?.user_email || "",
    userDisplayName: request?.userDisplayName || request?.user_display_name || "",
  };
}

export function createCourtClaimRequestRecord({ userId, venueId, clusterIds, message }) {
  const now = new Date().toISOString();
  return normalizeCourtClaimRequest({
    id: `ccr-${userId}-${Date.now()}`,
    userId,
    venueId,
    clusterIds,
    message,
    status: COURT_CLAIM_REQUEST_STATUSES.PENDING,
    requestedAt: now,
  });
}
