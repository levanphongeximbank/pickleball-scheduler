/**
 * Phase 2C — Freeze-named joinRequest.* ports.
 * Thin façade over clubMembershipRequestService (V2 → clubStorageV2RpcService).
 */

import { getCurrentUser } from "../../../auth/authService.js";
import { JOIN_REQUEST_AUDIT_EVENTS } from "../constants/membershipAuditEvents.js";
import {
  approveClubMembershipRequest,
  cancelClubMembershipRequest,
  listMyMembershipRequestsCanonical,
  listPendingMembershipRequests,
  rejectClubMembershipRequest,
  submitClubMembershipRequest,
} from "../services/clubMembershipRequestService.js";

/**
 * joinRequest.create
 * @param {string} clubId
 * @param {{ tenantId?: string, user?: object, message?: string, idempotencyKey?: string, expectedVersion?: number|null }} [options]
 */
export async function joinRequestCreate(clubId, options = {}) {
  const user = options.user || getCurrentUser();
  const result = await submitClubMembershipRequest(
    clubId,
    options.tenantId ?? null,
    user,
    {
      message: options.message || "",
      idempotencyKey: options.idempotencyKey || options.requestId,
      expectedVersion: options.expectedVersion ?? null,
    }
  );
  if (result?.ok) {
    return { ...result, auditEvent: JOIN_REQUEST_AUDIT_EVENTS.CREATED };
  }
  return result;
}

/**
 * joinRequest.approve
 * @param {string} clubId
 * @param {string} requestId
 * @param {{ tenantId?: string, user?: object, reviewNote?: string, idempotencyKey?: string, expectedVersion?: number|null }} [options]
 */
export async function joinRequestApprove(clubId, requestId, options = {}) {
  const result = await approveClubMembershipRequest(
    clubId,
    requestId,
    options.tenantId ?? null,
    {
      ...options,
      idempotencyKey: options.idempotencyKey || options.requestId,
    }
  );
  if (result?.ok) {
    return {
      ...result,
      auditEvent: JOIN_REQUEST_AUDIT_EVENTS.APPROVED,
      sideEffectAuditEvent: "membership.added",
    };
  }
  return result;
}

/**
 * joinRequest.reject
 */
export async function joinRequestReject(clubId, requestId, options = {}) {
  const result = await rejectClubMembershipRequest(
    clubId,
    requestId,
    options.tenantId ?? null,
    {
      ...options,
      idempotencyKey: options.idempotencyKey || options.requestId,
    }
  );
  if (result?.ok) {
    return { ...result, auditEvent: JOIN_REQUEST_AUDIT_EVENTS.REJECTED };
  }
  return result;
}

/**
 * joinRequest.cancel
 */
export async function joinRequestCancel(clubId, requestId, options = {}) {
  const user = options.user || getCurrentUser();
  const result = await cancelClubMembershipRequest(
    clubId,
    requestId,
    user?.id || options.userId || null,
    {
      ...options,
      idempotencyKey: options.idempotencyKey || options.requestId,
    }
  );
  if (result?.ok) {
    return { ...result, auditEvent: JOIN_REQUEST_AUDIT_EVENTS.CANCELLED };
  }
  return result;
}

/** joinRequest.listPending */
export async function joinRequestListPending(clubId, options = {}) {
  const user = options.user || getCurrentUser();
  const requests = await listPendingMembershipRequests(
    clubId,
    options.tenantId ?? null,
    user
  );
  return { ok: true, requests: Array.isArray(requests) ? requests : [] };
}

/** joinRequest.listMine */
export async function joinRequestListMine(options = {}) {
  const user = options.user || getCurrentUser();
  const result = await listMyMembershipRequestsCanonical(user?.id);
  if (result?.ok === false) {
    return result;
  }
  if (Array.isArray(result)) {
    return { ok: true, requests: result };
  }
  if (result?.requests) {
    return { ok: true, requests: result.requests, ...result };
  }
  return { ok: true, requests: [] };
}
