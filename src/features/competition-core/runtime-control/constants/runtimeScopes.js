/**
 * Phase 3A.1 — Runtime Control Plane scopes and capabilities.
 * Pure constants — no I/O.
 */

export const RUNTIME_SCOPE = Object.freeze({
  GLOBAL: "GLOBAL",
  CAPABILITY: "CAPABILITY",
  FORMAT: "FORMAT",
  TENANT: "TENANT",
  COMPETITION: "COMPETITION",
});

export const RUNTIME_SCOPE_VALUES = Object.freeze(Object.values(RUNTIME_SCOPE));

export function isRuntimeScope(value) {
  return RUNTIME_SCOPE_VALUES.includes(value);
}

export const RUNTIME_CAPABILITY = Object.freeze({
  PARTICIPANT: "PARTICIPANT",
  REGISTRATION: "REGISTRATION",
  ENTRY: "ENTRY",
  TEAM: "TEAM",
  ROSTER: "ROSTER",
  LINEUP: "LINEUP",
  SEEDING: "SEEDING",
  DRAW: "DRAW",
  PAIRING: "PAIRING",
  MATCH_GENERATION: "MATCH_GENERATION",
  SCHEDULE: "SCHEDULE",
  MATCH_LIFECYCLE: "MATCH_LIFECYCLE",
  SCORING: "SCORING",
  STANDINGS: "STANDINGS",
  PUBLICATION: "PUBLICATION",
});

export const RUNTIME_CAPABILITY_VALUES = Object.freeze(Object.values(RUNTIME_CAPABILITY));

export function isRuntimeCapability(value) {
  return RUNTIME_CAPABILITY_VALUES.includes(value);
}

/** Maps capability enum → flag snapshot key (camelCase). */
export const CAPABILITY_FLAG_KEY = Object.freeze({
  [RUNTIME_CAPABILITY.PARTICIPANT]: "participant",
  [RUNTIME_CAPABILITY.REGISTRATION]: "registration",
  [RUNTIME_CAPABILITY.ENTRY]: "entry",
  [RUNTIME_CAPABILITY.TEAM]: "team",
  [RUNTIME_CAPABILITY.ROSTER]: "roster",
  [RUNTIME_CAPABILITY.LINEUP]: "lineup",
  [RUNTIME_CAPABILITY.SEEDING]: "seeding",
  [RUNTIME_CAPABILITY.DRAW]: "draw",
  [RUNTIME_CAPABILITY.PAIRING]: "pairing",
  [RUNTIME_CAPABILITY.MATCH_GENERATION]: "matchGeneration",
  [RUNTIME_CAPABILITY.SCHEDULE]: "schedule",
  [RUNTIME_CAPABILITY.MATCH_LIFECYCLE]: "matchLifecycle",
  [RUNTIME_CAPABILITY.SCORING]: "scoring",
  [RUNTIME_CAPABILITY.STANDINGS]: "standings",
  [RUNTIME_CAPABILITY.PUBLICATION]: "publication",
});

export const RUNTIME_FORMAT = Object.freeze({
  TEAM_TOURNAMENT: "TEAM_TOURNAMENT",
  INDIVIDUAL_TOURNAMENT: "INDIVIDUAL_TOURNAMENT",
  DAILY_PLAY: "DAILY_PLAY",
  INTERNAL_TOURNAMENT: "INTERNAL_TOURNAMENT",
  OFFICIAL_TOURNAMENT: "OFFICIAL_TOURNAMENT",
});

export const RUNTIME_FORMAT_VALUES = Object.freeze(Object.values(RUNTIME_FORMAT));

export function isRuntimeFormat(value) {
  return RUNTIME_FORMAT_VALUES.includes(value);
}

/** Maps format enum → flag snapshot key (camelCase). */
export const FORMAT_FLAG_KEY = Object.freeze({
  [RUNTIME_FORMAT.TEAM_TOURNAMENT]: "teamTournament",
  [RUNTIME_FORMAT.INDIVIDUAL_TOURNAMENT]: "individualTournament",
  [RUNTIME_FORMAT.DAILY_PLAY]: "dailyPlay",
  [RUNTIME_FORMAT.INTERNAL_TOURNAMENT]: "internalTournament",
  [RUNTIME_FORMAT.OFFICIAL_TOURNAMENT]: "officialTournament",
});

export const RUNTIME_EXECUTOR = Object.freeze({
  LEGACY: "LEGACY",
});

export const RUNTIME_EXECUTOR_VALUES = Object.freeze(Object.values(RUNTIME_EXECUTOR));

export function isRuntimeExecutor(value) {
  return RUNTIME_EXECUTOR_VALUES.includes(value);
}

/** Phase 3A.1 control-plane contract version (not a Production enablement). */
export const RUNTIME_CONTROL_VERSION = "3a1.0";
