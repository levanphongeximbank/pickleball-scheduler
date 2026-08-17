/**
 * Pre-Staging identity-guard correction — isolated PostgreSQL proof.
 * Distinct tenantId != venueId fixtures. Never touches Staging/Production.
 *
 * Opt-in same as Batch9:
 *   COURT_RESOURCE_BATCH9_ENABLE_REAL_POSTGRES=1
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXTURE as F,
  bootIsolatedPostgres,
  createBooking,
  createResourceBlock,
  installCanonicalStack,
  isBatch9RealPostgresEnabled,
  listEligibleCourts,
  reserveCapacity,
  seedBatch9Fixtures,
  setActor,
  windowOnDay,
  withSafeClient,
} from "./helpers/court-resource-batch9-postgres.js";

const COURT_PROBE = "44444444-4444-4444-8444-444444444444";
const COURT_PROBE_B = "55555555-5555-4555-8555-555555555555";

async function insertPhysicalCourt(client, { physicalCourtId, tenantId, clusterId, displayName }) {
  return client.query(
    `INSERT INTO public.court_resource_physical_courts(
       physical_court_id, tenant_id, cluster_id, display_name
     ) VALUES ($1, $2, $3, $4)`,
    [physicalCourtId, tenantId, clusterId, displayName]
  );
}

test("pre-Staging identity-guard: distinct tenant/venue real PG proof A–L", async (t) => {
  if (!isBatch9RealPostgresEnabled()) {
    t.skip("Set COURT_RESOURCE_BATCH9_ENABLE_REAL_POSTGRES=1 for isolated PG proof");
    return;
  }

  const boot = await bootIsolatedPostgres();
  assert.ok(boot, "isolated postgres boot required");
  const { databaseUrl, stop } = boot;

  try {
    await withSafeClient(databaseUrl, async (client) => {
      await installCanonicalStack(client);
      await seedBatch9Fixtures(client);
      await setActor(client, F.SUPER);

      await t.test("H. fixture inventory: tenantId != venueId", async () => {
        const { rows } = await client.query(
          `SELECT tenant_id, venue_id FROM public.court_clusters WHERE id = $1`,
          [F.CLUSTER_A]
        );
        assert.equal(rows[0].tenant_id, F.TENANT_A);
        assert.equal(rows[0].venue_id, F.VENUE_A);
        assert.notEqual(rows[0].tenant_id, rows[0].venue_id);
        assert.notEqual(F.TENANT_A, F.VENUE_A);
      });

      await t.test("A. matching tenant PASS", async () => {
        await insertPhysicalCourt(client, {
          physicalCourtId: COURT_PROBE,
          tenantId: F.TENANT_A,
          clusterId: F.CLUSTER_A,
          displayName: "Probe A",
        });
        const { rows } = await client.query(
          `SELECT tenant_id, cluster_id FROM public.court_resource_physical_courts
           WHERE physical_court_id = $1`,
          [COURT_PROBE]
        );
        assert.equal(rows[0].tenant_id, F.TENANT_A);
        assert.equal(rows[0].cluster_id, F.CLUSTER_A);
      });

      await t.test("B. foreign tenant FAIL", async () => {
        await assert.rejects(
          () =>
            insertPhysicalCourt(client, {
              physicalCourtId: COURT_PROBE_B,
              tenantId: F.TENANT_B,
              clusterId: F.CLUSTER_A,
              displayName: "Foreign tenant",
            }),
          /COURT_RESOURCE_CROSS_TENANT_SCOPE/
        );
      });

      await t.test("C. venueId-as-tenantId FAIL", async () => {
        await assert.rejects(
          () =>
            insertPhysicalCourt(client, {
              physicalCourtId: COURT_PROBE_B,
              tenantId: F.VENUE_A,
              clusterId: F.CLUSTER_A,
              displayName: "Venue as tenant",
            }),
          /COURT_RESOURCE_CROSS_TENANT_SCOPE/
        );
      });

      await t.test("D. foreign Venue label cannot substitute tenant", async () => {
        const listed = await listEligibleCourts(client, {
          tenantId: F.VENUE_A,
          clubId: F.CLUB_A,
          clusterId: F.CLUSTER_A,
        });
        assert.equal(listed.ok, false);
        assert.ok(
          ["TENANT_MISMATCH", "CLUB_TENANT_MISMATCH", "TENANT_FORBIDDEN"].includes(listed.code),
          listed.code
        );
      });

      await t.test("E. unknown cluster FAIL CLOSED", async () => {
        await assert.rejects(
          () =>
            insertPhysicalCourt(client, {
              physicalCourtId: COURT_PROBE_B,
              tenantId: F.TENANT_A,
              clusterId: "cluster-does-not-exist",
              displayName: "Unknown cluster",
            }),
          /(COURT_RESOURCE_UNKNOWN_CLUSTER|foreign key|violates)/i
        );
      });

      await t.test("F. rename Venue leaves physicalCourt identity unaffected", async () => {
        await client.query(`UPDATE public.venues SET name = 'Venue A Renamed' WHERE id = $1`, [
          F.VENUE_A,
        ]);
        const { rows } = await client.query(
          `SELECT physical_court_id, tenant_id, cluster_id, display_name
           FROM public.court_resource_physical_courts WHERE physical_court_id = $1`,
          [F.COURT_A1]
        );
        assert.equal(rows[0].physical_court_id, F.COURT_A1);
        assert.equal(rows[0].tenant_id, F.TENANT_A);
        assert.equal(rows[0].cluster_id, F.CLUSTER_A);
      });

      await t.test("G. rename Court display leaves UUID unaffected", async () => {
        await client.query(
          `UPDATE public.court_resource_physical_courts
           SET display_name = 'Court A1 Renamed' WHERE physical_court_id = $1`,
          [F.COURT_A1]
        );
        const { rows } = await client.query(
          `SELECT physical_court_id, tenant_id FROM public.court_resource_physical_courts
           WHERE physical_court_id = $1`,
          [F.COURT_A1]
        );
        assert.equal(rows[0].physical_court_id, F.COURT_A1);
        assert.equal(rows[0].tenant_id, F.TENANT_A);
      });

      await t.test("I. canonical reservation with distinct tenant/venue PASS", async () => {
        const win = windowOnDay(10, 8, 9);
        const result = await reserveCapacity(client, {
          tenantId: F.TENANT_A,
          clubId: F.CLUB_A,
          physicalCourtIds: [F.COURT_A1],
          ownerType: "competition",
          ownerSubType: "internal",
          ownerId: "ig-reserve-1",
          startsAt: win.startsAt,
          endsAt: win.endsAt,
          requestId: "ig-reserve-1",
        });
        assert.equal(result.ok, true, JSON.stringify(result));
      });

      await t.test("J. Booking with distinct tenant/venue PASS", async () => {
        const win = windowOnDay(10, 10, 11);
        const result = await createBooking(client, {
          tenantId: F.TENANT_A,
          clubId: F.CLUB_A,
          physicalCourtId: F.COURT_A1,
          startsAt: win.startsAt,
          endsAt: win.endsAt,
          requestId: "ig-booking-1",
        });
        assert.equal(result.ok, true, JSON.stringify(result));
      });

      await t.test("K. Resource Block with distinct tenant/venue PASS", async () => {
        const win = windowOnDay(10, 12, 13);
        const result = await createResourceBlock(client, {
          tenantId: F.TENANT_A,
          clubId: F.CLUB_A,
          physicalCourtId: F.COURT_A2,
          startsAt: win.startsAt,
          endsAt: win.endsAt,
          requestId: "ig-block-1",
          blockType: "MAINTENANCE",
        });
        assert.equal(result.ok, true, JSON.stringify(result));
      });

      await t.test("L. Competition Adapter B reservation path with distinct scope PASS", async () => {
        const win = windowOnDay(10, 14, 15);
        const result = await reserveCapacity(client, {
          tenantId: F.TENANT_A,
          clubId: F.CLUB_A,
          physicalCourtIds: [F.COURT_A2],
          ownerType: "competition",
          ownerSubType: "official_open",
          ownerId: "ig-comp-adapter-b",
          startsAt: win.startsAt,
          endsAt: win.endsAt,
          requestId: "ig-comp-adapter-b",
        });
        assert.equal(result.ok, true, JSON.stringify(result));
      });

      await t.test("guard body no longer SELECTs venue_id as tenant invent", async () => {
        const { rows } = await client.query(
          `SELECT pg_get_functiondef(p.oid) AS def
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'court_resource_identity_guard'`
        );
        assert.match(rows[0].def, /cc\.tenant_id/);
        assert.doesNotMatch(
          rows[0].def,
          /SELECT venue_id INTO v_scope_tenant FROM public\.court_clusters/
        );
      });
    });
  } finally {
    await stop();
  }
});
