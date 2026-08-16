import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkTeamTournamentCourtResourceReadiness,
  saveTeamTournamentCourtResourceSetup,
  validateTeamTournamentCourtResourceSetup,
} from "../src/features/team-tournament/services/teamTournamentCourtResourceSetupService.js";
import { buildStructuredRoundRobinMatchups } from "../src/features/team-tournament/engines/teamRoundRobinScheduleEngine.js";
import {
  createMatchupRecord,
  normalizeTeamData,
  normalizeMatchup,
} from "../src/features/team-tournament/models/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAPACITY = {
  date: "2026-08-15",
  startTime: "08:00",
  endTime: "18:00",
};
const CONFIG = {
  clusterId: "cluster-a",
  selectedCourtIds: ["court-01", "court-02"],
  courtCapacityWindow: CAPACITY,
};
const COURTS = [
  { id: "court-01", name: "Center Court", clusterId: "cluster-a" },
  { id: "court-02", name: "Side Court", clusterId: "cluster-a" },
];

function read(relative) {
  return readFileSync(path.join(root, relative), "utf8");
}

test("setup contract persists cluster, physical IDs, and explicit capacity window", async () => {
  assert.deepEqual(validateTeamTournamentCourtResourceSetup(CONFIG), {
    ok: true,
    clusterId: "cluster-a",
    selectedCourtIds: ["court-01", "court-02"],
    courtCapacityWindow: CAPACITY,
  });
  assert.equal(
    validateTeamTournamentCourtResourceSetup({
      clusterId: "cluster-a",
      selectedCourtIds: ["court-01"],
    }).ok,
    false,
    "capacity defaults must never be invented"
  );

  const calls = [];
  let persisted;
  const result = await saveTeamTournamentCourtResourceSetup(
    {
      clubId: "club-a",
      tenantId: "venue-a",
      venueId: "venue-a",
      tournamentId: "tt-a",
      config: CONFIG,
      persistSetupConfig: async (config) => {
        calls.push("persist");
        persisted = config;
        return { ok: true };
      },
    },
    {
      listCanonicalCloudCourts: async () => ({ ok: true, courts: COURTS }),
      getCourtAvailability: async (params) => {
        calls.push("availability");
        assert.deepEqual(params.context.owner, { type: "tournament", id: "tt-a" });
        assert.deepEqual(params.courtIds, CONFIG.selectedCourtIds);
        return {
          courts: CONFIG.selectedCourtIds.map((courtId) => ({
            courtId,
            available: true,
          })),
        };
      },
      reserveCourts: async (params) => {
        calls.push("reserve");
        assert.deepEqual(params.selectedCourtIds, CONFIG.selectedCourtIds);
        assert.equal(params.clusterId, "cluster-a");
        assert.deepEqual(params.owner, { type: "tournament", id: "tt-a" });
        return { ok: true, created: [], updated: [] };
      },
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["availability", "reserve", "persist"]);
  assert.equal(persisted.clusterId, "cluster-a");
  assert.deepEqual(persisted.selectedCourtIds, CONFIG.selectedCourtIds);
  assert.deepEqual(persisted.courtCapacityWindow, CAPACITY);
});

test("foreign/customer/maintenance availability conflicts stop before reservation", async () => {
  let reserveCalls = 0;
  for (const code of [
    "FOREIGN_TOURNAMENT_CONFLICT",
    "CUSTOMER_BOOKING_CONFLICT",
    "MAINTENANCE_CONFLICT",
  ]) {
    const result = await saveTeamTournamentCourtResourceSetup(
      {
        clubId: "club-a",
        tenantId: "venue-a",
        tournamentId: "tt-a",
        config: CONFIG,
        persistSetupConfig: async () => ({ ok: true }),
      },
      {
        listCanonicalCloudCourts: async () => ({ ok: true, courts: COURTS }),
        getCourtAvailability: async () => ({
          courts: [{ courtId: "court-01", available: false, conflicts: [{ code }] }],
        }),
        reserveCourts: async () => {
          reserveCalls += 1;
          return { ok: true };
        },
      }
    );
    assert.equal(result.ok, false);
  }
  assert.equal(reserveCalls, 0);
});

test("own capacity reservation is required for schedule readiness", async () => {
  const base = {
    clubId: "club-a",
    tenantId: "venue-a",
    tournamentId: "tt-a",
    config: CONFIG,
  };
  const deps = {
    listCanonicalCloudCourts: async () => ({ ok: true, courts: COURTS }),
    getCourtAvailability: async () => ({
      courts: CONFIG.selectedCourtIds.map((courtId) => ({
        courtId,
        available: true,
        ownership: { status: "own_reservation" },
      })),
    }),
  };
  const ready = await checkTeamTournamentCourtResourceReadiness(base, deps);
  assert.equal(ready.ok, true);
  assert.equal(ready.courts.length, COURTS.length);
  assert.deepEqual(
    ready.courts.map((court) => court.physicalCourtId || court.id),
    COURTS.map((court) => court.id)
  );

  const notOwned = await checkTeamTournamentCourtResourceReadiness(base, {
    ...deps,
    getCourtAvailability: async () => ({
      courts: CONFIG.selectedCourtIds.map((courtId) => ({
        courtId,
        available: true,
        ownership: { status: "none" },
      })),
    }),
  });
  assert.equal(notOwned.ok, false);
});

test("round robin binds canonical physical courts and planned slot end", () => {
  const teams = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
  const scheduled = buildStructuredRoundRobinMatchups(
    normalizeTeamData({
      teams,
      groups: [{ id: "g1", name: "A", teamIds: teams.map((team) => team.id) }],
      matchups: [],
      settings: CONFIG,
    }),
    {
      scheduledAt: "2026-08-15T01:00:00.000Z",
      roundIntervalMinutes: 30,
      clusterId: "cluster-a",
      selectedCourtIds: CONFIG.selectedCourtIds,
      venueCourts: COURTS,
    }
  );
  assert.notEqual(scheduled.ok, false);
  assert.ok(scheduled.matchups.every((matchup) => matchup.courtId));
  assert.ok(scheduled.matchups.every((matchup) => matchup.clusterId === "cluster-a"));
  assert.ok(
    scheduled.matchups.every(
      (matchup) =>
        new Date(matchup.scheduledEnd).getTime() -
          new Date(matchup.scheduledAt).getTime() ===
        30 * 60 * 1000
    )
  );
  assert.ok(scheduled.matchups.every((matchup) => !/^Sân \d+$/.test(matchup.courtLabel)));

  const mismatch = buildStructuredRoundRobinMatchups(
    normalizeTeamData({
      teams,
      groups: [{ id: "g1", name: "A", teamIds: teams.map((team) => team.id) }],
      matchups: [],
    }),
    {
      scheduledAt: "2026-08-15T01:00:00.000Z",
      selectedCourtIds: ["missing"],
      venueCourts: COURTS,
    }
  );
  assert.equal(mismatch.code, "COURT_INVENTORY_MISMATCH");
});

test("canonical matchup model carries group and knockout court assignment fields", () => {
  const fields = {
    scheduledAt: "2026-08-15T01:00:00.000Z",
    scheduledEnd: "2026-08-15T01:30:00.000Z",
    courtId: "court-01",
    clusterId: "cluster-a",
    courtLabel: "Center Court",
  };
  const group = createMatchupRecord("a", "b", fields);
  const knockout = normalizeMatchup({
    id: "ko-1",
    teamAId: "a",
    teamBId: "b",
    stage: "knockout",
    ...fields,
  });
  for (const matchup of [group, knockout]) {
    assert.equal(matchup.courtId, fields.courtId);
    assert.equal(matchup.clusterId, fields.clusterId);
    assert.equal(matchup.scheduledEnd, fields.scheduledEnd);
  }
});

test("UI and shared inventory boundaries remain consumer-only", () => {
  const panel = read("src/components/tournament/team/TeamFormatVenueSetupPanel.jsx");
  const setup = read(
    "src/features/team-tournament/services/teamTournamentCourtResourceSetupService.js"
  );
  assert.match(panel, /TeamTournamentCourtAdapter|createTeamTournamentCourtAdapter/);
  assert.match(panel, /team-tournament-capacity-date/);
  assert.match(panel, /clusterId/);
  assert.doesNotMatch(panel, /listClustersForVenue/);
  assert.doesNotMatch(panel, /courtClusterService/);
  assert.doesNotMatch(setup, /courtResourceGateway/);
  assert.doesNotMatch(setup, /canonicalCloudCourtInventory/);
  assert.match(setup, /createTeamTournamentCourtAdapter|TeamTournamentCourtAdapter/);
});

test("new SQL package uses dedicated identity and interval columns", () => {
  const apply = read(
    "docs/v5/migrations/team-tournament-court-resource-integration-01/02_APPLY.sql"
  );
  assert.match(apply, /court_id text/i);
  assert.match(apply, /cluster_id text/i);
  assert.match(apply, /scheduled_end timestamptz/i);
  assert.match(apply, /court_id\s*=\s*b\.court_id/i);
  assert.match(apply, /a\.starts_at\s*<\s*b\.ends_at/i);
  assert.match(apply, /b\.starts_at\s*<\s*a\.ends_at/i);
  assert.match(apply, /'courtId'/);
  assert.match(apply, /'clusterId'/);
  assert.match(apply, /'scheduledEnd'/);
  assert.doesNotMatch(apply, /court_id\s*=\s*[^,;\n]*court_label/i);
});

