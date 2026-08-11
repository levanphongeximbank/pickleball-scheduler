/**
 * Option-level lineup Select filtering (UX).
 * Does NOT change validateLineupSelections — participation invariants stay there.
 *
 * Sibling same-discipline slots cannot double-pick the same athlete.
 * MLP4: each athlete may appear in exactly one same-gender + one mixed (total 2).
 */

import { GENDER_REQUIREMENT } from "../constants.js";
import { getActiveMatchDisciplines, isMlpFormat } from "./mlpPresetEngine.js";
import { filterEligiblePlayersForDiscipline } from "./lineupValidationEngine.js";

/**
 * Participation counts excluding one slot (so current Select still sees itself).
 * @param {object} teamData
 * @param {Record<string, string[]>} selections
 * @param {string} excludeDisciplineId
 * @param {number} excludeSlotIndex
 * @returns {Map<string, { total: number, sameGender: number, mixed: number }>}
 */
export function summarizeMlpParticipationExcludingSlot(
  teamData,
  selections = {},
  excludeDisciplineId = "",
  excludeSlotIndex = -1
) {
  const active = getActiveMatchDisciplines(teamData?.disciplines || []);
  const byPlayer = new Map();
  const excludeDisc = String(excludeDisciplineId || "");

  for (const discipline of active) {
    const ids = selections[discipline.id] || [];
    const kind =
      discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
        ? "mixed"
        : "sameGender";
    for (let index = 0; index < ids.length; index += 1) {
      if (
        String(discipline.id) === excludeDisc &&
        Number(index) === Number(excludeSlotIndex)
      ) {
        continue;
      }
      const id = String(ids[index] || "").trim();
      if (!id) continue;
      const row = byPlayer.get(id) || { total: 0, sameGender: 0, mixed: 0 };
      row.total += 1;
      row[kind] += 1;
      byPlayer.set(id, row);
    }
  }

  return byPlayer;
}

function buildUsedOutsideDiscipline(selections = {}, disciplineId) {
  const used = new Set();
  const exclude = String(disciplineId || "");
  for (const [id, playerIds] of Object.entries(selections || {})) {
    if (String(id) === exclude) continue;
    for (const raw of playerIds || []) {
      const playerId = String(raw || "").trim();
      if (playerId) used.add(playerId);
    }
  }
  return used;
}

/**
 * Eligible athletes for one lineup Select, with sibling + MLP participation filters.
 * @param {object} args
 * @returns {object[]}
 */
export function filterEligiblePlayersForLineupSlot({
  team,
  discipline,
  players = [],
  selections = {},
  slotIndex = 0,
  allowReuse = false,
  teamData = null,
} = {}) {
  const usedPlayerIds = allowReuse
    ? new Set()
    : buildUsedOutsideDiscipline(selections, discipline?.id);

  let eligible = filterEligiblePlayersForDiscipline({
    team,
    discipline,
    players,
    usedPlayerIds,
    allowReuse,
    slotIndex,
  });

  const siblingSelected = new Set(
    (selections[discipline?.id] || [])
      .map((id, index) =>
        Number(index) === Number(slotIndex) ? "" : String(id || "").trim()
      )
      .filter(Boolean)
  );
  eligible = eligible.filter((player) => !siblingSelected.has(String(player.id)));

  if (teamData && isMlpFormat(teamData)) {
    const counts = summarizeMlpParticipationExcludingSlot(
      teamData,
      selections,
      discipline?.id,
      slotIndex
    );
    const kind =
      discipline?.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
        ? "mixed"
        : "sameGender";
    eligible = eligible.filter((player) => {
      const row = counts.get(String(player.id)) || {
        total: 0,
        sameGender: 0,
        mixed: 0,
      };
      if (row.total >= 2) return false;
      if (kind === "sameGender" && row.sameGender >= 1) return false;
      if (kind === "mixed" && row.mixed >= 1) return false;
      return true;
    });
  }

  return eligible;
}
