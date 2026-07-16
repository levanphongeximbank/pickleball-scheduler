/**
 * P1.5A Showcase — pure state machine (presentation only).
 * Does not call engines or persistence; callers inject fixed session.
 */

import { SHOWCASE_MODE, SHOWCASE_STAGE } from "./showcaseConstants.js";

export function createInitialShowcaseState(overrides = {}) {
  return {
    open: false,
    mode: SHOWCASE_MODE.LIVE,
    stage: SHOWCASE_STAGE.IDLE,
    projector: false,
    paused: false,
    soundEnabled: false,
    reducedMotion: false,
    countdownValue: 10,
    processingIndex: 0,
    teamRevealIndex: 0,
    athleteRevealIndex: 0,
    groupRevealIndex: 0,
    session: null,
    preflight: null,
    setupConfig: {
      teamCount: 8,
      groupCount: 2,
      selectedAthleteIds: [],
    },
    saveError: null,
    saving: false,
    savedAt: null,
    idempotencyKey: null,
    ...overrides,
  };
}

/**
 * @param {object} state
 * @param {{ type: string, payload?: any }} action
 */
export function reduceShowcaseState(state, action) {
  const type = action?.type;
  const payload = action?.payload;

  switch (type) {
    case "OPEN_LIVE":
      return {
        ...createInitialShowcaseState(),
        open: true,
        mode: SHOWCASE_MODE.LIVE,
        stage: SHOWCASE_STAGE.SETUP,
        preflight: payload?.preflight || null,
        setupConfig: {
          teamCount: Number(payload?.setupConfig?.teamCount) || 8,
          groupCount: Number(payload?.setupConfig?.groupCount) || 2,
          selectedAthleteIds: Array.isArray(payload?.setupConfig?.selectedAthleteIds)
            ? payload.setupConfig.selectedAthleteIds.map(String)
            : [],
        },
        reducedMotion: Boolean(payload?.reducedMotion),
        projector: Boolean(payload?.projector),
      };

    case "OPEN_REPLAY":
      return {
        ...createInitialShowcaseState(),
        open: true,
        mode: SHOWCASE_MODE.REPLAY,
        stage: payload?.stage || SHOWCASE_STAGE.TEAM_REVEAL,
        session: payload?.session || null,
        preflight: payload?.preflight || null,
        reducedMotion: Boolean(payload?.reducedMotion),
        projector: Boolean(payload?.projector),
        savedAt: payload?.savedAt || null,
      };

    case "CLOSE":
      return createInitialShowcaseState({ reducedMotion: state.reducedMotion });

    case "SET_PREFLIGHT":
      return { ...state, preflight: payload };

    case "SET_SETUP_CONFIG":
      return {
        ...state,
        setupConfig: {
          ...state.setupConfig,
          ...(payload || {}),
        },
      };

    case "SET_SESSION":
      return { ...state, session: payload };

    case "GO_STAGE":
      return {
        ...state,
        stage: payload.stage,
        paused: false,
        saveError: payload.clearError ? null : state.saveError,
        countdownValue:
          payload.stage === SHOWCASE_STAGE.COUNTDOWN
            ? payload.countdownValue ?? 10
            : state.countdownValue,
        processingIndex:
          payload.stage === SHOWCASE_STAGE.PROCESSING ? 0 : state.processingIndex,
        teamRevealIndex:
          payload.stage === SHOWCASE_STAGE.TEAM_REVEAL
            ? payload.teamRevealIndex ?? 0
            : state.teamRevealIndex,
        athleteRevealIndex:
          payload.stage === SHOWCASE_STAGE.TEAM_REVEAL
            ? payload.athleteRevealIndex ?? 0
            : state.athleteRevealIndex,
        groupRevealIndex:
          payload.stage === SHOWCASE_STAGE.GROUP_REVEAL
            ? payload.groupRevealIndex ?? 0
            : state.groupRevealIndex,
      };

    case "SET_COUNTDOWN":
      return { ...state, countdownValue: Number(payload) };

    case "SET_PROCESSING_INDEX":
      return { ...state, processingIndex: Number(payload) };

    case "SET_TEAM_REVEAL":
      return {
        ...state,
        teamRevealIndex: Number(payload.teamRevealIndex ?? state.teamRevealIndex),
        athleteRevealIndex: Number(
          payload.athleteRevealIndex ?? state.athleteRevealIndex
        ),
      };

    case "SET_GROUP_REVEAL":
      return { ...state, groupRevealIndex: Number(payload) };

    case "PAUSE":
      return { ...state, paused: true };

    case "RESUME":
      return { ...state, paused: false };

    case "TOGGLE_PAUSE":
      return { ...state, paused: !state.paused };

    case "SET_PROJECTOR":
      return { ...state, projector: Boolean(payload) };

    case "TOGGLE_SOUND":
      return { ...state, soundEnabled: !state.soundEnabled };

    case "SET_SOUND":
      return { ...state, soundEnabled: Boolean(payload) };

    case "SET_REDUCED_MOTION":
      return { ...state, reducedMotion: Boolean(payload) };

    case "BEGIN_SAVE":
      return {
        ...state,
        stage: SHOWCASE_STAGE.SAVING,
        saving: true,
        saveError: null,
        idempotencyKey: state.idempotencyKey || payload?.idempotencyKey || null,
      };

    case "SAVE_FAILED":
      return {
        ...state,
        stage: SHOWCASE_STAGE.FINAL_REVIEW,
        saving: false,
        saveError: payload?.error || "Lưu thất bại.",
      };

    case "SAVE_SUCCEEDED":
      return {
        ...state,
        stage: SHOWCASE_STAGE.RESULTS,
        saving: false,
        saveError: null,
        savedAt: payload?.savedAt || new Date().toISOString(),
        session: payload?.session || state.session,
      };

    default:
      return state;
  }
}

export function showcaseAllowsCancel(state) {
  if (state.mode === SHOWCASE_MODE.REPLAY) return true;
  return (
    state.stage === SHOWCASE_STAGE.SETUP ||
    state.stage === SHOWCASE_STAGE.PREFLIGHT ||
    state.stage === SHOWCASE_STAGE.COUNTDOWN ||
    state.stage === SHOWCASE_STAGE.PROCESSING
  );
}

export function showcaseResultIsLocked(state) {
  return Boolean(state.session?.teamCards?.length) &&
    [
      SHOWCASE_STAGE.TEAM_REVEAL,
      SHOWCASE_STAGE.CAPTAIN_REVEAL,
      SHOWCASE_STAGE.GROUP_FORMAT,
      SHOWCASE_STAGE.GROUP_REVEAL,
      SHOWCASE_STAGE.FINAL_REVIEW,
      SHOWCASE_STAGE.SAVING,
      SHOWCASE_STAGE.RESULTS,
    ].includes(state.stage);
}

export function createShowcaseIdempotencyKey(tournamentId) {
  return `showcase-${String(tournamentId || "unknown")}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
