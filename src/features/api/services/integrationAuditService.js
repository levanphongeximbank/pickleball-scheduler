import { getRuntimeStorage } from "../../../utils/runtimeStorage.js";
import {
  buildIntegrationAuditEntry,
  resolveIntegrationAuditEventType,
  serializeIntegrationAuditRow,
} from "../models/integrationAuditModels.js";
import {
  getAuditInsertTimeoutMs,
  getEffectiveAuditStoreMode,
  isAuditDebugEnabled,
  warnIfAuditStoreMisconfigured,
} from "../config/auditStoreConfig.js";
import { insertIntegrationAuditRow } from "../repositories/supabaseIntegrationAuditRepository.js";

const AUDIT_KEY = "pickleball-integration-audit-v1";
const AUDIT_CAP = 500;

function readJson(key, fallback) {
  try {
    const raw = getRuntimeStorage().getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  getRuntimeStorage().setItem(key, JSON.stringify(value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMetadataFromAuditContext(auditContext = {}) {
  const meta = { ...(auditContext.metadata || {}) };
  if (auditContext.denyReason) {
    meta.reason = auditContext.denyReason;
  }
  if (auditContext.requestedTenant) {
    meta.requestedTenant = auditContext.requestedTenant;
  }
  return meta;
}

function writeMemoryAuditRow(row) {
  const events = readJson(AUDIT_KEY, []);
  events.unshift({ id: `ial_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...row });
  writeJson(AUDIT_KEY, events.slice(0, AUDIT_CAP));
}

function logAuditDebug(fields) {
  if (!isAuditDebugEnabled()) {
    return;
  }
  console.log("[integrationAudit:debug]", JSON.stringify(fields));
}

export function listIntegrationAuditEvents({ tenantId = null, requestId = null, limit = 100 } = {}) {
  let events = readJson(AUDIT_KEY, []);
  if (tenantId) {
    events = events.filter((e) => e.tenantId === tenantId);
  }
  if (requestId) {
    events = events.filter((e) => e.requestId === requestId);
  }
  return events.slice(0, limit);
}

/**
 * Persist one audit row — memory always; Supabase when AUDIT_STORE resolves to supabase.
 * Never throws — returns insert outcome for debug/telemetry.
 */
export async function recordIntegrationAudit(entry, { timeoutMs } = {}) {
  warnIfAuditStoreMisconfigured();

  const row = buildIntegrationAuditEntry(entry);
  const auditStore = getEffectiveAuditStoreMode();

  try {
    writeMemoryAuditRow(row);
  } catch (error) {
    console.warn(
      "[integrationAudit] memory write failed:",
      error?.message || String(error)
    );
  }

  const outcome = {
    row,
    auditStore,
    insertAttempted: false,
    insertSuccess: false,
    error: null,
  };

  if (auditStore !== "supabase") {
    outcome.insertSuccess = true;
    return outcome;
  }

  outcome.insertAttempted = true;
  const limitMs = timeoutMs ?? getAuditInsertTimeoutMs();

  try {
    await Promise.race([
      insertIntegrationAuditRow(serializeIntegrationAuditRow(row)),
      sleep(limitMs).then(() => {
        throw new Error("audit insert timeout");
      }),
    ]);
    outcome.insertSuccess = true;
  } catch (error) {
    outcome.error = error?.message || String(error);
    console.warn("[integrationAudit] best-effort insert failed:", outcome.error);
  }

  return outcome;
}

/**
 * Record one audit row per edge request at router finish().
 * Bounded await — serverless must not return before insert completes.
 */
export async function recordIntegrationAuditFromRequest(
  {
    requestId,
    route,
    method,
    statusCode,
    resultCode,
    scopeRequired,
    routePath,
    auth = null,
  } = {},
  { timeoutMs } = {}
) {
  warnIfAuditStoreMisconfigured();

  const authOk = Boolean(auth?.ok);
  const auditContext = auth?.auditContext || {};
  const eventType = resolveIntegrationAuditEventType({
    routePath,
    method,
    authOk,
    resultCode,
  });

  if (!eventType) {
    return null;
  }

  const payload = {
    eventType,
    requestId,
    tenantId: auditContext.tenantId ?? auth?.tenantId ?? null,
    apiClientId: auditContext.apiClientId ?? auth?.client?.id ?? null,
    apiKeyId: auditContext.apiKeyId ?? auth?.apiKey?.id ?? null,
    keyPrefix: auditContext.keyPrefix ?? auth?.apiKey?.keyPrefix ?? null,
    route,
    method,
    statusCode,
    resultCode,
    scopeRequired: auditContext.scopeRequired ?? scopeRequired ?? null,
    scopesGranted: auditContext.scopesGranted ?? auth?.scopes ?? [],
    metadata: buildMetadataFromAuditContext(auditContext),
  };

  const outcome = await recordIntegrationAudit(payload, { timeoutMs });

  logAuditDebug({
    requestId,
    auditStore: outcome.auditStore,
    eventType,
    resultCode,
    statusCode,
    insertAttempted: outcome.insertAttempted,
    insertSuccess: outcome.insertSuccess,
    error: outcome.error,
  });

  return { payload, ...outcome };
}

export function clearIntegrationAuditStorage() {
  getRuntimeStorage().removeItem(AUDIT_KEY);
}
