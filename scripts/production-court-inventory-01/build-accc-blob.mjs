/**
 * PRODUCTION-COURT-INVENTORY-01 — deterministic canonical blob generator.
 * Uses the app's own getDefaultClubData for schema fidelity.
 * Courts are hand-built honest records: NO fabricated rates/note/priority.
 * Prints JSON to stdout and writes evidence copy.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getDefaultClubData } from "../../src/domain/clubStorage.js";
import {
  ACCC_CLUB_ID,
  ACCC_VENUE_ID,
  ACCC_CLUSTER_ID,
  ACCC_CANONICAL_COURTS,
} from "../../tests/fixtures/production-court-inventory-01-accc.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Honest court records: only Owner-confirmed facts + identity/linkage.
// Omit defaultHourlyRate/peakHourlyRate/note/priority (JSONB allows omit).
const honestCourts = ACCC_CANONICAL_COURTS.map((court) => ({
  id: court.id,
  name: court.name,
  number: court.number,
  active: true,
  status: "active",
  courtType: "covered",
  surface: "plastic",
  clubId: ACCC_CLUB_ID,
  venueId: ACCC_VENUE_ID,
  tenantId: ACCC_VENUE_ID,
  clusterId: ACCC_CLUSTER_ID,
}));

const data = getDefaultClubData(ACCC_CLUB_ID);
data.tenantId = ACCC_VENUE_ID;
data.courts = honestCourts;

const json = JSON.stringify(data);
const outPath = path.join(
  root,
  "docs/production-court-inventory/production-court-inventory-01/evidence/PROPOSED_CLUB_DATA_V3_DATA.json"
);
writeFileSync(outPath, JSON.stringify(data, null, 2));
process.stdout.write(json);
