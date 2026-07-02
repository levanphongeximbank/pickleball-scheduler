import { API_SCOPES } from "../../constants/apiScopes.js";

export const tenantRoutes = [
  {
    method: "GET",
    path: "/tenant",
    scope: API_SCOPES.TENANT_READ,
    handler: ({ auth }) => ({
      tenantId: auth.tenantId,
      clientId: auth.client?.id || null,
      scopes: auth.scopes || [],
    }),
  },
];
