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

/**
 * @param {Array} courts
 * @param {{ clubId?: string, tenantId?: string, includeInactive?: boolean }} [options]
 */
export function normalizeCanonicalClubCourts(courts = [], options = {}) {
  const clubId = options.clubId ? String(options.clubId) : "";
  const tenantId = options.tenantId ? String(options.tenantId) : "";
  const includeInactive = options.includeInactive === true;

  return normalizeCourts(courts || [])
    .filter((court) => {
      if (!includeInactive && court.active === false) {
        return false;
      }
      if (clubId && court.clubId && String(court.clubId) !== clubId) {
        return false;
      }
      if (tenantId && court.tenantId && String(court.tenantId) !== tenantId) {
        return false;
      }
      return true;
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
 * @param {{ clubId: string, tenantId?: string|null, includeInactive?: boolean }} params
 */
export async function readCanonicalClubCourtBookingSnapshot(params = {}) {
  const clubId = params.clubId != null ? String(params.clubId).trim() : "";
  const tenantId =
    params.tenantId != null && String(params.tenantId).trim() !== ""
      ? String(params.tenantId).trim()
      : null;

  if (!clubId) {
    return unavailableSnapshot(
      "MISSING_CLUB_ID",
      "Thiếu clubId — không tải được inventory sân."
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

  let query = client
    .from(CLUB_DATA_TABLE)
    .select("data,venue_id,version")
    .eq("club_id", clubId);

  if (tenantId) {
    query = query.eq("venue_id", tenantId);
  }

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

  if (tenantId && row.venue_id && String(row.venue_id) !== tenantId) {
    return unavailableSnapshot(
      "TENANT_FORBIDDEN",
      "Blob sân thuộc tenant khác — từ chối đọc."
    );
  }

  const clubData = extractClubBlobFromClubDataV3Payload(row.data);
  const rawCourts = extractCourtsFromClubDataV3Payload(row.data);
  const courts = normalizeCanonicalClubCourts(rawCourts, {
    clubId,
    tenantId: tenantId || undefined,
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
 * @param {{ clubId: string, tenantId?: string|null, includeInactive?: boolean }} params
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
