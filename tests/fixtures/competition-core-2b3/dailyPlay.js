export const DAILY_SESSION_ID = "comp-fixture-daily-001";

export const dailyPlayers = {
  member1: { id: "dp1", name: "Club Member", playerType: "member", rating: 3.5 },
  registered: { id: "dp2", name: "Registered Player", playerType: "member", rating: 4.0, checkedIn: true },
  walkin: { id: "dp-walk", name: "Walk-in Guest", playerType: "guest", isGuest: true, isWalkIn: true, rating: 2.5 },
  external: { id: "dp-ext", name: "External Guest", playerType: "external", isExternal: true, rating: 3.8 },
};

export const dailySession = {
  id: "daily-session-1",
  tournamentId: DAILY_SESSION_ID,
  checkedInPlayerIds: ["dp1", "dp2", "dp-walk", "dp-ext"],
};

export const dailyTemporaryMatch = {
  id: "daily-match-1",
  tournamentId: DAILY_SESSION_ID,
  status: "playing",
  courtId: "court-1",
  teamAPlayerIds: ["dp1", "dp2"],
  teamBPlayerIds: ["dp-walk", "dp-ext"],
  teamALabel: "Side A",
  teamBLabel: "Side B",
};
