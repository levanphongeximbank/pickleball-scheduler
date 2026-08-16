/**
 * Team Tournament Adapter ĐẦU B — Rating.
 * Evidence only. Pairing / balance / seeding engines stay Team authorities.
 */

import {
  EVIDENCE_STATUS,
  PRODUCTION_BINDING_STATUS,
  RATING_CONTRACT,
  SHARED_ADAPTER_ERROR_CODE,
  createNotConfiguredContractAdapter,
  createRatingBinding,
  failCompetitionAdapter,
  isCompetitionAdapterContractError,
} from "../../../competition-engine/integration/contracts/index.js";
import { TEAM_ADAPTER_B_CLASSIFICATION, TEAM_ADAPTER_B_NAMES } from "./constants.js";
import { isTeamRatingActivated } from "./activation.js";
import { wrapTeamBAdapter } from "./surface.js";

export function readTeamRatingValue(player) {
  const evidence = player?.canonicalRatingEvidence;
  if (evidence) {
    if (evidence.status === EVIDENCE_STATUS.OK && Number.isFinite(Number(evidence.value))) {
      return Number(evidence.value);
    }
    failCompetitionAdapter(
      evidence.code || SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED,
      evidence.message || "Rating evidence is not configured — refusing invented default",
      { playerId: player?.id || null }
    );
  }
  const explicit = player?.ratingInternal ?? player?.rating ?? player?.level;
  if (explicit === undefined || explicit === null || explicit === "") return null;
  const numeric = Number(explicit);
  return Number.isFinite(numeric) ? numeric : null;
}

export function readTeamRatingValueOrZero(player) {
  const value = readTeamRatingValue(player);
  return value == null ? 0 : value;
}

export async function hydrateCanonicalRatingEvidence(players = [], adapter, context = {}) {
  const list = Array.isArray(players) ? players : [];
  if (!adapter || adapter.activation !== true) return list;
  const next = [];
  for (const player of list) {
    const playerId = player?.id != null ? String(player.id) : "";
    try {
      const snapshot = await adapter.getRatingSnapshot({
        ...context,
        participantId: playerId,
        playerId,
      });
      const value =
        snapshot?.data?.ratingValue ??
        snapshot?.data?.rating ??
        snapshot?.data?.value;
      next.push({
        ...player,
        canonicalRatingEvidence: {
          status: snapshot?.status || EVIDENCE_STATUS.OK,
          value: Number(value),
          snapshotId: snapshot?.snapshotId || null,
        },
      });
    } catch (err) {
      if (isCompetitionAdapterContractError(err)) {
        next.push({
          ...player,
          canonicalRatingEvidence: {
            status: EVIDENCE_STATUS.NOT_CONFIGURED,
            failClosed: true,
            code: err.code,
            message: err.message,
          },
        });
        continue;
      }
      throw err;
    }
  }
  return next;
}

export function createTeamTournamentRatingAdapter(deps = {}) {
  const activated = isTeamRatingActivated(deps);
  const inner =
    deps.contractA ||
    (typeof deps.resolveRatings === "function"
      ? createRatingBinding(deps)
      : createNotConfiguredContractAdapter(RATING_CONTRACT));
  return wrapTeamBAdapter(inner, {
    adapterBName: TEAM_ADAPTER_B_NAMES[5],
    ordinal: 5,
    classification: TEAM_ADAPTER_B_CLASSIFICATION.CONDITIONAL,
    activation: activated,
    requiredMethods: RATING_CONTRACT.requiredMethods,
    sharedRuntime: inner.productionBinding || PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  });
}
