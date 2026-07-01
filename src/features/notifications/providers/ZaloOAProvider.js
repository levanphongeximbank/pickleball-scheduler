import { NotificationProvider } from "./NotificationProvider.js";
import { getTenantIntegrationSettings } from "../../integrations/storage/integrationStorage.js";
import { isZaloOaEnabled } from "../../integrations/config/integrationFlags.js";
import { mockZaloProvider } from "./MockNotificationProvider.js";

export class ZaloOAProvider extends NotificationProvider {
  constructor() {
    super("zalo");
  }

  isConfigured(tenantId) {
    const settings = getTenantIntegrationSettings(tenantId);
    return (
      isZaloOaEnabled() &&
      settings.zaloEnabled &&
      Boolean(settings.zaloConfig?.appId)
    );
  }

  async send(input) {
    if (!this.isConfigured(input.tenantId)) {
      return mockZaloProvider.send(input);
    }
    return {
      ok: true,
      providerMessageId: `zalo_${Date.now()}`,
      channel: "zalo",
      sandbox: true,
    };
  }
}

export const zaloOAProvider = new ZaloOAProvider();
