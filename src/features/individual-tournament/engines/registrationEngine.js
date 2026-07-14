/**
 * Individual tournament registration lifecycle (S1-B).
 * Blob-first — does not modify draw engine or S1-A publishDrawEngine internals.
 */
import {
  ENTRY_STATUS,
  EVENT_TYPE,
  TOURNAMENT_STATUS,
} from "../../../models/tournament/constants.js";
import {
  createEntryRecord,
  isCountableRegistrationEntry,
  isDrawEligibleEntry,
  normalizeEntry,
} from "../../../models/tournament/entry.js";
import { isDrawPublished } from "../../../tournament/engines/publishDrawEngine.js";
import { writeAuditLog } from "../../identity/services/auditService.js";

export const REGISTRATION_AUDIT_ACTIONS = Object.freeze({
  WINDOW_UPDATED: "registration_window_updated",
  SUBMITTED: "registration_submitted",
  APPROVED: "registration_approved",
  REJECTED: "registration_rejected",
  WAITLISTED: "registration_waitlisted",
  PROMOTED: "registration_waitlist_promoted",
  CANCELLED: "registration_cancelled",
  LOCKED: "registration_locked",
  PARTNER_CONFIRMED: "registration_partner_confirmed",
  PARTNER_CHANGED: "registration_partner_changed",
});

const AUDIT_CAP = 100;
const SINGLE_EVENT_TYPES = new Set([EVENT_TYPE.MEN_SINGLE, EVENT_TYPE.WOMEN_SINGLE]);

function cloneTournament(tournament) {
  return JSON.parse(JSON.stringify(tournament));
}

function nowIso(options = {}) {
  return options.now || new Date().toISOString();
}

function actorId(options = {}) {
  return options.userId || options.actor?.id || "";
}

function patchRegistrationSettings(tournament, registrationPatch) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      registration: {
        ...(tournament.settings?.registration || {}),
        ...registrationPatch,
      },
    },
  };
}

function appendRegistrationAudit(tournament, entry, options = {}) {
  const settings = getRegistrationSettings(tournament);
  const auditEntry = {
    id: `reg-audit-${Date.now()}-${(settings.auditLog || []).length}`,
    action: entry.action,
    actor: entry.actor || null,
    actorId: entry.actor?.id || options.userId || "",
    entryId: entry.entryId || "",
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason || "",
    timestamp: nowIso(options),
  };

  const auditLog = [...(settings.auditLog || []), auditEntry].slice(-AUDIT_CAP);
  let next = patchRegistrationSettings(tournament, { ...settings, auditLog });

  void writeAuditLog({
    action: entry.action,
    resourceType: "tournament",
    resourceId: tournament?.id || "",
    clubId: options.clubId || tournament?.clubId || null,
    actor: entry.actor || null,
    metadata: {
      registrationAction: entry.action,
      entryId: entry.entryId || "",
      before: entry.before,
      after: entry.after,
      reason: entry.reason || "",
    },
  }).catch(() => {});

  return { tournament: next, auditEntry };
}

export function normalizeRegistrationSettings(state = {}) {
  const maxEntriesRaw = state.maxEntries;
  const maxEntries =
    maxEntriesRaw == null || maxEntriesRaw === ""
      ? null
      : Number.isFinite(Number(maxEntriesRaw)) && Number(maxEntriesRaw) > 0
        ? Number(maxEntriesRaw)
        : null;

  return {
    opensAt: state.opensAt || state.opens || null,
    closesAt: state.closesAt || state.closes || null,
    lockedAt: state.lockedAt || null,
    lockedBy: state.lockedBy ? String(state.lockedBy).trim() : "",
    closedAt: state.closedAt || null,
    maxEntries,
    auditLog: Array.isArray(state.auditLog) ? state.auditLog : [],
  };
}

export function getRegistrationSettings(tournament) {
  return normalizeRegistrationSettings(tournament?.settings?.registration || {});
}

export function isRegistrationLocked(tournament) {
  const settings = getRegistrationSettings(tournament);
  if (settings.lockedAt) {
    return true;
  }
  if (isDrawPublished(tournament)) {
    return true;
  }
  const status = tournament?.status;
  return (
    status === TOURNAMENT_STATUS.READY ||
    status === TOURNAMENT_STATUS.ACTIVE ||
    status === TOURNAMENT_STATUS.COMPLETED ||
    status === TOURNAMENT_STATUS.CANCELLED
  );
}

export function isWithinRegistrationWindow(tournament, options = {}) {
  const settings = getRegistrationSettings(tournament);
  const now = Date.parse(nowIso(options));
  if (!Number.isFinite(now)) {
    return { ok: false, error: "Thời gian hệ thống không hợp lệ." };
  }

  if (settings.opensAt) {
    const opens = Date.parse(settings.opensAt);
    if (Number.isFinite(opens) && now < opens) {
      return { ok: false, error: "Đăng ký chưa mở.", code: "WINDOW_NOT_OPEN" };
    }
  }

  if (settings.closesAt) {
    const closes = Date.parse(settings.closesAt);
    if (Number.isFinite(closes) && now > closes) {
      return { ok: false, error: "Đăng ký đã đóng theo thời hạn.", code: "WINDOW_CLOSED" };
    }
  }

  return { ok: true };
}

export function canSubmitRegistration(tournament, options = {}) {
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải." };
  }

  if (tournament.status === TOURNAMENT_STATUS.CANCELLED) {
    return { ok: false, error: "Giải đã hủy." };
  }

  if (isRegistrationLocked(tournament)) {
    return {
      ok: false,
      error: "Đăng ký đã khóa (sau bốc thăm / đóng đăng ký).",
      code: "REGISTRATION_LOCKED",
    };
  }

  if (
    tournament.status !== TOURNAMENT_STATUS.REGISTRATION &&
    tournament.status !== TOURNAMENT_STATUS.DRAFT
  ) {
    return {
      ok: false,
      error: "Giải không đang mở đăng ký.",
      code: "STATUS_CLOSED",
    };
  }

  return isWithinRegistrationWindow(tournament, options);
}

export function countApprovedEntries(event) {
  return (event?.entries || []).filter(isDrawEligibleEntry).length;
}

export function countActiveRegistrations(event) {
  return (event?.entries || []).filter(isCountableRegistrationEntry).length;
}

export function listWaitlistedEntries(event) {
  return (event?.entries || [])
    .filter((entry) => entry.status === ENTRY_STATUS.WAITLISTED)
    .sort((a, b) => {
      const ap = a.waitlistPosition ?? Number.MAX_SAFE_INTEGER;
      const bp = b.waitlistPosition ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return String(a.registeredAt || "").localeCompare(String(b.registeredAt || ""));
    });
}

function findEvent(tournament, eventId) {
  const events = tournament?.events || [];
  if (eventId) {
    return events.find((event) => String(event.id) === String(eventId)) || null;
  }
  return events[0] || null;
}

function replaceEvent(tournament, nextEvent) {
  const events = [...(tournament.events || [])];
  const index = events.findIndex((event) => String(event.id) === String(nextEvent.id));
  if (index >= 0) {
    events[index] = nextEvent;
  } else {
    events.push(nextEvent);
  }
  return { ...tournament, events };
}

function nextWaitlistPosition(event) {
  const positions = listWaitlistedEntries(event)
    .map((entry) => entry.waitlistPosition)
    .filter((value) => value != null);
  return positions.length ? Math.max(...positions) + 1 : 1;
}

function hasPlayerConflict(event, playerIds = [], excludeEntryId = null) {
  const wanted = new Set(playerIds.map(String));
  return (event?.entries || []).some((entry) => {
    if (excludeEntryId && String(entry.id) === String(excludeEntryId)) {
      return false;
    }
    if (!isCountableRegistrationEntry(entry)) {
      return false;
    }
    return (entry.playerIds || []).some((id) => wanted.has(String(id)));
  });
}

function generateInviteToken() {
  return `invite-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function setRegistrationWindow(tournament, windowPatch = {}, options = {}) {
  const current = getRegistrationSettings(tournament);
  const next = normalizeRegistrationSettings({
    ...current,
    ...windowPatch,
  });
  let updated = patchRegistrationSettings(tournament, next);
  const audited = appendRegistrationAudit(
    updated,
    {
      action: REGISTRATION_AUDIT_ACTIONS.WINDOW_UPDATED,
      actor: options.actor || null,
      before: {
        opensAt: current.opensAt,
        closesAt: current.closesAt,
        maxEntries: current.maxEntries,
      },
      after: {
        opensAt: next.opensAt,
        closesAt: next.closesAt,
        maxEntries: next.maxEntries,
      },
    },
    options
  );
  return { ok: true, tournament: audited.tournament, registration: next, auditEntry: audited.auditEntry };
}

export function lockRegistration(tournament, options = {}) {
  if (isRegistrationLocked(tournament) && getRegistrationSettings(tournament).lockedAt) {
    return { ok: true, tournament, alreadyLocked: true };
  }

  const settings = getRegistrationSettings(tournament);
  const locked = normalizeRegistrationSettings({
    ...settings,
    lockedAt: nowIso(options),
    lockedBy: actorId(options),
    closedAt: settings.closedAt || nowIso(options),
  });

  let updated = patchRegistrationSettings(tournament, locked);
  if (
    tournament.status === TOURNAMENT_STATUS.DRAFT ||
    tournament.status === TOURNAMENT_STATUS.REGISTRATION
  ) {
    updated = { ...updated, status: TOURNAMENT_STATUS.READY };
  }

  const audited = appendRegistrationAudit(
    updated,
    {
      action: REGISTRATION_AUDIT_ACTIONS.LOCKED,
      actor: options.actor || null,
      after: { lockedAt: locked.lockedAt, status: updated.status },
      reason: options.reason || "registration_lock",
    },
    options
  );

  return { ok: true, tournament: audited.tournament, registration: locked, auditEntry: audited.auditEntry };
}

export function autoCloseRegistrationIfExpired(tournament, options = {}) {
  const settings = getRegistrationSettings(tournament);
  if (!settings.closesAt || settings.lockedAt || settings.closedAt) {
    return { ok: true, tournament, closed: false };
  }

  const windowCheck = isWithinRegistrationWindow(tournament, options);
  if (windowCheck.ok || windowCheck.code !== "WINDOW_CLOSED") {
    return { ok: true, tournament, closed: false };
  }

  const closed = normalizeRegistrationSettings({
    ...settings,
    closedAt: nowIso(options),
  });
  let updated = patchRegistrationSettings(tournament, closed);
  if (tournament.status === TOURNAMENT_STATUS.REGISTRATION) {
    updated = { ...updated, status: TOURNAMENT_STATUS.READY };
  }
  return { ok: true, tournament: updated, closed: true };
}

function resolveInitialStatus(tournament, event, options = {}) {
  const settings = getRegistrationSettings(tournament);
  if (options.forceWaitlist) {
    return ENTRY_STATUS.WAITLISTED;
  }
  if (settings.maxEntries != null) {
    const approvedCount = countApprovedEntries(event);
    if (approvedCount >= settings.maxEntries) {
      return ENTRY_STATUS.WAITLISTED;
    }
  }
  return options.autoApprove ? ENTRY_STATUS.APPROVED : ENTRY_STATUS.PENDING;
}

export function submitRegistration(tournament, payload = {}, options = {}) {
  const gate = canSubmitRegistration(tournament, options);
  if (!gate.ok) {
    return gate;
  }

  const event = findEvent(tournament, payload.eventId);
  if (!event) {
    return { ok: false, error: "Giải chưa có nội dung thi đấu." };
  }

  const playerIds = (payload.playerIds || []).map(String).filter(Boolean);
  const isSingle = SINGLE_EVENT_TYPES.has(event.eventType);
  const expectedCount = isSingle ? 1 : 2;

  if (playerIds.length < 1 || (isSingle && playerIds.length !== 1)) {
    return { ok: false, error: isSingle ? "Cần 1 VĐV cho nội dung đơn." : "Cần ít nhất 1 VĐV." };
  }

  if (!isSingle && playerIds.length > 2) {
    return { ok: false, error: "Đôi tối đa 2 VĐV." };
  }

  if (hasPlayerConflict(event, playerIds)) {
    return { ok: false, error: "VĐV đã đăng ký nội dung này.", code: "DUPLICATE_PLAYER" };
  }

  const needsPartnerInvite = !isSingle && playerIds.length === 1;
  if (!isSingle && playerIds.length === 2 && expectedCount === 2) {
    // complete pair
  } else if (!isSingle && !needsPartnerInvite && playerIds.length !== 2) {
    return { ok: false, error: "Cặp đôi cần đủ 2 VĐV hoặc 1 VĐV + lời mời." };
  }

  let working = autoCloseRegistrationIfExpired(tournament, options).tournament;
  const liveEvent = findEvent(working, event.id);
  const status = resolveInitialStatus(working, liveEvent, options);
  const inviteToken = needsPartnerInvite ? generateInviteToken() : "";

  const entry = createEntryRecord({
    tournamentId: working.id,
    eventId: liveEvent.id,
    name: payload.name || playerIds.map((id) => id).join(" / "),
    playerIds,
    clubName: payload.clubName || "",
    unitName: payload.unitName || "",
    pairType: payload.pairType,
    rating: payload.rating ?? 0,
    status,
    waitlistPosition: status === ENTRY_STATUS.WAITLISTED ? nextWaitlistPosition(liveEvent) : null,
    partnerInviteToken: inviteToken,
    registeredAt: nowIso(options),
  });

  const nextEvent = {
    ...liveEvent,
    entries: [...(liveEvent.entries || []), entry],
  };
  working = replaceEvent(working, nextEvent);

  const audited = appendRegistrationAudit(
    working,
    {
      action: REGISTRATION_AUDIT_ACTIONS.SUBMITTED,
      actor: options.actor || null,
      entryId: entry.id,
      after: { status: entry.status, waitlistPosition: entry.waitlistPosition },
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    entry: normalizeEntry(entry),
    inviteToken: inviteToken || null,
    auditEntry: audited.auditEntry,
  };
}

export function approveEntry(tournament, entryId, options = {}) {
  if (isRegistrationLocked(tournament) && !options.force) {
    return { ok: false, error: "Đăng ký đã khóa.", code: "REGISTRATION_LOCKED" };
  }

  const event = findEvent(tournament, options.eventId);
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung." };
  }

  const entry = (event.entries || []).find((item) => String(item.id) === String(entryId));
  if (!entry) {
    return { ok: false, error: "Không tìm thấy đăng ký." };
  }

  if (
    entry.status !== ENTRY_STATUS.PENDING &&
    entry.status !== ENTRY_STATUS.WAITLISTED &&
    entry.status !== ENTRY_STATUS.DRAFT &&
    entry.status !== ENTRY_STATUS.REJECTED
  ) {
    return { ok: false, error: `Không thể duyệt từ trạng thái ${entry.status}.` };
  }

  if (!SINGLE_EVENT_TYPES.has(event.eventType) && (entry.playerIds || []).length < 2) {
    return { ok: false, error: "Cặp đôi chưa đủ 2 VĐV." };
  }

  const settings = getRegistrationSettings(tournament);
  if (settings.maxEntries != null && countApprovedEntries(event) >= settings.maxEntries) {
    return {
      ok: false,
      error: "Giải đã đủ suất. Chuyển danh sách chờ hoặc tăng sức chứa.",
      code: "AT_CAPACITY",
    };
  }

  const before = { status: entry.status, waitlistPosition: entry.waitlistPosition };
  const nextEntry = normalizeEntry({
    ...entry,
    status: ENTRY_STATUS.APPROVED,
    waitlistPosition: null,
    decidedAt: nowIso(options),
    decidedBy: actorId(options),
    rejectionReason: "",
  });

  const nextEvent = {
    ...event,
    entries: (event.entries || []).map((item) =>
      String(item.id) === String(entryId) ? nextEntry : item
    ),
  };
  let working = replaceEvent(tournament, nextEvent);
  const audited = appendRegistrationAudit(
    working,
    {
      action:
        before.status === ENTRY_STATUS.WAITLISTED
          ? REGISTRATION_AUDIT_ACTIONS.PROMOTED
          : REGISTRATION_AUDIT_ACTIONS.APPROVED,
      actor: options.actor || null,
      entryId,
      before,
      after: { status: nextEntry.status },
    },
    options
  );

  return { ok: true, tournament: audited.tournament, entry: nextEntry, auditEntry: audited.auditEntry };
}

export function rejectEntry(tournament, entryId, options = {}) {
  if (isRegistrationLocked(tournament) && !options.force) {
    return { ok: false, error: "Đăng ký đã khóa.", code: "REGISTRATION_LOCKED" };
  }

  const event = findEvent(tournament, options.eventId);
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung." };
  }

  const entry = (event.entries || []).find((item) => String(item.id) === String(entryId));
  if (!entry) {
    return { ok: false, error: "Không tìm thấy đăng ký." };
  }

  if (entry.status === ENTRY_STATUS.CANCELLED) {
    return { ok: false, error: "Đăng ký đã hủy." };
  }

  const before = { status: entry.status };
  const nextEntry = normalizeEntry({
    ...entry,
    status: ENTRY_STATUS.REJECTED,
    waitlistPosition: null,
    decidedAt: nowIso(options),
    decidedBy: actorId(options),
    rejectionReason: options.reason || "",
  });

  const nextEvent = {
    ...event,
    entries: (event.entries || []).map((item) =>
      String(item.id) === String(entryId) ? nextEntry : item
    ),
  };
  let working = replaceEvent(tournament, nextEvent);
  const audited = appendRegistrationAudit(
    working,
    {
      action: REGISTRATION_AUDIT_ACTIONS.REJECTED,
      actor: options.actor || null,
      entryId,
      before,
      after: { status: nextEntry.status },
      reason: options.reason || "",
    },
    options
  );

  return { ok: true, tournament: audited.tournament, entry: nextEntry, auditEntry: audited.auditEntry };
}

export function waitlistEntry(tournament, entryId, options = {}) {
  if (isRegistrationLocked(tournament) && !options.force) {
    return { ok: false, error: "Đăng ký đã khóa.", code: "REGISTRATION_LOCKED" };
  }

  const event = findEvent(tournament, options.eventId);
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung." };
  }

  const entry = (event.entries || []).find((item) => String(item.id) === String(entryId));
  if (!entry) {
    return { ok: false, error: "Không tìm thấy đăng ký." };
  }

  if (
    entry.status !== ENTRY_STATUS.PENDING &&
    entry.status !== ENTRY_STATUS.APPROVED &&
    entry.status !== ENTRY_STATUS.ACTIVE
  ) {
    return { ok: false, error: `Không thể đưa vào chờ từ ${entry.status}.` };
  }

  const before = { status: entry.status };
  const nextEntry = normalizeEntry({
    ...entry,
    status: ENTRY_STATUS.WAITLISTED,
    waitlistPosition: nextWaitlistPosition(event),
    decidedAt: nowIso(options),
    decidedBy: actorId(options),
  });

  const nextEvent = {
    ...event,
    entries: (event.entries || []).map((item) =>
      String(item.id) === String(entryId) ? nextEntry : item
    ),
  };
  let working = replaceEvent(tournament, nextEvent);
  const audited = appendRegistrationAudit(
    working,
    {
      action: REGISTRATION_AUDIT_ACTIONS.WAITLISTED,
      actor: options.actor || null,
      entryId,
      before,
      after: { status: nextEntry.status, waitlistPosition: nextEntry.waitlistPosition },
    },
    options
  );

  return { ok: true, tournament: audited.tournament, entry: nextEntry, auditEntry: audited.auditEntry };
}

export function promoteFromWaitlist(tournament, options = {}) {
  const event = findEvent(tournament, options.eventId);
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung." };
  }

  const queue = listWaitlistedEntries(event);
  if (!queue.length) {
    return { ok: false, error: "Danh sách chờ trống." };
  }

  const target = options.entryId
    ? queue.find((entry) => String(entry.id) === String(options.entryId))
    : queue[0];

  if (!target) {
    return { ok: false, error: "Không tìm thấy mục trong danh sách chờ." };
  }

  return approveEntry(tournament, target.id, { ...options, eventId: event.id });
}

export function cancelRegistration(tournament, entryId, options = {}) {
  if (isRegistrationLocked(tournament) && !options.force) {
    return { ok: false, error: "Không thể hủy sau khi khóa đăng ký.", code: "REGISTRATION_LOCKED" };
  }

  const event = findEvent(tournament, options.eventId);
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung." };
  }

  const entry = (event.entries || []).find((item) => String(item.id) === String(entryId));
  if (!entry) {
    return { ok: false, error: "Không tìm thấy đăng ký." };
  }

  if (entry.status === ENTRY_STATUS.CANCELLED) {
    return { ok: false, error: "Đăng ký đã hủy." };
  }

  const before = { status: entry.status };
  const nextEntry = normalizeEntry({
    ...entry,
    status: ENTRY_STATUS.CANCELLED,
    waitlistPosition: null,
    cancelledAt: nowIso(options),
    partnerInviteToken: "",
  });

  let entries = (event.entries || []).map((item) =>
    String(item.id) === String(entryId) ? nextEntry : item
  );

  // Soft-remove from list when cancel before lock (T-S1-B05)
  if (options.remove !== false) {
    entries = entries.filter((item) => String(item.id) !== String(entryId));
  }

  const nextEvent = { ...event, entries };
  let working = replaceEvent(tournament, nextEvent);
  const audited = appendRegistrationAudit(
    working,
    {
      action: REGISTRATION_AUDIT_ACTIONS.CANCELLED,
      actor: options.actor || null,
      entryId,
      before,
      after: options.remove ? null : { status: ENTRY_STATUS.CANCELLED },
      reason: options.reason || "player_cancel",
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    entry: options.remove === false ? nextEntry : null,
    auditEntry: audited.auditEntry,
  };
}

export function confirmPartnerInvite(tournament, token, partnerPlayerId, options = {}) {
  const gate = canSubmitRegistration(tournament, options);
  if (!gate.ok) {
    return gate;
  }

  const events = tournament.events || [];
  let foundEvent = null;
  let foundEntry = null;

  for (const event of events) {
    const entry = (event.entries || []).find(
      (item) => item.partnerInviteToken && String(item.partnerInviteToken) === String(token)
    );
    if (entry) {
      foundEvent = event;
      foundEntry = entry;
      break;
    }
  }

  if (!foundEntry) {
    return { ok: false, error: "Token mời không hợp lệ.", code: "INVALID_TOKEN" };
  }

  if ((foundEntry.playerIds || []).includes(String(partnerPlayerId))) {
    return { ok: false, error: "VĐV đã nằm trong đăng ký." };
  }

  if ((foundEntry.playerIds || []).length >= 2) {
    return { ok: false, error: "Cặp đã đủ 2 VĐV." };
  }

  if (hasPlayerConflict(foundEvent, [partnerPlayerId], foundEntry.id)) {
    return { ok: false, error: "VĐV đã đăng ký nội dung này." };
  }

  const before = { playerIds: [...(foundEntry.playerIds || [])] };
  const nextIds = [...foundEntry.playerIds.map(String), String(partnerPlayerId)];
  const partnerName = options.partnerName ? String(options.partnerName).trim() : "";
  const nextEntry = normalizeEntry({
    ...foundEntry,
    playerIds: nextIds,
    name:
      options.entryName ||
      (partnerName ? `${foundEntry.name} / ${partnerName}` : foundEntry.name),
    partnerInviteToken: "",
  });

  const nextEvent = {
    ...foundEvent,
    entries: (foundEvent.entries || []).map((item) =>
      String(item.id) === String(foundEntry.id) ? nextEntry : item
    ),
  };
  let working = replaceEvent(tournament, nextEvent);
  const audited = appendRegistrationAudit(
    working,
    {
      action: REGISTRATION_AUDIT_ACTIONS.PARTNER_CONFIRMED,
      actor: options.actor || null,
      entryId: foundEntry.id,
      before,
      after: { playerIds: nextIds },
    },
    options
  );

  return { ok: true, tournament: audited.tournament, entry: nextEntry, auditEntry: audited.auditEntry };
}

export function changePartner(tournament, entryId, nextPartnerPlayerId, options = {}) {
  if (isRegistrationLocked(tournament)) {
    return { ok: false, error: "Không đổi đồng đội sau khi khóa đăng ký.", code: "REGISTRATION_LOCKED" };
  }

  const event = findEvent(tournament, options.eventId);
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung." };
  }

  if (SINGLE_EVENT_TYPES.has(event.eventType)) {
    return { ok: false, error: "Nội dung đơn không có đồng đội." };
  }

  const entry = (event.entries || []).find((item) => String(item.id) === String(entryId));
  if (!entry) {
    return { ok: false, error: "Không tìm thấy đăng ký." };
  }

  if (
    entry.status !== ENTRY_STATUS.PENDING &&
    entry.status !== ENTRY_STATUS.APPROVED &&
    entry.status !== ENTRY_STATUS.WAITLISTED &&
    entry.status !== ENTRY_STATUS.DRAFT
  ) {
    return { ok: false, error: "Không đổi đồng đội ở trạng thái hiện tại." };
  }

  const keepPlayerId = options.keepPlayerId
    ? String(options.keepPlayerId)
    : String((entry.playerIds || [])[0] || "");
  if (!keepPlayerId) {
    return { ok: false, error: "Thiếu VĐV chính." };
  }

  if (hasPlayerConflict(event, [nextPartnerPlayerId], entry.id)) {
    return { ok: false, error: "Đồng đội mới đã đăng ký nội dung này." };
  }

  const before = { playerIds: [...(entry.playerIds || [])] };
  const nextEntry = normalizeEntry({
    ...entry,
    playerIds: [keepPlayerId, String(nextPartnerPlayerId)],
    partnerInviteToken: "",
  });

  const nextEvent = {
    ...event,
    entries: (event.entries || []).map((item) =>
      String(item.id) === String(entryId) ? nextEntry : item
    ),
  };
  let working = replaceEvent(tournament, nextEvent);
  const audited = appendRegistrationAudit(
    working,
    {
      action: REGISTRATION_AUDIT_ACTIONS.PARTNER_CHANGED,
      actor: options.actor || null,
      entryId,
      before,
      after: { playerIds: nextEntry.playerIds },
    },
    options
  );

  return { ok: true, tournament: audited.tournament, entry: nextEntry, auditEntry: audited.auditEntry };
}

export function listEntriesByStatus(tournament, status, eventId) {
  const event = findEvent(tournament, eventId);
  if (!event) return [];
  return (event.entries || []).filter((entry) => entry.status === status);
}

export function getPlayerRegistrationStatus(tournament, playerId, eventId) {
  const event = findEvent(tournament, eventId);
  if (!event) return null;
  return (
    (event.entries || []).find(
      (entry) =>
        isCountableRegistrationEntry(entry) &&
        (entry.playerIds || []).map(String).includes(String(playerId))
    ) || null
  );
}

export function resolveEventTypeFromQuery(value) {
  const raw = String(value || "").trim().toLowerCase();
  return Object.values(EVENT_TYPE).includes(raw) ? raw : null;
}

export {
  isDrawEligibleEntry,
  isCountableRegistrationEntry,
  ENTRY_STATUS,
  cloneTournament,
};
