import { REFEREE_STATUS } from "../constants/statuses.js";

export function buildRefereeRosterFromStaff(staffList = []) {
  return (staffList || [])
    .filter((member) => {
      const role = String(member.role || "").toUpperCase();
      return role.includes("REFEREE") || role === "REFEREE";
    })
    .map((member) => ({
      id: String(member.id || member.userId || member.email),
      name: member.name || member.email || "Trọng tài",
      status: member.active === false ? REFEREE_STATUS.OFFLINE : REFEREE_STATUS.AVAILABLE,
      matchCount: 0,
      courtId: null,
    }));
}

export function resolveRefereeStatus(referee, activeAssignments = []) {
  if (referee.status === REFEREE_STATUS.OFFLINE) {
    return REFEREE_STATUS.OFFLINE;
  }

  const busy = activeAssignments.some(
    (item) =>
      String(item.refereeId) === String(referee.id) &&
      (item.status === "assigned" || item.status === "playing" || item.status === "busy")
  );

  if (busy) {
    return REFEREE_STATUS.BUSY;
  }

  const assigned = activeAssignments.some(
    (item) => String(item.refereeId) === String(referee.id) && item.status === "assigned"
  );

  return assigned ? REFEREE_STATUS.ASSIGNED : REFEREE_STATUS.AVAILABLE;
}

export function assignRefereeToCourt(session, { refereeId, courtId, assignmentId }, options = {}) {
  const refId = String(refereeId || "").trim();
  if (!refId) {
    return { ok: false, error: "refereeId không hợp lệ." };
  }

  const conflict = (session.refereeAssignments || []).find(
    (item) =>
      String(item.refereeId) === refId &&
      item.status !== "released" &&
      String(item.courtId) !== String(courtId)
  );

  if (conflict) {
    return { ok: false, error: "Trọng tài đang bận sân khác." };
  }

  const now = new Date().toISOString();
  const record = {
    id: `ra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: session.id,
    courtAssignmentId: assignmentId || null,
    refereeId: refId,
    courtId: String(courtId),
    status: "assigned",
    assignedAt: now,
    releasedAt: null,
    createdBy: options.actor || null,
  };

  const refereeAssignments = [
    ...(session.refereeAssignments || []).filter(
      (item) => !(String(item.courtId) === String(courtId) && item.status !== "released")
    ),
    record,
  ];

  const assignments = (session.assignments || []).map((item) =>
    String(item.courtId) === String(courtId) || String(item.id) === String(assignmentId)
      ? { ...item, refereeId: refId, updatedAt: now }
      : item
  );

  return {
    ok: true,
    session: {
      ...session,
      refereeAssignments,
      assignments,
      updatedAt: now,
    },
    record,
    event: {
      eventType: "referee_assign",
      message: `Gán trọng tài ${refId} sân ${courtId}`,
      entityType: "referee",
      entityId: refId,
      metadata: { courtId, assignmentId },
      createdBy: options.actor || null,
    },
  };
}

export function releaseRefereeFromCourt(session, courtId, options = {}) {
  const now = new Date().toISOString();
  const refereeAssignments = (session.refereeAssignments || []).map((item) =>
    String(item.courtId) === String(courtId) && item.status !== "released"
      ? { ...item, status: "released", releasedAt: now }
      : item
  );

  const assignments = (session.assignments || []).map((item) =>
    String(item.courtId) === String(courtId)
      ? { ...item, refereeId: null, updatedAt: now }
      : item
  );

  return {
    ok: true,
    session: { ...session, refereeAssignments, assignments, updatedAt: now },
    event: {
      eventType: "referee_assign",
      message: `Gỡ trọng tài khỏi sân ${courtId}`,
      entityType: "court",
      entityId: String(courtId),
      createdBy: options.actor || null,
    },
  };
}

export function suggestRefereeForCourt(refereeList = [], activeAssignments = []) {
  const busyIds = new Set(
    activeAssignments
      .filter((item) => item.status === "assigned" || item.status === "busy")
      .map((item) => String(item.refereeId))
  );

  const available = refereeList.filter(
    (ref) => ref.status !== REFEREE_STATUS.OFFLINE && !busyIds.has(String(ref.id))
  );

  if (!available.length) {
    return null;
  }

  return [...available].sort(
    (a, b) => Number(a.matchCount || 0) - Number(b.matchCount || 0)
  )[0];
}
