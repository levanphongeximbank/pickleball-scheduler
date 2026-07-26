/**
 * PRODUCTION-COURT-INVENTORY-01 — Exact canonical court inventory fixture (CLB ACCC).
 * Owner-confirmed business facts. Not a synthetic seed.
 */

export const ACCC_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";
export const ACCC_VENUE_ID = "venue-prod-main";
export const ACCC_CLUSTER_ID = "venue-prod-main-pickleball-nam-long-sports";

/** Deterministic IDs: club identity + physical court number (not array index / Date.now). */
export const ACCC_COURT_IDS = Object.freeze([
  "court-club-219e4a7cbd73437eb6271f02a53314c3-n3",
  "court-club-219e4a7cbd73437eb6271f02a53314c3-n4",
  "court-club-219e4a7cbd73437eb6271f02a53314c3-n5",
  "court-club-219e4a7cbd73437eb6271f02a53314c3-n6",
]);

/**
 * Exact records proposed for club_data_v3.data.courts[].
 * Rates/notes private defaults (0 / "").
 */
export const ACCC_CANONICAL_COURTS = Object.freeze([
  Object.freeze({
    id: ACCC_COURT_IDS[0],
    name: "Sân 3",
    number: 3,
    active: true,
    status: "active",
    courtType: "covered",
    surface: "plastic",
    clubId: ACCC_CLUB_ID,
    venueId: ACCC_VENUE_ID,
    tenantId: ACCC_VENUE_ID,
    clusterId: ACCC_CLUSTER_ID,
    defaultHourlyRate: 0,
    peakHourlyRate: 0,
    note: "",
    archived: false,
    deleted: false,
  }),
  Object.freeze({
    id: ACCC_COURT_IDS[1],
    name: "Sân 4",
    number: 4,
    active: true,
    status: "active",
    courtType: "covered",
    surface: "plastic",
    clubId: ACCC_CLUB_ID,
    venueId: ACCC_VENUE_ID,
    tenantId: ACCC_VENUE_ID,
    clusterId: ACCC_CLUSTER_ID,
    defaultHourlyRate: 0,
    peakHourlyRate: 0,
    note: "",
    archived: false,
    deleted: false,
  }),
  Object.freeze({
    id: ACCC_COURT_IDS[2],
    name: "Sân 5",
    number: 5,
    active: true,
    status: "active",
    courtType: "covered",
    surface: "plastic",
    clubId: ACCC_CLUB_ID,
    venueId: ACCC_VENUE_ID,
    tenantId: ACCC_VENUE_ID,
    clusterId: ACCC_CLUSTER_ID,
    defaultHourlyRate: 0,
    peakHourlyRate: 0,
    note: "",
    archived: false,
    deleted: false,
  }),
  Object.freeze({
    id: ACCC_COURT_IDS[3],
    name: "Sân 6",
    number: 6,
    active: true,
    status: "active",
    courtType: "covered",
    surface: "plastic",
    clubId: ACCC_CLUB_ID,
    venueId: ACCC_VENUE_ID,
    tenantId: ACCC_VENUE_ID,
    clusterId: ACCC_CLUSTER_ID,
    defaultHourlyRate: 0,
    peakHourlyRate: 0,
    note: "",
    archived: false,
    deleted: false,
  }),
]);
