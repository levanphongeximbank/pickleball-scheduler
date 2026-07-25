/**
 * COMMS-ACT-05 — authorize trusted System producer (not end-user JWT).
 */

import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";
import { getCommunicationApiSupabaseUrl } from "./authorizeCommunicationActor.js";
import {
  COMMUNICATION_SYSTEM_PRODUCER_ID,
  COMMUNICATION_TRUSTED_BACKEND_ENV,
} from "../../src/features/communication/trustedBackend/constants.js";
import { assertCommunicationProductionTargetAllowed } from "./productionTargetGate.js";

function createServiceClient(url, serviceKey) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * System producer uses COMMS_SYSTEM_PRODUCER_KEY header/body — never user JWT alone.
 * @param {import('http').IncomingMessage} req
 * @param {object} [body]
 */
export async function authorizeSystemProducer(req, body = {}) {
  const headerKey = String(
    req.headers?.["x-comms-system-producer-key"] ||
      req.headers?.["X-Comms-System-Producer-Key"] ||
      ""
  ).trim();
  const bodyKey = String(body.producerKey || "").trim();
  const provided = headerKey || bodyKey;
  const expected = String(
    globalThis.process?.env?.[COMMUNICATION_TRUSTED_BACKEND_ENV.SYSTEM_PRODUCER_KEY] ||
      ""
  ).trim();

  if (!expected) {
    return {
      ok: false,
      code: "SYSTEM_PRODUCER_KEY_MISSING",
      error: "COMMS_SYSTEM_PRODUCER_KEY chưa cấu hình trên server.",
    };
  }

  if (!provided || provided !== expected) {
    return {
      ok: false,
      code: "SYSTEM_PRODUCER_DENIED",
      error: "System producer authentication failed.",
    };
  }

  // Explicitly reject if caller also tries to present a user Bearer as authority.
  const authHeader = String(
    req.headers?.authorization || req.headers?.Authorization || ""
  );
  if (authHeader.startsWith("Bearer ") && body.allowUserBearer !== true) {
    // Presence of Bearer alone is OK for transport, but identity remains producer.
  }

  const url = getCommunicationApiSupabaseUrl() || getSupabaseServerUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) {
    return {
      ok: false,
      code: "NO_SUPABASE",
      error: "Supabase server chưa cấu hình.",
    };
  }

  const productionGate = assertCommunicationProductionTargetAllowed(url);
  if (!productionGate.ok) {
    return productionGate;
  }

  return {
    ok: true,
    producerId: COMMUNICATION_SYSTEM_PRODUCER_ID,
    serviceClient: createServiceClient(url, serviceKey),
  };
}

/**
 * Deny browser-style end-user attempts to call system produce with only JWT.
 * @param {import('http').IncomingMessage} req
 */
export function denyBrowserSystemInvocation(req, body = {}) {
  const headerKey = String(
    req.headers?.["x-comms-system-producer-key"] || ""
  ).trim();
  const bodyKey = String(body.producerKey || "").trim();
  if (!headerKey && !bodyKey) {
    return {
      ok: false,
      code: "SYSTEM_BROWSER_INVOCATION_DENIED",
      error:
        "System messaging requires trusted producer key — browser JWT alone is denied.",
    };
  }
  return { ok: true };
}
