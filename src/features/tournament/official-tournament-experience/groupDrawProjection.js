/**
 * Wave O5 — Official Group Draw projection + command patches (Screen 08).
 * Group Draw ≠ Pair Formation ≠ Pair Draw ≠ Schedule.
 *
 * Assignment authority: buildOfficialOpenPlan / assignEntriesOpenConditional
 * (shared OPEN_RANDOM for Open + AI Balance per resolveOfficialGroupDrawDispatch).
 * Lock/publish: publishDrawEngine (settings.draw).
 *
 * O5 persistence boundary: event.groups + settings.draw only.
 * Does NOT write schedule matches / scores / knockout.
 */

import {
  assertOfficialGroupDrawAllowed,
  getOfficialGroupDrawUnits,
  preserveOfficialRegistrationOnGroupDrawEvent,
  projectOfficialDrawSubsteps,
} from "../../individual-tournament/engines/officialDrawOrchestrationEngine.js";
import {
  getOfficialCompetitionSettings,
} from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  OFFICIAL_GROUP_DRAW_AUTHORITY,
  resolveOfficialGroupDrawDispatch,
} from "../../individual-tournament/engines/officialCompetitionStrategyEngine.js";
import {
  buildOfficialOpenPlan,
  buildOfficialOpenPatch,
} from "../../../tournament/engines/officialTournamentEngine.js";
import {
  ANIMATION_MODES,
  buildRandomDrawSteps,
} from "../../../components/tournament/animation/animationUtils.js";
import {
  canRegenerateDraw,
  forceRedrawDraw,
  getDrawPublishStatus,
  lockDraw,
  publishDraw,
  recordDrawCreated,
  reopenDraw,
  resolveDrawReopenPermission,
  summarizeGroups,
  DRAW_PUBLISH_STATUS,
} from "../../../tournament/engines/publishDrawEngine.js";
import { ratingMayInfluenceOpenPairingOrDraw } from "../official-open-adapter-b/activation.js";
import { listTournamentEvents, resolveSelectedEvent } from "../experience-a1/deriveOverview.js";
import { OFFICIAL_EXPERIENCE_AUTHORITY } from "./authorityLock.js";
import { listOfficialPairDrawUnits } from "./pairDrawProjection.js";

function trim(value) {
  return value != null ? String(value).trim() : "";
}

function upsertEvent(events = [], nextEvent) {
  if (!nextEvent?.id) return events;
  const list = Array.isArray(events) ? events : [];
  const idx = list.findIndex((event) => String(event.id) === String(nextEvent.id));
  if (idx < 0) return [...list, nextEvent];
  const copy = list.slice();
  copy[idx] = nextEvent;
  return copy;
}

function countCompletedMatches(event) {
  return (Array.isArray(event?.matches) ? event.matches : []).filter((match) => {
    const status = String(match?.status || "").toLowerCase();
    return (
      status === "completed" ||
      status === "final" ||
      match?.scoreA != null ||
      match?.scoreB != null ||
      match?.winnerId
    );
  }).length;
}

function countKnockoutMatches(event) {
  return (Array.isArray(event?.matches) ? event.matches : []).filter((match) => {
    const stage = String(match?.stage || match?.round || "").toLowerCase();
    return (
      Boolean(match?.bracketMatchId) ||
      stage.includes("knock") ||
      stage.includes("final") ||
      stage.includes("semi") ||
      stage.includes("quarter")
    );
  }).length;
}

function schedulePublished(tournament) {
  const status = String(tournament?.settings?.schedule?.status || "").toLowerCase();
  return status === "published" || status === "locked";
}

/**
 * Downstream safety for redraw — fail closed; do not delete artifacts.
 */
export function resolveOfficialGroupDrawDownstreamGuards(tournament, event) {
  const blockers = [];
  const matchCount = Array.isArray(event?.matches) ? event.matches.length : 0;
  const completed = countCompletedMatches(event);
  const knockout = countKnockoutMatches(event);
  const publish = getDrawPublishStatus(tournament);
  const regen = canRegenerateDraw(tournament);

  if (schedulePublished(tournament)) {
    blockers.push({
      code: "SCHEDULE_PUBLISHED",
      message: "Lịch đã công bố — không chia bảng lại.",
    });
  }
  if (completed > 0) {
    blockers.push({
      code: "RESULTS_EXIST",
      message: "Đã có kết quả trận — không chia bảng lại.",
    });
  }
  if (knockout > 0) {
    blockers.push({
      code: "KNOCKOUT_EXISTS",
      message: "Đã có knockout — không chia bảng lại.",
    });
  }
  if (matchCount > 0) {
    blockers.push({
      code: "MATCHES_EXIST",
      message:
        "Đã có trận trên nội dung — O5 không xóa trận để chia lại. Dùng quy trình legacy/reset đã duyệt nếu cần.",
    });
  }
  if (!regen.ok) {
    blockers.push({
      code: "DRAW_PUBLISH_BLOCKS_REGENERATE",
      message: regen.error || "Bốc thăm đã khóa/công bố — không regenerate.",
    });
  }
  if (publish.status === DRAW_PUBLISH_STATUS.PUBLISHED) {
    blockers.push({
      code: "DRAW_PUBLISHED",
      message: "Bốc thăm đã công bố — cần reopen/force theo quyền trước khi chia lại.",
    });
  }

  return {
    ok: blockers.length === 0,
    blockers,
    matchCount,
    completedMatchCount: completed,
    knockoutMatchCount: knockout,
    drawPublishStatus: publish.status,
    canRegenerateDraw: regen.ok,
  };
}

export function projectOfficialGroupDraw(tournament, { selectedEventId } = {}) {
  const events = listTournamentEvents(tournament);
  const eventId = trim(selectedEventId);
  const needsEventChoice = events.length > 1 && !eventId;
  const event = resolveSelectedEvent(events, eventId);
  const modeDispatch = resolveOfficialGroupDrawDispatch({
    officialMode: tournament?.officialMode,
  });
  const units = event
    ? listOfficialPairDrawUnits(tournament, { selectedEventId: event.id })
    : { ok: false, units: [], code: "EVENT_REQUIRED" };
  const sub = event ? projectOfficialDrawSubsteps(tournament, event.id) : null;
  const competition = getOfficialCompetitionSettings(tournament);
  const publish = getDrawPublishStatus(tournament);
  const groups = Array.isArray(event?.groups) ? event.groups : [];
  const downstream = event
    ? resolveOfficialGroupDrawDownstreamGuards(tournament, event)
    : { ok: true, blockers: [] };

  const gate = event
    ? assertOfficialGroupDrawAllowed(tournament, event.id)
    : { ok: false, error: "Chọn nội dung." };

  const createEnabled =
    !needsEventChoice &&
    Boolean(event) &&
    units.ok &&
    units.units.length >= 2 &&
    gate.ok &&
    groups.length === 0 &&
    modeDispatch.groupDrawAuthority === OFFICIAL_GROUP_DRAW_AUTHORITY.OPEN_RANDOM &&
    ratingMayInfluenceOpenPairingOrDraw() === false;

  const regenerateEnabled =
    !needsEventChoice &&
    Boolean(event) &&
    groups.length > 0 &&
    units.ok &&
    downstream.ok;

  return {
    modeDispatch,
    selectedEventId: eventId,
    selectedEvent: event
      ? { id: String(event.id), name: String(event.name || ""), eventType: event.eventType }
      : null,
    selectedEventExplicit: Boolean(eventId) || events.length === 1,
    needsEventChoice,
    groupCount: competition.groupCount,
    unitsReady: units.ok === true,
    unitCount: units.units?.length || 0,
    unitsSource: units.source || null,
    units: units.units || [],
    groups,
    groupCountCreated: groups.length,
    substeps: sub,
    drawPublish: publish,
    createEnabled,
    regenerateEnabled,
    lockEnabled: groups.length > 0 && publish.status === DRAW_PUBLISH_STATUS.DRAFT,
    publishEnabled: groups.length > 0 && publish.status === DRAW_PUBLISH_STATUS.LOCKED,
    reopenEnabled: publish.status === DRAW_PUBLISH_STATUS.PUBLISHED || publish.status === DRAW_PUBLISH_STATUS.LOCKED,
    presentEnabled: groups.length > 0,
    gate,
    downstream,
    ratingNeutral: ratingMayInfluenceOpenPairingOrDraw() === false,
    usesRating: modeDispatch.usesRating === true,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_GROUP_DRAW,
    blocker: needsEventChoice
      ? { code: "EVENT_REQUIRED", error: "Chọn nội dung trước khi chia bảng." }
      : !units.ok
        ? { code: units.code || "UNITS_MISSING", error: units.error || "Chưa có đơn vị cạnh tranh." }
        : !gate.ok && groups.length === 0
          ? { code: "GROUP_DRAW_NOT_READY", error: gate.error }
          : null,
  };
}

/**
 * Create / regenerate groups via buildOfficialOpenPlan.
 * Persists event.groups (+ preserved entries/drawEntries) and settings.draw created.
 * Strips plan.matches — O5 does not generate schedule matches.
 */
export function buildOfficialCreateGroupDrawPatch(tournament, options = {}) {
  const selectedEventId = trim(options.selectedEventId || options.eventId);
  const events = listTournamentEvents(tournament);
  if (events.length > 1 && !selectedEventId) {
    return { ok: false, code: "EVENT_REQUIRED", error: "Chọn nội dung trước khi chia bảng." };
  }
  const event = resolveSelectedEvent(events, selectedEventId);
  if (!event) {
    return { ok: false, code: "EVENT_NOT_FOUND", error: "Không tìm thấy nội dung thi đấu." };
  }

  const modeDispatch = resolveOfficialGroupDrawDispatch({
    officialMode: tournament?.officialMode,
  });
  if (
    !modeDispatch.ok ||
    modeDispatch.groupDrawAuthority !== OFFICIAL_GROUP_DRAW_AUTHORITY.OPEN_RANDOM ||
    modeDispatch.usesRating === true ||
    ratingMayInfluenceOpenPairingOrDraw() === true
  ) {
    return {
      ok: false,
      code: "DOMAIN_CONFLICT_GROUP_DRAW_NOT_RATING_NEUTRAL",
      error:
        "Group Draw Official phải rating-neutral (buildOfficialOpenPlan). Không dùng AI Balance / rating / seed cho chia bảng.",
    };
  }

  const isRedraw = options.isRedraw === true || (Array.isArray(event.groups) && event.groups.length > 0);
  if (isRedraw) {
    const downstream = resolveOfficialGroupDrawDownstreamGuards(tournament, event);
    if (!downstream.ok) {
      return {
        ok: false,
        code: downstream.blockers[0]?.code || "UNSAFE_REDRAW",
        error: downstream.blockers[0]?.message || "Không chia bảng lại an toàn.",
        blockers: downstream.blockers,
      };
    }
  } else if (Array.isArray(event.groups) && event.groups.length > 0) {
    return {
      ok: false,
      code: "GROUPS_EXIST",
      error: "Đã có bảng — dùng chia lại nếu guard cho phép.",
    };
  }

  const unitsResult = getOfficialGroupDrawUnits(tournament, event.id);
  if (!unitsResult.ok || (unitsResult.units || []).length < 2) {
    return {
      ok: false,
      code: "UNITS_MISSING",
      error: unitsResult.error || "Chưa có đủ cặp/đơn vị để chia bảng.",
    };
  }

  const competition = getOfficialCompetitionSettings(tournament);
  const groupCount = Number(competition.groupCount) || 0;
  if (groupCount < 1) {
    return {
      ok: false,
      code: "GROUP_COUNT_INVALID",
      error: "Số bảng (groupCount) chưa cấu hình hợp lệ trong Cài đặt.",
    };
  }
  if (groupCount > unitsResult.units.length) {
    return {
      ok: false,
      code: "GROUP_COUNT_TOO_LARGE",
      error: `Số bảng (${groupCount}) lớn hơn số đơn vị (${unitsResult.units.length}).`,
    };
  }

  const players = Array.isArray(options.players) ? options.players : [];
  const plan = buildOfficialOpenPlan({
    tournament: {
      ...tournament,
      hostClubName: tournament.hostClubName || options.hostClubName || "",
    },
    entries: unitsResult.units,
    eventType: event.eventType,
    eventId: event.id,
    groupCount,
    players,
    splitUnits: options.splitUnits !== false,
    privatePairingRules: options.privatePairingRules || [],
    pairingConstraints: options.pairingConstraints || [],
    clubId: options.clubId || tournament.clubId || null,
    randomFn: options.randomFn,
  });

  if (!plan.ok) {
    return {
      ok: false,
      code: "GROUP_DRAW_FAILED",
      error: plan.privatePairingError?.message || plan.errors?.join(" ") || "Không chia được bảng.",
      warnings: plan.warnings || [],
    };
  }

  // O5 boundary: keep groups from plan; do not adopt schedule matches.
  const groupsOnlyEvent = {
    ...plan.event,
    matches: Array.isArray(event.matches) ? event.matches : [],
  };
  const patchBase = buildOfficialOpenPatch(tournament, { ...plan, event: groupsOnlyEvent });
  if (!patchBase.ok) {
    return {
      ok: false,
      code: "GROUP_DRAW_APPLY_FAILED",
      error: patchBase.error || "Không áp dụng được bảng.",
    };
  }

  const preserved = preserveOfficialRegistrationOnGroupDrawEvent(event, patchBase.event);
  const nextEvent = {
    ...preserved,
    groups: Array.isArray(preserved.groups) ? preserved.groups : [],
    matches: Array.isArray(event.matches) ? event.matches : [],
  };
  const nextEvents = upsertEvent(patchBase.events, nextEvent);

  let nextTournament = {
    ...tournament,
    events: nextEvents,
    officialMode: tournament.officialMode,
    settings: {
      ...(tournament.settings || {}),
      ...(patchBase.settings || {}),
      openDraw: {
        ...((tournament.settings || {}).openDraw || {}),
        splitUnits: options.splitUnits !== false,
        drawScore: patchBase.drawScore,
        updatedAt: new Date().toISOString(),
        groupDrawAuthority: OFFICIAL_GROUP_DRAW_AUTHORITY.OPEN_RANDOM,
        usesRating: false,
      },
    },
  };

  const created = recordDrawCreated(nextTournament, nextEvent.groups || [], {
    userId: options.userId,
    actor: options.actor || null,
    clubId: options.clubId || tournament.clubId,
    before: isRedraw ? summarizeGroups(event.groups || []) : null,
  });
  if (created.ok) {
    nextTournament = {
      ...nextTournament,
      settings: created.tournament.settings,
    };
  }

  return {
    ok: true,
    patch: {
      events: nextTournament.events,
      settings: nextTournament.settings,
      officialMode: nextTournament.officialMode,
    },
    groups: nextEvent.groups,
    groupCount: nextEvent.groups.length,
    unitCount: unitsResult.units.length,
    isRedraw,
    usesRating: false,
    groupDrawAuthority: OFFICIAL_GROUP_DRAW_AUTHORITY.OPEN_RANDOM,
    drawPublish: getDrawPublishStatus(nextTournament),
    persistedFields: ["events[].groups", "events[].entries(preserved)", "events[].drawEntries(preserved)", "settings.draw", "settings.openDraw"],
    strippedMatches: true,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_GROUP_DRAW,
  };
}

export function buildOfficialLockGroupDrawPatch(tournament, options = {}) {
  const selectedEventId = trim(options.selectedEventId || options.eventId);
  const event = resolveSelectedEvent(listTournamentEvents(tournament), selectedEventId);
  if (!event) {
    return { ok: false, code: "EVENT_NOT_FOUND", error: "Không tìm thấy nội dung." };
  }
  const groups = Array.isArray(event.groups) ? event.groups : [];
  const result = lockDraw(tournament, groups, {
    userId: options.userId,
    actor: options.actor || null,
  });
  if (!result.ok) {
    return { ok: false, code: "LOCK_FAILED", error: result.error };
  }
  return {
    ok: true,
    patch: { settings: result.tournament.settings },
    drawPublish: result.drawPublish,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_GROUP_DRAW,
  };
}

export function buildOfficialPublishGroupDrawPatch(tournament, options = {}) {
  const selectedEventId = trim(options.selectedEventId || options.eventId);
  const event = resolveSelectedEvent(listTournamentEvents(tournament), selectedEventId);
  if (!event) {
    return { ok: false, code: "EVENT_NOT_FOUND", error: "Không tìm thấy nội dung." };
  }
  const groups = Array.isArray(event.groups) ? event.groups : [];
  const result = publishDraw(tournament, groups, {
    userId: options.userId,
    actor: options.actor || null,
  });
  if (!result.ok) {
    return { ok: false, code: "PUBLISH_FAILED", error: result.error };
  }
  return {
    ok: true,
    patch: { settings: result.tournament.settings },
    drawPublish: result.drawPublish,
    mutatesGroups: false,
    mutatesMatches: false,
    mutatesSchedule: false,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_GROUP_DRAW,
  };
}

export function buildOfficialReopenGroupDrawPatch(tournament, options = {}) {
  const allowed = resolveDrawReopenPermission({
    canPermission: options.canPermission,
    rbacEnabled: options.rbacEnabled === true,
    canIntervene: options.canIntervene === true,
  });
  if (!allowed) {
    return {
      ok: false,
      code: "REOPEN_DENIED",
      error: "Không có quyền mở lại bốc thăm chia bảng.",
    };
  }
  const downstream = resolveOfficialGroupDrawDownstreamGuards(
    tournament,
    resolveSelectedEvent(listTournamentEvents(tournament), trim(options.selectedEventId))
  );
  // Reopen publish state only — still fail if results/knockout exist
  const hard = (downstream.blockers || []).filter((item) =>
    ["RESULTS_EXIST", "KNOCKOUT_EXISTS", "SCHEDULE_PUBLISHED"].includes(item.code)
  );
  if (hard.length) {
    return {
      ok: false,
      code: hard[0].code,
      error: hard[0].message,
      blockers: hard,
    };
  }

  const result = reopenDraw(tournament, {
    userId: options.userId,
    actor: options.actor || null,
    reason: options.reason || "canonical_group_draw_reopen",
  });
  if (!result.ok) {
    return { ok: false, code: "REOPEN_FAILED", error: result.error };
  }
  return {
    ok: true,
    patch: { settings: result.tournament.settings },
    drawPublish: result.drawPublish,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_GROUP_DRAW,
  };
}

export function buildOfficialRegenerateGroupDrawPatch(tournament, options = {}) {
  const selectedEventId = trim(options.selectedEventId || options.eventId);
  const event = resolveSelectedEvent(listTournamentEvents(tournament), selectedEventId);
  if (!event) {
    return { ok: false, code: "EVENT_NOT_FOUND", error: "Không tìm thấy nội dung." };
  }

  let working = tournament;
  const publish = getDrawPublishStatus(tournament);
  if (publish.status === DRAW_PUBLISH_STATUS.PUBLISHED) {
    const forced = forceRedrawDraw(tournament, {
      userId: options.userId,
      actor: options.actor || null,
      reason: options.reason || "canonical_group_draw_force_redraw",
    });
    if (!forced.ok) {
      return { ok: false, code: "FORCE_REDRAW_FAILED", error: forced.error };
    }
    working = forced.tournament;
  }

  return buildOfficialCreateGroupDrawPatch(working, {
    ...options,
    selectedEventId,
    isRedraw: true,
  });
}

/** Presentation only — visualizes existing groups. */
export function buildOfficialPresentGroupDraw(tournament, options = {}) {
  const selectedEventId = trim(options.selectedEventId || options.eventId);
  const event = resolveSelectedEvent(listTournamentEvents(tournament), selectedEventId);
  if (!event) {
    return { ok: false, code: "EVENT_NOT_FOUND", error: "Không tìm thấy nội dung." };
  }
  const groups = Array.isArray(event.groups) ? event.groups : [];
  if (!groups.length) {
    return {
      ok: false,
      code: "GROUPS_MISSING",
      error: "Chưa có bảng để trình chiếu.",
    };
  }
  return {
    ok: true,
    mutates: false,
    presentation: {
      animationMode: ANIMATION_MODES.RANDOM_DRAW,
      steps: buildRandomDrawSteps(groups),
      groups,
      title: "Trình chiếu chia bảng",
      subtitle: "Hiệu ứng — không đổi membership bảng / không ghi hồ sơ",
    },
    groupCount: groups.length,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_GROUP_DRAW,
  };
}
