/*
==========================================================
AI Normalize Layer
Standardizes raw UI data into a consistent domain model.
==========================================================
*/

import {
  DEFAULT_COMPETITION_TYPE,
  getCompetitionTypeConfig,
  validateCompetitionSelection,
} from "./competition.js";
import {
  getCourtDisplayName,
  normalizeCourt,
  normalizePlayer,
} from "../models/index.js";

export function validateScheduleInput(input = {}) {
  const errors = [];
  const competitionType = input.competitionType || DEFAULT_COMPETITION_TYPE;
  const competition = getCompetitionTypeConfig(competitionType);

  const selectedPlayers = Array.isArray(input.players) ? input.players : [];
  const selectedCourtCount = Array.isArray(input.selectedCourtIds)
    ? input.selectedCourtIds.length
    : 0;
  const competitionValidation = validateCompetitionSelection(selectedPlayers, competitionType, {
    selectedCourtCount,
  });

  if (!Array.isArray(input.players) || input.players.length < competition.minPlayers) {
    errors.push(`players: cần ít nhất ${competition.minPlayers} người chơi để xếp sân.`);
  }

  if (!Array.isArray(input.courts) || input.courts.length < 1) {
    errors.push("courts: cần ít nhất 1 sân để xếp sân.");
  }

  if (!Array.isArray(input.selectedPlayerIds) || input.selectedPlayerIds.length < competition.minPlayers) {
    errors.push("players: danh sách người được chọn không hợp lệ.");
  }

  if (!Array.isArray(input.selectedCourtIds) || input.selectedCourtIds.length < 1) {
    errors.push("courts: danh sách sân được chọn không hợp lệ.");
  }

  competitionValidation.errors.forEach((error) => {
    errors.push(`competition: ${error}`);
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function normalizeScheduleInput(input = {}) {
  const competitionType = input.competitionType || DEFAULT_COMPETITION_TYPE;
  const competition = getCompetitionTypeConfig(competitionType);
  const players = (input.players || [])
    .filter(Boolean)
    .map((player, index) => normalizePlayer(player, index))
    .filter(Boolean);

  const courts = (input.courts || [])
    .filter(Boolean)
    .map((court, index) => {
      const normalized = normalizeCourt(court, index);
      return {
        ...normalized,
        name: getCourtDisplayName(normalized, index),
      };
    });

  const selectedPlayerIds = Array.isArray(input.selectedPlayerIds)
    ? input.selectedPlayerIds
    : players.map((player) => player.id);

  const selectedCourtIds = Array.isArray(input.selectedCourtIds)
    ? input.selectedCourtIds
    : courts.map((court) => court.id);

  const lockedCourts = Array.isArray(input.lockedCourts)
    ? input.lockedCourts
    : [];

  const lockedPlayers = Array.isArray(input.lockedPlayers)
    ? input.lockedPlayers
    : [];

  return {
    players,
    courts,
    selectedPlayerIds,
    selectedCourtIds,
    lockedCourts,
    lockedPlayers,
    competitionType,
    competition,
  };
}
