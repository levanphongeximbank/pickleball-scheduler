/**
 * Build a presentation-only reveal session from AI pairing engine output.
 * Does not re-run engines; only annotates frozen teams with athlete display names.
 */

import {
  athleteGenderDisplayLabel,
  normalizeAthleteGender,
} from "../../../models/player.js";
import { resolveCanonicalAthleteRating } from "../../pairing-candidates/canonicalAthleteRating.js";

function playerRating(player) {
  const canonical = resolveCanonicalAthleteRating(player);
  if (Number.isFinite(canonical?.ratingValue) && canonical.ratingValue > 0) {
    return canonical.ratingValue;
  }
  const legacy = Number(player?.rating ?? player?.level ?? player?.ratingValue);
  return Number.isFinite(legacy) ? legacy : 0;
}

function athleteDisplayName(player, id) {
  const name = String(player?.name || player?.displayName || "").trim();
  if (name) return name;
  return `VĐV ${String(id)}`;
}

/**
 * @param {{ teams?: Array, players?: Array }} params
 * @returns {{ ok: boolean, error?: string, session?: { teamCards: Array, membershipFingerprint: string } }}
 */
export function buildAiPairingRevealSession({ teams = [], players = [] } = {}) {
  if (!Array.isArray(teams) || !teams.length) {
    return { ok: false, error: "Chưa có kết quả đội để trình chiếu." };
  }

  const playersById = new Map(
    (players || []).map((player) => [String(player.id || player.athleteId || ""), player])
  );

  const teamCards = teams.map((team, index) => {
    const athletes = (team.playerIds || []).map((rawId) => {
      const id = String(rawId);
      const player = playersById.get(id) || { id };
      const genderKey = normalizeAthleteGender(player);
      const rating = resolveCanonicalAthleteRating(player);
      return {
        id,
        name: athleteDisplayName(player, id),
        avatarUrl: String(
          player.avatarUrl ||
            player.avatar_url ||
            player.photoUrl ||
            player.photo_url ||
            player.imageUrl ||
            ""
        ).trim(),
        gender: genderKey,
        genderLabel: athleteGenderDisplayLabel(player),
        ratingValue: rating.ratingValue ?? playerRating(player),
        ratingSource: rating.ratingSource || player.ratingSource || "legacy",
        isCaptain: String(team.captainPlayerId || "") === id,
      };
    });

    const maleCount = athletes.filter((a) => a.gender === "male").length;
    const femaleCount = athletes.filter((a) => a.gender === "female").length;
    const avg =
      athletes.length > 0
        ? Math.round(
            (athletes.reduce((sum, a) => sum + (a.ratingValue || 0), 0) /
              athletes.length) *
              100
          ) / 100
        : Number(team.avgLevel) || 0;

    return {
      index,
      id: team.id || `team-${index + 1}`,
      name: team.name || `Đội ${index + 1}`,
      seed: team.seed || index + 1,
      avgLevel: avg,
      captainPlayerId: team.captainPlayerId || "",
      athletes,
      genderOk: maleCount === 2 && femaleCount === 2,
      maleCount,
      femaleCount,
      balanced: Boolean(team.avgLevel != null) || athletes.length > 0,
    };
  });

  const missingNames = teamCards.some((team) =>
    (team.athletes || []).some((athlete) => !String(athlete.name || "").trim())
  );
  if (missingNames) {
    return { ok: false, error: "Thiếu tên vận động viên — không thể trình chiếu." };
  }

  const membershipFingerprint = JSON.stringify(
    teamCards.map((team) => ({
      id: String(team.id),
      playerIds: (team.athletes || []).map((a) => String(a.id)).sort(),
    }))
  );

  return {
    ok: true,
    session: {
      teamCards,
      membershipFingerprint,
      engineRunCount: 1,
    },
  };
}
