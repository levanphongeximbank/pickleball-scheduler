/**
 * Team Tournament Adapter ĐẦU B — OPTIONAL / NOT_REQUIRED boundaries 09–15.
 * Honest NOT_CONFIGURED. Never empty-success.
 */

import {
  ANALYTICS_REPORTING_CONTRACT,
  CRM_SPONSOR_CONTRACT,
  FEDERATION_EXTERNAL_AUTHORITY_CONTRACT,
  FILE_MEDIA_CONTRACT,
  FINANCE_PAYMENT_CONTRACT,
  NOTIFICATION_COMMUNICATION_CONTRACT,
  STREAMING_SCOREBOARD_CONTRACT,
  createAnalyticsReportingBinding,
  createCrmSponsorBinding,
  createFederationExternalAuthorityBinding,
  createFileMediaBinding,
  createFinancePaymentBinding,
  createNotConfiguredContractAdapter,
  createNotificationCommunicationBinding,
  createStreamingScoreboardBinding,
} from "../../../competition-engine/integration/contracts/index.js";
import {
  TEAM_ADAPTER_B_CLASSIFICATION,
  TEAM_ADAPTER_B_NAMES,
} from "./constants.js";
import {
  isTeamFederationActivated,
  isTeamFinanceActivated,
  isTeamOptionalActivated,
} from "./activation.js";
import { wrapTeamBAdapter } from "./surface.js";

function createBoundary(definition, factory, meta, deps = {}) {
  const inner =
    deps.contractA ||
    (typeof factory === "function" ? factory(deps) : createNotConfiguredContractAdapter(definition));
  return wrapTeamBAdapter(inner, {
    ...meta,
    requiredMethods: definition.requiredMethods,
  });
}

export function createTeamTournamentFinancePaymentAdapter(deps = {}) {
  const activation = isTeamFinanceActivated(deps);
  return createBoundary(
    FINANCE_PAYMENT_CONTRACT,
    activation ? createFinancePaymentBinding : () =>
      createNotConfiguredContractAdapter(FINANCE_PAYMENT_CONTRACT),
    {
      adapterBName: TEAM_ADAPTER_B_NAMES[9],
      ordinal: 9,
      classification: TEAM_ADAPTER_B_CLASSIFICATION.NOT_REQUIRED,
      activation,
    },
    deps
  );
}

export function createTeamTournamentNotificationCommunicationAdapter(deps = {}) {
  const activation = isTeamOptionalActivated("notifications.enabled", deps);
  return createBoundary(
    NOTIFICATION_COMMUNICATION_CONTRACT,
    activation ? createNotificationCommunicationBinding : () =>
      createNotConfiguredContractAdapter(NOTIFICATION_COMMUNICATION_CONTRACT),
    {
      adapterBName: TEAM_ADAPTER_B_NAMES[10],
      ordinal: 10,
      classification: TEAM_ADAPTER_B_CLASSIFICATION.OPTIONAL,
      activation,
    },
    deps
  );
}

export function createTeamTournamentFileMediaAdapter(deps = {}) {
  const activation = isTeamOptionalActivated("media.enabled", deps);
  return createBoundary(
    FILE_MEDIA_CONTRACT,
    createFileMediaBinding,
    {
      adapterBName: TEAM_ADAPTER_B_NAMES[11],
      ordinal: 11,
      classification: TEAM_ADAPTER_B_CLASSIFICATION.OPTIONAL,
      activation,
    },
    deps
  );
}

export function createTeamTournamentStreamingScoreboardAdapter(deps = {}) {
  const activation = isTeamOptionalActivated("streaming.enabled", deps);
  return createBoundary(
    STREAMING_SCOREBOARD_CONTRACT,
    createStreamingScoreboardBinding,
    {
      adapterBName: TEAM_ADAPTER_B_NAMES[12],
      ordinal: 12,
      classification: TEAM_ADAPTER_B_CLASSIFICATION.OPTIONAL,
      activation,
    },
    deps
  );
}

export function createTeamTournamentFederationExternalAuthorityAdapter(deps = {}) {
  const activation = isTeamFederationActivated(deps);
  return createBoundary(
    FEDERATION_EXTERNAL_AUTHORITY_CONTRACT,
    activation ? createFederationExternalAuthorityBinding : () =>
      createNotConfiguredContractAdapter(FEDERATION_EXTERNAL_AUTHORITY_CONTRACT),
    {
      adapterBName: TEAM_ADAPTER_B_NAMES[13],
      ordinal: 13,
      classification: TEAM_ADAPTER_B_CLASSIFICATION.NOT_REQUIRED,
      activation,
    },
    deps
  );
}

export function createTeamTournamentCrmSponsorAdapter(deps = {}) {
  const activation = isTeamOptionalActivated("crm.enabled", deps);
  return createBoundary(
    CRM_SPONSOR_CONTRACT,
    createCrmSponsorBinding,
    {
      adapterBName: TEAM_ADAPTER_B_NAMES[14],
      ordinal: 14,
      classification: TEAM_ADAPTER_B_CLASSIFICATION.OPTIONAL,
      activation,
    },
    deps
  );
}

export function createTeamTournamentAnalyticsReportingAdapter(deps = {}) {
  const activation = isTeamOptionalActivated("analytics.enabled", deps);
  return createBoundary(
    ANALYTICS_REPORTING_CONTRACT,
    createAnalyticsReportingBinding,
    {
      adapterBName: TEAM_ADAPTER_B_NAMES[15],
      ordinal: 15,
      classification: TEAM_ADAPTER_B_CLASSIFICATION.OPTIONAL,
      activation,
    },
    deps
  );
}
