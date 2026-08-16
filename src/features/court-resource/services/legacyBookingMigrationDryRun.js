/**
 * Legacy club_data_v3 bookings[] → court_operations_bookings dry-run planner.
 * DO NOT EXECUTE against Staging or Production from this module.
 *
 * Rules (Batch 3):
 * - deterministic source identity
 * - deterministic target bookingId
 * - canonical physicalCourtId mapping required
 * - unresolved court mappings fail closed
 * - no merge by court label
 * - idempotent planning
 * - no capacity reservation fabrication without validation
 */
import { createHash } from "node:crypto";
import { isCanonicalPhysicalCourtId } from "../contracts/canonicalPhysicalCourt.js";

function trim(value) {
  return value == null ? "" : String(value).trim();
}

function deterministicBookingId(tenantId, clubId, sourceBookingId) {
  const digest = createHash("sha256")
    .update(`court-operations-booking|${tenantId}|${clubId}|${sourceBookingId}`)
    .digest("hex");
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `a${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

/**
 * @param {object} input
 * @param {string} input.tenantId
 * @param {string} input.clubId
 * @param {Array<object>} input.legacyBookings
 * @param {Array<{legacyCourtId:string, physicalCourtId:string}>} input.courtMappings
 * @returns {{ ok:boolean, planned:object[], rejected:object[], fabricateCapacity:false }}
 */
export function planLegacyBookingMigrationDryRun(input = {}) {
  const tenantId = trim(input.tenantId);
  const clubId = trim(input.clubId);
  if (!tenantId || !clubId) {
    return {
      ok: false,
      code: "MISSING_SCOPE",
      planned: [],
      rejected: [{ reason: "tenantId and clubId are required" }],
      fabricateCapacity: false,
      execute: false,
    };
  }

  const mappings = new Map();
  for (const row of input.courtMappings || []) {
    const legacyCourtId = trim(row.legacyCourtId);
    const physicalCourtId = trim(row.physicalCourtId);
    if (!legacyCourtId || !isCanonicalPhysicalCourtId(physicalCourtId)) continue;
    mappings.set(legacyCourtId, physicalCourtId);
  }

  const planned = [];
  const rejected = [];
  const seen = new Set();

  for (const legacy of input.legacyBookings || []) {
    const sourceBookingId = trim(legacy.id || legacy.bookingId);
    if (!sourceBookingId) {
      rejected.push({ source: legacy, reason: "MISSING_SOURCE_BOOKING_ID" });
      continue;
    }
    const targetBookingId = deterministicBookingId(tenantId, clubId, sourceBookingId);
    if (seen.has(targetBookingId)) {
      rejected.push({ sourceBookingId, reason: "DUPLICATE_TARGET_BOOKING_ID" });
      continue;
    }
    seen.add(targetBookingId);

    const legacyCourtId = trim(legacy.courtId);
    const mapped = mappings.get(legacyCourtId) || trim(legacy.physicalCourtId);
    if (!isCanonicalPhysicalCourtId(mapped)) {
      rejected.push({
        sourceBookingId,
        legacyCourtId,
        reason: "UNRESOLVED_PHYSICAL_COURT_MAPPING",
      });
      continue;
    }

    planned.push({
      sourceBookingId,
      targetBookingId,
      tenantId,
      clubId,
      physicalCourtId: mapped,
      legacyCourtId,
      lifecycleStatus: legacy.bookingStatus || "confirmed",
      customerName: legacy.customerName || "",
      customerPhone: legacy.customerPhone || "",
      note: legacy.note || "",
      date: legacy.date || null,
      startTime: legacy.startTime || null,
      endTime: legacy.endTime || null,
      capacityAction: "VALIDATE_ONLY_NO_FABRICATE",
    });
  }

  return {
    ok: rejected.length === 0,
    planned,
    rejected,
    fabricateCapacity: false,
    execute: false,
    stagingApply: "NO",
    productionApply: "NO",
  };
}
