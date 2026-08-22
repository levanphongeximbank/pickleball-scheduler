/**
 * Official Open — tenantId vs venueId court inventory scope.
 * LOCAL packaging only. Does not apply SQL.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  listCanonicalClubCourtsForFormatVenue,
  readCanonicalClubCourtBookingSnapshot,
  __resetCanonicalClubCourtInventoryDepsForTests,
  __setCanonicalClubCourtInventoryDepsForTests,
} from "../src/features/team-tournament/services/canonicalClubCourtInventory.js";
import { resolveTournamentCourtInventoryScope } from "../src/features/tournament/guards/tournamentCourtInventoryScope.js";
import { createTournamentCommand } from "../src/features/tournament/services/tournamentCommands.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const TENANT_ID = "tenant-uuid-not-venue";
const VENUE_ID = "venue-staging-a";
const OLD_TOURNAMENT_ID = "993484d2-bb8d-412e-b7f2-a1ff59979c8a";
const FRESH_TOURNAMENT_ID = "a5d7661a-6967-4f12-86f6-fd92a2d30de9";

const TT412_COURTS = [
  {
    id: "tt412-court-01",
    name: "TT412 Sân 1",
    active: true,
    clubId: CLUB_ID,
    venueId: VENUE_ID,
    tenantId: VENUE_ID,
  },
  {
    id: "tt412-court-02",
    name: "TT412 Sân 2",
    active: true,
    clubId: CLUB_ID,
    venueId: VENUE_ID,
    tenantId: VENUE_ID,
  },
];

function src(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function createFilterAwareClient(row) {
  const eqCalls = [];
  return {
    eqCalls,
    client: {
      from() {
        const filters = {};
        const q = {
          select() {
            return q;
          },
          eq(col, val) {
            eqCalls.push({ col, val });
            filters[col] = val;
            return q;
          },
          limit() {
            if (filters.club_id && row.club_id && filters.club_id !== row.club_id) {
              return Promise.resolve({ data: [], error: null });
            }
            if (Object.prototype.hasOwnProperty.call(filters, "venue_id")) {
              if (String(row.venue_id || "") !== String(filters.venue_id || "")) {
                return Promise.resolve({ data: [], error: null });
              }
            }
            return Promise.resolve({
              data: [
                {
                  data: row.data,
                  venue_id: row.venue_id,
                  version: row.version || 1,
                },
              ],
              error: null,
            });
          },
        };
        return q;
      },
    },
  };
}

function clubRow({ venueId = null, courts = TT412_COURTS, clubId = CLUB_ID } = {}) {
  return {
    club_id: clubId,
    venue_id: venueId,
    version: 2,
    data: {
      schemaVersion: 3.5,
      clubId,
      courts,
      bookings: [],
    },
  };
}

afterEach(() => {
  __resetCanonicalClubCourtInventoryDepsForTests();
});

describe("official-open-tournament-court-inventory-tenant-venue-scope-01", () => {
  it("A tenantId != venueId still finds courts from the venue row / null venue_id", async () => {
    const { client, eqCalls } = createFilterAwareClient(
      clubRow({ venueId: null })
    );
    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => client,
    });

    const result = await listCanonicalClubCourtsForFormatVenue({
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
    });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.courts.length, 2);
    assert.deepEqual(
      result.courts.map((court) => court.name),
      ["TT412 Sân 1", "TT412 Sân 2"]
    );
    assert.equal(
      eqCalls.some((call) => call.col === "venue_id" && call.val === TENANT_ID),
      false
    );
    assert.equal(
      eqCalls.some((call) => call.col === "club_id" && call.val === CLUB_ID),
      true
    );
  });

  it("B wrong tenant is blocked by the inventory scope resolver", () => {
    const scope = resolveTournamentCourtInventoryScope({
      tournament: {
        id: FRESH_TOURNAMENT_ID,
        clubId: CLUB_ID,
        tenantId: "other-tenant",
      },
      activeClub: { id: CLUB_ID, tenantId: TENANT_ID, venueId: VENUE_ID },
      currentTenantId: TENANT_ID,
    });
    assert.equal(scope.ok, false);
    assert.equal(scope.code, "COURT_INVENTORY_TENANT_SCOPE_MISMATCH");
    assert.equal(scope.venueId, null);
  });

  it("C wrong club is blocked", () => {
    const scope = resolveTournamentCourtInventoryScope({
      tournament: {
        id: FRESH_TOURNAMENT_ID,
        clubId: "club-other",
        tenantId: TENANT_ID,
      },
      activeClub: { id: CLUB_ID, tenantId: TENANT_ID, venueId: VENUE_ID },
      currentTenantId: TENANT_ID,
    });
    assert.equal(scope.ok, false);
    assert.equal(scope.code, "COURT_INVENTORY_CLUB_SCOPE_MISMATCH");
  });

  it("D wrong venue is blocked when club_data_v3.venue_id is populated", async () => {
    const { client } = createFilterAwareClient(clubRow({ venueId: "venue-other" }));
    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => client,
    });
    const result = await readCanonicalClubCourtBookingSnapshot({
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "VENUE_FORBIDDEN");
    assert.deepEqual(result.courts, []);
  });

  it("E fresh Official create retains club/tenant so organizer courts resolve", async () => {
    const created = await createTournamentCommand(
      { id: CLUB_ID, tenantId: TENANT_ID, venueId: VENUE_ID },
      {
        mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
        name: "Fresh Open TT412",
      },
      {
        repository: {
          create: async (clubId, input) => ({
            ok: true,
            clubId,
            tournament: {
              id: FRESH_TOURNAMENT_ID,
              clubId,
              tenantId: input.tenantId,
              name: input.name,
              mode: input.mode,
            },
          }),
        },
      }
    );
    assert.equal(created.ok, true, created.error);
    assert.equal(created.tournament.clubId, CLUB_ID);
    assert.equal(created.tournament.tenantId, TENANT_ID);
    assert.equal(created.tournament.name, "Fresh Open TT412");

    const scope = resolveTournamentCourtInventoryScope({
      tournament: created.tournament,
      activeClub: { id: CLUB_ID, tenantId: TENANT_ID, venueId: VENUE_ID },
      currentTenantId: TENANT_ID,
    });
    assert.equal(scope.ok, true, scope.error);
    assert.equal(scope.clubId, CLUB_ID);
    assert.equal(scope.tenantId, TENANT_ID);
    assert.equal(scope.venueId, VENUE_ID);
    assert.notEqual(scope.tenantId, scope.venueId);

    const { client } = createFilterAwareClient(clubRow({ venueId: VENUE_ID }));
    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => client,
    });
    const listed = await listCanonicalClubCourtsForFormatVenue(scope);
    assert.equal(listed.courts.length, 2);
  });

  it("F old Official fixture still resolves TT412 courts", async () => {
    const scope = resolveTournamentCourtInventoryScope({
      tournament: {
        id: OLD_TOURNAMENT_ID,
        clubId: CLUB_ID,
        tenantId: VENUE_ID,
      },
      activeClub: { id: CLUB_ID, tenantId: VENUE_ID, venueId: VENUE_ID },
      currentTenantId: VENUE_ID,
    });
    assert.equal(scope.ok, true, scope.error);
    const { client } = createFilterAwareClient(clubRow({ venueId: null }));
    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => client,
    });
    const listed = await listCanonicalClubCourtsForFormatVenue(scope);
    assert.equal(listed.ok, true);
    assert.equal(listed.courts.length, 2);
  });

  it("G tenant switch clears authorized court scope", () => {
    const scope = resolveTournamentCourtInventoryScope({
      tournament: {
        id: FRESH_TOURNAMENT_ID,
        clubId: CLUB_ID,
        tenantId: TENANT_ID,
      },
      activeClub: { id: CLUB_ID, tenantId: TENANT_ID, venueId: VENUE_ID },
      currentTenantId: "venue-staging-b",
    });
    assert.equal(scope.ok, false);
    assert.equal(scope.code, "COURT_INVENTORY_TENANT_SCOPE_MISMATCH");
  });

  it("H missing canonical row is an honest empty inventory", async () => {
    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => ({
        from() {
          const q = {
            select() {
              return q;
            },
            eq() {
              return q;
            },
            limit() {
              return Promise.resolve({ data: [], error: null });
            },
          };
          return q;
        },
      }),
    });
    const result = await listCanonicalClubCourtsForFormatVenue({
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
    });
    assert.equal(result.ok, true);
    assert.equal(result.code, "CLUB_BLOB_MISSING");
    assert.deepEqual(result.courts, []);
  });

  it("legacy tournament tenantId shaped like venueId remains compatible", () => {
    const scope = resolveTournamentCourtInventoryScope({
      tournament: {
        id: OLD_TOURNAMENT_ID,
        clubId: CLUB_ID,
        tenantId: VENUE_ID,
      },
      activeClub: { id: CLUB_ID, tenantId: TENANT_ID, venueId: VENUE_ID },
      currentTenantId: TENANT_ID,
    });
    assert.equal(scope.ok, true, scope.error);
    assert.equal(scope.tenantId, TENANT_ID);
    assert.equal(scope.venueId, VENUE_ID);
  });

  it("does not invent venueId from tenantId and does not query venue_id=tenantId", () => {
    const inventory = src(
      "src/features/team-tournament/services/canonicalClubCourtInventory.js"
    );
    assert.equal(inventory.includes('.eq("venue_id", tenantId)'), false);
    assert.match(inventory, /venueId/);
    assert.match(
      src("src/pages/tournament/OfficialTournamentSetup.jsx"),
      /resolveTournamentCourtInventoryScope/
    );
    assert.match(
      src("src/pages/tournament/OfficialTournamentSetup.jsx"),
      /venueId: courtInventoryScope\.venueId/
    );
    const createPage = src(
      "src/features/tournament/pages/CanonicalTournamentCreatePage.jsx"
    );
    assert.match(createPage, /Tên giải/);
    assert.match(createPage, /name: String\(tournamentName/);
  });

  it("reader requires tenantId and does not treat missing tenant as authorized", async () => {
    const result = await readCanonicalClubCourtBookingSnapshot({
      clubId: CLUB_ID,
      venueId: VENUE_ID,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "MISSING_TENANT");
  });
});
