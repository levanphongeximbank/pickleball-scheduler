/**
 * Wave O2 — Official experience command delegation.
 * Calls existing Official/Open engines only. Returns patches for
 * updateTournamentCommand / setTournamentStatusCommand. No new writers.
 */

import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import {
  buildIdentityPatch,
  buildAddOfficialEventPatch,
  buildUpdateEventPatch,
} from "../experience-a1/settingsWriters.js";
import {
  getOfficialCompetitionSettings,
  normalizeOfficialTournamentName,
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_SCORING_METHOD,
  BEST_OF_3_OPERATIONAL,
  SIDEOUT_OPERATIONAL,
  patchOfficialCompetitionSettings,
  parseOfficialDecimalLevelInput,
} from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  getEligibilityRules,
  patchOfficialVisibleEligibilityLimits,
} from "../../individual-tournament/engines/eligibilityEngine.js";
import {
  getRegistrationSettings,
  isRegistrationLocked,
  lockRegistration,
  setRegistrationWindow,
} from "../../individual-tournament/engines/registrationEngine.js";
import { gatedApproveEntry } from "../../individual-tournament/engines/registrationValidation.js";
import {
  formOfficialIndividualPairs,
  projectOfficialDrawSubsteps,
} from "../../individual-tournament/engines/officialDrawOrchestrationEngine.js";
import { OFFICIAL_PAIRING_AUTHORITY } from "../../individual-tournament/engines/officialCompetitionStrategyEngine.js";
import {
  suggestOpenRandomEntriesFromPlayers,
  suggestBalancedEntriesFromIndividuals,
} from "../../../tournament/engines/teamPairingEngine.js";
import { resolveSelectedEvent, listTournamentEvents } from "../experience-a1/deriveOverview.js";
import { OFFICIAL_EXPERIENCE_AUTHORITY } from "./authorityLock.js";
import {
  PAIR_FORMATION_MODE,
  resolveOfficialPairFormationMode,
} from "./pairFormationModeResolver.js";

function trim(value) {
  return value != null ? String(value).trim() : "";
}

function tournamentPatchFrom(nextTournament, keys = []) {
  if (!nextTournament || typeof nextTournament !== "object") return {};
  const patch = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(nextTournament, key)) {
      patch[key] = nextTournament[key];
    }
  }
  return patch;
}

/**
 * Derive publication CTA state from existing registration/status domain.
 * Not a second publication authority.
 */
export function resolveOfficialRegistrationPublicationStatus(tournament) {
  const settings = getRegistrationSettings(tournament);
  if (settings.lockedAt || settings.closedAt) return "PUBLISHED";
  const status = String(tournament?.status || "");
  if (
    status === TOURNAMENT_STATUS.REGISTRATION ||
    status === TOURNAMENT_STATUS.READY ||
    status === TOURNAMENT_STATUS.ACTIVE ||
    status === TOURNAMENT_STATUS.COMPLETED
  ) {
    return "PUBLISHED";
  }
  if (settings.opensAt) return "PUBLISHED";
  return "NOT_PUBLISHED";
}

export function projectOfficialSettings(tournament, { selectedEventId } = {}) {
  const events = listTournamentEvents(tournament);
  const selectedEvent = resolveSelectedEvent(events, selectedEventId);
  const competition = getOfficialCompetitionSettings(tournament);
  const eligibility = getEligibilityRules(tournament);
  const registration = getRegistrationSettings(tournament);

  return {
    identity: {
      tournamentId: trim(tournament?.id),
      name: trim(tournament?.name),
      hostClubName: trim(tournament?.hostClubName),
      officialMode: tournament?.officialMode || null,
      status: trim(tournament?.status),
    },
    events: events.map((event) => ({
      id: String(event.id),
      name: String(event.name || ""),
      eventType: event.eventType || "",
    })),
    selectedEventId: trim(selectedEventId),
    selectedEvent: selectedEvent
      ? {
          id: String(selectedEvent.id),
          name: String(selectedEvent.name || ""),
          eventType: selectedEvent.eventType || "",
        }
      : null,
    selectedEventExplicit: Boolean(trim(selectedEventId)) || events.length === 1,
    competition: {
      registrationMode: competition.registrationMode,
      groupCount: competition.groupCount,
      qualifiersPerGroup: competition.qualifiersPerGroup,
      scoringMethod: competition.scoringMethod,
      scoringMethodRequested: competition.scoringMethodRequested,
      matchFormat: competition.matchFormat,
      matchFormatRequested: competition.matchFormatRequested,
      roundTargets: competition.roundTargets,
    },
    scoringCapabilities: {
      rally: true,
      sideOut: SIDEOUT_OPERATIONAL,
      bestOf1: true,
      bestOf3: BEST_OF_3_OPERATIONAL,
      winBy: false,
      changeEnd: false,
    },
    eligibility: {
      maxLevel: eligibility?.skill?.maxLevel ?? null,
      maxRating: eligibility?.rating?.maxRating ?? null,
    },
    registrationWindow: {
      opensAt: registration.opensAt || null,
      closesAt: registration.closesAt || null,
      maxEntries: registration.maxEntries ?? null,
      lockedAt: registration.lockedAt || null,
      closedAt: registration.closedAt || null,
    },
    authorities: {
      settings: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SETTINGS,
      event: "official-open-event-domain",
      registrationSettings: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION,
      eligibility: "official-open-eligibility-engine",
      scoringRules: "official-open-scoring-rules-settings",
    },
  };
}

export function projectOfficialRegistration(tournament, { selectedEventId } = {}) {
  const events = listTournamentEvents(tournament);
  const selectedEvent = resolveSelectedEvent(events, selectedEventId);
  const registration = getRegistrationSettings(tournament);
  const publicationStatus = resolveOfficialRegistrationPublicationStatus(tournament);
  const entries = Array.isArray(selectedEvent?.entries) ? selectedEvent.entries : [];

  return {
    publicationStatus,
    publicationPublished: publicationStatus === "PUBLISHED",
    registrationLocked: isRegistrationLocked(tournament),
    window: {
      opensAt: registration.opensAt || null,
      closesAt: registration.closesAt || null,
      maxEntries: registration.maxEntries ?? null,
      lockedAt: registration.lockedAt || null,
      closedAt: registration.closedAt || null,
    },
    selectedEventId: trim(selectedEventId),
    selectedEvent: selectedEvent
      ? { id: String(selectedEvent.id), name: String(selectedEvent.name || "") }
      : null,
    selectedEventExplicit: Boolean(trim(selectedEventId)) || events.length === 1,
    needsEventChoice: events.length > 1 && !trim(selectedEventId),
    entryCount: entries.length,
    pendingCount: entries.filter((entry) => entry?.status === "pending").length,
    approvedCount: entries.filter(
      (entry) => entry?.status === "approved" || entry?.status === "active"
    ).length,
    rejectedCount: entries.filter((entry) => entry?.status === "rejected").length,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION,
  };
}

export function projectOfficialParticipants(tournament, { selectedEventId } = {}) {
  const events = listTournamentEvents(tournament);
  const selectedEvent = resolveSelectedEvent(events, selectedEventId);
  const competition = getOfficialCompetitionSettings(tournament);
  const entries = Array.isArray(selectedEvent?.entries) ? selectedEvent.entries : [];
  const registrationMode = competition.registrationMode;

  const rows = entries.map((entry) => {
    const playerIds = Array.isArray(entry?.playerIds)
      ? entry.playerIds.map(String).filter(Boolean)
      : [];
    const unit =
      registrationMode === "pair" || playerIds.length >= 2 ? "pair" : "individual";
    return {
      entryId: String(entry.id || ""),
      name: String(entry.name || "").trim() || "—",
      playerIds,
      unit,
      status: entry.status || "",
      clubName: String(entry.clubName || entry.club || "").trim() || null,
    };
  });

  return {
    selectedEventId: trim(selectedEventId),
    selectedEvent: selectedEvent
      ? { id: String(selectedEvent.id), name: String(selectedEvent.name || "") }
      : null,
    selectedEventExplicit: Boolean(trim(selectedEventId)) || events.length === 1,
    needsEventChoice: events.length > 1 && !trim(selectedEventId),
    registrationMode,
    officialMode: tournament?.officialMode || null,
    rows,
    total: rows.length,
    individualCount: rows.filter((row) => row.unit === "individual").length,
    pairCount: rows.filter((row) => row.unit === "pair").length,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PARTICIPANT,
  };
}

/** Build persist patch for Official settings save (single explicit Save). */
export function buildOfficialSettingsSavePatch(tournament, draft = {}) {
  const nameResult = normalizeOfficialTournamentName(
    draft.name != null ? draft.name : tournament?.name
  );
  if (!nameResult.ok) {
    return { ok: false, error: nameResult.error || "Tên giải không hợp lệ." };
  }

  const scoringMethod = draft.scoringMethod || OFFICIAL_SCORING_METHOD.RALLY;
  if (scoringMethod === OFFICIAL_SCORING_METHOD.SIDE_OUT && !SIDEOUT_OPERATIONAL) {
    return {
      ok: false,
      error: "SIDE_OUT chưa hỗ trợ trên Official classic path. Giữ RALLY.",
      code: "SIDE_OUT_UNSUPPORTED",
    };
  }
  const matchFormat = draft.matchFormat || OFFICIAL_MATCH_FORMAT.BEST_OF_1;
  if (matchFormat === OFFICIAL_MATCH_FORMAT.BEST_OF_3 && !BEST_OF_3_OPERATIONAL) {
    return {
      ok: false,
      error: "BEST_OF_3 chưa hỗ trợ trên Official classic path. Giữ BEST_OF_1.",
      code: "BEST_OF_3_UNSUPPORTED",
    };
  }

  let next = tournament;
  try {
    next = patchOfficialCompetitionSettings(next, {
      registrationMode: draft.registrationMode,
      scoringMethod,
      matchFormat,
      groupCount: draft.groupCount,
      qualifiersPerGroup: draft.qualifiersPerGroup,
      roundTargets: draft.roundTargets,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err || "Không lưu được cài đặt."),
      code: err?.code || "SETTINGS_PATCH_FAILED",
    };
  }

  const skillParsed = parseOfficialDecimalLevelInput(draft.maxLevel);
  const ratingParsed = parseOfficialDecimalLevelInput(draft.maxRating);
  if (!skillParsed.ok) {
    return { ok: false, error: skillParsed.error || "Trình độ tối đa không hợp lệ." };
  }
  if (!ratingParsed.ok) {
    return { ok: false, error: ratingParsed.error || "Rating tối đa không hợp lệ." };
  }

  const eligibilityPatch = patchOfficialVisibleEligibilityLimits(next, {
    maxLevel: skillParsed.value,
    maxRating: ratingParsed.value,
  });
  if (!eligibilityPatch.ok) {
    return {
      ok: false,
      error: eligibilityPatch.error || "Không lưu được điều kiện tham gia.",
    };
  }
  next = eligibilityPatch.tournament;

  const identity = buildIdentityPatch({
    name: nameResult.name,
    hostClubName: draft.hostClubName != null ? draft.hostClubName : tournament?.hostClubName,
    officialMode: draft.officialMode,
  });

  return {
    ok: true,
    patch: {
      ...identity,
      settings: next.settings,
    },
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SETTINGS,
  };
}

export function buildOfficialEventMetaPatch(tournament, selectedEventId, eventPatch) {
  const wanted = trim(selectedEventId);
  if (!wanted) {
    return { ok: false, error: "Chọn nội dung trước khi lưu.", code: "EVENT_REQUIRED" };
  }
  return buildUpdateEventPatch(tournament, wanted, eventPatch);
}

export function buildOfficialAddEventPatch(tournament, eventType) {
  return buildAddOfficialEventPatch(tournament, eventType);
}

export function buildOfficialPublishRegistrationPatch(tournament) {
  const status = resolveOfficialRegistrationPublicationStatus(tournament);
  if (status === "PUBLISHED") {
    return { ok: true, alreadyPublished: true, patch: null, nextStatus: null };
  }
  return {
    ok: true,
    alreadyPublished: false,
    patch: { status: TOURNAMENT_STATUS.REGISTRATION },
    nextStatus: TOURNAMENT_STATUS.REGISTRATION,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION,
  };
}

export function buildOfficialRegistrationWindowPatch(tournament, windowPatch, options = {}) {
  const result = setRegistrationWindow(tournament, windowPatch, options);
  if (!result.ok) return result;
  return {
    ok: true,
    patch: tournamentPatchFrom(result.tournament, ["settings", "events", "status"]),
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION,
  };
}

export function buildOfficialCloseRegistrationPatch(tournament, options = {}) {
  const result = lockRegistration(tournament, options);
  if (!result.ok) return result;
  return {
    ok: true,
    alreadyLocked: Boolean(result.alreadyLocked),
    patch: tournamentPatchFrom(result.tournament, ["settings", "events", "status"]),
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_REGISTRATION,
  };
}

export function buildOfficialApproveEntryPatch(tournament, entryId, options = {}) {
  const result = gatedApproveEntry(tournament, entryId, options);
  if (!result.ok) return result;
  return {
    ok: true,
    patch: tournamentPatchFrom(result.tournament, ["events", "settings"]),
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PARTICIPANT,
  };
}

export function buildOfficialRemoveEntryPatch(tournament, selectedEventId, entryId) {
  const wantedEvent = trim(selectedEventId);
  const wantedEntry = trim(entryId);
  if (!wantedEvent) {
    return { ok: false, error: "Chọn nội dung trước khi xóa VĐV.", code: "EVENT_REQUIRED" };
  }
  if (!wantedEntry) {
    return { ok: false, error: "Thiếu entryId.", code: "ENTRY_REQUIRED" };
  }
  const events = listTournamentEvents(tournament);
  const event = events.find((item) => String(item.id) === wantedEvent);
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung.", code: "EVENT_NOT_FOUND" };
  }
  const nextEntries = (Array.isArray(event.entries) ? event.entries : []).filter(
    (entry) => String(entry.id) !== wantedEntry
  );
  const nextEvents = events.map((item) =>
    String(item.id) === wantedEvent ? { ...item, entries: nextEntries } : item
  );
  return {
    ok: true,
    patch: { events: nextEvents },
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PARTICIPANT,
  };
}

/**
 * Screen 06 — form pairs. Explicit operator trigger only.
 * OPEN INDIVIDUAL → suggestOpenRandomEntriesFromPlayers
 * AI BALANCE → suggestBalancedEntriesFromIndividuals
 * OPEN PAIR → fail closed (no re-pair)
 */
export function buildOfficialFormPairsPatch(tournament, options = {}) {
  const selectedEventId = trim(options.selectedEventId || options.eventId);
  const events = listTournamentEvents(tournament);
  if (events.length > 1 && !selectedEventId) {
    return {
      ok: false,
      error: "Chọn nội dung trước khi ghép cặp.",
      code: "EVENT_REQUIRED",
    };
  }
  const event = resolveSelectedEvent(events, selectedEventId);
  if (!event) {
    return {
      ok: false,
      error: "Không tìm thấy nội dung thi đấu.",
      code: "EVENT_NOT_FOUND",
    };
  }

  const modeResolution = resolveOfficialPairFormationMode(tournament);
  if (!modeResolution.ok || modeResolution.mode === PAIR_FORMATION_MODE.NOT_SUPPORTED) {
    return {
      ok: false,
      error: modeResolution.error || "Chế độ ghép cặp không được hỗ trợ.",
      code: modeResolution.code || "PAIR_FORMATION_NOT_SUPPORTED",
    };
  }
  if (modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS) {
    return {
      ok: false,
      error: "Đăng ký theo cặp — không ghép lại. Dùng cặp đã đăng ký.",
      code: "OPEN_PAIR_NO_REPAIR",
      mode: modeResolution.mode,
    };
  }

  const sub = projectOfficialDrawSubsteps(tournament, event.id);
  if (sub.groupsCreated) {
    return {
      ok: false,
      error: "Đã có bảng đấu — không ghép cặp lại khi bảng đã tạo.",
      code: "GROUPS_BLOCK_REPAIR",
    };
  }

  const players = Array.isArray(options.players) ? options.players : [];
  let pairingFn = suggestOpenRandomEntriesFromPlayers;
  if (modeResolution.pairingAuthority === OFFICIAL_PAIRING_AUTHORITY.AI_BALANCE) {
    pairingFn = suggestBalancedEntriesFromIndividuals;
  } else if (modeResolution.pairingAuthority !== OFFICIAL_PAIRING_AUTHORITY.OPEN_RANDOM) {
    return {
      ok: false,
      error: "Authority ghép cặp không hợp lệ.",
      code: "INVALID_PAIRING_AUTHORITY",
    };
  }

  // Guard: Open random must not receive AI Balance writer.
  if (
    modeResolution.mode === PAIR_FORMATION_MODE.RANDOM_PAIRING &&
    pairingFn !== suggestOpenRandomEntriesFromPlayers
  ) {
    return {
      ok: false,
      error: "Open Individual chỉ được ghép ngẫu nhiên.",
      code: "OPEN_RANDOM_AUTHORITY_VIOLATION",
    };
  }
  if (
    modeResolution.mode === PAIR_FORMATION_MODE.AI_BALANCE_PAIRING &&
    pairingFn !== suggestBalancedEntriesFromIndividuals
  ) {
    return {
      ok: false,
      error: "AI Balance phải dùng engine cân bằng hiện có.",
      code: "AI_BALANCE_AUTHORITY_VIOLATION",
    };
  }

  const result = formOfficialIndividualPairs({
    tournament,
    eventId: event.id,
    players,
    eventType: event.eventType,
    pairingFn,
    pairingOptions: {
      ...(options.pairingOptions || {}),
      tournamentId: trim(tournament?.id),
      eventId: event.id,
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error || "Ghép cặp thất bại.",
      code: "FORM_PAIRS_FAILED",
      pairingInvoked: result.pairingInvoked,
    };
  }

  return {
    ok: true,
    patch: tournamentPatchFrom(result.tournament, ["events"]),
    pairs: result.pairs || result.drawEntries || [],
    mode: modeResolution.mode,
    pairingAuthority: modeResolution.pairingAuthority,
    usesRating: modeResolution.usesRating === true,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PAIRING,
  };
}

export function projectOfficialPairFormation(tournament, { selectedEventId } = {}) {
  const events = listTournamentEvents(tournament);
  const event = resolveSelectedEvent(events, selectedEventId);
  const modeResolution = resolveOfficialPairFormationMode(tournament);
  const sub = event
    ? projectOfficialDrawSubsteps(tournament, event.id)
    : null;

  return {
    modeResolution,
    selectedEventId: trim(selectedEventId),
    selectedEvent: event
      ? { id: String(event.id), name: String(event.name || ""), eventType: event.eventType }
      : null,
    selectedEventExplicit: Boolean(trim(selectedEventId)) || events.length === 1,
    needsEventChoice: events.length > 1 && !trim(selectedEventId),
    substeps: sub,
    pairingComplete: Boolean(sub?.pairingComplete),
    groupsCreated: Boolean(sub?.groupsCreated),
    formPairsEnabled:
      modeResolution.ok &&
      (modeResolution.mode === PAIR_FORMATION_MODE.RANDOM_PAIRING ||
        modeResolution.mode === PAIR_FORMATION_MODE.AI_BALANCE_PAIRING) &&
      Boolean(event) &&
      !sub?.groupsCreated &&
      !sub?.singlesContent,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PAIRING,
  };
}

export const OFFICIAL_COMMAND_DELEGATION_MAP = Object.freeze({
  saveSettings: "buildOfficialSettingsSavePatch → updateTournamentCommand",
  saveEventMeta: "buildUpdateEventPatch → updateTournamentCommand",
  addEvent: "buildAddOfficialEventPatch → updateTournamentCommand",
  publishRegistration: "status → REGISTRATION via update/setStatus",
  saveRegistrationWindow: "setRegistrationWindow → updateTournamentCommand",
  closeRegistration: "lockRegistration → updateTournamentCommand",
  approveEntry: "gatedApproveEntry → updateTournamentCommand",
  removeEntry: "event.entries filter persist → updateTournamentCommand",
  formPairs:
    "resolveOfficialPairFormationMode → formOfficialIndividualPairs(suggestOpenRandomEntriesFromPlayers|suggestBalancedEntriesFromIndividuals) → event.drawEntries",
  presentPairDraw:
    "listOfficialPairDrawUnits → buildPairingSteps (presentation only; mutates=false)",
});
