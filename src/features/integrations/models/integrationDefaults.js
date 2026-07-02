export function createDefaultTenantSettings(tenantId) {
  return {
    tenantId,
    defaultPaymentProvider: "mock",
    vnpayEnabled: false,
    momoEnabled: false,
    stripeEnabled: false,
    mockPaymentEnabled: false,
    zaloEnabled: false,
    emailEnabled: false,
    smsEnabled: false,
    zaloConfig: {
      oaId: "",
      appId: "",
      status: "inactive",
      lastConnectedAt: null,
    },
    updatedAt: new Date().toISOString(),
  };
}
