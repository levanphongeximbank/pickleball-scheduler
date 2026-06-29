export const TOURNAMENT_MODE = {
  DAILY_PLAY: "daily_play",
  INTERNAL_TOURNAMENT: "internal_tournament",
  OFFICIAL_TOURNAMENT: "official_tournament",
};

export const OFFICIAL_MODE = {
  OPEN: "official_open",
  AI_BALANCE: "official_ai_balance",
};

export const TOURNAMENT_STATUS = {
  DRAFT: "draft",
  REGISTRATION: "registration",
  READY: "ready",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const EVENT_TYPE = {
  MEN_SINGLE: "men_single",
  WOMEN_SINGLE: "women_single",
  MEN_DOUBLE: "men_double",
  WOMEN_DOUBLE: "women_double",
  MIXED_DOUBLE: "mixed_double",
};

export const MATCH_STAGE = {
  GROUP: "group",
  ROUND_OF_16: "round_of_16",
  QUARTERFINAL: "quarterfinal",
  SEMIFINAL: "semifinal",
  FINAL: "final",
  THIRD_PLACE: "third_place",
};

export const MATCH_STATUS = {
  WAITING: "waiting",
  ASSIGNED: "assigned",
  PLAYING: "playing",
  COMPLETED: "completed",
  POSTPONED: "postponed",
  FORFEIT: "forfeit",
};

export const COURT_STATUS = {
  AVAILABLE: "available",
  PLAYING: "playing",
  LOCKED: "locked",
};

export const PLAYER_TYPE = {
  MEMBER: "member",
  GUEST: "guest",
  VISITOR: "visitor",
  EXTERNAL: "external",
};

export const PAIR_TYPE = {
  SAME_CLUB: "same_club",
  MIXED_CLUB: "mixed_club",
  VISITOR_PAIR: "visitor_pair",
};

export const DEFAULT_GROUP_POINTS = {
  win: 2,
  loss: 1,
  forfeit: 0,
};
