/**
 * Team Tournament Adapter ĐẦU B — Identity & Access.
 * Translator only. Identity remains src/features/identity authority.
 */

import {
  IDENTITY_ACCESS_CONTRACT,
  createIdentityAccessBinding,
} from "../../../competition-engine/integration/contracts/index.js";
import { TEAM_ADAPTER_B_CLASSIFICATION, TEAM_ADAPTER_B_NAMES } from "./constants.js";
import { wrapTeamBAdapter } from "./surface.js";

export function createTeamTournamentIdentityAccessAdapter(deps = {}) {
  const inner = deps.contractA || createIdentityAccessBinding(deps);
  return wrapTeamBAdapter(inner, {
    adapterBName: TEAM_ADAPTER_B_NAMES[1],
    ordinal: 1,
    classification: TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED,
    activation: deps.activation !== false,
    requiredMethods: IDENTITY_ACCESS_CONTRACT.requiredMethods,
  });
}
