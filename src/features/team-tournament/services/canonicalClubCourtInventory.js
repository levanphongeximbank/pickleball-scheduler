/**
 * Canonical Format & Venue court inventory reader.
 *
 * Authority: public.club_data_v3 (Supabase), NOT localStorage.
 * Accepts both:
 * - flat club blob: data.courts
 * - app sync wrapper: data.data.courts (buildClubPayload)
 */

import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { normalizeCourts } from "../../../models/court.js";

const CLUB_DATA_TABLE = "club_data_v3";

/**
 * Extract the club blob from a club_data_v3.data JSON value.
 * Accepts nested buildClubPayload `{ data: clubBlob }` or a flat club blob.
 * @param {object|null|undefined} rowData
 * @returns {object|null}
 */
export function extractClubBlobFromClubDataV3Payload(rowData) {
  if (!rowData || typeof rowData !== "object") {
    return null;
  }

  if (rowData.data && typeof rowData.data === "object" && !Array.isArray(rowData.data)) {
    return rowData.data;
  }

  if (
    Array.isArray(rowData.courts) ||
    Array.isArray(rowData.bookings) ||
    rowData.schemaVersion != null
  ) {
    return rowData;
  }

  return null;
}

/**
 * Extract courts array from a club_data_v3.data JSON value.
 * @param {object|null|undefined} rowData
 * @returns {Array}
 */
export function extractCourtsFromClubDataV3Payload(rowData) {
  const blob = extractClubBlobFromClubDataV3Payload(rowData);
  if (blob && Array.isArray(blob.courts)) {
    return blob.courts;
  }
  return [];
}

/**
 * Extract bookings array from a club_data_v3.data JSON value.
 * Occupancy SSOT for tournament/normal/maintenance rows in the club blob.
 * Does not include Daily Play leases.
 * @param {object|null|undefined} rowData
 * @returns {Array}
 */
export function extractBookingsFromClubDataV3Payload(rowData) {
  const blob = extractClubBlobFromClubDataV3Payload(rowData);
  if (blob && Array.isArray(blob.bookings)) {
    return blob.bookings;
  }
  return [];
}

function trimId(value) {
  return value != null ? String(value).trim() : "";
}

const FORBIDDEN_SCOPE_IDS = new Set(["default-tenant", "default"]);

/**
 * Court blob stamps use venue identity (venueId or legacy tenantId-as-venue).
 * Authorization tenantId is not the club_data_v3.venue_id filter.
 */
export function courtStampMatchesInventoryScope(court, scope = {}) {
  if (!court || court.id == null || trimId(court.id) === "") {
    return false;
  }
  const clubId = trimId(scope.clubId);
  const venueId = trimId(scope.venueId);
  const tenantId = trimId(scope.tenantId);
  const courtClub = trimId(court.clubId);
  const stamp = trimId(court.venueId || court.tenantId);
  if (clubId && courtClub && courtClub !== clubId) {
    return false;
  }
  if (venueId && stamp && stamp !== venueId) {
    return false;
  }
  if (!venueId && tenantId && stamp && stamp !== tenantId) {
    return false;
  }
  return true;
}

/**
 * @param {Array} courts
 * @param {{ clubId?: string, tenantId?: string, venueId?: string, includeInactive?: boolean }} [options]
 */
export function normalizeCanonicalClubCourts(courts = [], options = {}) {
  const includeInactive = options.includeInactive === true;

  return normalizeCourts(courts || [])
    .filter((court) => {
      if (!includeInactive && court.active === false) {
        return false;
      }
      return courtStampMatchesInventoryScope(court, options);
    })
    .map((court) => ({ ...court }));
}

const defaultDeps = Object.freeze({
  hasSupabaseConfig,
  getSupabaseAuthClient,
});

let deps = { ...defaultDeps };

/** @internal */
export function __setCanonicalClubCourtInventoryDepsForTests(next = {}) {
  deps = { ...defaultDeps, ...next };
}

/** @internal */
export function __resetCanonicalClubCourtInventoryDepsForTests() {
  deps = { ...defaultDeps };
}

function unavailableSnapshot(code, error) {
  return {
    ok: false,
    courts: [],
    bookings: [],
    clubData: null,
    source: "unavailable",
    code,
    error,
  };
}

/**
 * Read courts + bookings from the same club_data_v3 row.
 * Does not read or write localStorage. Does not include Daily Play leases.
 *
 * tenantId = authorization tenant (not club_data_v3.venue_id).
 * venueId  = Club venue projection for the venue_id column.
 *
 * @param {{
 *   clubId: string,
 *   tenantId?: string|null,
 *   venueId?: string|null,
 *   includeInactive?: boolean
 * }} params
 */
export async function readCanonicalClubCourtBookingSnapshot(params = {}) {
  const clubId = trimId(params.clubId);
  const tenantId = trimId(params.tenantId);
  const venueId = trimId(params.venueId);

  if (!clubId) {
    return unavailableSnapshot(
      "MISSING_CLUB_ID",
      "Thiếu clubId — không tải được inventory sân."
    );
  }

  if (!tenantId || FORBIDDEN_SCOPE_IDS.has(tenantId)) {
    return unavailableSnapshot(
      "MISSING_TENANT",
      "Thiếu tenant được phép — không tải inventory sân."
    );
  }

  if (!deps.hasSupabaseConfig()) {
    return unavailableSnapshot(
      "SUPABASE_NOT_CONFIGURED",
      "Chưa cấu hình Supabase — không đọc được sân cloud."
    );
  }

  const client = deps.getSupabaseAuthClient();
  if (!client) {
    return unavailableSnapshot(
      "SUPABASE_CLIENT_MISSING",
      "Không tạo được Supabase client — không đọc được sân cloud."
    );
  }

  const query = client
    .from(CLUB_DATA_TABLE)
    .select("data,venue_id,version")
    .eq("club_id", clubId);

  const { data: rows, error } = await query.limit(1);

  if (error) {
    return unavailableSnapshot(
      "CLUB_DATA_V3_READ_FAILED",
      error.message || "Đọc club_data_v3 thất bại."
    );
  }

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    return {
      ok: true,
      courts: [],
      bookings: [],
      clubData: null,
      source: "club_data_v3",
      code: "CLUB_BLOB_MISSING",
      error: null,
    };
  }

  const rowVenueId = trimId(row.venue_id);
  if (venueId && rowVenueId && rowVenueId !== venueId) {
    return unavailableSnapshot(
      "VENUE_FORBIDDEN",
      "Blob sân thuộc venue khác — từ chối đọc."
    );
  }

  const clubData = extractClubBlobFromClubDataV3Payload(row.data);
  const rawCourts = extractCourtsFromClubDataV3Payload(row.data);
  const courts = normalizeCanonicalClubCourts(rawCourts, {
    clubId,
    tenantId,
    venueId: venueId || undefined,
    includeInactive: params.includeInactive === true,
  });

  return {
    ok: true,
    courts,
    bookings: extractBookingsFromClubDataV3Payload(row.data),
    clubData,
    source: "club_data_v3",
    version: row.version ?? null,
  };
}

/**
 * Load Format & Venue court inventory from canonical club_data_v3.
 * Does not read or write localStorage.
 *
 * @param {{ clubId: string, tenantId?: string|null, venueId?: string|null, includeInactive?: boolean }} params
 * @returns {Promise<{
 *   ok: boolean,
 *   courts: Array,
 *   source: 'club_data_v3'|'unavailable',
 *   code?: string,
 *   error?: string,
 *   loading?: boolean,
 * }>}
 */
export async function listCanonicalClubCourtsForFormatVenue(params = {}) {
  const snapshot = await readCanonicalClubCourtBookingSnapshot(params);
  return {
    ok: snapshot.ok,
    courts: snapshot.courts || [],
    source: snapshot.source,
    code: snapshot.code,
    error: snapshot.error,
    version: snapshot.version,
  };
}
