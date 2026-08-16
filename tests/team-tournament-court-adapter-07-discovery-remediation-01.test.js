/**
 * Court Adapter #07 End-B discovery remediation — outcome classification.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMPETITION_COURT_ERROR_CODE,
} from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  TEAM_COURT_DISCOVERY_OUTCOME,
  classifyTeamCourtDiscovery,
  createTeamTournamentCourtAdapter,
  deriveCanonicalClusterChoices,
} from "../src/features/team-tournament/adapters/canonical/TeamTournamentCourtAdapter.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

test("canonical A courts with clusterId → B exposes canonical cluster", () => {
  const adapter = createTeamTournamentCourtAdapter({
    gateway: {
      listEligibleCourts: () => ({
        ok: true,
        courts: [
          {
            physicalCourtId: "952a6c15-a3c1-4cd4-9dee-6720bcf5e073",
            clusterId: "venue-staging-a-tt412-canonical-facility",
            displayName: "TT412 Sân 1",
          },
          {
            physicalCourtId: "65c66b97-5522-4e09-b9b0-29ec61543370",
            clusterId: "venue-staging-a-tt412-canonical-facility",
            displayName: "TT412 Sân 2",
          },
        ],
      }),
      getCourtAvailability: () => ({ ok: true, courts: [] }),
      reserveCourts: () => ({ ok: true, selectedCourtIds: [] }),
      releaseCourts: () => ({ ok: true, cancelled: [] }),
      validateCourtAssignment: () => ({ ok: true }),
    },
  });

  const listed = adapter.listEligibleCourts({
    clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
    tenantId: "venue-staging-a",
    competitionId: "tt-1",
    competitionType: "team",
  });
  const discovery = classifyTeamCourtDiscovery(
    {
      clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
      tenantId: "venue-staging-a",
    },
    listed
  );
  assert.equal(discovery.outcome, TEAM_COURT_DISCOVERY_OUTCOME.SUCCESS_WITH_COURTS);
  assert.equal(discovery.clusters.length, 1);
  assert.equal(discovery.clusters[0].id, "venue-staging-a-tt412-canonical-facility");
  assert.deepEqual(
    deriveCanonicalClusterChoices(listed.courts).map((row) => row.id),
    ["venue-staging-a-tt412-canonical-facility"]
  );
});

test("selected canonical cluster → B exposes physicalCourtIds", async () => {
  const adapter = createTeamTournamentCourtAdapter({
    gateway: {
      listEligibleCourts: (input) => {
        const all = [
          {
            physicalCourtId: "952a6c15-a3c1-4cd4-9dee-6720bcf5e073",
            clusterId: "venue-staging-a-tt412-canonical-facility",
            displayName: "TT412 Sân 1",
          },
          {
            physicalCourtId: "other-court",
            clusterId: "other-cluster",
            displayName: "Other",
          },
        ];
        const clusterId = input.clusterId || null;
        return {
          ok: true,
          courts: clusterId
            ? all.filter((court) => court.clusterId === clusterId)
            : all,
        };
      },
      getCourtAvailability: () => ({ ok: true, courts: [] }),
      reserveCourts: () => ({ ok: true, selectedCourtIds: [] }),
      releaseCourts: () => ({ ok: true, cancelled: [] }),
      validateCourtAssignment: () => ({ ok: true }),
    },
  });

  const discovery = await adapter.listCanonicalClusters({
    clubId: "club-1",
    tenantId: "venue-staging-a",
    clusterId: "venue-staging-a-tt412-canonical-facility",
    competitionId: "tt-1",
  });
  assert.equal(discovery.outcome, TEAM_COURT_DISCOVERY_OUTCOME.SUCCESS_WITH_COURTS);
  assert.deepEqual(
    discovery.courts.map((court) => court.physicalCourtId),
    ["952a6c15-a3c1-4cd4-9dee-6720bcf5e073"]
  );
});

test("A returns error → B surfaces END_A_ERROR, not empty-success", async () => {
  const adapter = createTeamTournamentCourtAdapter({
    gateway: {
      listEligibleCourts: () => ({
        ok: false,
        code: COMPETITION_COURT_ERROR_CODE.DATA_UNAVAILABLE,
        error: "inventory unavailable",
        courts: [],
      }),
      getCourtAvailability: () => ({ ok: true, courts: [] }),
      reserveCourts: () => ({ ok: true, selectedCourtIds: [] }),
      releaseCourts: () => ({ ok: true, cancelled: [] }),
      validateCourtAssignment: () => ({ ok: true }),
    },
  });
  const discovery = await adapter.listCanonicalClusters({
    clubId: "club-1",
    tenantId: "venue-staging-a",
    competitionId: "tt-1",
  });
  assert.equal(discovery.ok, false);
  assert.equal(discovery.outcome, TEAM_COURT_DISCOVERY_OUTCOME.END_A_ERROR);
  assert.equal(discovery.code, COMPETITION_COURT_ERROR_CODE.DATA_UNAVAILABLE);
  assert.equal(discovery.clusters.length, 0);
  assert.match(String(discovery.error || ""), /inventory unavailable|không giả thành công/i);
});

test("missing tenant/club context → explicit fail-closed diagnostic", async () => {
  const adapter = createTeamTournamentCourtAdapter({
    gateway: {
      listEligibleCourts: () => ({ ok: true, courts: [{ id: "should-not-be-called" }] }),
      getCourtAvailability: () => ({ ok: true, courts: [] }),
      reserveCourts: () => ({ ok: true, selectedCourtIds: [] }),
      releaseCourts: () => ({ ok: true, cancelled: [] }),
      validateCourtAssignment: () => ({ ok: true }),
    },
  });
  const missingClub = await adapter.listCanonicalClusters({
    tenantId: "venue-staging-a",
  });
  assert.equal(missingClub.outcome, TEAM_COURT_DISCOVERY_OUTCOME.MISSING_TEAM_CONTEXT);
  assert.equal(missingClub.ok, false);

  const missingTenant = classifyTeamCourtDiscovery(
    { clubId: "club-1" },
    { ok: true, courts: [] }
  );
  assert.equal(
    missingTenant.outcome,
    TEAM_COURT_DISCOVERY_OUTCOME.MISSING_TEAM_CONTEXT
  );
});

test("A returns ok=true courts=[] → SUCCESS_EMPTY", async () => {
  const adapter = createTeamTournamentCourtAdapter({
    gateway: {
      listEligibleCourts: () => ({ ok: true, courts: [] }),
      getCourtAvailability: () => ({ ok: true, courts: [] }),
      reserveCourts: () => ({ ok: true, selectedCourtIds: [] }),
      releaseCourts: () => ({ ok: true, cancelled: [] }),
      validateCourtAssignment: () => ({ ok: true }),
    },
  });
  const discovery = await adapter.listCanonicalClusters({
    clubId: "club-1",
    tenantId: "venue-staging-a",
    competitionId: "tt-1",
  });
  assert.equal(discovery.ok, true);
  assert.equal(discovery.outcome, TEAM_COURT_DISCOVERY_OUTCOME.SUCCESS_EMPTY);
  assert.equal(discovery.clusters.length, 0);
});

test("Format & Venue panel does not silently collapse End A error to empty dropdown", () => {
  const panel = read("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx");
  assert.match(panel, /TEAM_COURT_DISCOVERY_OUTCOME/);
  assert.match(panel, /END_A_ERROR/);
  assert.match(panel, /MISSING_TEAM_CONTEXT/);
  assert.match(panel, /SUCCESS_EMPTY/);
  assert.match(panel, /team-court-discovery-end-a-error/);
  assert.doesNotMatch(panel, /setCanonicalClusters\(result\?\.clusters \|\| \[\]\);\s*\}\);/);
  assert.doesNotMatch(panel, /courtClusterService|listClustersForVenue/);
  assert.doesNotMatch(panel, /from ["'].*courtResourceGateway/);
});

test("Court Contract A and gateway binding are untouched by this remediation", () => {
  const contract = read(
    "src/features/competition-core/contracts/competitionCourtAdapterContract.js"
  );
  const binding = read(
    "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js"
  );
  assert.match(contract, /COMPETITION_COURT_ADAPTER_CONTRACT_VERSION\s*=\s*1/);
  assert.match(binding, /createCourtResourceCompetitionAdapter/);
  const adapterB = read(
    "src/features/team-tournament/adapters/canonical/TeamTournamentCourtAdapter.js"
  );
  assert.doesNotMatch(adapterB, /from ["'].*court-resource\/services\/courtResourceGateway/);
  assert.doesNotMatch(adapterB, /courtClusterService/);
});
