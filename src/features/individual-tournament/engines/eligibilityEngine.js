/**
 * Individual tournament eligibility rules (S1-C).
 * Blob: tournament.settings.eligibilityRules
 * Does not modify team eligibilityEngine.
 */
import { getPlayerGenderKey, getPlayerRatingInternal } from "../../../models/player.js";
import { writeAuditLog } from "../../identity/services/auditService.js";
import { isCountableRegistrationEntry } from "../../../models/tournament/entry.js";

export const ELIGIBILITY_VIOLATION = {
  AGE_TOO_YOUNG: "age_too_young",
  AGE_TOO_OLD: "age_too_old",
  AGE_UNKNOWN: "age_unknown",
  GENDER_NOT_ALLOWED: "gender_not_allowed",
  SKILL_TOO_LOW: "skill_too_low",
  SKILL_TOO_HIGH: "skill_too_high",
  RATING_TOO_LOW: "rating_too_low",
  RATING_TOO_HIGH: "rating_too_high",
  CLUB_REQUIRED: "club_membership_required",
  INVITE_ONLY: "invite_only",
  NOT_ON_WHITELIST: "not_on_whitelist",
  MAX_REGISTRATIONS: "max_registrations_exceeded",
  PLAYER_NOT_FOUND: "player_not_found",
  CROSS_EVENT_DUPLICATE: "cross_event_duplicate",
};

export const DEFAULT_ELIGIBILITY_RULES = {
  age: { enabled: false, minAge: null, maxAge: null, asOfDate: null },
  gender: { enabled: false, allowedGenders: ["male", "female"] },
  skill: { enabled: false, minLevel: null, maxLevel: null },
  rating: { enabled: false, minRating: null, maxRating: null },
  clubMembership: { enabled: false, requireActiveClub: true, allowedClubIds: [] },
  inviteOnly: { enabled: false },
  whitelist: { enabled: false, playerIds: [] },
  maxRegistrationsPerPlayer: { enabled: false, max: 1 },
};

function patchTournamentSettings(tournament, patch) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      ...patch,
    },
  };
}

function toNullableNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function normalizeEligibilityRules(rules = {}) {
  const age = rules.age && typeof rules.age === "object" ? rules.age : {};
  const gender = rules.gender && typeof rules.gender === "object" ? rules.gender : {};
  const skill = rules.skill && typeof rules.skill === "object" ? rules.skill : {};
  const rating = rules.rating && typeof rules.rating === "object" ? rules.rating : {};
  const clubMembership =
    rules.clubMembership && typeof rules.clubMembership === "object" ? rules.clubMembership : {};
  const inviteOnly = rules.inviteOnly && typeof rules.inviteOnly === "object" ? rules.inviteOnly : {};
  const whitelist = rules.whitelist && typeof rules.whitelist === "object" ? rules.whitelist : {};
  const maxReg =
    rules.maxRegistrationsPerPlayer && typeof rules.maxRegistrationsPerPlayer === "object"
      ? rules.maxRegistrationsPerPlayer
      : {};

  return {
    age: {
      enabled: age.enabled === true,
      minAge: toNullableNumber(age.minAge),
      maxAge: toNullableNumber(age.maxAge),
      asOfDate: age.asOfDate ? String(age.asOfDate).trim() : null,
    },
    gender: {
      enabled: gender.enabled === true,
      allowedGenders: Array.isArray(gender.allowedGenders)
        ? gender.allowedGenders.map((value) => String(value).trim()).filter(Boolean)
        : [...DEFAULT_ELIGIBILITY_RULES.gender.allowedGenders],
    },
    skill: {
      enabled: skill.enabled === true,
      minLevel: toNullableNumber(skill.minLevel),
      maxLevel: toNullableNumber(skill.maxLevel),
    },
    rating: {
      enabled: rating.enabled === true,
      minRating: toNullableNumber(rating.minRating),
      maxRating: toNullableNumber(rating.maxRating),
    },
    clubMembership: {
      enabled: clubMembership.enabled === true,
      requireActiveClub: clubMembership.requireActiveClub !== false,
      allowedClubIds: Array.isArray(clubMembership.allowedClubIds)
        ? clubMembership.allowedClubIds.map(String)
        : [],
    },
    inviteOnly: {
      enabled: inviteOnly.enabled === true,
    },
    whitelist: {
      enabled: whitelist.enabled === true,
      playerIds: Array.isArray(whitelist.playerIds)
        ? whitelist.playerIds.map(String)
        : [],
    },
    maxRegistrationsPerPlayer: {
      enabled: maxReg.enabled === true,
      max: Number.isFinite(Number(maxReg.max)) && Number(maxReg.max) > 0 ? Number(maxReg.max) : 1,
    },
  };
}

export function getEligibilityRules(tournament) {
  return normalizeEligibilityRules(tournament?.settings?.eligibilityRules || {});
}

export function updateEligibilityRules(tournament, patch = {}) {
  const current = getEligibilityRules(tournament);
  const next = normalizeEligibilityRules({
    age: { ...current.age, ...(patch.age || {}) },
    gender: { ...current.gender, ...(patch.gender || {}) },
    skill: { ...current.skill, ...(patch.skill || {}) },
    rating: { ...current.rating, ...(patch.rating || {}) },
    clubMembership: { ...current.clubMembership, ...(patch.clubMembership || {}) },
    inviteOnly: { ...current.inviteOnly, ...(patch.inviteOnly || {}) },
    whitelist: { ...current.whitelist, ...(patch.whitelist || {}) },
    maxRegistrationsPerPlayer: {
      ...current.maxRegistrationsPerPlayer,
      ...(patch.maxRegistrationsPerPlayer || {}),
    },
  });

  return {
    ok: true,
    tournament: patchTournamentSettings(tournament, { eligibilityRules: next }),
    rules: next,
  };
}

export function getPlayerAge(player, asOfDate = null) {
  const birthYear = Number(player?.birthYear ?? player?.meta?.birthYear);
  if (!Number.isFinite(birthYear) || birthYear < 1900) {
    return null;
  }
  const reference = asOfDate ? new Date(asOfDate) : new Date();
  return Math.max(0, reference.getFullYear() - birthYear);
}

/** Consume Rating V5 display value from player snapshot when present — do not call V5 APIs. */
export function getPlayerDisplayRating(player) {
  if (player?.displayRating != null && Number.isFinite(Number(player.displayRating))) {
    return Number(player.displayRating);
  }
  if (player?.ratingV5?.display_rating != null) {
    return Number(player.ratingV5.display_rating);
  }
  if (player?.pickVnRating?.display_rating != null) {
    return Number(player.pickVnRating.display_rating);
  }
  if (player?.elo != null && Number.isFinite(Number(player.elo))) {
    return Number(player.elo);
  }
  return null;
}

function isRatingV5FlagOn() {
  try {
    return String(import.meta.env?.VITE_PICK_VN_RATING_V5_ENABLED ?? "false").toLowerCase() === "true";
  } catch {
    return false;
  }
}

export function checkPlayerEligibility(player, rules, options = {}) {
  const normalized = normalizeEligibilityRules(rules);
  const violations = [];
  const asOfDate = options.asOfDate || normalized.age.asOfDate || null;

  if (!player) {
    return {
      ok: false,
      playerId: "",
      playerName: "",
      violations: [{ code: ELIGIBILITY_VIOLATION.PLAYER_NOT_FOUND, message: "Không tìm thấy VĐV." }],
    };
  }

  const playerId = String(player.id);

  if (normalized.whitelist.enabled) {
    if (!normalized.whitelist.playerIds.includes(playerId)) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.NOT_ON_WHITELIST,
        message: "VĐV không nằm trong whitelist của giải.",
      });
    }
  }

  if (normalized.inviteOnly.enabled && !options.hasInvite) {
    if (!normalized.whitelist.enabled || !normalized.whitelist.playerIds.includes(playerId)) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.INVITE_ONLY,
        message: "Giải chỉ nhận đăng ký theo lời mời / whitelist.",
      });
    }
  }

  if (normalized.age.enabled) {
    const age = getPlayerAge(player, asOfDate);
    if (age == null) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.AGE_UNKNOWN,
        message: "Thiếu năm sinh để kiểm tra độ tuổi.",
      });
    } else {
      if (normalized.age.minAge != null && age < normalized.age.minAge) {
        violations.push({
          code: ELIGIBILITY_VIOLATION.AGE_TOO_YOUNG,
          message: `Tuổi ${age} nhỏ hơn mức tối thiểu ${normalized.age.minAge}.`,
        });
      }
      if (normalized.age.maxAge != null && age > normalized.age.maxAge) {
        violations.push({
          code: ELIGIBILITY_VIOLATION.AGE_TOO_OLD,
          message: `Tuổi ${age} vượt mức tối đa ${normalized.age.maxAge}.`,
        });
      }
    }
  }

  if (normalized.gender.enabled) {
    const genderKey = getPlayerGenderKey(player?.gender ?? player?.genderKey);
    if (!normalized.gender.allowedGenders.includes(genderKey)) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.GENDER_NOT_ALLOWED,
        message: `Giới tính "${genderKey}" không được phép tham gia.`,
      });
    }
  }

  if (normalized.skill.enabled) {
    const level = getPlayerRatingInternal(player);
    if (normalized.skill.minLevel != null && level < normalized.skill.minLevel) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.SKILL_TOO_LOW,
        message: `Trình độ ${level} thấp hơn mức tối thiểu ${normalized.skill.minLevel}.`,
      });
    }
    if (normalized.skill.maxLevel != null && level > normalized.skill.maxLevel) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.SKILL_TOO_HIGH,
        message: `Trình độ ${level} vượt mức tối đa ${normalized.skill.maxLevel}.`,
      });
    }
  }

  if (normalized.rating.enabled) {
    const display = getPlayerDisplayRating(player);
    if (display == null) {
      if (options.requireRatingValue === true || isRatingV5FlagOn()) {
        violations.push({
          code: ELIGIBILITY_VIOLATION.RATING_TOO_LOW,
          message: "Thiếu rating để kiểm tra khoảng rating.",
        });
      }
    } else {
      if (normalized.rating.minRating != null && display < normalized.rating.minRating) {
        violations.push({
          code: ELIGIBILITY_VIOLATION.RATING_TOO_LOW,
          message: `Rating ${display} thấp hơn mức tối thiểu ${normalized.rating.minRating}.`,
        });
      }
      if (normalized.rating.maxRating != null && display > normalized.rating.maxRating) {
        violations.push({
          code: ELIGIBILITY_VIOLATION.RATING_TOO_HIGH,
          message: `Rating ${display} vượt mức tối đa ${normalized.rating.maxRating}.`,
        });
      }
    }
  }

  if (normalized.clubMembership.enabled) {
    const clubId = String(player.clubId || player.homeClubId || options.clubId || "");
    if (normalized.clubMembership.requireActiveClub && !clubId) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.CLUB_REQUIRED,
        message: "Yêu cầu thành viên CLB để đăng ký.",
      });
    }
    if (
      normalized.clubMembership.allowedClubIds.length > 0 &&
      clubId &&
      !normalized.clubMembership.allowedClubIds.includes(clubId)
    ) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.CLUB_REQUIRED,
        message: "CLB của VĐV không nằm trong danh sách được phép.",
      });
    }
  }

  return {
    ok: violations.length === 0,
    playerId,
    playerName: player?.name || "",
    violations,
  };
}

export function countPlayerRegistrationsAcrossEvents(tournament, playerId, excludeEntryId = null) {
  let count = 0;
  for (const event of tournament?.events || []) {
    for (const entry of event.entries || []) {
      if (excludeEntryId && String(entry.id) === String(excludeEntryId)) continue;
      if (!isCountableRegistrationEntry(entry)) continue;
      if ((entry.playerIds || []).map(String).includes(String(playerId))) {
        count += 1;
      }
    }
  }
  return count;
}

export function findCrossEventDuplicates(tournament, playerIds = [], excludeEntryId = null) {
  const wanted = new Set(playerIds.map(String));
  const hits = [];
  for (const event of tournament?.events || []) {
    for (const entry of event.entries || []) {
      if (excludeEntryId && String(entry.id) === String(excludeEntryId)) continue;
      if (!isCountableRegistrationEntry(entry)) continue;
      for (const id of entry.playerIds || []) {
        if (wanted.has(String(id))) {
          hits.push({
            playerId: String(id),
            eventId: event.id,
            eventName: event.name,
            entryId: entry.id,
          });
        }
      }
    }
  }
  return hits;
}

export function checkEntryPlayersEligibility(tournament, playerIds = [], players = [], options = {}) {
  const rules = getEligibilityRules(tournament);
  const playerMap = new Map(players.map((player) => [String(player.id), player]));
  const results = [];
  const violations = [];

  for (const playerId of playerIds.map(String)) {
    const player = playerMap.get(playerId);
    const result = checkPlayerEligibility(player, rules, {
      ...options,
      clubId: options.clubId || tournament?.clubId,
    });
    results.push(result);
    for (const violation of result.violations) {
      violations.push({ ...violation, playerId, playerName: result.playerName });
    }

    if (rules.maxRegistrationsPerPlayer.enabled) {
      const count = countPlayerRegistrationsAcrossEvents(
        tournament,
        playerId,
        options.excludeEntryId || null
      );
      if (count >= rules.maxRegistrationsPerPlayer.max) {
        const maxViolation = {
          code: ELIGIBILITY_VIOLATION.MAX_REGISTRATIONS,
          message: `VĐV đã đăng ký ${count}/${rules.maxRegistrationsPerPlayer.max} nội dung.`,
          playerId,
          playerName: result.playerName,
        };
        violations.push(maxViolation);
        result.ok = false;
        result.violations.push(maxViolation);
      }
    }
  }

  const cross = findCrossEventDuplicates(tournament, playerIds, options.excludeEntryId || null);
  // When registering into a specific event, same-event dup already handled by S1-B;
  // cross-event means another event in this tournament.
  const crossFiltered = (options.eventId
    ? cross.filter((hit) => String(hit.eventId) !== String(options.eventId))
    : cross);

  for (const hit of crossFiltered) {
    violations.push({
      code: ELIGIBILITY_VIOLATION.CROSS_EVENT_DUPLICATE,
      message: `VĐV đã đăng ký nội dung khác (${hit.eventName || hit.eventId}).`,
      playerId: hit.playerId,
      eventId: hit.eventId,
      entryId: hit.entryId,
    });
  }

  const ok = results.every((item) => item.ok) && crossFiltered.length === 0;

  return {
    ok,
    rules,
    players: results,
    violations,
    crossEventDuplicates: crossFiltered,
  };
}

export function auditEligibilityDecision(tournament, decision, options = {}) {
  const entry = {
    id: `elig-audit-${Date.now()}`,
    action: decision.ok ? "eligibility_passed" : "eligibility_failed",
    playerIds: decision.playerIds || [],
    violations: decision.violations || [],
    timestamp: new Date().toISOString(),
  };

  const log = Array.isArray(tournament?.settings?.eligibilityAuditLog)
    ? tournament.settings.eligibilityAuditLog
    : [];
  const nextTournament = patchTournamentSettings(tournament, {
    eligibilityAuditLog: [...log, entry].slice(-100),
  });

  void writeAuditLog({
    action: entry.action,
    resourceType: "tournament",
    resourceId: tournament?.id || "",
    clubId: options.clubId || tournament?.clubId || null,
    actor: options.actor || null,
    metadata: {
      playerIds: entry.playerIds,
      violations: entry.violations,
      reason: options.reason || "",
    },
  }).catch(() => {});

  return { tournament: nextTournament, auditEntry: entry };
}

export function checkAllEntriesEligibility(tournament, players = []) {
  const rules = getEligibilityRules(tournament);
  const playerMap = new Map(players.map((player) => [String(player.id), player]));
  const rows = [];

  for (const event of tournament?.events || []) {
    for (const entry of event.entries || []) {
      if (!isCountableRegistrationEntry(entry)) continue;
      const playerResults = (entry.playerIds || []).map((playerId) => {
        const player = playerMap.get(String(playerId));
        return checkPlayerEligibility(player, rules, { clubId: tournament?.clubId });
      });
      rows.push({
        entryId: entry.id,
        entryName: entry.name,
        eventId: event.id,
        eventName: event.name,
        ok: playerResults.every((item) => item.ok),
        players: playerResults,
      });
    }
  }

  return {
    ok: rows.every((row) => row.ok),
    rules,
    rows,
  };
}
