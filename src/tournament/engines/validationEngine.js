import { getPlayerGenderKey } from "../../models/player.js";
import {
  EVENT_TYPE,
  OFFICIAL_MODE,
  TOURNAMENT_MODE,
} from "../../models/tournament/constants.js";
import { evaluateLegacyTournamentDrawValidation } from "../../features/competition-core/constraints/adapters/constraintsEvaluationBridge.js";

const EVENT_PLAYER_COUNTS = {
  [EVENT_TYPE.MEN_SINGLE]: 1,
  [EVENT_TYPE.WOMEN_SINGLE]: 1,
  [EVENT_TYPE.MEN_DOUBLE]: 2,
  [EVENT_TYPE.WOMEN_DOUBLE]: 2,
  [EVENT_TYPE.MIXED_DOUBLE]: 2,
  [EVENT_TYPE.OPEN_DOUBLE]: 2,
};

function playerMap(players = []) {
  return new Map(players.map((player) => [String(player.id), player]));
}

function validateEntryGender(entry, playersById, eventType) {
  const members = entry.playerIds
    .map((id) => playersById.get(String(id)))
    .filter(Boolean);

  if (members.length !== entry.playerIds.length) {
    return "Co VDV khong ton tai trong danh sach.";
  }

  if (eventType === EVENT_TYPE.MEN_SINGLE) {
    return members.every((p) => getPlayerGenderKey(p.gender) === "male")
      ? null
      : "Don nam can VDV nam.";
  }

  if (eventType === EVENT_TYPE.WOMEN_SINGLE) {
    return members.every((p) => getPlayerGenderKey(p.gender) === "female")
      ? null
      : "Don nu can VDV nu.";
  }

  if (eventType === EVENT_TYPE.MEN_DOUBLE) {
    return members.length === 2 &&
      members.every((p) => getPlayerGenderKey(p.gender) === "male")
      ? null
      : "Doi nam can 2 VDV nam.";
  }

  if (eventType === EVENT_TYPE.WOMEN_DOUBLE) {
    return members.length === 2 &&
      members.every((p) => getPlayerGenderKey(p.gender) === "female")
      ? null
      : "Doi nu can 2 VDV nu.";
  }

  if (eventType === EVENT_TYPE.MIXED_DOUBLE) {
    const males = members.filter((p) => getPlayerGenderKey(p.gender) === "male");
    const females = members.filter((p) => getPlayerGenderKey(p.gender) === "female");
    return members.length === 2 && males.length === 1 && females.length === 1
      ? null
      : "Doi nam nu can 1 nam + 1 nu.";
  }

  if (eventType === EVENT_TYPE.OPEN_DOUBLE) {
    return members.length === 2 ? null : "Doi tu do can dung 2 VDV.";
  }

  return null;
}

export function validateEntryForEvent(entry, players = [], eventType) {
  const errors = [];
  const expectedCount = EVENT_PLAYER_COUNTS[eventType] || 2;
  const playerIds = entry.playerIds || [];

  if (playerIds.length !== expectedCount) {
    errors.push(
      `Doi "${entry.name}" can ${expectedCount} VDV cho noi dung nay.`
    );
  }

  const genderError = validateEntryGender(entry, playerMap(players), eventType);
  if (genderError) {
    errors.push(`${entry.name}: ${genderError}`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateNoDuplicatePlayersInEvent(entries = []) {
  const seen = new Map();
  const errors = [];

  entries.forEach((entry) => {
    (entry.playerIds || []).forEach((playerId) => {
      const key = String(playerId);
      if (seen.has(key)) {
        errors.push(
          `VDV ${key} nam trong nhieu doi (${seen.get(key)} va ${entry.name}).`
        );
        return;
      }
      seen.set(key, entry.name);
    });
  });

  return {
    ok: errors.length === 0,
    errors,
  };
}

function validateGroupDrawInputLegacy({
  entries = [],
  players = [],
  eventType,
  groupCount = 1,
  courtCount = 1,
  tournamentMode,
  officialMode,
} = {}) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(entries) || entries.length < 2) {
    errors.push("Can it nhat 2 doi/VDV de chia bang.");
  }

  if (groupCount < 1) {
    errors.push("So bang phai lon hon 0.");
  }

  if (groupCount > (entries.length || 0)) {
    errors.push("So bang khong duoc lon hon so doi/VDV.");
  }

  if (courtCount < 1) {
    errors.push("So san phai lon hon 0.");
  }

  const duplicateCheck = validateNoDuplicatePlayersInEvent(entries);
  if (!duplicateCheck.ok) {
    errors.push(...duplicateCheck.errors);
  }

  entries.forEach((entry) => {
    const entryCheck = validateEntryForEvent(entry, players, eventType);
    if (!entryCheck.ok) {
      errors.push(...entryCheck.errors);
    }
  });

  if (
    tournamentMode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT &&
    officialMode === OFFICIAL_MODE.AI_BALANCE
  ) {
    const missingRating = (players || []).filter(
      (player) => !Number.isFinite(Number(player.rating ?? player.level))
    );
    if (missingRating.length > 0) {
      warnings.push(
        `${missingRating.length} VDV chua co rating. BTC can nhap tam truoc khi chia bang.`
      );
    }
  }

  if (
    tournamentMode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT &&
    officialMode === OFFICIAL_MODE.OPEN
  ) {
    const clubCounts = entries.reduce((acc, entry) => {
      const club = entry.clubName || entry.representativeClubName || "Khong ro CLB";
      acc[club] = (acc[club] || 0) + 1;
      return acc;
    }, {});

    Object.entries(clubCounts).forEach(([club, count]) => {
      if (count > groupCount * 2) {
        warnings.push(
          `Khong the tach deu ${club} vi so luong cap cua CLB nay qua nhieu so voi so bang. App da phan bo deu nhat co the.`
        );
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateGroupDrawInput(input = {}, options = {}) {
  const legacy = validateGroupDrawInputLegacy(input);
  const bridge = evaluateLegacyTournamentDrawValidation(
    { ...input, legacyResult: legacy },
    options
  );

  if (!bridge.usedCanonical) {
    return legacy;
  }

  const { decisionTrace, ...result } = bridge.result || legacy;
  if (decisionTrace) {
    return { ...result, decisionTrace };
  }

  return result;
}

export function validateTournamentActivation(tournament, courts = []) {
  const activeCourts = (courts || []).filter((court) => court.active !== false);

  if (activeCourts.length < 1) {
    return {
      ok: false,
      errors: ["Can it nhat 1 san hoat dong de dieu hanh giai."],
      warnings: [],
    };
  }

  return { ok: true, errors: [], warnings: [] };
}
