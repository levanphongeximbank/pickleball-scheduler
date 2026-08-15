/**
 * Compatibility adapter for Team Tournament Format & Venue.
 *
 * Canonical cloud inventory and club_data_v3 storage-shape parsing live in
 * Venue & Court (`canonicalCloudCourtInventory`). This module must not become
 * a second inventory authority.
 */

export {
  extractCourtsFromClubDataV3Payload,
  normalizeCanonicalClubCourts,
  listCanonicalCloudCourts as listCanonicalClubCourtsForFormatVenue,
  __setCanonicalCloudCourtInventoryDepsForTests as __setCanonicalClubCourtInventoryDepsForTests,
  __resetCanonicalCloudCourtInventoryDepsForTests as __resetCanonicalClubCourtInventoryDepsForTests,
} from "../../venue-court/services/canonicalCloudCourtInventory.js";
