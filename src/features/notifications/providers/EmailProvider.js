import { NotificationProvider } from "./NotificationProvider.js";
import { getIntegrationEnvConfig, isEmailEnabled } from "../../integrations/config/integrationFlags.js";
import { mockEmailProvider } from "./MockNotificationProvider.js";

export class EmailProvider extends NotificationProvider {
  constructor() {
    super("email");
  }

  isConfigured() {
    const cfg = getIntegrationEnvConfig().email;
    return isEmailEnabled() && cfg.host && cfg.from;
  }

  async send(input) {
    if (!this.isConfigured()) {
      return mockEmailProvider.send(input);
    }
    return {
      ok: true,
      providerMessageId: `email_${Date.now()}`,
      channel: "email",
      sandbox: true,
    };
  }
}

export const emailProvider = new EmailProvider();
