/**
 * Team Tournament Adapter ĐẦU B — Participant.
 * Team roster ownership stays Team. Canonical player identity only.
 */

import {
  PARTICIPANT_CONTRACT,
  createParticipantBinding,
} from "../../../competition-engine/integration/contracts/index.js";
import { TEAM_ADAPTER_B_CLASSIFICATION, TEAM_ADAPTER_B_NAMES } from "./constants.js";
import { wrapTeamBAdapter } from "./surface.js";

export function createTeamTournamentParticipantAdapter(deps = {}) {
  const inner = deps.contractA || createParticipantBinding(deps);
  return wrapTeamBAdapter(inner, {
    adapterBName: TEAM_ADAPTER_B_NAMES[3],
    ordinal: 3,
    classification: TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED,
    activation: deps.activation !== false,
    requiredMethods: PARTICIPANT_CONTRACT.requiredMethods,
  });
}
