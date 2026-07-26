/**
 * Claim request local storage — demoted; explicit local Court runtime authority only.
 */

import { normalizeCourtClaimRequest } from "../models/courtClaimRequest.js";
import {
  assertLocalStorageWriteAllowed,
  getCourtRuntimeAuthority,
  isLocalCourtRuntimeAuthority,
} from "../../court-engine/runtime/composition.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "../../court-engine/runtime/errors.js";

const CLAIM_REQUESTS_KEY = "pickleball-court-claim-requests-v1";

function safeParseArray(raw, fallback = []) {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function loadCourtClaimRequests() {
  if (typeof localStorage === "undefined") {
    return [];
  }
  return safeParseArray(localStorage.getItem(CLAIM_REQUESTS_KEY), []).map(
    normalizeCourtClaimRequest
  );
}

/**
 * Local claim writes require explicit local Court runtime authority.
 * Durable mode must use RPC — never silent local success.
 */
export function saveCourtClaimRequests(requests) {
  const allowed = assertLocalStorageWriteAllowed();
  if (!allowed.ok) {
    return allowed;
  }
  localStorage.setItem(
    CLAIM_REQUESTS_KEY,
    JSON.stringify((requests || []).map(normalizeCourtClaimRequest))
  );
  return { ok: true, authority: allowed.authority };
}

export function canUseLocalCourtClaimStorage() {
  const runtime = getCourtRuntimeAuthority();
  return Boolean(runtime.ok && isLocalCourtRuntimeAuthority(runtime.authority));
}

export function denyLocalCourtClaimWrite(code = "RPC_NOT_DEPLOYED") {
  return createCourtRuntimeError(
    COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT,
    `Court claim local fallback denied under durable authority (${code}).`,
    { rpcCode: code }
  );
}

export { CLAIM_REQUESTS_KEY };
