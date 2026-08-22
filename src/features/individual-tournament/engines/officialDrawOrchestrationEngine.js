/**
 * Official Draw orchestration — pairing checkpoint vs group draw.
 * Does NOT invent a pairing algorithm; callers inject existing Open / AI authorities.
 * No persisted UI FSM: substeps derive from canonical data.
 *
 * Authority split (individual doubles):
 * - event.entries = registration lifecycle SSOT
 * - event.drawEntries = post-finalization pair materialization (competition units)
 * - event.groups/matches = group-draw result
 */

import { ENTRY_STATUS } from "../../../models/tournament/constants.js";
import { isSingleEventType } from "../../../tournament/engines/officialTournamentEngine.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  getOfficialCompetitionSettings,
} from "./officialTournamentSettingsEngine.js";
import { filterDrawEligibleEntries } from "./withdrawalEngine.js";

export const OFFICIAL_DRAW_PAIR_ORIGIN = "official_draw_materialization";

/**
 * Resolve Content for draw orchestration.
 * G2-G: no events[0] business fallback when eventId missing/mismatched.
 * Sole-event allowed only when eventId omitted and events.length === 1.
 */
function primaryEvent(tournament, eventId = "") {
  const events = Array.isArray(tournament?.events) ? tournament.events : [];
  const wanted = eventId != null ? String(eventId).trim() : "";
  if (wanted) {
    return events.find((event) => String(event.id) === wanted) || null;
  }
  if (events.length === 1) return events[0] || null;
  return null;
}

function playerCount(entry) {
  return Array.isArray(entry?.playerIds) ? entry.playerIds.filter(Boolean).length : 0;
}

export function isOfficialPairShapedEntry(entry) {
  return playerCount(entry) >= 2;
}

export function isOfficialIndividualShapedEntry(entry) {
  return playerCount(entry) === 1;
}

export function listOfficialRegistrationEntries(event) {
  return Array.isArray(event?.entries) ? event.entries : [];
}

export function listOfficialDrawEntries(event) {
  return Array.isArray(event?.drawEntries) ? event.drawEntries : [];
}

function playerIdSet(entries = []) {
  const ids = new Set();
  (entries || []).forEach((entry) => {
    (entry?.playerIds || []).forEach((id) => {
      if (id) ids.add(String(id));
    });
  });
  return ids;
}

function pairsCoverEligibleIndividuals(pairs, individuals) {
  if (!pairs.length || !individuals.length) return false;
  const pairedIds = playerIdSet(pairs);
  for (const entry of individuals) {
    const id = String((entry.playerIds || [])[0] || "");
    if (!id || !pairedIds.has(id)) return false;
  }
  return pairedIds.size === individuals.length;
}

function cloneEntries(entries = []) {
  return (entries || []).map((entry) => ({ ...entry, playerIds: [...(entry.playerIds || [])] }));
}

export function projectOfficialDrawSubsteps(tournament, eventId = "") {
  const competition = getOfficialCompetitionSettings(tournament);
  const event = primaryEvent(tournament, eventId);
  const entries = listOfficialRegistrationEntries(event);
  const eligible = filterDrawEligibleEntries(entries, tournament);
  const groups = Array.isArray(event?.groups) ? event.groups : [];
  const groupsCreated = groups.length > 0;
  const singlesContent = isSingleEventType(event?.eventType);
  const isPair = competition.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR;

  const eligibleIndividuals = eligible.filter(isOfficialIndividualShapedEntry);
  const eligibleRegisteredPairs = eligible.filter(isOfficialPairShapedEntry);
  const formedPairs = listOfficialDrawEntries(event).filter(isOfficialPairShapedEntry);

  if (competition.registrationModeUnresolved || !competition.registrationMode) {
    return {
      registrationMode: null,
      registrationModeUnresolved: true,
      singlesContent,
      pairingRequired: false,
      pairingComplete: false,
      groupDrawReady: false,
      groupsCreated,
      eligibleIndividuals,
      formedPairs: [],
      eligibleCount: eligible.length,
      pairCount: 0,
      individualCount: eligibleIndividuals.length,
      registrationCount: entries.length,
      groupCount: groups.length,
      groupDrawSource: null,
      summary: "Chưa xác định chế độ đăng ký",
    };
  }

  if (isPair) {
    const groupDrawReady = !groupsCreated && eligibleRegisteredPairs.length >= 2;
    return {
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
      registrationModeUnresolved: false,
      singlesContent,
      pairingRequired: false,
      pairingComplete: true,
      groupDrawReady,
      groupsCreated,
      eligibleIndividuals: [],
      formedPairs: [],
      eligibleCount: eligible.length,
      pairCount: eligibleRegisteredPairs.length,
      individualCount: 0,
      registrationCount: entries.length,
      groupCount: groups.length,
      groupDrawSource: "entries",
      summary: groupsCreated
        ? `${eligibleRegisteredPairs.length} cặp · ${groups.length} bảng`
        : `${eligibleRegisteredPairs.length} cặp hợp lệ → sẵn sàng chia bảng`,
    };
  }

  if (singlesContent) {
    const groupDrawReady = !groupsCreated && eligibleIndividuals.length >= 2;
    return {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      registrationModeUnresolved: false,
      singlesContent: true,
      pairingRequired: false,
      pairingComplete: true,
      groupDrawReady,
      groupsCreated,
      eligibleIndividuals,
      formedPairs: [],
      eligibleCount: eligible.length,
      pairCount: 0,
      individualCount: eligibleIndividuals.length,
      registrationCount: entries.length,
      groupCount: groups.length,
      groupDrawSource: "entries",
      summary: groupsCreated
        ? `${eligibleIndividuals.length} VĐV · ${groups.length} bảng`
        : `${eligibleIndividuals.length} VĐV → sẵn sàng chia bảng`,
    };
  }

  const pairingComplete =
    formedPairs.length >= 1 && pairsCoverEligibleIndividuals(formedPairs, eligibleIndividuals);
  const pairingRequired = !groupsCreated && !pairingComplete;
  const groupDrawReady = !groupsCreated && pairingComplete && formedPairs.length >= 2;

  let summary;
  if (groupsCreated) {
    summary = `${formedPairs.length} cặp · ${groups.length} bảng`;
  } else if (pairingComplete) {
    summary = `${formedPairs.length} cặp đã tạo → sẵn sàng chia bảng`;
  } else {
    summary = `${eligibleIndividuals.length} VĐV → cần ghép cặp`;
  }

  return {
    registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    registrationModeUnresolved: false,
    singlesContent: false,
    pairingRequired,
    pairingComplete,
    groupDrawReady,
    groupsCreated,
    eligibleIndividuals,
    formedPairs,
    eligibleCount: eligible.length,
    pairCount: formedPairs.length,
    individualCount: eligibleIndividuals.length,
    registrationCount: entries.length,
    groupCount: groups.length,
    groupDrawSource: pairingComplete ? "drawEntries" : null,
    summary,
  };
}

function replaceEvent(tournament, eventId, nextEvent) {
  const events = Array.isArray(tournament?.events) ? tournament.events : [];
  const nextEvents = events.map((event) =>
    String(event.id) === String(eventId) ? nextEvent : event
  );
  return { ...tournament, events: nextEvents };
}

/**
 * Form pairs from finalized eligible individuals.
 * Writes event.drawEntries only. event.entries (registration) is unchanged.
 */
export function formOfficialIndividualPairs({
  tournament,
  eventId = "",
  players = [],
  eventType,
  pairingFn,
  pairingOptions = {},
} = {}) {
  const sub = projectOfficialDrawSubsteps(tournament, eventId);
  if (sub.registrationMode !== OFFICIAL_REGISTRATION_MODE.INDIVIDUAL) {
    return {
      ok: false,
      error: "Ghép cặp chỉ dùng cho chế độ đăng ký cá nhân.",
      pairingInvoked: 0,
      groupDrawInvoked: 0,
    };
  }
  if (sub.singlesContent) {
    return {
      ok: false,
      error: "Nội dung đơn không cần ghép cặp.",
      pairingInvoked: 0,
      groupDrawInvoked: 0,
    };
  }
  if (sub.groupsCreated) {
    return {
      ok: false,
      error: "Đã có bảng đấu — không ghép cặp lại khi bảng đã tạo.",
      pairingInvoked: 0,
      groupDrawInvoked: 0,
    };
  }
  if (typeof pairingFn !== "function") {
    return {
      ok: false,
      error: "Thiếu engine ghép cặp.",
      pairingInvoked: 0,
      groupDrawInvoked: 0,
    };
  }

  const individuals = [];
  const playersById = new Map((players || []).map((player) => [String(player.id), player]));
  for (const entry of sub.eligibleIndividuals) {
    const id = String((entry.playerIds || [])[0] || "");
    const player = playersById.get(id);
    if (!player) {
      return {
        ok: false,
        error: "Không đủ dữ liệu VĐV để ghép cặp.",
        pairingInvoked: 0,
        groupDrawInvoked: 0,
      };
    }
    individuals.push(player);
  }

  if (individuals.length < 2) {
    return {
      ok: false,
      error: "Cần ít nhất 2 VĐV đủ điều kiện để ghép cặp.",
      pairingInvoked: 0,
      groupDrawInvoked: 0,
    };
  }

  const registrationSnapshot = cloneEntries(
    listOfficialRegistrationEntries(primaryEvent(tournament, eventId))
  );

  const pairs = pairingFn(individuals, eventType, pairingOptions) || [];
  if (pairingOptions.privatePairingError) {
    return {
      ok: false,
      error: pairingOptions.privatePairingError.message || "Ghép cặp thất bại.",
      pairingInvoked: 1,
      groupDrawInvoked: 0,
    };
  }
  if (!Array.isArray(pairs) || pairs.length < 1) {
    return {
      ok: false,
      error: "Ghép cặp thất bại — không tạo được cặp hợp lệ.",
      pairingInvoked: 1,
      groupDrawInvoked: 0,
    };
  }

  const leftover = sub.eligibleIndividuals.filter((entry) => {
    const id = String((entry.playerIds || [])[0] || "");
    const pairedIds = playerIdSet(pairs);
    return id && !pairedIds.has(id);
  });
  if (leftover.length > 0) {
    return {
      ok: false,
      error: "Không ghép đủ cặp cho mọi VĐV đủ điều kiện (số lẻ hoặc không hợp lệ).",
      pairingInvoked: 1,
      groupDrawInvoked: 0,
    };
  }

  const event = primaryEvent(tournament, eventId);
  if (!event) {
    return {
      ok: false,
      error: "Không tìm thấy nội dung thi đấu.",
      pairingInvoked: 1,
      groupDrawInvoked: 0,
    };
  }

  const normalizedPairs = pairs.map((pair) => ({
    ...pair,
    status: pair.status || ENTRY_STATUS.ACTIVE,
    playerIds: (pair.playerIds || []).map(String),
    origin: OFFICIAL_DRAW_PAIR_ORIGIN,
    registrationRecord: false,
  }));

  const nextEvent = {
    ...event,
    entries: cloneEntries(event.entries || []),
    drawEntries: normalizedPairs,
    groups: event.groups || [],
  };
  const nextTournament = replaceEvent(tournament, event.id, nextEvent);
  const after = projectOfficialDrawSubsteps(nextTournament, event.id);
  const afterRegistrations = listOfficialRegistrationEntries(primaryEvent(nextTournament, event.id));

  if (afterRegistrations.length !== registrationSnapshot.length) {
    return {
      ok: false,
      error: "Ghép cặp không được thay đăng ký cá nhân.",
      pairingInvoked: 1,
      groupDrawInvoked: 0,
    };
  }
  if (afterRegistrations.some(isOfficialPairShapedEntry)) {
    return {
      ok: false,
      error: "Ghép cặp không được ghi cặp vào hồ sơ đăng ký.",
      pairingInvoked: 1,
      groupDrawInvoked: 0,
    };
  }
  if (!after.pairingComplete) {
    return {
      ok: false,
      error: "Ghép cặp không tạo được danh sách cặp dùng được.",
      pairingInvoked: 1,
      groupDrawInvoked: 0,
    };
  }
  if (after.groupsCreated) {
    return {
      ok: false,
      error: "Ghép cặp không được tạo bảng.",
      pairingInvoked: 1,
      groupDrawInvoked: 0,
    };
  }

  return {
    ok: true,
    tournament: nextTournament,
    event: nextEvent,
    pairs: normalizedPairs,
    drawEntries: normalizedPairs,
    registrationEntries: afterRegistrations,
    pairingInvoked: 1,
    groupDrawInvoked: 0,
    substeps: after,
  };
}

export function assertOfficialGroupDrawAllowed(tournament, eventId = "") {
  const sub = projectOfficialDrawSubsteps(tournament, eventId);
  if (sub.registrationModeUnresolved) {
    return {
      ok: false,
      error: "Chưa xác định chế độ đăng ký.",
      pairingInvoked: 0,
      groupDrawInvoked: 0,
      substeps: sub,
    };
  }
  if (
    sub.registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL &&
    !sub.singlesContent &&
    !sub.pairingComplete
  ) {
    return {
      ok: false,
      error: "Cần ghép cặp trước khi chia bảng.",
      pairingInvoked: 0,
      groupDrawInvoked: 0,
      substeps: sub,
    };
  }
  if (!sub.groupDrawReady && !sub.groupsCreated) {
    return {
      ok: false,
      error: sub.summary || "Chưa sẵn sàng chia bảng.",
      pairingInvoked: 0,
      groupDrawInvoked: 0,
      substeps: sub,
    };
  }
  return {
    ok: true,
    pairingInvoked: 0,
    groupDrawInvoked: 0,
    substeps: sub,
  };
}

/**
 * Group-draw units: generated pairs for individual doubles; registered entries otherwise.
 * Never returns raw individual registrations once pairs are materialized.
 */
export function getOfficialGroupDrawUnits(tournament, eventId = "") {
  const gate = assertOfficialGroupDrawAllowed(tournament, eventId);
  if (!gate.ok) {
    return { ...gate, units: [], source: null };
  }
  const sub = gate.substeps;
  if (
    sub.registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL &&
    !sub.singlesContent
  ) {
    return {
      ok: true,
      units: sub.formedPairs,
      source: "drawEntries",
      pairingInvoked: 0,
      groupDrawInvoked: 0,
      substeps: sub,
    };
  }
  const event = primaryEvent(tournament, eventId);
  const eligible = filterDrawEligibleEntries(listOfficialRegistrationEntries(event), tournament);
  return {
    ok: true,
    units: eligible,
    source: "entries",
    pairingInvoked: 0,
    groupDrawInvoked: 0,
    substeps: sub,
  };
}

/** Keep registration + draw materialization when applying a group-draw plan event. */
export function preserveOfficialRegistrationOnGroupDrawEvent(originalEvent, plannedEvent) {
  if (!plannedEvent) return plannedEvent;
  return {
    ...plannedEvent,
    entries: Array.isArray(originalEvent?.entries)
      ? originalEvent.entries
      : plannedEvent.entries,
    drawEntries: Array.isArray(originalEvent?.drawEntries)
      ? originalEvent.drawEntries
      : plannedEvent.drawEntries || [],
    groups: plannedEvent.groups,
    matches: plannedEvent.matches,
  };
}

export function applyOfficialGroupDrawPreservingRegistration(tournament, plannedEvent) {
  const original = primaryEvent(tournament, plannedEvent?.id || "");
  const merged = preserveOfficialRegistrationOnGroupDrawEvent(original, plannedEvent);
  if (!merged?.id) {
    return { ok: false, error: "Thiếu nội dung sau chia bảng." };
  }
  return {
    ok: true,
    tournament: replaceEvent(tournament, merged.id, merged),
    event: merged,
  };
}

/** UI contract: candidate click / filter / search never persist. */
export const OFFICIAL_REGISTRATION_LOCAL_SELECTION = Object.freeze({
  candidateClickPersistsTournament: false,
  searchReloadsTournament: false,
  filterReloadsTournament: false,
  tabSwitchReloadsTournament: false,
  explicitRegisterPersists: true,
});

export const OFFICIAL_REGISTRATION_FORBIDDEN_LABELS = Object.freeze([
  "Bắt đầu trình chiếu",
  "Chia bảng → bước Bốc thăm",
  "Chia bảng → Bước Bốc thăm",
]);
