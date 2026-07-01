export const QR_ENTITY_TYPES = Object.freeze({
  PLAYER: "player",
  TEAM: "team",
  TOURNAMENT_TICKET: "tournament_ticket",
  REFEREE: "referee",
  COURT: "court",
  MATCH: "match",
});

export const QR_ENTITY_LABELS = Object.freeze({
  [QR_ENTITY_TYPES.PLAYER]: "Người chơi",
  [QR_ENTITY_TYPES.TEAM]: "Cặp đấu / Đội",
  [QR_ENTITY_TYPES.TOURNAMENT_TICKET]: "Vé giải đấu",
  [QR_ENTITY_TYPES.REFEREE]: "Trọng tài",
  [QR_ENTITY_TYPES.COURT]: "Sân thi đấu",
  [QR_ENTITY_TYPES.MATCH]: "Trận đấu",
});

/** Default token TTL in hours. */
export const QR_TOKEN_DEFAULT_TTL_HOURS = 24;

/** QR payload prefix — token only, no PII. */
export const QR_PAYLOAD_PREFIX = "pbs://checkin/";
