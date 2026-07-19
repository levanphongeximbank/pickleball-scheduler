/**
 * Core-05 — TT V6 compatibility adapter parity (map-only).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapTtV6TeamToCompetitionTeam,
  mapTtV6TeamToCompetitionRoster,
  mapTtV6TeamBundle,
} from "../src/features/competition-core/teams/index.js";
import { COMPETITION_ROSTER_STATUS } from "../src/features/competition-core/participants/enums/statuses.js";

describe("Core-05 TT V6 compat adapter", () => {
  const ttTeam = {
    id: "tt-team-1",
    name: "Dragons",
    color: "#112233",
    logoUrl: "https://example.test/logo.png",
    playerIds: ["p1", "p2", "p3"],
    captainPlayerId: "p1",
    deputyPlayerIds: ["p2"],
    absentPlayerIds: ["p3"],
    lockedPlayerIds: ["p2"],
    seed: 2,
    avgLevel: 3.5,
    selections: {
      // lineup-shaped noise — must NOT become roster members
      md1: ["p1", "p2"],
    },
  };

  it("maps team identity, captain, deputies and TT-only fields into extensions", () => {
    const result = mapTtV6TeamToCompetitionTeam(ttTeam, {
      competitionId: "comp-tt",
      tenantId: "tenant-1",
    });
    assert.equal(result.success, true);
    assert.equal(result.value.id, "tt-team-1");
    assert.equal(result.value.competitionId, "comp-tt");
    assert.equal(result.value.captainRef.id, "p1");
    assert.equal(result.value.deputyRefs[0].id, "p2");
    assert.equal(result.value.extensions.formatKey, "team-tournament-v6");
    assert.equal(result.value.extensions.payload.color, "#112233");
    assert.deepEqual(result.value.extensions.payload.lockedPlayerIds, ["p2"]);
  });

  it("maps playerIds to roster members and absentPlayerIds to ABSENT not removal", () => {
    const result = mapTtV6TeamToCompetitionRoster(ttTeam, {
      competitionId: "comp-tt",
    });
    assert.equal(result.success, true);
    assert.equal(result.value.members.length, 3);
    const absent = result.value.members.find((m) => m.person.id === "p3");
    assert.equal(absent.status, "ABSENT");
    assert.equal(absent.removedAt, null);
    const captain = result.value.members.find((m) => m.person.id === "p1");
    assert.equal(captain.role, "captain");
  });

  it("does not treat lockedPlayerIds as roster freeze", () => {
    const result = mapTtV6TeamToCompetitionRoster(ttTeam, {
      competitionId: "comp-tt",
      treatLockedPlayerIdsAsRosterLock: true,
    });
    assert.equal(result.success, true);
    assert.equal(result.value.status, COMPETITION_ROSTER_STATUS.DRAFT);
    assert.equal(result.value.lockedAt, null);
    assert.ok(
      result.diagnostics.some((d) => d.code === "LOCKED_PLAYER_IDS_IGNORED_FOR_FREEZE")
    );
    const lockedMember = result.value.members.find((m) => m.person.id === "p2");
    assert.equal(lockedMember.extensions.payload.lockedPlayer, true);
  });

  it("sets ROSTER_LOCKED only from explicit lock signals", () => {
    const locked = mapTtV6TeamToCompetitionRoster(
      { ...ttTeam, locked: true, lockedAt: "2026-07-20T00:00:00.000Z" },
      { competitionId: "comp-tt" }
    );
    assert.equal(locked.success, true);
    assert.equal(locked.value.status, COMPETITION_ROSTER_STATUS.ROSTER_LOCKED);
    assert.equal(locked.value.lockedAt, "2026-07-20T00:00:00.000Z");
  });

  it("excludes lineup fields from roster membership", () => {
    const result = mapTtV6TeamBundle(
      {
        ...ttTeam,
        // extra lineup map must not inflate members
        lineups: {
          "mu-1::tt-team-1": {
            matchupId: "mu-1",
            teamId: "tt-team-1",
            selections: { d1: ["p1"] },
          },
        },
      },
      {
        competitionId: "comp-tt",
        lineup: {
          matchupId: "mu-1",
          teamId: "tt-team-1",
          selections: { d1: ["p1", "ghost"] },
        },
      }
    );
    assert.equal(result.success, true);
    assert.equal(result.value.lineup, null);
    assert.equal(result.value.roster.members.length, 3);
    assert.ok(!result.value.roster.members.some((m) => m.person.id === "ghost"));
    assert.equal(result.value.roster.extensions.payload.lineupExcluded, true);
    assert.ok(result.diagnostics.some((d) => d.code === "LINEUP_EXCLUDED"));
  });

  it("maps withdrawal semantics", () => {
    const result = mapTtV6TeamToCompetitionTeam(
      { ...ttTeam, withdrawn: true, withdrawalReason: "no-show" },
      { competitionId: "comp-tt" }
    );
    assert.equal(result.success, true);
    assert.equal(result.value.status, "WITHDRAWN");
    assert.equal(result.value.extensions.payload.withdrawalReason, "no-show");
  });
});
