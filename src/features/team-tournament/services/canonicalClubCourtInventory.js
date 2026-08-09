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
 * Extract courts array from a club_data_v3.data JSON value.
 * @param {object|null|undefined} rowData
 * @returns {Array}
 */
export function extractCourtsFromClubDataV3Payload(rowData) {
  if (!rowData || typeof rowData !== "object") {
    return [];
  }

  // Nested buildClubPayload: { clubId, data: clubBlob, aiData }
  if (rowData.data && typeof rowData.data === "object" && Array.isArray(rowData.data.courts)) {
    return rowData.data.courts;
  }

  // Flat club blob: { schemaVersion, clubId, courts, ... }
  if (Array.isArray(rowData.courts)) {
    return rowData.courts;
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
  const clubId = params.clubId != null ? String(params.clubId).trim() : "";
  const tenantId =
    params.tenantId != null && String(params.tenantId).trim() !== ""
      ? String(params.tenantId).trim()
      : null;

  if (!clubId) {
    return {
      ok: false,
      courts: [],
      source: "unavailable",
      code: "MISSING_CLUB_ID",
      error: "Thiếu clubId — không tải được inventory sân.",
    };
  }

  if (!deps.hasSupabaseConfig()) {
    return {
      ok: false,
      courts: [],
      source: "unavailable",
      code: "SUPABASE_NOT_CONFIGURED",
      error: "Chưa cấu hình Supabase — không đọc được sân cloud.",
    };
  }

  const client = deps.getSupabaseAuthClient();
  if (!client) {
    return {
      ok: false,
      courts: [],
      source: "unavailable",
      code: "SUPABASE_CLIENT_MISSING",
      error: "Không tạo được Supabase client — không đọc được sân cloud.",
    };
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
    return {
      ok: false,
      courts: [],
      source: "unavailable",
      code: "CLUB_DATA_V3_READ_FAILED",
      error: error.message || "Đọc club_data_v3 thất bại.",
    };
  }

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    return {
      ok: true,
      courts: [],
      source: "club_data_v3",
      code: "CLUB_BLOB_MISSING",
      error: null,
    };
  }

  if (tenantId && row.venue_id && String(row.venue_id) !== tenantId) {
    return {
      ok: false,
      courts: [],
      source: "unavailable",
      code: "TENANT_FORBIDDEN",
      error: "Blob sân thuộc tenant khác — từ chối đọc.",
    };
  }

  const rawCourts = extractCourtsFromClubDataV3Payload(row.data);
  const courts = normalizeCanonicalClubCourts(rawCourts, {
    clubId,
    tenantId: tenantId || undefined,
    includeInactive: params.includeInactive === true,
  });

  return {
    ok: true,
    courts,
    source: "club_data_v3",
    version: row.version ?? null,
  };
}
