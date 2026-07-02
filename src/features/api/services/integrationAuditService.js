import { getRuntimeStorage } from "../../../utils/runtimeStorage.js";
import {
  buildIntegrationAuditEntry,
  resolveIntegrationAuditEventType,
  serializeIntegrationAuditRow,
} from "../models/integrationAuditModels.js";
import {
  getAuditInsertTimeoutMs,
  getEffectiveAuditStoreMode,
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

export async function recordIntegrationAudit(entry) {
  const row = buildIntegrationAuditEntry(entry);
  const events = readJson(AUDIT_KEY, []);
  events.unshift({ id: `ial_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...row });
  writeJson(AUDIT_KEY, events.slice(0, AUDIT_CAP));

  if (getEffectiveAuditStoreMode() === "supabase") {
    try {
      await Promise.race([
        insertIntegrationAuditRow(serializeIntegrationAuditRow(row)),
        sleep(getAuditInsertTimeoutMs()).then(() => {
          throw new Error("audit insert timeout");
        }),
      ]);
    } catch (error) {
      console.warn(
        "[integrationAudit] best-effort insert failed:",
        error?.message || String(error)
      );
    }
  }

  return row;
}

/**
 * Record one audit row per edge request at router finish().
 * Fire-and-forget — never throws to caller.
 */
export function recordIntegrationAuditFromRequest({
  requestId,
  route,
  method,
  statusCode,
  resultCode,
  scopeRequired,
  routePath,
  auth = null,
} = {}) {
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

  void recordIntegrationAudit(payload).catch((error) => {
    console.warn(
      "[integrationAudit] recordIntegrationAuditFromRequest failed:",
      error?.message || String(error)
    );
  });

  return payload;
}

export function clearIntegrationAuditStorage() {
  getRuntimeStorage().removeItem(AUDIT_KEY);
}
