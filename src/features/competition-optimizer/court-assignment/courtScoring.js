/**
 * Default soft scoring for court assignment (lower is better).
 */

function courtSlotKey(courtId, slotIndex, scheduledAt) {
  const slot =
    slotIndex != null ? `slot:${slotIndex}` : `at:${scheduledAt || ""}`;
  return `${String(courtId)}@${slot}`;
}

/**
 * @param {Array} assignments
 * @param {Array} courts
 * @param {object} [options]
 */
export function computeCourtDefaultPenalty(assignments = [], courts = [], options = {}) {
  const courtById = new Map(courts.map((court) => [String(court.id), court]));
  const load = new Map();
  const teamCourts = new Map();

  for (const row of assignments || []) {
    const key = courtSlotKey(row.courtId, row.slotIndex, row.scheduledAt);
    load.set(key, (load.get(key) || 0) + 1);

    for (const teamId of [row.teamAId, row.teamBId]) {
      if (!teamId) continue;
      const tKey = String(teamId);
      if (!teamCourts.has(tKey)) teamCourts.set(tKey, []);
      teamCourts.get(tKey).push(String(row.courtId));
    }

    const court = courtById.get(String(row.courtId));
    if (court?.isCentral && options.preferCentralForHighStakes) {
      // no extra penalty when central is used appropriately
    } else if (!court?.isCentral && options.preferCentralForHighStakes) {
      // mild penalty for non-central when central preferred
    }
  }

  const loads = [...load.values()];
  const loadSpread =
    loads.length > 0 ? Math.max(...loads) - Math.min(...loads) : 0;
  const loadBalancePenalty = loadSpread * 25;

  let movementPenalty = 0;
  for (const courtIds of teamCourts.values()) {
    if (courtIds.length < 2) continue;
    for (let i = 1; i < courtIds.length; i += 1) {
      if (courtIds[i] !== courtIds[i - 1]) {
        movementPenalty += 10;
      }
    }
  }

  let centralFitPenalty = 0;
  if (options.preferCentralForHighStakes) {
    const centralIds = new Set(
      courts.filter((court) => court.isCentral).map((court) => String(court.id))
    );
    for (const row of assignments || []) {
      if (row.roundNumber === 1 && centralIds.size && !centralIds.has(String(row.courtId))) {
        centralFitPenalty += 6;
      }
    }
  }

  return loadBalancePenalty + movementPenalty + centralFitPenalty;
}

export function computeCourtFairnessMetrics(assignments = [], courts = []) {
  const load = new Map();
  for (const row of assignments || []) {
    const courtId = String(row.courtId);
    load.set(courtId, (load.get(courtId) || 0) + 1);
  }
  const counts = [...load.values()];
  return {
    courtCount: courts.length,
    assignmentCount: (assignments || []).length,
    loadSpread: counts.length ? Math.max(...counts) - Math.min(...counts) : 0,
  };
}
