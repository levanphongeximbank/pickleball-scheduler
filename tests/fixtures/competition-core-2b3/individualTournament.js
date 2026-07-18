export const FIXTURE_TOURNAMENT_ID = "comp-fixture-ind-001";

export const individualPlayers = {
  s1: { id: "s1", name: "Singles Ace", rating: 4.5, playerType: "member", gender: "M" },
  d1: { id: "d1", name: "Doubles A", rating: 4.0, playerType: "member", gender: "M" },
  d2: { id: "d2", name: "Doubles B", rating: 3.9, playerType: "member", gender: "F" },
  "g-ind-1": { id: "g-ind-1", name: "Guest Entrant", rating: 3.2, playerType: "guest", isGuest: true },
  "ext-1": { id: "ext-1", name: "External Club Pro", rating: 4.8, playerType: "external", isExternal: true },
};

/** Alias for readability in tests */
export const individualPlayersByAlias = {
  s1: individualPlayers.s1,
  d1: individualPlayers.d1,
  d2: individualPlayers.d2,
  guest: individualPlayers["g-ind-1"],
  external: individualPlayers["ext-1"],
};

export const singlesEntry = {
  id: "entry-singles-1",
  tournamentId: FIXTURE_TOURNAMENT_ID,
  eventId: "cat-ms",
  groupId: "div-a",
  name: "Singles Ace",
  playerIds: ["s1"],
  status: "approved",
  rating: 4.5,
  seed: 2,
  registeredAt: "2026-06-01T08:00:00.000Z",
};

export const doublesEntry = {
  id: "entry-doubles-1",
  tournamentId: FIXTURE_TOURNAMENT_ID,
  eventId: "cat-md",
  groupId: "div-b",
  name: "Doubles Pair",
  playerIds: ["d1", "d2"],
  pairType: "mixed_club",
  status: "active",
  rating: 3.95,
  registeredAt: "2026-06-01T09:00:00.000Z",
};

export const partnerInviteEntry = {
  id: "entry-invite-1",
  tournamentId: FIXTURE_TOURNAMENT_ID,
  eventId: "cat-md",
  groupId: "div-b",
  name: "Waiting Partner",
  playerIds: ["d1"],
  partnerInviteToken: "invite-token-fixture-abc",
  status: "pending",
  pairType: "same_club",
};

export const guestEntry = {
  id: "entry-guest-1",
  tournamentId: FIXTURE_TOURNAMENT_ID,
  eventId: "cat-ms",
  groupId: "div-a",
  name: "Guest Entrant",
  playerIds: ["g-ind-1"],
  status: "approved",
};

export const multiDivisionEntries = [
  {
    id: "entry-div-a",
    tournamentId: FIXTURE_TOURNAMENT_ID,
    eventId: "cat-ms",
    groupId: "div-a",
    playerIds: ["s1"],
    status: "active",
    name: "S1 Div A",
  },
  {
    id: "entry-div-b",
    tournamentId: FIXTURE_TOURNAMENT_ID,
    eventId: "cat-ms",
    groupId: "div-b",
    playerIds: ["s1"],
    status: "active",
    name: "S1 Div B",
  },
];

export const waitlistedEntry = {
  id: "entry-wait-1",
  tournamentId: FIXTURE_TOURNAMENT_ID,
  eventId: "cat-ms",
  groupId: "div-a",
  name: "Waitlisted",
  playerIds: ["d2"],
  status: "waitlisted",
  waitlistPosition: 5,
};

export const missingCompetitionEntry = {
  id: "entry-no-comp",
  tournamentId: "",
  eventId: "cat-ms",
  playerIds: ["s1"],
  status: "approved",
};

export const classificationFixture = {
  groupId: "div-a",
  groupName: "Bảng A",
  eventId: "cat-ms",
  eventType: "men_single",
  eventName: "Men Singles",
  tournamentId: FIXTURE_TOURNAMENT_ID,
  categoryIds: ["cat-ms"],
};
