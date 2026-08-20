/**
 * CORE-13 Daily canonical eligibility alignment — fixture harness only.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
  DAILY_ATHLETE_ELIGIBILITY_RPC,
  discoverClubMemberAthleteCandidates,
  resolveCanonicalDailyEligibleAthletes,
  verifyAthleteEligibleViaCanonicalRpc,
} from "../scripts/core13/core13-staging-daily-eligibility.mjs";
import {
  createReadyDailyPreflightSnapshot,
  evaluateDailyFixturePreflight,
} from "../scripts/core13/core13-staging-fixture-preflight.mjs";

function createMockService({ members = [], eligibility = {} } = {}) {
  const chain = {
    select() {
      return chain;
    },
    eq() {
      return chain;
    },
    then(resolve) {
      resolve({ data: members, error: null });
    },
  };
  return {
    from(table) {
      assert.equal(table, "club_members");
      return chain;
    },
    rpc(name, args) {
      assert.equal(name, DAILY_ATHLETE_ELIGIBILITY_RPC);
      const eligible = eligibility[args.p_player_id] === true;
      return Promise.resolve({ data: eligible, error: null });
    },
  };
}

test("preflight requires daily_play_athlete_eligible_for_club authority", () => {
  const baseSnapshot = {
    ok: true,
    tenantId: "core13-qa-tenant-a",
    clubId: "core13-qa-club-a",
    clubTenantId: "core13-qa-tenant-a",
    eligiblePlayerIds: [
      "dddddddd-dddd-4ddd-8ddd-000000000001",
      "dddddddd-dddd-4ddd-8ddd-000000000002",
      "dddddddd-dddd-4ddd-8ddd-000000000003",
      "dddddddd-dddd-4ddd-8ddd-000000000004",
    ],
    fabricated: false,
    hasCourtCapability: true,
    usableCourtCount: 1,
    dailyEnabledScopable: true,
    dailyDisabledScopable: true,
    organizerAuthorized: true,
    rpc: { getState: true, checkIn: true, createMatches: true },
    casReadable: true,
    idempotencyKeysBuildable: true,
    doublesPayloadValid: true,
    CLUB_DATA_V3_AS_PLAYER_SSOT: "DENY",
    PLAYER_ELIGIBILITY_BYPASS: "DENY",
  };
  const missingAuthority = evaluateDailyFixturePreflight({
    ...baseSnapshot,
    DAILY_ELIGIBILITY_AUTHORITY: "profiles-table",
    canonicalEligibilityVerified: true,
  });
  assert.equal(missingAuthority.ok, false);
  assert.match(missingAuthority.detail, /daily_play_athlete_eligible_for_club/);

  const unverified = evaluateDailyFixturePreflight({
    ...baseSnapshot,
    DAILY_ELIGIBILITY_AUTHORITY: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
    canonicalEligibilityVerified: false,
  });
  assert.equal(unverified.ok, false);
  assert.match(unverified.detail, /verified via canonical RPC/);
});

test("resolveCanonicalDailyEligibleAthletes verifies via RPC not JS duplicate rule", async () => {
  const members = [
    {
      athlete_id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
      club_id: "club-a",
      tenant_id: "tenant-a",
      status: "active",
      athletes: { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001", tenant_id: "tenant-a", status: "active" },
    },
    {
      athlete_id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000002",
      club_id: "club-a",
      tenant_id: "tenant-a",
      status: "active",
      athletes: { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000002", tenant_id: "tenant-a", status: "active" },
    },
    {
      athlete_id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000003",
      club_id: "club-a",
      tenant_id: "tenant-a",
      status: "active",
      athletes: { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000003", tenant_id: "tenant-a", status: "active" },
    },
    {
      athlete_id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000004",
      club_id: "club-a",
      tenant_id: "tenant-a",
      status: "active",
      athletes: { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000004", tenant_id: "tenant-a", status: "active" },
    },
    {
      athlete_id: "cccccccc-cccc-4ccc-8ccc-000000000099",
      club_id: "club-a",
      tenant_id: "tenant-a",
      status: "active",
      athletes: { id: "cccccccc-cccc-4ccc-8ccc-000000000099", tenant_id: "tenant-a", status: "active" },
    },
  ];
  const eligibility = Object.fromEntries(
    members.map((row) => [row.athlete_id, row.athlete_id.startsWith("bbbbbbbb")])
  );
  const service = createMockService({ members, eligibility });
  const resolved = await resolveCanonicalDailyEligibleAthletes(service, {
    tenantId: "tenant-a",
    clubId: "club-a",
    minRequired: 4,
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.DAILY_ELIGIBILITY_AUTHORITY, DAILY_ATHLETE_ELIGIBILITY_AUTHORITY);
  assert.equal(resolved.canonicalEligibilityVerified, true);
  assert.equal(resolved.eligiblePlayerIds.length, 4);
  assert.equal(resolved.eligiblePlayerIds.includes("cccccccc-cccc-4ccc-8ccc-000000000099"), false);
  assert.deepEqual(resolved.eligiblePlayerIds, [...resolved.eligiblePlayerIds].sort());
});

test("resolveCanonicalDailyEligibleAthletes fails closed below four canonical athletes", async () => {
  const members = [
    {
      athlete_id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
      club_id: "club-a",
      tenant_id: "tenant-a",
      status: "active",
      athletes: { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001", tenant_id: "tenant-a", status: "active" },
    },
  ];
  const service = createMockService({
    members,
    eligibility: { "bbbbbbbb-bbbb-4bbb-8bbb-000000000001": true },
  });
  const resolved = await resolveCanonicalDailyEligibleAthletes(service, {
    tenantId: "tenant-a",
    clubId: "club-a",
    minRequired: 4,
  });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.canonicalEligibilityVerified, false);
  assert.match(resolved.detail, /INSUFFICIENT/);
});

test("verifyAthleteEligibleViaCanonicalRpc uses RPC authority only", async () => {
  let rpcCalls = 0;
  const service = {
    rpc(name, args) {
      rpcCalls += 1;
      assert.equal(name, DAILY_ATHLETE_ELIGIBILITY_RPC);
      assert.equal(args.p_tenant_id, "tenant-a");
      assert.equal(args.p_club_id, "club-a");
      assert.equal(args.p_player_id, "bbbbbbbb-bbbb-4bbb-8bbb-000000000001");
      return Promise.resolve({ data: true, error: null });
    },
  };
  const verified = await verifyAthleteEligibleViaCanonicalRpc(service, {
    tenantId: "tenant-a",
    clubId: "club-a",
    athleteId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
  });
  assert.equal(verified.ok, true);
  assert.equal(rpcCalls, 1);
  assert.equal(verified.authority, DAILY_ATHLETE_ELIGIBILITY_AUTHORITY);
});

test("ready preflight snapshot passes with canonical eligibility metadata", () => {
  const snapshot = createReadyDailyPreflightSnapshot({
    selectedPlayerTrace: [
      {
        athleteId: "dddddddd-dddd-4ddd-8ddd-000000000001",
        eligible: true,
        authority: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
      },
    ],
  });
  const ready = evaluateDailyFixturePreflight(snapshot);
  assert.equal(ready.ok, true);
  assert.equal(ready.DAILY_ELIGIBILITY_AUTHORITY, DAILY_ATHLETE_ELIGIBILITY_AUTHORITY);
  assert.equal(ready.PRECHECK_ELIGIBILITY_RULE_EQUALS_CREATE_MATCHES, "YES");
});

test("discoverClubMemberAthleteCandidates is read-only membership discovery", async () => {
  const members = [
    {
      athlete_id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
      athletes: { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001", tenant_id: "tenant-a", status: "active" },
    },
  ];
  const service = createMockService({ members, eligibility: {} });
  const discovered = await discoverClubMemberAthleteCandidates(service, {
    tenantId: "tenant-a",
    clubId: "club-a",
  });
  assert.equal(discovered.ok, true);
  assert.equal(discovered.candidates.length, 1);
  assert.equal(discovered.candidates[0].source, "club_members+athletes");
});
