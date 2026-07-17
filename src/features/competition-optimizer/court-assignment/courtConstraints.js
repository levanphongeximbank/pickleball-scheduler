/**
 * Structural validation for court assignment candidates.
 */

export function cloneCourtAssignments(assignments = []) {
  return (assignments || []).map((row) => ({
    ...row,
    id: String(row.id || ""),
    teamAId: String(row.teamAId || ""),
    teamBId: String(row.teamBId || ""),
    courtId: String(row.courtId || ""),
    courtLabel: row.courtLabel || "",
    slotIndex: row.slotIndex != null ? Number(row.slotIndex) : null,
    scheduledAt: row.scheduledAt || null,
    locked: row.locked === true,
    status: row.status || "",
    requiredCourtId: row.requiredCourtId || "",
  }));
}

function courtSlotKey(courtId, slotIndex, scheduledAt) {
  const slot =
    slotIndex != null ? `slot:${slotIndex}` : `at:${scheduledAt || ""}`;
  return `${String(courtId)}@${slot}`;
}

/**
 * @param {object} input
 */
export function validateCourtStructure(input = {}) {
  const assignments = cloneCourtAssignments(input.assignments || []);
  const courts = input.courts || [];
  const courtById = new Map(courts.map((court) => [String(court.id), court]));
  const baseline = cloneCourtAssignments(input.baselineAssignments || []);
  const baselineById = new Map(baseline.map((row) => [row.id, row]));
  const rejectionCodes = [];
  const errors = [];
  const booked = new Map();

  for (const row of assignments) {
    const court = courtById.get(String(row.courtId));
    if (!court) {
      rejectionCodes.push("COURT_NOT_FOUND");
      errors.push(`Sân không tồn tại: ${row.courtId}.`);
      continue;
    }
    if (court.active === false) {
      rejectionCodes.push("COURT_INACTIVE");
      errors.push(`Sân không hoạt động: ${row.courtId}.`);
    }

    const key = courtSlotKey(row.courtId, row.slotIndex, row.scheduledAt);
    if (booked.has(key)) {
      rejectionCodes.push("COURT_DOUBLE_BOOKED");
      errors.push(`Sân trùng slot: ${row.courtId}.`);
    }
    booked.set(key, row.id);

    if (row.requiredCourtId && String(row.requiredCourtId) !== String(row.courtId)) {
      rejectionCodes.push("COURT_REQUIREMENT_VIOLATION");
      errors.push(`Trận ${row.id} vi phạm yêu cầu sân.`);
    }

    if (row.locked) {
      const base = baselineById.get(row.id);
      if (base && String(base.courtId) !== String(row.courtId)) {
        rejectionCodes.push("LOCKED_COURT_CHANGED");
        errors.push(`Trận khóa ${row.id} đổi sân.`);
      }
    }
  }

  return {
    ok: rejectionCodes.length === 0,
    rejectionCodes: [...new Set(rejectionCodes)],
    errors,
  };
}
