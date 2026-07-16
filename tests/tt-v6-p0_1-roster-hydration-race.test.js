/**
 * TEAM TOURNAMENT V6 — P0.1 roster hydration race + rating regression tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  ROSTER_HYDRATION_STATUS,
  ROSTER_LOADING_MESSAGE,
  ROSTER_MISSING_RATING_LABEL,
  ROSTER_UNRESOLVED_NAME,
  formatHydratedMemberLabel,
  hydrateTeamRoster,
  looksLikeOpaqueRosterId,
  normalizeRosterRating,
  resolveCanonicalRosterDisplayName,
  resolveRosterHydrationStatus,
} from "../src/features/team-tournament/engines/teamRosterHydration.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TEAM = {
  id: "team-alpha",
  name: "Alpha MLP",
  playerIds: [
    "a1000000-0000-4000-8000-000000000001",
    "a1000000-0000-4000-8000-000000000002",
    "a1000000-0000-4000-8000-000000000003",
    "a1000000-0000-4000-8000-000000000004",
  ],
  captainPlayerId: "a1000000-0000-4000-8000-000000000001",
  deputyPlayerIds: [],
};

const POOL = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    athleteId: "a1000000-0000-4000-8000-000000000001",
    displayName: "TEST-NAM-01",
    gender: "Nam",
    currentRating: 4.0,
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    athleteId: "a1000000-0000-4000-8000-000000000002",
    name: "TEST-NAM-02",
    gender: "Nam",
    vprRating: 3.8,
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    athleteId: "a1000000-0000-4000-8000-000000000003",
    fullName: "TEST-NU-01",
    gender: "Nữ",
    skillLevel: 0,
  },
  {
    id: "a1000000-0000-4000-8000-000000000004",
    athleteId: "a1000000-0000-4000-8000-000000000004",
    displayName: "TEST-NU-02",
    gender: "female",
    // no rating fields
  },
];

describe("P0.1 hydration race status", () => {
  it("setup reload finishes before athlete pool: loading state only", () => {
    const hydrated = hydrateTeamRoster({
      team: TEAM,
      athletePool: [],
      setupReady: true,
      athletePoolLoading: true,
    });
    assert.equal(hydrated.status, ROSTER_HYDRATION_STATUS.LOADING);
    assert.equal(hydrated.unresolvedCount, 0);
    assert.equal(hydrated.diagnostics.length, 0);
    assert.equal(hydrated.loadingMessage, ROSTER_LOADING_MESSAGE);
    assert.ok(hydrated.members.every((m) => m.pending === true));
    assert.ok(
      hydrated.members.every(
        (m) => !m.displayName || m.displayName === ROSTER_LOADING_MESSAGE
      )
    );
    for (const member of hydrated.members) {
      assert.equal(looksLikeOpaqueRosterId(member.displayName), false);
      assert.doesNotMatch(String(member.displayName), /a1000000/);
    }
  });

  it("athlete pool finishes before setup: loading state only", () => {
    const status = resolveRosterHydrationStatus({
      setupReady: false,
      athletePoolLoading: false,
      unresolvedCount: 0,
    });
    assert.equal(status, ROSTER_HYDRATION_STATUS.LOADING);

    const hydrated = hydrateTeamRoster({
      team: TEAM,
      athletePool: POOL,
      setupReady: false,
      athletePoolLoading: false,
    });
    assert.equal(hydrated.status, ROSTER_HYDRATION_STATUS.LOADING);
    assert.equal(hydrated.unresolvedCount, 0);
  });

  it("both ready: roster renders once with canonical data", () => {
    const hydrated = hydrateTeamRoster({
      team: TEAM,
      athletePool: POOL,
      setupReady: true,
      athletePoolLoading: false,
    });
    assert.equal(hydrated.status, ROSTER_HYDRATION_STATUS.READY);
    assert.equal(hydrated.members.length, 4);
    assert.equal(hydrated.unresolvedCount, 0);
    assert.deepEqual(
      hydrated.members.map((m) => m.displayName),
      ["TEST-NAM-01", "TEST-NAM-02", "TEST-NU-01", "TEST-NU-02"]
    );
    const males = hydrated.members.filter(
      (m) => String(m.gender).toLowerCase().startsWith("nam") || m.gender === "male"
    ).length;
    const females = hydrated.members.filter(
      (m) =>
        String(m.gender).toLowerCase().startsWith("nữ") ||
        String(m.gender).toLowerCase().startsWith("nu") ||
        m.gender === "female"
    ).length;
    assert.equal(males, 2);
    assert.equal(females, 2);
    assert.equal(hydrated.members.find((m) => m.isCaptain)?.displayName, "TEST-NAM-01");
  });

  it("unresolved identity appears only after final resolution", () => {
    const loading = hydrateTeamRoster({
      team: { ...TEAM, playerIds: ["ghost-uuid"] },
      athletePool: [],
      athletePoolLoading: true,
    });
    assert.equal(loading.status, ROSTER_HYDRATION_STATUS.LOADING);
    assert.equal(loading.unresolvedCount, 0);
    assert.equal(loading.diagnostics.includes("missing_identity:ghost-uuid"), false);

    const ready = hydrateTeamRoster({
      team: { ...TEAM, playerIds: ["ghost-uuid"] },
      athletePool: POOL,
      athletePoolLoading: false,
    });
    assert.equal(ready.status, ROSTER_HYDRATION_STATUS.PARTIAL);
    assert.equal(ready.unresolvedCount, 1);
    assert.equal(ready.members[0].displayName, ROSTER_UNRESOLVED_NAME);
    assert.equal(ready.members[0].displayName.includes("ghost-uuid"), false);
  });

  it("raw player_id is never used as visible display name", () => {
    const opaque = "a1000000-0000-4000-8000-000000000099";
    assert.equal(looksLikeOpaqueRosterId(opaque), true);
    assert.equal(
      resolveCanonicalRosterDisplayName({ displayName: opaque }),
      ROSTER_UNRESOLVED_NAME
    );
    assert.equal(
      resolveCanonicalRosterDisplayName(null),
      ROSTER_UNRESOLVED_NAME
    );

    const hydrated = hydrateTeamRoster({
      team: { id: "t", name: "T", playerIds: [opaque] },
      athletePool: [],
      athletePoolLoading: false,
    });
    assert.equal(hydrated.members[0].displayName, ROSTER_UNRESOLVED_NAME);
    assert.equal(hydrated.members[0].displayName.includes(opaque), false);
  });

  it("no name flicker after ready — rehydrate is stable", () => {
    const first = hydrateTeamRoster({
      team: TEAM,
      athletePool: POOL,
      athletePoolLoading: false,
    });
    const second = hydrateTeamRoster({
      team: structuredClone(TEAM),
      athletePool: POOL.map((row) => ({ ...row })),
      athletePoolLoading: false,
    });
    assert.deepEqual(
      first.members.map((m) => m.displayName),
      second.members.map((m) => m.displayName)
    );
    assert.deepEqual(
      first.members.map((m) => m.ratingLabel),
      second.members.map((m) => m.ratingLabel)
    );
  });

  it("browser refresh preserves hydrated roster", () => {
    const before = hydrateTeamRoster({
      team: TEAM,
      athletePool: POOL,
    });
    // Simulate hard refresh: same cloud playerIds + same canonical pool.
    const after = hydrateTeamRoster({
      team: {
        id: TEAM.id,
        name: TEAM.name,
        playerIds: [...TEAM.playerIds],
        captainPlayerId: TEAM.captainPlayerId,
        deputyPlayerIds: [],
      },
      athletePool: POOL,
    });
    assert.equal(after.status, ROSTER_HYDRATION_STATUS.READY);
    assert.deepEqual(
      before.members.map((m) => ({
        athleteId: m.athleteId,
        displayName: m.displayName,
        ratingLabel: m.ratingLabel,
        isCaptain: m.isCaptain,
      })),
      after.members.map((m) => ({
        athleteId: m.athleteId,
        displayName: m.displayName,
        ratingLabel: m.ratingLabel,
        isCaptain: m.isCaptain,
      }))
    );
  });
});

describe("P0.1 rating enrichment", () => {
  it("rating normalizes from supported canonical fields", () => {
    assert.deepEqual(normalizeRosterRating({ currentRating: 4.2 }), {
      ratingValue: 4.2,
      ratingLabel: "4.2",
    });
    assert.deepEqual(normalizeRosterRating({ vprRating: 3.8 }), {
      ratingValue: 3.8,
      ratingLabel: "3.8",
    });
    assert.deepEqual(normalizeRosterRating({ level: 3.5 }), {
      ratingValue: 3.5,
      ratingLabel: "3.5",
    });
    assert.deepEqual(normalizeRosterRating({ skillLevel: 3.25 }), {
      ratingValue: 3.25,
      ratingLabel: "3.25",
    });
  });

  it("rating 0 is preserved", () => {
    assert.deepEqual(normalizeRosterRating({ skillLevel: 0 }), {
      ratingValue: 0,
      ratingLabel: "0",
    });
    assert.deepEqual(normalizeRosterRating({ rating: 0 }), {
      ratingValue: 0,
      ratingLabel: "0",
    });
  });

  it("missing rating shows Chưa có trình", () => {
    assert.deepEqual(normalizeRosterRating({}), {
      ratingValue: null,
      ratingLabel: ROSTER_MISSING_RATING_LABEL,
    });
    assert.deepEqual(normalizeRosterRating(null), {
      ratingValue: null,
      ratingLabel: ROSTER_MISSING_RATING_LABEL,
    });
  });

  it("hydrated member label includes rating", () => {
    const hydrated = hydrateTeamRoster({
      team: TEAM,
      athletePool: POOL,
    });
    assert.equal(
      formatHydratedMemberLabel(hydrated.members[1]),
      "TEST-NAM-02 · Nam · 3.8"
    );
    assert.equal(
      formatHydratedMemberLabel(hydrated.members[2]),
      "TEST-NU-01 · Nữ · 0"
    );
    assert.equal(
      formatHydratedMemberLabel(hydrated.members[3]),
      `TEST-NU-02 · female · ${ROSTER_MISSING_RATING_LABEL}`
    );
  });
});

describe("P0.1 TeamRosterPanel wiring", () => {
  it("TeamRosterPanel gates unresolved warnings behind loading status", () => {
    const src = readFileSync(
      path.join(ROOT, "src/components/tournament/TeamRosterPanel.jsx"),
      "utf8"
    );
    assert.match(src, /athletePoolLoading/);
    assert.match(src, /ROSTER_LOADING_MESSAGE/);
    assert.match(src, /!rosterLoading && hydratedRoster\.unresolvedCount/);
    assert.match(src, /listAvailableAthletes/);
    assert.match(src, /hydrationStatus/);
    assert.match(src, /Đã AI ghép đội và tải thông tin VĐV/);
  });

  it("TeamTournamentSetup passes pool loading into TeamRosterPanel", () => {
    const src = readFileSync(
      path.join(ROOT, "src/pages/tournament/TeamTournamentSetup.jsx"),
      "utf8"
    );
    assert.match(src, /athletePoolLoading=\{/);
    assert.match(src, /clubPool\.loading/);
  });
});
