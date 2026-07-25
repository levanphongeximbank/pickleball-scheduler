/**
 * COMMS-ACT-05 — Communication trusted-backend command host (Vercel serverless).
 * POST /api/communication/command
 */

import {
  ApiKeyStoreConfigError,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";
import { createTrustedCommunicationBackend } from "../../src/features/communication/trustedBackend/createTrustedCommunicationBackend.js";
import { mapCommunicationHttpError } from "../../src/features/communication/trustedBackend/mapCommunicationHttpError.js";
import { authorizeCommunicationActor } from "./authorizeCommunicationActor.js";
import {
  assertCommunicationRateLimit,
  assertCommunicationRequestSize,
} from "./requestGuards.js";

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

  const sizeGate = assertCommunicationRequestSize(req.body);
  if (!sizeGate.ok) {
    return res.status(413).json(sizeGate);
  }
  const rateGate = assertCommunicationRateLimit(req, {
    keyPrefix: "comms-command",
  });
  if (!rateGate.ok) {
    if (rateGate.retryAfterSec) {
      res.setHeader("Retry-After", String(rateGate.retryAfterSec));
    }
    return res.status(429).json(rateGate);
  }

  const auth = await authorizeCommunicationActor(req);
  if (!auth.ok) {
    const status =
      auth.code === "NOT_AUTHENTICATED"
        ? 401
        : auth.code === "PRODUCTION_REF_BLOCKED"
          ? 403
          : auth.code === "NO_SUPABASE"
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

  const body = parseBody(req);
  const command = String(body.command || "").trim();
  if (!command) {
    return res.status(400).json({
      ok: false,
      code: "COMMAND_REQUIRED",
      error: "Thiếu command.",
    });
  }

  // Strip identity spoof fields — actor comes from JWT only.
  const payload = { ...body };
  delete payload.command;
  delete payload.actorParticipantId;
  delete payload.senderParticipantId;
  // participantId is a *target* for admin commands — keep it.

  try {
    const backend = createTrustedCommunicationBackend({
      client: auth.serviceClient,
      actorParticipantId: auth.actorId,
      tenantId: auth.tenantId,
    });

    const result = await backend.execute(command, payload);
    return res.status(200).json({
      ok: true,
      command,
      result,
      diagnostic: backend.getPublicDiagnostic(),
    });
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
