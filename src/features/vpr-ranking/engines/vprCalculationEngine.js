import { VPR_ELIGIBLE_LEVELS } from "../../../models/tournament/constants.js";
import { getVprPointConfig } from "../storage/vprLocalStore.js";

/** V1: participant multiplier hook — always 1.0 until Pick_VN defines tiers. */
export function resolveParticipantMultiplier(_participantCount) {
  return 1.0;
}

export function lookupBasePoints(tournamentLevel, placement, configTable = null) {
  const table = configTable || getVprPointConfig();
  const byLevel = table?.[placement];
  if (!byLevel) {
    return 0;
  }
  const points = byLevel[tournamentLevel];
  return Number.isFinite(Number(points)) ? Number(points) : 0;
}

export function calculateVprPoints({
  tournamentLevel,
  placement,
  participantCount = 0,
  configTable = null,
}) {
  if (!VPR_ELIGIBLE_LEVELS.includes(tournamentLevel)) {
    return 0;
  }
  const base = lookupBasePoints(tournamentLevel, placement, configTable);
  const multiplier = resolveParticipantMultiplier(participantCount);
  return Math.round(base * multiplier);
}
