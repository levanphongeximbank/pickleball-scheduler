/**
 * QR token service — secure opaque tokens, no PII in payload.
 */
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { writeAuditLog } from "../../identity/services/auditService.js";
import {
  QR_ENTITY_TYPES,
  QR_PAYLOAD_PREFIX,
  QR_TOKEN_DEFAULT_TTL_HOURS,
} from "../constants/qrEntityTypes.js";

const DEV_TOKENS_KEY = "pickleball-qr-tokens-v1";

function loadDevTokens() {
  try {
    const raw = localStorage.getItem(DEV_TOKENS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDevTokens(tokens) {
  localStorage.setItem(DEV_TOKENS_KEY, JSON.stringify(tokens));
}

function generateRawToken() {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(rawToken) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(rawToken);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `dev-${rawToken}`;
}

export function buildQrPayload(rawToken) {
  return `${QR_PAYLOAD_PREFIX}${rawToken}`;
}

export function parseQrPayload(text) {
  const value = String(text || "").trim();
  if (!value.startsWith(QR_PAYLOAD_PREFIX)) {
    return { ok: false, error: "QR không thuộc hệ thống Pickleball Scheduler." };
  }
  const token = value.slice(QR_PAYLOAD_PREFIX.length);
  if (!token || token.length < 16) {
    return { ok: false, error: "Token QR không hợp lệ." };
  }
  return { ok: true, token };
}

export async function createQrToken({
  entityType,
  entityId,
  tenantId,
  venueId = null,
  tournamentId = null,
  ttlHours = QR_TOKEN_DEFAULT_TTL_HOURS,
} = {}) {
  if (!entityType || !entityId) {
    return { ok: false, error: "Thiếu entityType hoặc entityId." };
  }
  if (!Object.values(QR_ENTITY_TYPES).includes(entityType)) {
    return { ok: false, error: "Loại QR không hỗ trợ." };
  }

  const user = getCurrentUser();
  const rawToken = generateRawToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

  const record = {
    id: `qrt-${Date.now()}`,
    tenant_id: tenantId || user?.venueId || "default-tenant",
    venue_id: venueId || user?.venueId || null,
    entity_type: entityType,
    entity_id: String(entityId),
    tournament_id: tournamentId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    revoked_at: null,
    created_by: user?.id || null,
    created_at: new Date().toISOString(),
  };

  if (!hasSupabaseConfig()) {
    const tokens = loadDevTokens();
    tokens.push(record);
    saveDevTokens(tokens);
    return {
      ok: true,
      rawToken,
      payload: buildQrPayload(rawToken),
      record,
      provider: "dev",
    };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    const tokens = loadDevTokens();
    tokens.push(record);
    saveDevTokens(tokens);
    return {
      ok: true,
      rawToken,
      payload: buildQrPayload(rawToken),
      record,
      provider: "dev-fallback",
    };
  }

  const { data, error } = await client.from("qr_tokens").insert(record).select("*").single();
  if (error) {
    const tokens = loadDevTokens();
    tokens.push(record);
    saveDevTokens(tokens);
    return {
      ok: true,
      rawToken,
      payload: buildQrPayload(rawToken),
      record,
      provider: "dev-fallback",
      warning: error.message,
    };
  }

  return {
    ok: true,
    rawToken,
    payload: buildQrPayload(rawToken),
    record: data,
    provider: "supabase",
  };
}

async function findTokenRecord(rawToken) {
  const tokenHash = await hashToken(rawToken);

  if (!hasSupabaseConfig()) {
    const tokens = loadDevTokens();
    return tokens.find((t) => t.token_hash === tokenHash && !t.revoked_at) || null;
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    const tokens = loadDevTokens();
    return tokens.find((t) => t.token_hash === tokenHash && !t.revoked_at) || null;
  }

  const { data } = await client
    .from("qr_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  return data || null;
}

export async function validateQrToken(rawToken, { expectedTenantId, expectedVenueId } = {}) {
  const record = await findTokenRecord(rawToken);
  if (!record) {
    return { ok: false, error: "QR không tồn tại hoặc đã bị thu hồi.", code: "NOT_FOUND" };
  }

  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return { ok: false, error: "QR đã hết hạn.", code: "EXPIRED", record };
  }

  if (expectedTenantId && record.tenant_id !== expectedTenantId) {
    return { ok: false, error: "QR không thuộc tenant hiện tại.", code: "WRONG_TENANT", record };
  }

  if (expectedVenueId && record.venue_id && record.venue_id !== expectedVenueId) {
    return { ok: false, error: "QR không thuộc sân/venue hiện tại.", code: "WRONG_VENUE", record };
  }

  return { ok: true, record };
}

export async function revokeQrToken(tokenId) {
  const user = getCurrentUser();
  if (!hasSupabaseConfig()) {
    const tokens = loadDevTokens();
    const idx = tokens.findIndex((t) => t.id === tokenId);
    if (idx >= 0) {
      tokens[idx].revoked_at = new Date().toISOString();
      saveDevTokens(tokens);
    }
    return { ok: true };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa sẵn sàng." };
  }

  const { error } = await client
    .from("qr_tokens")
    .update({ revoked_at: new Date().toISOString(), revoked_by: user?.id })
    .eq("id", tokenId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function auditQrScan({ result, metadata = {} }) {
  await writeAuditLog({
    action: result.ok ? "qr_scan_success" : "qr_scan_failed",
    resourceType: "qr_token",
    resourceId: result.record?.id || "",
    metadata: {
      code: result.code || null,
      entityType: result.record?.entity_type || null,
      entityId: result.record?.entity_id || null,
      ...metadata,
    },
  });
}
