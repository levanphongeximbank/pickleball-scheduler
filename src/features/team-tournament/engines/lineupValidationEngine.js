import { getPlayerGenderKey } from "../../../models/player.js";
import {
  evaluateLegacyTeamLineupValidation,
  isRulesV2Enabled,
} from "../../competition-core/index.js";
import {
  DISCIPLINE_CATEGORY,
  GENDER_REQUIREMENT,
} from "../constants.js";
import { findTeam } from "../models/index.js";
import {
  getActiveMatchDisciplines,
  isMlpFormat,
} from "./mlpPresetEngine.js";
import {
  applyCanonicalMlpDisciplineMetadata,
  resolveMlpSlotGenderGate,
} from "./mlpDisciplineSlotContract.js";
import {
  LINEUP_VALIDATION_CODE,
  createLineupValidationResult,
  mergeValidationMessages,
  validationFailure,
  validationSuccess,
} from "./lineupValidationContract.js";
import {
  hydrateTeamRoster,
  hydratedMembersAsPlayers,
  buildRosterAthleteIndex,
  resolveRosterMemberIdentity,
} from "./teamRosterHydration.js";
import { resolveCaptainLineupAthletePool } from "./captainPortalRosterProjection.js";

function resolvePortalScopedLineupPlayers(args = {}) {
  return resolveCaptainLineupAthletePool({
    team: args.team,
    teamData: args.teamData,
    teamId: args.teamId,
  });
}

function captainRosterUnavailableResult() {
  return validationFailure(
    LINEUP_VALIDATION_CODE.CAPTAIN_ROSTER_UNAVAILABLE,
    "Danh sách VĐV đội trưởng (portal) chưa sẵn sàng. Không dùng pool CLB để xếp đội hình.",
    {
      ruleViolations: [
        {
          code: LINEUP_VALIDATION_CODE.CAPTAIN_ROSTER_UNAVAILABLE,
          message:
            "Danh sách VĐV đội trưởng (portal) chưa sẵn sàng. Không dùng pool CLB để xếp đội hình.",
        },
      ],
    }
  );
}

function asLineupPlayerRow(player, key) {
  if (!player || typeof player !== "object") return undefined;
  return {
    ...player,
    id: key || player.id || player.athleteId,
    athleteId: player.athleteId || player.pairingIdentityId || player.id || key || null,
    name: player.name || player.displayName || player.athleteId || key || "",
    displayName: player.displayName || player.name || "",
    gender: player.gender ?? player.sex ?? player.gioiTinh ?? player.gioi_tinh ?? null,
  };
}

function preferGenderedAthlete(primary, secondary) {
  if (primary && (getPlayerGenderKey(primary) === "male" || getPlayerGenderKey(primary) === "female")) {
    return primary;
  }
  if (
    secondary &&
    (getPlayerGenderKey(secondary) === "male" || getPlayerGenderKey(secondary) === "female")
  ) {
    return secondary;
  }
  return primary || secondary || null;
}

function playerMap(players = []) {
  const exact = new Map();
  for (const player of players || []) {
    if (!player || typeof player !== "object") continue;
    const id = String(player.id || "").trim();
    const athleteId = String(player.athleteId || player.pairingIdentityId || "").trim();
    if (id) exact.set(id, preferGenderedAthlete(exact.get(id), player) || player);
    if (athleteId) {
      exact.set(athleteId, preferGenderedAthlete(exact.get(athleteId), player) || player);
    }
  }
  const index = buildRosterAthleteIndex(players);
  return {
    get(id) {
      const key = String(id || "").trim();
      if (!key) return undefined;
      const resolved = resolveRosterMemberIdentity(key, index);
      const exactHit = exact.get(key);
      const athlete = preferGenderedAthlete(
        resolved.ok ? resolved.athlete : null,
        exactHit
      );
      if (!athlete) {
        return undefined;
      }
      const row = asLineupPlayerRow(
        {
          ...(exactHit || {}),
          ...athlete,
          id: key,
          athleteId:
            resolved.athleteId ||
            athlete.athleteId ||
            athlete.pairingIdentityId ||
            key,
        },
        key
      );
      return row;
    },
  };
}

function isPlayerAvailable(team, playerId) {
  const absent = new Set((team.absentPlayerIds || []).map(String));
  const locked = new Set((team.lockedPlayerIds || []).map(String));
  return !absent.has(String(playerId)) && !locked.has(String(playerId));
}

function pushFieldError(fieldErrors, key, message) {
  if (!fieldErrors[key]) {
    fieldErrors[key] = [];
  }
  fieldErrors[key].push(message);
}

function validateGenderRequirement(playerIds, playersById, requirement) {
  const members = playerIds
    .map((id) => playersById.get(String(id)))
    .filter(Boolean);

  if (members.length !== playerIds.length) {
    return {
      code: LINEUP_VALIDATION_CODE.PLAYER_NOT_ELIGIBLE,
      message: "Có VĐV không tồn tại trong danh sách.",
    };
  }

  for (const player of members) {
    const genderKey = getPlayerGenderKey(player);
    if (genderKey !== "male" && genderKey !== "female") {
      return {
        code: LINEUP_VALIDATION_CODE.INVALID_GENDER,
        message: `VĐV ${player.name || player.displayName || player.id} thiếu hoặc có giới tính không hợp lệ.`,
        invalidPlayerIds: [String(player.id)],
      };
    }
  }

  if (requirement === GENDER_REQUIREMENT.MALE) {
    const invalid = members.filter((player) => getPlayerGenderKey(player) !== "male");
    return invalid.length === 0
      ? null
      : {
          code: LINEUP_VALIDATION_CODE.INVALID_GENDER,
          message: "Nội dung yêu cầu VĐV nam.",
          invalidPlayerIds: invalid.map((p) => String(p.id)),
        };
  }

  if (requirement === GENDER_REQUIREMENT.FEMALE) {
    const invalid = members.filter((player) => getPlayerGenderKey(player) !== "female");
    return invalid.length === 0
      ? null
      : {
          code: LINEUP_VALIDATION_CODE.INVALID_GENDER,
          message: "Nội dung yêu cầu VĐV nữ.",
          invalidPlayerIds: invalid.map((p) => String(p.id)),
        };
  }

  if (requirement === GENDER_REQUIREMENT.MIXED_PAIR) {
    const males = members.filter((player) => getPlayerGenderKey(player) === "male");
    const females = members.filter((player) => getPlayerGenderKey(player) === "female");
    return members.length === 2 && males.length === 1 && females.length === 1
      ? null
      : {
          code: LINEUP_VALIDATION_CODE.INVALID_GENDER,
          message: "Nội dung mixed cần 1 nam + 1 nữ.",
          invalidPlayerIds: members.map((p) => String(p.id)),
        };
  }

  return null;
}

export function validateDisciplineSelectionStructured({
  team,
  discipline,
  playerIds,
  players = [],
  usedPlayerIds = new Set(),
  allowReuse = false,
  partial = false,
}) {
  const fieldErrors = {};
  const ruleViolations = [];
  const invalidPlayerIds = [];

  if (!team || !discipline) {
    return validationFailure(LINEUP_VALIDATION_CODE.VALIDATION, "Thiếu đội hoặc nội dung thi đấu.");
  }

  const normalizedIds = playerIds.map((id) => String(id).trim()).filter(Boolean);
  const expectedCount = discipline.playerCount;
  const disciplineKey = String(discipline.id);

  if (normalizedIds.length === 0) {
    if (partial) {
      return validationSuccess({ selections: { [disciplineKey]: [] }, playerIds: [] });
    }
    return validationFailure(
      LINEUP_VALIDATION_CODE.LINEUP_INCOMPLETE,
      `${discipline.name} cần ${expectedCount} VĐV.`,
      { invalidDisciplineIds: [disciplineKey] }
    );
  }

  if (partial && normalizedIds.length > expectedCount) {
    return validationFailure(
      LINEUP_VALIDATION_CODE.ROSTER_LIMIT_EXCEEDED,
      `${discipline.name}: tối đa ${expectedCount} VĐV.`,
      { invalidDisciplineIds: [disciplineKey] }
    );
  }

  if (!partial && normalizedIds.length !== expectedCount) {
    return validationFailure(
      LINEUP_VALIDATION_CODE.LINEUP_INCOMPLETE,
      `${discipline.name} cần ${expectedCount} VĐV.`,
      { invalidDisciplineIds: [disciplineKey] }
    );
  }

  const uniqueIds = new Set(normalizedIds);
  if (uniqueIds.size !== normalizedIds.length) {
    return validationFailure(
      LINEUP_VALIDATION_CODE.DUPLICATE_PLAYER,
      `${discipline.name}: không được trùng VĐV.`,
      { invalidDisciplineIds: [disciplineKey] }
    );
  }

  for (const playerId of normalizedIds) {
    if (!team.playerIds.includes(playerId)) {
      invalidPlayerIds.push(playerId);
      pushFieldError(fieldErrors, disciplineKey, `${discipline.name}: VĐV ${playerId} không thuộc đội.`);
      ruleViolations.push({
        code: LINEUP_VALIDATION_CODE.PLAYER_NOT_IN_TEAM,
        disciplineId: disciplineKey,
        playerId,
        message: `${discipline.name}: VĐV ${playerId} không thuộc đội.`,
      });
      continue;
    }

    if (!isPlayerAvailable(team, playerId)) {
      invalidPlayerIds.push(playerId);
      pushFieldError(
        fieldErrors,
        disciplineKey,
        `${discipline.name}: VĐV ${playerId} vắng mặt hoặc bị khóa.`
      );
      ruleViolations.push({
        code: LINEUP_VALIDATION_CODE.PLAYER_NOT_ELIGIBLE,
        disciplineId: disciplineKey,
        playerId,
        message: `${discipline.name}: VĐV ${playerId} vắng mặt hoặc bị khóa.`,
      });
      continue;
    }

    if (!allowReuse && usedPlayerIds.has(playerId)) {
      invalidPlayerIds.push(playerId);
      pushFieldError(
        fieldErrors,
        disciplineKey,
        `${discipline.name}: VĐV ${playerId} đã được chọn ở nội dung khác.`
      );
      ruleViolations.push({
        code: LINEUP_VALIDATION_CODE.DUPLICATE_PLAYER,
        disciplineId: disciplineKey,
        playerId,
        message: `${discipline.name}: VĐV ${playerId} đã được chọn ở nội dung khác.`,
      });
    }
  }

  if (ruleViolations.length > 0) {
    return validationFailure(
      ruleViolations[0].code || LINEUP_VALIDATION_CODE.VALIDATION,
      ruleViolations[0].message,
      {
        fieldErrors,
        ruleViolations,
        invalidPlayerIds: [...new Set(invalidPlayerIds)],
        invalidDisciplineIds: [disciplineKey],
      }
    );
  }

  const playersById = playerMap(players);
  const shouldValidateGender = !partial || normalizedIds.length === expectedCount;

  if (shouldValidateGender) {
    const genderError = validateGenderRequirement(
      normalizedIds,
      playersById,
      discipline.genderRequirement
    );

    if (genderError) {
      pushFieldError(fieldErrors, disciplineKey, `${discipline.name}: ${genderError.message}`);
      return validationFailure(genderError.code, `${discipline.name}: ${genderError.message}`, {
        fieldErrors,
        ruleViolations: [
          {
            code: genderError.code,
            disciplineId: disciplineKey,
            message: genderError.message,
          },
        ],
        invalidPlayerIds: genderError.invalidPlayerIds || [],
        invalidDisciplineIds: [disciplineKey],
      });
    }

    if (
      discipline.categoryType === DISCIPLINE_CATEGORY.MIXED &&
      discipline.genderRequirement === GENDER_REQUIREMENT.ANY
    ) {
      const mixedError = validateGenderRequirement(
        normalizedIds,
        playersById,
        GENDER_REQUIREMENT.MIXED_PAIR
      );
      if (mixedError) {
        return validationFailure(
          mixedError.code,
          `${discipline.name}: ${mixedError.message}`,
          {
            fieldErrors: { [disciplineKey]: [mixedError.message] },
            invalidDisciplineIds: [disciplineKey],
            invalidPlayerIds: mixedError.invalidPlayerIds || [],
          }
        );
      }
    }
  }

  return validationSuccess({
    selections: { [disciplineKey]: normalizedIds },
    playerIds: normalizedIds,
  });
}

/** @deprecated use validateDisciplineSelectionStructured — kept for callers expecting { ok, error } */
export function validateDisciplineSelection(args) {
  const result = validateDisciplineSelectionStructured(args);
  if (result.ok) {
    return { ok: true, playerIds: result.playerIds || args.playerIds };
  }
  return { ok: false, error: result.message, code: result.code, validation: result };
}

export function validateMlpLineupParticipationStructured(teamData, teamId, selections = {}) {
  if (!isMlpFormat(teamData)) {
    return validationSuccess();
  }

  const team = findTeam(teamData, teamId);
  if (!team) {
    return validationFailure(LINEUP_VALIDATION_CODE.VALIDATION, "Không tìm thấy đội.");
  }

  const mainDisciplines = getActiveMatchDisciplines(teamData.disciplines || []);

  const playCount = new Map();
  team.playerIds.forEach((playerId) => playCount.set(String(playerId), 0));

  for (const discipline of mainDisciplines) {
    const playerIds = selections[discipline.id] || [];
    for (const playerId of playerIds) {
      const key = String(playerId);
      playCount.set(key, (playCount.get(key) || 0) + 1);
    }
  }

  const ruleViolations = [];
  for (const playerId of team.playerIds) {
    const count = playCount.get(String(playerId)) || 0;
    if (count !== 2) {
      ruleViolations.push({
        code: LINEUP_VALIDATION_CODE.LINEUP_INCOMPLETE,
        message: `VĐV phải tham gia đúng 2 trận trong tie (1 đồng giới + 1 mixed). Hiện tại: ${count} trận.`,
        playerId: String(playerId),
      });
      break;
    }
  }

  const femaleDiscipline = mainDisciplines.find(
    (discipline) => discipline.genderRequirement === GENDER_REQUIREMENT.FEMALE
  );
  const maleDiscipline = mainDisciplines.find(
    (discipline) => discipline.genderRequirement === GENDER_REQUIREMENT.MALE
  );
  const mixedDisciplines = mainDisciplines.filter(
    (discipline) => discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
  );

  if (femaleDiscipline) {
    const femaleIds = new Set(selections[femaleDiscipline.id] || []);
    for (const mixed of mixedDisciplines) {
      const mixedIds = selections[mixed.id] || [];
      const femaleInMixed = mixedIds.find((id) => femaleIds.has(String(id)));
      if (femaleInMixed) {
        const maleInMixed = mixedIds.find((id) => !femaleIds.has(String(id)));
        if (!maleInMixed) {
          ruleViolations.push({
            code: LINEUP_VALIDATION_CODE.INVALID_GENDER,
            message: "Mỗi VĐV nữ: 1 trận đôi nữ + 1 trận mixed.",
          });
        }
      }
    }
  }

  if (maleDiscipline) {
    const maleIds = new Set(selections[maleDiscipline.id] || []);
    for (const mixed of mixedDisciplines) {
      const mixedIds = selections[mixed.id] || [];
      const maleInMixed = mixedIds.find((id) => maleIds.has(String(id)));
      if (maleInMixed) {
        const femaleInMixed = mixedIds.find((id) => !maleIds.has(String(id)));
        if (!femaleInMixed) {
          ruleViolations.push({
            code: LINEUP_VALIDATION_CODE.INVALID_GENDER,
            message: "Mỗi VĐV nam: 1 trận đôi nam + 1 trận mixed.",
          });
        }
      }
    }
  }

  if (ruleViolations.length > 0) {
    return validationFailure(
      ruleViolations[0].code,
      ruleViolations[0].message,
      { ruleViolations }
    );
  }

  return validationSuccess();
}

export function validateMlpLineupParticipation(teamData, teamId, selections = {}) {
  const result = validateMlpLineupParticipationStructured(teamData, teamId, selections);
  if (result.ok) {
    return { ok: true };
  }
  return {
    ok: false,
    error: result.message,
    errors: mergeValidationMessages(result),
    validation: result,
  };
}

export function validateLineupSelectionsStructured(args) {
  const portalPlayers = resolvePortalScopedLineupPlayers(args);
  let scopedPlayers = portalPlayers;
  if (!Array.isArray(scopedPlayers) || scopedPlayers.length === 0) {
    if (args.requireCaptainPortalRoster === true) {
      return captainRosterUnavailableResult();
    }
    // Non-captain engine/blob paths may still pass an explicit player list when
    // portal rosterAthletes were never part of the fixture. Captain Portal must
    // set requireCaptainPortalRoster and never fall back to club/profile pool.
    scopedPlayers = Array.isArray(args.players) ? args.players : [];
    if (scopedPlayers.length === 0) {
      return captainRosterUnavailableResult();
    }
  }
  const nextArgs = { ...args, players: scopedPlayers };
  const mlp =
    isMlpFormat(args.teamData) ||
    args.teamData?.settings?.allowPlayerReusePerMatchup === true;
  // MLP slot/reuse/participation is CANONICAL_TEAM_TOURNAMENT_MLP authority.
  // Rules V2 mixed_double mapping is incompatible with MLP (CORE-08: do not retarget V2).
  if (mlp) {
    return validateCanonicalMlpLineupSelectionsStructured(nextArgs);
  }
  if (isRulesV2Enabled(args.envSource)) {
    const bridge = evaluateLegacyTeamLineupValidation(
      {
        ...nextArgs,
        team: args.team || findTeam(args.teamData, args.teamId),
        legacyEvaluate: () =>
          validateCanonicalTeamTournamentLineupSelectionsStructured(nextArgs),
      },
      { envSource: args.envSource }
    );
    return bridge.result;
  }
  return validateCanonicalTeamTournamentLineupSelectionsStructured(nextArgs);
}

/**
 * Canonical Team Tournament MLP lineup rules (slot/gender/reuse/participation).
 * Same semantics as the former validateLineupSelectionsStructuredLegacy path —
 * not a Competition Core / Rules V2 authority.
 */
export function validateCanonicalMlpLineupSelectionsStructured(args) {
  return validateCanonicalTeamTournamentLineupSelectionsStructured(args);
}

/**
 * Canonical Team Tournament lineup validator (format-aware, including MLP).
 * Historical name was validateLineupSelectionsStructuredLegacy.
 */
export function validateCanonicalTeamTournamentLineupSelectionsStructured({
  teamData,
  teamId,
  team: teamHint = null,
  selections = {},
  players = [],
  partial = false,
  serverTime = null,
  lineupVersion = null,
}) {
  const effectiveTeamData = applyCanonicalMlpDisciplineMetadata(teamData) || teamData;
  const team = findTeam(effectiveTeamData, teamId) || teamHint;
  if (!team) {
    return validationFailure(LINEUP_VALIDATION_CODE.VALIDATION, "Không tìm thấy đội.");
  }

  const allowReuse = effectiveTeamData.settings?.allowPlayerReusePerMatchup === true;
  const usedPlayerIds = new Set();
  const normalizedSelections = {};
  const fieldErrors = {};
  const ruleViolations = [];
  const invalidPlayerIds = [];
  const invalidDisciplineIds = [];
  const warnings = [];
  const lineupDisciplines = getActiveMatchDisciplines(effectiveTeamData.disciplines || []);
  const portalPlayers = resolvePortalScopedLineupPlayers({
    team: teamHint || team,
    teamData: effectiveTeamData,
    teamId,
  });
  const playersForValidation =
    portalPlayers.length > 0
      ? portalPlayers
      : Array.isArray(players) && players.length > 0
        ? players
        : [];
  if (playersForValidation.length === 0) {
    return captainRosterUnavailableResult();
  }

  for (const discipline of lineupDisciplines) {
    if (!discipline?.id) {
      continue;
    }
    const playerIds = selections[discipline.id] || [];
    const result = validateDisciplineSelectionStructured({
      team,
      discipline,
      playerIds,
      players: playersForValidation,
      usedPlayerIds,
      allowReuse,
      partial,
    });

    if (!result.ok) {
      const violations =
        result.ruleViolations?.length > 0
          ? result.ruleViolations
          : [
              {
                code: result.code,
                message: result.message,
                disciplineId: discipline.id,
              },
            ];
      ruleViolations.push(...violations);
      invalidPlayerIds.push(...(result.invalidPlayerIds || []));
      invalidDisciplineIds.push(...(result.invalidDisciplineIds || [discipline.id]));
      Object.assign(fieldErrors, result.fieldErrors || {});
      continue;
    }

    const ids = result.playerIds || result.selections?.[discipline.id] || [];
    ids.forEach((playerId) => usedPlayerIds.add(playerId));
    normalizedSelections[discipline.id] = ids;

    if (partial && ids.length > 0 && ids.length < discipline.playerCount) {
      warnings.push(`${discipline.name}: nháp chưa đủ ${discipline.playerCount} VĐV.`);
    }
  }

  if (ruleViolations.length > 0) {
    return validationFailure(
      ruleViolations[0].code || LINEUP_VALIDATION_CODE.VALIDATION,
      ruleViolations[0].message,
      {
        fieldErrors,
        ruleViolations,
        invalidPlayerIds: [...new Set(invalidPlayerIds)],
        invalidDisciplineIds: [...new Set(invalidDisciplineIds)],
        serverTime,
        lineupVersion,
        warnings,
      }
    );
  }

  if (!partial) {
    for (const discipline of lineupDisciplines) {
      const ids = normalizedSelections[discipline.id] || [];
      if (ids.length !== discipline.playerCount) {
        return validationFailure(
          LINEUP_VALIDATION_CODE.LINEUP_INCOMPLETE,
          `${discipline.name} cần ${discipline.playerCount} VĐV.`,
          { invalidDisciplineIds: [discipline.id] }
        );
      }
    }

    const mlpCheck = validateMlpLineupParticipationStructured(
      effectiveTeamData,
      teamId,
      normalizedSelections
    );
    if (!mlpCheck.ok) {
      return createLineupValidationResult({
        ...mlpCheck,
        serverTime,
        lineupVersion,
        selections: normalizedSelections,
      });
    }
  }

  return validationSuccess({
    selections: normalizedSelections,
    serverTime,
    lineupVersion,
    warnings,
  });
}

export function validateLineupSelections(args) {
  const result = validateLineupSelectionsStructured(args);
  const errors = mergeValidationMessages(result);
  return {
    ok: result.ok,
    errors,
    error: errors[0] || result.message || null,
    selections: result.selections,
    warnings: result.warnings,
    validation: result,
  };
}

export function filterEligiblePlayersForDiscipline({
  team,
  discipline,
  players = [],
  usedPlayerIds = new Set(),
  allowReuse = false,
  slotIndex = null,
}) {
  if (!team || !discipline) {
    return [];
  }

  const hydrated = hydrateTeamRoster({ team, athletePool: players });
  const rosterPlayers = hydratedMembersAsPlayers(hydrated);
  const absent = new Set((team.absentPlayerIds || []).map(String));
  const locked = new Set((team.lockedPlayerIds || []).map(String));
  const slotGate = resolveMlpSlotGenderGate(discipline, slotIndex);

  return rosterPlayers
    .filter((player) => !absent.has(String(player.id)) && !locked.has(String(player.id)))
    .filter((player) => {
      if (allowReuse || !usedPlayerIds.has(String(player.id))) {
        return true;
      }
      return false;
    })
    .filter((player) => {
      const genderKey = getPlayerGenderKey(player);
      if (slotGate) {
        return genderKey === slotGate;
      }
      if (discipline.genderRequirement === GENDER_REQUIREMENT.MALE) {
        return genderKey === "male";
      }
      if (discipline.genderRequirement === GENDER_REQUIREMENT.FEMALE) {
        return genderKey === "female";
      }
      if (
        discipline.categoryType === DISCIPLINE_CATEGORY.MIXED ||
        discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
      ) {
        return genderKey === "male" || genderKey === "female";
      }
      return true;
    });
}

export { LINEUP_VALIDATION_CODE, mergeValidationMessages } from "./lineupValidationContract.js";
