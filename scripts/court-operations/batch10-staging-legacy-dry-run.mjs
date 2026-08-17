/**
 * Batch 10 — Staging read-only legacy dry-run (qyewbxjsiiyufanzcjcq).
 * Classifies legacy blob bookings / maintenance / competition selections.
 * Does NOT write. Does NOT touch Production.
 *
 * Usage:
 *   node scripts/court-operations/batch10-staging-legacy-dry-run.mjs
 *   node scripts/court-operations/batch10-staging-legacy-dry-run.mjs --out <path.json>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { planLegacyBookingMigrationDryRun } from "../../src/features/court-resource/services/legacyBookingMigrationDryRun.js";
import { planLegacyMaintenanceMigrationDryRun } from "../../src/features/court-resource/legacy/legacyMigrationDryRun.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const dbUrl = String(process.env.STAGING_SUPABASE_DB_URL || "").trim();
if (!dbUrl) {
  console.error("MISSING STAGING_SUPABASE_DB_URL");
  process.exit(2);
}
if (dbUrl.includes(PRODUCTION_REF)) {
  console.error("BLOCKED: Production ref in DB URL");
  process.exit(1);
}
if (!dbUrl.includes(STAGING_REF)) {
  console.error("BLOCKED: DB URL must include Staging ref", STAGING_REF);
  process.exit(1);
}

function parseArgs(argv) {
  const outIdx = argv.indexOf("--out");
  return {
    out: outIdx >= 0 ? argv[outIdx + 1] : null,
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function bookingInterval(booking) {
  const date = String(booking.date || booking.bookingDate || "").trim();
  const start = String(booking.startTime || booking.startsAt || booking.start || "").trim();
  const end = String(booking.endTime || booking.endsAt || booking.end || "").trim();
  if (!date || !start || !end) return null;
  // Support HH:mm or full ISO
  const startsAt = start.includes("T")
    ? new Date(start)
    : new Date(`${date}T${start.length === 5 ? `${start}:00` : start}.000Z`);
  const endsAt = end.includes("T")
    ? new Date(end)
    : new Date(`${date}T${end.length === 5 ? `${end}:00` : end}.000Z`);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
  return { startsAt, endsAt };
}

function isMaintenance(booking) {
  const t = String(booking.bookingType || booking.type || "").toLowerCase();
  return t === "maintenance" || t === "resource_block" || t === "block";
}

function classifyBooking(booking, now, mappingOk) {
  if (!mappingOk) return "UNRESOLVED";
  const interval = bookingInterval(booking);
  if (!interval) return "UNRESOLVED";
  const status = String(booking.bookingStatus || booking.status || "confirmed").toLowerCase();
  if (["cancelled", "canceled", "no_show", "completed", "done"].includes(status)) {
    return "COMPATIBILITY_ONLY";
  }
  if (interval.endsAt.getTime() <= now.getTime()) return "COMPATIBILITY_ONLY";
  return "MIGRATABLE_DETERMINISTIC";
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const now = new Date();
    const report = {
      stagingProject: STAGING_REF,
      generatedAt: now.toISOString(),
      execute: false,
      now: now.toISOString(),
    };

    const mappings = (
      await client.query(`
        SELECT tenant_id, club_id, legacy_court_id, physical_court_id, classification
        FROM public.court_resource_legacy_court_identity_mappings
        ORDER BY tenant_id, club_id, legacy_court_id
      `)
    ).rows;

    const physicalCourts = (
      await client.query(`
        SELECT physical_court_id, tenant_id, cluster_id, display_name, display_code, display_number
        FROM public.court_resource_physical_courts
        ORDER BY tenant_id, display_name
      `)
    ).rows;

    const clusters = (
      await client.query(`
        SELECT id, tenant_id, venue_id, name
        FROM public.court_clusters
        ORDER BY tenant_id, id
      `)
    ).rows;

    const activeReservations = (
      await client.query(`
        SELECT count(*)::int AS n
        FROM public.court_resource_reservations
        WHERE status = 'active'
          AND ends_at > now()
      `)
    ).rows[0].n;

    const canonicalBookings = (
      await client.query(`
        SELECT count(*)::int AS n FROM public.court_operations_bookings
      `)
    ).rows[0].n;

    const canonicalBlocks = (
      await client.query(`
        SELECT count(*)::int AS n FROM public.court_operations_resource_blocks
      `)
    ).rows[0].n;

    const blobs = (
      await client.query(`
        SELECT club_id, data
        FROM public.club_data_v3
        ORDER BY club_id
      `)
    ).rows;

    const mappingByClub = new Map();
    for (const m of mappings) {
      const key = `${m.tenant_id}::${m.club_id}`;
      if (!mappingByClub.has(key)) mappingByClub.set(key, []);
      mappingByClub.get(key).push({
        legacyCourtId: m.legacy_court_id,
        physicalCourtId: m.physical_court_id,
        classification: m.classification,
      });
    }

    // Prefer tenant from clusters / physical courts for each club via access table when present
    let accessRows = [];
    try {
      accessRows = (
        await client.query(`
          SELECT tenant_id, club_id, cluster_id, enabled
          FROM public.court_resource_club_operational_access
          ORDER BY tenant_id, club_id
        `)
      ).rows;
    } catch {
      accessRows = [];
    }

    const clubTenant = new Map();
    for (const a of accessRows) clubTenant.set(a.club_id, a.tenant_id);
    for (const c of clusters) {
      // fallback only when single-tenant staging venues historically used venue_id as tenant
      if (!clubTenant.has(c.venue_id)) clubTenant.set(c.venue_id, c.tenant_id);
    }

    const classifications = {
      MIGRATABLE_DETERMINISTIC: 0,
      ALREADY_CANONICAL: 0,
      COMPATIBILITY_ONLY: 0,
      STALE_EPHEMERAL_DO_NOT_MIGRATE: 0,
      UNRESOLVED: 0,
    };

    const bookingDetails = [];
    const maintenanceDetails = [];
    const competitionSelections = [];
    let legacyBookingRows = 0;
    let legacyMaintenanceRows = 0;
    let unresolvedActiveOrFutureCapacity = 0;
    let unresolvedPhysicalCourtMapping = 0;
    let unresolvedActiveBooking = 0;
    let unresolvedActiveResourceBlock = 0;
    let plannedBookings = 0;
    let plannedBlocks = 0;

    for (const blob of blobs) {
      const data = blob.data && typeof blob.data === "object" ? blob.data : {};
      const nested = data.data && typeof data.data === "object" ? data.data : data;
      const bookings = asArray(nested.bookings || data.bookings);
      const courts = asArray(nested.courts || data.courts);
      const tenantId =
        clubTenant.get(blob.club_id) ||
        String(nested.tenantId || data.tenantId || clusters[0]?.tenant_id || "").trim();
      const clubId = blob.club_id;
      const courtMappings = mappingByClub.get(`${tenantId}::${clubId}`) || [];
      // also accept mappings under any tenant for this club (staging TT412)
      if (courtMappings.length === 0) {
        for (const [key, rows] of mappingByClub) {
          if (key.endsWith(`::${clubId}`)) courtMappings.push(...rows);
        }
      }

      const mapSet = new Map(courtMappings.map((m) => [m.legacyCourtId, m.physicalCourtId]));

      const normalBookings = [];
      const maintBookings = [];
      for (const b of bookings) {
        if (isMaintenance(b)) maintBookings.push(b);
        else normalBookings.push(b);
      }

      legacyBookingRows += normalBookings.length;
      legacyMaintenanceRows += maintBookings.length;

      const planB = planLegacyBookingMigrationDryRun({
        tenantId: tenantId || "MISSING",
        clubId,
        courtMappings,
        legacyBookings: normalBookings,
      });
      plannedBookings += planB.planned.length;

      for (const b of normalBookings) {
        const legacyCourtId = String(b.courtId || "").trim();
        const mapped = mapSet.get(legacyCourtId) || String(b.physicalCourtId || "").trim();
        const mappingOk = Boolean(mapped);
        if (!mappingOk) unresolvedPhysicalCourtMapping += 1;
        const klass = classifyBooking(b, now, mappingOk);
        classifications[klass] += 1;
        const interval = bookingInterval(b);
        const activeOrFuture =
          interval &&
          interval.endsAt.getTime() > now.getTime() &&
          !["cancelled", "canceled", "no_show"].includes(
            String(b.bookingStatus || b.status || "confirmed").toLowerCase(),
          );
        if (klass === "UNRESOLVED" && activeOrFuture) {
          unresolvedActiveOrFutureCapacity += 1;
          unresolvedActiveBooking += 1;
        }
        bookingDetails.push({
          clubId,
          tenantId,
          sourceBookingId: b.id || b.bookingId || null,
          legacyCourtId,
          physicalCourtId: mapped || null,
          classification: klass,
          activeOrFuture: Boolean(activeOrFuture),
          startsAt: interval?.startsAt?.toISOString() || null,
          endsAt: interval?.endsAt?.toISOString() || null,
        });
      }

      const planM = planLegacyMaintenanceMigrationDryRun({
        tenantId: tenantId || "MISSING",
        clubId,
        courtMappings,
        legacyMaintenanceBookings: maintBookings,
        unboundedCourtStatusRows: courts
          .filter((c) => c && c.status && String(c.status).toLowerCase() !== "active")
          .map((c) => ({ courtId: c.id || c.courtId, status: c.status })),
      });
      plannedBlocks += planM.planned.length;

      for (const b of maintBookings) {
        const legacyCourtId = String(b.courtId || "").trim();
        const mapped = mapSet.get(legacyCourtId) || String(b.physicalCourtId || "").trim();
        const mappingOk = Boolean(mapped);
        if (!mappingOk) unresolvedPhysicalCourtMapping += 1;
        const klass = classifyBooking(b, now, mappingOk);
        classifications[klass] += 1;
        const interval = bookingInterval(b);
        const activeOrFuture =
          interval &&
          interval.endsAt.getTime() > now.getTime() &&
          !["cancelled", "canceled"].includes(
            String(b.bookingStatus || b.status || "confirmed").toLowerCase(),
          );
        if (klass === "UNRESOLVED" && activeOrFuture) {
          unresolvedActiveOrFutureCapacity += 1;
          unresolvedActiveResourceBlock += 1;
        }
        maintenanceDetails.push({
          clubId,
          tenantId,
          sourceId: b.id || b.bookingId || null,
          legacyCourtId,
          physicalCourtId: mapped || null,
          classification: klass,
          activeOrFuture: Boolean(activeOrFuture),
        });
      }

      // Competition court selections — scan tournament blobs shallowly
      const tournaments = asArray(nested.tournaments || data.tournaments || nested.officialTournaments);
      for (const t of tournaments) {
        const courtsSel = asArray(t?.courtIds || t?.selectedCourtIds || t?.courts);
        if (courtsSel.length === 0) continue;
        for (const c of courtsSel) {
          const legacyCourtId = typeof c === "string" ? c : String(c?.id || c?.courtId || "");
          const mapped = mapSet.get(legacyCourtId);
          competitionSelections.push({
            clubId,
            tournamentId: t?.id || t?.tournamentId || null,
            legacyCourtId,
            physicalCourtId: mapped || null,
            classification: mapped ? "COMPATIBILITY_ONLY" : "UNRESOLVED",
          });
          if (!mapped) unresolvedPhysicalCourtMapping += 1;
        }
      }
    }

    // Unbounded court.status never migrates
    classifications.STALE_EPHEMERAL_DO_NOT_MIGRATE += 0;

    report.summary = {
      clusters: clusters.length,
      physicalCourts: physicalCourts.length,
      legacyMappings: mappings.length,
      activeReservations,
      canonicalBookings,
      canonicalBlocks,
      clubDataV3Rows: blobs.length,
      LEGACY_BOOKING_ROWS: legacyBookingRows,
      LEGACY_MAINTENANCE_ROWS: legacyMaintenanceRows,
      LEGACY_COMPETITION_COURT_SELECTION_ROWS: competitionSelections.length,
      PLANNED_BOOKING_ROWS: plannedBookings,
      PLANNED_RESOURCE_BLOCK_ROWS: plannedBlocks,
      classifications,
      UNRESOLVED_ACTIVE_OR_FUTURE_CAPACITY_RECORDS: unresolvedActiveOrFutureCapacity,
      UNRESOLVED_PHYSICAL_COURT_MAPPING_COUNT: unresolvedPhysicalCourtMapping,
      UNRESOLVED_ACTIVE_BOOKING_COUNT: unresolvedActiveBooking,
      UNRESOLVED_ACTIVE_RESOURCE_BLOCK_COUNT: unresolvedActiveResourceBlock,
      STALE_EPHEMERAL_STATE_MIGRATED: "NO",
      CUTOVER_DATA_BLOCKER:
        unresolvedActiveOrFutureCapacity === 0 &&
        unresolvedPhysicalCourtMapping === 0 &&
        unresolvedActiveBooking === 0 &&
        unresolvedActiveResourceBlock === 0
          ? "NO"
          : "YES",
      LEGACY_DATA_DRY_RUN:
        unresolvedActiveOrFutureCapacity === 0 && unresolvedActiveBooking === 0
          ? "PASS"
          : "FAIL",
      note:
        "Historical/past legacy bookings may remain COMPATIBILITY_ONLY without migration when no active/future capacity is unresolved.",
    };

    report.clustersSanitized = clusters.map((c) => ({
      id: c.id,
      tenantId: c.tenant_id,
      venueId: c.venue_id,
      tenantEqualsVenue: c.tenant_id === c.venue_id,
    }));
    report.physicalCourtsSanitized = physicalCourts.map((p) => ({
      physicalCourtId: p.physical_court_id,
      tenantId: p.tenant_id,
      clusterId: p.cluster_id,
      displayName: p.display_name,
      displayCode: p.display_code,
      displayNumber: p.display_number,
    }));
    report.mappingsSanitized = mappings.map((m) => ({
      tenantId: m.tenant_id,
      clubId: m.club_id,
      legacyCourtId: m.legacy_court_id,
      physicalCourtId: m.physical_court_id,
      classification: m.classification,
    }));
    report.bookingDetails = bookingDetails;
    report.maintenanceDetails = maintenanceDetails;
    report.competitionSelections = competitionSelections;

    const json = JSON.stringify(report, null, 2);
    if (out) {
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      fs.writeFileSync(out, json);
      console.log(JSON.stringify({ ok: true, wrote: out, summary: report.summary }, null, 2));
    } else {
      console.log(json);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FAIL", err.message);
  process.exit(1);
});
