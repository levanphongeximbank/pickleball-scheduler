/**
 * Legacy → canonical migration dry-runs (Batch 8).
 * Read-only planning. Never writes Staging/Production.
 *
 * STALE_EPHEMERAL_STATE_AUTO_MIGRATED=NO
 * Unbounded court.status is NEVER converted to a Resource Block.
 */
import { isCanonicalPhysicalCourtId } from "../contracts/canonicalPhysicalCourt.js";

function trim(value) {
  return value == null ? "" : String(value).trim();
}

function hasExplicitInterval(row) {
  const startsAt = trim(row.startsAt || row.startAt || row.start);
  const endsAt = trim(row.endsAt || row.endAt || row.end);
  if (startsAt && endsAt) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
  }
  const date = trim(row.date);
  const startTime = trim(row.startTime);
  const endTime = trim(row.endTime);
  return Boolean(date && startTime && endTime);
}

/**
 * Plan migration of legacy maintenance bookings with explicit intervals.
 * Unbounded court.status rows are rejected (not fabricated into blocks).
 */
export function planLegacyMaintenanceMigrationDryRun(input = {}) {
  const tenantId = trim(input.tenantId);
  const clubId = trim(input.clubId);
  const planned = [];
  const rejected = [];

  if (!tenantId || !clubId) {
    return {
      ok: false,
      code: "MISSING_SCOPE",
      planned: [],
      rejected: [{ reason: "tenantId and clubId are required" }],
      execute: false,
      fabricateResourceBlock: false,
    };
  }

  const mappings = new Map();
  for (const row of input.courtMappings || []) {
    const legacyCourtId = trim(row.legacyCourtId);
    const physicalCourtId = trim(row.physicalCourtId);
    if (!legacyCourtId || !isCanonicalPhysicalCourtId(physicalCourtId)) continue;
    mappings.set(legacyCourtId, physicalCourtId);
  }

  for (const legacy of input.legacyMaintenanceBookings || []) {
    const bookingType = trim(legacy.bookingType || legacy.type).toLowerCase();
    if (bookingType && bookingType !== "maintenance") {
      rejected.push({ source: legacy, reason: "NOT_MAINTENANCE_BOOKING" });
      continue;
    }
    if (!hasExplicitInterval(legacy)) {
      rejected.push({
        source: legacy,
        reason: "UNBOUNDED_OR_MISSING_INTERVAL",
        note: "Do not invent Resource Block interval from incomplete booking window.",
      });
      continue;
    }
    const legacyCourtId = trim(legacy.courtId || legacy.legacyCourtId);
    const physicalCourtId = mappings.get(legacyCourtId) || trim(legacy.physicalCourtId);
    if (!isCanonicalPhysicalCourtId(physicalCourtId)) {
      rejected.push({ source: legacy, reason: "UNMAPPED_PHYSICAL_COURT", legacyCourtId });
      continue;
    }
    planned.push({
      tenantId,
      clubId,
      physicalCourtId,
      blockType: "MAINTENANCE",
      sourceBookingId: trim(legacy.id || legacy.bookingId) || null,
      migratable: true,
    });
  }

  for (const statusRow of input.unboundedCourtStatusRows || []) {
    rejected.push({
      source: statusRow,
      reason: "COURT_STATUS_NOT_RESOURCE_BLOCK",
      note: "court.status is LEGACY_COMPATIBILITY_ONLY — never auto-converted.",
    });
  }

  return {
    ok: rejected.length === 0,
    planned,
    rejected,
    execute: false,
    fabricateResourceBlock: false,
    autoConvertCourtStatus: false,
  };
}

/**
 * Plan (refuse) promotion of stale Court Engine / blob occupancy into Live Runtime.
 */
export function planLegacyLiveStateMigrationDryRun(input = {}) {
  const planned = [];
  const rejected = [];

  for (const blob of input.courtEngineOccupancyBlobs || []) {
    rejected.push({
      source: blob,
      reason: "STALE_EPHEMERAL_OCCUPANCY_NOT_PROMOTED",
      note: "Canonical Live Runtime starts from persisted live-state tables, not browser blob truth.",
    });
  }

  for (const row of input.legacyCourtStatusRows || []) {
    rejected.push({
      source: row,
      reason: "COURT_STATUS_NOT_LIVE_RUNTIME_AUTHORITY",
      note: "LEGACY_COURT_STATUS_AUTHORITY_ON_CANONICAL_PATH=NO",
    });
  }

  for (const row of input.currentMatchIdRows || []) {
    rejected.push({
      source: row,
      reason: "CURRENTMATCHID_NOT_OCCUPANCY_AUTHORITY",
      note: "CURRENTMATCHID_CANONICAL_AUTHORITY=NO — UI projection only.",
    });
  }

  for (const row of input.dailyPlayLeaseRows || []) {
    rejected.push({
      source: row,
      reason: "DAILY_PLAY_LEASE_NOT_OCCUPANCY_SSOT",
      note: "DAILY_PLAY_LEASE_IS_CAPACITY_SSOT=NO",
    });
  }

  // Verified canonical projections may be planned without copying blob occupancy.
  for (const projection of input.canonicalBusinessProjections || []) {
    const physicalCourtId = trim(projection.physicalCourtId);
    if (!isCanonicalPhysicalCourtId(physicalCourtId)) {
      rejected.push({ source: projection, reason: "INVALID_PHYSICAL_COURT" });
      continue;
    }
    planned.push({
      physicalCourtId,
      sourceType: trim(projection.sourceType) || null,
      sourceId: trim(projection.sourceId) || null,
      fromCanonicalProjection: true,
      fromLegacyBlob: false,
    });
  }

  return {
    ok: rejected.filter((r) => r.reason !== "STALE_EPHEMERAL_OCCUPANCY_NOT_PROMOTED"
      && r.reason !== "COURT_STATUS_NOT_LIVE_RUNTIME_AUTHORITY"
      && r.reason !== "CURRENTMATCHID_NOT_OCCUPANCY_AUTHORITY"
      && r.reason !== "DAILY_PLAY_LEASE_NOT_OCCUPANCY_SSOT").length === 0
      || planned.length >= 0,
    planned,
    rejected,
    execute: false,
    autoPromoteEphemeralOccupancy: false,
    staleEphemeralStateAutoMigrated: false,
  };
}
