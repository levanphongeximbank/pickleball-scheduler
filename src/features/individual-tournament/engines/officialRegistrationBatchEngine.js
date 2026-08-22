/**
 * Official individual bulk registration — in-memory orchestration only.
 * Reuses submitRegistration against an evolving aggregate.
 * Persist/readback remain the caller's canonical Tournament authority.
 *
 * G1-B: Content registrationMode + Content capacity (unit-safe) for Official/Open.
 * Tournament settings.registration.maxEntries is not authority when Content is explicit.
 */

import { validateOpenRegistrationPlayers } from "../../../tournament/engines/officialTournamentEngine.js";
import { checkPlayerEligibility, ELIGIBILITY_VIOLATION } from "./eligibilityEngine.js";
import { OFFICIAL_REGISTRATION_MODE } from "./officialTournamentSettingsEngine.js";
import { shouldActivateOfficialOpenRating } from "../../tournament/official-open-adapter-b/activation.js";
import {
  CONTENT_RULES_SOURCE,
  evaluateContentRegistrationCapacity,
  resolveContentRegistrationModeDetailed,
  resolveOfficialRegistrationEligibilityRules,
} from "./officialContentCompetitionRules.js";
import {
  canSubmitRegistration,
  countApprovedEntries,
  getRegistrationSettings,
  isRegistrationLocked,
  submitRegistration,
} from "./registrationEngine.js";

export function uniqueOfficialIndividualSelection(selectedIds = []) {
  const seen = new Set();
  const out = [];
  for (const raw of selectedIds || []) {
    const key = String(raw || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function toggleOfficialIndividualSelection(
  selectedIds = [],
  playerId,
  options = {}
) {
  const key = String(playerId || "").trim();
  const current = uniqueOfficialIndividualSelection(selectedIds);
  if (!key) return current;
  const blocked = new Set((options.excludePlayerIds || []).map(String));
  if (blocked.has(key)) return current;
  if (current.includes(key)) {
    return current.filter((id) => id !== key);
  }
  return [...current, key];
}

export function mergeVisibleOfficialIndividualSelection(selectedIds = [], visibleIds = []) {
  const next = new Set(uniqueOfficialIndividualSelection(selectedIds));
  for (const raw of visibleIds || []) {
    const key = String(raw || "").trim();
    if (key) next.add(key);
  }
  return [...next];
}

export function formatOfficialBulkRegistrationError(failures = []) {
  if (!Array.isArray(failures) || failures.length === 0) {
    return "";
  }
  const lines = failures.map((item) => {
    const name = item.playerName || item.playerId || "VĐV";
    return `- ${name}: ${item.error || "không hợp lệ"}`;
  });
  return `Không thể đăng ký ${failures.length} VĐV:\n${lines.join("\n")}`;
}

function findEvent(tournament, eventId) {
  const events = tournament?.events || [];
  const wanted = String(eventId || "").trim();
  if (!wanted) return null;
  return events.find((event) => String(event.id) === wanted) || null;
}

function playerLabel(player, playerId) {
  return player?.name || playerId;
}

function prevalidateOnePlayer(tournament, event, player, eventType, options = {}) {
  if (!player) {
    return { ok: false, error: "Không tìm thấy VĐV trong danh sách." };
  }

  const genderCheck = validateOpenRegistrationPlayers([player], eventType);
  if (!genderCheck.ok) {
    return { ok: false, error: genderCheck.errors.join(" ") };
  }

  const eligibilityRules = options.eligibilityRules;
  if (!eligibilityRules) {
    return { ok: false, error: "Thiếu chính sách điều kiện Nội dung.", code: "EVENT_REQUIRED" };
  }

  const eligibility = checkPlayerEligibility(player, eligibilityRules, {
    clubId: options.clubId || tournament?.clubId,
    requireCanonicalMembershipEvidence: eligibilityRules.clubMembership?.enabled === true,
    requireCanonicalRatingEvidence:
      options.requireCanonicalRatingEvidence === true ||
      shouldActivateOfficialOpenRating(tournament, { eventId: event?.id }),
    membershipEvidence: options.membershipEvidenceByPlayerId?.[String(player.id)],
    ratingEvidence: options.ratingEvidenceByPlayerId?.[String(player.id)],
  });
  if (!eligibility.ok) {
    const reason = eligibility.violations?.[0]?.message || "không đủ điều kiện đăng ký";
    return {
      ok: false,
      error: reason,
      code: eligibility.violations?.[0]?.code || null,
    };
  }

  const already = (event?.entries || []).some((entry) =>
    (entry.playerIds || []).map(String).includes(String(player.id))
  );
  if (already) {
    return { ok: false, error: "đã đăng ký", code: "DUPLICATE_PLAYER" };
  }

  return { ok: true };
}

function resolveBatchCapacityRemaining(tournament, event) {
  const content = evaluateContentRegistrationCapacity(tournament, event, {
    eventId: event.id,
    allowSoleEventInference: false,
  });
  if (!content.ok) return content;

  if (content.source === CONTENT_RULES_SOURCE.CONTENT_EXPLICIT) {
    return {
      ok: true,
      maxEntries: content.maxEntries,
      remaining:
        content.maxEntries == null ? null : Math.max(0, content.maxEntries - content.used),
      source: "CONTENT",
      capacityUnit: content.capacityUnit,
    };
  }

  const settings = getRegistrationSettings(tournament);
  if (settings.maxEntries == null) {
    return {
      ok: true,
      maxEntries: null,
      remaining: null,
      source: "LEGACY_RUNTIME_COMPATIBILITY",
      capacityUnit: null,
    };
  }
  const used = countApprovedEntries(event);
  return {
    ok: true,
    maxEntries: settings.maxEntries,
    remaining: Math.max(0, Number(settings.maxEntries) - used),
    source: "LEGACY_RUNTIME_COMPATIBILITY",
    capacityUnit: null,
  };
}

/**
 * Fail-closed atomic batch. No persist. Caller writes once on ok.
 */
export function registerOfficialIndividualsBatch(tournament, input = {}, options = {}) {
  const playerIds = uniqueOfficialIndividualSelection(input.playerIds || []);
  const players = Array.isArray(input.players) ? input.players : [];
  const playerMap = new Map(players.map((player) => [String(player.id), player]));
  const eventId = String(input.eventId || "").trim();
  const eventType = input.eventType;

  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải.", failures: [], persist: false };
  }

  if (!eventId) {
    return {
      ok: false,
      error: "Chọn nội dung tường minh (eventId) trước khi đăng ký.",
      code: "EVENT_REQUIRED",
      failures: [],
      persist: false,
    };
  }

  const event = findEvent(tournament, eventId);
  if (!event) {
    return {
      ok: false,
      error: "Giải chưa có nội dung thi đấu.",
      code: eventId ? "EVENT_NOT_FOUND" : "EVENT_REQUIRED",
      failures: [],
      persist: false,
    };
  }

  const modeResolved = resolveContentRegistrationModeDetailed(tournament, {
    eventId: event.id,
    allowSoleEventInference: false,
  });
  if (
    !modeResolved.ok ||
    modeResolved.registrationMode !== OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
  ) {
    return {
      ok: false,
      error: "Chế độ đăng ký không phải cá nhân.",
      code: "NOT_INDIVIDUAL_MODE",
      failures: [],
      persist: false,
      registrationModeSource: modeResolved.source || null,
    };
  }

  const eligibilityResolved = resolveOfficialRegistrationEligibilityRules(tournament, {
    eventId: event.id,
    allowSoleEventInference: false,
  });
  if (!eligibilityResolved.ok) {
    return {
      ok: false,
      error: eligibilityResolved.error || "Không đọc được điều kiện Nội dung.",
      code: eligibilityResolved.code || "EVENT_REQUIRED",
      failures:
        eligibilityResolved.code === "INVALID_ELIGIBILITY_POLICY"
          ? playerIds.map((playerId) => ({
              playerId,
              playerName: playerLabel(playerMap.get(playerId), playerId),
              error: eligibilityResolved.error,
              code: ELIGIBILITY_VIOLATION.INVALID_ELIGIBILITY_POLICY,
            }))
          : [],
      persist: false,
    };
  }

  if (isRegistrationLocked(tournament) && !options.force) {
    return {
      ok: false,
      error: "Đăng ký đã khóa (sau bốc thăm / đóng đăng ký).",
      code: "REGISTRATION_LOCKED",
      failures: [],
      persist: false,
    };
  }

  const gate = canSubmitRegistration(tournament, options);
  if (!gate.ok) {
    return { ...gate, failures: [], persist: false };
  }

  if ((event.groups || []).length > 0 || (event.drawEntries || []).length > 0) {
    return {
      ok: false,
      error: "Đăng ký đã khóa sau khi tạo cặp / chia bảng.",
      code: "DRAW_LOCKED",
      failures: [],
      persist: false,
    };
  }

  if (playerIds.length === 0) {
    return {
      ok: false,
      error: "Chưa chọn VĐV.",
      code: "EMPTY_SELECTION",
      failures: [],
      persist: false,
    };
  }

  const capacity = resolveBatchCapacityRemaining(tournament, event);
  if (!capacity.ok) {
    return { ...capacity, failures: [], persist: false, tournament };
  }
  if (capacity.remaining != null && playerIds.length > capacity.remaining) {
    const unitLabel = capacity.capacityUnit === "PAIR" ? "cặp" : "suất";
    return {
      ok: false,
      error: `Vượt sức chứa: còn ${capacity.remaining} ${unitLabel}, đã chọn ${playerIds.length} VĐV.`,
      code: "CAPACITY_EXCEEDED",
      capacitySource: capacity.source,
      failures: playerIds.map((playerId) => ({
        playerId,
        playerName: playerLabel(playerMap.get(playerId), playerId),
        error: `vượt sức chứa (còn ${capacity.remaining} ${unitLabel})`,
      })),
      persist: false,
      tournament,
    };
  }

  const failures = [];
  for (const playerId of playerIds) {
    const player = playerMap.get(playerId);
    const check = prevalidateOnePlayer(tournament, event, player, eventType, {
      ...options,
      eligibilityRules: eligibilityResolved.rules,
      requireCanonicalRatingEvidence:
        eligibilityResolved.hasRatingBounds === true &&
        shouldActivateOfficialOpenRating(tournament, { eventId: event.id }),
    });
    if (!check.ok) {
      failures.push({
        playerId,
        playerName: playerLabel(player, playerId),
        error: check.error,
        code: check.code || null,
      });
    }
  }

  if (failures.length > 0) {
    return {
      ok: false,
      error: formatOfficialBulkRegistrationError(failures),
      failures,
      persist: false,
      tournament,
    };
  }

  let working = tournament;
  const created = [];
  const auditEntries = [];

  for (const playerId of playerIds) {
    const player = playerMap.get(playerId);
    const result = submitRegistration(
      working,
      {
        eventId: event.id,
        playerIds: [playerId],
        name: player.name,
        clubName: input.clubName || player.clubName || "",
        unitName: player.unitName || "",
        rating: player.rating ?? 0,
      },
      {
        ...options,
        autoApprove: true,
        organizerIndividual: true,
        actor: options.actor || null,
      }
    );

    if (!result.ok) {
      const fail = {
        playerId,
        playerName: playerLabel(player, playerId),
        error: result.error || "không đăng ký được",
        code: result.code || null,
      };
      return {
        ok: false,
        error: formatOfficialBulkRegistrationError([fail]),
        failures: [fail],
        persist: false,
        tournament,
      };
    }

    working = result.tournament;
    created.push(result.entry);
    if (result.auditEntry) {
      auditEntries.push(result.auditEntry);
    }
  }

  const nextEvent = findEvent(working, event.id);
  return {
    ok: true,
    tournament: working,
    event: nextEvent,
    entries: created,
    auditEntries,
    persist: true,
    registeredCount: created.length,
    registrationModeSource: modeResolved.source,
    capacitySource: capacity.source,
  };
}
