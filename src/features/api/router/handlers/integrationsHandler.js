import { API_SCOPES } from "../../constants/apiScopes.js";
import { getIntegrationOverview } from "../../../integrations/services/integrationSettingsService.js";
import { listIntegrationProviders } from "../../../integrations/constants/integrationRegistry.js";

export const integrationsRoutes = [
  {
    method: "GET",
    path: "/integrations",
    scope: API_SCOPES.INTEGRATIONS_READ,
    handler: ({ auth }) => {
      const overview = getIntegrationOverview(auth.tenantId);
      return {
        tenantId: auth.tenantId,
        providers: overview.providers,
        providerCount: listIntegrationProviders().length,
        settings: {
          zaloEnabled: overview.settings?.zaloEnabled ?? false,
          emailEnabled: overview.settings?.emailEnabled ?? false,
          smsEnabled: overview.settings?.smsEnabled ?? false,
          vnpayEnabled: overview.settings?.vnpayEnabled ?? false,
          momoEnabled: overview.settings?.momoEnabled ?? false,
          stripeEnabled: overview.settings?.stripeEnabled ?? false,
          mockPaymentEnabled: overview.settings?.mockPaymentEnabled ?? false,
        },
      };
    },
  },
];
