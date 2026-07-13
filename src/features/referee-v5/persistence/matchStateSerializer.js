import { cloneMatchState } from "../domain/matchState.js";
import { hashMatchStateCanonical } from "./canonicalStateHash.js";

export function serializeMatchState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function deserializeMatchState(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return cloneMatchState(payload);
}

/** @deprecated use hashMatchStateCanonical */
export function hashMatchState(state) {
  return hashMatchStateCanonical(state);
}

export { hashMatchStateCanonical };

export function buildMatchStateId({ tenantId, tournamentId, matchId }) {
  return `${tenantId}::${tournamentId}::${matchId}`;
}
