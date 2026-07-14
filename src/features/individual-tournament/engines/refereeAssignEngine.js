/**
 * S1-F — Individual tournament referee assignment (blob-first).
 * Closes S1-GAP-061 / soft S1-GAP-100 (assignment-row scoped on blob).
 */

import { createId } from "../../../utils/id.js";
import {
  getRefereeSettings,
  upsertRefereeRosterEntry,
  createRefereeRosterEntry,
  findRefereeRosterEntry,
  normalizeRefereeRoster,
} from "../../../models/tournament/refereeRoster.js";
import {
  assignRefereeToMatch,
  patchRefereeInTournament,
  resolveMatchLabels,
} from "../../../tournament/engines/refereeEngine.js";

export const REFEREE_ASSIGN_STATUS = Object.freeze({
  ASSIGNED: "assigned",
  REVOKED: "revoked",
});

export const REFEREE_ASSIGN_AUDIT = Object.freeze({
  ASSIGNED: "referee_assigned",
  CHANGED: "referee_changed",
  REVOKED: "referee_revoked",
  AUTO_ASSIGNED: "referee_auto_assigned",
});

const AUDIT_LOG_CAP = 80;
const COMMAND_IDS_CAP = 200;

function nowIso(now) {
  return now || new Date().toISOString();
}

function patchTournamentSettings(tournament, settingsPatch) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      ...settingsPatch,
    },
  };
}

function getPropagationBlob(tournament) {
  const raw = tournament?.settings?.resultPropagation || {};
  return {
    auditLog: Array.isArray(raw.auditLog) ? raw.auditLog : [],
    processedCommandIds: Array.isArray(raw.processedCommandIds)
      ? raw.processedCommandIds
      : [],
  };
}

function appendAssignAudit(tournament, entry, options = {}) {
  const blob = getPropagationBlob(tournament);
  const auditEntry = {
    id: createId("ref-audit"),
    action: entry.action,
    matchId: entry.matchId || "",
    eventId: entry.eventId || "",
    refereeId: entry.refereeId || "",
    refereeName: entry.refereeName || "",
    previousRefereeId: entry.previousRefereeId || "",
    actor: entry.actor || null,
    actorId: entry.actor?.id || options.userId || "",
    reason: entry.reason || "",
    timestamp: nowIso(options.now),
  };

  return patchTournamentSettings(tournament, {
    resultPropagation: {
      ...blob,
      auditLog: [...blob.auditLog, auditEntry].slice(-AUDIT_LOG_CAP),
    },
  });
}

export function normalizeAssignmentEntry(raw = {}, matchId = "") {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const rosterId = raw.rosterId ? String(raw.rosterId).trim() : "";
  const refereeName = String(raw.refereeName || raw.name || "").trim();
  if (!rosterId && !refereeName) {
    return null;
  }

  const status = Object.values(REFEREE_ASSIGN_STATUS).includes(raw.status)
    ? raw.status
    : REFEREE_ASSIGN_STATUS.ASSIGNED;

  return {
    matchId: String(raw.matchId || matchId).trim(),
    eventId: raw.eventId ? String(raw.eventId).trim() : "",
    rosterId,
    refereeName: refereeName || rosterId,
    token: raw.token ? String(raw.token) : "",
    status,
    assignedAt: raw.assignedAt || null,
    assignedBy: raw.assignedBy ? String(raw.assignedBy).trim() : "",
    revokedAt: raw.revokedAt || null,
    reason: raw.reason ? String(raw.reason).trim() : "",
  };
}

export function getRefereeAssignments(tournament) {
  const raw = tournament?.settings?.refereeAssignments;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  return Object.entries(raw).reduce((acc, [matchId, value]) => {
    // Legacy team-style: matchId → refereeId string
    if (typeof value === "string") {
      const rosterId = value.trim();
      if (rosterId) {
        const roster = getRefereeSettings(tournament).roster;
        const entry = findRefereeRosterEntry(roster, rosterId);
        acc[String(matchId)] = normalizeAssignmentEntry(
          {
            matchId,
            rosterId,
            refereeName: entry?.name || rosterId,
            status: REFEREE_ASSIGN_STATUS.ASSIGNED,
          },
          matchId
        );
      }
      return acc;
    }

    const normalized = normalizeAssignmentEntry(value, matchId);
    if (normalized && normalized.status !== REFEREE_ASSIGN_STATUS.REVOKED) {
      acc[String(matchId)] = normalized;
    }
    return acc;
  }, {});
}

export function listIndividualReferees(tournament) {
  return getRefereeSettings(tournament).roster.filter((r) => r.active !== false);
}

export function addIndividualReferee(tournament, options = {}) {
  const entry = createRefereeRosterEntry({
    name: options.name,
    phone: options.phone,
  });
  if (!entry?.name) {
    return { ok: false, error: "Tên trọng tài không được để trống." };
  }

  const { roster, courtReferees } = getRefereeSettings(tournament);
  if (roster.some((r) => r.name.toLowerCase() === entry.name.toLowerCase())) {
    return { ok: false, error: "Trọng tài đã có trong danh sách." };
  }

  const nextRoster = upsertRefereeRosterEntry(roster, entry);
  return {
    ok: true,
    tournament: patchTournamentSettings(tournament, {
      refereeRoster: nextRoster,
      courtReferees,
    }),
    referee: entry,
  };
}

export function collectEventMatches(tournament, eventId = "") {
  const events = tournament?.events || [];
  const matches = [];

  events.forEach((event) => {
    if (eventId && String(event.id) !== String(eventId)) return;
    (event.matches || []).forEach((match) => {
      matches.push({
        ...match,
        eventId: event.id,
        eventName: event.name || event.eventType || event.id,
      });
    });
  });

  const engineMatches = tournament?.settings?.engineV4?.matches || [];
  if (!eventId && engineMatches.length && matches.length === 0) {
    engineMatches.forEach((match) => {
      matches.push({ ...match, eventId: match.eventId || "", eventName: "Engine" });
    });
  }

  return matches;
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !bStart) return false;
  const as = new Date(aStart).getTime();
  const ae = aEnd ? new Date(aEnd).getTime() : as + 30 * 60 * 1000;
  const bs = new Date(bStart).getTime();
  const be = bEnd ? new Date(bEnd).getTime() : bs + 30 * 60 * 1000;
  if (!Number.isFinite(as) || !Number.isFinite(bs)) return false;
  return as < be && bs < ae;
}

/**
 * Referee unavailable if inactive or already assigned to overlapping match.
 */
export function validateRefereeAvailability(tournament, match, rosterId, options = {}) {
  const roster = listIndividualReferees(tournament);
  const referee = findRefereeRosterEntry(roster, rosterId);
  if (!referee) {
    return { ok: false, error: "Trọng tài không hợp lệ.", code: "REFEREE_NOT_FOUND" };
  }
  if (referee.active === false) {
    return { ok: false, error: "Trọng tài đang không hoạt động.", code: "REFEREE_INACTIVE" };
  }

  const conflicts = detectRefereeConflicts(tournament, match, rosterId, options);
  if (conflicts.length > 0 && !options.allowConflict) {
    return {
      ok: false,
      error: `Xung đột lịch trọng tài với trận ${conflicts.map((c) => c.matchId).join(", ")}.`,
      code: "REFEREE_CONFLICT",
      conflicts,
    };
  }

  return { ok: true, referee, conflicts };
}

export function detectRefereeConflicts(tournament, match, rosterId, options = {}) {
  const assignments = getRefereeAssignments(tournament);
  const allMatches = collectEventMatches(tournament, options.eventId);
  const targetId = String(match?.id || "");
  const targetStart = match?.scheduledStart || match?.scheduledAt || null;
  const targetEnd = match?.scheduledEnd || null;

  const conflicts = [];
  allMatches.forEach((other) => {
    if (String(other.id) === targetId) return;
    const assignment = assignments[String(other.id)];
    if (!assignment || String(assignment.rosterId) !== String(rosterId)) return;

    const otherStart = other.scheduledStart || other.scheduledAt || null;
    const otherEnd = other.scheduledEnd || null;

    if (!targetStart && !otherStart) {
      // Same court at unknown time — soft conflict if same slot
      if (
        match?.courtId &&
        other.courtId &&
        String(match.courtId) === String(other.courtId)
      ) {
        conflicts.push({
          matchId: other.id,
          reason: "same_court_unscheduled",
        });
      }
      return;
    }

    if (intervalsOverlap(targetStart, targetEnd, otherStart, otherEnd)) {
      conflicts.push({
        matchId: other.id,
        reason: "time_overlap",
        scheduledStart: otherStart,
      });
    }
  });

  return conflicts;
}

function writeAssignmentMap(tournament, assignments) {
  return patchTournamentSettings(tournament, {
    refereeAssignments: assignments,
  });
}

function setAssignmentOnMap(assignments, matchId, entry) {
  const next = { ...assignments };
  if (!entry || entry.status === REFEREE_ASSIGN_STATUS.REVOKED) {
    delete next[String(matchId)];
  } else {
    next[String(matchId)] = entry;
  }
  return next;
}

/**
 * Manual assign / reassign referee to a match.
 */
export function assignRefereeToIndividualMatch(tournament, matchId, rosterId, options = {}) {
  const matches = collectEventMatches(tournament, options.eventId);
  const match = matches.find((m) => String(m.id) === String(matchId));
  if (!match) {
    return { ok: false, error: "Không tìm thấy trận." };
  }

  const availability = validateRefereeAvailability(tournament, match, rosterId, options);
  if (!availability.ok) {
    return availability;
  }

  const referee = availability.referee;
  const existing = getRefereeAssignments(tournament)[String(matchId)] || null;
  const isReassign = Boolean(existing?.rosterId && existing.rosterId !== String(rosterId));

  const { match: matchedWithRef, referee: tokenReferee, token } = assignRefereeToMatch(
    match,
    referee.name,
    { rosterId: referee.id }
  );

  const assignment = normalizeAssignmentEntry({
    matchId,
    eventId: match.eventId || options.eventId || "",
    rosterId: referee.id,
    refereeName: referee.name,
    token: token || tokenReferee?.token || "",
    status: REFEREE_ASSIGN_STATUS.ASSIGNED,
    assignedAt: nowIso(options.now),
    assignedBy: options.actor?.id || options.userId || "",
  });

  let nextTournament = writeAssignmentMap(
    tournament,
    setAssignmentOnMap(getRefereeAssignments(tournament), matchId, assignment)
  );

  const patch = patchRefereeInTournament(nextTournament, {
    eventId: match.eventId || options.eventId,
    matchId,
    referee: matchedWithRef.referee,
    isDaily: false,
  });
  if (patch?.events) {
    nextTournament = { ...nextTournament, events: patch.events };
  }

  nextTournament = appendAssignAudit(
    nextTournament,
    {
      action: isReassign ? REFEREE_ASSIGN_AUDIT.CHANGED : REFEREE_ASSIGN_AUDIT.ASSIGNED,
      matchId,
      eventId: assignment.eventId,
      refereeId: referee.id,
      refereeName: referee.name,
      previousRefereeId: existing?.rosterId || "",
      actor: options.actor || null,
      reason: options.reason || (isReassign ? "reassign" : "manual"),
    },
    options
  );

  return {
    ok: true,
    tournament: nextTournament,
    assignment,
    match: matchedWithRef,
    reassigned: isReassign,
    conflicts: availability.conflicts || [],
  };
}

export function reassignReferee(tournament, matchId, rosterId, options = {}) {
  return assignRefereeToIndividualMatch(tournament, matchId, rosterId, {
    ...options,
    reason: options.reason || "reassign",
  });
}

export function unassignRefereeFromMatch(tournament, matchId, options = {}) {
  const assignments = getRefereeAssignments(tournament);
  const existing = assignments[String(matchId)];
  if (!existing) {
    return { ok: false, error: "Trận chưa được phân công trọng tài." };
  }

  const nextMap = { ...assignments };
  delete nextMap[String(matchId)];
  let nextTournament = writeAssignmentMap(tournament, nextMap);

  const matches = collectEventMatches(nextTournament, options.eventId || existing.eventId);
  const match = matches.find((m) => String(m.id) === String(matchId));
  if (match) {
    const patch = patchRefereeInTournament(nextTournament, {
      eventId: match.eventId || existing.eventId,
      matchId,
      referee: null,
      isDaily: false,
    });
    if (patch?.events) {
      nextTournament = { ...nextTournament, events: patch.events };
    }
  }

  nextTournament = appendAssignAudit(
    nextTournament,
    {
      action: REFEREE_ASSIGN_AUDIT.REVOKED,
      matchId,
      eventId: existing.eventId,
      refereeId: existing.rosterId,
      refereeName: existing.refereeName,
      actor: options.actor || null,
      reason: options.reason || "unassign",
    },
    options
  );

  return { ok: true, tournament: nextTournament, matchId: String(matchId) };
}

/**
 * Auto-assign active referees round-robin, skipping conflicts.
 */
export function autoAssignReferees(tournament, options = {}) {
  const referees = listIndividualReferees(tournament);
  if (referees.length === 0) {
    return { ok: false, error: "Chưa có trọng tài trong danh sách." };
  }

  const matches = collectEventMatches(tournament, options.eventId).filter((m) => {
    if (options.onlyUnassigned) {
      return !getRefereeAssignments(tournament)[String(m.id)];
    }
    return true;
  });

  let next = tournament;
  const assigned = [];
  const skipped = [];
  let cursor = 0;

  for (const match of matches) {
    let placed = false;
    for (let attempt = 0; attempt < referees.length; attempt += 1) {
      const referee = referees[(cursor + attempt) % referees.length];
      const result = assignRefereeToIndividualMatch(next, match.id, referee.id, {
        ...options,
        eventId: match.eventId,
        reason: "auto",
        actor: options.actor,
      });
      if (result.ok) {
        next = result.tournament;
        assigned.push({ matchId: match.id, rosterId: referee.id, refereeName: referee.name });
        cursor = (cursor + attempt + 1) % referees.length;
        placed = true;
        break;
      }
    }
    if (!placed) {
      skipped.push({ matchId: match.id, reason: "no_available_referee" });
    }
  }

  if (assigned.length > 0) {
    next = appendAssignAudit(
      next,
      {
        action: REFEREE_ASSIGN_AUDIT.AUTO_ASSIGNED,
        matchId: "",
        refereeName: `${assigned.length} assignments`,
        actor: options.actor || null,
        reason: `auto_assign:${assigned.length}`,
      },
      options
    );
  }

  return {
    ok: true,
    tournament: next,
    assigned,
    skipped,
  };
}

/**
 * Guard: assignment must exist and match token / roster (S1-GAP-100 soft).
 */
export function assertAssignmentScope(tournament, matchId, options = {}) {
  const assignment = getRefereeAssignments(tournament)[String(matchId)];
  if (!assignment) {
    return {
      ok: false,
      error: "Trận chưa có phân công trọng tài trong giải.",
      code: "ASSIGNMENT_MISSING",
    };
  }

  if (options.token && assignment.token && assignment.token !== options.token) {
    return {
      ok: false,
      error: "Token trọng tài không khớp phân công.",
      code: "ASSIGNMENT_TOKEN_MISMATCH",
    };
  }

  if (options.rosterId && assignment.rosterId && assignment.rosterId !== String(options.rosterId)) {
    return {
      ok: false,
      error: "Trọng tài không được phân công trận này.",
      code: "ASSIGNMENT_ROSTER_MISMATCH",
    };
  }

  return { ok: true, assignment };
}

export function listMatchesForReferee(tournament, rosterId) {
  const assignments = getRefereeAssignments(tournament);
  const matches = collectEventMatches(tournament);
  return matches
    .filter((m) => assignments[String(m.id)]?.rosterId === String(rosterId))
    .map((m) => ({
      ...m,
      assignment: assignments[String(m.id)],
    }));
}

export function buildIndividualRefereeAssignmentTable(tournament, options = {}) {
  const referees = listIndividualReferees(tournament);
  const assignments = getRefereeAssignments(tournament);
  const matches = collectEventMatches(tournament, options.eventId);
  const entries = [];
  (tournament.events || []).forEach((event) => {
    (event.entries || []).forEach((entry) => {
      entries.push(entry);
    });
  });

  return matches.map((match) => {
    const assignment = assignments[String(match.id)] || null;
    const labels = resolveMatchLabels(match, { entries });
    const conflicts = assignment
      ? detectRefereeConflicts(tournament, match, assignment.rosterId, {
          eventId: match.eventId,
        })
      : [];

    return {
      matchId: match.id,
      eventId: match.eventId || "",
      eventName: match.eventName || "",
      scheduledStart: match.scheduledStart || match.scheduledAt || null,
      courtId: match.courtId || null,
      entryALabel: labels.entryALabel,
      entryBLabel: labels.entryBLabel,
      stageLabel: labels.stageLabel,
      status: match.status,
      rosterId: assignment?.rosterId || "",
      refereeName: assignment?.refereeName || "",
      token: assignment?.token || match.referee?.token || "",
      assigned: Boolean(assignment),
      conflicts,
      availableReferees: referees,
    };
  });
}

export function getAssignAuditLog(tournament) {
  return getPropagationBlob(tournament).auditLog.filter((e) =>
    Object.values(REFEREE_ASSIGN_AUDIT).includes(e.action)
  );
}

export { normalizeRefereeRoster, COMMAND_IDS_CAP };
