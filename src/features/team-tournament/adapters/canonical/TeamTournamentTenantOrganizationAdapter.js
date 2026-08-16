/**
 * Team Tournament Adapter ĐẦU B — Tenant & Organization.
 * tenantId != organizationId != clubId != venueId.
 * Organization identity is honest NOT_CONFIGURED until configured.
 */

import {
  TENANT_ORGANIZATION_CONTRACT,
  createTenantOrganizationBinding,
} from "../../../competition-engine/integration/contracts/index.js";
import { TEAM_ADAPTER_B_CLASSIFICATION, TEAM_ADAPTER_B_NAMES } from "./constants.js";
import { wrapTeamBAdapter } from "./surface.js";

export function createTeamTournamentTenantOrganizationAdapter(deps = {}) {
  const inner = deps.contractA || createTenantOrganizationBinding(deps);
  return wrapTeamBAdapter(inner, {
    adapterBName: TEAM_ADAPTER_B_NAMES[2],
    ordinal: 2,
    classification: TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED,
    activation: deps.activation !== false,
    requiredMethods: TENANT_ORGANIZATION_CONTRACT.requiredMethods,
  });
}
