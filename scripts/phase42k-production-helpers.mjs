/**
 * Shared helpers for Phase 42K Production QA (no .env.local bleed).
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

export const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
export const STAGING_REF = "qyewbxjsiiyufanzcjcq";
export const DEPLOYMENT = String(
  process.env.PRODUCTION_APP_URL || "https://pickleball-scheduler-eight.vercel.app"
).replace(/\/+$/, "");

export const TENANT_PROD = "venue-prod-main";
export const CLUB_ACCC_ID = "club-219e4a7cbd73437eb6271f02a53314c3";

export const TENANT_OWNER_EMAIL = String(
  process.env.PRODUCTION_TENANT_OWNER_EMAIL || "chusantest@gmail.com"
).trim();
export const SA_EMAIL = String(
  process.env.PRODUCTION_SUPERADMIN_NOMEMBER_EMAIL || "lephong.eximbank@gmail.com"
).trim();
export const PLAYER_NOMEMBER_EMAIL = String(
  process.env.PRODUCTION_PLAYER_NOMEMBER_EMAIL || "qa42l-prod-player-nomember@pickleball-scheduler.qa"
).trim();
export const SA_WITH_MEMBER_EMAIL = String(
  process.env.PRODUCTION_SUPERADMIN_MEMBER_EMAIL || "qa42l-prod-sa-member@pickleball-scheduler.qa"
).trim();
export const PRESIDENT_EMAIL = String(
  process.env.PRODUCTION_ACTIVE_MEMBER_EMAIL || "huynhanh1970@gmail.com"
).trim();

export function getSupabaseConfig() {
  const url = String(process.env.VITE_SUPABASE_URL || "").trim();
  const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !anonKey) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  if (url.includes(STAGING_REF)) throw new Error(`Refusing Staging ref ${STAGING_REF}`);
  if (!url.includes(PRODUCTION_REF)) throw new Error(`Refusing non-Production ref`);
  return { url, anonKey, serviceKey };
}

export function createAdminClient() {
  const { url, serviceKey } = getSupabaseConfig();
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function lookupProfile(admin, email) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, role, venue_id, club_id, status")
    .eq("email", email)
    .maybeSingle();
  if (error || !data?.id) throw new Error(`Profile not found: ${email}`);
  return data;
}

export async function loginViaMagicLink(page, email) {
  const { url, anonKey, serviceKey } = getSupabaseConfig();
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${DEPLOYMENT}/` },
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(error?.message || "generateLink failed");
  }
  const { data: sessionData, error: verifyError } = await client.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError || !sessionData?.session) {
    throw new Error(verifyError?.message || "verifyOtp failed");
  }
  const projectRef = new URL(url).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const payload = {
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    expires_at: sessionData.session.expires_at,
    expires_in: sessionData.session.expires_in,
    token_type: sessionData.session.token_type,
    user: sessionData.session.user,
  };
  await page.goto(`${DEPLOYMENT}/login`, { waitUntil: "commit", timeout: 120000 });
  await page.evaluate(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [storageKey, JSON.stringify(payload)]
  );
  await page.goto(`${DEPLOYMENT}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  if (page.url().includes("/login")) {
    throw new Error(`Session injection failed for ${email}`);
  }
}

export async function pageToken(page) {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k?.includes("auth-token")) continue;
      try {
        const p = JSON.parse(localStorage.getItem(k));
        return p?.access_token || p?.currentSession?.access_token || null;
      } catch {
        /* */
      }
    }
    return null;
  });
}

export async function rpcCall(page, fn, args) {
  const accessToken = await pageToken(page);
  const { url, anonKey } = getSupabaseConfig();
  return page.evaluate(
    async ({ supabaseUrl, anonKey, accessToken, fn, args }) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(args),
      });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    },
    { supabaseUrl: url, anonKey, accessToken, fn, args }
  );
}

export async function capturePageState(page, label, evidenceDir) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const safe = label.replace(/[^\w-]+/g, "_");
  const png = path.join(evidenceDir, `${safe}.png`);
  await page.screenshot({ path: png, fullPage: true });
  const bodyText = await page.locator("body").innerText();
  const navLinks = await page.locator("a, button").allTextContents();
  const visibleNav = [...new Set(navLinks.map((t) => t.trim()).filter(Boolean))].slice(0, 40);
  return {
    url: page.url(),
    screenshot: png,
    bodySnippet: bodyText.slice(0, 500).replace(/\s+/g, " "),
    visibleNav,
    hasMembersTabRole: (await page.getByRole("tab", { name: /thành viên/i }).count()) > 0,
    hasMembersButton: (await page.getByRole("button", { name: /^thành viên$/i }).count()) > 0,
    hasRequestsHeading: /yêu cầu gia nhập/i.test(bodyText),
    hasApproveButton: (await page.getByRole("button", { name: /^duyệt$/i }).count()) > 0,
    hasCreateClubButton: (await page.getByRole("button", { name: /tạo clb mới/i }).count()) > 0,
  };
}

export async function probeSelectorMismatch(page, label, evidenceDir, checks = {}) {
  const state = await capturePageState(page, label, evidenceDir);
  const failures = [];
  for (const [key, expected] of Object.entries(checks)) {
    if (!expected) continue;
    if (key === "urlIncludes" && !state.url.includes(expected)) {
      failures.push(`url expected includes ${expected}, got ${state.url}`);
    }
    if (key === "heading" && !new RegExp(expected, "i").test(state.bodySnippet)) {
      failures.push(`heading /${expected}/i not found`);
    }
    if (key === "approveButton" && !state.hasApproveButton) {
      failures.push("approve button (Duyệt) not found");
    }
    if (key === "membersTab" && !state.hasMembersTabRole) {
      failures.push("MUI tab Thành viên not found");
    }
    if (key === "membersButton" && !state.hasMembersButton) {
      failures.push("segmented button Thành viên not found");
    }
    if (key === "createClub" && !state.hasCreateClubButton) {
      failures.push("Tạo CLB mới button not found");
    }
  }
  return {
    ...state,
    verdict: failures.length ? "TEST_SELECTOR_MISMATCH" : "SELECTOR_OK",
    failures,
  };
}

export function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseCasesFilter() {
  const raw = String(process.env.PHASE42K_CASE || "all").trim();
  if (raw === "all") return null;
  return new Set(raw.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean));
}

export function shouldRunCase(filter, id) {
  if (!filter) return true;
  return filter.has(id.toUpperCase());
}

export function formatRpcEvidence(res) {
  if (!res) return "rpc=null";
  const body = res.body;
  if (!body) return `status=${res.status} body=null`;
  const keys = body && typeof body === "object" ? redactResponseKeys(body) : [];
  const keyHint = keys.length ? ` keys=[${keys.join(",")}]` : "";
  return `status=${res.status} ok=${body.ok} code=${body.code || ""} msg=${body.message || body.error || ""}${keyHint}`;
}

const SENSITIVE_KEY_RE = /token|password|secret|key|email|phone|address|hash/i;

/** Log-safe top-level response keys (values redacted). */
export function redactResponseKeys(body, depth = 0) {
  if (!body || typeof body !== "object" || depth > 2) return [];
  if (Array.isArray(body)) {
    return body.length ? [`array(${body.length})`] : ["array(0)"];
  }
  return Object.keys(body).map((k) => {
    const v = body[k];
    if (SENSITIVE_KEY_RE.test(k)) return `${k}:***`;
    if (v && typeof v === "object" && !Array.isArray(v) && depth < 2) {
      return `${k}:{${redactResponseKeys(v, depth + 1).join(",")}}`;
    }
    if (Array.isArray(v)) return `${k}:array(${v.length})`;
    if (typeof v === "string" && v.length > 48) return `${k}:string(${v.length})`;
    return k;
  });
}

/** Extract club id from Phase 42 canonical RPC envelope. */
export function extractClubIdFromBody(body) {
  if (!body || typeof body !== "object") return null;
  const candidates = [
    body.data?.id,
    body.data?.club_id,
    body.club?.id,
    body.id,
    body.club_id,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("club-")) return c;
  }
  return null;
}

/**
 * Parse PostgREST RPC result into structured envelope.
 * @param {{ expectClubId?: boolean }} [opts]
 */
export function parseRpcEnvelope(res, opts = {}) {
  const expectClubId = opts.expectClubId === true;
  const body = res?.body;
  const responseKeys = body && typeof body === "object" ? redactResponseKeys(body) : [];
  if (!body) {
    return {
      ok: false,
      clubId: null,
      club: null,
      version: null,
      code: "EMPTY_BODY",
      error: "RPC body null",
      parserVerdict: "RPC_EMPTY",
      responseKeys,
      httpStatus: res?.status ?? null,
    };
  }

  const httpStatus = res?.status ?? null;
  const postgrestCode = body.code || body.hint || null;
  const postgrestMsg = body.message || body.error || body.details || null;

  if (httpStatus === 404 && postgrestCode === "PGRST202") {
    return {
      ok: false,
      clubId: null,
      club: null,
      version: null,
      code: "PGRST202",
      error: postgrestMsg,
      parserVerdict: "RPC_SIGNATURE_MISMATCH",
      responseKeys,
      httpStatus,
    };
  }

  if (body.ok === false) {
    return {
      ok: false,
      clubId: null,
      club: body.data && typeof body.data === "object" ? body.data : null,
      version: body.version ?? null,
      code: body.code || postgrestCode,
      error: body.error || postgrestMsg,
      parserVerdict: "RPC_BUSINESS_ERROR",
      responseKeys,
      httpStatus,
    };
  }

  if (body.ok === true) {
    const clubId = extractClubIdFromBody(body);
    const club = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : null;
    const version =
      typeof body.version === "number"
        ? body.version
        : club?.version != null
          ? Number(club.version)
          : null;
    if (expectClubId && !clubId) {
      return {
        ok: true,
        clubId: null,
        club,
        version,
        code: body.code || null,
        error: null,
        parserVerdict: "TEST_PARSER_ERROR",
        responseKeys,
        httpStatus,
      };
    }
    return {
      ok: true,
      clubId,
      club,
      version,
      code: body.code || null,
      error: null,
      parserVerdict: clubId ? "PARSED_OK" : "PARSED_OK_NO_CLUB_ID",
      responseKeys,
      httpStatus,
    };
  }

  const legacyClubId = extractClubIdFromBody(body);
  return {
    ok: legacyClubId != null,
    clubId: legacyClubId,
    club: body.data || body.club || null,
    version: body.version ?? null,
    code: body.code || null,
    error: postgrestMsg,
    parserVerdict: legacyClubId ? "LEGACY_SHAPE" : "UNKNOWN_SHAPE",
    responseKeys,
    httpStatus,
  };
}

/** Classify raw RPC for governance / signature probes. */
export function classifyRpcError(res, fnName = "") {
  const parsed = parseRpcEnvelope(res);
  if (parsed.parserVerdict === "RPC_SIGNATURE_MISMATCH") {
    return {
      classification: "RPC_SIGNATURE_MISMATCH",
      fn: fnName,
      evidence: formatRpcEvidence(res),
      parsed,
    };
  }
  if (parsed.httpStatus === 404) {
    return { classification: "RPC_NOT_FOUND", fn: fnName, evidence: formatRpcEvidence(res), parsed };
  }
  if (parsed.ok) {
    return { classification: "RPC_OK", fn: fnName, evidence: formatRpcEvidence(res), parsed };
  }
  if (parsed.parserVerdict === "RPC_BUSINESS_ERROR") {
    return {
      classification: "RPC_SIGNATURE_OK",
      fn: fnName,
      note: "Business/validation error implies function resolved (not PGRST202)",
      evidence: formatRpcEvidence(res),
      parsed,
    };
  }
  return { classification: "RPC_ERROR", fn: fnName, evidence: formatRpcEvidence(res), parsed };
}

export async function resolveApplicantEmail(admin) {
  const candidates = [
    String(process.env.PRODUCTION_APPLICANT_EMAIL || "").trim(),
    String(process.env.PRODUCTION_PLAYER_NOMEMBER_EMAIL || "").trim(),
    "doitruong@gmail.com",
    "player@gmail.com",
  ].filter(Boolean);
  const seen = new Set();
  const errors = [];
  for (const email of candidates) {
    if (seen.has(email)) continue;
    seen.add(email);
    try {
      const profile = await lookupProfile(admin, email);
      if (profile.status !== "active") {
        errors.push(`${email}: status=${profile.status}`);
        continue;
      }
      if (profile.club_id) {
        errors.push(`${email}: already in club ${profile.club_id}`);
        continue;
      }
      if (profile.venue_id && profile.venue_id !== TENANT_PROD) {
        errors.push(`${email}: venue=${profile.venue_id}`);
        continue;
      }
      return { email, profile };
    } catch (e) {
      errors.push(`${email}: ${e.message || e}`);
    }
  }
  throw new Error(`No usable applicant account. Tried: ${errors.join("; ")}`);
}

export async function listPendingRequests(page, clubId) {
  const res = await rpcCall(page, "club_list_pending_requests", { p_club_id: clubId });
  const parsed = parseRpcEnvelope(res);
  const rows = Array.isArray(res.body?.data) ? res.body.data : [];
  return { count: rows.length, rows, rpc: res, parsed };
}

export async function cleanupQaClubs(admin, prefix = "QA42K-PROD") {
  const { data, error } = await admin
    .from("clubs")
    .select("id, name")
    .ilike("name", `%${prefix}%`)
    .is("deleted_at", null);
  if (error) return { cleaned: [], error: error.message };
  const cleaned = [];
  for (const row of data || []) {
    const { error: updErr } = await admin
      .from("clubs")
      .update({ deleted_at: new Date().toISOString(), status: "archived" })
      .eq("id", row.id);
    if (!updErr) cleaned.push({ id: row.id, name: row.name });
  }
  return { cleaned, error: null };
}
