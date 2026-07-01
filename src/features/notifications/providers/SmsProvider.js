import { NotificationProvider } from "./NotificationProvider.js";
import { getIntegrationEnvConfig, isSmsEnabled } from "../../integrations/config/integrationFlags.js";
import { mockSmsProvider } from "./MockNotificationProvider.js";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateState = new Map();

export class SmsProvider extends NotificationProvider {
  constructor() {
    super("sms");
  }

  isConfigured() {
    const cfg = getIntegrationEnvConfig().sms;
    return isSmsEnabled() && cfg.apiKey;
  }

  checkRateLimit(tenantId) {
    const key = tenantId || "global";
    const now = Date.now();
    const bucket = rateState.get(key) || [];
    const recent = bucket.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      return { ok: false, error: "SMS rate limit exceeded." };
    }
    recent.push(now);
    rateState.set(key, recent);
    return { ok: true };
  }

  async send(input) {
    const rate = this.checkRateLimit(input.tenantId);
    if (!rate.ok) return rate;

    if (!this.isConfigured()) {
      return mockSmsProvider.send(input);
    }
    return {
      ok: true,
      providerMessageId: `sms_${Date.now()}`,
      channel: "sms",
      sandbox: true,
    };
  }
}

export const smsProvider = new SmsProvider();
