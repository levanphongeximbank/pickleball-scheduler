/**
 * Canonical club_data_v3 court inventory: club_id authority + court-level tenant filter.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  extractCourtsFromClubDataV3Payload,
  listCanonicalClubCourtsForFormatVenue,
  normalizeCanonicalClubCourts,
  __setCanonicalClubCourtInventoryDepsForTests,
  __resetCanonicalClubCourtInventoryDepsForTests,
} from "../src/features/team-tournament/services/canonicalClubCourtInventory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const TENANT_ID = "venue-staging-a";

const STAGING_COURTS = [
  {
    id: "tt412-court-01",
    name: "TT412 Sân 1",
    number: 1,
    active: true,
    status: "active",
    clubId: CLUB_ID,
    tenantId: TENANT_ID,
  },
  {
    id: "tt412-court-02",
    name: "TT412 Sân 2",
    number: 2,
    active: true,
    status: "active",
    clubId: CLUB_ID,
    tenantId: TENANT_ID,
  },
];

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function mockClient({ row = null, error = null } = {}) {
  const eqCalls = [];
  return {
    eqCalls,
    from(table) {
      assert.equal(table, "club_data_v3");
      return {
        select() {
          return this;
        },
        eq(column, value) {
          eqCalls.push({ column, value });
          return this;
        },
        limit() {
          return Promise.resolve({
            data: row ? [row] : [],
            error,
          });
        },
      };
    },
  };
}

function nestedClubBlob(courts = STAGING_COURTS) {
  return {
    clubId: CLUB_ID,
    data: { courts, players: [] },
    aiData: {},
  };
}

describe("canonical-club-court-inventory-club-id-authority", () => {
  it("club_id is the unique Platform Core row key; query does not filter venue_id", () => {
    const sql = readSrc("docs/supabase-club-v3.sql");
    const cloudSync = readSrc("src/ai/cloudSync.js");
    const inventory = readSrc(
      "src/features/team-tournament/services/canonicalClubCourtInventory.js"
    );
    assert.match(sql, /club_id text primary key/);
    assert.match(cloudSync, /on_conflict=club_id/);
    assert.match(cloudSync, /club_id=eq\.\$\{encodeURIComponent\(clubId\)\}&limit=1/);
    assert.match(inventory, /\.eq\("club_id", clubId\)/);
    assert.doesNotMatch(inventory, /\.eq\("venue_id"/);
  });

  it("1-2 venue_id NULL nested blob returns tenant courts without venue_id=tenantId query", async () => {
    const client = mockClient({
      row: {
        venue_id: null,
        version: 1,
        data: nestedClubBlob(),
      },
    });
    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => client,
    });
    try {
      const result = await listCanonicalClubCourtsForFormatVenue({
        clubId: CLUB_ID,
        tenantId: TENANT_ID,
      });
      assert.equal(result.ok, true, result.error);
      assert.equal(result.source, "club_data_v3");
      assert.deepEqual(
        client.eqCalls.map((item) => item.column),
        ["club_id"]
      );
      assert.equal(
        client.eqCalls.some((item) => item.column === "venue_id"),
        false
      );
      const raw = extractCourtsFromClubDataV3Payload(nestedClubBlob());
      assert.equal(raw.length, 2);
      assert.equal(result.courts.length, 2);
      assert.deepEqual(
        result.courts.map((court) => court.id),
        ["tt412-court-01", "tt412-court-02"]
      );
    } finally {
      __resetCanonicalClubCourtInventoryDepsForTests();
    }
  });

  it("3 court with explicit different tenantId is filtered out", () => {
    const courts = normalizeCanonicalClubCourts(
      [
        { ...STAGING_COURTS[0] },
        { ...STAGING_COURTS[1], id: "other-tenant-court", tenantId: "venue-other" },
      ],
      { clubId: CLUB_ID, tenantId: TENANT_ID }
    );
    assert.deepEqual(
      courts.map((court) => court.id),
      ["tt412-court-01"]
    );
  });

  it("4 court with explicit different clubId is filtered out", () => {
    const courts = normalizeCanonicalClubCourts(
      [
        { ...STAGING_COURTS[0] },
        { ...STAGING_COURTS[1], id: "other-club-court", clubId: "club-other" },
      ],
      { clubId: CLUB_ID, tenantId: TENANT_ID }
    );
    assert.deepEqual(
      courts.map((court) => court.id),
      ["tt412-court-01"]
    );
  });

  it("5 inactive court is filtered out", () => {
    const courts = normalizeCanonicalClubCourts(
      [
        { ...STAGING_COURTS[0] },
        { ...STAGING_COURTS[1], active: false, status: "locked" },
      ],
      { clubId: CLUB_ID, tenantId: TENANT_ID }
    );
    assert.deepEqual(
      courts.map((court) => court.id),
      ["tt412-court-01"]
    );
  });

  it("6 flat data.courts still works", () => {
    const raw = extractCourtsFromClubDataV3Payload({
      schemaVersion: 3.5,
      clubId: CLUB_ID,
      courts: STAGING_COURTS,
    });
    assert.equal(raw.length, 2);
    const courts = normalizeCanonicalClubCourts(raw, {
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
    });
    assert.equal(courts.length, 2);
  });

  it("7 nested data.data.courts still works", () => {
    const raw = extractCourtsFromClubDataV3Payload(nestedClubBlob());
    assert.equal(raw.length, 2);
    assert.equal(raw[0].id, "tt412-court-01");
  });

  it("8 missing club row returns empty inventory, not fabricated courts", async () => {
    const client = mockClient({ row: null });
    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => client,
    });
    try {
      const result = await listCanonicalClubCourtsForFormatVenue({
        clubId: CLUB_ID,
        tenantId: TENANT_ID,
      });
      assert.equal(result.ok, true);
      assert.equal(result.code, "CLUB_BLOB_MISSING");
      assert.deepEqual(result.courts, []);
    } finally {
      __resetCanonicalClubCourtInventoryDepsForTests();
    }
  });

  it("9-10 no localStorage fallback and no cross-tenant fallback", async () => {
    const inventory = readSrc(
      "src/features/team-tournament/services/canonicalClubCourtInventory.js"
    );
    assert.doesNotMatch(inventory, /localStorage\.getItem|loadCourtsForClub|loadClubData/);

    const client = mockClient({
      row: {
        venue_id: null,
        version: 1,
        data: nestedClubBlob([
          { ...STAGING_COURTS[0], tenantId: "venue-other" },
          { ...STAGING_COURTS[1], tenantId: "venue-other" },
        ]),
      },
    });
    __setCanonicalClubCourtInventoryDepsForTests({
      hasSupabaseConfig: () => true,
      getSupabaseAuthClient: () => client,
    });
    try {
      const result = await listCanonicalClubCourtsForFormatVenue({
        clubId: CLUB_ID,
        tenantId: TENANT_ID,
      });
      assert.equal(result.ok, true, result.error);
      assert.deepEqual(result.courts, []);
    } finally {
      __resetCanonicalClubCourtInventoryDepsForTests();
    }
  });
});
