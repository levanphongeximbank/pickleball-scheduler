/**
 * COMMS-ACT-05 — System message producer host (trusted internal only).
 * POST /api/communication/system-produce
 */

import {
  ApiKeyStoreConfigError,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";
import { createSystemMessageProducer } from "../../src/features/communication/trustedBackend/createSystemMessageProducer.js";
import { createIdempotencyLedger } from "../../src/features/communication/trustedBackend/createIdempotencyLedger.js";
import { mapCommunicationHttpError } from "../../src/features/communication/trustedBackend/mapCommunicationHttpError.js";
import {
  authorizeSystemProducer,
  denyBrowserSystemInvocation,
} from "./authorizeSystemProducer.js";

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      error: "Chỉ hỗ trợ POST.",
    });
  }

  const body = parseBody(req);
  const browserDeny = denyBrowserSystemInvocation(req, body);
  if (!browserDeny.ok) {
    return res.status(403).json(browserDeny);
  }

  const auth = await authorizeSystemProducer(req, body);
  if (!auth.ok) {
    const status =
      auth.code === "SYSTEM_PRODUCER_KEY_MISSING" || auth.code === "NO_SUPABASE"
        ? 503
        : 403;
    return res.status(status).json(auth);
  }

  if (!getSupabaseServiceRoleKey()) {
    return res.status(503).json({
      ok: false,
      code: "SERVICE_ROLE_MISSING",
      error: "Thiếu SUPABASE_SERVICE_ROLE_KEY trên server.",
    });
  }

  try {
    const producer = createSystemMessageProducer({
      client: auth.serviceClient,
      idempotencyLedger: createIdempotencyLedger(auth.serviceClient),
    });
    const result = await producer.produceSystemMessage({
      source: body.source,
      recipientParticipantId: body.recipientParticipantId,
      body: body.body,
      tenantId: body.tenantId || null,
      idempotencyKey: body.idempotencyKey || null,
      messageId: body.messageId || null,
      senderParticipantId: body.senderParticipantId,
    });
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    if (error instanceof ApiKeyStoreConfigError) {
      return res.status(503).json({
        ok: false,
        code: "SERVICE_ROLE_MISSING",
        error: error.message,
      });
    }
    const mapped = mapCommunicationHttpError(error);
    return res.status(mapped.status).json(mapped.body);
  }
}
