import { NOTIFICATION_CHANNELS } from "../models/notificationModels.js";
import { emailProvider } from "./EmailProvider.js";
import { smsProvider } from "./SmsProvider.js";
import { zaloOAProvider } from "./ZaloOAProvider.js";
import {
  mockEmailProvider,
  mockSmsProvider,
  mockZaloProvider,
} from "./MockNotificationProvider.js";

const PROVIDERS = {
  [NOTIFICATION_CHANNELS.EMAIL]: emailProvider,
  [NOTIFICATION_CHANNELS.SMS]: smsProvider,
  [NOTIFICATION_CHANNELS.ZALO]: zaloOAProvider,
};

export function resolveNotificationProvider(channel, { forceMock = false } = {}) {
  if (forceMock) {
    if (channel === NOTIFICATION_CHANNELS.SMS) return mockSmsProvider;
    if (channel === NOTIFICATION_CHANNELS.ZALO) return mockZaloProvider;
    return mockEmailProvider;
  }
  return PROVIDERS[channel] || mockEmailProvider;
}
