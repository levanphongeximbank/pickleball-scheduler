import { isCanonicalPhysicalCourtId } from "./canonicalPhysicalCourt.js";

export const CLUB_OPERATIONAL_ACCESS_STATUS = Object.freeze({
  ENABLED: "enabled",
  DISABLED: "disabled",
});

function requiredText(value, field) {
  const normalized = value == null ? "" : String(value).trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

export function normalizeClubOperationalAccess(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Club operational access must be an object.");
  }
  const status = String(input.status ?? "").trim().toLowerCase();
  if (!Object.values(CLUB_OPERATIONAL_ACCESS_STATUS).includes(status)) {
    throw new TypeError("status must be enabled or disabled.");
  }
  const physicalCourtId = requiredText(input.physicalCourtId, "physicalCourtId");
  if (!isCanonicalPhysicalCourtId(physicalCourtId)) {
    throw new TypeError("physicalCourtId must be a UUID.");
  }
  return Object.freeze({
    tenantId: requiredText(input.tenantId, "tenantId"),
    clubId: requiredText(input.clubId, "clubId"),
    physicalCourtId,
    status,
    enabled: status === CLUB_OPERATIONAL_ACCESS_STATUS.ENABLED,
  });
}

export const createClubOperationalAccess = normalizeClubOperationalAccess;

export function evaluateClubOperationalAccess(request = {}, accessRows = []) {
  const tenantId = String(request.tenantId ?? "").trim();
  const clubId = String(request.clubId ?? "").trim();
  const physicalCourtId = String(request.physicalCourtId ?? "").trim();
  if (
    !tenantId ||
    !clubId ||
    !isCanonicalPhysicalCourtId(physicalCourtId) ||
    !Array.isArray(accessRows)
  ) {
    return Object.freeze({ allowed: false, reason: "INVALID_ACCESS_SCOPE", access: null });
  }

  const sameClubCourt = [];
  for (const value of accessRows) {
    let row;
    try {
      row = normalizeClubOperationalAccess(value);
    } catch {
      continue;
    }
    if (row.clubId === clubId && row.physicalCourtId === physicalCourtId) {
      sameClubCourt.push(row);
    }
  }
  if (sameClubCourt.some((row) => row.tenantId !== tenantId)) {
    return Object.freeze({ allowed: false, reason: "CROSS_TENANT_ACCESS", access: null });
  }
  const matches = sameClubCourt.filter((row) => row.tenantId === tenantId);
  if (matches.length === 0) {
    return Object.freeze({ allowed: false, reason: "ACCESS_NOT_FOUND", access: null });
  }
  const enabled = matches.every((row) => row.status === "enabled");
  return Object.freeze({
    allowed: enabled,
    reason: enabled ? "ACCESS_ENABLED" : "ACCESS_DISABLED",
    access: Object.freeze(matches),
  });
}

export function hasClubOperationalAccess(request, accessRows) {
  return evaluateClubOperationalAccess(request, accessRows).allowed;
}
