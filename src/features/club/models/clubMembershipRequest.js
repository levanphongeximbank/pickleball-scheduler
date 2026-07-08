import { CLUB_MEMBERSHIP_REQUEST_STATUSES } from "../constants/clubMembershipRequestStatuses.js";

export function normalizeClubMembershipRequest(request) {
  const clubId = String(request?.clubId || "").trim();
  const userId = String(request?.userId || "").trim();
  const tenantId = String(request?.tenantId || "").trim();
  const id = String(request?.id || "").trim();

  const status = Object.values(CLUB_MEMBERSHIP_REQUEST_STATUSES).includes(request?.status)
    ? request.status
    : CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING;

  return {
    id: id || `cmr-${clubId}-${userId}`,
    tenantId,
    clubId,
    userId,
    displayName: request?.displayName ? String(request.displayName).trim() : "",
    pickVnRating:
      request?.pickVnRating != null && Number.isFinite(Number(request.pickVnRating))
        ? Number(request.pickVnRating)
        : null,
    message: request?.message ? String(request.message).trim() : "",
    status,
    requestedAt: request?.requestedAt || new Date().toISOString(),
    reviewedBy: request?.reviewedBy ? String(request.reviewedBy) : null,
    reviewedAt: request?.reviewedAt ? String(request.reviewedAt) : null,
    reviewNote: request?.reviewNote ? String(request.reviewNote) : "",
    approvedPlayerId: request?.approvedPlayerId ? String(request.approvedPlayerId) : null,
  };
}

export function createClubMembershipRequestRecord({
  tenantId,
  clubId,
  userId,
  displayName,
  pickVnRating,
  message,
}) {
  const now = new Date().toISOString();
  return normalizeClubMembershipRequest({
    id: `cmr-${clubId}-${userId}`,
    tenantId,
    clubId,
    userId,
    displayName,
    pickVnRating,
    message,
    status: CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING,
    requestedAt: now,
  });
}
