/**
 * Canonical Referee trusted-backend command host (Vercel serverless).
 * POST /api/referee/command
 *
 * Browser: user JWT + command intent + expectedVersion + idempotencyKey
 * Server: resolve actor → CORE-13 → Adapter B → E2E-04 → durable runtime
 *
 * No service_role to browser. No direct privileged RPC from browser.
 */

import {
  ApiKeyStoreConfigError,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";
import { createTrustedRefereeBackend } from "../../src/features/referee-production-ui/application/createTrustedRefereeBackend.js";
import { authorizeRefereeActor } from "./authorizeRefereeActor.js";

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function mapError(error) {
  const code = error?.code || "REFEREE_COMMAND_FAILED";
  const message = error?.message || "Lệnh trọng tài thất bại.";
  const status =
    code === "NOT_AUTHENTICATED"
      ? 401
      : code === "SERVICE_ROLE_MISSING" || code === "NO_SUPABASE"
        ? 503
        : code === "UNKNOWN_COMMAND"
          ? 400
          : code === "STALE_WRITE" || String(code).includes("STALE")
            ? 409
            : 400;
  return {
    status,
    body: {
      ok: false,
      code,
      error: message,
      failClosed: error?.failClosed === true || true,
      stale: error?.code === "STALE_WRITE" || error?.stale === true,
      silentLegacyFallback: false,
      locationStateRequired: false,
      productionFixtureFallback: false,
      serviceRoleInBrowser: false,
      directPrivilegedRpcFromBrowser: false,
    },
  };
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

  const auth = await authorizeRefereeActor(req);
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

  const payload = { ...body };
  delete payload.command;
  delete payload.actor;
  delete payload.actorId;
  delete payload.authUid;
  delete payload.role;
  delete payload.serviceRole;
  delete payload.rpcClient;
  delete payload.runtime;

  try {
    const backend = createTrustedRefereeBackend({
      rpcClient: auth.serviceClient,
      actorId: auth.actorId,
      tenantId: payload.tenantId || auth.tenantId,
    });
    const result = await backend.execute(command, payload);
    return res.status(200).json({
      ok: result?.ok !== false,
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
    // Canonical client may return stale as thrown or as result — normalize throws.
    if (error?.stale === true || error?.code === "STALE_WRITE") {
      return res.status(409).json({
        ok: false,
        code: error.code || "STALE_WRITE",
        error: error.message,
        stale: true,
        failClosed: true,
        view: error.view || null,
        silentLegacyFallback: false,
      });
    }
    const mapped = mapError(error);
    return res.status(mapped.status).json(mapped.body);
  }
}
