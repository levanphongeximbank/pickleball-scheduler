const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const IMMUTABLE_FIELDS = Object.freeze([
  "physicalCourtId",
  "tenantId",
  "clusterId",
]);

function requiredText(value, field) {
  const normalized = value == null ? "" : String(value).trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function optionalText(value) {
  const normalized = value == null ? "" : String(value).trim();
  return normalized || null;
}

export function isCanonicalPhysicalCourtId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

export function normalizeCanonicalPhysicalCourt(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Canonical physical court must be an object.");
  }
  const physicalCourtId = requiredText(input.physicalCourtId, "physicalCourtId");
  if (!isCanonicalPhysicalCourtId(physicalCourtId)) {
    throw new TypeError("physicalCourtId must be a UUID.");
  }
  const sortOrder = input.sortOrder == null ? 0 : Number(input.sortOrder);
  if (!Number.isSafeInteger(sortOrder)) {
    throw new TypeError("sortOrder must be an integer.");
  }
  const lifecycleStatus = String(input.lifecycleStatus ?? "active").trim().toLowerCase();
  if (!["active", "inactive", "maintenance"].includes(lifecycleStatus)) {
    throw new TypeError("lifecycleStatus is unsupported.");
  }
  return Object.freeze({
    physicalCourtId,
    tenantId: requiredText(input.tenantId, "tenantId"),
    clusterId: requiredText(input.clusterId, "clusterId"),
    displayName: requiredText(input.displayName, "displayName"),
    displayCode: optionalText(input.displayCode),
    displayNumber: optionalText(input.displayNumber),
    sortOrder,
    lifecycleStatus,
  });
}

export const createCanonicalPhysicalCourt = normalizeCanonicalPhysicalCourt;

export function updateCanonicalPhysicalCourt(current, changes = {}) {
  const existing = normalizeCanonicalPhysicalCourt(current);
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new TypeError("Canonical physical court changes must be an object.");
  }
  for (const field of IMMUTABLE_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(changes, field) &&
      String(changes[field] ?? "").trim() !== existing[field]
    ) {
      throw new TypeError(`${field} is immutable.`);
    }
  }
  return normalizeCanonicalPhysicalCourt({ ...existing, ...changes });
}

export { IMMUTABLE_FIELDS as CANONICAL_COURT_IMMUTABLE_FIELDS };
