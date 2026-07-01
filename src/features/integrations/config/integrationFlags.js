function readEnv(key, fallback = "") {
  if (typeof import.meta !== "undefined" && import.meta.env?.[key] !== undefined) {
    return import.meta.env[key];
  }
  const nodeEnv = globalThis.process?.env;
  if (nodeEnv?.[key] !== undefined) {
    return nodeEnv[key];
  }
  return fallback;
}

function readBool(key, fallback = false) {
  const value = String(readEnv(key, fallback ? "true" : "false")).toLowerCase();
  return value === "true" || value === "1";
}

export function isApiEnabled() {
  return readBool("VITE_API_ENABLED", false);
}

export function isMarketplaceEnabled() {
  return readBool("VITE_MARKETPLACE_ENABLED", false);
}

export function getDefaultPaymentProvider() {
  return readEnv("VITE_PAYMENT_DEFAULT_PROVIDER", "mock");
}

export function isVnpayEnabled() {
  return readBool("VITE_VNPAY_ENABLED", false);
}

export function isMomoEnabled() {
  return readBool("VITE_MOMO_ENABLED", false);
}

export function isStripeEnabled() {
  return readBool("VITE_STRIPE_ENABLED", false);
}

export function isZaloOaEnabled() {
  return readBool("VITE_ZALO_OA_ENABLED", false);
}

export function isEmailEnabled() {
  return readBool("VITE_EMAIL_ENABLED", false);
}

export function isSmsEnabled() {
  return readBool("VITE_SMS_ENABLED", false);
}

export function getSmsProvider() {
  return readEnv("VITE_SMS_PROVIDER", "mock");
}

export function getIntegrationEnvConfig() {
  return {
    paymentDefaultProvider: getDefaultPaymentProvider(),
    vnpay: {
      enabled: isVnpayEnabled(),
      tmnCode: readEnv("VITE_VNPAY_TMN_CODE", ""),
      hashSecret: readEnv("VITE_VNPAY_HASH_SECRET", ""),
      returnUrl: readEnv("VITE_VNPAY_RETURN_URL", ""),
      callbackUrl: readEnv("VITE_VNPAY_CALLBACK_URL", ""),
    },
    momo: {
      enabled: isMomoEnabled(),
      partnerCode: readEnv("VITE_MOMO_PARTNER_CODE", ""),
      accessKey: readEnv("VITE_MOMO_ACCESS_KEY", ""),
      secretKey: readEnv("VITE_MOMO_SECRET_KEY", ""),
      returnUrl: readEnv("VITE_MOMO_RETURN_URL", ""),
      callbackUrl: readEnv("VITE_MOMO_CALLBACK_URL", ""),
    },
    stripe: {
      enabled: isStripeEnabled(),
      secretKey: readEnv("VITE_STRIPE_SECRET_KEY", ""),
      webhookSecret: readEnv("VITE_STRIPE_WEBHOOK_SECRET", ""),
      successUrl: readEnv("VITE_STRIPE_SUCCESS_URL", ""),
      cancelUrl: readEnv("VITE_STRIPE_CANCEL_URL", ""),
    },
    zalo: {
      enabled: isZaloOaEnabled(),
      appId: readEnv("VITE_ZALO_OA_APP_ID", ""),
      secret: readEnv("VITE_ZALO_OA_SECRET", ""),
      accessToken: readEnv("VITE_ZALO_OA_ACCESS_TOKEN", ""),
      refreshToken: readEnv("VITE_ZALO_OA_REFRESH_TOKEN", ""),
    },
    email: {
      enabled: isEmailEnabled(),
      host: readEnv("VITE_SMTP_HOST", ""),
      port: readEnv("VITE_SMTP_PORT", ""),
      user: readEnv("VITE_SMTP_USER", ""),
      pass: readEnv("VITE_SMTP_PASS", ""),
      from: readEnv("VITE_SMTP_FROM", ""),
    },
    sms: {
      enabled: isSmsEnabled(),
      provider: getSmsProvider(),
      apiKey: readEnv("VITE_SMS_API_KEY", ""),
      apiSecret: readEnv("VITE_SMS_API_SECRET", ""),
    },
  };
}

export function getProviderStatus(providerConfig) {
  if (!providerConfig?.enabled) return "not_configured";
  const hasCreds = Object.entries(providerConfig).some(
    ([key, value]) => key !== "enabled" && String(value || "").length > 0
  );
  if (!hasCreds && providerConfig.enabled) return "error";
  return providerConfig.enabled ? "active" : "not_configured";
}
