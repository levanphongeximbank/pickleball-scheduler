import { normalizeCourtClaimRequest } from "../models/courtClaimRequest.js";

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
  return safeParseArray(localStorage.getItem(CLAIM_REQUESTS_KEY), []).map(
    normalizeCourtClaimRequest
  );
}

export function saveCourtClaimRequests(requests) {
  localStorage.setItem(
    CLAIM_REQUESTS_KEY,
    JSON.stringify((requests || []).map(normalizeCourtClaimRequest))
  );
}
