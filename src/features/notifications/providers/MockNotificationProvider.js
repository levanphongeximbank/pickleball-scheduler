import { NotificationProvider } from "./NotificationProvider.js";

export class MockNotificationProvider extends NotificationProvider {
  constructor(channel) {
    super(`mock_${channel}`);
    this.channel = channel;
  }

  async send(input) {
    if (input.simulateFailure) {
      return {
        ok: false,
        error: "Mock notification failed (simulated).",
      };
    }
    return {
      ok: true,
      providerMessageId: `mock_${this.channel}_${Date.now()}`,
      channel: this.channel,
    };
  }
}

export const mockEmailProvider = new MockNotificationProvider("email");
export const mockSmsProvider = new MockNotificationProvider("sms");
export const mockZaloProvider = new MockNotificationProvider("zalo");
