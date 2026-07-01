export const PLAY_MODE = Object.freeze({
  SINGLES: "singles",
  DOUBLES: "doubles",
  MIXED_DOUBLES: "mixed_doubles",
  SOCIAL_RANDOM: "social_random",
  BALANCED: "balanced",
  COMPETITIVE: "competitive",
});

export const PLAYERS_PER_MATCH = Object.freeze({
  [PLAY_MODE.SINGLES]: 2,
  [PLAY_MODE.DOUBLES]: 4,
  [PLAY_MODE.MIXED_DOUBLES]: 4,
  [PLAY_MODE.SOCIAL_RANDOM]: 4,
  [PLAY_MODE.BALANCED]: 4,
  [PLAY_MODE.COMPETITIVE]: 4,
});

export function getDefaultSessionConfig() {
  return {
    playMode: PLAY_MODE.DOUBLES,
    defaultMatchMinutes: 20,
    overrunWarningMinutes: 5,
    useReferees: true,
    autoSuggestNext: true,
    avoidPartnerRepeat: true,
    avoidOpponentRepeat: true,
    maxLevelDiff: 0.5,
    allowManualOverride: true,
  };
}
