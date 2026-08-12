/**
 * Preview-only Save/Submit boundary diagnostics for ?ttLineupDebug=1.
 * No email / phone / private profile fields. Does not change validation outcomes.
 */

import { getPlayerGenderKey } from "../../../models/player.js";

/** TT412-SEED-F04 athlete id from owner real-browser report. */
export const TT412_F04_ATHLETE_ID = "c412a101-7e57-4000-8000-00000000000c";

let lastBoundary = null;
let activeProbe = null;

function safePlayerRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id || null,
    athleteId: row.athleteId || row.pairingIdentityId || null,
    displayName: row.displayName || row.name || null,
    gender: row.gender ?? null,
    genderSource: row.genderSource || null,
  };
}

export function getCaptainLineupSaveBoundary() {
  return lastBoundary;
}

export function clearCaptainLineupSaveBoundary() {
  lastBoundary = null;
  activeProbe = null;
}

/**
 * @param {{ focusAthleteId?: string|null }} [opts]
 */
export function beginLineupValidationProbe(opts = {}) {
  activeProbe = {
    focusAthleteId: String(opts.focusAthleteId || TT412_F04_ATHLETE_ID).trim(),
    playerMapLookups: [],
    focus: {
      F04_PLAYERMAP_FOUND: false,
      F04_PLAYERMAP_ID: null,
      F04_PLAYERMAP_ATHLETE_ID: null,
      F04_PLAYERMAP_GENDER: null,
      F04_PLAYERMAP_DISPLAY_NAME: null,
      F04_FINAL_GENDER_KEY: null,
    },
  };
  return activeProbe;
}

export function notePlayerMapLookup(key, player) {
  if (!activeProbe) return;
  const id = String(key || "").trim();
  const focus = activeProbe.focusAthleteId;
  const row = safePlayerRow(player);
  activeProbe.playerMapLookups.push({ key: id, found: Boolean(row), player: row });
  if (id === focus || String(row?.athleteId || "") === focus || String(row?.id || "") === focus) {
    activeProbe.focus = {
      F04_PLAYERMAP_FOUND: Boolean(row),
      F04_PLAYERMAP_ID: row?.id || null,
      F04_PLAYERMAP_ATHLETE_ID: row?.athleteId || null,
      F04_PLAYERMAP_GENDER: row?.gender ?? null,
      F04_PLAYERMAP_DISPLAY_NAME: row?.displayName || null,
      F04_FINAL_GENDER_KEY: row ? getPlayerGenderKey(row) : null,
    };
  }
}

export function endLineupValidationProbe() {
  const probe = activeProbe;
  activeProbe = null;
  return probe;
}

/**
 * Record one Save Draft / Submit attempt boundary.
 * @param {object} partial
 */
export function recordCaptainLineupSaveBoundary(partial = {}) {
  lastBoundary = {
    recordedAt: new Date().toISOString(),
    ...lastBoundary,
    ...partial,
  };
  return lastBoundary;
}

/**
 * Build safe pre-validation snapshot for debug panel.
 */
export function buildPreValidationSnapshot({
  action,
  team,
  teamId,
  selections,
  validationPlayers,
  focusAthleteId = TT412_F04_ATHLETE_ID,
} = {}) {
  const focus = String(focusAthleteId || "").trim();
  const players = (validationPlayers || []).map(safePlayerRow).filter(Boolean);
  const focusPlayer = players.find(
    (row) =>
      String(row.id || "") === focus ||
      String(row.athleteId || "") === focus
  );
  const selectedIds = Object.values(selections || {})
    .flat()
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  return {
    LAST_ACTION: action || null,
    TEAM_ID: String(teamId || team?.id || "").trim() || null,
    TEAM_PLAYER_IDS: Array.isArray(team?.playerIds)
      ? team.playerIds.map(String)
      : [],
    SELECTIONS: selections || {},
    VALIDATION_PLAYERS: players,
    F04_SELECTED_ID: selectedIds.includes(focus) ? focus : null,
    F04_VALIDATION_PLAYER_FOUND: Boolean(focusPlayer),
    F04_VALIDATION_PLAYER_GENDER: focusPlayer?.gender ?? null,
    F04_VALIDATION_GENDER_SOURCE: focusPlayer?.genderSource || null,
  };
}
