/**
 * Shared canonical cloud court inventory.
 *
 * Authority: public.club_data_v3 by club_id. Venue & Court owns storage-shape
 * parsing (flat data.courts and nested data.data.courts).
 *
 * Does not read localStorage. Does not invent missing courts.
 * Does not fabricate clusterId from venueId.
 * Does not require blob.venue_id = tenantId when venue_id is NULL.
 */

import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { normalizeCourts } from "../../../models/court.js";
import {
  CANONICAL_INVENTORY_SOURCE,
  CLUB_DATA_V3_TABLE,
  COURT_RESOURCE_CODE,
} from "../constants/courtResourceContract.js";

const defaultDeps = Object.freeze({
  hasSupabaseConfig,
  getSupabaseAuthClient,
});

let deps = { ...defaultDeps };

/** @internal */
export function __setCanonicalCloudCourtInventoryDepsForTests(next = {}) {
  deps = { ...defaultDeps, ...next };
}

/** @internal */
export function __resetCanonicalCloudCourtInventoryDepsForTests() {
  deps = { ...defaultDeps };
}

function trimId(value) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Extract courts array from a club_data_v3.data JSON value.
 * Shared Venue/Court owns this storage-shape knowledge.
 * @param {object|null|undefined} rowData
 * @returns {Array}
 */
export function extractCourtsFromClubDataV3Payload(rowData) {
  if (!rowData || typeof rowData !== "object") {
    return [];
  }

  if (rowData.data && typeof rowData.data === "object" && Array.isArray(rowData.data.courts)) {
    return rowData.data.courts;
  }

  if (Array.isArray(rowData.courts)) {
    return rowData.courts;
  }

  return [];
}

function courtInScope(court, options = {}) {
  const clubId = trimId(options.clubId);
  const tenantId = trimId(options.tenantId) || trimId(options.venueId);
  const clusterId = trimId(options.clusterId);
  const includeInactive = options.includeInactive === true;

  if (!includeInactive && court.active === false) {
    return false;
  }
  if (clubId && court.clubId && String(court.clubId) !== clubId) {
    return false;
  }
  if (tenantId && court.tenantId && String(court.tenantId) !== tenantId) {
    return false;
  }
  if (tenantId && court.venueId && String(court.venueId) !== tenantId) {
    return false;
  }
  if (clusterId) {
    if (String(court.clusterId || "") !== clusterId) {
      return false;
    }
  }
  return true;
}

/**
 * Normalize + fail-closed filter. Does not invent courts.
 * @param {Array} courts
 * @param {{ clubId?: string, tenantId?: string, venueId?: string, clusterId?: string, includeInactive?: boolean }} [options]
 */
export function normalizeCanonicalClubCourts(courts = [], options = {}) {
  return normalizeCourts(courts || [])
    .filter((court) => courtInScope(court, options))
    .map((court) => ({ ...court }));
}

function failUnavailable(code, error) {
  return {
    ok: false,
    courts: [],
    source: "unavailable",
    code,
    error,
  };
}

function pickCanonicalClubRow(rows, tenantId) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    return { row: null, code: COURT_RESOURCE_CODE.CLUB_BLOB_MISSING };
  }

  const inScope = list.filter((row) => {
    if (!tenantId) {
      return true;
    }
    if (row?.venue_id == null || String(row.venue_id).trim() === "") {
      return true;
    }
    return String(row.venue_id) === tenantId;
  });

  if (inScope.length === 0) {
    return { row: null, code: COURT_RESOURCE_CODE.TENANT_FORBIDDEN };
  }

  const exact =
    tenantId
      ? inScope.filter((row) => row?.venue_id != null && String(row.venue_id) === tenantId)
      : inScope;
  const nullVenue = inScope.filter(
    (row) => row?.venue_id == null || String(row.venue_id).trim() === ""
  );

  if (exact.length === 1) {
    return { row: exact[0], code: null };
  }
  if (exact.length > 1) {
    return { row: null, code: COURT_RESOURCE_CODE.AMBIGUOUS_CLUB_BLOB };
  }
  if (nullVenue.length === 1) {
    return { row: nullVenue[0], code: null };
  }
  if (nullVenue.length > 1 || inScope.length > 1) {
    return { row: null, code: COURT_RESOURCE_CODE.AMBIGUOUS_CLUB_BLOB };
  }

  return { row: inScope[0], code: null };
}

/**
 * Load physical courts from canonical club_data_v3.
 * Query is by club_id. NULL blob venue_id is accepted for the canonical club row.
 *
 * @param {{ clubId: string, tenantId?: string|null, venueId?: string|null, clusterId?: string|null, includeInactive?: boolean }} params
 */
export async function listCanonicalCloudCourts(params = {}) {
  const clubId = trimId(params.clubId);
  const tenantId = trimId(params.tenantId) || trimId(params.venueId);

  if (!clubId) {
    return failUnavailable(
      COURT_RESOURCE_CODE.MISSING_CLUB_ID,
      "Thiếu clubId — không tải được inventory sân."
    );
  }

  if (!deps.hasSupabaseConfig()) {
    return failUnavailable(
      COURT_RESOURCE_CODE.SUPABASE_NOT_CONFIGURED,
      "Chưa cấu hình Supabase — không đọc được sân cloud."
    );
  }

  const client = deps.getSupabaseAuthClient();
  if (!client) {
    return failUnavailable(
      "SUPABASE_CLIENT_MISSING",
      "Không tạo được Supabase client — không đọc được sân cloud."
    );
  }

  const query = client
    .from(CLUB_DATA_V3_TABLE)
    .select("data,venue_id,version,club_id")
    .eq("club_id", clubId);

  const { data: rows, error } = await query.limit(50);

  if (error) {
    return failUnavailable(
      "CLUB_DATA_V3_READ_FAILED",
      error.message || "Đọc club_data_v3 thất bại."
    );
  }

  const picked = pickCanonicalClubRow(rows, tenantId);
  if (!picked.row) {
    if (picked.code === COURT_RESOURCE_CODE.TENANT_FORBIDDEN) {
      return failUnavailable(
        COURT_RESOURCE_CODE.TENANT_FORBIDDEN,
        "Blob sân thuộc tenant khác — từ chối đọc."
      );
    }
    if (picked.code === COURT_RESOURCE_CODE.AMBIGUOUS_CLUB_BLOB) {
      return failUnavailable(
        COURT_RESOURCE_CODE.AMBIGUOUS_CLUB_BLOB,
        "Nhiều club_data_v3 rows — từ chối first-row fallback."
      );
    }
    return {
      ok: true,
      courts: [],
      source: CANONICAL_INVENTORY_SOURCE,
      code: COURT_RESOURCE_CODE.CLUB_BLOB_MISSING,
      error: null,
    };
  }

  const row = picked.row;
  if (tenantId && row.venue_id && String(row.venue_id) !== tenantId) {
    return failUnavailable(
      COURT_RESOURCE_CODE.TENANT_FORBIDDEN,
      "Blob sân thuộc tenant khác — từ chối đọc."
    );
  }

  const rawCourts = extractCourtsFromClubDataV3Payload(row.data);
  const courts = normalizeCanonicalClubCourts(rawCourts, {
    clubId,
    tenantId: tenantId || undefined,
    clusterId: params.clusterId,
    includeInactive: params.includeInactive === true,
  });

  return {
    ok: true,
    courts,
    source: CANONICAL_INVENTORY_SOURCE,
    version: row.version ?? null,
    blobVenueId: row.venue_id ?? null,
  };
}
