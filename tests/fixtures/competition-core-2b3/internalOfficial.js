export const INTERNAL_TOURNAMENT_ID = "comp-fixture-internal-001";
export const OFFICIAL_TOURNAMENT_ID = "comp-fixture-official-001";

export const internalMemberRegistration = {
  id: "int-entry-1",
  tournamentId: INTERNAL_TOURNAMENT_ID,
  eventId: "cat-md",
  groupId: "div-internal-a",
  name: "Internal Pair",
  playerIds: ["ip1", "ip2"],
  status: "active",
  rating: 4.1,
  seed: 1,
  registeredAt: "2026-05-01T10:00:00.000Z",
};

export const officialOpenRegistration = {
  id: "off-entry-1",
  tournamentId: OFFICIAL_TOURNAMENT_ID,
  eventId: "cat-open-md",
  groupId: "div-open-1",
  name: "Open Pair",
  playerIds: ["op1", "op2"],
  status: "approved",
  rating: 4.4,
  seed: 3,
  pairType: "mixed_club",
  registeredAt: "2026-05-02T10:00:00.000Z",
};

export const officialSeedPlayer = {
  id: "op1",
  name: "Seeded Player",
  rating: 4.4,
  playerType: "member",
  gender: "M",
};

export const internalClassification = {
  groupId: "div-internal-a",
  groupName: "Internal Group A",
  eventId: "cat-md",
  eventType: "mixed_double",
  tournamentId: INTERNAL_TOURNAMENT_ID,
};

export const officialClassification = {
  groupId: "div-open-1",
  groupName: "Open Group 1",
  eventId: "cat-open-md",
  eventType: "open_mixed_double",
  tournamentId: OFFICIAL_TOURNAMENT_ID,
};
