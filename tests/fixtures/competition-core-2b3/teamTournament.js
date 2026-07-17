/**
 * Synthetic fixtures for Phase 2B.3 — no Production personal data.
 */

export const FIXTURE_COMPETITION_ID = "comp-fixture-tt-001";

export const teamPlayers = {
  p1: { id: "p1", name: "Captain Alpha", gender: "M", rating: 4.2, playerType: "member" },
  p2: { id: "p2", name: "Player Beta", gender: "F", rating: 3.8, playerType: "member" },
  p3: { id: "p3", name: "Player Gamma", gender: "M", rating: 4.0, playerType: "member" },
  p4: { id: "p4", name: "Player Delta", gender: "F", rating: 3.5, playerType: "member" },
  guest1: { id: "guest1", name: "Walk-in Guest", gender: "M", rating: 3.0, playerType: "guest", isGuest: true },
};

export const validTeam4 = {
  id: "team-alpha",
  name: "Alpha Squad",
  tournamentId: FIXTURE_COMPETITION_ID,
  playerIds: ["p1", "p2", "p3", "p4"],
  captainPlayerId: "p1",
  deputyPlayerIds: ["p2"],
  absentPlayerIds: [],
  lockedPlayerIds: [],
  seed: 1,
  avgLevel: 3.9,
  color: "#112233",
};

export const lockedRosterTeam = {
  ...validTeam4,
  id: "team-locked",
  locked: true,
  lockedAt: "2026-07-01T10:00:00.000Z",
  lockReason: "roster_freeze",
  rosterStatus: "ROSTER_LOCKED",
};

export const guestRosterTeam = {
  id: "team-guest",
  name: "Guest Mix",
  tournamentId: FIXTURE_COMPETITION_ID,
  playerIds: ["p1", "guest1", "p3", "p4"],
  captainPlayerId: "p1",
  deputyPlayerIds: [],
};

export const duplicateMemberTeam = {
  id: "team-dup",
  name: "Dup Team",
  tournamentId: FIXTURE_COMPETITION_ID,
  playerIds: ["p1", "p2", "p1", "p3"],
  captainPlayerId: "p1",
};

export const substitutionRef = {
  id: "sub-1",
  replacedId: "p4",
  replacementId: "guest1",
  reason: "injury",
  effectiveAt: "2026-07-02T12:00:00.000Z",
};

export const hiddenLineupRevision = {
  matchupId: "mu-1",
  teamId: "team-alpha",
  tournamentId: FIXTURE_COMPETITION_ID,
  status: "submitted",
  version: 2,
  previousLineupVersion: 1,
  selections: {
    md: ["p1", "p2"],
    wd: ["p3", "p4"],
  },
  submittedAt: "2026-07-01T11:00:00.000Z",
  submittedBy: "captain",
  source: "captain",
  revisions: [
    {
      revision: 1,
      status: "draft",
      selections: { md: ["p1", "p3"], wd: ["p2", "p4"] },
      submittedAt: "2026-07-01T10:30:00.000Z",
    },
  ],
};

export const invalidLineupRevision = {
  matchupId: "mu-2",
  teamId: "team-alpha",
  tournamentId: FIXTURE_COMPETITION_ID,
  status: "submitted",
  revision: 0,
  selections: { md: ["p1", "p2"] },
};

export const teamWaitlistRegistration = {
  id: "tt-reg-wait",
  teamId: "team-wait",
  tournamentId: FIXTURE_COMPETITION_ID,
  status: "waitlisted",
  waitlistPosition: 2,
  playerIds: ["p1", "p2", "p3", "p4"],
  name: "Waiting Team",
};
