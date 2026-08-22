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
import {
  createEmptySupabaseRequestCounters,
  instrumentSharedSupabaseClient,
  noteCommitSubphases,
  runWithSupabaseCounters,
  snapshotSupabaseCounters,
} from "../../src/features/referee-production-ui/application/instrumentSupabaseRequestCounters.js";
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

function isPreviewOrDev(req) {
  const host = String(req.headers?.host || "").toLowerCase();
  const vercelEnv = String(globalThis.process?.env?.VERCEL_ENV || "").toLowerCase();
  const nodeEnv = String(globalThis.process?.env?.NODE_ENV || "").toLowerCase();
  if (vercelEnv === "preview" || vercelEnv === "development") return true;
  if (nodeEnv !== "production") return true;
  if (host.includes("localhost") || host.includes("127.0.0.1")) return true;
  if (host.includes("vercel.app") && !host.includes("pickleball-scheduler")) return true;
  // Preview deploy hosts typically contain "--" branch slug.
  if (host.includes("---") || /--.*\.vercel\.app$/.test(host)) return true;
  return false;
}

/** Warm-lambda cache: avoid recreating durable runtime per request. */
let cachedBackendKey = null;
let cachedBackend = null;

function getOrCreateBackend(auth, tenantId) {
  instrumentSharedSupabaseClient(auth.serviceClient);
  const key = `${auth.actorId}::${tenantId || ""}`;
  if (cachedBackend && cachedBackendKey === key) {
    return { backend: cachedBackend, runtimeCreateMs: 0, cacheHit: true };
  }
  const t0 = Date.now();
  const backend = createTrustedRefereeBackend({
    rpcClient: auth.serviceClient,
    actorId: auth.actorId,
    tenantId,
  });
  cachedBackend = backend;
  cachedBackendKey = key;
  return { backend, runtimeCreateMs: Date.now() - t0, cacheHit: false };
}

export default async function handler(req, res) {
  const requestStarted = Date.now();
  const serverTiming = {
    REQUEST_TOTAL_MS: null,
    AUTH_MS: null,
    ACTOR_RESOLUTION_MS: null,
    RUNTIME_CREATE_MS: null,
    ADAPTER_CONTEXT_MS: null,
    MATCH_READ_MS: null,
    CORE_TRANSITION_MS: null,
    DURABLE_COMMIT_MS: null,
    POST_COMMIT_PROJECT_MS: null,
    RESPONSE_BUILD_MS: null,
    RUNTIME_CACHE_HIT: false,
  };

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      error: "Chỉ hỗ trợ POST.",
    });
  }

  const tAuth0 = Date.now();
  const supabaseCounters = createEmptySupabaseRequestCounters();
  const auth = await runWithSupabaseCounters(supabaseCounters, () =>
    authorizeRefereeActor(req)
  );
  serverTiming.AUTH_MS = Date.now() - tAuth0;
  serverTiming.ACTOR_RESOLUTION_MS = serverTiming.AUTH_MS;
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
    const { backend, runtimeCreateMs, cacheHit } = getOrCreateBackend(
      auth,
      payload.tenantId || auth.tenantId
    );
    serverTiming.RUNTIME_CREATE_MS = runtimeCreateMs;
    serverTiming.RUNTIME_CACHE_HIT = cacheHit;

    const tExec0 = Date.now();
    const result = await runWithSupabaseCounters(supabaseCounters, () =>
      backend.execute(command, payload)
    );
    const execMs = Date.now() - tExec0;

    const clientLatency = result?.latency || {};
    serverTiming.ADAPTER_CONTEXT_MS =
      clientLatency.contextResolutionMs ?? clientLatency.ADAPTER_CONTEXT_MS ?? null;
    serverTiming.CORE_TRANSITION_MS =
      clientLatency.coreWriteMs ?? clientLatency.CORE_TRANSITION_MS ?? null;
    serverTiming.DURABLE_COMMIT_MS =
      clientLatency.durableCommitMs ?? clientLatency.DURABLE_COMMIT_MS ?? execMs;
    serverTiming.POST_COMMIT_PROJECT_MS =
      clientLatency.postCommitProjectionMs ?? clientLatency.POST_COMMIT_PROJECT_MS ?? null;
    serverTiming.MATCH_READ_MS = clientLatency.matchReadMs ?? null;
    if (clientLatency.commitSubphases) {
      noteCommitSubphases(supabaseCounters, clientLatency.commitSubphases);
    }

    const accountedMs =
      Number(serverTiming.AUTH_MS || 0) +
      Number(serverTiming.RUNTIME_CREATE_MS || 0) +
      Number(serverTiming.ADAPTER_CONTEXT_MS || 0) +
      Number(serverTiming.MATCH_READ_MS || 0) +
      Number(serverTiming.CORE_TRANSITION_MS || 0) +
      Number(serverTiming.POST_COMMIT_PROJECT_MS || 0);

    const tResp0 = Date.now();
    serverTiming.REQUEST_TOTAL_MS = Date.now() - requestStarted;
    const includeDiag = isPreviewOrDev(req);
    const responseBody = {
      ok: result?.ok !== false,
      command,
      result,
      diagnostic: backend.getPublicDiagnostic(),
    };
    if (includeDiag) {
      const responseBuildMs = Date.now() - tResp0;
      const unaccountedMs = Math.max(
        0,
        Number(serverTiming.REQUEST_TOTAL_MS || 0) -
          accountedMs -
          responseBuildMs
      );
      responseBody.serverTiming = Object.freeze({
        ...serverTiming,
        RESPONSE_BUILD_MS: responseBuildMs,
        REQUEST_TOTAL_MS: Date.now() - requestStarted,
        UNACCOUNTED_MS: unaccountedMs,
        NETWORK_POST_COUNT: 1,
        DURABLE_COMMIT_COUNT: clientLatency.durableCommitCount ?? 1,
        POST_COMMIT_BROWSER_REFETCH: false,
        ACK_RETURNS_FULL_VIEW: true,
        PROJECT_MATCH_COUNT: clientLatency.projectMatchCount ?? 1,
        COMMIT_SUBPHASES:
          clientLatency.commitSubphases ||
          snapshotSupabaseCounters(supabaseCounters)?.COMMIT_SUBPHASES ||
          null,
        clientLatency,
        supabaseCounters: snapshotSupabaseCounters(supabaseCounters),
        SUPABASE_LEDGER: snapshotSupabaseCounters(supabaseCounters)?.LEDGER || [],
      });
    }
    return res.status(200).json(responseBody);
  } catch (error) {
    if (error instanceof ApiKeyStoreConfigError) {
      return res.status(503).json({
        ok: false,
        code: "SERVICE_ROLE_MISSING",
        error: error.message,
      });
    }
    if (error?.stale === true || error?.code === "STALE_WRITE") {
      return res.status(409).json({
        ok: false,
        code: error.code || "STALE_WRITE",
        error: error.message,
        stale: true,
        failClosed: true,
        view: error.view || null,
        silentLegacyFallback: false,
        ...(isPreviewOrDev(req)
          ? { serverTiming: { ...serverTiming, REQUEST_TOTAL_MS: Date.now() - requestStarted } }
          : {}),
      });
    }
    const mapped = mapError(error);
    return res.status(mapped.status).json(mapped.body);
  }
}
