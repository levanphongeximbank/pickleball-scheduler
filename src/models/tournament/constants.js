export const TOURNAMENT_MODE = {
  DAILY_PLAY: "daily_play",
  INTERNAL_TOURNAMENT: "internal_tournament",
  OFFICIAL_TOURNAMENT: "official_tournament",
  TEAM_TOURNAMENT: "team_tournament",
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
  OPEN_DOUBLE: "open_double",
};

/** Accept legacy/alternate keys without breaking stored tournaments. */
export const EVENT_TYPE_ALIASES = {
  open_doubles: EVENT_TYPE.OPEN_DOUBLE,
};

export const EVENT_TYPE_LABELS = {
  [EVENT_TYPE.MEN_SINGLE]: "Đơn nam",
  [EVENT_TYPE.WOMEN_SINGLE]: "Đơn nữ",
  [EVENT_TYPE.MEN_DOUBLE]: "Đôi nam",
  [EVENT_TYPE.WOMEN_DOUBLE]: "Đôi nữ",
  [EVENT_TYPE.MIXED_DOUBLE]: "Đôi nam nữ",
  [EVENT_TYPE.OPEN_DOUBLE]: "Đôi tự do",
};

export const EVENT_TYPE_DESCRIPTIONS = {
  [EVENT_TYPE.OPEN_DOUBLE]: "Không phân biệt giới tính, chỉ cần đủ 2 người.",
};

export const EVENT_TYPE_OPTIONS = [
  { value: EVENT_TYPE.MEN_SINGLE, label: EVENT_TYPE_LABELS[EVENT_TYPE.MEN_SINGLE] },
  { value: EVENT_TYPE.WOMEN_SINGLE, label: EVENT_TYPE_LABELS[EVENT_TYPE.WOMEN_SINGLE] },
  { value: EVENT_TYPE.MEN_DOUBLE, label: EVENT_TYPE_LABELS[EVENT_TYPE.MEN_DOUBLE] },
  { value: EVENT_TYPE.WOMEN_DOUBLE, label: EVENT_TYPE_LABELS[EVENT_TYPE.WOMEN_DOUBLE] },
  { value: EVENT_TYPE.MIXED_DOUBLE, label: EVENT_TYPE_LABELS[EVENT_TYPE.MIXED_DOUBLE] },
  {
    value: EVENT_TYPE.OPEN_DOUBLE,
    label: EVENT_TYPE_LABELS[EVENT_TYPE.OPEN_DOUBLE],
    description: EVENT_TYPE_DESCRIPTIONS[EVENT_TYPE.OPEN_DOUBLE],
  },
];

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
