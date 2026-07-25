import { NotificationProvider } from "./NotificationProvider.js";
import { getIntegrationEnvConfig } from "../../integrations/config/integrationFlags.js";
import { isBrowserProviderCredentialResolved } from "../../integrations/config/legacyViteSecretCutover.js";
import { mockEmailProvider } from "./MockNotificationProvider.js";

export class EmailProvider extends NotificationProvider {
  constructor() {
    super("email");
  }

  isConfigured() {
    const cfg = getIntegrationEnvConfig().email;
    // ECO-02b: SMTP user/pass are server-only; host/from alone ≠ ready.
    return Boolean(
      isBrowserProviderCredentialResolved(cfg) && cfg.host && cfg.from
    );
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
