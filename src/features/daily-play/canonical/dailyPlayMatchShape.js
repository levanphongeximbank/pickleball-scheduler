/**
 * Canonical Daily Play match-type shape authority.
 * UI, engine, in-memory RPC, and SQL must use the same player/team counts.
 * `auto` is a pairing strategy, not a match shape and not open_double.
 */

export const DAILY_MATCH_TYPE = Object.freeze({
  MEN_SINGLE: "men_single",
  WOMEN_SINGLE: "women_single",
  MEN_DOUBLE: "men_double",
  WOMEN_DOUBLE: "women_double",
  MIXED_DOUBLE: "mixed_double",
  OPEN_DOUBLE: "open_double",
  AUTO: "auto",
});

export const DAILY_MATCH_TYPE_LABELS = Object.freeze({
  [DAILY_MATCH_TYPE.MEN_SINGLE]: "Đơn nam",
  [DAILY_MATCH_TYPE.WOMEN_SINGLE]: "Đơn nữ",
  [DAILY_MATCH_TYPE.MEN_DOUBLE]: "Đôi nam",
  [DAILY_MATCH_TYPE.WOMEN_DOUBLE]: "Đôi nữ",
  [DAILY_MATCH_TYPE.MIXED_DOUBLE]: "Đôi nam nữ",
  [DAILY_MATCH_TYPE.OPEN_DOUBLE]: "Đôi tự do",
  [DAILY_MATCH_TYPE.AUTO]: "Tự động",
});

export const DAILY_MATCH_TYPE_OPTIONS = Object.freeze([
  { value: DAILY_MATCH_TYPE.MEN_SINGLE, label: DAILY_MATCH_TYPE_LABELS[DAILY_MATCH_TYPE.MEN_SINGLE] },
  { value: DAILY_MATCH_TYPE.WOMEN_SINGLE, label: DAILY_MATCH_TYPE_LABELS[DAILY_MATCH_TYPE.WOMEN_SINGLE] },
  { value: DAILY_MATCH_TYPE.MEN_DOUBLE, label: DAILY_MATCH_TYPE_LABELS[DAILY_MATCH_TYPE.MEN_DOUBLE] },
  { value: DAILY_MATCH_TYPE.WOMEN_DOUBLE, label: DAILY_MATCH_TYPE_LABELS[DAILY_MATCH_TYPE.WOMEN_DOUBLE] },
  { value: DAILY_MATCH_TYPE.MIXED_DOUBLE, label: DAILY_MATCH_TYPE_LABELS[DAILY_MATCH_TYPE.MIXED_DOUBLE] },
  { value: DAILY_MATCH_TYPE.OPEN_DOUBLE, label: DAILY_MATCH_TYPE_LABELS[DAILY_MATCH_TYPE.OPEN_DOUBLE] },
  { value: DAILY_MATCH_TYPE.AUTO, label: DAILY_MATCH_TYPE_LABELS[DAILY_MATCH_TYPE.AUTO] },
]);

const SHAPES = Object.freeze({
  [DAILY_MATCH_TYPE.MEN_SINGLE]: Object.freeze({
    matchType: DAILY_MATCH_TYPE.MEN_SINGLE,
    playersPerMatch: 2,
    teamSize: 1,
    genderComposition: "male",
    competitionType: "singles_men",
    kind: "singles",
  }),
  [DAILY_MATCH_TYPE.WOMEN_SINGLE]: Object.freeze({
    matchType: DAILY_MATCH_TYPE.WOMEN_SINGLE,
    playersPerMatch: 2,
    teamSize: 1,
    genderComposition: "female",
    competitionType: "singles_women",
    kind: "singles",
  }),
  [DAILY_MATCH_TYPE.MEN_DOUBLE]: Object.freeze({
    matchType: DAILY_MATCH_TYPE.MEN_DOUBLE,
    playersPerMatch: 4,
    teamSize: 2,
    genderComposition: "male",
    competitionType: "doubles_men",
    kind: "doubles",
  }),
  [DAILY_MATCH_TYPE.WOMEN_DOUBLE]: Object.freeze({
    matchType: DAILY_MATCH_TYPE.WOMEN_DOUBLE,
    playersPerMatch: 4,
    teamSize: 2,
    genderComposition: "female",
    competitionType: "doubles_women",
    kind: "doubles",
  }),
  [DAILY_MATCH_TYPE.MIXED_DOUBLE]: Object.freeze({
    matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    playersPerMatch: 4,
    teamSize: 2,
    genderComposition: "mixed",
    competitionType: "doubles_mixed",
    kind: "doubles",
  }),
  [DAILY_MATCH_TYPE.OPEN_DOUBLE]: Object.freeze({
    matchType: DAILY_MATCH_TYPE.OPEN_DOUBLE,
    playersPerMatch: 4,
    teamSize: 2,
    genderComposition: "open",
    competitionType: "open",
    kind: "doubles",
  }),
  [DAILY_MATCH_TYPE.AUTO]: Object.freeze({
    matchType: DAILY_MATCH_TYPE.AUTO,
    playersPerMatch: 4,
    teamSize: 2,
    genderComposition: "auto",
    competitionType: null,
    kind: "auto",
    resolvedDynamically: true,
  }),
});

const COMPETITION_TO_DAILY = Object.freeze({
  singles_men: DAILY_MATCH_TYPE.MEN_SINGLE,
  singles_women: DAILY_MATCH_TYPE.WOMEN_SINGLE,
  doubles_men: DAILY_MATCH_TYPE.MEN_DOUBLE,
  doubles_women: DAILY_MATCH_TYPE.WOMEN_DOUBLE,
  doubles_mixed: DAILY_MATCH_TYPE.MIXED_DOUBLE,
  open: DAILY_MATCH_TYPE.OPEN_DOUBLE,
});

const DEFAULT_SHAPE = SHAPES[DAILY_MATCH_TYPE.MIXED_DOUBLE];

export function normalizeDailyMatchType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (SHAPES[raw]) return raw;
  if (COMPETITION_TO_DAILY[raw]) return COMPETITION_TO_DAILY[raw];
  return DAILY_MATCH_TYPE.MIXED_DOUBLE;
}

export function getDailyMatchShape(matchType) {
  const normalized = String(matchType || "").trim().toLowerCase();
  if (SHAPES[normalized]) return SHAPES[normalized];
  const fromCompetition = COMPETITION_TO_DAILY[normalized];
  if (fromCompetition) return SHAPES[fromCompetition];
  return DEFAULT_SHAPE;
}

export function resolveDailyMatchTypeFromMatch(match = {}) {
  const explicit = String(match.matchType || match.dailyMatchType || "").trim().toLowerCase();
  if (SHAPES[explicit]) return explicit;
  const competition = String(match.competitionType || "").trim().toLowerCase();
  if (COMPETITION_TO_DAILY[competition]) return COMPETITION_TO_DAILY[competition];
  return DAILY_MATCH_TYPE.MIXED_DOUBLE;
}

export function getDailyMatchShapeForMatch(match = {}, fallbackMatchType) {
  const fromMatch = String(match.matchType || match.dailyMatchType || "").trim().toLowerCase();
  if (SHAPES[fromMatch]) return SHAPES[fromMatch];
  const competition = String(match.competitionType || "").trim().toLowerCase();
  if (COMPETITION_TO_DAILY[competition]) return SHAPES[COMPETITION_TO_DAILY[competition]];
  if (fallbackMatchType) return getDailyMatchShape(fallbackMatchType);
  return DEFAULT_SHAPE;
}

export function dailyMatchTypeToCompetitionType(matchType, fallbackPlayers = []) {
  const shape = getDailyMatchShape(matchType);
  if (shape.kind === "auto") {
    return null;
  }
  void fallbackPlayers;
  return shape.competitionType;
}

export function isDailySinglesMatchType(matchType) {
  return getDailyMatchShape(matchType).kind === "singles";
}

export function isDailyOpenDoubleMatchType(matchType) {
  return normalizeDailyMatchType(matchType) === DAILY_MATCH_TYPE.OPEN_DOUBLE;
}

export function isDailyAutoMatchType(matchType) {
  return String(matchType || "").trim().toLowerCase() === DAILY_MATCH_TYPE.AUTO;
}
